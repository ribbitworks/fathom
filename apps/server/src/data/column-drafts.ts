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
} from "@fathom/shared";
import { asc, eq } from "drizzle-orm";
import { randomUUID } from "node:crypto";
import { type Actor, mostSensitive, seesTier } from "../access.ts";
import {
  BadRequestError,
  ConflictError,
  ForbiddenError,
  NotFoundError,
} from "../errors.ts";
import {
  type Change,
  recordChanges,
  type Saved,
  type Transaction,
} from "./changes.ts";
import {
  builtInColumns,
  readColumnOrder,
  withBuiltIns,
} from "./column-order.ts";
import {
  asDraft,
  clearedRejection,
  deleteDrafts,
  discardDrafts,
  type Draft,
  drafted,
  draftFields,
  draftMakers,
  draftsUse,
  everything,
  type Held,
  heldMessage,
  lockDrafts,
  type Maker,
  otherApprover,
  readDrafts,
  readHeld,
  type Recorded,
  setRejection,
  type Viewer,
  writeDraft,
} from "./drafts.ts";
import { typeOf } from "./column-types.ts";
import { checkValuesFit, fieldChanges, fieldFields } from "./fields.ts";
import {
  draftedList,
  heldByOf,
  listExists,
  type ListsState,
  listTier,
  readState,
  unpublishedMark,
} from "./lists.ts";
import { builtInColumnTiers, builtInTier, type FieldRow } from "./values.ts";

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
  type: row.type,
  listId: row.listId,
  visibility: row.visibility,
  multiple: row.multiple,
  required: row.required,
  onPlannedHires: row.onPlannedHires,
});

// The People table's columns, live and in drafts, the live order of every column, and the draft of
// the order, read together, with the lists they draw on, as the viewer sees them, with the records
// others hold.
export interface ColumnsState {
  fields: Map<string, Recorded>;
  fieldDrafts: Map<string, Draft>;
  liveOrder: string[];
  orderDraft: Draft | undefined;
  lists: ListsState;
  held: { fields: Map<string, Held>; order: Held | undefined };
}

export async function readColumnsState(
  reader: Reader,
  viewer?: Viewer,
): Promise<ColumnsState> {
  const rows = await reader
    .select()
    .from(fields)
    .where(eq(fields.tableName, table))
    .orderBy(asc(fields.id));
  return {
    fields: new Map(rows.map((row) => [row.id, fieldRecord(row)])),
    fieldDrafts: await readDrafts(reader, "field", undefined, viewer),
    liveOrder: await readColumnOrder(reader),
    orderDraft: (await readDrafts(reader, "column-order", [table], viewer)).get(
      table,
    ),
    lists: await readState(reader, viewer),
    held: {
      fields: await readHeld(reader, "field", viewer),
      order: (await readHeld(reader, "column-order", viewer, [table])).get(
        table,
      ),
    },
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
  builtInColumns.includes(key) || fieldExists(state, key);

// The order a draft of the column order holds, of columns that still exist.
export function heldColumnOrder(state: ColumnsState): string[] | undefined {
  if (state.orderDraft === undefined) return undefined;
  // Written only by writeColumnOrderDraft, which always holds an order.
  return withBuiltIns(
    (state.orderDraft.fields.order as string[]).filter((key) =>
      keyExists(state, key),
    ),
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
  editor: string,
  state: ColumnsState,
  wanted: readonly string[],
): Promise<void> {
  const held = columnOrderToHold(state, wanted);
  await writeDraft(
    transaction,
    editor,
    "column-order",
    table,
    { order: state.liveOrder },
    { order: held ?? state.liveOrder },
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

// Removes a draft of the order that no longer changes anything: the published draft, or the
// editor's own unpublished one, as for lists' orders. It holds nothing to approve, so nothing is
// recorded.
export async function removeEmptyColumnOrder(
  transaction: Transaction,
  editor?: string,
): Promise<void> {
  const state = await readColumnsState(transaction, editor);
  if (
    state.orderDraft !== undefined &&
    (editor === undefined || state.orderDraft.unpublished === true) &&
    columnOrderToHold(state, draftedColumnOrder(state)) === undefined
  ) {
    if (editor === undefined) {
      await deleteDrafts(transaction, "column-order", [table]);
    } else await discardDrafts(transaction, editor, "column-order", [table]);
  }
}

const lower = (value: unknown) => String(value).trim().toLowerCase();

// Whether another column has the name, live or in a draft, published or not, as for lists' names.
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
    [
      ...state.fieldDrafts,
      ...[...state.held.fields].map(([id, { draft }]) => [id, draft] as const),
    ].some(
      ([id, draft]) =>
        id !== except &&
        draft.fields.name !== undefined &&
        lower(draft.fields.name) === wanted,
    )
  );
}

// Refuses a change to a record someone else holds.
function refuseHeldIn(held: Held | undefined): void {
  if (held !== undefined) throw new ConflictError(heldMessage(held.holder));
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

const badRequest = (message: string) => new BadRequestError(message);

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
  if (held !== undefined) throw new ConflictError(heldMessage(held.holder));
  // Locked shared, so the list cannot be approved as retired until this draft is saved. A list only
  // drafted to be added has no row yet; the drafts lock keeps its draft in place instead.
  await transaction
    .select({ id: lists.id })
    .from(lists)
    .where(eq(lists.id, listId))
    .for("share");
}

async function drafting<Result>(
  database: Database,
  editor: string,
  change: (transaction: Transaction, state: ColumnsState) => Promise<Result>,
): Promise<Result> {
  return database.transaction(async (transaction) => {
    await lockDrafts(transaction);
    return change(transaction, await readColumnsState(transaction, editor));
  });
}

// A column as its row in the database, as approving writes it.
export const columnRow = (id: string, field: Recorded): FieldRow => ({
  id,
  tableName: String(field.tableName),
  name: String(field.name),
  ...typeOf(field).settings(field),
  required: field.required === true,
  onPlannedHires: field.onPlannedHires === true,
});

export const toFieldOut = (id: string, field: Recorded): Field => {
  const { type, listId, visibility, multiple } = typeOf(field).settings(field);
  return {
    id,
    name: String(field.name),
    type,
    listId,
    visibility,
    multiple,
    required: field.required === true,
    onPlannedHires: field.onPlannedHires === true,
  };
};

// A column's settings as a request asks for them, as recorded.
const requested = (request: FieldRequest): Recorded => ({
  tableName: table,
  name: request.name,
  type: request.type,
  listId: request.listId ?? null,
  visibility: request.visibility ?? null,
  multiple: request.multiple,
  required: request.required,
  onPlannedHires: request.onPlannedHires,
});

const sameType = "A column's type cannot change";

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
  await writeDraft(transaction, madeBy, "field", id, live, after);
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

const unseenTier =
  "Choose a list, or a visibility, whose details your role lets you see";

// Refuses a column whose tier the actor cannot see: the Security Plan lets a column be given only a
// tier its creator can see, and, as with removing one, only someone who sees a column's details
// may change it.
function refuseUnseenTier(
  actor: Actor,
  state: ColumnsState,
  field: Recorded,
  message = unseenTier,
) {
  if (!seesTier(actor, columnTier(state, field))) {
    throw new ForbiddenError(message);
  }
}

// Drafts adding a column at the end of the People table. It can be required only while there is no
// one yet.
export async function createField(
  database: Database,
  actor: Actor,
  request: FieldRequest,
): Promise<Saved<Field>> {
  const madeBy = actor.user.id;
  return drafting(database, madeBy, async (transaction, state) => {
    if (nameTaken(state, request.name)) throw new ConflictError(duplicateField);
    if (request.listId !== undefined) {
      await checkList(transaction, state, request.listId, badRequest);
    }
    const id = randomUUID();
    const field = requested(request);
    refuseUnseenTier(actor, state, field);
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
  refuseHeldIn(state.held.fields.get(id));
  const field = draftedField(state, id);
  if (field === undefined) throw new ConflictError(toBeRemoved);
  return field;
}

// Drafts a change to a column's settings, which must fit the people's values, live and in drafts.
export async function updateField(
  database: Database,
  actor: Actor,
  id: string,
  request: FieldRequest,
): Promise<Saved<Field>> {
  const madeBy = actor.user.id;
  return drafting(database, madeBy, async (transaction, state) => {
    const field = changeableField(state, id);
    const live = state.fields.get(id);
    const unseen = `${String(field.name)} holds people's details your role does not let you see, so someone who may must change it`;
    refuseUnseenTier(actor, state, field, unseen);
    if (live !== undefined) refuseUnseenTier(actor, state, live, unseen);
    if (columnRow(id, field).type !== request.type) {
      throw new BadRequestError(sameType);
    }
    if (nameTaken(state, request.name, id)) {
      throw new ConflictError(duplicateField);
    }
    // The live values are checked against the live column, so a change already drafted is checked
    // again here.
    const current = columnRow(id, live ?? { ...field, required: false });
    await checkValuesFit(transaction, current, request);
    if (request.listId !== undefined && request.listId !== current.listId) {
      await checkList(transaction, state, request.listId, badRequest);
    }
    const after = { ...field, ...requested(request) };
    refuseUnseenTier(actor, state, after);
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

// Refuses discarding a column drafted to be added while people's drafts, published or not, give
// anyone a value in it, as the editor sees the drafts.
async function refuseIfDraftsFill(
  transaction: Transaction,
  editor: string,
  id: string,
  field: Recorded,
): Promise<void> {
  if (await draftsUse(transaction, { column: id }, editor)) {
    throw new ConflictError(
      `The ${String(field.name)} column can't be discarded while other drafts depend on it. Discard those drafts, or change them so they no longer use it, then try again.`,
    );
  }
}

// Drafts removing a column and its values; removing a column only drafted to be added discards its
// draft. Its values are people's data, so the actor must also be able to change people, and the
// tier of the column's values, and drafts of people must not change it.
export async function deleteField(
  database: Database,
  actor: Actor,
  id: string,
): Promise<string | null> {
  return drafting(database, actor.user.id, async (transaction, state) => {
    const field = changeableField(state, id);
    const live = state.fields.get(id);
    if (live === undefined) {
      await refuseIfDraftsFill(transaction, actor.user.id, id, field);
      const made = discardingField(state, id);
      await discardDrafts(transaction, actor.user.id, "field", [id]);
      await removeEmptyColumnOrder(transaction, actor.user.id);
      return recordChanges(transaction, actor.user.id, made, "discard");
    }
    if (await draftsUse(transaction, { column: id }, actor.user.id)) {
      throw new ConflictError(
        `Drafts change ${String(field.name)}; approve or discard them before deleting the column`,
      );
    }
    const tier = mostSensitive([
      columnTier(state, field),
      columnTier(state, live),
    ]);
    if (!actor.permissions.includes("people:edit") || !seesTier(actor, tier)) {
      throw new ForbiddenError(
        `${String(field.name)} holds people's details your role does not let you change, so someone who may must delete it`,
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
  return drafting(database, madeBy, async (transaction, state) => {
    refuseHeldIn(state.held.order);
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
    await writeColumnOrderDraft(transaction, madeBy, state, wanted);
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
  refuseHeldIn(
    target.kind === "order"
      ? state.held.order
      : state.held.fields.get(target.id),
  );
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
  return drafting(database, madeBy, async (transaction, state) => {
    const draft = draftOf(state, target);
    // A column not live is only drafted to be added, so its draft holds all its settings.
    if (target.kind === "column" && !state.fields.has(target.id)) {
      await refuseIfDraftsFill(transaction, madeBy, target.id, draft.fields);
    }
    const made =
      target.kind === "order"
        ? discardingOrder(state)
        : discardingField(state, target.id);
    if (target.kind === "order") {
      await discardDrafts(transaction, madeBy, "column-order", [table]);
    } else {
      await discardDrafts(transaction, madeBy, "field", [target.id]);
      await removeEmptyColumnOrder(transaction, madeBy);
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
  return drafting(database, madeBy, async (transaction, state) => {
    const draft = draftOf(state, target);
    if (draft.state !== "rejected") {
      throw new ConflictError("Only a rejected draft can be resubmitted");
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
    ...unpublishedMark(draft),
    madeBy: maker?.madeBy ?? null,
    madeAt: maker?.madeAt.toISOString() ?? null,
    editors: maker?.editors ?? [],
    ...otherApprover(maker),
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
  orderHeldBy?: string;
}> {
  const viewer = actor.user.id;
  const state = await readColumnsState(reader, viewer);
  const ids = [...state.fields.keys(), ...addedFields(state)];
  const makers = await draftMakers(
    reader,
    "field",
    [...state.fieldDrafts.keys()],
    everything,
    viewer,
  );
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
        ...heldByOf(state.held.fields, id),
      },
    ];
  });
  const builtIn = builtInColumnTiers({
    positionTier: await builtInTier(reader, "positions"),
    stateTier: await builtInTier(reader, "hiring-states"),
  });
  const visible = new Set([
    ...[...builtIn]
      .filter(([, tier]) => seesTier(actor, tier))
      .map(([key]) => key),
    ...shown.map(({ id }) => id),
  ]);
  const orderMaker = (
    await draftMakers(reader, "column-order", [table], everything, viewer)
  ).get(table);
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
            ...unpublishedMark(state.orderDraft),
            madeBy: orderMaker?.madeBy ?? null,
            madeAt: orderMaker?.madeAt.toISOString() ?? null,
            editors: orderMaker?.editors ?? [],
            ...otherApprover(orderMaker),
          },
        }
      : {}),
    ...(state.held.order === undefined
      ? {}
      : { orderHeldBy: state.held.order.holder }),
  };
}
