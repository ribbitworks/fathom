// SPDX-License-Identifier: Apache-2.0

// Drafts of the People table's columns and of their order: reading the columns as their drafts make
// them, drafting columns added, changed, and removed, and a new order of the columns, built-in and
// added alike, as one draft holding the whole order; and discarding drafts and sending rejected ones
// for approval again. Part of the data access layer; the caller checks the actor may change planning
// configuration. Every change is a draft, as drafts.ts sets out, which reaches the live columns only
// once approved, as column-approvals.ts sets out, and is recorded in the change history.

import { type Database, fields, lists } from "@fathom/db";
import {
  type ColumnOrderDraft,
  type Field,
  type FieldDraft,
  type FieldRequest,
  type Tier,
  tierSchema,
} from "@fathom/shared";
import { asc, eq } from "drizzle-orm";
import { randomUUID } from "node:crypto";
import { type Actor, mostSensitive, seesTier } from "../access.ts";
import { BadRequestError, ConflictError, NotFoundError } from "../errors.ts";
import {
  type Change,
  recordChanges,
  type Saved,
  type Transaction,
} from "./changes.ts";
import { builtInColumns, readColumnOrder } from "./column-order.ts";
import {
  asDraft,
  clearedRejection,
  deleteDrafts,
  type Draft,
  drafted,
  draftFields,
  draftMakers,
  draftsUse,
  lockDrafts,
  type Maker,
  readDrafts,
  type Recorded,
  type Rejection,
  setRejection,
  writeDraft,
} from "./drafts.ts";
import { checkValuesFit, fieldChanges, fieldFields } from "./fields.ts";
import { draftedList, type ListsState, readState } from "./lists.ts";
import type { FieldRow } from "./values.ts";

type Reader = Pick<Database, "select">;

// The table whose columns these are, which also names the draft of their order.
export const columnOrderId = "people";
const table = columnOrderId;
const noField = "There is no such column";
const duplicateField = "There is already a column with that name";
const toBeRemoved =
  "This column's draft removes it; discard the draft to change it";

export const fieldRecord = (row: FieldRow): Recorded => ({
  tableName: row.tableName,
  name: row.name,
  listId: row.listId,
  multiple: row.multiple,
  required: row.required,
});

// The People table's columns, live and in drafts, the live order of every column, and the draft of
// the order, read together, with the lists they draw on.
export interface ColumnsState {
  fields: Map<string, Recorded>;
  fieldDrafts: Map<string, Draft>;
  liveOrder: string[];
  orderDraft: Draft | undefined;
  lists: ListsState;
}

export async function readColumnsState(reader: Reader): Promise<ColumnsState> {
  const rows = await reader
    .select()
    .from(fields)
    .where(eq(fields.tableName, table))
    .orderBy(asc(fields.id));
  return {
    fields: new Map(rows.map((row) => [row.id, fieldRecord(row)])),
    fieldDrafts: await readDrafts(reader, "field"),
    liveOrder: await readColumnOrder(reader),
    orderDraft: (await readDrafts(reader, "column-order", [table])).get(table),
    lists: await readState(reader),
  };
}

export const draftedField = (state: ColumnsState, id: string) =>
  drafted(state.fields.get(id), state.fieldDrafts.get(id));

const fieldExists = (state: ColumnsState, id: string) =>
  state.fields.has(id) || state.fieldDrafts.get(id)?.action === "created";

// The columns drafted to be added, in the order they were drafted.
export const addedFields = (state: ColumnsState): string[] =>
  [...state.fieldDrafts]
    .filter(
      ([id, draft]) => draft.action === "created" && !state.fields.has(id),
    )
    .map(([id]) => id);

const keyExists = (state: ColumnsState, key: string) =>
  (builtInColumns as readonly string[]).includes(key) ||
  fieldExists(state, key);

// The order a draft of the column order holds, of columns that still exist.
export function heldColumnOrder(state: ColumnsState): string[] | undefined {
  if (state.orderDraft === undefined) return undefined;
  // Written only by writeColumnOrderDraft, which always holds an order.
  return (state.orderDraft.fields.order as string[]).filter((key) =>
    keyExists(state, key),
  );
}

// Every column in order, as a draft of the order, if any, makes it: those it places, then the live
// ones it does not, in their live order, then those drafted to be added, in the order drafted.
export function draftedColumnOrder(state: ColumnsState): string[] {
  const held = heldColumnOrder(state) ?? [];
  const rest = [...state.liveOrder, ...addedFields(state)].filter(
    (key) => !held.includes(key),
  );
  return [...held, ...rest];
}

// The order to hold in a draft for the columns to be in the order wanted, leaving out the columns
// drafted to be added that end it in the order drafted, as for a list's choices. Undefined when the
// order wanted is the live one.
export function columnOrderToHold(
  state: ColumnsState,
  wanted: readonly string[],
): string[] | undefined {
  const added = addedFields(state);
  let kept = wanted.length;
  let next = Infinity;
  for (const key of [...wanted].reverse()) {
    const at = added.indexOf(key);
    if (at === -1 || at > next) break;
    next = at;
    kept -= 1;
  }
  const held = wanted.slice(0, kept);
  return held.join() === state.liveOrder.join() ? undefined : held;
}

// The columns drafted to be added that the draft of the order uses, by placing them.
export const fieldsOrderUses = (state: ColumnsState): string[] =>
  (heldColumnOrder(state) ?? []).filter((key) =>
    addedFields(state).includes(key),
  );

export async function writeColumnOrderDraft(
  transaction: Transaction,
  state: ColumnsState,
  wanted: readonly string[],
  rejection?: Rejection,
): Promise<void> {
  const held = columnOrderToHold(state, wanted);
  await writeDraft(
    transaction,
    "column-order",
    table,
    { order: state.liveOrder },
    { order: held ?? state.liveOrder },
    rejection,
  );
}

// The change that records a new order of the columns: the whole order before and after.
export function columnOrderChanges(
  before: readonly string[],
  after: readonly string[],
): Change[] {
  return before.join() === after.join()
    ? []
    : [
        {
          recordType: "column-order",
          recordId: table,
          action: "changed",
          field: "order",
          tier: "general",
          oldValue: [...before],
          newValue: [...after],
        },
      ];
}

// Removes a draft of the order that no longer changes anything. It holds nothing to approve, so
// nothing is recorded.
export async function removeEmptyColumnOrder(
  transaction: Transaction,
): Promise<void> {
  const state = await readColumnsState(transaction);
  if (
    state.orderDraft !== undefined &&
    columnOrderToHold(state, draftedColumnOrder(state)) === undefined
  ) {
    await deleteDrafts(transaction, "column-order", [table]);
  }
}

const lower = (value: unknown) => String(value).trim().toLowerCase();

// Whether another column has the name, live or in a draft, as for lists' names.
export function nameTaken(
  state: ColumnsState,
  name: string,
  except?: string,
): boolean {
  const wanted = lower(name);
  return (
    [...state.fields].some(
      ([id, field]) => id !== except && lower(field.name) === wanted,
    ) ||
    [...state.fieldDrafts].some(
      ([id, draft]) =>
        id !== except &&
        draft.fields.name !== undefined &&
        lower(draft.fields.name) === wanted,
    )
  );
}

// The tier of a column's values: its list's visibility, live or as drafted, whichever is more
// sensitive, so a draft never shows values to someone the live list would not.
export function columnTier(state: ColumnsState, field: Recorded): Tier {
  const listId = String(field.listId);
  const live = state.lists.lists.get(listId);
  const draft = draftedList(state.lists, listId);
  // A tier the server no longer knows is treated as the most sensitive rather than trusted.
  return mostSensitive(
    [live?.visibility, draft?.visibility]
      .filter((visibility) => visibility !== undefined)
      .map((visibility) => tierSchema.catch("confidential").parse(visibility)),
  );
}

// Refuses a list a column may not draw on: one that is not live, or is retired.
async function checkList(
  transaction: Transaction,
  state: ColumnsState,
  listId: string,
) {
  const list = state.lists.lists.get(listId);
  if (list === undefined) throw new BadRequestError("There is no such list");
  if (list.retired === true) {
    throw new BadRequestError("Choose a list that is not retired");
  }
  // Locked shared, so the list cannot be approved as retired until this draft is saved.
  await transaction
    .select({ id: lists.id })
    .from(lists)
    .where(eq(lists.id, listId))
    .for("share");
}

async function drafting<Result>(
  database: Database,
  change: (transaction: Transaction, state: ColumnsState) => Promise<Result>,
): Promise<Result> {
  return database.transaction(async (transaction) => {
    await lockDrafts(transaction);
    return change(transaction, await readColumnsState(transaction));
  });
}

// A column as its row in the database, as approving writes it.
export const columnRow = (id: string, field: Recorded): FieldRow => ({
  id,
  tableName: String(field.tableName),
  name: String(field.name),
  listId: String(field.listId),
  multiple: field.multiple === true,
  required: field.required === true,
});

export const toFieldOut = (id: string, field: Recorded): Field => ({
  id,
  name: String(field.name),
  listId: String(field.listId),
  multiple: field.multiple === true,
  required: field.required === true,
});

// Saves a column's draft as wanted and records the changes, clearing a rejection.
async function saveFieldDraft(
  transaction: Transaction,
  madeBy: string,
  state: ColumnsState,
  id: string,
  before: Recorded | undefined,
  after: Recorded | undefined,
): Promise<string | null> {
  let action: Change["action"] = "changed";
  if (before === undefined) action = "created";
  else if (after === undefined) action = "deleted";
  const live = state.fields.get(id);
  const made = asDraft(
    fieldChanges(
      id,
      action,
      before && columnRow(id, before),
      after && columnRow(id, after),
    ),
  );
  if (made.length === 0) return null;
  await writeDraft(transaction, "field", id, live, after);
  return recordChanges(transaction, madeBy, [
    ...made,
    ...clearedRejection(
      id,
      () => "general",
      live,
      state.fieldDrafts.get(id),
      "field",
    ),
  ]);
}

// Drafts adding a column at the end of the People table. It can be required only while there is no
// one yet.
export async function createField(
  database: Database,
  madeBy: string,
  request: FieldRequest,
): Promise<Saved<Field>> {
  return drafting(database, async (transaction, state) => {
    if (nameTaken(state, request.name)) throw new ConflictError(duplicateField);
    await checkList(transaction, state, request.listId);
    const id = randomUUID();
    const field = { tableName: table, ...request };
    // A new column has no values, so it can be required only while there is no one yet.
    await checkValuesFit(
      transaction,
      { ...columnRow(id, field), required: false },
      request,
    );
    const changeSetId = await saveFieldDraft(
      transaction,
      madeBy,
      state,
      id,
      undefined,
      field,
    );
    return { result: toFieldOut(id, field), changeSetId };
  });
}

// A column as its draft makes it, refusing one that does not exist or is drafted to be removed.
function changeableField(state: ColumnsState, id: string): Recorded {
  if (!fieldExists(state, id)) throw new NotFoundError(noField);
  const field = draftedField(state, id);
  if (field === undefined) throw new ConflictError(toBeRemoved);
  return field;
}

// Drafts a change to a column's settings, which must fit the people's values, live and in drafts.
export async function updateField(
  database: Database,
  madeBy: string,
  id: string,
  request: FieldRequest,
): Promise<Saved<Field>> {
  return drafting(database, async (transaction, state) => {
    const field = changeableField(state, id);
    if (nameTaken(state, request.name, id)) {
      throw new ConflictError(duplicateField);
    }
    // The live values are checked against the live column, so a change already drafted is checked
    // again here.
    const current = columnRow(
      id,
      state.fields.get(id) ?? { ...field, required: false },
    );
    await checkValuesFit(transaction, current, request);
    const after = { ...field, ...request };
    const changeSetId = await saveFieldDraft(
      transaction,
      madeBy,
      state,
      id,
      field,
      after,
    );
    return { result: toFieldOut(id, after), changeSetId };
  });
}

// The changes that discard a column's draft.
// Called only for a column that has a draft.
function discardingField(state: ColumnsState, id: string): Change[] {
  const draft = state.fieldDrafts.get(id) as Draft;
  const live = state.fields.get(id);
  const field = draftedField(state, id);
  let action: Change["action"] = "changed";
  if (field === undefined) action = "created";
  else if (live === undefined) action = "deleted";
  return [
    ...asDraft(
      fieldChanges(
        id,
        action,
        field && columnRow(id, field),
        live && columnRow(id, live),
      ),
    ),
    ...clearedRejection(id, () => "general", live, draft, "field"),
  ];
}

// Called only when the order has a draft.
function discardingOrder(state: ColumnsState): Change[] {
  return [
    ...asDraft(
      columnOrderChanges(draftedColumnOrder(state), [
        ...state.liveOrder,
        ...addedFields(state),
      ]),
    ),
    ...clearedRejection(
      table,
      () => "general",
      undefined,
      state.orderDraft,
      "column-order",
    ),
  ];
}

// Drafts removing a column and its values; removing a column only drafted to be added discards its
// draft. Its values are people's data, so the actor must also be able to change people, and the
// tier of the column's values, and drafts of people must not change it.
export async function deleteField(
  database: Database,
  actor: Actor,
  id: string,
): Promise<string | null> {
  return drafting(database, async (transaction, state) => {
    const field = changeableField(state, id);
    const live = state.fields.get(id);
    if (live === undefined) {
      const made = discardingField(state, id);
      await deleteDrafts(transaction, "field", [id]);
      await removeEmptyColumnOrder(transaction);
      return recordChanges(transaction, actor.user.id, made, "discard");
    }
    if (await draftsUse(transaction, { column: id })) {
      throw new ConflictError(
        `Drafts change ${String(field.name)}; approve or discard them before deleting the column`,
      );
    }
    const tier = mostSensitive([
      columnTier(state, field),
      columnTier(state, live),
    ]);
    if (!actor.permissions.includes("people:edit") || !seesTier(actor, tier)) {
      throw new ConflictError(
        `${String(field.name)} holds people's details your roles do not let you change, so someone who may must delete it`,
      );
    }
    return saveFieldDraft(
      transaction,
      actor.user.id,
      state,
      id,
      field,
      undefined,
    );
  });
}

// Drafts moving a column, built-in or added, to just after another, or to the start when there is
// none, as a new order of the columns.
export async function moveColumn(
  database: Database,
  madeBy: string,
  key: string,
  after: string | null,
): Promise<string | null> {
  if (after === key) {
    throw new BadRequestError("A column cannot follow itself");
  }
  return drafting(database, async (transaction, state) => {
    const before = draftedColumnOrder(state);
    if (!before.includes(key)) throw new NotFoundError(noField);
    if (after !== null && !before.includes(after)) {
      throw new BadRequestError("Choose a column on the same table to follow");
    }
    const others = before.filter((other) => other !== key);
    const at = after === null ? 0 : others.indexOf(after) + 1;
    const wanted = [...others.slice(0, at), key, ...others.slice(at)];
    const made = asDraft(columnOrderChanges(before, wanted));
    if (made.length === 0) return null;
    await writeColumnOrderDraft(transaction, state, wanted);
    return recordChanges(transaction, madeBy, [
      ...made,
      ...clearedRejection(
        table,
        () => "general",
        undefined,
        state.orderDraft,
        "column-order",
      ),
    ]);
  });
}

export type ColumnDraftTarget =
  { kind: "column"; id: string } | { kind: "order" };

function draftOf(state: ColumnsState, target: ColumnDraftTarget): Draft {
  const draft =
    target.kind === "order"
      ? state.orderDraft
      : state.fieldDrafts.get(target.id);
  if (draft === undefined) throw new NotFoundError("There is no such draft");
  return draft;
}

// Discards a draft of a column or of the column order.
export async function discardColumnDraft(
  database: Database,
  madeBy: string,
  target: ColumnDraftTarget,
): Promise<string | null> {
  return drafting(database, async (transaction, state) => {
    draftOf(state, target);
    const made =
      target.kind === "order"
        ? discardingOrder(state)
        : discardingField(state, target.id);
    if (target.kind === "order") {
      await deleteDrafts(transaction, "column-order", [table]);
    } else {
      await deleteDrafts(transaction, "field", [target.id]);
      await removeEmptyColumnOrder(transaction);
    }
    return recordChanges(transaction, madeBy, made, "discard");
  });
}

// Sends a rejected draft of a column or of the column order for approval again, unchanged.
export async function resubmitColumnDraft(
  database: Database,
  madeBy: string,
  target: ColumnDraftTarget,
): Promise<string | null> {
  return drafting(database, async (transaction, state) => {
    const draft = draftOf(state, target);
    if (draft.state !== "rejected") {
      throw new ConflictError(
        "Only a rejected draft is sent for approval again",
      );
    }
    const recordType = target.kind === "order" ? "column-order" : "field";
    const id = target.kind === "order" ? table : target.id;
    await setRejection(transaction, recordType, [id], {
      state: "waiting",
      reason: null,
    });
    return recordChanges(
      transaction,
      madeBy,
      clearedRejection(id, () => "general", undefined, draft, recordType),
      "resubmission",
    );
  });
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
    madeBy: maker?.madeBy ?? null,
    madeAt: maker?.madeAt.toISOString() ?? null,
    editors: maker?.editors ?? [],
    changedBy: Object.fromEntries(
      changed.map((field) => [field, maker?.fieldEditors.get(field) ?? null]),
    ),
  };
}

// The People table's columns as the actor may see them, as their drafts make them, with the drafts
// beside, the order of the columns they see, as a draft of the order makes it, and that draft. A
// column whose values are more sensitive than the actor may see is left out, as are built-in dates
// for those without Restricted details.
export async function readColumnsOut(
  reader: Reader,
  actor: Actor,
): Promise<{
  fields: Field[];
  order: string[];
  orderDraft?: ColumnOrderDraft;
}> {
  const state = await readColumnsState(reader);
  const ids = [...state.fields.keys(), ...addedFields(state)];
  const makers = await draftMakers(reader, "field", [
    ...state.fieldDrafts.keys(),
  ]);
  const shown = ids.flatMap((id): Field[] => {
    const live = state.fields.get(id);
    const draft = state.fieldDrafts.get(id);
    // Every column read is live, or drafted to be added.
    const field = (drafted(live, draft) ?? live) as Recorded;
    const tier = mostSensitive([
      columnTier(state, field),
      ...(live === undefined ? [] : [columnTier(state, live)]),
    ]);
    if (!seesTier(actor, tier)) return [];
    return [
      {
        ...toFieldOut(id, field),
        ...(draft === undefined
          ? {}
          : { draft: draftOut(live, draft, makers.get(id)) }),
      },
    ];
  });
  const visible = new Set([
    "preferredName",
    "employeeId",
    ...(seesTier(actor, "restricted") ? ["startDate", "endDate"] : []),
    ...shown.map(({ id }) => id),
  ]);
  const orderMaker = (await draftMakers(reader, "column-order", [table])).get(
    table,
  );
  const showsOrder =
    state.orderDraft !== undefined &&
    columnOrderToHold(state, draftedColumnOrder(state)) !== undefined;
  return {
    fields: shown,
    order: draftedColumnOrder(state).filter((key) => visible.has(key)),
    ...(showsOrder && state.orderDraft
      ? {
          orderDraft: {
            live: state.liveOrder.filter((key) => visible.has(key)),
            uses: fieldsOrderUses(state).filter((key) => visible.has(key)),
            state: state.orderDraft.state,
            ...(state.orderDraft.state === "rejected" &&
            state.orderDraft.reason !== null
              ? { reason: state.orderDraft.reason }
              : {}),
            madeBy: orderMaker?.madeBy ?? null,
            madeAt: orderMaker?.madeAt.toISOString() ?? null,
            editors: orderMaker?.editors ?? [],
          },
        }
      : {}),
  };
}
