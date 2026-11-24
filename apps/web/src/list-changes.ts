// SPDX-License-Identifier: Apache-2.0

// The lists as the Lists page shows a change before the server answers, and the drafts waiting
// among them.

import type { Choice, List } from "@fathom/shared";
import {
  decidable,
  type DraftSelection,
  draftTotal,
  noDrafts,
} from "./drafts.ts";

interface Decided {
  draft?:
    | {
        state: string;
        unpublished?: boolean | undefined;
        needsOtherApprover?: boolean | undefined;
      }
    | undefined;
  heldBy?: string | undefined;
}

// The drafts among the lists given that the rule given keeps: of lists, choices, and orders.
const draftsWhere = (
  lists: readonly List[],
  keeps: (record: Decided) => boolean,
): DraftSelection => ({
  ...noDrafts(),
  lists: lists.filter(keeps).map(({ id }) => id),
  choices: lists.flatMap((list) =>
    list.choices.filter(keeps).map(({ id }) => id),
  ),
  orders: lists
    .filter((list) =>
      keeps({ draft: list.orderDraft, heldBy: list.orderHeldBy }),
    )
    .map(({ id }) => id),
});

// The drafts waiting for approval among the lists given: of lists, choices, and orders.
export function draftsWaitingIn(lists: readonly List[]): {
  selection: DraftSelection;
  total: number;
} {
  const selection = draftsWhere(lists, decidable);
  return { selection, total: draftTotal(selection) };
}

// The drafts waiting for approval among the lists given that need no other approver.
export const approvableIn = (lists: readonly List[]): DraftSelection =>
  draftsWhere(
    lists,
    (record) => decidable(record) && record.draft?.needsOtherApprover !== true,
  );

// A record without one of its optional fields, such as its draft.
export function withoutField<Record extends object>(
  record: Record,
  field: keyof Record,
): Record {
  return Object.fromEntries(
    Object.entries(record).filter(([key]) => key !== field),
  ) as Record;
}

// The lists with one list changed.
export function withList(
  lists: List[],
  id: string,
  change: (list: List) => List,
): List[] {
  return lists.map((list) => (list.id === id ? change(list) : list));
}

// A list's choices with one taken out and put back just after another, or at the top.
export function reordered(
  choices: readonly Choice[],
  choice: Choice,
  after: string | null,
): Choice[] {
  const others = choices.filter((other) => other.id !== choice.id);
  const at = others.findIndex((other) => other.id === after) + 1;
  return [...others.slice(0, at), choice, ...others.slice(at)];
}
