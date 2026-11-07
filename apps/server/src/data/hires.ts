// SPDX-License-Identifier: Apache-2.0

// Planned hires, as part of the data access layer. The hiring plan is Confidential, so every change
// to a hire is recorded at that tier, and only those who see Confidential data see hires' drafts
// and their history. Everyone who sees people sees each placeholder: a hire not yet filled, or, for
// readers who do not see the person who filled it, one whose person has not started, with its ID,
// manager, expected month, its position and state to those who see their list's tier, and its
// values in the columns it shares with people, each to those who see its column's tier. Every
// change is a draft, as drafts.ts sets out, and changing the hiring plan is recorded in the access
// history, without naming the hire.

import {
  type Database,
  drafts,
  fieldValues,
  inChunks,
  listItems,
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
  type Person,
  temporaryId,
  type Tier,
} from "@fathom/shared";
import { and, eq, inArray, isNull, or, type SQL, sql } from "drizzle-orm";
import { randomUUID } from "node:crypto";
import {
  type Actor,
  requirePermission,
  requireTierEdit,
  seesTier,
} from "../access.ts";
import {
  BadRequestError,
  ConflictError,
  ForbiddenError,
  NotFoundError,
} from "../errors.ts";
import { columnsWithAdded } from "./added-columns.ts";
import { peoplesMeaning } from "./lists.ts";
import { checkBuiltInChoice, firstChoiceMeaning } from "./built-in-lists.ts";
import { type LiveValues, typeOf } from "./column-types.ts";
import {
  builtInTier,
  type ColumnInfo,
  type FieldValue,
  fieldOfValue,
  inListOrder,
  readColumns,
  readValues,
  valueField,
  valueRows,
} from "./values.ts";
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
  fitsColumns,
  lockDrafts,
  otherApprover,
  readDrafts,
  readHeld,
  type Recorded,
  refuseHeld,
  refuseHeldDecision,
  refuseRejected,
  rejectedField,
  setRejection,
  takenEmployeeIds,
  tidy,
  type Viewer,
  writeDraft,
} from "./drafts.ts";
import { recordEvent } from "./history.ts";
import {
  checkedLinks,
  checkedNotes,
  checkedValues,
  choicesAskedFor,
  notStarted,
  linksOf,
  notesOf,
  recordedValues,
  valuesOf,
} from "./people.ts";
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
  "name",
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

export type HireTier = (field: string) => Tier;

// The tier of each field of a hire: its name is General, as a person's is; its position and state
// are as sensitive as their lists, and its values in a column as the column's, as a person's are;
// and the rest of the hiring plan is Confidential, as are values in a column not among those given,
// the live columns unless others are.
export async function readHireTier(
  reader: Reader,
  columns?: readonly ColumnInfo[],
): Promise<HireTier> {
  const positions = await builtInTier(reader, "positions");
  const states = await builtInTier(reader, "hiring-states");
  const valueTiers = new Map(
    (columns ?? (await readColumns(reader))).map((column) => [
      valueField(column.id),
      column.tier,
    ]),
  );
  return (field) => {
    if (field === "name") return "general";
    if (field === "positionId") return positions;
    if (field === "stateId") return states;
    return valueTiers.get(field) ?? "confidential";
  };
}

// The columns a hire may have values in: People's columns offered on planned hires.
const offeredOn = (columns: readonly ColumnInfo[]) =>
  columns.filter((column) => column.onPlannedHires);

// Whether hires' values fit the columns offered on planned hires, where none is required: each in
// such a column, and one its column's type holds.
async function fitOffered(
  reader: Reader,
  columns: readonly ColumnInfo[],
  hires: readonly Recorded[],
): Promise<boolean> {
  const chosen = hires.flatMap((hire) =>
    Object.entries(hire).flatMap(([field, value]) =>
      fieldOfValue(field) !== null && Array.isArray(value)
        ? value.map(String)
        : [],
    ),
  );
  const listOf = new Map(
    (await inListOrder(reader, chosen)).map(({ id, listId }) => [id, listId]),
  );
  const offered = offeredOn(columns).map((column) => ({
    ...column,
    required: false,
  }));
  return hires.every((hire) => fitsColumns(offered, listOf, hire));
}

// Refuses values asked for in a column not offered on planned hires; any other column unknown is
// refused as people's are.
function refuseNotOffered(
  columns: readonly ColumnInfo[],
  asked: {
    values?: Readonly<Record<string, unknown>> | undefined;
    links?: Readonly<Record<string, unknown>> | undefined;
    notes?: Readonly<Record<string, unknown>> | undefined;
  },
): void {
  for (const fieldId of [
    ...Object.keys(asked.values ?? {}),
    ...Object.keys(asked.links ?? {}),
    ...Object.keys(asked.notes ?? {}),
  ]) {
    const column = columns.find(({ id }) => id === fieldId);
    if (column !== undefined && !column.onPlannedHires) {
      throw new BadRequestError(
        `${column.name} is switched off for planned hires`,
      );
    }
  }
}

// Refuses changes to fields of a tier the actor may not change.
function requireHireEdits(actor: Actor, made: readonly Change[]): void {
  for (const tier of new Set(made.map((change) => change.tier))) {
    requireTierEdit(actor, tier);
  }
}

export function recordedHire(
  row: HireRow,
  values: ReadonlyMap<string, FieldValue> = new Map(),
): Recorded {
  return {
    name: row.name,
    requisition: row.requisition,
    temporaryNumber: row.temporaryNumber,
    positionId: row.positionId,
    targetDate: row.targetDate,
    stateId: row.stateId,
    managerId: row.managerId,
    filledBy: row.filledBy,
    ...recordedValues(values),
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
  tierOf: HireTier,
): Change[] {
  const valueFields = new Set(
    [...Object.keys(before ?? {}), ...Object.keys(after ?? {})].filter(
      (field) => fieldOfValue(field) !== null,
    ),
  );
  return changesBetween(
    recordType,
    id,
    action,
    before,
    after,
    [...hireFields, ...valueFields],
    tierOf,
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

// The live hires given, or every hire, as recorded, with their values in People's live columns, by
// hire, locked for a change when asked.
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
  const values = await readValues(
    reader,
    rows.map(({ id }) => id),
    (await readColumns(reader)).map(({ id }) => id),
    "planned-hire",
  );
  return new Map(
    rows.map((row) => [row.id, recordedHire(row, values.get(row.id))]),
  );
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
  started: boolean;
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
        started: !notStarted(dates, today),
      });
    }
  }
  return found;
}

// The hires the actor may see, by ID, for those who see people: the whole hiring plan, as drafts
// make it, for those who also see Confidential data, which does nothing without seeing people, and
// otherwise the placeholders as they are live, without their drafts. A filled hire is left out once
// its person is seen instead: by readers who see Restricted data, or by everyone once the person has
// started.
export async function readHires(
  database: Database,
  actor: Actor,
  asOf?: string,
): Promise<Hires & { includedRestricted: boolean }> {
  requirePermission(actor, "people:view");
  const today = asOf ?? (await readToday(database));
  return database.transaction(
    (transaction) => readHiresIn(transaction, actor, today),
    { isolationLevel: "repeatable read", accessMode: "read only" },
  );
}

// The hires the actor may see, as readHires sets out, read within a transaction of the caller's.
export async function readHiresIn(
  transaction: Reader,
  actor: Actor,
  today: string,
): Promise<Hires & { includedRestricted: boolean }> {
  const wholePlan = seesTier(actor, "confidential");
  const live = await readLiveHires(transaction);
  const draftsNow = wholePlan
    ? await readHireDrafts(transaction, undefined, actor.user.id)
    : new Map<string, Draft>();
  const held = await readHeld(transaction, recordType, actor.user.id);
  // Columns drafted to be added are seen only by those who see the whole plan's drafts.
  const columns = wholePlan
    ? await columnsWithAdded(transaction, actor.user.id)
    : await readColumns(transaction);
  const tierOf = await readHireTier(transaction, columns);
  const seesPositions = seesTier(actor, tierOf("positionId"));
  const seesStates = seesTier(actor, tierOf("stateId"));
  // The columns whose values the reader sees on hires.
  const shownColumns = offeredOn(columns).filter((column) =>
    seesTier(actor, column.tier),
  );
  const shownValue = new Set(shownColumns.map(({ id }) => id));
  const shownValues = <Value>(byColumn: Iterable<[string, Value]>) =>
    Object.fromEntries(
      [...byColumn].filter(([fieldId]) => shownValue.has(fieldId)),
    );
  // A draft's makers are named only for the changes the reader sees.
  const makers = await draftMakers(
    transaction,
    recordType,
    [...draftsNow.keys()],
    (field) => seesTier(actor, tierOf(field)),
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
  // Readers who cannot see Restricted data see only people who have started, so a hire names its
  // manager to them only once the manager has started, as People shows them.
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
      typeof hire.filledBy === "string" ? named.get(hire.filledBy) : undefined;
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
    const shown = manager !== undefined && (restricted || manager.started);
    const targetDate = textOrNull(hire.targetDate);
    const expectedOn = filler?.startDate ?? targetDate;
    return [
      {
        id,
        name: textOrNull(hire.name),
        ...hireIdOf(hire),
        ...(seesPositions ? { positionId: String(hire.positionId) } : {}),
        managerId: shown ? String(hire.managerId) : null,
        managerName: shown ? manager.name : null,
        expected: expectedOn === null ? thisMonth : expectedOn.slice(0, 7),
        ...(seesStates ? { stateId: String(hire.stateId) } : {}),
        values: shownValues(valuesOf(hire)),
        links: shownValues(Object.entries(linksOf(hire))),
        notes: shownValues(Object.entries(notesOf(hire))),
        ...(wholePlan
          ? {
              targetDate,
              ...shownDraft(id, before, draft),
              ...(held.has(id) ? { heldBy: held.get(id)?.holder } : {}),
            }
          : {}),
      },
    ];
  });

  // A hire's draft as the reader sees it, or none when it changes nothing they may see.
  function shownDraft(
    id: string,
    before: Recorded | undefined,
    draft: Draft | undefined,
  ): { draft?: HireDraft } {
    if (draft === undefined) return {};
    const drafted = draftFields(before, draft);
    const seen = (field: string) => {
      const fieldId = fieldOfValue(field);
      return fieldId === null
        ? seesTier(actor, tierOf(field))
        : shownValue.has(fieldId);
    };
    if (!drafted.some(seen)) return {};
    // A hire's ID is one field to the reader, whichever of the two a draft changes.
    const fields = [
      ...new Set(
        drafted
          .filter((field) => field !== "filledBy" && seen(field))
          .map((field) =>
            field === "temporaryNumber" ? "requisition" : field,
          ),
      ),
    ];
    const liveValues: HireDraft["live"] & LiveValues = {
      values: {},
      links: {},
      notes: {},
    };
    if (before !== undefined) {
      for (const field of fields) {
        const fieldId = fieldOfValue(field);
        if (fieldId !== null) {
          // Only the fields of the columns shown are kept above.
          const column = shownColumns.find(
            ({ id }) => id === fieldId,
          ) as ColumnInfo;
          // The field is the hire's own, named by its draft.
          // eslint-disable-next-line security/detect-object-injection
          typeOf(column).showLive(liveValues, fieldId, before[field]);
        }
        if (field === "name") liveValues.name = textOrNull(before.name);
        if (field === "requisition") {
          Object.assign(liveValues, hireIdOf(before));
        }
        if (field === "positionId") {
          liveValues.positionId = String(before.positionId);
        }
        if (field === "targetDate") {
          liveValues.targetDate = textOrNull(before.targetDate);
        }
        if (field === "stateId") liveValues.stateId = String(before.stateId);
        if (field === "managerId") {
          liveValues.managerId = textOrNull(before.managerId);
        }
      }
    }
    const maker = makers.get(id);
    const seenDraft: HireDraft = {
      action: draft.action,
      changed: fields.map((field) => fieldOfValue(field) ?? field),
      live: liveValues,
      state: draft.state,
      // The reason covers the whole draft, so it is shown only to those who see all of it.
      ...(draft.state === "rejected" &&
      draft.reason !== null &&
      drafted.every(seen)
        ? { reason: draft.reason }
        : {}),
      ...(draft.unpublished === true ? { unpublished: true } : {}),
      madeBy: maker?.madeBy ?? null,
      madeAt: maker?.madeAt.toISOString() ?? null,
      editors: maker?.editors ?? [],
      ...otherApprover(maker),
      changedBy: Object.fromEntries(
        fields.map((field) => [
          fieldOfValue(field) ?? field,
          maker?.fieldEditors.get(field) ?? null,
        ]),
      ),
    };
    return { draft: seenDraft };
  }

  // No two hires have the same ID, ignoring letter case, so the order is always the same.
  const shownId = (hire: Hire) => String(hire.requisition ?? hire.temporaryId);
  hires.sort((a, b) => byId.compare(shownId(a), shownId(b)));
  // Whether the placeholders shown hold a position, state, or column's values more sensitive than
  // General.
  const includedRestricted =
    hires.length > 0 &&
    ((seesPositions && tierOf("positionId") !== "general") ||
      (seesStates && tierOf("stateId") !== "general") ||
      shownColumns.some(({ tier }) => tier !== "general"));
  return { hires, wholePlan, includedRestricted };
}

// Until planned hires are a permission area of their own, changing them needs the rights to edit
// people and to change Confidential data, as the Decisions Log sets out.
function requireHiringEdit(actor: Actor): void {
  requirePermission(actor, "people:edit");
  requirePermission(actor, "confidential:edit");
}

// Hired and Left are people's states, and a hire is hired only by filling it.
const hiredState =
  "That state is for people. A planned hire is hired when someone fills it.";

function refuseHired(meaning: string | null): void {
  if (peoplesMeaning(meaning)) throw new BadRequestError(hiredState);
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

// Drafts adding the hires asked for, together in one change, so they are undone together, or none
// of them when any is refused.
export async function createHires(
  database: Database,
  actor: Actor,
  requests: readonly HireRequest[],
): Promise<{ ids: string[]; changeSetId: string | null }> {
  requireHiringEdit(actor);
  return database.transaction(async (transaction) => {
    // Every hire needs a position and a state, so one who cannot see either cannot add hires.
    const columns = await columnsWithAdded(transaction, actor.user.id, true);
    const tierOf = await readHireTier(transaction, columns);
    if (!seesTier(actor, tierOf("positionId"))) {
      throw new ForbiddenError(
        "Every planned hire needs a position, and your role doesn't let you see positions",
      );
    }
    if (!seesTier(actor, tierOf("stateId"))) {
      throw new ForbiddenError(
        "Every planned hire needs a state, and your role doesn't let you see hiring states",
      );
    }
    await lockDrafts(transaction);
    for (const request of requests) refuseNotOffered(columns, request);
    const offered = offeredOn(columns);
    const known = await choicesAskedFor(transaction, actor.user.id, requests);
    const ids: string[] = [];
    const made: Change[] = [];
    for (const request of requests) {
      await checkManager(transaction, request.managerId);
      await checkBuiltInChoice(transaction, "positions", request.positionId);
      const stateId =
        request.stateId ??
        (await firstChoiceMeaning(transaction, "hiring-states", "proposed"));
      refuseHired(
        await checkBuiltInChoice(transaction, "hiring-states", stateId),
      );
      const id = randomUUID();
      // Each hire is drafted before the next is checked, so two asked for cannot share an ID.
      await checkRequisition(transaction, request.requisition, id);
      // Notes left empty are left out.
      const after: Recorded = tidy({
        name: request.name,
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
        ...recordedValues(
          checkedValues(offered, known, request.values, undefined),
        ),
        ...checkedLinks(offered, request.links),
        ...checkedNotes(offered, request.notes ?? {}),
      });
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
      ids.push(id);
      made.push(
        ...asDraft(hireChanges(id, "created", undefined, after, tierOf)),
      );
    }
    requireHireEdits(actor, made);
    await recordHiringChanges(transaction, actor.user.id, made);
    return {
      ids,
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
    const columns = await columnsWithAdded(transaction, actor.user.id, true);
    refuseNotOffered(columns, change);
    const offered = offeredOn(columns);
    const changedValues = checkedValues(
      offered,
      await choicesAskedFor(transaction, actor.user.id, [change]),
      change.values ?? {},
      valuesOf(hire),
    );
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
      refuseHired(
        await checkBuiltInChoice(
          transaction,
          "hiring-states",
          change.stateId,
          hire.stateId,
        ),
      );
    }
    if (typeof change.requisition === "string") {
      await checkRequisition(transaction, change.requisition, id);
    }
    // Columns left with nothing chosen are left out.
    const after: Recorded = tidy({
      ...hire,
      ...(change.name === undefined ? {} : { name: change.name }),
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
      ...Object.fromEntries(
        [...changedValues].map(([fieldId, choiceIds]) => [
          valueField(fieldId),
          choiceIds,
        ]),
      ),
      ...checkedLinks(offered, change.links ?? {}),
      ...checkedNotes(offered, change.notes ?? {}),
    });
    if (newlyManaged(hire, after)) {
      await refuseUnmarked(
        transaction,
        String(after.managerId),
        (message) => new BadRequestError(message),
      );
    }
    const tierOf = await readHireTier(transaction, columns);
    const made = hireChanges(id, "changed", hire, after, tierOf);
    requireHireEdits(actor, made);
    if (made.length === 0) return null;
    const all = [
      ...asDraft(made),
      ...clearedRejection(id, tierOf, before, draft, recordType),
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
    const tierOf = await readHireTier(transaction);
    const made = [
      ...asDraft(hireChanges(id, "deleted", hire, undefined, tierOf)),
      ...clearedRejection(id, tierOf, before, draft, recordType),
    ];
    requireHireEdits(actor, made);
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
    const tierOf = await readHireTier(transaction);
    // Resubmitting sends every change the draft holds, so it needs the right to make each of them.
    for (const field of draftFields(before, draft)) {
      requireTierEdit(actor, tierOf(field));
    }
    const made = clearedRejection(id, tierOf, before, draft, recordType);
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
    const tierOf = await readHireTier(transaction);
    const made = [
      ...asDraft(hireChanges(id, action, hire, before, tierOf)),
      ...clearedRejection(id, tierOf, before, draft, recordType),
    ];
    requireHireEdits(actor, made);
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
  const tierOf = await readHireTier(transaction);
  for (const [id, draft] of found) {
    const fields = draftFields(live.get(id), draft);
    if (!fields.every((field) => seesTier(actor, tierOf(field)))) {
      throw new ForbiddenError(
        "One of these drafts holds details your role does not let you see, so an Approver who sees them must decide it",
      );
    }
  }
  await refuseHeldDecision(transaction, recordType, ids);
  return { found, live, tierOf };
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
  const { found, live, tierOf } = await seenHires(transaction, actor, ids);
  refuseRejected(found.values());
  const wanted = ids.map((id) => {
    const before = live.get(id);
    const draft = found.get(id) as Draft;
    return { id, before, draft, hire: drafted(before, draft) };
  });
  // Columns approved with the hires are live by now.
  if (
    !(await fitOffered(
      transaction,
      await readColumns(transaction, true),
      wanted.flatMap(({ hire }) => (hire === undefined ? [] : [hire])),
    ))
  ) {
    throw new ConflictError(
      "A planned hire's draft no longer fits the columns; change it, then approve it",
    );
  }
  const made: Change[] = [];
  const heldValues: (typeof fieldValues.$inferInsert)[] = [];
  for (const { id, before, draft, hire } of wanted) {
    made.push(...hireChanges(id, draft.action, before, hire, tierOf));
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
    // The state may have come to mean Hired or Left since the draft was made.
    if (unfilled(hire)) {
      const [state] = await transaction
        .select({ meaning: listItems.meaning })
        .from(listItems)
        .where(eq(listItems.id, String(hire.stateId)));
      if (peoplesMeaning(state?.meaning)) throw new ConflictError(hiredState);
    }
    const row = {
      name: textOrNull(hire.name),
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
    for (const [field, value] of Object.entries(hire)) {
      const fieldId = fieldOfValue(field);
      if (fieldId !== null) {
        heldValues.push(...valueRows(id, fieldId, value, "planned-hire"));
      }
    }
  }
  // Each hire approved holds the values its draft makes, replacing those it had.
  for (const chunk of inChunks([...ids])) {
    await transaction
      .delete(fieldValues)
      .where(inArray(fieldValues.plannedHireId, chunk));
  }
  for (const chunk of inChunks(heldValues)) {
    await transaction.insert(fieldValues).values(chunk);
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
  const columns = await columnsWithAdded(transaction, editor);
  for (const record of records) {
    const old = new Map(record.old);
    old.delete(rejectedField);
    const now = drafted(live.get(record.id), draftsNow.get(record.id));
    let hire: Recorded | undefined;
    if (record.action === "deleted") {
      hire = {
        name: null,
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
      (hire !== undefined &&
        !(await fitOffered(transaction, columns, [hire]))) ||
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

// A hire as a row of the People table: its name, if any, as its preferred name, its requisition or
// temporary ID as its ID, and its target date, for those who see it, as its start date. Its team is
// its manager's, named as the people given name it.
export function hireRow(
  hire: Hire,
  teamOf: ReadonlyMap<string, string | null>,
): Person {
  // A hire has a requisition, or else a temporary ID.
  const id = String(hire.requisition ?? hire.temporaryId);
  const asPersonField = (field: string) => {
    if (field === "name") return "preferredName";
    if (field === "requisition") return "employeeId";
    if (field === "targetDate") return "startDate";
    return field;
  };
  const draft = hire.draft;
  const live = draft?.live;
  return {
    id: hire.id,
    kind: "planned-hire",
    preferredName: hire.name ?? "",
    employeeId: id,
    ...(hire.positionId === undefined ? {} : { positionId: hire.positionId }),
    ...(hire.stateId === undefined ? {} : { stateId: hire.stateId }),
    expected: hire.expected,
    ...(hire.targetDate === undefined ? {} : { startDate: hire.targetDate }),
    manager:
      hire.managerId === null
        ? null
        : { id: hire.managerId, preferredName: String(hire.managerName) },
    ...(hire.managerId === null
      ? {}
      : { team: teamOf.get(hire.managerId) ?? null }),
    values: hire.values,
    links: hire.links,
    notes: hire.notes,
    ...(draft === undefined || live === undefined
      ? {}
      : {
          draft: {
            ...draft,
            changed: draft.changed.map(asPersonField),
            live: {
              ...(live.name === undefined
                ? {}
                : { preferredName: live.name ?? "" }),
              ...(live.requisition === undefined
                ? {}
                : { employeeId: live.requisition ?? String(live.temporaryId) }),
              ...(live.positionId === undefined
                ? {}
                : { positionId: live.positionId }),
              ...(live.targetDate === undefined
                ? {}
                : { startDate: live.targetDate }),
              ...(live.stateId === undefined ? {} : { stateId: live.stateId }),
              ...(live.managerId === undefined
                ? {}
                : { managerId: live.managerId }),
              values: live.values,
              links: live.links,
              notes: live.notes,
            },
          },
        }),
    ...(hire.heldBy === undefined ? {} : { heldBy: hire.heldBy }),
  };
}
