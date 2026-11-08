// SPDX-License-Identifier: Apache-2.0

// Undoing a change set: one transaction that puts back the old values of everything it changed,
// recorded as a new change set, so the history is never rewritten. Part of the data access layer.
// Only the user who made a change can undo it, with the permissions it needs now, and only while
// nothing it changed has been changed again since. Records it deleted come back with the same
// identifiers, in the places they were in, and with the values they held. Changes to drafts are
// undone in the drafts, and approving and rejecting drafts cannot be undone.

import {
  changes,
  changeSets,
  columnOrders,
  type Database,
  databaseCodes,
  fields,
  fieldValues,
  hasDatabaseCode,
  listItems,
  lists,
  people,
  plannedHires,
  savedViews,
} from "@fathom/db";
import {
  type DraftKind,
  type RecordType as PlanRecordType,
  recordTypeSchema,
  type Tier,
  tierSchema,
} from "@fathom/shared";
import { and, asc, count, eq, gt, inArray, or, sql } from "drizzle-orm";
import {
  type Actor,
  mostSensitive,
  requirePermission,
  requireSensitivityEdit,
  type Sensitivity,
  seesSensitivity,
  storedTier,
} from "../access.ts";
import { choicesWithAdded, columnsWithAdded } from "./added-columns.ts";
import { ConflictError, ForbiddenError, NotFoundError } from "../errors.ts";
import {
  type Change,
  type RecordType,
  recordChanges,
  type Transaction,
} from "./changes.ts";
import { writeColumnOrder } from "./column-order.ts";
import {
  drafted,
  draftsUse,
  fitsColumns,
  lockDrafts,
  readPersonDrafts,
  type Recorded,
  rejectedField,
  setRejection,
  takenEmployeeIds,
  tidy,
  writeDraft,
  writePersonDraft,
} from "./drafts.ts";
import {
  checkList,
  columnRow,
  columnTier,
  nameTaken,
  readColumnsState,
  removeEmptyColumnOrder,
  writeColumnOrderDraft,
} from "./column-drafts.ts";
import { checkLiveList, checkValuesFit, lockFields } from "./fields.ts";
import {
  choiceLabelTaken,
  choicesHaveDrafts,
  draftedList,
  listExists,
  listNameTaken,
  listOfChoice,
  lockChoices,
  placeChoice,
  readState,
  refuseIfChosen,
  refuseIfUsed,
  refuseLastKept,
  removeEmptyOrders,
  writeOrderDraft,
} from "./lists.ts";
import {
  peopleFitColumns,
  personTier,
  readLive,
  recordSensitiveChanges,
  withMark,
} from "./people.ts";
import {
  notMarked,
  readManagers,
  refuseLoop,
  refuseTakenTeamNames,
  refuseUnmarkingManagers,
} from "./reporting.ts";
import { typeOf } from "./column-types.ts";
import { type ColumnInfo, fieldOfValue, writeValues } from "./values.ts";
import { requireViewUndo, viewTierNow } from "./views.ts";
import { readToday } from "./settings.ts";
import { recordTeamDayChanges, undoTeamDrafts } from "./feature-teams.ts";
import {
  hireSensitivities,
  readHireTier,
  recordHiringChanges,
  hireDraftsNaming,
  partOfFill,
  refuseUnmarkingHireManagers,
  undoHireDrafts,
} from "./hires.ts";

// Kinds of the plan's records, whose changes are not undone yet.
const planRecordTypes: ReadonlySet<string> = new Set(recordTypeSchema.options);

const changedSince =
  "This has been changed since, so it can no longer be undone";

// The permissions each kind of record needs to change it: planned hires, those to edit people and
// the hiring plan.
const editPermissions = {
  list: ["configuration:edit"],
  "list-item": ["configuration:edit"],
  "choice-order": ["configuration:edit"],
  field: ["configuration:edit"],
  "column-order": ["configuration:edit"],
  person: ["people:edit"],
  "planned-hire": ["people:edit", "hiring-plan:edit"],
  // Proposing or editing them is checked for the teams themselves.
  "feature-team": ["org-chart:view"],
  // Who may change each view is checked for the view itself.
  "saved-view": ["people:view"],
} as const;

// The order kinds of record are put back in, so a record comes back before those that belong to it.
// Deletions run in the opposite order.
const kindOrder: readonly RecordType[] = [
  "list",
  "list-item",
  "choice-order",
  "field",
  "column-order",
  "person",
  "planned-hire",
  "feature-team",
  "saved-view",
];

// The table each kind of record is kept in. A column order is only ever changed, never created or
// deleted, and is put back as a whole, so it has no columns to set here. A list's choice order is
// only ever changed live by approving, which cannot be undone.
const tables = {
  list: lists,
  "list-item": listItems,
  field: fields,
  person: people,
  "planned-hire": plannedHires,
  "saved-view": savedViews,
} as const;
const tableOf = (record: Undone) =>
  tables[record.recordType as keyof typeof tables];

type Convert = (value: unknown) => unknown;
const text: Convert = (value) => String(value);
const flag: Convert = (value) => value === true;
const textOrNull: Convert = (value) =>
  typeof value === "string" ? value : null;
const tier: Convert = (value) => tierSchema.catch("general").parse(value);
// A tier the server no longer knows is put back as the most sensitive.
const sensitiveTier: Convert = (value) => storedTier(value);
// Put back as recorded: a hire's temporary number, a number or none, and a view's definition,
// read back through the view's own checks whenever it is read.
const asStored: Convert = (value) => value;

// The database columns each kind of record has, as the change history names its fields, and how to
// read each column's value from the history. Other fields, such as a record's place in its order or
// a person's values for a column, are put back separately.
const columnsOf: Record<
  Exclude<RecordType, "column-order" | "choice-order" | PlanRecordType>,
  Readonly<Record<string, Convert>>
> = {
  list: { name: text, description: text, visibility: tier, retired: flag },
  "list-item": {
    listId: text,
    label: text,
    description: text,
    retired: flag,
    meaning: textOrNull,
  },
  field: {
    tableName: text,
    name: text,
    type: text,
    // A web link column has no list, and a choice column no visibility, which are never recorded.
    listId: text,
    visibility: sensitiveTier,
    multiple: flag,
    required: flag,
    onPlannedHires: flag,
  },
  person: {
    preferredName: text,
    employeeId: text,
    positionId: text,
    startDate: textOrNull,
    endDate: textOrNull,
    isManager: flag,
    stateId: textOrNull,
  },
  // Feature teams change only through drafts, so their live rows are never put back here.
  "feature-team": {},
  "planned-hire": {
    requisition: textOrNull,
    temporaryNumber: asStored,
    positionId: text,
    targetDate: textOrNull,
    stateId: text,
    managerId: textOrNull,
    filledBy: textOrNull,
  },
  "saved-view": {
    tableName: text,
    name: text,
    scope: text,
    definition: asStored,
    createdBy: text,
  },
};

type StoredChange = typeof changes.$inferSelect;

interface Undone {
  recordType: RecordType;
  id: string;
  action: Change["action"];
  // Whether the change was to the record's draft.
  draft: boolean;
  // The values before the change, by field, which undoing puts back.
  old: Map<string, unknown>;
}

// The records a change set changed, in the order first changed, each with its old values.
function recordsOf(rows: readonly StoredChange[]): Undone[] {
  const records = new Map<string, Undone>();
  for (const row of rows) {
    const key = `${row.recordType} ${row.recordId} ${String(row.draft)}`;
    const record = records.get(key) ?? {
      recordType: row.recordType as RecordType,
      id: row.recordId,
      action: row.action as Change["action"],
      draft: row.draft,
      old: new Map<string, unknown>(),
    };
    record.old.set(row.field, row.oldValue);
    records.set(key, record);
  }
  return [...records.values()];
}

// The record's database columns as they were before the change.
function columnValues(record: Undone): Record<string, unknown> {
  if (
    record.recordType === "column-order" ||
    record.recordType === "choice-order"
  ) {
    return {};
  }
  // Changes to the plan's records are refused before any is put back.
  const columns = columnsOf[record.recordType as keyof typeof columnsOf];
  return Object.fromEntries(
    [...record.old].flatMap(([field, value]) =>
      Object.hasOwn(columns, field)
        ? // The field is one of the record's own columns, checked just above.
          // eslint-disable-next-line security/detect-object-injection
          [[field, (columns[field] as Convert)(value)]]
        : [],
    ),
  );
}

// Checks that putting back a record's old settings still holds with the data as it is now: an ID
// must be one no other person or hire has taken since, a list can be retired only while no column
// draws on it, and a column's settings must fit its values.
async function checkFits(
  transaction: Transaction,
  record: Undone,
  values: Record<string, unknown>,
): Promise<void> {
  const putBackId = values.employeeId ?? values.requisition;
  if (
    typeof putBackId === "string" &&
    (await takenEmployeeIds(transaction, [putBackId], [record.id])).length > 0
  ) {
    throw new ConflictError(changedSince);
  }
  if (record.recordType === "list" && values.retired === true) {
    await refuseIfUsed(transaction, record.id, "retired");
  }
  if (record.recordType === "field") {
    for (const current of await lockFields(transaction)) {
      if (current.id === record.id) {
        const wanted = { ...current, ...values };
        await checkValuesFit(transaction, current, wanted);
        if (wanted.listId !== null && wanted.listId !== current.listId) {
          await checkLiveList(transaction, wanted.listId);
        }
      }
    }
  }
}

// A list of identifiers or keys as the history holds it: an order is always recorded whole.
const ids = (value: unknown): string[] => (value as unknown[]).map(String);

// Where to put back a choice or column: after the record it followed, at the top, or at the end if
// the one it followed is gone.
function placeFor(
  after: unknown,
  others: readonly { id: string }[],
): { after: string | null } | "end" {
  if (after === null) return { after: null };
  return typeof after === "string" && others.some((row) => row.id === after)
    ? { after }
    : "end";
}

// Puts back a choice's place, a table's column order, and a person's values for each column.
async function putBackPlaceAndValues(
  transaction: Transaction,
  record: Undone,
): Promise<void> {
  const { id, old } = record;
  if (old.has("order") && record.recordType === "list-item") {
    const choices = await transaction
      .select({ listId: listItems.listId })
      .from(listItems)
      .where(eq(listItems.id, id));
    for (const { listId } of choices) {
      await placeChoice(
        transaction,
        listId,
        id,
        placeFor(old.get("order"), await lockChoices(transaction, listId)),
      );
    }
  }
  if (record.recordType === "column-order") {
    await writeColumnOrder(transaction, ids(old.get("order")));
  }
  for (const [field, value] of old) {
    const fieldId = fieldOfValue(field);
    if (fieldId !== null) {
      // Only people's values change live outside approving; a hire's change only in its draft.
      await writeValues(transaction, id, fieldId, value, "person");
    }
  }
}

// Makes a deleted record again, with the same identifier.
async function recreate(
  transaction: Transaction,
  record: Undone,
): Promise<void> {
  const row: Record<string, unknown> = {
    ...columnValues(record),
    id: record.id,
  };
  // A person or hire whose history was recorded before Position was built in has none to put back.
  if (
    (record.recordType === "person" || record.recordType === "planned-hire") &&
    row.positionId === undefined
  ) {
    throw new ConflictError(changedSince);
  }
  await checkFits(transaction, record, row);
  // Each table takes the columns read for its own kind of record.
  await transaction
    .insert(tableOf(record))
    .values(row as typeof people.$inferInsert);
  await putBackPlaceAndValues(transaction, record);
}

// Puts back the old values of a record that was changed.
async function restore(
  transaction: Transaction,
  record: Undone,
): Promise<void> {
  const set = columnValues(record);
  await checkFits(transaction, record, set);
  if (Object.keys(set).length > 0) {
    const table = tableOf(record);
    await transaction.update(table).set(set).where(eq(table.id, record.id));
  }
  await putBackPlaceAndValues(transaction, record);
}

// Refuses to delete a list or column that something added since belongs to: a choice in the list,
// or a value in the column. The database refuses for choices and people.
async function refuseIfHeld(
  transaction: Transaction,
  record: Undone,
): Promise<void> {
  // Drafts hold choices and values without the database knowing.
  if (
    (record.recordType === "field" &&
      (await draftsUse(transaction, { column: record.id }))) ||
    (record.recordType === "list-item" &&
      (await draftsUse(transaction, { choice: record.id })))
  ) {
    throw new ConflictError(changedSince);
  }
  const holders = {
    list: () =>
      transaction
        .select({ total: count() })
        .from(listItems)
        .where(eq(listItems.listId, record.id)),
    field: () =>
      transaction
        .select({ total: count() })
        .from(fieldValues)
        .where(eq(fieldValues.fieldId, record.id)),
  };
  if (record.recordType === "list" || record.recordType === "field") {
    const [held] = await holders[record.recordType]();
    if (Number(held?.total) > 0) throw new ConflictError(changedSince);
  }
}

// Deletes a record the change set created.
async function remove(transaction: Transaction, record: Undone): Promise<void> {
  await refuseIfHeld(transaction, record);
  const table = tableOf(record);
  await transaction.delete(table).where(eq(table.id, record.id));
}

// The changes undoing makes: each change reversed, in the opposite order.
function reversed(rows: readonly StoredChange[]): Change[] {
  const opposite = new Map<string, Change["action"]>([
    ["created", "deleted"],
    ["deleted", "created"],
  ]);
  return [...rows].reverse().map((row) => ({
    recordType: row.recordType as RecordType,
    recordId: row.recordId,
    action: opposite.get(row.action) ?? "changed",
    field: row.field,
    tier: storedTier(row.tier),
    oldValue: row.newValue,
    newValue: row.oldValue,
    draft: row.draft,
  }));
}

// A person put back in a draft from the values a change set removed, with dates left empty when it
// held none.
function fromOld(old: ReadonlyMap<string, unknown>): Recorded {
  return {
    startDate: null,
    endDate: null,
    ...Object.fromEntries([...old].filter(([, value]) => value !== null)),
  };
}

// Puts back the drafts of the people a change set changed in their drafts: the person it drafted
// adding taken out, the one it drafted removing put back as they were, and the fields it changed
// put back, with a rejection's reason. Each must still fit the columns, and keep an Employee ID no
// one else has taken since.
async function undoPersonDrafts(
  transaction: Transaction,
  editor: string,
  columns: readonly ColumnInfo[],
  records: readonly Undone[],
  hiresUndone: readonly string[],
): Promise<void> {
  const ids = records.map(({ id }) => id);
  const today = await readToday(transaction);
  const live = await readLive(transaction, columns, {
    ids,
    lock: true,
    asOf: today,
  });
  const draftsNow = await readPersonDrafts(transaction, ids, editor);
  const undone = (id: string) =>
    new Set(records.find((record) => record.id === id)?.old.keys());
  const wanted = records.map((record) => {
    const draft = draftsNow.get(record.id);
    const old = withoutRejection(record.old);
    let person: Recorded | undefined;
    if (record.action === "deleted") {
      person = fromOld(old);
      if (person.positionId === undefined)
        throw new ConflictError(changedSince);
    } else if (record.action === "changed") {
      const now = drafted(live.get(record.id), draft);
      if (now === undefined) throw new ConflictError(changedSince);
      // Columns left with nothing chosen are left out.
      person = withMark(
        tidy({ ...now, ...Object.fromEntries(old) }),
        live.get(record.id),
      );
    }
    return { id: record.id, person };
  });
  const chosen = wanted.flatMap(({ person }) =>
    Object.entries(person ?? {}).flatMap(([field, value]) =>
      fieldOfValue(field) !== null && Array.isArray(value)
        ? value.map(String)
        : [],
    ),
  );
  const listOf = new Map(
    (await choicesWithAdded(transaction, editor, chosen)).map(
      ({ id, listId }) => [id, listId],
    ),
  );
  for (const { id, person } of wanted) {
    if (person !== undefined) {
      const taken = await takenEmployeeIds(
        transaction,
        [String(person.employeeId)],
        [id],
      );
      if (taken.length > 0 || !fitsColumns(columns, listOf, person)) {
        throw new ConflictError(changedSince);
      }
      await refuseUndoneReporting(
        transaction,
        editor,
        id,
        person,
        undone(id),
        today,
        hiresUndone,
      );
    }
    await writePersonDraft(transaction, editor, id, live.get(id), person);
  }
}

// Refuses putting back, among the fields given: a team name another team has taken since; a manager,
// line, or Manager? that a fill drafted since holds; a line to a manager no longer checked as one,
// or one that makes a loop with the drafts made since; and an unchecked Manager? while people report
// to the person.
async function refuseUndoneReporting(
  transaction: Transaction,
  editor: string,
  id: string,
  person: Recorded,
  putBack: ReadonlySet<string>,
  today: string,
  hiresUndone: readonly string[],
): Promise<void> {
  if (putBack.has("teamName") && typeof person.teamName === "string") {
    await refuseTakenTeamNames(transaction, [{ id, name: person.teamName }]);
  }
  // What a fill drafted sets on its person is kept until the fill is discarded, undone or decided.
  if (
    ["managerId", "managerFrom", "isManager"].some((field) =>
      putBack.has(field),
    ) &&
    (await hireDraftsNaming(transaction, "filledBy", [id], editor))
  ) {
    throw new ConflictError(partOfFill);
  }
  if (
    putBack.has("positionId") &&
    (await hireDraftsNaming(transaction, "filledBy", [id], editor, {
      except: hiresUndone,
    }))
  ) {
    throw new ConflictError(partOfFill);
  }
  if (
    (putBack.has("managerId") || putBack.has("managerFrom")) &&
    typeof person.managerFrom === "string"
  ) {
    if (typeof person.managerId === "string") {
      const manager = (await readManagers(transaction, [person.managerId])).get(
        person.managerId,
      );
      if (manager !== undefined && !manager.isManager) {
        throw new ConflictError(notMarked(manager));
      }
    }
    await refuseLoop(
      transaction,
      editor,
      id,
      typeof person.managerId === "string" ? person.managerId : null,
      person.managerFrom,
      today,
    );
  }
  if (putBack.has("isManager") && person.isManager !== true) {
    await refuseUnmarkingManagers(transaction, [id], today, { drafted: true });
    await refuseUnmarkingHireManagers(transaction, [id], {
      drafted: true,
      editor,
    });
  }
}

// A record's old values without the rejection a change cleared: undoing a change to a draft puts
// back the editor's unpublished draft, which is waiting once published, and the published draft
// keeps its rejection until then.
function withoutRejection(
  old: ReadonlyMap<string, unknown>,
): Map<string, unknown> {
  const kept = new Map(old);
  kept.delete(rejectedField);
  return kept;
}

// Puts back the drafts of the lists, choices, and choice orders a change set changed in their
// drafts, one at a time, in the order lists come before their choices: the record it drafted adding
// taken out, the one it drafted removing put back as it was, the fields it changed put back, with a
// rejection's reason, and an order as it was. Each must still have a name no one else has taken
// since, and belong to a list that is there to change.
async function undoListDrafts(
  transaction: Transaction,
  editor: string,
  records: readonly Undone[],
): Promise<void> {
  for (const record of [...records].sort((a, b) => byKind(a) - byKind(b))) {
    const state = await readState(transaction, editor);
    const old = withoutRejection(record.old);
    if (record.recordType === "choice-order") {
      // Every change to a draft of an order records the whole order.
      const wanted = ids(old.get("order"));
      if (draftedList(state, record.id) === undefined) {
        throw new ConflictError(changedSince);
      }
      await writeOrderDraft(transaction, editor, state, record.id, wanted);
      continue;
    }
    const isList = record.recordType === "list";
    const recordType = isList ? "list" : "list-item";
    const live = isList
      ? state.lists.get(record.id)
      : state.choices.get(record.id)?.record;
    const draft = (isList ? state.listDrafts : state.choiceDrafts).get(
      record.id,
    );
    const now = drafted(live, draft);
    let wanted: Recorded | undefined;
    if (record.action === "deleted") {
      wanted = Object.fromEntries(
        [...old].filter(([, value]) => value !== null),
      );
    } else if (record.action === "changed") {
      // Undoing is refused once anything changes the record since, so its draft is still there.
      wanted = { ...(now as Recorded), ...Object.fromEntries(old) };
    }
    if (isList) {
      // A list drafted to be added keeps its draft while choices are drafted into it.
      if (
        wanted === undefined &&
        live === undefined &&
        [...state.choiceDrafts.values()].some(
          ({ fields }) => fields.listId === record.id,
        )
      ) {
        throw new ConflictError(changedSince);
      }
      if (
        wanted !== undefined &&
        listNameTaken(state, String(wanted.name), record.id)
      ) {
        throw new ConflictError(changedSince);
      }
    } else if (wanted !== undefined) {
      // A choice always records its list.
      const listId = String(wanted.listId);
      if (
        !listExists(state, listId) ||
        draftedList(state, listId) === undefined ||
        choiceLabelTaken(state, listId, String(wanted.label), record.id)
      ) {
        throw new ConflictError(changedSince);
      }
    }
    // What drafting itself refuses: retiring, removing, or discarding a list a column draws on,
    // removing a list whose choices have drafts, and removing a choice that people have.
    if (isList && live === undefined && wanted === undefined) {
      await refuseIfUsed(transaction, record.id, "discarded", editor);
    }
    if (isList && live !== undefined) {
      if (wanted === undefined) {
        await refuseIfUsed(transaction, record.id, "deleted", editor);
        if (choicesHaveDrafts(state, record.id)) {
          throw new ConflictError(changedSince);
        }
      } else if (wanted.retired === true && now?.retired !== true) {
        await refuseIfUsed(transaction, record.id, "retired", editor);
      }
    }
    if (!isList && wanted === undefined) {
      await refuseIfChosen(transaction, record.id, editor);
    }
    if (!isList) {
      const listId = listOfChoice(state, record.id) ?? String(wanted?.listId);
      refuseLastKept(state, listId, record.id, wanted);
    }
    await writeDraft(transaction, editor, recordType, record.id, live, wanted);
  }
}

// Puts back the drafts of the columns and the column order a change set changed in their drafts, as
// for lists: the column it drafted adding taken out, the one it drafted removing put back as it
// was, the settings it changed put back, and an order as it was. Each must still have a name no one
// else has taken since, and draw on a list that is there.
async function undoColumnDrafts(
  transaction: Transaction,
  actor: Actor,
  records: readonly Undone[],
): Promise<void> {
  // Columns before the order, which may place them.
  const ordered = [
    ...records.filter(({ recordType }) => recordType === "field"),
    ...records.filter(({ recordType }) => recordType === "column-order"),
  ];
  const editor = actor.user.id;
  for (const record of ordered) {
    const state = await readColumnsState(transaction, editor);
    const old = withoutRejection(record.old);
    if (record.recordType === "column-order") {
      // Every change to the draft of the order records the whole order.
      const wanted = ids(old.get("order"));
      await writeColumnOrderDraft(transaction, editor, state, wanted);
      continue;
    }
    const live = state.fields.get(record.id);
    const draft = state.fieldDrafts.get(record.id);
    let wanted: Recorded | undefined;
    if (record.action === "deleted") {
      wanted = Object.fromEntries(
        [...old].filter(([, value]) => value !== null),
      );
    } else if (record.action === "changed") {
      wanted = {
        ...(drafted(live, draft) as Recorded),
        ...Object.fromEntries(old),
      };
    }
    // What drafting checks, checked again, since the data may have changed since.
    if (wanted !== undefined) {
      if (nameTaken(state, String(wanted.name), record.id)) {
        throw new ConflictError(changedSince);
      }
      const { listId } = typeOf(wanted).settings(wanted);
      if (listId !== null && listId !== live?.listId) {
        await checkList(
          transaction,
          state,
          listId,
          () => new ConflictError(changedSince),
        );
      }
      await checkValuesFit(
        transaction,
        columnRow(record.id, live ?? { ...wanted, required: false }),
        columnRow(record.id, wanted),
      );
    } else if (live !== undefined) {
      // Putting back a removal: the column's values go once approved, so as when drafting it, no
      // draft of a person may change it, and the actor must be able to change its values.
      const tier = columnTier(state, live);
      if (
        (await draftsUse(transaction, { column: record.id }, editor)) ||
        !actor.permissions.includes("people:edit") ||
        !seesSensitivity(actor, tier)
      ) {
        throw new ConflictError(changedSince);
      }
    } else if (await draftsUse(transaction, { column: record.id }, editor)) {
      // Taking out a column drafted to be added, which people's drafts give values in.
      throw new ConflictError(changedSince);
    }
    await writeDraft(transaction, editor, "field", record.id, live, wanted);
  }
}

const byKind = (record: Undone) => kindOrder.indexOf(record.recordType);

// The more sensitive of two tiers.
const higher = (first: Tier, second: Tier): Tier =>
  mostSensitive([first, second]);

// The identifiers of the records of one kind.
const idsOf = (records: readonly Undone[], kind: RecordType) =>
  records.filter((record) => record.recordType === kind).map(({ id }) => id);

// Locks every record the undo changes that still exists, in the order other changes lock them:
// lists, then their choices, then columns, then the column order, then people, then saved views. A
// change saved at the same moment either finishes first, and is then seen as a change since, or
// waits for the undo.
async function lockRecords(
  transaction: Transaction,
  records: readonly Undone[],
): Promise<void> {
  const choiceIds = idsOf(records, "list-item");
  const choiceLists = await transaction
    .select({ listId: listItems.listId })
    .from(listItems)
    .where(inArray(listItems.id, choiceIds));
  const listIds = [
    ...idsOf(records, "list"),
    ...choiceLists.map(({ listId }) => listId),
    // A deleted choice's list, which the undo puts it back in.
    ...records.flatMap((record) => {
      const listId = record.old.get("listId");
      return record.recordType === "list-item" && typeof listId === "string"
        ? [listId]
        : [];
    }),
  ];
  await transaction
    .select({ id: lists.id })
    .from(lists)
    .where(inArray(lists.id, [...new Set(listIds)]))
    .orderBy(asc(lists.id))
    .for("update");
  await transaction
    .select({ id: listItems.id })
    .from(listItems)
    .where(inArray(listItems.id, choiceIds))
    .orderBy(asc(listItems.id))
    .for("update");
  await lockFields(transaction);
  if (idsOf(records, "column-order").length > 0) {
    await transaction
      .select({ tableName: columnOrders.tableName })
      .from(columnOrders)
      .for("update");
  }
  await transaction
    .select({ id: people.id })
    .from(people)
    .where(inArray(people.id, idsOf(records, "person")))
    .orderBy(asc(people.id))
    .for("update");
  await transaction
    .select({ id: savedViews.id })
    .from(savedViews)
    .where(inArray(savedViews.id, idsOf(records, "saved-view")))
    .orderBy(asc(savedViews.id))
    .for("update");
}

async function undoIn(
  transaction: Transaction,
  actor: Actor,
  changeSetId: string,
): Promise<string | null> {
  const [changeSet] = await transaction
    .select()
    .from(changeSets)
    .where(eq(changeSets.id, changeSetId));
  // Unpublished changes are seen only by their maker, so for anyone else they are not there.
  if (
    changeSet === undefined ||
    (changeSet.unpublished && changeSet.madeBy !== actor.user.id)
  ) {
    throw new NotFoundError();
  }
  if (changeSet.madeBy !== actor.user.id) {
    throw new ForbiddenError("Only the person who made a change can undo it");
  }
  if (changeSet.kind === "approval" || changeSet.kind === "rejection") {
    throw new ConflictError(
      "Approving and rejecting drafts cannot be undone; change the draft or the data instead",
    );
  }
  // Undoing the same change twice at once: the second waits, then finds the first's changes since.
  await transaction.execute(
    sql`SELECT pg_advisory_xact_lock(hashtextextended(${changeSetId}, 0))`,
  );
  const rows = await transaction
    .select()
    .from(changes)
    .where(eq(changes.changeSetId, changeSetId))
    .orderBy(asc(changes.id));
  const records = recordsOf(rows);
  if (records.some(({ recordType }) => planRecordTypes.has(recordType))) {
    throw new ConflictError(
      "Changes to release streams and releases cannot be undone yet; change or discard the draft instead",
    );
  }
  for (const record of records) {
    for (const permission of editPermissions[
      record.recordType as keyof typeof editPermissions
    ]) {
      requirePermission(actor, permission);
    }
  }
  const draftRecords = records.filter(({ draft }) => draft);
  const liveRecords = records.filter(({ draft }) => !draft);
  // Drafts are locked before any row, as every change to them does, so an undo that changes a
  // draft, or removes a choice or column one could be given, waits for them.
  await lockDrafts(transaction);
  await lockRecords(transaction, records);
  // A person's details are as sensitive as they are now, such as a position or a column's values
  // as their list, or were when they changed, whichever is more sensitive, as are a hire's, whose
  // own details need Edit Hiring plan instead.
  const tierNow = personTier(await columnsWithAdded(transaction, undefined));
  const hireTierNow = await readHireTier(transaction);
  // So is a saved view's history, as sensitive as the columns it uses are now.
  const viewTiers = new Map<string, Tier>();
  for (const record of records) {
    if (record.recordType === "saved-view") {
      const held = rows
        .filter(
          (row) => row.recordId === record.id && row.field === "definition",
        )
        .flatMap((row) => [row.oldValue, row.newValue]);
      viewTiers.set(record.id, await viewTierNow(transaction, record.id, held));
    }
  }
  const undoing = reversed(rows).map((change) => {
    if (change.recordType === "person") {
      return { ...change, tier: higher(change.tier, tierNow(change.field)) };
    }
    if (change.recordType === "planned-hire") {
      return {
        ...change,
        tier: higher(change.tier, hireTierNow(change.field)),
      };
    }
    return change.recordType === "saved-view"
      ? {
          ...change,
          // Every view the change set changed has its tier, found just above.
          tier: higher(change.tier, viewTiers.get(change.recordId) as Tier),
        }
      : change;
  });
  // Each tier is its own permission, so the actor needs every tier a change had and has now, not
  // only the most sensitive. A view's tier is that of the columns it uses, which its maker needs
  // only to see.
  const tiersOf = (change: StoredChange): Sensitivity[] => {
    const recorded = storedTier(change.tier);
    if (change.recordType === "person") {
      return [recorded, tierNow(change.field)];
    }
    if (change.recordType === "planned-hire") {
      return hireSensitivities(change.field, [
        recorded,
        hireTierNow(change.field),
      ]);
    }
    if (change.recordType === "saved-view") {
      return [recorded, viewTiers.get(change.recordId) as Tier];
    }
    return [recorded];
  };
  for (const change of rows) {
    for (const tier of new Set(tiersOf(change))) {
      if (change.recordType === "saved-view") {
        if (!seesSensitivity(actor, tier)) throw new ForbiddenError();
      } else if (tier !== "general") {
        requireSensitivityEdit(actor, tier);
      }
    }
  }
  for (const record of records) {
    if (record.recordType === "saved-view") {
      await requireViewUndo(transaction, actor, record.id, record.old);
    }
  }
  // Only changes the user may see count: another user's unpublished changes stay theirs, and a
  // record they hold refuses the undo for that reason instead.
  const later = await transaction
    .select({ id: changes.id })
    .from(changes)
    .innerJoin(changeSets, eq(changeSets.id, changes.changeSetId))
    .where(
      and(
        gt(changes.id, Math.max(...rows.map(({ id }) => id))),
        or(
          eq(changeSets.unpublished, false),
          eq(changeSets.madeBy, actor.user.id),
        ),
        or(
          ...records.map((record) =>
            and(
              eq(changes.recordType, record.recordType),
              eq(changes.recordId, record.id),
            ),
          ),
        ),
      ),
    )
    .limit(1);
  if (later.length > 0) throw new ConflictError(changedSince);
  // Sending rejected drafts again changed the published drafts, so undoing it rejects them again.
  if (changeSet.kind === "resubmission") {
    for (const record of draftRecords) {
      await setRejection(
        transaction,
        record.recordType as DraftKind,
        [record.id],
        {
          state: "rejected",
          reason: String(record.old.get(rejectedField)),
        },
      );
    }
    await recordSensitiveChanges(transaction, actor.user.id, undoing);
    await recordHiringChanges(transaction, actor.user.id, undoing);
    return recordChanges(transaction, actor, undoing, "edit", false);
  }

  const ascending = [...liveRecords].sort((a, b) => byKind(a) - byKind(b));
  for (const record of ascending.filter(({ action }) => action === "deleted")) {
    await recreate(transaction, record);
  }
  for (const record of ascending.filter(({ action }) => action === "changed")) {
    await restore(transaction, record);
  }
  const created = ascending.filter(({ action }) => action === "created");
  // People added together, such as pasted rows, are removed in one statement.
  const addedPeople = idsOf(created, "person");
  await transaction.delete(people).where(inArray(people.id, addedPeople));
  for (const record of created
    .filter((record) => record.recordType !== "person")
    .reverse()) {
    await remove(transaction, record);
  }
  const personDrafts = draftRecords.filter(
    ({ recordType }) => recordType === "person",
  );
  const hireDrafts = draftRecords.filter(
    ({ recordType }) => recordType === "planned-hire",
  );
  const teamDrafts = draftRecords.filter(
    ({ recordType }) => recordType === "feature-team",
  );
  if (teamDrafts.length > 0) {
    await undoTeamDrafts(transaction, actor, teamDrafts, changedSince);
  }
  const columnKinds: readonly RecordType[] = ["field", "column-order"];
  const columnDrafts = draftRecords.filter(({ recordType }) =>
    columnKinds.includes(recordType),
  );
  const listKinds: readonly RecordType[] = [
    "list",
    "list-item",
    "choice-order",
  ];
  const listDrafts = draftRecords.filter(({ recordType }) =>
    listKinds.includes(recordType),
  );
  if (listDrafts.length > 0) {
    await undoListDrafts(transaction, actor.user.id, listDrafts);
    await removeEmptyOrders(transaction, actor.user.id);
  }
  if (columnDrafts.length > 0) {
    await undoColumnDrafts(transaction, actor, columnDrafts);
    await removeEmptyColumnOrder(transaction, actor.user.id);
  }
  // Hires come before people, so undoing a fill puts a planned manager's hires back under it before
  // its person's Manager? mark comes off.
  if (hireDrafts.length > 0) {
    await undoHireDrafts(transaction, actor.user.id, hireDrafts, changedSince);
  }
  if (personDrafts.length > 0) {
    await undoPersonDrafts(
      transaction,
      actor.user.id,
      await columnsWithAdded(transaction, actor.user.id),
      personDrafts,
      hireDrafts.map(({ id }) => id),
    );
  }
  // The people put back must still fit their columns as they are now.
  const restored = liveRecords.filter(
    (record) => record.recordType === "person" && record.action !== "created",
  );
  if (
    !(await peopleFitColumns(
      transaction,
      restored.map(({ id }) => id),
    ))
  ) {
    throw new ConflictError(changedSince);
  }
  await recordSensitiveChanges(transaction, actor.user.id, undoing);
  await recordHiringChanges(transaction, actor.user.id, undoing);
  await recordTeamDayChanges(transaction, actor.user.id, undoing);
  return recordChanges(transaction, actor, undoing);
}

// Undoes a change set the actor made, and returns the change set that undid it.
export async function undoChangeSet(
  database: Database,
  actor: Actor,
  changeSetId: string,
): Promise<string | null> {
  try {
    return await database.transaction((transaction) =>
      undoIn(transaction, actor, changeSetId),
    );
  } catch (error) {
    // Something the undo would put back conflicts with a change made since, such as a name now
    // taken or a choice now deleted.
    if (
      [
        databaseCodes.uniqueViolation,
        databaseCodes.foreignKeyViolation,
        databaseCodes.restrictViolation,
        databaseCodes.checkViolation,
      ].some((code) => hasDatabaseCode(error, code))
    ) {
      throw new ConflictError(changedSince);
    }
    throw error;
  }
}
