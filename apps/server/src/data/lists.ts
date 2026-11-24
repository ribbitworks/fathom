// SPDX-License-Identifier: Apache-2.0

// Drafting changes to lists of choices and their choices. Part of the data access layer.

import { type Database, lists } from "@fathom/db";
import type {
  Choice,
  ChoiceRequest,
  DraftKind,
  List,
  ListRequest,
} from "@fathom/shared";
import { draftKey, duplicateList, type Tier } from "@fathom/shared";
import { eq } from "drizzle-orm";
import { randomUUID } from "node:crypto";
import {
  type Actor,
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
  addDrafts,
  deleteDrafts,
  discardDrafts,
  type Held,
  heldMessage,
  lockDrafts,
  writeDraft,
} from "./drafts.ts";
import {
  asDraft,
  clearedRejection,
  type Draft,
  type Recorded,
} from "./draft-records.ts";
import {
  classifyDraft,
  recordMove,
  requireClassify,
  requireMove,
} from "./data-classes.ts";
import {
  listsOut,
  meaningOf,
  readMakers,
  usesFor,
  weightOf,
} from "./list-reads.ts";
import {
  choiceLabelTaken,
  choicesHaveDrafts,
  featureListIds,
  listNameTaken,
  lower,
  peoplesMeaning,
  refuseIfChosen,
  refuseIfDraftsChoose,
  refuseIfUsed,
  refuseLastKept,
  refuseMeaningMisfit,
  refusePeoplesMeaningWhileHeld,
  refuseSensitiveFeatureList,
  refuseWeightMisfit,
} from "./list-rules.ts";
import {
  addedChoices,
  choiceChanges,
  choiceExists,
  draftedChoice,
  draftedList,
  draftedOrder,
  listChanges,
  listExists,
  listOfChoice,
  listRecord,
  type ListsState,
  listTier,
  liveOrder,
  orderChanges,
  orderToHold,
  readState,
  writeOrderDraft,
} from "./list-state.ts";

export const noList = "There is no such list";
export const noChoice = "There is no such choice";
const duplicateChoice = "This list already has a choice with that name";
const listToBeRemoved =
  "This list's draft removes it; discard the draft to change it";
const choiceToBeRemoved =
  "This choice's draft removes it; discard the draft to change it";

// The list as the editor now sees it, with its drafts.
async function listNow(
  transaction: Transaction,
  editor: Actor,
  id: string,
): Promise<List> {
  const state = await readState(transaction, editor.user.id);
  // The list was just saved, so is there.
  return listsOut(
    state,
    await readMakers(transaction, state, editor),
    await featureListIds(transaction),
    await usesFor(transaction, editor),
  ).find((other) => other.id === id) as List;
}

// Runs a change to the editor's drafts of lists, after every other change to drafts, with the lists
// as they see them.
export async function drafting<Result>(
  database: Database,
  editor: string,
  change: (transaction: Transaction, state: ListsState) => Promise<Result>,
): Promise<Result> {
  return database.transaction(async (transaction) => {
    await lockDrafts(transaction);
    return change(transaction, await readState(transaction, editor));
  });
}

// Refuses a change to a record someone else holds.
export function refuseHeldIn(
  held: ReadonlyMap<string, Held>,
  id: string,
): void {
  const holder = held.get(id)?.holder;
  if (holder !== undefined) throw new ConflictError(heldMessage(holder));
}

// A list that exists, as its draft makes it, refusing one drafted to be removed.
function usableList(state: ListsState, id: string): Recorded {
  const list = draftedList(state, id);
  if (list === undefined) throw new ConflictError(listToBeRemoved);
  return list;
}

// A list to change, refusing one that cannot be used, or that someone else holds.
function changeableList(actor: Actor, state: ListsState, id: string): Recorded {
  if (!listExists(state, id)) throw new NotFoundError(noList);
  refuseUnseenList(actor, state, id);
  refuseHeldIn(state.held.lists, id);
  return usableList(state, id);
}

// A choice in the list as its draft makes it, refusing one that does not exist, that it, or its
// list, is drafted to remove, or that someone else holds.
function changeableChoice(
  actor: Actor,
  state: ListsState,
  listId: string,
  id: string,
): Recorded {
  if (!listExists(state, listId)) throw new NotFoundError(noList);
  refuseUnseenList(actor, state, listId);
  usableList(state, listId);
  if (!choiceExists(state, id) || listOfChoice(state, id) !== listId) {
    throw new NotFoundError(noChoice);
  }
  refuseHeldIn(state.held.choices, id);
  const choice = draftedChoice(state, id);
  if (choice === undefined) throw new ConflictError(choiceToBeRemoved);
  return choice;
}

// Saves a list's or choice's draft as wanted and records the changes, clearing a rejection.
async function saveDraft(
  transaction: Transaction,
  maker: Actor,
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
  await writeDraft(transaction, maker.user.id, recordType, id, live, after);
  return recordChanges(transaction, maker, [
    ...made,
    ...clearedRejection(id, () => "general", live, draft, recordType),
  ]);
}

// A list's visibility is the tier of the columns that draw on it, so, as for a column, it can be
// given only a tier the editor sees, and only someone who sees a list's values may change it.
function refuseUnseenVisibility(actor: Actor, tier: Tier, message: string) {
  if (!seesSensitivity(actor, tier)) throw new ForbiddenError(message);
}

const unseenVisibility = "Give the list a visibility this role can see";

export const unseenDetails = (name: string) =>
  `${name} holds people's details this role can't see, so someone who can see them must change it`;

// Refuses a change to a list, its choices or its order to a role that can't see the list's values,
// live or as drafted.
export function refuseUnseenList(
  actor: Actor,
  state: ListsState,
  listId: string,
): void {
  const list = draftedList(state, listId) ?? state.lists.get(listId);
  refuseUnseenVisibility(
    actor,
    listTier(state, listId),
    unseenDetails(String(list?.name)),
  );
}

export async function createList(
  database: Database,
  actor: Actor,
  request: ListRequest,
): Promise<Saved<List>> {
  refuseUnseenVisibility(actor, request.visibility, unseenVisibility);
  return drafting(database, actor.user.id, async (transaction, state) => {
    if (listNameTaken(state, request.name)) {
      throw new ConflictError(duplicateList);
    }
    classifyDraft(actor, {
      live: false,
      name: request.name,
      from: "general",
      to: request.visibility,
    });
    const id = randomUUID();
    const changeSetId = await saveDraft(
      transaction,
      actor,
      "list",
      id,
      undefined,
      undefined,
      { ...request, retired: false },
      undefined,
    );
    return { result: await listNow(transaction, actor, id), changeSetId };
  });
}

type ListChange = (
  transaction: Transaction,
  state: ListsState,
  list: Recorded,
) => Promise<Recorded>;

// Drafts a change to a list's settings, or to whether it is retired.
async function changeList(
  database: Database,
  maker: Actor,
  id: string,
  change: ListChange,
): Promise<Saved<List>> {
  return drafting(database, maker.user.id, async (transaction, state) => {
    const changeSetId = await draftListChange(
      transaction,
      maker,
      state,
      id,
      change,
    );
    return { result: await listNow(transaction, maker, id), changeSetId };
  });
}

async function draftListChange(
  transaction: Transaction,
  maker: Actor,
  state: ListsState,
  id: string,
  change: ListChange,
): Promise<string | null> {
  const list = changeableList(maker, state, id);
  const after = await change(transaction, state, list);
  return saveDraft(
    transaction,
    maker,
    "list",
    id,
    state.lists.get(id),
    list,
    after,
    state.listDrafts.get(id),
  );
}

export async function updateList(
  database: Database,
  actor: Actor,
  id: string,
  request: ListRequest,
): Promise<Saved<List>> {
  return changeList(database, actor, id, listSettings(actor, id, request));
}

// The change to a list's settings a request asks for, refused where the actor can't make it.
const listSettings =
  (actor: Actor, id: string, request: ListRequest): ListChange =>
  async (transaction, state, list) => {
    await refuseSensitiveFeatureList(transaction, id, request.visibility);
    refuseUnseenVisibility(actor, request.visibility, unseenVisibility);
    if (listNameTaken(state, request.name, id)) {
      throw new ConflictError(duplicateList);
    }
    classifyDraft(actor, {
      live: state.lists.has(id),
      name: String(list.name),
      from: storedTier(list.visibility),
      to: request.visibility,
    });
    return { ...list, ...request };
  };

export const listMoved = (name: unknown) => `the ${String(name)} list`;

// Moves a list, and so the values chosen from it, to another class: at once for an approved list,
// and in its draft for one only drafted to be added.
export async function moveListClass(
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
      .from(lists)
      .where(eq(lists.id, id))
      .for("update");
    const state = await readState(transaction, actor.user.id);
    if (row === undefined) {
      const list = changeableList(actor, state, id);
      requirePermission(actor, "configuration:edit");
      return draftListChange(
        transaction,
        actor,
        state,
        id,
        listSettings(actor, id, {
          name: String(list.name),
          description: String(list.description),
          visibility: to,
        }),
      );
    }
    changeableList(actor, state, id);
    const from = storedTier(row.visibility);
    requireMove(actor, from, to);
    if (from === to) return null;
    await refuseSensitiveFeatureList(transaction, id, to);
    await transaction
      .update(lists)
      .set({ visibility: to })
      .where(eq(lists.id, id));
    await recordMove(transaction, actor, listMoved(row.name), from, to);
    const before = listRecord(row);
    return recordChanges(
      transaction,
      actor,
      listChanges(id, "changed", before, { ...before, visibility: to }),
    );
  });
}

// Drafts retiring or restoring a list. A list cannot be retired while a column draws on it.
export async function setListRetired(
  database: Database,
  maker: Actor,
  id: string,
  retired: boolean,
): Promise<string | null> {
  return (
    await changeList(database, maker, id, async (transaction, _state, list) => {
      if (retired && list.retired !== true) {
        await refuseIfUsed(transaction, id, "retired", maker.user.id);
      }
      return { ...list, retired };
    })
  ).changeSetId;
}

// The changes that discard a list's draft, and, for a list only drafted to be added, the drafts of
// its choices and their order, with each one's rejection cleared.
export function discardingList(state: ListsState, id: string): Change[] {
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

export function discardingChoice(state: ListsState, id: string): Change[] {
  const draft = state.choiceDrafts.get(id) as Draft;
  const live = state.choices.get(id)?.record;
  const choice = draftedChoice(state, id);
  return [
    ...asDraft(choiceChanges(id, actionTo(choice, live), choice, live)),
    ...clearedRejection(id, () => "general", live, draft, "list-item"),
  ];
}

export function discardingOrder(state: ListsState, listId: string): Change[] {
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

// Discards the editor's drafts the changes discard: each record's whose changes are recorded.
export async function removeDiscarded(
  transaction: Transaction,
  editor: string,
  made: readonly Change[],
): Promise<void> {
  const seen = new Set<string>();
  for (const { recordType, recordId } of made) {
    const key = draftKey(recordType, recordId);
    if (seen.has(key)) continue;
    seen.add(key);
    await discardDrafts(transaction, editor, recordType as DraftKind, [
      recordId,
    ]);
  }
  await removeEmptyOrders(transaction, editor);
}

// Removes drafts of lists' orders that no longer change anything, as when the choice drafted to be
// added that one placed is discarded: the published drafts, or the editor's own unpublished ones,
// leaving published ones the editor sees for publishing to remove. They hold nothing to approve, so
// nothing is recorded.
export async function removeEmptyOrders(
  transaction: Transaction,
  editor?: string,
): Promise<void> {
  const state = await readState(transaction, editor);
  const empty = [...state.orderDrafts].filter(
    ([listId, draft]) =>
      (editor === undefined || draft.unpublished === true) &&
      orderToHold(state, listId, draftedOrder(state, listId)) === undefined,
  );
  const ids = empty.map(([listId]) => listId);
  if (editor === undefined)
    await deleteDrafts(transaction, "choice-order", ids);
  else await discardDrafts(transaction, editor, "choice-order", ids);
}

// Drafts deleting a list and its choices; deleting a list only drafted to be added discards its
// draft, and those of its choices. A list cannot be deleted while a column draws on it, or drafted
// to be deleted while its choices or their order have drafts.
export async function deleteList(
  database: Database,
  maker: Actor,
  id: string,
): Promise<string | null> {
  return drafting(database, maker.user.id, async (transaction, state) => {
    const list = changeableList(maker, state, id);
    const live = state.lists.get(id);
    if (live === undefined) {
      await refuseIfUsed(transaction, id, "discarded", maker.user.id);
      await refuseIfDraftsChoose(
        transaction,
        maker.user.id,
        addedChoices(state, id),
      );
      const made = discardingList(state, id);
      await removeDiscarded(transaction, maker.user.id, made);
      return recordChanges(transaction, maker, made, "discard");
    }
    await refuseIfUsed(transaction, id, "deleted", maker.user.id);
    if (choicesHaveDrafts(state, id)) {
      throw new ConflictError(
        "This list's choices have drafts; approve or discard them before deleting the list",
      );
    }
    return saveDraft(
      transaction,
      maker,
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
  maker: Actor,
  listId: string,
  requests: readonly ChoiceRequest[],
): Promise<Saved<Choice[]>> {
  return drafting(database, maker.user.id, async (transaction, state) => {
    changeableList(maker, state, listId);
    const labels = requests.map(({ label }) => lower(label));
    if (
      new Set(labels).size !== labels.length ||
      requests.some(({ label }) => choiceLabelTaken(state, listId, label))
    ) {
      throw new ConflictError(duplicateChoice);
    }
    for (const { meaning, weight } of requests) {
      refuseMeaningMisfit(state, listId, meaning ?? null);
      refuseWeightMisfit(state, listId, weight ?? null);
    }
    const added = requests.map((request) => ({
      id: randomUUID(),
      record: {
        listId,
        label: request.label,
        description: request.description,
        retired: false,
        meaning: request.meaning ?? null,
        weight: request.weight ?? null,
      },
    }));
    await addDrafts(
      transaction,
      maker.user.id,
      "list-item",
      added.map(({ id, record }) => ({ id, fields: record })),
    );
    const changeSetId = await recordChanges(
      transaction,
      maker,
      asDraft(
        added.flatMap(({ id, record }) =>
          choiceChanges(id, "created", undefined, record),
        ),
      ),
    );
    const list = await listNow(transaction, maker, listId);
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
  maker: Actor,
  listId: string,
  id: string,
  change: (state: ListsState, choice: Recorded) => Recorded,
): Promise<Saved<Choice>> {
  return drafting(database, maker.user.id, async (transaction, state) => {
    const choice = changeableChoice(maker, state, listId, id);
    const after = change(state, choice);
    refuseLastKept(state, listId, id, after);
    if (peoplesMeaning(after.meaning) && !peoplesMeaning(choice.meaning)) {
      await refusePeoplesMeaningWhileHeld(transaction, id, after.meaning);
    }
    const changeSetId = await saveDraft(
      transaction,
      maker,
      "list-item",
      id,
      state.choices.get(id)?.record,
      choice,
      after,
      state.choiceDrafts.get(id),
    );
    const list = await listNow(transaction, maker, listId);
    // The choice was just saved, so is there.
    const result = list.choices.find((other) => other.id === id) as Choice;
    return { result, changeSetId };
  });
}

export async function updateChoice(
  database: Database,
  maker: Actor,
  listId: string,
  id: string,
  request: ChoiceRequest,
): Promise<Saved<Choice>> {
  return changeChoice(database, maker, listId, id, (state, choice) => {
    if (choiceLabelTaken(state, listId, request.label, id)) {
      throw new ConflictError(duplicateChoice);
    }
    const {
      meaning = meaningOf(choice),
      weight = weightOf(choice),
      ...details
    } = request;
    refuseMeaningMisfit(state, listId, meaning);
    refuseWeightMisfit(state, listId, weight);
    return { ...choice, ...details, meaning, weight };
  });
}

export async function setChoiceRetired(
  database: Database,
  maker: Actor,
  listId: string,
  id: string,
  retired: boolean,
): Promise<string | null> {
  return (
    await changeChoice(database, maker, listId, id, (_state, choice) => ({
      ...choice,
      retired,
    }))
  ).changeSetId;
}

// Drafts putting a choice just after another in its list, or at the top, as a new order of the
// list's choices.
export async function moveChoice(
  database: Database,
  maker: Actor,
  listId: string,
  id: string,
  after: string | null,
): Promise<string | null> {
  if (after === id) {
    throw new BadRequestError("A choice cannot follow itself");
  }
  return drafting(database, maker.user.id, async (transaction, state) => {
    changeableChoice(maker, state, listId, id);
    refuseHeldIn(state.held.orders, listId);
    const before = draftedOrder(state, listId);
    const others = before.filter((other) => other !== id);
    const at = after === null ? 0 : others.indexOf(after) + 1;
    if (after !== null && at === 0) {
      throw new BadRequestError("Choose a choice in the same list to follow");
    }
    const wanted = [...others.slice(0, at), id, ...others.slice(at)];
    const made = asDraft(orderChanges(listId, before, wanted));
    if (made.length === 0) return null;
    await writeOrderDraft(transaction, maker.user.id, state, listId, wanted);
    const draft = state.orderDrafts.get(listId);
    return recordChanges(transaction, maker, [
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
  maker: Actor,
  listId: string,
  id: string,
): Promise<string | null> {
  return drafting(database, maker.user.id, async (transaction, state) => {
    const choice = changeableChoice(maker, state, listId, id);
    const live = state.choices.get(id)?.record;
    refuseLastKept(state, listId, id, undefined);
    if (live === undefined) {
      await refuseIfDraftsChoose(transaction, maker.user.id, [id]);
      const made = discardingChoice(state, id);
      await removeDiscarded(transaction, maker.user.id, made);
      return recordChanges(transaction, maker, made, "discard");
    }
    await refuseIfChosen(transaction, id, maker.user.id);
    return saveDraft(
      transaction,
      maker,
      "list-item",
      id,
      live,
      choice,
      undefined,
      state.choiceDrafts.get(id),
    );
  });
}
