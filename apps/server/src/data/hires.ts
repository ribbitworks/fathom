// SPDX-License-Identifier: Apache-2.0

// Planned hires, as part of the data access layer. The hiring plan is Confidential, so changes to a
// hire's own details are recorded at that tier, but it is a permission area of its own: only those
// who see the hiring plan see hires' drafts and their history. Everyone who sees people sees each
// placeholder: a hire not yet filled, or, for readers who do not see the person who filled it, one
// whose person has not started, with its ID, manager, expected month, its position and state to
// those who see their list's tier, and its values in the columns it shares with people, each to
// those who see its column's tier. Every change is a draft, as drafts.ts sets out, and changing the
// hiring plan is recorded in the access history, without naming the hire.

import { refuseFillingAllocated, removeAllocationsOf } from "./allocations.ts";
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
  hireCalled,
  type HireChange,
  type HireDraft,
  type HireRequest,
  type Hires,
  monthOf,
  type Person,
  seesEmployment,
  temporaryId,
  type Tier,
} from "@fathom/shared";
import { and, eq, inArray, isNull, lt, notInArray, or, sql } from "drizzle-orm";
import { randomUUID } from "node:crypto";
import {
  type Actor,
  requirePermission,
  requireSensitivityEdit,
  seesSensitivity,
  type Sensitivity,
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
  choiceLabels,
  type ColumnInfo,
  type FieldValue,
  fieldOfValue,
  inListOrder,
  readColumns,
  readValues,
  valueField,
  valueRows,
  recordedValues,
  valueFieldsIn,
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
  draftTier,
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
  unseenDraft,
  type Viewer,
  writeDraft,
} from "./drafts.ts";
import { recordEvent } from "./history.ts";
import {
  checkedLinks,
  checkedNotes,
  checkedNumbers,
  checkedValues,
  choicesAskedFor,
  notStarted,
  linksOf,
  notesOf,
  numbersOf,
  valuesOf,
} from "./people.ts";
import { notMarked, readManagers, reassignReports, text } from "./reporting.ts";
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

// The month a planned hire is expected, from its person's start date once filled, or its target
// date, or, with neither, the current month, so it is counted from now.
export const expectedMonth = (
  {
    fillerStart,
    targetDate,
  }: { fillerStart: string | null; targetDate: string | null },
  today: string,
): string => monthOf(fillerStart ?? targetDate ?? today);

export const hireFields = [
  "name",
  "requisition",
  "temporaryNumber",
  "positionId",
  "targetDate",
  "stateId",
  "managerId",
  "isManager",
  "filledBy",
] as const;

// A hire's own details, the hiring plan itself, even those a placeholder shows, since the change
// history shows changes to them beside the rest. They are Confidential, but seen and changed with
// the hiring plan's permissions.
export const hiringPlanFields: readonly string[] = hireFields.filter(
  (field) => !["name", "positionId", "stateId"].includes(field),
);

export type HireTier = (field: string) => Tier;

// What lets a user see or change a field of a hire, given the tiers it has, as recorded, now, or
// both: the hiring plan for the hire's own details, and the tiers for the rest. A draft's rejection
// covers the whole draft, so it needs the hiring plan and the tiers of the fields it holds, which
// it is recorded at.
export function hireSensitivities(
  field: string,
  tiers: readonly Tier[],
): Sensitivity[] {
  if (hiringPlanFields.includes(field)) return ["hiring-plan"];
  return field === rejectedField ? ["hiring-plan", ...tiers] : [...tiers];
}

// Whether the actor sees a field of a hire, of the tiers given.
export const seesHireField =
  (actor: Actor, tierOf: HireTier) =>
  (field: string): boolean =>
    hireSensitivities(field, [tierOf(field)]).every((sensitivity) =>
      seesSensitivity(actor, sensitivity),
    );

// The tiers of a hire's fields that a rejection of its draft is recorded at: those of its fields
// other than the hire's own details, which the hiring plan's permissions cover.
const rejectionTier =
  (tierOf: HireTier): HireTier =>
  (field) =>
    hiringPlanFields.includes(field) ? "general" : tierOf(field);

// The tier of each field of a hire: its name is General, as a person's is; its position and state
// are as sensitive as their lists, and its values in a column as the column's, as a person's are;
// the rest of the hiring plan is Confidential, as are values in a column not among those given, the
// live columns unless others are; and a draft's rejection adds no tier to those it is recorded at.
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
    if (field === "name" || field === rejectedField) return "general";
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
    numbers?: Readonly<Record<string, unknown>> | undefined;
  },
): void {
  for (const fieldId of [
    ...Object.keys(asked.values ?? {}),
    ...Object.keys(asked.links ?? {}),
    ...Object.keys(asked.notes ?? {}),
    ...Object.keys(asked.numbers ?? {}),
  ]) {
    const column = columns.find(({ id }) => id === fieldId);
    if (column !== undefined && !column.onPlannedHires) {
      throw new BadRequestError(
        `${column.name} is switched off for planned hires`,
      );
    }
  }
}

// Refuses changes to fields the actor may not change.
function requireHireEdits(actor: Actor, made: readonly Change[]): void {
  const needed = made.flatMap((change) =>
    hireSensitivities(change.field, [change.tier]),
  );
  for (const sensitivity of new Set(needed)) {
    requireSensitivityEdit(actor, sensitivity);
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
    managerId: row.managerId ?? row.managerHireId,
    // Kept only when marked, so a hire never marked and one unmarked are the same.
    ...(row.isManager ? { isManager: true } : {}),
    filledBy: row.filledBy,
    ...recordedValues(values),
  };
}

// The hire's ID, as the ID column shows it: its requisition, or its temporary ID.
export function hireIdOf(hire: Recorded): {
  requisition: string | null;
  temporaryId: string | null;
} {
  const requisition = text(hire.requisition);
  return {
    requisition,
    temporaryId:
      requisition === null && typeof hire.temporaryNumber === "number"
        ? temporaryId(hire.temporaryNumber)
        : null,
  };
}

// What a hire is called in menus and notices, given its position's label for those who see it.
function nameOfHire(hire: Recorded, position: string | undefined): string {
  const { requisition, temporaryId: temporary } = hireIdOf(hire);
  return hireCalled(
    text(hire.name),
    String(requisition ?? temporary),
    position,
  );
}

export function hireChanges(
  id: string,
  action: Change["action"],
  before: Recorded | undefined,
  after: Recorded | undefined,
  tierOf: HireTier,
): Change[] {
  const valueFields = new Set(valueFieldsIn(before, after));
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
// make it, for those who also see the hiring plan, which does nothing without seeing people, and
// otherwise the placeholders as they are live, without their drafts. A filled hire is left out once
// its person is seen instead: by readers who see Personal data, or by everyone once the person has
// started.
export async function readHires(
  database: Database,
  actor: Actor,
  asOf?: string,
): Promise<Hires & { includedPersonal: boolean }> {
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
): Promise<Hires & { includedPersonal: boolean }> {
  const wholePlan = seesSensitivity(actor, "hiring-plan");
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
  const seesField = seesHireField(actor, tierOf);
  const seesPositions = seesSensitivity(actor, tierOf("positionId"));
  const seesStates = seesSensitivity(actor, tierOf("stateId"));
  // The columns whose values the reader sees on hires.
  const shownColumns = offeredOn(columns).filter((column) =>
    seesSensitivity(actor, column.tier),
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
    seesField,
    actor,
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
  // Readers who cannot see start and end dates see only people who have started, so a hire names its
  // manager to them only once the manager has started, as People shows them.
  const seesPersonal = seesEmployment(actor);
  const named = await peopleNamed(
    transaction,
    versions.flatMap(({ hire, before }) =>
      [hire.managerId, hire.filledBy, before?.managerId].filter(
        (personId): personId is string => typeof personId === "string",
      ),
    ),
    today,
  );
  // A planned manager is named as its row is, to everyone who sees its placeholder.
  const managingHires = [
    ...new Set(
      versions.flatMap(({ hire }) =>
        typeof hire.managerId === "string" && live.has(hire.managerId)
          ? [hire.managerId]
          : [],
      ),
    ),
  ];
  const managerPositions = seesPositions
    ? await choiceLabels(
        transaction,
        managingHires.map((managerId) =>
          String(live.get(managerId)?.positionId),
        ),
      )
    : new Map<string, string>();
  const hireManagers = new Map(
    managingHires.map((managerId) => {
      const manager = live.get(managerId) as Recorded;
      return [
        managerId,
        nameOfHire(manager, managerPositions.get(String(manager.positionId))),
      ];
    }),
  );
  const hires = versions.flatMap(({ id, before, draft, hire }): Hire[] => {
    const filledBy = text(before?.filledBy);
    const filler = filledBy === null ? undefined : named.get(filledBy);
    // A filled hire gives way to its person once they have started, or to readers who see them; one
    // only drafted as filled stays until the fill is approved.
    if (
      filledBy !== null &&
      (seesPersonal ||
        filler === undefined ||
        filler.startDate === null ||
        filler.startDate <= today)
    ) {
      return [];
    }
    const managerId = text(hire.managerId);
    const managingHire =
      managerId === null ? undefined : hireManagers.get(managerId);
    const manager = managerId === null ? undefined : named.get(managerId);
    const shownPerson =
      manager !== undefined && (seesPersonal || manager.started);
    const shown = managingHire !== undefined || shownPerson;
    const targetDate = text(hire.targetDate);
    return [
      {
        id,
        name: text(hire.name),
        ...hireIdOf(hire),
        ...(seesPositions ? { positionId: String(hire.positionId) } : {}),
        managerId: shown ? managerId : null,
        managerName: managingHire ?? (shownPerson ? manager.name : null),
        isManager: hire.isManager === true,
        expected: expectedMonth(
          { fillerStart: filler?.startDate ?? null, targetDate },
          today,
        ),
        ...(seesStates ? { stateId: String(hire.stateId) } : {}),
        values: shownValues(valuesOf(hire)),
        links: shownValues(Object.entries(linksOf(hire))),
        notes: shownValues(Object.entries(notesOf(hire))),
        numbers: shownValues(Object.entries(numbersOf(hire))),
        ...(wholePlan
          ? {
              targetDate,
              ...draftedFiller(hire, filledBy),
              ...shownDraft(id, before, draft),
              ...(held.has(id) ? { heldBy: held.get(id)?.holder } : {}),
            }
          : {}),
      },
    ];
  });

  // Who a hire's draft fills it with, given only to readers who see Personal data, who see the
  // person on People, since they may not have started.
  function draftedFiller(
    hire: Recorded,
    filledBy: string | null,
  ): Pick<Hire, "filler"> {
    const personId = text(hire.filledBy);
    if (personId === null || personId === filledBy) return {};
    return { filler: seesPersonal ? personId : null };
  }

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
      return fieldId === null ? seesField(field) : shownValue.has(fieldId);
    };
    if (!drafted.some(seen)) return {};
    // A hire's ID is one field to the reader, whichever of the two a draft changes.
    const fields = [
      ...new Set(
        drafted
          .filter(seen)
          .map((field) =>
            field === "temporaryNumber" ? "requisition" : field,
          ),
      ),
    ];
    const liveValues: HireDraft["live"] & LiveValues = {
      values: {},
      links: {},
      notes: {},
      numbers: {},
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
        if (field === "name") liveValues.name = text(before.name);
        if (field === "requisition") {
          Object.assign(liveValues, hireIdOf(before));
        }
        if (field === "positionId") {
          liveValues.positionId = String(before.positionId);
        }
        if (field === "targetDate") {
          liveValues.targetDate = text(before.targetDate);
        }
        if (field === "stateId") liveValues.stateId = String(before.stateId);
        if (field === "managerId") {
          liveValues.managerId = text(before.managerId);
        }
        if (field === "isManager") {
          liveValues.isManager = before.isManager === true;
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
      madeAs: maker?.madeAs ?? null,
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
  const includedPersonal =
    hires.length > 0 &&
    ((seesPositions && tierOf("positionId") !== "general") ||
      (seesStates && tierOf("stateId") !== "general") ||
      shownColumns.some(({ tier }) => tier !== "general"));
  return { hires, wholePlan, includedPersonal };
}

// Changing planned hires needs the rights to edit people and the hiring plan, as the Decisions Log
// sets out.
function requireHiringEdit(actor: Actor): void {
  requirePermission(actor, "people:edit");
  requirePermission(actor, "hiring-plan:edit");
}

// Hired and Left are people's states, and a hire is hired only by filling it.
const hiredState =
  "That state is for people. A planned hire is hired when someone fills it.";

function refuseHired(meaning: string | null): void {
  if (peoplesMeaning(meaning)) throw new BadRequestError(hiredState);
}

// Whether any draft, published or not, removes the record given.
async function draftedRemoval(
  transaction: Transaction,
  type: "person" | typeof recordType,
  id: string,
): Promise<boolean> {
  for (const table of [drafts, unpublishedDrafts]) {
    const [found] = await transaction
      .select({ recordId: table.recordId })
      .from(table)
      .where(
        and(
          eq(table.recordType, type),
          eq(table.recordId, id),
          eq(table.action, "deleted"),
        ),
      )
      .limit(1);
    if (found !== undefined) return true;
  }
  return false;
}

// Whether a hire may have the manager given: none, a live person, or a live planned hire not yet
// filled, whom no draft removes, published or not.
async function managerAllowed(
  transaction: Transaction,
  managerId: unknown,
  editor: string,
): Promise<boolean> {
  if (typeof managerId !== "string") return true;
  const [person] = await transaction
    .select({ id: people.id })
    .from(people)
    .where(eq(people.id, managerId))
    .for("share");
  if (person !== undefined) {
    return !(await draftedRemoval(transaction, "person", managerId));
  }
  const [hire] = await transaction
    .select({ filledBy: plannedHires.filledBy })
    .from(plannedHires)
    .where(eq(plannedHires.id, managerId))
    .for("share");
  return (
    hire !== undefined &&
    hire.filledBy === null &&
    !(await draftedRemoval(transaction, recordType, managerId)) &&
    !(await hireDraftsNaming(transaction, "filledBy", [managerId], editor, {
      byRecord: true,
    }))
  );
}

export const partOfFill =
  "This is part of filling a planned hire; discard the fill to change it";

// Whether a fill drafted moves the hire, as the actor's drafts make it, from the planned manager it
// reports to live to the person the planned manager's draft fills it with.
async function movedByFill(
  transaction: Transaction,
  actor: Actor,
  before: Recorded | undefined,
  hire: Recorded,
): Promise<boolean> {
  const liveManager = before?.managerId;
  if (typeof liveManager !== "string" || hire.managerId === liveManager) {
    return false;
  }
  const managing = drafted(
    (await readLiveHires(transaction, [liveManager])).get(liveManager),
    (await readHireDrafts(transaction, [liveManager], actor.user.id)).get(
      liveManager,
    ),
  );
  return managing?.filledBy === hire.managerId;
}

// Refuses a change to what a fill drafted sets: a hire's state, manager, and Manager? while its
// draft fills it, and the manager of a hire the fill moves to its person.
async function refuseChangingFill(
  transaction: Transaction,
  actor: Actor,
  before: Recorded | undefined,
  hire: Recorded,
  change: HireChange,
): Promise<void> {
  const filling = unfilled(before ?? {}) && !unfilled(hire);
  if (
    (filling &&
      (change.stateId !== undefined ||
        change.positionId !== undefined ||
        change.managerId !== undefined ||
        change.isManager !== undefined)) ||
    (change.managerId !== undefined &&
      (await movedByFill(transaction, actor, before, hire)))
  ) {
    throw new ConflictError(partOfFill);
  }
}

const hireLoop =
  "That manager reports to this planned hire, directly or through others";
const ownManager = "A planned hire can't report to itself";

// Each hire's manager as it is live: a person or a planned hire.
async function liveManagers(reader: Reader): Promise<Map<string, unknown>> {
  const rows = await reader
    .select({
      id: plannedHires.id,
      managerId: plannedHires.managerId,
      managerHireId: plannedHires.managerHireId,
    })
    .from(plannedHires);
  return new Map(
    rows.map(({ id, managerId, managerHireId }) => [
      id,
      managerId ?? managerHireId,
    ]),
  );
}

// Refuses a planned manager who is the hire itself, or reports to it, directly or through other
// planned hires, as every hire is live or as the editor's drafts make it, with the hire's wanted
// manager in place of its draft's.
async function refuseHireLoop(
  transaction: Transaction,
  editor: string,
  id: string,
  managerId: unknown,
): Promise<void> {
  if (typeof managerId !== "string") return;
  if (managerId === id) throw new BadRequestError(ownManager);
  const live = await liveManagers(transaction);
  const managerOf = new Map(live);
  for (const [hireId, draft] of await readHireDrafts(
    transaction,
    undefined,
    editor,
  )) {
    const before = live.has(hireId)
      ? { managerId: live.get(hireId) }
      : undefined;
    managerOf.set(hireId, drafted(before, draft)?.managerId);
  }
  managerOf.set(id, managerId);
  if (reachesItself(managerOf, id)) throw new BadRequestError(hireLoop);
}

// Whether following managers up from the hire comes back to it. A chain that loops elsewhere, which
// the rules never let in, ends where it first repeats.
function reachesItself(
  managerOf: ReadonlyMap<string, unknown>,
  id: string,
): boolean {
  const seen = new Set<string>();
  let next = managerOf.get(id);
  while (typeof next === "string" && !seen.has(next)) {
    if (next === id) return true;
    seen.add(next);
    next = managerOf.get(next);
  }
  return false;
}

// Refuses approving managers that, now applied, make a planned hire report to itself, naming it.
async function refuseHireLoopsLive(
  transaction: Transaction,
  ids: readonly string[],
  seesPositions: boolean,
): Promise<void> {
  const managerOf = await liveManagers(transaction);
  const looping = ids.find((id) => reachesItself(managerOf, id));
  if (looping === undefined) return;
  const [row] = await transaction
    .select()
    .from(plannedHires)
    .where(eq(plannedHires.id, looping));
  // The hire was just approved, so it is live.
  const hire = recordedHire(row as HireRow);
  throw new ConflictError(
    `${await nameWithPosition(transaction, hire, seesPositions)} would end up reporting to itself`,
  );
}

// A hire's name, with its position's label for those who see positions.
async function nameWithPosition(
  reader: Reader,
  hire: Recorded,
  seesPositions: boolean,
): Promise<string> {
  const positionId = String(hire.positionId);
  const position = seesPositions
    ? (await choiceLabels(reader, [positionId])).get(positionId)
    : undefined;
  return nameOfHire(hire, position);
}

// Which of the managers given are planned hires, so their hires keep them in that column.
async function hiresAmong(
  reader: Reader,
  ids: readonly string[],
): Promise<Set<string>> {
  const found = new Set<string>();
  for (const chunk of inChunks([...new Set(ids)])) {
    for (const { id } of await reader
      .select({ id: plannedHires.id })
      .from(plannedHires)
      .where(inArray(plannedHires.id, chunk))) {
      found.add(id);
    }
  }
  return found;
}

// Refuses naming as a manager a planned hire that a fill, in any draft, is filling.
async function refuseHireBeingFilled(
  transaction: Transaction,
  managerId: unknown,
  editor: string,
): Promise<void> {
  if (
    typeof managerId === "string" &&
    (await hireDraftsNaming(transaction, "filledBy", [managerId], editor, {
      byRecord: true,
    }))
  ) {
    throw new BadRequestError(
      "That planned hire is being filled, so it can't be a manager; once the fill is approved, choose the person who fills it",
    );
  }
}

async function checkManager(
  transaction: Transaction,
  managerId: unknown,
  editor: string,
): Promise<void> {
  await refuseHireBeingFilled(transaction, managerId, editor);
  if (!(await managerAllowed(transaction, managerId, editor))) {
    throw new BadRequestError(chooseManager);
  }
}

// Refuses a fill of a hire reporting to a planned manager when it gives its person no manager of
// their own, since people report only to people.
export async function requirePersonManager(
  transaction: Transaction,
  managerId: string,
): Promise<void> {
  const managers = await readManagers(transaction, [managerId]);
  if (!managers.has(managerId)) throw new ConflictError(chooseManager);
}

// Refuses a manager given for a fill's person who is not a live person, since people report only to
// people.
export async function checkFillManager(
  transaction: Transaction,
  managerId: string,
  editor: string,
): Promise<void> {
  await refuseHireBeingFilled(transaction, managerId, editor);
  const manager = (await readManagers(transaction, [managerId])).get(managerId);
  if (manager === undefined || manager.removing) {
    throw new BadRequestError(chooseManager);
  }
  if (!manager.isManager) throw new ConflictError(notMarked(manager));
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
  const current = text(hire.requisition);
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

// Refuses a manager, a person or a planned hire, who is not marked as a manager for a hire not yet
// filled, as people's managers are. A planned hire is named by its position only to those who see
// positions.
async function refuseUnmarked(
  reader: Reader,
  managerId: string,
  refused: (message: string) => Error,
  { seesPositions }: { seesPositions: boolean },
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
  const [row] = await reader
    .select()
    .from(plannedHires)
    .where(eq(plannedHires.id, managerId));
  if (row !== undefined && !row.isManager) {
    throw refused(
      notMarked({
        preferredName: await nameWithPosition(
          reader,
          recordedHire(row),
          seesPositions,
        ),
      }),
    );
  }
}

// Whether a hire not yet filled names any of the planned hires given as its manager, live, or, when
// asked, in a draft, published or not.
async function hiresReportTo(
  reader: Reader,
  ids: readonly string[],
  { drafted }: { drafted: boolean },
): Promise<boolean> {
  for (const chunk of inChunks([...ids])) {
    const [live] = await reader
      .select({ id: plannedHires.id })
      .from(plannedHires)
      .where(
        and(
          inArray(plannedHires.managerHireId, chunk),
          isNull(plannedHires.filledBy),
        ),
      )
      .limit(1);
    if (live !== undefined) return true;
    for (const table of drafted ? [drafts, unpublishedDrafts] : []) {
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
      if (found !== undefined) return true;
    }
  }
  return false;
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
    if (!seesSensitivity(actor, tierOf("positionId"))) {
      throw new ForbiddenError(
        "Every planned hire needs a position, and this role can't see positions",
      );
    }
    if (!seesSensitivity(actor, tierOf("stateId"))) {
      throw new ForbiddenError(
        "Every planned hire needs a state, and this role can't see hiring states",
      );
    }
    await lockDrafts(transaction);
    for (const request of requests) refuseNotOffered(columns, request);
    const offered = offeredOn(columns);
    const known = await choicesAskedFor(transaction, actor.user.id, requests);
    const ids: string[] = [];
    const made: Change[] = [];
    for (const request of requests) {
      await checkManager(transaction, request.managerId, actor.user.id);
      await checkBuiltInChoice(transaction, "positions", request.positionId);
      const seesPositions = seesSensitivity(actor, tierOf("positionId"));
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
        // Left out unless marked, as a new person's mark is.
        ...(request.isManager ? { isManager: true } : {}),
        filledBy: null,
        ...recordedValues(
          checkedValues(offered, known, request.values, undefined),
        ),
        ...checkedLinks(offered, request.links),
        ...checkedNotes(offered, request.notes ?? {}),
        ...checkedNumbers(offered, request.numbers ?? {}),
      });
      if (newlyManaged(undefined, after)) {
        await refuseUnmarked(
          transaction,
          String(after.managerId),
          (message) => new BadRequestError(message),
          { seesPositions },
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
      changeSetId: await recordChanges(transaction, actor, made),
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
    await refuseChangingFill(transaction, actor, before, hire, change);
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
      await checkManager(transaction, change.managerId, actor.user.id);
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
    const unmarked = Object.fromEntries(
      Object.entries(hire).filter(([field]) => field !== "isManager"),
    );
    const marked = change.isManager ?? hire.isManager === true;
    // Columns left with nothing chosen are left out.
    const after: Recorded = tidy({
      ...unmarked,
      ...(marked ? { isManager: true } : {}),
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
      ...checkedNumbers(offered, change.numbers ?? {}),
    });
    const tierOf = await readHireTier(transaction, columns);
    if (newlyManaged(hire, after)) {
      await refuseUnmarked(
        transaction,
        String(after.managerId),
        (message) => new BadRequestError(message),
        { seesPositions: seesSensitivity(actor, tierOf("positionId")) },
      );
    }
    if (change.managerId !== undefined) {
      await refuseHireLoop(transaction, actor.user.id, id, after.managerId);
    }
    if (
      hire.isManager === true &&
      after.isManager !== true &&
      (await hiresReportTo(transaction, [id], { drafted: true }))
    ) {
      throw new ConflictError(reassignReports);
    }
    const made = hireChanges(id, "changed", hire, after, tierOf);
    requireHireEdits(actor, made);
    if (made.length === 0) return null;
    const all = [
      ...asDraft(made),
      ...clearedRejection(id, rejectionTier(tierOf), before, draft, recordType),
    ];
    await writeDraft(transaction, actor.user.id, recordType, id, before, after);
    await recordHiringChanges(transaction, actor.user.id, all);
    return recordChanges(transaction, actor, all);
  });
}

const filledAlready = "This planned hire is already filled";
const notApproved =
  "This planned hire's headcount isn't approved yet; move it to an approved state before filling it";
const chooseManager = "Choose a manager from People";

// The hire asked to be filled, as the actor's draft makes it, with it as it is live: one not drafted
// to be removed or already filled, with no rejected draft, whose changes a fill would otherwise send
// for approval again, and in a state meaning Open.
export async function fillableHire(
  transaction: Transaction,
  actor: Actor,
  id: string,
): Promise<{ before: Recorded | undefined; hire: Recorded }> {
  requireHiringEdit(actor);
  const { before, draft, hire } = await lockDraftedHire(transaction, actor, id);
  if (hire === undefined) {
    throw new ConflictError(
      "This planned hire's draft removes it; discard the draft to fill it",
    );
  }
  if (before === undefined) {
    throw new ConflictError(
      "This planned hire is only drafted to be added; approve it before filling it",
    );
  }
  if (!unfilled(hire)) throw new ConflictError(filledAlready);
  if (draft?.state === "rejected") {
    throw new ConflictError(
      "This planned hire has a rejected draft; discard it or send it for approval again before filling it",
    );
  }
  if (hire.managerId !== before.managerId) {
    throw new ConflictError(
      "This planned hire's draft changes its manager; approve or discard that draft before filling it",
    );
  }
  const [state] = await transaction
    .select({ meaning: listItems.meaning })
    .from(listItems)
    .where(eq(listItems.id, String(hire.stateId)));
  if (state?.meaning !== "open") throw new ConflictError(notApproved);
  return { before, hire };
}

// Drafts the hire filled by the person given, keeping the rest of its draft, and returns the changes
// made, for the caller to record. A manager given for the person is drafted on the hire too, so the
// fill's draft of the person is known by matching the hire's manager.
export async function draftHireFilled(
  transaction: Transaction,
  actor: Actor,
  filled: {
    id: string;
    before: Recorded | undefined;
    hire: Recorded;
    managerId: string | null | undefined;
  },
  personId: string,
): Promise<Change[]> {
  const { id, before, hire, managerId } = filled;
  const after: Recorded = {
    ...hire,
    filledBy: personId,
    ...(managerId === undefined ? {} : { managerId }),
  };
  const tierOf = await readHireTier(transaction);
  const made = asDraft(hireChanges(id, "changed", hire, after, tierOf));
  requireHireEdits(actor, made);
  await writeDraft(transaction, actor.user.id, recordType, id, before, after);
  return made;
}

// Drafts the hires not yet filled that report to a planned manager moving to the person who fills
// it, and returns the changes made, for the caller to record. None of them may have a draft.
export async function draftReportsMoved(
  transaction: Transaction,
  actor: Actor,
  managerId: string,
  personId: string,
): Promise<Change[]> {
  const live = await readLiveHires(transaction);
  const draftsNow = await readHireDrafts(transaction, undefined, actor.user.id);
  const held = await readHeld(transaction, recordType, actor.user.id);
  // A hire reporting to the planned manager, live or in anyone's draft, that has a draft of its own
  // is refused, so every draft the fill writes holds only the fill.
  const drafting = [
    ...draftsNow,
    ...[...held].map(([id, { draft }]) => [id, draft] as const),
  ];
  if (
    drafting.some(
      ([id, draft]) =>
        live.get(id)?.managerId === managerId ||
        drafted(live.get(id), draft)?.managerId === managerId,
    )
  ) {
    throw new ConflictError(
      "A planned hire reporting to this one has a draft; approve or discard it before filling this one",
    );
  }
  const reports = [...live].flatMap(([id, hire]) =>
    hire.managerId === managerId && unfilled(hire) ? [{ id, hire }] : [],
  );
  const tierOf = await readHireTier(transaction);
  const made: Change[] = [];
  for (const { id, hire } of reports) {
    const after: Recorded = { ...hire, managerId: personId };
    made.push(...asDraft(hireChanges(id, "changed", hire, after, tierOf)));
    await writeDraft(transaction, actor.user.id, recordType, id, hire, after);
  }
  requireHireEdits(actor, made);
  return made;
}

// Puts the fields named of a hire's draft back as they are live, keeping the rest of the draft, as
// taking a fill back out of it does, and returns the changes made, for the caller to record.
export async function draftHireAsLive(
  transaction: Transaction,
  actor: Actor,
  id: string,
  fields: readonly string[],
): Promise<Change[]> {
  requireHiringEdit(actor);
  const { before, draft, hire } = await lockDraftedHire(transaction, actor, id);
  // A fill is taken out only of hires it changes, which it never removes.
  const now = hire as Recorded;
  const after = tidy({
    ...now,
    ...Object.fromEntries(
      // The fields are the hire's own, named by the caller.
      // eslint-disable-next-line security/detect-object-injection
      fields.map((field) => [field, before?.[field] ?? null]),
    ),
  });
  const tierOf = await readHireTier(transaction);
  const made = [
    ...asDraft(hireChanges(id, "changed", now, after, tierOf)),
    ...clearedRejection(id, rejectionTier(tierOf), before, draft, recordType),
  ];
  requireHireEdits(actor, made);
  await writeDraft(transaction, actor.user.id, recordType, id, before, after);
  return made;
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
    if (await movedByFill(transaction, actor, before, hire)) {
      throw new ConflictError(partOfFill);
    }
    if (await hiresReportTo(transaction, [id], { drafted: true })) {
      throw new ConflictError(reassignReports);
    }
    const tierOf = await readHireTier(transaction);
    const made = [
      ...asDraft(hireChanges(id, "deleted", hire, undefined, tierOf)),
      ...clearedRejection(id, rejectionTier(tierOf), before, draft, recordType),
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
      actor,
      made,
      before === undefined ? "discard" : "edit",
    );
  });
}

// Sends a rejected draft for approval again, within a change already under way with drafts locked,
// and returns the changes made, for the caller to record.
export async function resubmitHireDraftIn(
  transaction: Transaction,
  actor: Actor,
  id: string,
): Promise<Change[]> {
  requireHiringEdit(actor);
  const { before, draft } = await lockDraftedHire(transaction, actor, id);
  if (draft?.state !== "rejected") {
    throw new ConflictError("Only a rejected draft can be resubmitted");
  }
  const tierOf = await readHireTier(transaction);
  // Resubmitting sends every change the draft holds, so it needs the right to make each of them.
  for (const field of draftFields(before, draft)) {
    for (const sensitivity of hireSensitivities(field, [tierOf(field)])) {
      requireSensitivityEdit(actor, sensitivity);
    }
  }
  const made = clearedRejection(
    id,
    rejectionTier(tierOf),
    before,
    draft,
    recordType,
  );
  await transaction
    .update(drafts)
    .set({ state: "waiting", reason: null })
    .where(and(eq(drafts.recordType, recordType), eq(drafts.recordId, id)));
  return made;
}

// Discards a hire's draft, within a change already under way with drafts locked, and returns the
// changes made, for the caller to record.
export async function discardHireDraftIn(
  transaction: Transaction,
  actor: Actor,
  id: string,
): Promise<Change[]> {
  requireHiringEdit(actor);
  const { before, draft, hire } = await lockDraftedHire(transaction, actor, id);
  if (draft === undefined) {
    throw new NotFoundError("This planned hire has no draft");
  }
  let action: Change["action"] = "changed";
  if (hire === undefined) action = "created";
  else if (before === undefined) action = "deleted";
  const tierOf = await readHireTier(transaction);
  const made = [
    ...asDraft(hireChanges(id, action, hire, before, tierOf)),
    ...clearedRejection(id, rejectionTier(tierOf), before, draft, recordType),
  ];
  requireHireEdits(actor, made);
  await writeDraft(transaction, actor.user.id, recordType, id, before, before);
  return made;
}

// Refuses removing people whom any hire, live or in a draft, published or not, names as its manager
// or as the person who filled it.
export async function refuseRemovingHiresPeople(
  reader: Reader,
  ids: readonly string[],
): Promise<void> {
  for (const chunk of inChunks([...ids])) {
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
    if (
      live !== undefined ||
      (await hireDraftsNaming(reader, "managerId", chunk)) ||
      (await hireDraftsNaming(reader, "filledBy", chunk))
    ) {
      throw new ConflictError(
        "A planned hire names this person; change the hire first",
      );
    }
  }
}

// Refuses clearing the Manager? mark of people a hire not yet filled names as its manager, live or,
// when drafting, in a hire's draft, published or not, as the editor, when given, sees them.
export async function refuseUnmarkingHireManagers(
  reader: Reader,
  ids: readonly string[],
  { drafted, editor }: { drafted: boolean; editor?: string },
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
    if (
      live !== undefined ||
      (drafted && (await hireDraftsNaming(reader, "managerId", chunk, editor)))
    ) {
      throw new ConflictError(reassignReports);
    }
  }
}

// Whether any hire's draft, published or not, by anyone, names any of the people given in the field
// given, as its manager or as who fills it, or, asked by record, whether any of the hires given has a
// draft naming anyone in it. With an editor, their own unpublished changes stand in for the published
// drafts they replace.
export async function hireDraftsNaming(
  reader: Reader,
  field: "managerId" | "filledBy",
  ids: readonly string[],
  editor?: string,
  {
    byRecord = false,
    except = [],
  }: { byRecord?: boolean; except?: readonly string[] } = {},
): Promise<boolean> {
  for (const chunk of inChunks([...ids])) {
    for (const table of [drafts, unpublishedDrafts]) {
      const [found] = await reader
        .select({ id: table.recordId })
        .from(table)
        .where(
          and(
            eq(table.recordType, recordType),
            byRecord
              ? and(
                  inArray(table.recordId, chunk),
                  sql`${table.fields}->>${field} IS NOT NULL`,
                )
              : inArray(sql`${table.fields}->>${field}`, chunk),
            except.length === 0
              ? undefined
              : notInArray(table.recordId, [...except]),
            table === drafts && editor !== undefined
              ? sql`NOT EXISTS (SELECT 1 FROM ${unpublishedDrafts} WHERE ${unpublishedDrafts.userId} = ${editor} AND ${unpublishedDrafts.recordType} = ${recordType} AND ${unpublishedDrafts.recordId} = ${drafts.recordId})`
              : undefined,
          ),
        )
        .limit(1);
      if (found !== undefined) return true;
    }
  }
  return false;
}

// Checks the actor may approve or reject the drafts of the hires asked for, and reads them with the
// hires as they are live. Only those who see the hiring plan see hires' drafts, so for anyone else
// they are answered as drafts that do not exist.
async function seenHires(
  transaction: Transaction,
  actor: Actor,
  ids: readonly string[],
) {
  if (!seesSensitivity(actor, "hiring-plan")) throw new NotFoundError(noDraft);
  const found = await readHireDrafts(transaction, ids);
  if (found.size !== ids.length) throw new NotFoundError(noDraft);
  const live = await readLiveHires(transaction, ids, true);
  const tierOf = await readHireTier(transaction);
  for (const [id, draft] of found) {
    const fields = draftFields(live.get(id), draft);
    if (!fields.every(seesHireField(actor, tierOf))) {
      throw new ForbiddenError(unseenDraft);
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
  today: string,
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
  const removed: string[] = [];
  const seesPositions = seesSensitivity(actor, tierOf("positionId"));
  const managingHires = await hiresAmong(
    transaction,
    wanted.flatMap(({ hire }) =>
      typeof hire?.managerId === "string" ? [hire.managerId] : [],
    ),
  );
  // The columns that hold a hire's manager: a person's, or a planned hire's.
  const managerColumns = (managerId: string | null) =>
    managerId !== null && managingHires.has(managerId)
      ? { managerId: null, managerHireId: managerId }
      : { managerId, managerHireId: null };
  for (const { id, before, draft, hire } of wanted) {
    made.push(...hireChanges(id, draft.action, before, hire, tierOf));
    if (hire !== undefined && newlyManaged(before, hire)) {
      await refuseUnmarked(
        transaction,
        String(hire.managerId),
        (message) => new ConflictError(message),
        { seesPositions },
      );
    }
    if (hire === undefined) {
      removed.push(id);
      continue;
    }
    // Whoever fills it may have been given an end date that has passed since the fill was drafted,
    // and the hire allocations since, which filling can't move yet.
    if (unfilled(before ?? {}) && typeof hire.filledBy === "string") {
      await refuseFillingAllocated(transaction, id);
      const [left] = await transaction
        .select({ name: people.preferredName })
        .from(people)
        .where(and(eq(people.id, hire.filledBy), lt(people.endDate, today)));
      if (left !== undefined) {
        throw new ConflictError(
          `${left.name} has left, so can't fill a planned hire`,
        );
      }
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
      name: text(hire.name),
      requisition: text(hire.requisition),
      temporaryNumber:
        typeof hire.temporaryNumber === "number" ? hire.temporaryNumber : null,
      positionId: String(hire.positionId),
      targetDate: text(hire.targetDate),
      stateId: String(hire.stateId),
      ...managerColumns(text(hire.managerId)),
      isManager: hire.isManager === true,
      filledBy: text(hire.filledBy),
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
  // Hires approved together may move a planned manager's hires away and clear its mark, so marks
  // cleared are checked once every change is made. A removal needs no check: drafting it, and naming
  // a manager drafted to be removed, are both refused.
  const unmarked = wanted.flatMap(({ id, before, hire }) =>
    before?.isManager === true && hire !== undefined && hire.isManager !== true
      ? [id]
      : [],
  );
  if (await hiresReportTo(transaction, unmarked, { drafted: false })) {
    throw new ConflictError(reassignReports);
  }
  made.push(
    ...(await removeAllocationsOf(transaction, "plannedHireId", removed)),
  );
  for (const chunk of inChunks(removed)) {
    await transaction
      .delete(plannedHires)
      .where(inArray(plannedHires.id, chunk));
  }
  await refuseHireLoopsLive(transaction, ids, seesPositions);
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
  const { found, live, tierOf } = await seenHires(transaction, actor, ids);
  const made: Change[] = [];
  for (const id of ids) {
    const draft = found.get(id) as Draft;
    if (draft.state === "rejected" && draft.reason === reason) continue;
    made.push({
      recordType,
      recordId: id,
      action: "changed",
      field: rejectedField,
      tier: draftTier(rejectionTier(tierOf), live.get(id), draft),
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
      !(await managerAllowed(transaction, hire?.managerId, editor)) ||
      (typeof hire?.requisition === "string" &&
        (await takenEmployeeIds(transaction, [hire.requisition], [record.id]))
          .length > 0)
    ) {
      throw new ConflictError(changedSince);
    }
    // Undoing can take a planned manager's mark away, or the manager itself, as clearing or
    // removing it can.
    if (
      now?.isManager === true &&
      hire?.isManager !== true &&
      (await hiresReportTo(transaction, [record.id], { drafted: true }))
    ) {
      throw new ConflictError(changedSince);
    }
    if (hire !== undefined && newlyManaged(now, hire)) {
      await refuseUnmarked(
        transaction,
        String(hire.managerId),
        (message) => new ConflictError(message),
        { seesPositions: false },
      );
      await refuseHireLoop(transaction, editor, record.id, hire.managerId);
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
    isManager: hire.isManager,
    values: hire.values,
    links: hire.links,
    notes: hire.notes,
    numbers: hire.numbers,
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
              ...(live.isManager === undefined
                ? {}
                : { isManager: live.isManager }),
              values: live.values,
              links: live.links,
              notes: live.notes,
              numbers: live.numbers,
            },
          },
        }),
    ...(hire.filler === undefined ? {} : { filler: hire.filler }),
    ...(hire.heldBy === undefined ? {} : { heldBy: hire.heldBy }),
  };
}
