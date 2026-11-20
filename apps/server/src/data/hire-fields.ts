// SPDX-License-Identifier: Apache-2.0

// Planned hires' fields: what each is, the tiers and permissions that cover it, and how changes
// to them are recorded. Part of the data access layer.

import { type Database, plannedHires, type Reader } from "@fathom/db";
import { hireCalled, monthOf, temporaryId, type Tier } from "@fathom/shared";
import {
  type Actor,
  requireSensitivityEdit,
  seesSensitivity,
  type Sensitivity,
} from "../access.ts";
import { BadRequestError } from "../errors.ts";
import {
  builtInTier,
  type ColumnInfo,
  type FieldValue,
  fieldOfValue,
  inListOrder,
  readColumns,
  valueField,
  recordedValues,
  valueFieldsIn,
} from "./values.ts";
import { type Change, changesBetween } from "./changes.ts";
import { fitsColumns, type Recorded, rejectedField } from "./draft-records.ts";
import { recordEvent } from "./history.ts";
import { text } from "./reporting.ts";

export type HireRow = typeof plannedHires.$inferSelect;

export const recordType = "planned-hire";

// The month a planned hire is expected, from its person's start date once filled, or its target
// date, or, with neither, the current month, so it is counted from now.
export const expectedMonth = (
  {
    fillerStart,
    targetDate,
  }: { fillerStart: string | null; targetDate: string | null },
  today: string,
): string => monthOf(fillerStart ?? targetDate ?? today);

// A month taken from no date moves with the day read, so it is shown as no date at all.
export const undatedMark = ({
  fillerStart,
  targetDate,
}: {
  fillerStart: string | null;
  targetDate: string | null;
}): { undated?: true } =>
  fillerStart === null && targetDate === null ? { undated: true } : {};

const hireFields = [
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
export const rejectionTier =
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
export const offeredOn = (columns: readonly ColumnInfo[]) =>
  columns.filter((column) => column.onPlannedHires);

// Whether hires' values fit the columns offered on planned hires, where none is required: each in
// such a column, and one its column's type holds.
export async function fitOffered(
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
export function refuseNotOffered(
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
export function requireHireEdits(actor: Actor, made: readonly Change[]): void {
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
export function nameOfHire(
  hire: Recorded,
  position: string | undefined,
): string {
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
