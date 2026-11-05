// SPDX-License-Identifier: Apache-2.0

// Planned hires, as part of the data access layer. The hiring plan is Confidential, so every change
// to a hire is recorded at that tier, and only those who see Confidential data see hires' drafts,
// their history, and the hires that are not open. Everyone who sees people sees each open hire's
// placeholder: its title, manager, and first month. Every change is a draft, as drafts.ts sets out,
// and changing the hiring plan is recorded in the access history, without naming the hire.

import {
  type Database,
  drafts,
  inChunks,
  people,
  plannedHires,
  unpublishedDrafts,
} from "@fathom/db";
import {
  type Hire,
  type HireChange,
  type HireDraft,
  type HireRequest,
  type Hires,
  type HiringState,
  hiringStateSchema,
  nextHiringStates,
  openHiringStates,
} from "@fathom/shared";
import { and, eq, inArray, or, type SQL, sql } from "drizzle-orm";
import { randomUUID } from "node:crypto";
import {
  type Actor,
  requireAnyPermission,
  requirePermission,
  seesTier,
} from "../access.ts";
import { BadRequestError, ConflictError, NotFoundError } from "../errors.ts";
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
  type Viewer,
  writeDraft,
} from "./drafts.ts";
import { recordEvent } from "./history.ts";
import { currentOn } from "./people.ts";

type Reader = Pick<Database, "select">;
type HireRow = typeof plannedHires.$inferSelect;

const recordType = "planned-hire";
const noHire = "There is no such planned hire";
const toBeRemoved =
  "This planned hire's draft removes it; discard the draft to change it";
const noDraft =
  "One of these planned hires has no draft; refresh to see the latest";

export const hireFields = [
  "title",
  "targetDate",
  "state",
  "cancelledFrom",
  "managerId",
  "filledBy",
] as const;

// Every detail of a hire is part of the hiring plan, so Confidential, even those a placeholder
// shows, since a hire stops being a placeholder once cancelled.
export const hireTier = () => "confidential" as const;

export function recordedHire(row: HireRow): Recorded {
  return {
    title: row.title,
    targetDate: row.targetDate,
    state: row.state,
    cancelledFrom: row.cancelledFrom,
    managerId: row.managerId,
    filledBy: row.filledBy,
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

// A state Fathom does not know reads as Cancelled, so a hire in it is never shown as a placeholder.
const stateOf = (hire: Recorded): HiringState =>
  hiringStateSchema.catch("cancelled").parse(hire.state);

const cancelledFromOf = (hire: Recorded): HiringState | null =>
  hire.cancelledFrom === null || hire.cancelledFrom === undefined
    ? null
    : hiringStateSchema.catch("cancelled").parse(hire.cancelledFrom);

const isOpen = (hire: Recorded) => openHiringStates.includes(stateOf(hire));

const byTitle = new Intl.Collator("en", { sensitivity: "base" });

async function managersOf(
  reader: Reader,
  ids: readonly string[],
  today: string,
): Promise<Map<string, { name: string; current: boolean }>> {
  const managers = new Map<string, { name: string; current: boolean }>();
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
      managers.set(id, { name, current: currentOn(dates, today) });
    }
  }
  return managers;
}

// The hires the actor may see, by title: the whole hiring plan, as drafts make it, for those who see
// Confidential data, and otherwise the placeholders of the open hires as they are live, without
// their drafts.
export async function readHires(
  database: Database,
  actor: Actor,
  today: string = new Date().toISOString().slice(0, 10),
): Promise<Hires> {
  requireAnyPermission(actor, ["confidential:view", "people:view"]);
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
      const versions = ids.flatMap((id) => {
        const before = live.get(id);
        const draft = draftsNow.get(id);
        const hire = drafted(before, draft) ?? before;
        if (hire === undefined || (!wholePlan && !isOpen(hire))) return [];
        return [{ id, before, draft, hire }];
      });
      // Readers who cannot see Restricted data see only current staff, so a hire names its manager
      // to them only while the manager is current, as People shows them.
      const restricted = seesTier(actor, "restricted");
      const managers = await managersOf(
        transaction,
        versions.flatMap(({ hire, before }) =>
          [hire.managerId, before?.managerId].filter(
            (managerId): managerId is string => typeof managerId === "string",
          ),
        ),
        today,
      );
      const hires = versions.map(({ id, before, draft, hire }): Hire => {
        const manager =
          typeof hire.managerId === "string"
            ? managers.get(hire.managerId)
            : undefined;
        const shown = manager !== undefined && (restricted || manager.current);
        const managerId = shown ? String(hire.managerId) : null;
        const targetDate = String(hire.targetDate);
        return {
          id,
          title: String(hire.title),
          managerId,
          managerName: shown ? manager.name : null,
          firstMonth: targetDate.slice(0, 7),
          ...(wholePlan
            ? {
                targetDate,
                state: stateOf(hire),
                cancelledFrom: cancelledFromOf(hire),
                ...(draft === undefined
                  ? {}
                  : { draft: shownDraft(id, before, draft) }),
                ...(held.has(id) ? { heldBy: held.get(id)?.holder } : {}),
              }
            : {}),
        };
      });

      function shownDraft(
        id: string,
        before: Recorded | undefined,
        draft: Draft,
      ): HireDraft {
        const fields = draftFields(before, draft).filter(
          (field) => field !== "cancelledFrom" && field !== "filledBy",
        );
        const liveValues: HireDraft["live"] = {};
        if (before !== undefined) {
          for (const field of fields) {
            if (field === "title") liveValues.title = String(before.title);
            if (field === "targetDate") {
              liveValues.targetDate = String(before.targetDate);
            }
            if (field === "state") liveValues.state = stateOf(before);
            if (field === "managerId") {
              liveValues.managerId =
                typeof before.managerId === "string" ? before.managerId : null;
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

      hires.sort(
        (a, b) => byTitle.compare(a.title, b.title) || a.id.localeCompare(b.id),
      );
      return { hires, wholePlan };
    },
    { isolationLevel: "repeatable read", accessMode: "read only" },
  );
}

// Changes to the hiring plan need the Workforce Administrator's rights to change people and
// Confidential data.
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

export async function createHire(
  database: Database,
  actor: Actor,
  request: HireRequest,
): Promise<{ id: string; changeSetId: string | null }> {
  requireHiringEdit(actor);
  return database.transaction(async (transaction) => {
    await lockDrafts(transaction);
    await checkManager(transaction, request.managerId);
    const id = randomUUID();
    const after: Recorded = {
      title: request.title,
      targetDate: request.targetDate,
      state: request.state,
      cancelledFrom: null,
      managerId: request.managerId,
      filledBy: null,
    };
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

// The state a change moves a hire to, refusing a move the states do not allow, with the state a
// cancelled hire left.
function movedState(
  hire: Recorded,
  wanted: HiringState | undefined,
): Pick<Recorded, "state" | "cancelledFrom"> {
  const state = stateOf(hire);
  const cancelledFrom = cancelledFromOf(hire);
  if (wanted === undefined || wanted === state) {
    return { state, cancelledFrom };
  }
  if (!nextHiringStates(state, cancelledFrom).includes(wanted)) {
    throw new ConflictError(
      state === "filled"
        ? "A filled hire stays filled"
        : "A planned hire moves one state at a time, to Cancelled, or back to the state it was cancelled from",
    );
  }
  return {
    state: wanted,
    cancelledFrom: wanted === "cancelled" ? state : null,
  };
}

// Drafts a change to some of a hire's details, or a move to another state.
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
    const after: Recorded = {
      ...hire,
      ...(change.title === undefined ? {} : { title: change.title }),
      ...(change.targetDate === undefined
        ? {}
        : { targetDate: change.targetDate }),
      ...(change.managerId === undefined
        ? {}
        : { managerId: change.managerId }),
      ...movedState(hire, change.state),
    };
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

// Drafts removing a hire entered by mistake; removing one only drafted to be added discards that
// draft. Filled hires are refused until filling, which removes one together with its person, is
// built.
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
    if (stateOf(hire) === "filled") {
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
    if (hire === undefined) {
      await transaction.delete(plannedHires).where(eq(plannedHires.id, id));
      continue;
    }
    const row = {
      title: String(hire.title),
      targetDate: String(hire.targetDate),
      state: stateOf(hire),
      cancelledFrom: cancelledFromOf(hire),
      managerId: typeof hire.managerId === "string" ? hire.managerId : null,
      filledBy: typeof hire.filledBy === "string" ? hire.filledBy : null,
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
// manager put back must still be a live person, and a hire still be there to change.
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
    let hire: Recorded | undefined;
    if (record.action === "deleted") {
      hire = {
        cancelledFrom: null,
        managerId: null,
        filledBy: null,
        ...Object.fromEntries([...old].filter(([, value]) => value !== null)),
      };
    } else if (record.action === "changed") {
      // A hire changed since is refused before this, so it is still there.
      const now = drafted(
        live.get(record.id),
        draftsNow.get(record.id),
      ) as Recorded;
      hire = { ...now, ...Object.fromEntries(old) };
    }
    if (!(await managerAllowed(transaction, hire?.managerId))) {
      throw new ConflictError(changedSince);
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
