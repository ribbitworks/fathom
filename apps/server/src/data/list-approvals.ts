// SPDX-License-Identifier: Apache-2.0

// Approving and rejecting drafts of lists, choices, and the order of lists' choices, as the
// Decisions Log sets out. Part of the data access layer; approvals.ts runs these with the drafts of
// people approved or rejected at the same time, in one change set. Approving a draft approves the
// drafts it uses too: a choice added to a list drafted to be added uses the list's draft, and an
// order that places a choice drafted to be added uses the choice's. A draft that others use is
// rejected only together with them. Approving never leaves a built-in list without a choice offered
// for everything it keeps.

import { lists as listTable, listItems } from "@fathom/db";
import type { DraftsRequest } from "@fathom/shared";
import { eq } from "drizzle-orm";
import { ConflictError, NotFoundError } from "../errors.ts";
import type { Change, Transaction } from "./changes.ts";
import {
  deleteDrafts,
  drafted,
  type Draft,
  refuseHeldDecision,
  refuseRejected,
  rejectedField,
  setRejection,
} from "./drafts.ts";
import {
  refuseSensitiveFeatureList,
  choiceChanges,
  choicesOrderUses,
  heldOrder,
  listChanges,
  listOfChoice,
  type ListsState,
  liveOrder,
  lockChoices,
  orderChanges,
  readState,
  refuseIfChosen,
  refuseIfUsed,
  peoplesMeaning,
  refusePeoplesMeaningWhileHeld,
  refuseKeptUnoffered,
  removeEmptyOrders,
  writePositions,
} from "./lists.ts";

export type ListSelection = Pick<DraftsRequest, "lists" | "choices" | "orders">;

const gone = "One of these drafts no longer exists; refresh to see the latest";

export const asksForLists = (asked: ListSelection) =>
  asked.lists.length + asked.choices.length + asked.orders.length > 0;

// Refuses deciding drafts of records someone holds.
async function refuseHeld(
  transaction: Transaction,
  decided: ListSelection,
): Promise<void> {
  await refuseHeldDecision(transaction, "list", decided.lists);
  await refuseHeldDecision(transaction, "list-item", decided.choices);
  await refuseHeldDecision(transaction, "choice-order", decided.orders);
}

// Refuses drafts asked for that do not exist.
function requireDrafts(state: ListsState, asked: ListSelection): void {
  if (
    asked.lists.some((id) => !state.listDrafts.has(id)) ||
    asked.choices.some((id) => !state.choiceDrafts.has(id)) ||
    asked.orders.some(
      (id) => !state.orderDrafts.has(id) || heldOrder(state, id) === undefined,
    )
  ) {
    throw new NotFoundError(gone);
  }
}

const addedList = (state: ListsState, id: string) =>
  !state.lists.has(id) && state.listDrafts.get(id)?.action === "created";

// The drafts asked for, with every draft they use: the choices an order places that are only
// drafted to be added, and the lists only drafted to be added that choices are added to.
export function withUsed(
  state: ListsState,
  asked: ListSelection,
): ListSelection {
  const choices = new Set(asked.choices);
  for (const listId of asked.orders) {
    for (const id of choicesOrderUses(state, listId)) choices.add(id);
  }
  const listIds = new Set(asked.lists);
  for (const id of choices) {
    const listId = listOfChoice(state, id);
    if (listId !== undefined && addedList(state, listId)) listIds.add(listId);
  }
  return {
    lists: [...listIds],
    choices: [...choices],
    orders: [...asked.orders],
  };
}

// The drafts that use any of those given: the choices added to, and the order of, a list only
// drafted to be added, and the orders that place a choice only drafted to be added.
export function usersOf(
  state: ListsState,
  asked: ListSelection,
): ListSelection {
  const choices = new Set<string>();
  const orders = new Set<string>();
  for (const listId of asked.lists.filter((id) => addedList(state, id))) {
    for (const [id, draft] of state.choiceDrafts) {
      if (draft.action === "created" && draft.fields.listId === listId) {
        choices.add(id);
      }
    }
    if (state.orderDrafts.has(listId)) orders.add(listId);
  }
  for (const id of [...asked.choices, ...choices]) {
    const listId = listOfChoice(state, id);
    if (listId !== undefined && choicesOrderUses(state, listId).includes(id)) {
      orders.add(listId);
    }
  }
  return { lists: [], choices: [...choices], orders: [...orders] };
}

const draftOfList = (state: ListsState, id: string) =>
  state.listDrafts.get(id) as Draft;
const draftOfChoice = (state: ListsState, id: string) =>
  state.choiceDrafts.get(id) as Draft;

const asList = (id: string, list: Record<string, unknown>) => ({
  id,
  name: String(list.name),
  description: String(list.description),
  visibility: String(list.visibility),
  retired: list.retired === true,
});

const asChoice = (id: string, choice: Record<string, unknown>) => ({
  id,
  listId: String(choice.listId),
  label: String(choice.label),
  description: String(choice.description),
  retired: choice.retired === true,
  meaning: typeof choice.meaning === "string" ? choice.meaning : null,
});

// Approves the drafts asked for and those they use, applying them to the live lists and choices,
// and returns the changes made, for approvals.ts to record. Lists come first, then their choices,
// then orders, then removals, so each finds what it needs in place.
export async function approveListDrafts(
  transaction: Transaction,
  asked: ListSelection,
): Promise<Change[]> {
  const state = await readState(transaction);
  requireDrafts(state, asked);
  const approved = withUsed(state, asked);
  await refuseHeld(transaction, approved);
  refuseRejected([
    ...approved.lists.map((id) => state.listDrafts.get(id)),
    ...approved.choices.map((id) => state.choiceDrafts.get(id)),
    ...approved.orders.map((id) => state.orderDrafts.get(id)),
  ]);
  const made: Change[] = [];
  const removedLists: string[] = [];
  for (const id of approved.lists) {
    const live = state.lists.get(id);
    const list = drafted(live, draftOfList(state, id));
    if (list === undefined) {
      removedLists.push(id);
    } else if (live === undefined) {
      await transaction.insert(listTable).values(asList(id, list));
      made.push(...listChanges(id, "created", undefined, list));
    } else {
      if (list.retired === true && live.retired !== true) {
        // Locked first, so a column being added at the same moment, which holds the list shared,
        // either finishes first and is found, or waits and then finds the list retired.
        await transaction
          .select({ id: listTable.id })
          .from(listTable)
          .where(eq(listTable.id, id))
          .for("update");
        await refuseIfUsed(transaction, id, "retired");
      }
      const { name, description, visibility, retired } = asList(id, list);
      await refuseSensitiveFeatureList(transaction, id, visibility);
      await transaction
        .update(listTable)
        .set({ name, description, visibility, retired })
        .where(eq(listTable.id, id));
      made.push(...listChanges(id, "changed", live, list));
    }
  }
  const removedChoices: string[] = [];
  // In the order drafted, so choices added together keep their order.
  const choiceIds = [...state.choiceDrafts.keys()].filter((id) =>
    approved.choices.includes(id),
  );
  for (const id of choiceIds) {
    const live = state.choices.get(id)?.record;
    const choice = drafted(live, draftOfChoice(state, id));
    if (choice === undefined) {
      removedChoices.push(id);
    } else if (live === undefined) {
      const listId = String(choice.listId);
      const rows = await lockChoices(transaction, listId);
      const end = Math.max(0, ...rows.map(({ position }) => position));
      await transaction
        .insert(listItems)
        .values({ ...asChoice(id, choice), position: end + 1 });
      made.push(...choiceChanges(id, "created", undefined, choice));
    } else {
      const { label, description, retired, meaning } = asChoice(id, choice);
      if (peoplesMeaning(meaning) && !peoplesMeaning(live.meaning)) {
        await refusePeoplesMeaningWhileHeld(transaction, id, meaning);
      }
      await transaction
        .update(listItems)
        .set({ label, description, retired, meaning })
        .where(eq(listItems.id, id));
      made.push(...choiceChanges(id, "changed", live, choice));
    }
  }
  for (const listId of approved.orders) {
    const rows = await lockChoices(transaction, listId);
    const before = rows.map(({ id }) => id);
    const held = (heldOrder(state, listId) as string[]).filter((id) =>
      before.includes(id),
    );
    const after = [...held, ...before.filter((id) => !held.includes(id))];
    await writePositions(transaction, rows, after);
    made.push(...orderChanges(listId, before, after));
  }
  for (const id of removedChoices) {
    await refuseIfChosen(transaction, id);
    made.push(
      ...choiceChanges(id, "deleted", state.choices.get(id)?.record, undefined),
    );
    await transaction.delete(listItems).where(eq(listItems.id, id));
  }
  for (const id of removedLists) {
    await refuseIfUsed(transaction, id, "deleted");
    // Choices and orders someone is changing count too, since their changes are made to the list
    // as it is.
    const waitingChoices = [
      ...state.choiceDrafts.keys(),
      ...state.held.choices.keys(),
    ].some(
      (choiceId) =>
        listOfChoice(state, choiceId) === id &&
        !approved.choices.includes(choiceId),
    );
    if (
      waitingChoices ||
      state.orderDrafts.has(id) ||
      state.held.orders.has(id)
    ) {
      throw new ConflictError(
        "A list drafted to be deleted has choices with drafts; approve or discard them first",
      );
    }
    const choiceIdsNow = liveOrder(state, id).filter(
      (choiceId) => !removedChoices.includes(choiceId),
    );
    for (const choiceId of choiceIdsNow) {
      await refuseIfChosen(transaction, choiceId);
      made.push(
        ...choiceChanges(
          choiceId,
          "deleted",
          state.choices.get(choiceId)?.record,
          undefined,
        ),
      );
    }
    made.push(...listChanges(id, "deleted", state.lists.get(id), undefined));
    await transaction.delete(listTable).where(eq(listTable.id, id));
  }
  await refuseKeptUnoffered(
    transaction,
    approved.choices.map((id) => listOfChoice(state, id)),
  );
  await deleteDrafts(transaction, "list", approved.lists);
  await deleteDrafts(transaction, "list-item", approved.choices);
  await deleteDrafts(transaction, "choice-order", approved.orders);
  await removeEmptyOrders(transaction);
  return made;
}

// Rejects the drafts asked for with a reason, refusing a draft that others use unless they are
// rejected too, and returns the changes to record.
export async function rejectListDrafts(
  transaction: Transaction,
  asked: ListSelection,
  reason: string,
): Promise<Change[]> {
  const state = await readState(transaction);
  requireDrafts(state, asked);
  await refuseHeld(transaction, asked);
  const users = usersOf(state, asked);
  if (
    users.choices.some((id) => !asked.choices.includes(id)) ||
    users.orders.some((id) => !asked.orders.includes(id))
  ) {
    throw new ConflictError(
      "Other drafts depend on these drafts. Reject them together, or wait until those drafts no longer depend on these.",
    );
  }
  const made: Change[] = [];
  const rejecting = [
    ["list", asked.lists, state.listDrafts],
    ["list-item", asked.choices, state.choiceDrafts],
    ["choice-order", asked.orders, state.orderDrafts],
  ] as const;
  for (const [recordType, ids, found] of rejecting) {
    for (const id of ids) {
      const draft = found.get(id) as Draft;
      if (draft.state === "rejected" && draft.reason === reason) continue;
      made.push({
        recordType,
        recordId: id,
        action: "changed",
        field: rejectedField,
        tier: "general",
        oldValue: draft.state === "rejected" ? draft.reason : null,
        newValue: reason,
        draft: true,
      });
    }
    await setRejection(transaction, recordType, ids, {
      state: "rejected",
      reason,
    });
  }
  return made;
}
