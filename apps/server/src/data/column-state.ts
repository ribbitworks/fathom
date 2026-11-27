// SPDX-License-Identifier: Apache-2.0

// The columns added to tables as their drafts make them: reading them with the lists they draw on,
// the rules a column's draft must keep, and each column as the reader sees it. Part of the data
// access layer.

import { changes, fields, lists, type Reader } from "@fathom/db";
import {
  builtInColumnTiers,
  seesBuiltInColumn,
  type ColumnTable,
  columnTableOf,
  activityColumnKeys,
  columnTablePolicies,
  editsColumnsOf,
  featureColumnKeys,
  type Field,
  type FieldDraft,
  type Tier,
} from "@fathom/shared";
import { and, asc, eq, inArray, min } from "drizzle-orm";
import { type Actor, mostSensitive, seesSensitivity } from "../access.ts";
import { BadRequestError, ForbiddenError } from "../errors.ts";
import type { Transaction } from "./changes.ts";
import { readColumnOrder } from "./column-order.ts";
import {
  type Draft,
  drafted,
  draftFields,
  type Recorded,
  type Viewer,
} from "./draft-records.ts";
import {
  draftMakers,
  everything,
  type Maker,
  viewerMarks,
} from "./draft-makers.ts";
import {
  type Held,
  heldByOf,
  readDrafts,
  readHeld,
  refuseHolder,
} from "./drafts.ts";
import { typeOf } from "./column-types.ts";
import { fieldFields } from "./fields.ts";
import { unpublishedMark } from "./list-reads.ts";
import {
  draftedList,
  listExists,
  type ListsState,
  listTier,
  readState,
} from "./list-state.ts";
import { keyNumberOf, readKeyNumbers } from "./record-keys.ts";
import { type FieldRow, readBuiltInTiers } from "./values.ts";

// The table whose columns these are.
export const table = "people";
export const noField = "There is no such column";

// The built-in columns of the tables of planned work, in the order the tables show them.
const planningColumnKeys: Readonly<
  Record<Exclude<ColumnTable, "people">, readonly string[]>
> = {
  features: featureColumnKeys,
  activities: activityColumnKeys,
};

// What differs between the tables that can have columns added, for a column by its recorded table.
export const policyOf = (tableName: unknown) =>
  columnTablePolicies[columnTableOf(tableName)];

// Checks the actor may add and change a table's columns, and returns who to record as making the
// change.
export function columnEditor(actor: Actor, table: ColumnTable): Actor {
  if (!editsColumnsOf(actor.permissions, table)) throw new ForbiddenError();
  return actor;
}

export const duplicateField = "There is already a column with that name";
export const toBeRemoved =
  "This column's draft removes it; discard the draft to change it";

export const fieldRecord = (row: FieldRow): Recorded => ({
  tableName: row.tableName,
  name: row.name,
  type: row.type,
  listId: row.listId,
  visibility: row.visibility,
  multiple: row.multiple,
  required: row.required,
  onPlannedHires: row.onPlannedHires,
});

// Every table's added columns, live and in drafts, and the live order of the People table's columns,
// read together, with the lists they draw on, as the viewer sees them, with the records others hold.
export interface ColumnsState {
  fields: Map<string, Recorded>;
  fieldDrafts: Map<string, Draft>;
  liveOrder: string[];
  lists: ListsState;
  held: { fields: Map<string, Held> };
}

export async function readColumnsState(
  reader: Reader,
  viewer?: Viewer,
): Promise<ColumnsState> {
  // Every table's columns, since a column's draft is decided the same way whichever table it is on.
  const rows = await reader.select().from(fields).orderBy(asc(fields.id));
  return {
    fields: new Map(rows.map((row) => [row.id, fieldRecord(row)])),
    fieldDrafts: await readDrafts(reader, "field", undefined, viewer),
    liveOrder: await readColumnOrder(reader),
    lists: await readState(reader, viewer),
    held: {
      fields: await readHeld(reader, "field", viewer),
    },
  };
}

export const draftedField = (state: ColumnsState, id: string) =>
  drafted(state.fields.get(id), state.fieldDrafts.get(id));

// A column as someone sees it: live, or as a draft makes it, their own unpublished ones included;
// undefined once there is no trace of it.
export async function columnAsSeenBy(
  reader: Reader,
  viewer: string,
  id: string,
): Promise<Recorded | undefined> {
  const state = await readColumnsState(reader, viewer);
  return state.fields.get(id) ?? draftedField(state, id);
}

// Whether a column is on a table; a draft written before columns had tables is on People.
export const isOnTable = (
  state: ColumnsState,
  id: string,
  tableName: ColumnTable,
) =>
  (state.fields.get(id)?.tableName ??
    state.fieldDrafts.get(id)?.fields.tableName ??
    table) === tableName;

export const fieldExists = (state: ColumnsState, id: string) =>
  state.fields.has(id) || state.fieldDrafts.get(id)?.action === "created";

// The columns drafted to be added, in the order they were drafted.
export const addedFields = (
  state: ColumnsState,
  tableName: ColumnTable = table,
): string[] =>
  [...state.fieldDrafts]
    .filter(
      ([id, draft]) =>
        draft.action === "created" &&
        !state.fields.has(id) &&
        draft.fields.tableName === tableName,
    )
    .map(([id]) => id);

const lower = (value: unknown) => String(value).trim().toLowerCase();

// The table a column is on, live or only drafted to be added.
const tableOfField = (state: ColumnsState, id: string, draft?: Draft) =>
  state.fields.get(id)?.tableName ?? draft?.fields.tableName;

// Whether another column on the same table has the name, live or in a draft, published or not, as
// for lists' names.
export function nameTaken(
  state: ColumnsState,
  name: string,
  except?: string,
  within: unknown = table,
): boolean {
  const wanted = lower(name);
  return (
    [...state.fields].some(
      ([id, field]) =>
        id !== except &&
        field.tableName === within &&
        lower(field.name) === wanted,
    ) ||
    [
      ...state.fieldDrafts,
      ...[...state.held.fields].map(([id, { draft }]) => [id, draft] as const),
    ].some(
      ([id, draft]) =>
        id !== except &&
        tableOfField(state, id, draft) === within &&
        draft.fields.name !== undefined &&
        lower(draft.fields.name) === wanted,
    )
  );
}

// Refuses a change to a record someone else holds.
export function refuseHeldIn(held: Held | undefined): void {
  refuseHolder(held?.holder);
}

// The tier of a column's values, as its type sets it, with each list's tier live or as drafted,
// whichever is more sensitive.
export function columnTier(state: ColumnsState, field: Recorded): Tier {
  const type = typeOf(field);
  return type.tier(type.settings(field), (listId) =>
    listTier(state.lists, listId),
  );
}

// Whether a column's draft draws on a list only drafted to be added, whose draft it then uses.
export function usesAddedList(state: ColumnsState, field: Recorded): boolean {
  const { listId } = typeOf(field).settings(field);
  return listId !== null && !state.lists.lists.has(listId);
}

export const badRequest = (message: string) => new BadRequestError(message);

// Refuses a list a column may not draw on: one that is neither live nor drafted to be added, one
// drafted to be removed, or one that is retired: a live list as it is live, since approving its
// retirement is refused while a column draws on it. The refusal is made by the caller's own error.
export async function checkList(
  transaction: Transaction,
  state: ColumnsState,
  listId: string,
  refusal: (message: string) => Error,
) {
  const list = listExists(state.lists, listId)
    ? draftedList(state.lists, listId)
    : undefined;
  if (list === undefined) throw refusal("There is no such list");
  if ((state.lists.lists.get(listId) ?? list).retired === true) {
    throw refusal("Choose a list that is not retired");
  }
  // Someone else holding a list only drafted to be added may be discarding it.
  const held = state.lists.lists.has(listId)
    ? undefined
    : state.lists.held.lists.get(listId);
  refuseHeldIn(held);
  // Locked shared, so the list cannot be approved as retired until this draft is saved. A list only
  // drafted to be added has no row yet; the drafts lock keeps its draft in place instead.
  await transaction
    .select({ id: lists.id })
    .from(lists)
    .where(eq(lists.id, listId))
    .for("share");
}

// A column as its row in the database, as approving writes it.
export const columnRow = (id: string, field: Recorded): FieldRow => ({
  id,
  tableName: String(field.tableName),
  // Only drafted columns are approved, never a private page's.
  pageId: null,
  name: String(field.name),
  ...typeOf(field).settings(field),
  required: field.required === true,
  onPlannedHires: field.onPlannedHires === true,
});

export const toFieldOut = (
  id: string,
  keyNumber: number,
  field: Recorded,
): Field => {
  const { type, listId, visibility, multiple } = typeOf(field).settings(field);
  return {
    id,
    keyNumber,
    name: String(field.name),
    type,
    listId,
    visibility,
    multiple,
    required: field.required === true,
    onPlannedHires: field.onPlannedHires === true,
    table: columnTableOf(field.tableName),
  };
};

// Refuses a column on Features or Activities whose values are not General, since everyone who sees
// the plan is sent them.
export function refuseSensitivePlanningColumn(
  state: ColumnsState,
  field: Recorded,
) {
  if (
    policyOf(field.tableName).generalOnly &&
    columnTier(state, field) !== "general"
  ) {
    throw new BadRequestError(
      `Everyone who sees the plan sees columns on ${policyOf(field.tableName).name}, so choose a General list or visibility`,
    );
  }
}

// Whether one who may change a table's columns may also remove a column's values: on People, only
// one who sees how sensitive they are; on Features, whose values are General, anyone.
export function mayRemoveValuesOf(
  actor: Actor,
  field: Recorded,
  tier: Tier,
): boolean {
  return policyOf(field.tableName).generalOnly || seesSensitivity(actor, tier);
}

function draftOut(
  live: Recorded | undefined,
  draft: Draft,
  maker: Maker | undefined,
): FieldDraft {
  const touched = draftFields(live, draft);
  const shown = fieldFields.filter((field) => field !== "tableName");
  const changed = shown.filter((field) => touched.includes(field));
  return {
    action: draft.action,
    changed,
    live:
      live === undefined
        ? {}
        : Object.fromEntries(
            // The fields are the column's own, named just above.
            // eslint-disable-next-line security/detect-object-injection
            changed.map((field) => [field, live[field]]),
          ),
    state: draft.state,
    ...(draft.state === "rejected" && draft.reason !== null
      ? { reason: draft.reason }
      : {}),
    ...unpublishedMark(draft),
    madeBy: maker?.madeBy ?? null,
    madeAs: maker?.madeAs ?? null,
    madeAt: maker?.madeAt.toISOString() ?? null,
    editors: maker?.editors ?? [],
    ...viewerMarks(maker),
    changedBy: Object.fromEntries(
      changed.map((field) => [field, maker?.fieldEditors.get(field) ?? null]),
    ),
  };
}

// The columns given, in the order they were first added, which approving one leaves alone.
// Features' columns have no stored order to keep them in until they can be moved.
async function columnsAsAdded(
  reader: Reader,
  ids: readonly string[],
): Promise<string[]> {
  const rows = await reader
    .select({ id: changes.recordId })
    .from(changes)
    .where(
      and(eq(changes.recordType, "field"), inArray(changes.recordId, [...ids])),
    )
    .groupBy(changes.recordId)
    .orderBy(min(changes.id));
  return rows.map(({ id }) => id);
}

// A table's columns as the actor may see them, as their drafts make them, with the drafts beside,
// and the order of the columns they see: on People, those drafted to be added last, and on Features,
// the order they were first added in. A column whose values are
// more sensitive than the actor may see is left out, as are built-in dates for those without
// Personal details.
export async function readColumnsOut(
  reader: Reader,
  actor: Actor,
  tableName: ColumnTable = table,
): Promise<{
  fields: Field[];
  order: string[];
}> {
  const viewer = actor.user.id;
  const state = await readColumnsState(reader, viewer);
  const ids = [
    ...[...state.fields]
      .filter(([, field]) => field.tableName === tableName)
      .map(([id]) => id),
    ...addedFields(state, tableName),
  ];
  const makers = await draftMakers(reader, "field", ids, everything, actor);
  const keys = await readKeyNumbers(reader, "column", ids);
  const shown = ids.flatMap((id): Field[] => {
    const live = state.fields.get(id);
    const draft = state.fieldDrafts.get(id);
    // Every column read is live, or drafted to be added.
    const field = (drafted(live, draft) ?? live) as Recorded;
    const tier = mostSensitive([
      columnTier(state, field),
      ...(live === undefined ? [] : [columnTier(state, live)]),
    ]);
    // Columns on Features and Activities are General, and shown to everyone who sees the table.
    if (!policyOf(tableName).generalOnly && !seesSensitivity(actor, tier)) {
      return [];
    }
    return [
      {
        ...toFieldOut(id, keyNumberOf(keys, id), field),
        ...(draft === undefined
          ? {}
          : { draft: draftOut(live, draft, makers.get(id)) }),
        ...heldByOf(state.held.fields, id),
      },
    ];
  });
  if (tableName !== "people") {
    const shownIds = new Set(shown.map(({ id }) => id));
    return {
      fields: shown,
      order: [
        // The table is always one of the fixed tables.
        // eslint-disable-next-line security/detect-object-injection
        ...planningColumnKeys[tableName],
        ...(await columnsAsAdded(reader, [...shownIds])),
      ],
    };
  }
  const builtIn = builtInColumnTiers(await readBuiltInTiers(reader));
  const visible = new Set([
    ...[...builtIn]
      .filter(
        ([key, tier]) =>
          seesSensitivity(actor, tier) &&
          seesBuiltInColumn(actor.permissions, key),
      )
      .map(([key]) => key),
    ...shown.map(({ id }) => id),
  ]);
  return {
    fields: shown,
    order: [...state.liveOrder, ...addedFields(state)].filter((key) =>
      visible.has(key),
    ),
  };
}
