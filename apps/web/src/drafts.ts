// SPDX-License-Identifier: Apache-2.0

// Approving and rejecting drafts through the server's API, several kinds at once: of people, People's
// columns, lists, choices, and the order of lists' choices and of People's columns. Neither can be
// undone. Approving a draft approves the drafts it uses too, which are named first: the server says
// which choices or columns an order uses, and the rest are worked out here.

import {
  type ColumnOrderDraft,
  type Field,
  type List,
  savedSchema,
} from "@fathom/shared";
import { sendJsonFor } from "./api.ts";

// Drafts chosen to approve or reject, by kind: an order is named by its list.
export interface DraftSelection {
  people: string[];
  lists: string[];
  choices: string[];
  orders: string[];
  columns: string[];
  // The draft of the order of the People table's columns.
  columnOrder: boolean;
}

export const noDrafts = (): DraftSelection => ({
  people: [],
  lists: [],
  choices: [],
  orders: [],
  columns: [],
  columnOrder: false,
});

export const draftTotal = (selection: DraftSelection) =>
  selection.people.length +
  selection.lists.length +
  selection.choices.length +
  selection.orders.length +
  selection.columns.length +
  (selection.columnOrder ? 1 : 0);

// Approves the drafts chosen, and those they use, all together, and gives the change set that
// applied them.
export async function approveDrafts(
  selection: DraftSelection,
): Promise<string | null> {
  return (
    await sendJsonFor("POST", "/api/drafts/approval", selection, savedSchema)
  ).changeSetId;
}

// Rejects the drafts chosen, with a reason, and gives the change set that recorded it, or null when
// every one was already rejected for that reason.
export async function rejectDrafts(
  selection: DraftSelection,
  reason: string,
): Promise<string | null> {
  return (
    await sendJsonFor(
      "POST",
      "/api/drafts/rejection",
      { ...selection, reason },
      savedSchema,
    )
  ).changeSetId;
}

const choicesOf = (lists: readonly List[]) =>
  lists.flatMap((list) => list.choices.map((choice) => ({ list, choice })));

// The choices only drafted to be added that a list's draft of its order uses, as the server says.
function placedByOrder(list: List): string[] {
  return list.orderDraft?.uses ?? [];
}

// The People table's columns and the draft of their order, where the selection may hold them.
export interface Columns {
  fields: readonly Field[];
  orderDraft?: ColumnOrderDraft | undefined;
}

// The other drafts approving the selection approves too: choices an order places that are only
// drafted to be added, and lists only drafted to be added that choices are added to, and the
// columns only drafted to be added that the column order places.
export function usedDrafts(
  selection: DraftSelection,
  lists: readonly List[],
  columns?: Columns,
): DraftSelection {
  const choices = new Set<string>();
  for (const listId of selection.orders) {
    const list = lists.find(({ id }) => id === listId);
    for (const id of list === undefined ? [] : placedByOrder(list)) {
      if (!selection.choices.includes(id)) choices.add(id);
    }
  }
  const listIds = new Set<string>();
  for (const { list, choice } of choicesOf(lists)) {
    if (
      (selection.choices.includes(choice.id) || choices.has(choice.id)) &&
      choice.draft?.action === "created" &&
      list.draft?.action === "created" &&
      !selection.lists.includes(list.id)
    ) {
      listIds.add(list.id);
    }
  }
  const placedColumns = selection.columnOrder
    ? (columns?.orderDraft?.uses ?? []).filter(
        (id) => !selection.columns.includes(id),
      )
    : [];
  return {
    ...noDrafts(),
    lists: [...listIds],
    choices: [...choices],
    columns: placedColumns,
  };
}

// The drafts that use any in the selection, which must be rejected with them.
export function usingDrafts(
  selection: DraftSelection,
  lists: readonly List[],
  columns?: Columns,
): DraftSelection {
  const choices = new Set<string>();
  const orders = new Set<string>();
  for (const list of lists) {
    const added = list.draft?.action === "created";
    if (added && selection.lists.includes(list.id)) {
      for (const choice of list.choices) {
        if (choice.draft?.action === "created") choices.add(choice.id);
      }
      if (list.orderDraft !== undefined) orders.add(list.id);
    }
    const placed = placedByOrder(list);
    if (
      placed.some((id) => selection.choices.includes(id) || choices.has(id))
    ) {
      orders.add(list.id);
    }
  }
  return {
    ...noDrafts(),
    choices: [...choices].filter((id) => !selection.choices.includes(id)),
    orders: [...orders].filter((id) => !selection.orders.includes(id)),
    columnOrder:
      !selection.columnOrder &&
      (columns?.orderDraft?.uses ?? []).some((id) =>
        selection.columns.includes(id),
      ),
  };
}

// The selection with others added.
export const joined = (
  first: DraftSelection,
  second: DraftSelection,
): DraftSelection => ({
  people: [...new Set([...first.people, ...second.people])],
  lists: [...new Set([...first.lists, ...second.lists])],
  choices: [...new Set([...first.choices, ...second.choices])],
  orders: [...new Set([...first.orders, ...second.orders])],
  columns: [...new Set([...first.columns, ...second.columns])],
  columnOrder: first.columnOrder || second.columnOrder,
});

// The drafts in a selection by name, for saying which others an approval includes.
export function draftNames(
  selection: DraftSelection,
  lists: readonly List[],
  fields: readonly Field[] = [],
): string[] {
  const names: string[] = fields
    .filter(({ id }) => selection.columns.includes(id))
    .map(({ name }) => `the column ${name}`);
  if (selection.columnOrder) names.push("the order of People's columns");
  for (const list of lists) {
    if (selection.lists.includes(list.id)) names.push(`the list ${list.name}`);
    for (const choice of list.choices) {
      if (selection.choices.includes(choice.id)) {
        names.push(`the choice ${choice.label} in ${list.name}`);
      }
    }
    if (selection.orders.includes(list.id)) {
      names.push(`the order of ${list.name}`);
    }
  }
  return names;
}
