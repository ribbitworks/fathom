// SPDX-License-Identifier: Apache-2.0

// Planned hires, as part of the data access layer. The hiring plan is Confidential, so every change
// to a hire is recorded at that tier, and only those who see Confidential data see hires' drafts and
// their history. Everyone who sees people sees each placeholder: a hire not yet filled, or, for
// readers who do not see the person who filled it, one whose person has not started, with its ID,
// position, manager, and expected month. Every change is a draft, as drafts.ts sets out, and
// changing the hiring plan is recorded in the access history, without naming the hire.

import {
  type Database,
  drafts,
  inChunks,
  people,
  plannedHires,
  plannedHireTemporaryNumbers,
  unpublishedDrafts,
} from "@fathom/db";
import {
  type Hire,
  type HireChange,
  type HireDraft,
  type HireRequest,
  type Hires,
  temporaryId,
} from "@fathom/shared";
import { and, eq, inArray, isNull, or, type SQL, sql } from "drizzle-orm";
import { randomUUID } from "node:crypto";
import {
  type Actor,
  requireAnyPermission,
  requirePermission,
  seesTier,
} from "../access.ts";
import { BadRequestError, ConflictError, NotFoundError } from "../errors.ts";
import { checkBuiltInChoice, firstChoiceMeaning } from "./built-in-lists.ts";
import {
  type Change,
  changesBetween,
  recordChanges,
  type Transaction,
} from "./changes.ts";
import {
  addDrafts,
  asDraft,
  clearedRejection,
  type Draft,
  drafted,
  draftFields,
  draftMakers,
  everything,
  lockDrafts,
  readDrafts,
  readHeld,
  type Recorded,
  refuseHeld,
  refuseHeldDecision,
  refuseRejected,
  rejectedField,
  setRejection,
  takenEmployeeIds,
  type Viewer,
  writeDraft,
} from "./drafts.ts";
import { recordEvent } from "./history.ts";
import { currentOn } from "./people.ts";
import { notMarked } from "./reporting.ts";
import { readToday } from "./settings.ts";

type Reader = Pick<Database, "select">;
type HireRow = typeof plannedHires.$inferSelect;

const recordType = "planned-hire";
const noHire = "There is no such planned hire";
const toBeRemoved =
  "This planned hire's draft removes it; discard the draft to change it";
const noDraft =
  "One of these planned hires has no draft; refresh to see the latest";
const duplicateId = "Someone already has that ID";

export const hireFields = [
  "requisition",
  "temporaryNumber",
  "positionId",
  "targetDate",
  "stateId",
  "managerId",
  "filledBy",
] as const;

// Every detail of a hire is part of the hiring plan, so Confidential, even those a placeholder
// shows, since the change history shows changes to them beside the rest.
export const hireTier = () => "confidential" as const;

export function recordedHire(row: HireRow): Recorded {
  return {
    requisition: row.requisition,
    temporaryNumber: row.temporaryNumber,
    positionId: row.positionId,
    targetDate: row.targetDate,
    stateId: row.stateId,
    managerId: row.managerId,
    filledBy: row.filledBy,
  };
}

const textOrNull = (value: unknown): string | null =>
  typeof value === "string" ? value : null;

// The hire's ID, as the ID column shows it: its requisition, or its temporary ID.
export function hireIdOf(hire: Recorded): {
  requisition: string | null;
  temporaryId: string | null;
} {
  const requisition = textOrNull(hire.requisition);
  return {
    requisition,
    temporaryId:
      requisition === null && typeof hire.temporaryNumber === "number"
        ? temporaryId(hire.temporaryNumber)
        : null,
  };
}

export function hireChanges(
  id: string,
  action: Change["action"],
  before: Recorded | undefined,
  after: Recorded | undefined,
): Change[] {
  return changesBetween(
    recordType,
    id,
    action,
    before,
    after,
    hireFields,
    hireTier,
  );
}

// Records, in the access history, that the hiring plan changed, live or in a draft, without naming
// the hire, since those who read the access history may not see the hiring plan.
export async function recordHiringChanges(
  transaction: Pick<Database, "insert">,
  actorId: string | null,
  made: readonly Change[],
): Promise<void> {
  if (made.some((change) => change.recordType === recordType)) {
    await recordEvent(transaction, {
      actorId,
      action: "hiring-plan-changed",
      subjectId: null,
    });
  }
}

// The live hires given, or every hire, as recorded, by hire, locked for a change when asked.
export async function readLiveHires(
  reader: Reader,
  ids?: readonly string[],
  lock = false,
): Promise<Map<string, Recorded>> {
  const rows: HireRow[] = [];
  const read = async (chunk?: readonly string[]) => {
    const query = reader
      .select()
      .from(plannedHires)
      .where(
        chunk === undefined ? undefined : inArray(plannedHires.id, [...chunk]),
      )
      .orderBy(plannedHires.id);
    rows.push(...(await (lock ? query.for("update") : query)));
  };
  if (ids === undefined) await read();
  else for (const chunk of inChunks([...ids])) await read(chunk);
  return new Map(rows.map((row) => [row.id, recordedHire(row)]));
}

export const readHireDrafts = (
  reader: Reader,
  ids?: readonly string[],
  viewer?: Viewer,
) => readDrafts(reader, recordType, ids, viewer);

const byId = new Intl.Collator("en", { sensitivity: "base", numeric: true });

interface Named {
  name: string;
  startDate: string | null;
  current: boolean;
}

async function peopleNamed(
  reader: Reader,
  ids: readonly string[],
  today: string,
): Promise<Map<string, Named>> {
  const found = new Map<string, Named>();
  for (const chunk of inChunks([...new Set(ids)])) {
    const rows = await reader
      .select({
        id: people.id,
        name: people.preferredName,
        startDate: people.startDate,
        endDate: people.endDate,
      })
      .from(people)
      .where(inArray(people.id, chunk));
    for (const { id, name, ...dates } of rows) {
      found.set(id, {
        name,
        startDate: dates.startDate,
        current: currentOn(dates, today),
      });
    }
  }
  return found;
}

// The hires the actor may see, by ID: the whole hiring plan, as drafts make it, for those who see
// Confidential data, and otherwise the placeholders as they are live, without their drafts. A filled
// hire is left out once its person is seen instead: by readers who see Restricted data, or by
// everyone once the person has started.
export async function readHires(
  database: Database,
  actor: Actor,
  asOf?: string,
): Promise<Hires> {
  requireAnyPermission(actor, ["confidential:view", "people:view"]);
  const today = asOf ?? (await readToday(database));
  return database.transaction(
    async (transaction) => {
      const wholePlan = seesTier(actor, "confidential");
      const live = await readLiveHires(transaction);
      const draftsNow = wholePlan
        ? await readHireDrafts(transaction, undefined, actor.user.id)
        : new Map<string, Draft>();
      const held = await readHeld(transaction, recordType, actor.user.id);
      const makers = await draftMakers(
        transaction,
        recordType,
        [...draftsNow.keys()],
        everything,
        actor.user.id,
      );
      const ids = [
        ...live.keys(),
        ...[...draftsNow.keys()].filter((id) => !live.has(id)),
      ];
      // Every hire read is live or drafted, so has a version; one drafted to be removed shows as
      // it is.
      const versions = ids.map((id) => {
        const before = live.get(id);
        const draft = draftsNow.get(id);
        const hire = (drafted(before, draft) ?? before) as Recorded;
        return { id, before, draft, hire };
      });
      // Readers who cannot see Restricted data see only current staff, so a hire names its manager
      // to them only while the manager is current, as People shows them.
      const restricted = seesTier(actor, "restricted");
      const named = await peopleNamed(
        transaction,
        versions.flatMap(({ hire, before }) =>
          [hire.managerId, hire.filledBy, before?.managerId].filter(
            (personId): personId is string => typeof personId === "string",
          ),
        ),
        today,
      );
      const thisMonth = today.slice(0, 7);
      const hires = versions.flatMap(({ id, before, draft, hire }): Hire[] => {
        const filler =
          typeof hire.filledBy === "string"
            ? named.get(hire.filledBy)
            : undefined;
        // A filled hire gives way to its person once they have started, or to readers who see them.
        if (
          typeof hire.filledBy === "string" &&
          (restricted ||
            filler === undefined ||
            filler.startDate === null ||
            filler.startDate <= today)
        ) {
          return [];
        }
        const manager =
          typeof hire.managerId === "string"
            ? named.get(hire.managerId)
            : undefined;
        const shown = manager !== undefined && (restricted || manager.current);
        const targetDate = textOrNull(hire.targetDate);
        const expectedOn = filler?.startDate ?? targetDate;
        return [
          {
            id,
            ...hireIdOf(hire),
            positionId: String(hire.positionId),
            managerId: shown ? String(hire.managerId) : null,
            managerName: shown ? manager.name : null,
            expected: expectedOn === null ? thisMonth : expectedOn.slice(0, 7),
            ...(wholePlan
              ? {
                  targetDate,
                  stateId: String(hire.stateId),
                  ...(draft === undefined
                    ? {}
                    : { draft: shownDraft(id, before, draft) }),
                  ...(held.has(id) ? { heldBy: held.get(id)?.holder } : {}),
                }
              : {}),
          },
        ];
      });

      function shownDraft(
        id: string,
        before: Recorded | undefined,
        draft: Draft,
      ): HireDraft {
        // A hire's ID is one field to the reader, whichever of the two a draft changes.
        const fields = [
          ...new Set(
            draftFields(before, draft)
              .filter((field) => field !== "filledBy")
              .map((field) =>
                field === "temporaryNumber" ? "requisition" : field,
              ),
          ),
        ];
        const liveValues: HireDraft["live"] = {};
        if (before !== undefined) {
          for (const field of fields) {
            if (field === "requisition") {
              liveValues.requisition = textOrNull(before.requisition);
            }
            if (field === "positionId") {
              liveValues.positionId = String(before.positionId);
            }
            if (field === "targetDate") {
              liveValues.targetDate = textOrNull(before.targetDate);
            }
            if (field === "stateId")
              liveValues.stateId = String(before.stateId);
            if (field === "managerId") {
              liveValues.managerId = textOrNull(before.managerId);
            }
          }
        }
        const maker = makers.get(id);
        return {
          action: draft.action,
          changed: fields,
          live: liveValues,
          state: draft.state,
          ...(draft.state === "rejected" && draft.reason !== null
            ? { reason: draft.reason }
            : {}),
          ...(draft.unpublished === true ? { unpublished: true } : {}),
          madeBy: maker?.madeBy ?? null,
          madeAt: maker?.madeAt.toISOString() ?? null,
          editors: maker?.editors ?? [],
          changedBy: Object.fromEntries(
            fields.map((field) => [
              field,
              maker?.fieldEditors.get(field) ?? null,
            ]),
          ),
        };
      }

      // No two hires have the same ID, ignoring letter case, so the order is always the same.
      const shownId = (hire: Hire) =>
        String(hire.requisition ?? hire.temporaryId);
      hires.sort((a, b) => byId.compare(shownId(a), shownId(b)));
      return { hires, wholePlan };
    },
    { isolationLevel: "repeatable read", accessMode: "read only" },
  );
}

// Until planned hires are a permission area of their own, changing them needs the rights to edit
// people and to change Confidential data, as the Decisions Log sets out.
function requireHiringEdit(actor: Actor): void {
  requirePermission(actor, "people:edit");
  requirePermission(actor, "confidential:edit");
}

// Whether a hire may have the manager given: none, or a live person whom no draft removes,
// published or not.
async function managerAllowed(
  transaction: Transaction,
  managerId: unknown,
): Promise<boolean> {
  if (typeof managerId !== "string") return true;
  const found = await transaction
    .select({ id: people.id })
    .from(people)
    .where(eq(people.id, managerId))
    .for("share");
  const removing = await transaction
    .select({ recordId: drafts.recordId })
    .from(drafts)
    .where(
      and(
        eq(drafts.recordType, "person"),
        eq(drafts.recordId, managerId),
        eq(drafts.action, "deleted"),
      ),
    );
  const removingUnpublished = await transaction
    .select({ recordId: unpublishedDrafts.recordId })
    .from(unpublishedDrafts)
    .where(
      and(
        eq(unpublishedDrafts.recordType, "person"),
        eq(unpublishedDrafts.recordId, managerId),
        eq(unpublishedDrafts.action, "deleted"),
      ),
    );
  return (
    found.length > 0 &&
    removing.length === 0 &&
    removingUnpublished.length === 0
  );
}

async function checkManager(
  transaction: Transaction,
  managerId: unknown,
): Promise<void> {
  if (!(await managerAllowed(transaction, managerId))) {
    throw new BadRequestError("Choose a manager from People");
  }
}

// Refuses a requisition that a person's Employee ID or another hire's requisition already is, live
// or in a draft, ignoring letter case.
async function checkRequisition(
  transaction: Transaction,
  requisition: string | null,
  id: string,
): Promise<void> {
  if (
    requisition !== null &&
    (await takenEmployeeIds(transaction, [requisition], [id])).length > 0
  ) {
    throw new ConflictError(duplicateId);
  }
}

// A new temporary number, never used before.
async function nextTemporaryNumber(transaction: Transaction): Promise<number> {
  const { rows } = await transaction.execute<{ number: string }>(
    sql`SELECT nextval(${`"fathom"."${String(plannedHireTemporaryNumbers.seqName)}"`}::regclass) AS number`,
  );
  return Number(rows[0]?.number);
}

// The hire's ID as a change makes it: a requisition given replaces the temporary number, and one
// cleared gives the hire a new temporary number.
async function idAsChanged(
  transaction: Transaction,
  hire: Recorded,
  requisition: string | null | undefined,
): Promise<Pick<Recorded, "requisition" | "temporaryNumber">> {
  const current = textOrNull(hire.requisition);
  if (requisition === undefined || requisition === current) {
    return {
      requisition: current,
      temporaryNumber:
        typeof hire.temporaryNumber === "number" ? hire.temporaryNumber : null,
    };
  }
  if (requisition !== null) return { requisition, temporaryNumber: null };
  return {
    requisition: null,
    temporaryNumber: await nextTemporaryNumber(transaction),
  };
}

const unfilled = (hire: Recorded) => typeof hire.filledBy !== "string";

// Whether a hire not yet filled, as a change leaves it, names a manager it did not name before: a
// new hire's manager, or a changed one.
const newlyManaged = (before: Recorded | undefined, after: Recorded) =>
  typeof after.managerId === "string" &&
  unfilled(after) &&
  before?.managerId !== after.managerId;

// Refuses a manager who is not marked as a manager for a hire not yet filled, as people's managers
// are.
async function refuseUnmarked(
  reader: Reader,
  managerId: string,
  refused: (message: string) => Error,
): Promise<void> {
  const [manager] = await reader
    .select({
      preferredName: people.preferredName,
      isManager: people.isManager,
    })
    .from(people)
    .where(eq(people.id, managerId));
  if (manager !== undefined && !manager.isManager) {
    throw refused(notMarked(manager));
  }
}

export async function createHire(
  database: Database,
  actor: Actor,
  request: HireRequest,
): Promise<{ id: string; changeSetId: string | null }> {
  requireHiringEdit(actor);
  return database.transaction(async (transaction) => {
    await lockDrafts(transaction);
    await checkManager(transaction, request.managerId);
    await checkBuiltInChoice(transaction, "positions", request.positionId);
    const stateId =
      request.stateId ??
      (await firstChoiceMeaning(transaction, "hiring-states", "proposed"));
    await checkBuiltInChoice(transaction, "hiring-states", stateId);
    const id = randomUUID();
    await checkRequisition(transaction, request.requisition, id);
    const after: Recorded = {
      requisition: request.requisition,
      temporaryNumber:
        request.requisition === null
          ? await nextTemporaryNumber(transaction)
          : null,
      positionId: request.positionId,
      targetDate: request.targetDate,
      stateId,
      managerId: request.managerId,
      filledBy: null,
    };
    if (newlyManaged(undefined, after)) {
      await refuseUnmarked(
        transaction,
        String(after.managerId),
        (message) => new BadRequestError(message),
      );
    }
    await addDrafts(transaction, actor.user.id, recordType, [
      { id, fields: after },
    ]);
    const made = asDraft(hireChanges(id, "created", undefined, after));
    await recordHiringChanges(transaction, actor.user.id, made);
    return {
      id,
      changeSetId: await recordChanges(transaction, actor.user.id, made),
    };
  });
}

// A hire as it is and as the actor's draft makes it, locked for a change, refusing one that is
// neither live nor in a draft the actor sees, or that someone else is changing.
async function lockDraftedHire(
  transaction: Transaction,
  actor: Actor,
  id: string,
): Promise<{
  before: Recorded | undefined;
  draft: Draft | undefined;
  hire: Recorded | undefined;
}> {
  const before = (await readLiveHires(transaction, [id], true)).get(id);
  const draft = (await readHireDrafts(transaction, [id], actor.user.id)).get(
    id,
  );
  if (before === undefined && draft === undefined) {
    throw new NotFoundError(noHire);
  }
  await refuseHeld(transaction, actor.user.id, recordType, [id]);
  return { before, draft, hire: drafted(before, draft) };
}

// Drafts a change to some of a hire's details, or a move to another state, in any order.
export async function updateHire(
  database: Database,
  actor: Actor,
  id: string,
  change: HireChange,
): Promise<string | null> {
  requireHiringEdit(actor);
  return database.transaction(async (transaction) => {
    await lockDrafts(transaction);
    const { before, draft, hire } = await lockDraftedHire(
      transaction,
      actor,
      id,
    );
    if (hire === undefined) throw new ConflictError(toBeRemoved);
    if (change.managerId !== undefined) {
      await checkManager(transaction, change.managerId);
    }
    if (change.positionId !== undefined) {
      await checkBuiltInChoice(
        transaction,
        "positions",
        change.positionId,
        hire.positionId,
      );
    }
    if (change.stateId !== undefined) {
      await checkBuiltInChoice(
        transaction,
        "hiring-states",
        change.stateId,
        hire.stateId,
      );
    }
    if (typeof change.requisition === "string") {
      await checkRequisition(transaction, change.requisition, id);
    }
    const after: Recorded = {
      ...hire,
      ...(await idAsChanged(transaction, hire, change.requisition)),
      ...(change.positionId === undefined
        ? {}
        : { positionId: change.positionId }),
      ...(change.targetDate === undefined
        ? {}
        : { targetDate: change.targetDate }),
      ...(change.stateId === undefined ? {} : { stateId: change.stateId }),
      ...(change.managerId === undefined
        ? {}
        : { managerId: change.managerId }),
    };
    if (newlyManaged(hire, after)) {
      await refuseUnmarked(
        transaction,
        String(after.managerId),
        (message) => new BadRequestError(message),
      );
    }
    const made = hireChanges(id, "changed", hire, after);
    if (made.length === 0) return null;
    const all = [
      ...asDraft(made),
      ...clearedRejection(id, hireTier, before, draft, recordType),
    ];
    await writeDraft(transaction, actor.user.id, recordType, id, before, after);
    await recordHiringChanges(transaction, actor.user.id, all);
    return recordChanges(transaction, actor.user.id, all);
  });
}

// Drafts removing a hire, which is how a hire is cancelled; removing one only drafted to be added
// discards that draft. Filled hires are refused, since the person who filled one is kept with it.
export async function deleteHire(
  database: Database,
  actor: Actor,
  id: string,
): Promise<string | null> {
  requireHiringEdit(actor);
  return database.transaction(async (transaction) => {
    await lockDrafts(transaction);
    const { before, draft, hire } = await lockDraftedHire(
      transaction,
      actor,
      id,
    );
    if (hire === undefined) return null;
    if (typeof hire.filledBy === "string") {
      throw new ConflictError(
        "A filled hire is kept; give its person an end date instead",
      );
    }
    const made = [
      ...asDraft(hireChanges(id, "deleted", hire, undefined)),
      ...clearedRejection(id, hireTier, before, draft, recordType),
    ];
    await writeDraft(
      transaction,
      actor.user.id,
      recordType,
      id,
      before,
      undefined,
    );
    await recordHiringChanges(transaction, actor.user.id, made);
    return recordChanges(
      transaction,
      actor.user.id,
      made,
      before === undefined ? "discard" : "edit",
    );
  });
}

// Sends a rejected draft for approval again, unchanged, clearing its reason.
export async function resubmitHireDraft(
  database: Database,
  actor: Actor,
  id: string,
): Promise<string | null> {
  requireHiringEdit(actor);
  return database.transaction(async (transaction) => {
    await lockDrafts(transaction);
    const { before, draft } = await lockDraftedHire(transaction, actor, id);
    if (draft?.state !== "rejected") {
      throw new ConflictError("Only a rejected draft can be resubmitted");
    }
    const made = clearedRejection(id, hireTier, before, draft, recordType);
    await transaction
      .update(drafts)
      .set({ state: "waiting", reason: null })
      .where(and(eq(drafts.recordType, recordType), eq(drafts.recordId, id)));
    await recordHiringChanges(transaction, actor.user.id, made);
    return recordChanges(transaction, actor.user.id, made, "resubmission");
  });
}

// Discards a hire's draft, so it is as it is live, or, for one only drafted to be added, gone.
export async function discardHireDraft(
  database: Database,
  actor: Actor,
  id: string,
): Promise<string | null> {
  requireHiringEdit(actor);
  return database.transaction(async (transaction) => {
    await lockDrafts(transaction);
    const { before, draft, hire } = await lockDraftedHire(
      transaction,
      actor,
      id,
    );
    if (draft === undefined) {
      throw new NotFoundError("This planned hire has no draft");
    }
    let action: Change["action"] = "changed";
    if (hire === undefined) action = "created";
    else if (before === undefined) action = "deleted";
    const made = [
      ...asDraft(hireChanges(id, action, hire, before)),
      ...clearedRejection(id, hireTier, before, draft, recordType),
    ];
    await writeDraft(
      transaction,
      actor.user.id,
      recordType,
      id,
      before,
      before,
    );
    await recordHiringChanges(transaction, actor.user.id, made);
    return recordChanges(transaction, actor.user.id, made, "discard");
  });
}

// Refuses removing people whom any hire, live or in a draft, published or not, names as its manager
// or as the person who filled it.
export async function refuseRemovingHiresPeople(
  reader: Reader,
  ids: readonly string[],
): Promise<void> {
  for (const chunk of inChunks([...ids])) {
    const names = (fields: SQL) =>
      or(
        inArray(sql`${fields}->>'managerId'`, chunk),
        inArray(sql`${fields}->>'filledBy'`, chunk),
      );
    const [live] = await reader
      .select({ id: plannedHires.id })
      .from(plannedHires)
      .where(
        or(
          inArray(plannedHires.managerId, chunk),
          inArray(plannedHires.filledBy, chunk),
        ),
      )
      .limit(1);
    const [drafted] = await reader
      .select({ id: drafts.recordId })
      .from(drafts)
      .where(
        and(eq(drafts.recordType, recordType), names(sql`${drafts.fields}`)),
      )
      .limit(1);
    const [unpublished] = await reader
      .select({ id: unpublishedDrafts.recordId })
      .from(unpublishedDrafts)
      .where(
        and(
          eq(unpublishedDrafts.recordType, recordType),
          names(sql`${unpublishedDrafts.fields}`),
        ),
      )
      .limit(1);
    if (live ?? drafted ?? unpublished) {
      throw new ConflictError(
        "A planned hire names this person; change the hire first",
      );
    }
  }
}

// Refuses clearing the Manager? mark of people a hire not yet filled names as its manager, live or,
// when drafting, in a hire's draft, published or not.
export async function refuseUnmarkingHireManagers(
  reader: Reader,
  ids: readonly string[],
  { drafted }: { drafted: boolean },
): Promise<void> {
  for (const chunk of inChunks([...ids])) {
    const [live] = await reader
      .select({ id: plannedHires.id })
      .from(plannedHires)
      .where(
        and(
          inArray(plannedHires.managerId, chunk),
          isNull(plannedHires.filledBy),
        ),
      )
      .limit(1);
    let named = live !== undefined;
    for (const table of drafted && !named ? [drafts, unpublishedDrafts] : []) {
      const [found] = await reader
        .select({ id: table.recordId })
        .from(table)
        .where(
          and(
            eq(table.recordType, recordType),
            inArray(sql`${table.fields}->>'managerId'`, chunk),
          ),
        )
        .limit(1);
      named ||= found !== undefined;
    }
    if (named) {
      throw new ConflictError(
        "Manager? stays checked while a planned hire not yet filled names this person as its manager",
      );
    }
  }
}

// Checks the actor may approve or reject the drafts of the hires asked for, and reads them with the
// hires as they are live. Only those who see Confidential data see hires' drafts, so for anyone
// else they are answered as drafts that do not exist.
async function seenHires(
  transaction: Transaction,
  actor: Actor,
  ids: readonly string[],
) {
  if (!seesTier(actor, "confidential")) throw new NotFoundError(noDraft);
  const found = await readHireDrafts(transaction, ids);
  if (found.size !== ids.length) throw new NotFoundError(noDraft);
  const live = await readLiveHires(transaction, ids, true);
  await refuseHeldDecision(transaction, recordType, ids);
  return { found, live };
}

// Checked before any drafts are approved or rejected, so a draft the actor may not decide is refused
// before anything changes.
export async function checkHiresAsked(
  transaction: Transaction,
  actor: Actor,
  ids: readonly string[],
): Promise<void> {
  if (ids.length > 0) await seenHires(transaction, actor, ids);
}

// Makes the live hires as their drafts make them, and returns the changes recorded.
export async function approveHiresIn(
  transaction: Transaction,
  actor: Actor,
  ids: readonly string[],
): Promise<Change[]> {
  if (ids.length === 0) return [];
  const { found, live } = await seenHires(transaction, actor, ids);
  refuseRejected(found.values());
  const made: Change[] = [];
  for (const id of ids) {
    const draft = found.get(id) as Draft;
    const before = live.get(id);
    const hire = drafted(before, draft);
    made.push(...hireChanges(id, draft.action, before, hire));
    if (hire !== undefined && newlyManaged(before, hire)) {
      await refuseUnmarked(
        transaction,
        String(hire.managerId),
        (message) => new ConflictError(message),
      );
    }
    if (hire === undefined) {
      await transaction.delete(plannedHires).where(eq(plannedHires.id, id));
      continue;
    }
    const row = {
      requisition: textOrNull(hire.requisition),
      temporaryNumber:
        typeof hire.temporaryNumber === "number" ? hire.temporaryNumber : null,
      positionId: String(hire.positionId),
      targetDate: textOrNull(hire.targetDate),
      stateId: String(hire.stateId),
      managerId: textOrNull(hire.managerId),
      filledBy: textOrNull(hire.filledBy),
    };
    if (before === undefined) {
      await transaction.insert(plannedHires).values({ id, ...row });
    } else {
      await transaction
        .update(plannedHires)
        .set(row)
        .where(eq(plannedHires.id, id));
    }
  }
  for (const chunk of inChunks([...ids])) {
    await transaction
      .delete(drafts)
      .where(
        and(eq(drafts.recordType, recordType), inArray(drafts.recordId, chunk)),
      );
  }
  return made;
}

// Rejects the drafts of the hires asked for, with a reason, and returns the changes recorded.
export async function rejectHiresIn(
  transaction: Transaction,
  actor: Actor,
  ids: readonly string[],
  reason: string,
): Promise<Change[]> {
  if (ids.length === 0) return [];
  const { found } = await seenHires(transaction, actor, ids);
  const made: Change[] = [];
  for (const id of ids) {
    const draft = found.get(id) as Draft;
    if (draft.state === "rejected" && draft.reason === reason) continue;
    made.push({
      recordType,
      recordId: id,
      action: "changed",
      field: rejectedField,
      tier: hireTier(),
      oldValue: draft.state === "rejected" ? draft.reason : null,
      newValue: reason,
      draft: true,
    });
  }
  await setRejection(transaction, recordType, ids, {
    state: "rejected",
    reason,
  });
  return made;
}

// Puts back the drafts of the hires a change set changed in their drafts: the hire it drafted adding
// taken out, the one it drafted removing put back as it was, and the fields it changed put back. A
// hire must still be there to change, a requisition still be one no one else has, and a manager put
// back must still be a live person, checked as a manager while the hire is not yet filled.
export async function undoHireDrafts(
  transaction: Transaction,
  editor: string,
  records: readonly {
    id: string;
    action: Change["action"];
    old: ReadonlyMap<string, unknown>;
  }[],
  changedSince: string,
): Promise<void> {
  const ids = records.map(({ id }) => id);
  const live = await readLiveHires(transaction, ids, true);
  const draftsNow = await readHireDrafts(transaction, ids, editor);
  for (const record of records) {
    const old = new Map(record.old);
    old.delete(rejectedField);
    const now = drafted(live.get(record.id), draftsNow.get(record.id));
    let hire: Recorded | undefined;
    if (record.action === "deleted") {
      hire = {
        requisition: null,
        temporaryNumber: null,
        targetDate: null,
        managerId: null,
        filledBy: null,
        ...Object.fromEntries([...old].filter(([, value]) => value !== null)),
      };
      // A hire recorded before it had a position, a state, and an ID, all recorded together since,
      // cannot be put back.
      if (hire.positionId === undefined) {
        throw new ConflictError(changedSince);
      }
    } else if (record.action === "changed") {
      // A hire changed since is refused before this, so it is still there.
      hire = { ...(now as Recorded), ...Object.fromEntries(old) };
    }
    if (
      !(await managerAllowed(transaction, hire?.managerId)) ||
      (typeof hire?.requisition === "string" &&
        (await takenEmployeeIds(transaction, [hire.requisition], [record.id]))
          .length > 0)
    ) {
      throw new ConflictError(changedSince);
    }
    if (hire !== undefined && newlyManaged(now, hire)) {
      await refuseUnmarked(
        transaction,
        String(hire.managerId),
        (message) => new ConflictError(message),
      );
    }
    await writeDraft(
      transaction,
      editor,
      recordType,
      record.id,
      live.get(record.id),
      hire,
    );
  }
}
