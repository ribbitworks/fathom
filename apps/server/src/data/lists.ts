// SPDX-License-Identifier: Apache-2.0

// Lists of choices that people define, and their choices: reading them, with their drafts in place,
// and drafting lists created, edited, retired, restored, and deleted, choices added one at a time or
// several at once, edited, retired, restored, and removed, and new orders of a list's choices; and
// discarding drafts and sending rejected ones for approval again. Part of the data access layer, the
// only server code that queries the database; the caller checks the actor's permissions. Every
// change is a draft, as drafts.ts sets out, which reaches the live lists only once approved, as
// list-approvals.ts sets out, and is recorded in the change history, field by field. A draft of a
// list's order holds the whole order of its choices.

import {
  type Database,
  drafts,
  fields,
  fieldValues,
  listItems,
  lists,
} from "@fathom/db";
import type {
  Choice,
  ChoiceDraft,
  ChoiceRequest,
  List,
  ListDraft,
  ListRequest,
  OrderDraft,
} from "@fathom/shared";
import { tierSchema } from "@fathom/shared";
import { asc, count, eq, sql } from "drizzle-orm";
import { randomUUID } from "node:crypto";
import { BadRequestError, ConflictError, NotFoundError } from "../errors.ts";
import {
  type Change,
  changesBetween,
  recordChanges,
  type Saved,
  type Transaction,
} from "./changes.ts";
import {
  asDraft,
  clearedRejection,
  deleteDrafts,
  type Draft,
  drafted,
  draftFields,
  draftMakers,
  draftsUse,
  type DraftType,
  lockDrafts,
  type Maker,
  readDrafts,
  type Recorded,
  type Rejection,
  setRejection,
  writeDraft,
} from "./drafts.ts";

type ListRow = typeof lists.$inferSelect;
type ChoiceRow = typeof listItems.$inferSelect;
type Reader = Pick<Database, "select">;

const noList = "There is no such list";
const noChoice = "There is no such choice";
const duplicateList = "There is already a list with that name";
const duplicateChoice = "This list already has a choice with that name";
const listToBeRemoved =
  "This list's draft removes it; discard the draft to change it";
const choiceToBeRemoved =
  "This choice's draft removes it; discard the draft to change it";
const noDraft = "There is no such draft";

export const listFields = [
  "name",
  "description",
  "visibility",
  "retired",
] as const;
// A choice records its list too, so its history can be tied back to the list after either is deleted.
export const choiceFields = [
  "listId",
  "label",
  "description",
  "retired",
] as const;

// The details of lists and choices are General data, whatever the visibility of the values chosen
// from a list.
export const listChanges = (
  id: string,
  action: Change["action"],
  before: Recorded | undefined,
  after: Recorded | undefined,
) => changesBetween("list", id, action, before, after, listFields);
export const choiceChanges = (
  id: string,
  action: Change["action"],
  before: Recorded | undefined,
  after: Recorded | undefined,
) => changesBetween("list-item", id, action, before, after, choiceFields);

// The change that records a new order of a list's choices: the whole order before and after.
export function orderChanges(
  listId: string,
  before: readonly string[],
  after: readonly string[],
): Change[] {
  return before.join() === after.join()
    ? []
    : [
        {
          recordType: "choice-order",
          recordId: listId,
          action: "changed",
          field: "order",
          tier: "general",
          oldValue: [...before],
          newValue: [...after],
        },
      ];
}

export const listRecord = (row: ListRow): Recorded => ({
  name: row.name,
  description: row.description,
  visibility: row.visibility,
  retired: row.retired,
});

export const choiceRecord = (row: ChoiceRow): Recorded => ({
  listId: row.listId,
  label: row.label,
  description: row.description,
  retired: row.retired,
});

// Every list and choice, live and in drafts, and each list's draft of its order, read together.
export interface ListsState {
  lists: Map<string, Recorded>;
  choices: Map<string, { record: Recorded; position: number }>;
  listDrafts: Map<string, Draft>;
  choiceDrafts: Map<string, Draft>;
  orderDrafts: Map<string, Draft>;
}

export async function readState(reader: Reader): Promise<ListsState> {
  const listRows = await reader.select().from(lists).orderBy(asc(lists.id));
  const choiceRows = await reader
    .select()
    .from(listItems)
    .orderBy(asc(listItems.position), asc(listItems.id));
  return {
    lists: new Map(listRows.map((row) => [row.id, listRecord(row)])),
    choices: new Map(
      choiceRows.map((row) => [
        row.id,
        { record: choiceRecord(row), position: row.position },
      ]),
    ),
    listDrafts: await readDrafts(reader, "list"),
    choiceDrafts: await readDrafts(reader, "list-item"),
    orderDrafts: await readDrafts(reader, "choice-order"),
  };
}

// A list or choice as its draft makes it: undefined once removed, or before it is added.
export const draftedList = (state: ListsState, id: string) =>
  drafted(state.lists.get(id), state.listDrafts.get(id));

export const draftedChoice = (state: ListsState, id: string) =>
  drafted(state.choices.get(id)?.record, state.choiceDrafts.get(id));

// Whether a list or choice is live, or drafted to be added.
export const listExists = (state: ListsState, id: string) =>
  state.lists.has(id) || state.listDrafts.get(id)?.action === "created";

const choiceExists = (state: ListsState, id: string) =>
  state.choices.has(id) || state.choiceDrafts.get(id)?.action === "created";

// The list a choice belongs to, live or as drafted to be added.
export function listOfChoice(
  state: ListsState,
  id: string,
): string | undefined {
  return (state.choices.get(id)?.record.listId ??
    state.choiceDrafts.get(id)?.fields.listId) as string | undefined;
}

// A list's live choices, in order.
export const liveOrder = (state: ListsState, listId: string): string[] =>
  [...state.choices]
    .filter(([, { record }]) => record.listId === listId)
    .map(([id]) => id);

// A list's choices drafted to be added, in the order they were drafted.
export const addedChoices = (state: ListsState, listId: string): string[] =>
  [...state.choiceDrafts]
    .filter(
      ([id, draft]) =>
        draft.action === "created" &&
        !state.choices.has(id) &&
        draft.fields.listId === listId,
    )
    .map(([id]) => id);

// The order a list's draft of its order holds, of choices that still exist.
export function heldOrder(
  state: ListsState,
  listId: string,
): string[] | undefined {
  const draft = state.orderDrafts.get(listId);
  if (draft === undefined) return undefined;
  return (draft.fields.order as string[]).filter(
    (id) => choiceExists(state, id) && listOfChoice(state, id) === listId,
  );
}

// A list's choices in order, as its draft of the order, if any, makes it: those it places, then the
// live ones it does not, in their live order, then those drafted to be added, in the order drafted.
export function draftedOrder(state: ListsState, listId: string): string[] {
  const held = heldOrder(state, listId) ?? [];
  const rest = [
    ...liveOrder(state, listId),
    ...addedChoices(state, listId),
  ].filter((id) => !held.includes(id));
  return [...held, ...rest];
}

// The order to hold in a draft for a list's choices to be in the order wanted: choices drafted to
// be added that end the order in the order they were drafted are left for the reading to put
// there, so the draft does not use their drafts. Undefined when the order wanted is the live one.
export function orderToHold(
  state: ListsState,
  listId: string,
  wanted: readonly string[],
): string[] | undefined {
  const added = addedChoices(state, listId);
  // The longest ending of the order made only of choices drafted to be added, in the order drafted.
  let kept = wanted.length;
  let next = Infinity;
  for (const id of [...wanted].reverse()) {
    const at = added.indexOf(id);
    if (at === -1 || at > next) break;
    next = at;
    kept -= 1;
  }
  const held = wanted.slice(0, kept);
  return held.join() === liveOrder(state, listId).join() ? undefined : held;
}

// Keeps a list's draft of its order as needed for the order wanted, or removes it.
export async function writeOrderDraft(
  transaction: Transaction,
  state: ListsState,
  listId: string,
  wanted: readonly string[],
  rejection?: Rejection,
): Promise<void> {
  const held = orderToHold(state, listId, wanted);
  await writeDraft(
    transaction,
    "choice-order",
    listId,
    { order: liveOrder(state, listId) },
    { order: held ?? liveOrder(state, listId) },
    rejection,
  );
}

// The choices drafted to be added that a list's draft of its order uses, by placing them.
export function choicesOrderUses(state: ListsState, listId: string): string[] {
  return (heldOrder(state, listId) ?? []).filter(
    (id) => !state.choices.has(id),
  );
}

const lower = (value: unknown) => String(value).trim().toLowerCase();

// Whether another list has the name, live or in a draft: a live list's name stays taken until a
// draft that changes it is approved.
export function listNameTaken(
  state: ListsState,
  name: string,
  except?: string,
): boolean {
  const wanted = lower(name);
  return (
    [...state.lists].some(
      ([id, record]) => id !== except && lower(record.name) === wanted,
    ) ||
    [...state.listDrafts].some(
      ([id, draft]) =>
        id !== except &&
        draft.fields.name !== undefined &&
        lower(draft.fields.name) === wanted,
    )
  );
}

// Whether another choice in the list has the label, live or in a draft, as for lists' names.
export function choiceLabelTaken(
  state: ListsState,
  listId: string,
  label: string,
  except?: string,
): boolean {
  const wanted = lower(label);
  return (
    [...state.choices].some(
      ([id, { record }]) =>
        id !== except &&
        record.listId === listId &&
        lower(record.label) === wanted,
    ) ||
    [...state.choiceDrafts].some(
      ([id, draft]) =>
        id !== except &&
        listOfChoice(state, id) === listId &&
        draft.fields.label !== undefined &&
        lower(draft.fields.label) === wanted,
    )
  );
}

// Whether any of a list's choices, or their order, has a draft.
export const choicesHaveDrafts = (state: ListsState, listId: string) =>
  state.orderDrafts.has(listId) ||
  [...state.choiceDrafts.keys()].some(
    (id) => listOfChoice(state, id) === listId,
  );

// Refuses a change to a list while a column draws on it, naming the columns.
export async function refuseIfUsed(
  transaction: Reader,
  id: string,
  change: string,
): Promise<void> {
  const users = await transaction
    .select({ name: fields.name })
    .from(fields)
    .where(eq(fields.listId, id))
    .orderBy(asc(sql`lower(${fields.name})`));
  if (users.length > 0) {
    const names = users.map(({ name }) => name).join(", ");
    throw new ConflictError(
      `This list cannot be ${change} while ${users.length === 1 ? "a column draws" : "columns draw"} on it: ${names}`,
    );
  }
}

export const choiceInUse =
  "This choice cannot be removed while it is in use; retire it instead";

// Refuses removing a choice that people have, live or in a draft.
export async function refuseIfChosen(
  transaction: Reader,
  id: string,
): Promise<void> {
  const [held] = await transaction
    .select({ total: count() })
    .from(fieldValues)
    .where(eq(fieldValues.choiceId, id));
  if (
    Number(held?.total) > 0 ||
    (await draftsUse(transaction, { choice: id }))
  ) {
    throw new ConflictError(choiceInUse);
  }
}

// Every choice in a list, locked, in order.
export async function lockChoices(
  transaction: Transaction,
  listId: string,
): Promise<ChoiceRow[]> {
  return transaction
    .select()
    .from(listItems)
    .where(eq(listItems.listId, listId))
    .orderBy(asc(listItems.position), asc(listItems.id))
    .for("update");
}

// Puts a live choice just after another in the list, or at the top or end, renumbering the list.
// Only undoing changes saved before lists had drafts moves a live choice on its own.
export async function placeChoice(
  transaction: Transaction,
  listId: string,
  id: string,
  where: { after: string | null } | "end",
): Promise<void> {
  const rows = await lockChoices(transaction, listId);
  const others = rows.filter((row) => row.id !== id);
  let at = others.length;
  if (where !== "end") {
    at =
      where.after === null
        ? 0
        : others.findIndex((row) => row.id === where.after) + 1;
  }
  const ordered = [
    ...others.slice(0, at),
    ...rows.filter((row) => row.id === id),
    ...others.slice(at),
  ];
  await writePositions(
    transaction,
    rows,
    ordered.map(({ id: choiceId }) => choiceId),
  );
}

// Numbers a list's live choices in the order given, saving each position that changes.
export async function writePositions(
  transaction: Transaction,
  rows: readonly { id: string; position: number }[],
  order: readonly string[],
): Promise<void> {
  for (const [index, choiceId] of order.entries()) {
    if (rows.find(({ id }) => id === choiceId)?.position !== index + 1) {
      await transaction
        .update(listItems)
        .set({ position: index + 1 })
        .where(eq(listItems.id, choiceId));
    }
  }
}

function draftOut<Live extends Record<string, unknown>>(
  fieldNames: readonly string[],
  live: Recorded | undefined,
  draft: Draft,
  maker: Maker | undefined,
) {
  // In the record's own order, since drafts are stored without one.
  const touched = draftFields(live, draft);
  const changed = fieldNames.filter((field) => touched.includes(field));
  return {
    action: draft.action,
    changed,
    live: (live === undefined
      ? {}
      : Object.fromEntries(
          // The fields are the record's own, named just above.
          // eslint-disable-next-line security/detect-object-injection
          changed.map((field) => [field, live[field]]),
        )) as Partial<Live>,
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

const shownChoiceFields = ["label", "description", "retired"] as const;

interface Makers {
  list: Map<string, Maker>;
  choice: Map<string, Maker>;
  order: Map<string, Maker>;
}

function choiceOut(state: ListsState, makers: Makers, id: string): Choice {
  const live = state.choices.get(id)?.record;
  const draft = state.choiceDrafts.get(id);
  // A draft that removes a choice shows it as it is. A list's drafted order holds only choices that
  // are live or drafted to be added.
  const choice = (drafted(live, draft) ?? live) as Recorded;
  return {
    id,
    label: String(choice.label),
    description: String(choice.description),
    retired: choice.retired === true,
    ...(draft === undefined
      ? {}
      : {
          draft: draftOut<ChoiceDraft["live"]>(
            shownChoiceFields,
            live,
            draft,
            makers.choice.get(id),
          ),
        }),
  };
}

const byName = new Intl.Collator("en", { sensitivity: "base" });

// The lists, by name, as their drafts make them, each with its choices in order and the drafts
// beside. A draft that removes a list or choice shows it as it is.
export function listsOut(state: ListsState, makers: Makers): List[] {
  const ids = [
    ...state.lists.keys(),
    ...[...state.listDrafts.keys()].filter((id) => !state.lists.has(id)),
  ];
  const shown = ids.flatMap((id): List[] => {
    const live = state.lists.get(id);
    const draft = state.listDrafts.get(id);
    const list = drafted(live, draft) ?? live;
    if (list === undefined) return [];
    const orderDraft = state.orderDrafts.get(id);
    // A draft of the order that no longer changes it is not shown.
    const order: OrderDraft | undefined =
      orderDraft === undefined ||
      orderToHold(state, id, draftedOrder(state, id)) === undefined
        ? undefined
        : {
            live: liveOrder(state, id),
            uses: choicesOrderUses(state, id),
            state: orderDraft.state,
            ...(orderDraft.state === "rejected" && orderDraft.reason !== null
              ? { reason: orderDraft.reason }
              : {}),
            madeBy: makers.order.get(id)?.madeBy ?? null,
            madeAt: makers.order.get(id)?.madeAt.toISOString() ?? null,
            editors: makers.order.get(id)?.editors ?? [],
          };
    return [
      {
        id,
        name: String(list.name),
        description: String(list.description),
        // A tier the server no longer knows is treated as General rather than trusted.
        visibility: tierSchema.catch("general").parse(list.visibility),
        retired: list.retired === true,
        choices: draftedOrder(state, id).map((choiceId) =>
          choiceOut(state, makers, choiceId),
        ),
        ...(draft === undefined
          ? {}
          : {
              draft: draftOut<ListDraft["live"]>(
                listFields,
                live,
                draft,
                makers.list.get(id),
              ),
            }),
        ...(order === undefined ? {} : { orderDraft: order }),
      },
    ];
  });
  return shown.sort(
    (a, b) => byName.compare(a.name, b.name) || a.id.localeCompare(b.id),
  );
}

async function readMakers(
  reader: Pick<Database, "select">,
  state: ListsState,
): Promise<Makers> {
  return {
    list: await draftMakers(reader, "list", [...state.listDrafts.keys()]),
    choice: await draftMakers(reader, "list-item", [
      ...state.choiceDrafts.keys(),
    ]),
    order: await draftMakers(reader, "choice-order", [
      ...state.orderDrafts.keys(),
    ]),
  };
}

// Every list by name, ignoring letter case, as its draft makes it, each with its choices in order.
export async function readLists(database: Database): Promise<List[]> {
  // Lists and their drafts are read as of one moment, so an approval saved meanwhile is seen whole
  // or not at all.
  return database.transaction(
    async (transaction) => {
      const state = await readState(transaction);
      return listsOut(state, await readMakers(transaction, state));
    },
    { isolationLevel: "repeatable read", accessMode: "read only" },
  );
}

// The list as it is now read, with its drafts.
async function listNow(transaction: Transaction, id: string): Promise<List> {
  const state = await readState(transaction);
  // The list was just saved, so is there.
  return listsOut(state, await readMakers(transaction, state)).find(
    (other) => other.id === id,
  ) as List;
}

// Runs a change to drafts of lists, after every other change to drafts, with the lists as they are.
async function drafting<Result>(
  database: Database,
  change: (transaction: Transaction, state: ListsState) => Promise<Result>,
): Promise<Result> {
  return database.transaction(async (transaction) => {
    await lockDrafts(transaction);
    return change(transaction, await readState(transaction));
  });
}

// A list as its draft makes it, refusing one that does not exist or is drafted to be removed.
function changeableList(state: ListsState, id: string): Recorded {
  if (!listExists(state, id)) throw new NotFoundError(noList);
  const list = draftedList(state, id);
  if (list === undefined) throw new ConflictError(listToBeRemoved);
  return list;
}

// A choice in the list as its draft makes it, refusing one that does not exist or that it, or its
// list, is drafted to remove.
function changeableChoice(
  state: ListsState,
  listId: string,
  id: string,
): Recorded {
  changeableList(state, listId);
  if (!choiceExists(state, id) || listOfChoice(state, id) !== listId) {
    throw new NotFoundError(noChoice);
  }
  const choice = draftedChoice(state, id);
  if (choice === undefined) throw new ConflictError(choiceToBeRemoved);
  return choice;
}

// Saves a list's or choice's draft as wanted and records the changes, clearing a rejection.
async function saveDraft(
  transaction: Transaction,
  madeBy: string,
  recordType: "list" | "list-item",
  id: string,
  live: Recorded | undefined,
  before: Recorded | undefined,
  after: Recorded | undefined,
  draft: Draft | undefined,
): Promise<string | null> {
  const toRecord = recordType === "list" ? listChanges : choiceChanges;
  let action: Change["action"] = "changed";
  if (before === undefined) action = "created";
  else if (after === undefined) action = "deleted";
  const made = asDraft(toRecord(id, action, before, after));
  if (made.length === 0) return null;
  await writeDraft(transaction, recordType, id, live, after);
  return recordChanges(transaction, madeBy, [
    ...made,
    ...clearedRejection(id, () => "general", live, draft, recordType),
  ]);
}

export async function createList(
  database: Database,
  madeBy: string,
  request: ListRequest,
): Promise<Saved<List>> {
  return drafting(database, async (transaction, state) => {
    if (listNameTaken(state, request.name)) {
      throw new ConflictError(duplicateList);
    }
    const id = randomUUID();
    const changeSetId = await saveDraft(
      transaction,
      madeBy,
      "list",
      id,
      undefined,
      undefined,
      { ...request, retired: false },
      undefined,
    );
    return { result: await listNow(transaction, id), changeSetId };
  });
}

// Drafts a change to a list's settings, or to whether it is retired.
async function changeList(
  database: Database,
  madeBy: string,
  id: string,
  change: (
    transaction: Transaction,
    state: ListsState,
    list: Recorded,
  ) => Promise<Recorded>,
): Promise<Saved<List>> {
  return drafting(database, async (transaction, state) => {
    const list = changeableList(state, id);
    const after = await change(transaction, state, list);
    const changeSetId = await saveDraft(
      transaction,
      madeBy,
      "list",
      id,
      state.lists.get(id),
      list,
      after,
      state.listDrafts.get(id),
    );
    return { result: await listNow(transaction, id), changeSetId };
  });
}

export async function updateList(
  database: Database,
  madeBy: string,
  id: string,
  request: ListRequest,
): Promise<Saved<List>> {
  return changeList(database, madeBy, id, async (_transaction, state, list) => {
    if (listNameTaken(state, request.name, id)) {
      throw new ConflictError(duplicateList);
    }
    return Promise.resolve({ ...list, ...request });
  });
}

// Drafts retiring or restoring a list. A list cannot be retired while a column draws on it.
export async function setListRetired(
  database: Database,
  madeBy: string,
  id: string,
  retired: boolean,
): Promise<string | null> {
  return (
    await changeList(
      database,
      madeBy,
      id,
      async (transaction, _state, list) => {
        if (retired && list.retired !== true) {
          await refuseIfUsed(transaction, id, "retired");
        }
        return { ...list, retired };
      },
    )
  ).changeSetId;
}

// The changes that discard a list's draft, and, for a list only drafted to be added, the drafts of
// its choices and their order, with each one's rejection cleared.
function discardingList(state: ListsState, id: string): Change[] {
  const draft = state.listDrafts.get(id) as Draft;
  const live = state.lists.get(id);
  const list = draftedList(state, id);
  const made = [
    ...asDraft(listChanges(id, actionTo(list, live), list, live)),
    ...clearedRejection(id, () => "general", live, draft, "list"),
  ];
  if (live !== undefined) return made;
  for (const choiceId of addedChoices(state, id)) {
    made.push(...discardingChoice(state, choiceId));
  }
  if (state.orderDrafts.has(id)) made.push(...discardingOrder(state, id));
  return made;
}

// The action that takes a record from one version to another.
function actionTo(
  before: Recorded | undefined,
  after: Recorded | undefined,
): Change["action"] {
  if (before === undefined) return "created";
  return after === undefined ? "deleted" : "changed";
}

function discardingChoice(state: ListsState, id: string): Change[] {
  const draft = state.choiceDrafts.get(id) as Draft;
  const live = state.choices.get(id)?.record;
  const choice = draftedChoice(state, id);
  return [
    ...asDraft(choiceChanges(id, actionTo(choice, live), choice, live)),
    ...clearedRejection(id, () => "general", live, draft, "list-item"),
  ];
}

function discardingOrder(state: ListsState, listId: string): Change[] {
  const draft = state.orderDrafts.get(listId) as Draft;
  const natural = [...liveOrder(state, listId), ...addedChoices(state, listId)];
  return [
    ...asDraft(orderChanges(listId, draftedOrder(state, listId), natural)),
    ...clearedRejection(
      listId,
      () => "general",
      undefined,
      draft,
      "choice-order",
    ),
  ];
}

// Removes the drafts the changes discard: each record's whose changes are recorded.
async function removeDiscarded(
  transaction: Transaction,
  made: readonly Change[],
): Promise<void> {
  const seen = new Set<string>();
  for (const { recordType, recordId } of made) {
    const key = `${recordType} ${recordId}`;
    if (seen.has(key)) continue;
    seen.add(key);
    await deleteDrafts(transaction, recordType as DraftType, [recordId]);
  }
  await removeEmptyOrders(transaction);
}

// Removes drafts of lists' orders that no longer change anything, as when the choice drafted to be
// added that one placed is discarded. They hold nothing to approve, so nothing is recorded.
export async function removeEmptyOrders(
  transaction: Transaction,
): Promise<void> {
  const state = await readState(transaction);
  const empty = [...state.orderDrafts.keys()].filter(
    (listId) =>
      orderToHold(state, listId, draftedOrder(state, listId)) === undefined,
  );
  await deleteDrafts(transaction, "choice-order", empty);
}

// Drafts deleting a list and its choices; deleting a list only drafted to be added discards its
// draft, and those of its choices. A list cannot be deleted while a column draws on it, or drafted
// to be deleted while its choices or their order have drafts.
export async function deleteList(
  database: Database,
  madeBy: string,
  id: string,
): Promise<string | null> {
  return drafting(database, async (transaction, state) => {
    const list = changeableList(state, id);
    const live = state.lists.get(id);
    if (live === undefined) {
      const made = discardingList(state, id);
      await removeDiscarded(transaction, made);
      return recordChanges(transaction, madeBy, made, "discard");
    }
    await refuseIfUsed(transaction, id, "deleted");
    if (choicesHaveDrafts(state, id)) {
      throw new ConflictError(
        "This list's choices have drafts; approve or discard them before deleting the list",
      );
    }
    return saveDraft(
      transaction,
      madeBy,
      "list",
      id,
      live,
      list,
      undefined,
      state.listDrafts.get(id),
    );
  });
}

// Drafts adding choices to the end of a list, in the order given, all saved together.
export async function addChoices(
  database: Database,
  madeBy: string,
  listId: string,
  requests: readonly ChoiceRequest[],
): Promise<Saved<Choice[]>> {
  return drafting(database, async (transaction, state) => {
    changeableList(state, listId);
    const labels = requests.map(({ label }) => lower(label));
    if (
      new Set(labels).size !== labels.length ||
      requests.some(({ label }) => choiceLabelTaken(state, listId, label))
    ) {
      throw new ConflictError(duplicateChoice);
    }
    const added = requests.map((request) => ({
      id: randomUUID(),
      record: {
        listId,
        label: request.label,
        description: request.description,
        retired: false,
      },
    }));
    // Drafts made together, in one statement, keep the order given.
    await transaction.insert(drafts).values(
      added.map(({ id, record }) => ({
        recordType: "list-item",
        recordId: id,
        action: "created",
        fields: record,
      })),
    );
    const changeSetId = await recordChanges(
      transaction,
      madeBy,
      asDraft(
        added.flatMap(({ id, record }) =>
          choiceChanges(id, "created", undefined, record),
        ),
      ),
    );
    const list = await listNow(transaction, listId);
    return {
      result: added.map(
        ({ id }) => list.choices.find((choice) => choice.id === id) as Choice,
      ),
      changeSetId,
    };
  });
}

// Drafts a change to a choice's details, or to whether it is retired. A restored choice keeps its
// place.
async function changeChoice(
  database: Database,
  madeBy: string,
  listId: string,
  id: string,
  change: (state: ListsState, choice: Recorded) => Recorded,
): Promise<Saved<Choice>> {
  return drafting(database, async (transaction, state) => {
    const choice = changeableChoice(state, listId, id);
    const changeSetId = await saveDraft(
      transaction,
      madeBy,
      "list-item",
      id,
      state.choices.get(id)?.record,
      choice,
      change(state, choice),
      state.choiceDrafts.get(id),
    );
    const list = await listNow(transaction, listId);
    // The choice was just saved, so is there.
    const result = list.choices.find((other) => other.id === id) as Choice;
    return { result, changeSetId };
  });
}

export async function updateChoice(
  database: Database,
  madeBy: string,
  listId: string,
  id: string,
  request: ChoiceRequest,
): Promise<Saved<Choice>> {
  return changeChoice(database, madeBy, listId, id, (state, choice) => {
    if (choiceLabelTaken(state, listId, request.label, id)) {
      throw new ConflictError(duplicateChoice);
    }
    return { ...choice, ...request };
  });
}

export async function setChoiceRetired(
  database: Database,
  madeBy: string,
  listId: string,
  id: string,
  retired: boolean,
): Promise<string | null> {
  return (
    await changeChoice(database, madeBy, listId, id, (_state, choice) => ({
      ...choice,
      retired,
    }))
  ).changeSetId;
}

// Drafts putting a choice just after another in its list, or at the top, as a new order of the
// list's choices.
export async function moveChoice(
  database: Database,
  madeBy: string,
  listId: string,
  id: string,
  after: string | null,
): Promise<string | null> {
  if (after === id) {
    throw new BadRequestError("A choice cannot follow itself");
  }
  return drafting(database, async (transaction, state) => {
    changeableChoice(state, listId, id);
    const before = draftedOrder(state, listId);
    const others = before.filter((other) => other !== id);
    const at = after === null ? 0 : others.indexOf(after) + 1;
    if (after !== null && at === 0) {
      throw new BadRequestError("Choose a choice in the same list to follow");
    }
    const wanted = [...others.slice(0, at), id, ...others.slice(at)];
    const made = asDraft(orderChanges(listId, before, wanted));
    if (made.length === 0) return null;
    await writeOrderDraft(transaction, state, listId, wanted);
    const draft = state.orderDrafts.get(listId);
    return recordChanges(transaction, madeBy, [
      ...made,
      ...clearedRejection(
        listId,
        () => "general",
        undefined,
        draft,
        "choice-order",
      ),
    ]);
  });
}

// Drafts removing a choice; removing one only drafted to be added discards its draft. A choice
// cannot be removed while people have it, live or in a draft.
export async function deleteChoice(
  database: Database,
  madeBy: string,
  listId: string,
  id: string,
): Promise<string | null> {
  return drafting(database, async (transaction, state) => {
    const choice = changeableChoice(state, listId, id);
    const live = state.choices.get(id)?.record;
    if (live === undefined) {
      const made = discardingChoice(state, id);
      await removeDiscarded(transaction, made);
      return recordChanges(transaction, madeBy, made, "discard");
    }
    await refuseIfChosen(transaction, id);
    return saveDraft(
      transaction,
      madeBy,
      "list-item",
      id,
      live,
      choice,
      undefined,
      state.choiceDrafts.get(id),
    );
  });
}

export type ListDraftKind = "list" | "choice" | "order";

// Finds a draft of a list, a choice, or a list's order, refusing one that does not exist.
function draftOf(
  state: ListsState,
  kind: ListDraftKind,
  listId: string,
  choiceId?: string,
): Draft {
  if (!listExists(state, listId)) throw new NotFoundError(noList);
  if (kind === "choice") {
    const id = choiceId as string;
    if (!choiceExists(state, id) || listOfChoice(state, id) !== listId) {
      throw new NotFoundError(noChoice);
    }
  }
  let draft: Draft | undefined;
  if (kind === "list") draft = state.listDrafts.get(listId);
  else if (kind === "order") draft = state.orderDrafts.get(listId);
  else draft = state.choiceDrafts.get(choiceId as string);
  if (draft === undefined) throw new NotFoundError(noDraft);
  return draft;
}

// Discards a draft of a list, a choice, or a list's order, so the record is as it is live, or, for
// one only drafted to be added, gone, with the drafts of its choices.
export async function discardListDraft(
  database: Database,
  madeBy: string,
  kind: ListDraftKind,
  listId: string,
  choiceId?: string,
): Promise<string | null> {
  return drafting(database, async (transaction, state) => {
    draftOf(state, kind, listId, choiceId);
    let made: Change[];
    if (kind === "list") made = discardingList(state, listId);
    else if (kind === "order") made = discardingOrder(state, listId);
    else made = discardingChoice(state, choiceId as string);
    await removeDiscarded(transaction, made);
    return recordChanges(transaction, madeBy, made, "discard");
  });
}

// Sends a rejected draft of a list, a choice, or a list's order for approval again, unchanged.
export async function resubmitListDraft(
  database: Database,
  madeBy: string,
  kind: ListDraftKind,
  listId: string,
  choiceId?: string,
): Promise<string | null> {
  return drafting(database, async (transaction, state) => {
    const draft = draftOf(state, kind, listId, choiceId);
    if (draft.state !== "rejected") {
      throw new ConflictError(
        "Only a rejected draft is sent for approval again",
      );
    }
    const recordType = draftTypeOf(kind);
    const id = kind === "choice" ? (choiceId as string) : listId;
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

export const draftTypeOf = (kind: ListDraftKind): DraftType => {
  if (kind === "list") return "list";
  return kind === "order" ? "choice-order" : "list-item";
};
