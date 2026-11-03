// SPDX-License-Identifier: Apache-2.0

// Approving and rejecting drafts through the server's API, several kinds at once: of people, People's
// columns, lists, choices, and the order of lists' choices and of People's columns. Neither can be
// undone. Approving a draft approves the drafts it uses too, which are counted first: the server says
// which choices or columns an order uses, and the rest are worked out here, as is what a decision
// covers, and whether a draft waits for a rejected one it depends on.

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

// The lists, choices, and columns in the selection whose drafts were rejected, which wait until they
// are sent for approval again, and so hold up approving any draft that uses them.
export function rejectedAmong(
  selection: DraftSelection,
  lists: readonly List[],
  columns?: Columns,
): DraftSelection {
  const rejected = (draft: { state: string } | undefined) =>
    draft?.state === "rejected";
  const choices = choicesOf(lists);
  return {
    ...noDrafts(),
    lists: selection.lists.filter((id) =>
      rejected(lists.find((list) => list.id === id)?.draft),
    ),
    choices: selection.choices.filter((id) =>
      rejected(choices.find(({ choice }) => choice.id === id)?.choice.draft),
    ),
    columns: selection.columns.filter((id) =>
      rejected(columns?.fields.find((field) => field.id === id)?.draft),
    ),
  };
}

// The drafts in the selection that use a rejected draft, so wait until it is sent for approval
// again: choices added to a list whose addition was rejected, and orders that place a choice or
// column whose addition was rejected. Nothing else uses other drafts.
export function heldBack(
  selection: DraftSelection,
  lists: readonly List[],
  columns?: Columns,
): DraftSelection {
  const held = (one: Partial<DraftSelection>) =>
    draftTotal(
      rejectedAmong(
        usedDrafts({ ...noDrafts(), ...one }, lists, columns),
        lists,
        columns,
      ),
    ) > 0;
  return {
    ...noDrafts(),
    choices: selection.choices.filter((id) => held({ choices: [id] })),
    orders: selection.orders.filter((id) => held({ orders: [id] })),
    columnOrder: selection.columnOrder && held({ columnOrder: true }),
  };
}

// The selection without the drafts in another.
export const without = (
  selection: DraftSelection,
  other: DraftSelection,
): DraftSelection => ({
  people: selection.people.filter((id) => !other.people.includes(id)),
  lists: selection.lists.filter((id) => !other.lists.includes(id)),
  choices: selection.choices.filter((id) => !other.choices.includes(id)),
  orders: selection.orders.filter((id) => !other.orders.includes(id)),
  columns: selection.columns.filter((id) => !other.columns.includes(id)),
  columnOrder: selection.columnOrder && !other.columnOrder,
});

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
  if (selection.columnOrder) names.push("the new order for People's columns");
  for (const list of lists) {
    if (selection.lists.includes(list.id)) names.push(`the list ${list.name}`);
    for (const choice of list.choices) {
      if (selection.choices.includes(choice.id)) {
        names.push(`the choice ${choice.label} in ${list.name}`);
      }
    }
    if (selection.orders.includes(list.id)) {
      names.push(`the new order for ${list.name}`);
    }
  }
  return names;
}

export type Asking = "approve" | "reject";

// Whether any draft in the selection waits for a rejected draft it depends on, so cannot be approved
// until that one is resubmitted. Every list, with its rejected drafts, is needed to tell.
export const waitsForRejected = (
  selection: DraftSelection,
  lists: readonly List[],
  columns?: Columns,
): boolean => draftTotal(heldBack(selection, lists, columns)) > 0;

// The drafts to approve or reject once asked: those chosen, with any others the decision includes.
export interface Decision {
  asking: Asking;
  selection: DraftSelection;
  // The drafts chosen, named, when one menu item decides several together, so it is clear which.
  together?: string[];
  // How many other drafts are included: those approving the chosen ones depends on, or those that
  // depend on the ones rejected.
  included?: number;
  // How many drafts chosen are skipped, since they depend on a rejected draft.
  leftOut?: number;
  // When every draft chosen depends on a rejected draft, so none can be approved yet.
  waiting?: true;
}

// A decision on the drafts chosen: approving includes the drafts they depend on, and skips any that
// depend on a rejected draft; rejecting includes the drafts that depend on them. Asked to, it names
// the drafts chosen, when there are several.
export function decisionFor(
  asking: Asking,
  chosen: DraftSelection,
  lists: readonly List[],
  columns?: Columns,
  naming = false,
): Decision {
  const fields = columns?.fields ?? [];
  const named = (decided: DraftSelection) =>
    naming && draftTotal(decided) > 1
      ? { together: draftNames(decided, lists, fields) }
      : {};
  if (asking === "reject") {
    const using = usingDrafts(chosen, lists, columns);
    return {
      asking,
      selection: joined(chosen, using),
      ...named(chosen),
      ...(draftTotal(using) > 0 ? { included: draftTotal(using) } : {}),
    };
  }
  const held = heldBack(chosen, lists, columns);
  const ready = without(chosen, held);
  if (draftTotal(ready) === 0)
    return { asking, selection: chosen, waiting: true };
  const used = usedDrafts(ready, lists, columns);
  return {
    asking,
    selection: joined(ready, used),
    ...named(ready),
    ...(draftTotal(used) > 0 ? { included: draftTotal(used) } : {}),
    ...(draftTotal(held) > 0 ? { leftOut: draftTotal(held) } : {}),
  };
}

// Whether an Approver may decide a record's draft now: it waits, is published, and nobody has
// unpublished changes to it, so nobody approves a version that is about to change.
export const decidable = (record: {
  draft?: { state: string; unpublished?: boolean | undefined } | undefined;
  heldBy?: string | undefined;
}): boolean =>
  record.draft?.state === "waiting" &&
  record.draft.unpublished !== true &&
  record.heldBy === undefined;
