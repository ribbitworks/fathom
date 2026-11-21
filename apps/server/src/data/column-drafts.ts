// SPDX-License-Identifier: Apache-2.0

// Drafting columns added to tables: adding, changing, moving to another class and removing them,
// and discarding or resubmitting their drafts. The caller checks the actor may change planning
// configuration.

import { type Database, fields } from "@fathom/db";
import {
  type ColumnTable,
  type Field,
  type FieldRequest,
  fieldTypeSchema,
  type Tier,
} from "@fathom/shared";
import { eq } from "drizzle-orm";
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
  draftsUse,
  lockDrafts,
  type Recorded,
  setRejection,
  writeDraft,
} from "./drafts.ts";
import { checkValuesFit, fieldChanges } from "./fields.ts";
import { unseenDetails } from "./lists.ts";
import { readKeyNumber } from "./record-keys.ts";
import {
  badRequest,
  checkList,
  columnRow,
  type ColumnsState,
  columnTier,
  draftedField,
  duplicateField,
  fieldExists,
  fieldRecord,
  isOnTable,
  mayRemoveValuesOf,
  nameTaken,
  noField,
  policyOf,
  readColumnsState,
  refuseHeldIn,
  refuseSensitiveOnFeatures,
  table,
  toBeRemoved,
  toFieldOut,
} from "./column-state.ts";

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
    return {
      result: toFieldOut(
        id,
        await readKeyNumber(transaction, "column", id),
        field,
      ),
      changeSetId,
    };
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
  return {
    result: toFieldOut(
      id,
      await readKeyNumber(transaction, "column", id),
      after,
    ),
    changeSetId,
  };
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
