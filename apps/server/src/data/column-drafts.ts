// SPDX-License-Identifier: Apache-2.0

// Drafts of the columns added to tables: reading the columns as their drafts make them, drafting
// columns added, changed, and removed, and discarding drafts and sending rejected ones for approval
// again. Part of the data access layer; the caller checks the actor may change planning
// configuration. Every change is a draft, as drafts.ts sets out, which reaches the live columns only
// once approved, as column-approvals.ts sets out, and is recorded in the change history.

import { changes, type Database, fields, lists } from "@fathom/db";
import {
  builtInColumnTiers,
  seesBuiltInColumn,
  type ColumnTable,
  columnTablePolicies,
  featureColumnKeys,
  type Field,
  type FieldDraft,
  type FieldRequest,
  fieldTypeSchema,
  type Tier,
} from "@fathom/shared";
import { and, asc, eq, inArray, min } from "drizzle-orm";
import { randomUUID } from "node:crypto";
import {
  type Actor,
  mostSensitive,
  requirePermission,
  seesSensitivity,
  storedTier,
} from "../access.ts";
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
import { readColumnOrder } from "./column-order.ts";
import {
  classifyDraft,
  recordMove,
  requireClassify,
  requireMove,
} from "./data-classes.ts";
import {
  asDraft,
  clearedRejection,
  discardDrafts,
  type Draft,
  drafted,
  draftFields,
  draftMakers,
  draftsUse,
  everything,
  type Held,
  heldByOf,
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
  listExists,
  type ListsState,
  listTier,
  readState,
  unpublishedMark,
  unseenDetails,
} from "./lists.ts";
import { type FieldRow, readBuiltInTiers } from "./values.ts";

type Reader = Pick<Database, "select">;

// The table whose columns these are.
const table = "people";
const noField = "There is no such column";

// What differs between the tables that can have columns added: whether a column can be offered on
// planned hires too, whether its values must be General, and what removing its values takes.
const policyOf = (tableName: unknown) =>
  columnTablePolicies[tableName === "features" ? "features" : "people"];
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

// Whether a column is on a table; a draft written before columns had tables is on People.
const isOnTable = (state: ColumnsState, id: string, tableName: ColumnTable) =>
  (state.fields.get(id)?.tableName ??
    state.fieldDrafts.get(id)?.fields.tableName ??
    table) === tableName;

const fieldExists = (state: ColumnsState, id: string) =>
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
const requested = (request: FieldRequest, tableName: unknown): Recorded => ({
  tableName,
  name: request.name,
  type: request.type,
  listId: request.listId ?? null,
  visibility: request.visibility ?? null,
  multiple: request.multiple,
  required: request.required,
  onPlannedHires: policyOf(tableName).onPlannedHires && request.onPlannedHires,
});

const sameType = "A column's type cannot change";

// Saves a column's draft as wanted and records the changes, clearing a rejection.
async function saveFieldDraft(
  transaction: Transaction,
  maker: Actor,
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
  await writeDraft(transaction, maker.user.id, "field", id, live, after);
  return recordChanges(transaction, maker, [
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
  "Choose a list, or a visibility, whose details this role can see";

// Refuses a column whose tier the actor cannot see: a column may be given only a tier its creator
// can see, and, as with removing one, only someone who sees a column's details may change it.
function refuseUnseenTier(
  actor: Actor,
  state: ColumnsState,
  field: Recorded,
  message = unseenTier,
) {
  // Columns on Features are General, which refuseSensitiveOnFeatures holds them to.
  if (policyOf(field.tableName).generalOnly) return;
  if (!seesSensitivity(actor, columnTier(state, field))) {
    throw new ForbiddenError(message);
  }
}

// Refuses a column on Features whose values are not General, since everyone who sees the plan is
// sent them.
export function refuseSensitiveOnFeatures(
  state: ColumnsState,
  field: Recorded,
) {
  if (
    policyOf(field.tableName).generalOnly &&
    columnTier(state, field) !== "general"
  ) {
    throw new BadRequestError(
      "Everyone who sees the plan sees columns on Features, so choose a General list or visibility",
    );
  }
}

// Drafts adding a column at the end of a table. It can be required only while the table has no
// records yet.
export async function createField(
  database: Database,
  actor: Actor,
  request: FieldRequest,
  tableName: ColumnTable = table,
): Promise<Saved<Field>> {
  return drafting(database, actor.user.id, async (transaction, state) => {
    if (nameTaken(state, request.name, undefined, tableName)) {
      throw new ConflictError(duplicateField);
    }
    if (request.listId !== undefined) {
      await checkList(transaction, state, request.listId, badRequest);
    }
    const id = randomUUID();
    const field = requested(request, tableName);
    refuseUnseenTier(actor, state, field);
    refuseSensitiveOnFeatures(state, field);
    classifyDraft(actor, {
      live: false,
      name: request.name,
      from: "general",
      to: ownClass(id, field),
    });
    // A new column has no values, so it can be required only while there is no one yet.
    await checkValuesFit(
      transaction,
      { ...columnRow(id, field), required: false },
      request,
    );
    const changeSetId = await saveFieldDraft(
      transaction,
      actor,
      state,
      id,
      undefined,
      field,
    );
    return { result: toFieldOut(id, field), changeSetId };
  });
}

// A column as its draft makes it, refusing one that does not exist or is drafted to be removed.
function changeableField(
  state: ColumnsState,
  id: string,
  tableName: ColumnTable,
): Recorded {
  if (!fieldExists(state, id) || !isOnTable(state, id, tableName)) {
    throw new NotFoundError(noField);
  }
  refuseHeldIn(state.held.fields.get(id));
  const field = draftedField(state, id);
  if (field === undefined) throw new ConflictError(toBeRemoved);
  return field;
}

// Drafts a change to a column's settings, which must fit the records' values, live and in drafts.
export async function updateField(
  database: Database,
  actor: Actor,
  id: string,
  request: FieldRequest,
  tableName: ColumnTable = table,
): Promise<Saved<Field>> {
  return drafting(database, actor.user.id, (transaction, state) =>
    changeField(transaction, actor, state, id, request, tableName),
  );
}

async function changeField(
  transaction: Transaction,
  actor: Actor,
  state: ColumnsState,
  id: string,
  request: FieldRequest,
  tableName: ColumnTable,
): Promise<Saved<Field>> {
  const field = changeableField(state, id, tableName);
  const live = state.fields.get(id);
  const unseen = unseenDetails(String(field.name));
  refuseUnseenTier(actor, state, field, unseen);
  if (live !== undefined) refuseUnseenTier(actor, state, live, unseen);
  if (columnRow(id, field).type !== request.type) {
    throw new BadRequestError(sameType);
  }
  if (nameTaken(state, request.name, id, field.tableName)) {
    throw new ConflictError(duplicateField);
  }
  // The live values are checked against the live column, so a change already drafted is checked
  // again here.
  const current = columnRow(id, live ?? { ...field, required: false });
  await checkValuesFit(transaction, current, request);
  if (request.listId !== undefined && request.listId !== current.listId) {
    await checkList(transaction, state, request.listId, badRequest);
  }
  const after = { ...field, ...requested(request, field.tableName) };
  refuseUnseenTier(actor, state, after);
  refuseSensitiveOnFeatures(state, after);
  classifyDraft(actor, {
    live: live !== undefined,
    name: String(field.name),
    from: ownClass(id, field),
    to: ownClass(id, after),
  });
  const changeSetId = await saveFieldDraft(
    transaction,
    actor,
    state,
    id,
    field,
    after,
  );
  return { result: toFieldOut(id, after), changeSetId };
}

export const columnMoved = (name: unknown) => `the ${String(name)} column`;

// The class a column holds of its own, General for one that takes its list's.
const ownClass = (id: string, field: Recorded): Tier =>
  storedTier(columnRow(id, field).visibility ?? "general");

const takesListsClass =
  "This column takes its list's class, so change the list's class instead";

// Gives a column only drafted to be added another class in its draft, as its own dialog does.
async function classifyAddedField(
  transaction: Transaction,
  actor: Actor,
  state: ColumnsState,
  id: string,
  to: Tier,
): Promise<string | null> {
  // A column that isn't live is only ever a draft adding it.
  const field = draftedField(state, id);
  if (field === undefined) throw new NotFoundError(noField);
  requirePermission(actor, "configuration:edit");
  const row = columnRow(id, field);
  if (row.visibility === null) throw new BadRequestError(takesListsClass);
  const { changeSetId } = await changeField(
    transaction,
    actor,
    state,
    id,
    {
      name: row.name,
      type: fieldTypeSchema.parse(row.type),
      visibility: to,
      multiple: row.multiple,
      required: row.required,
      onPlannedHires: row.onPlannedHires,
    },
    row.tableName === "features" ? "features" : "people",
  );
  return changeSetId;
}

// Moves a column with a class of its own, rather than its list's, to another class: at once for an
// approved column, and in its draft for one only drafted to be added.
export async function moveColumnClass(
  database: Database,
  actor: Actor,
  id: string,
  to: Tier,
): Promise<string | null> {
  requireClassify(actor);
  return database.transaction(async (transaction) => {
    await lockDrafts(transaction);
    const [row] = await transaction
      .select()
      .from(fields)
      .where(eq(fields.id, id))
      .for("update");
    const state = await readColumnsState(transaction, actor.user.id);
    if (row === undefined) {
      return classifyAddedField(transaction, actor, state, id, to);
    }
    refuseHeldIn(state.held.fields.get(id));
    if (draftedField(state, id) === undefined) {
      throw new ConflictError(toBeRemoved);
    }
    if (row.visibility === null) {
      throw new BadRequestError(takesListsClass);
    }
    const from = storedTier(row.visibility);
    requireMove(actor, from, to);
    if (from === to) return null;
    if (policyOf(row.tableName).generalOnly) {
      throw new ConflictError(
        "Everyone who sees the plan sees columns on Features, so they stay General",
      );
    }
    await transaction
      .update(fields)
      .set({ visibility: to })
      .where(eq(fields.id, id));
    await recordMove(transaction, actor, columnMoved(row.name), from, to);
    const before = fieldRecord(row);
    return recordChanges(
      transaction,
      actor,
      fieldChanges(
        id,
        "changed",
        columnRow(id, before),
        columnRow(id, { ...before, visibility: to }),
      ),
    );
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

// Whether the actor may remove a column's values: those who can change the table's records, and,
// on People, who see how sensitive the values are.
export function mayRemoveValuesOf(
  actor: Actor,
  field: Recorded,
  tier: Tier,
): boolean {
  const { generalOnly, removalNeeds } = policyOf(field.tableName);
  return (
    actor.permissions.includes(removalNeeds) &&
    (generalOnly || seesSensitivity(actor, tier))
  );
}

// Drafts removing a column and its values; removing a column only drafted to be added discards its
// draft. Its values are people's data, so the actor must also be able to change people, and the
// tier of the column's values, and drafts of people must not change it.
export async function deleteField(
  database: Database,
  actor: Actor,
  id: string,
  tableName: ColumnTable = table,
): Promise<string | null> {
  return drafting(database, actor.user.id, async (transaction, state) => {
    const field = changeableField(state, id, tableName);
    const live = state.fields.get(id);
    if (live === undefined) {
      await refuseIfDraftsFill(transaction, actor.user.id, id, field);
      const made = discardingField(state, id);
      await discardDrafts(transaction, actor.user.id, "field", [id]);
      return recordChanges(transaction, actor, made, "discard");
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
    if (!mayRemoveValuesOf(actor, field, tier)) {
      if (field.tableName === "features") {
        throw new ForbiddenError(
          `Removing ${String(field.name)} removes its values from features, so it takes someone who can change features`,
        );
      }
      throw new ForbiddenError(
        `${String(field.name)} holds people's details this role can't change, so someone who can must delete it`,
      );
    }
    return saveFieldDraft(transaction, actor, state, id, field, undefined);
  });
}

// Which draft of an added column, by its identifier and table, which is People unless given.
export interface ColumnDraftTarget {
  id: string;
  table?: ColumnTable;
}

function draftOf(state: ColumnsState, target: ColumnDraftTarget): Draft {
  if (!isOnTable(state, target.id, target.table ?? table)) {
    throw new NotFoundError("There is no such draft");
  }
  refuseHeldIn(state.held.fields.get(target.id));
  const draft = state.fieldDrafts.get(target.id);
  if (draft === undefined) throw new NotFoundError("There is no such draft");
  return draft;
}

// Discards a draft of a column.
export async function discardColumnDraft(
  database: Database,
  maker: Actor,
  target: ColumnDraftTarget,
): Promise<string | null> {
  return drafting(database, maker.user.id, async (transaction, state) => {
    const { id } = target;
    const draft = draftOf(state, target);
    // A column not live is only drafted to be added, so its draft holds all its settings.
    if (!state.fields.has(id)) {
      await refuseIfDraftsFill(transaction, maker.user.id, id, draft.fields);
    }
    const made = discardingField(state, id);
    await discardDrafts(transaction, maker.user.id, "field", [id]);
    return recordChanges(transaction, maker, made, "discard");
  });
}

// Sends a rejected draft of a column for approval again, unchanged.
export async function resubmitColumnDraft(
  database: Database,
  maker: Actor,
  target: ColumnDraftTarget,
): Promise<string | null> {
  return drafting(database, maker.user.id, async (transaction, state) => {
    const { id } = target;
    const draft = draftOf(state, target);
    if (draft.state !== "rejected") {
      throw new ConflictError("Only a rejected draft can be resubmitted");
    }
    await setRejection(transaction, "field", [id], {
      state: "waiting",
      reason: null,
    });
    return recordChanges(
      transaction,
      maker,
      clearedRejection(id, () => "general", undefined, draft, "field"),
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
    madeAs: maker?.madeAs ?? null,
    madeAt: maker?.madeAt.toISOString() ?? null,
    editors: maker?.editors ?? [],
    ...otherApprover(maker),
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
  const shown = ids.flatMap((id): Field[] => {
    const live = state.fields.get(id);
    const draft = state.fieldDrafts.get(id);
    // Every column read is live, or drafted to be added.
    const field = (drafted(live, draft) ?? live) as Recorded;
    const tier = mostSensitive([
      columnTier(state, field),
      ...(live === undefined ? [] : [columnTier(state, live)]),
    ]);
    // Columns on Features are General, and shown to everyone who sees the plan.
    if (!policyOf(tableName).generalOnly && !seesSensitivity(actor, tier)) {
      return [];
    }
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
  if (tableName === "features") {
    const shownIds = new Set(shown.map(({ id }) => id));
    return {
      fields: shown,
      order: [
        ...featureColumnKeys,
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
