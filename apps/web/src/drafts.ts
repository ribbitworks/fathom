// SPDX-License-Identifier: Apache-2.0

// Approving and rejecting drafts through the server's API, several kinds at once: of people,
// planned hires, People's columns, lists, choices, and the order of lists' choices and of People's
// columns. Neither can be undone. Approving a draft approves the drafts it uses too, of any kind,
// which are counted first: the server says which choices or columns an order uses, and the rest,
// such as the new choices and columns a person is given and the new lists they belong to, are
// worked out here, as is what a decision covers, whether a draft waits for a rejected one it
// depends on, and whether the user's role approves drafts of every area the decision covers.

import {
  type Asking,
  type DraftKind,
  draftsWhere,
  type Field,
  kindsAsked,
  type List,
  type Person,
  type RecordRef,
  savedSchema,
} from "@fathom/shared";
import { sendJsonFor } from "./api.ts";
import { rowName } from "./people-rows.ts";
import {
  type RecordNode,
  recordNames,
  recordsJoined,
  recordsWithout,
  rejectedRecords,
  usedRecords,
  usingRecords,
} from "./record-drafts.ts";

// Drafts chosen to approve or reject, by kind: an order is named by its list.
export interface DraftSelection {
  people: string[];
  plannedHires: string[];
  featureTeams: string[];
  lists: string[];
  choices: string[];
  orders: string[];
  columns: string[];
  // The plan's records, such as schedules, by kind.
  records: RecordRef[];
}

export const noDrafts = (): DraftSelection => ({
  people: [],
  plannedHires: [],
  featureTeams: [],
  lists: [],
  choices: [],
  orders: [],
  columns: [],
  records: [],
});

export const draftTotal = (selection: DraftSelection) =>
  selection.people.length +
  selection.plannedHires.length +
  selection.featureTeams.length +
  selection.lists.length +
  selection.choices.length +
  selection.orders.length +
  selection.columns.length +
  selection.records.length;

// Whether a user who approves drafts of some kinds approves drafts of every kind given.
export const approvesAll = (
  approves: readonly DraftKind[],
  kinds: readonly DraftKind[],
): boolean => kinds.every((kind) => approves.includes(kind));

// Whether a user who approves drafts of these kinds may approve or reject every draft chosen.
export const mayDecide = (
  approves: readonly DraftKind[],
  selection: DraftSelection,
): boolean => approvesAll(approves, kindsAsked(selection));

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

// The People table's columns and its people, and the plan's records, where the selection may hold
// them.
export interface Columns {
  fields: readonly Field[];
  people?: readonly Person[] | undefined;
  records?: readonly RecordNode[] | undefined;
}

const addedField = (fields: readonly Field[], id: string) =>
  fields.find((field) => field.id === id)?.draft?.action === "created";

// A list only drafted to be added.
const addedList = (lists: readonly List[], id: string) =>
  lists.find((list) => list.id === id)?.draft?.action === "created";

// The columns, and choices, only drafted to be added that a person's draft gives them.
function usedByPerson(
  person: Person,
  lists: readonly List[],
  fields: readonly Field[],
): { columns: string[]; choices: string[] } {
  const added = new Set(
    choicesOf(lists)
      .filter(({ choice }) => choice.draft?.action === "created")
      .map(({ choice }) => choice.id),
  );
  const changed = person.draft?.changed ?? [];
  const values = Object.entries(person.values).filter(([id]) =>
    changed.includes(id),
  );
  return {
    columns: values.map(([id]) => id).filter((id) => addedField(fields, id)),
    choices: values.flatMap(([, chosen]) =>
      chosen.filter((id) => added.has(id)),
    ),
  };
}

// The other drafts approving the selection approves too: the columns and choices only drafted to be
// added that people are given, the choices an order places that are only drafted to be added, and
// the lists only drafted to be added that any of those choices are added to or columns draw on.
export function usedDrafts(
  selection: DraftSelection,
  lists: readonly List[],
  columns?: Columns,
): DraftSelection {
  const fields = columns?.fields ?? [];
  const choices = new Set<string>();
  const fieldIds = new Set<string>();
  for (const person of columns?.people ?? []) {
    if (!selection.people.includes(person.id)) continue;
    const used = usedByPerson(person, lists, fields);
    for (const id of used.columns) fieldIds.add(id);
    for (const id of used.choices) choices.add(id);
  }
  for (const listId of selection.orders) {
    const list = lists.find(({ id }) => id === listId);
    for (const id of list === undefined ? [] : placedByOrder(list)) {
      choices.add(id);
    }
  }
  const listIds = new Set<string>();
  for (const { list, choice } of choicesOf(lists)) {
    if (
      (selection.choices.includes(choice.id) || choices.has(choice.id)) &&
      choice.draft?.action === "created" &&
      addedList(lists, list.id)
    ) {
      listIds.add(list.id);
    }
  }
  for (const { id, listId } of fields) {
    if (
      (selection.columns.includes(id) || fieldIds.has(id)) &&
      listId !== null &&
      addedList(lists, listId)
    ) {
      listIds.add(listId);
    }
  }
  return {
    ...noDrafts(),
    lists: [...listIds].filter((id) => !selection.lists.includes(id)),
    choices: [...choices].filter((id) => !selection.choices.includes(id)),
    columns: [...fieldIds].filter((id) => !selection.columns.includes(id)),
    records: usedRecords(selection.records, columns?.records ?? []),
  };
}

// The lists, choices, and columns in the selection whose drafts were rejected, which wait until
// they are sent for approval again, and so hold up approving any draft that uses them.
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
    records: rejectedRecords(selection.records, columns?.records ?? []),
  };
}

// The drafts in the selection that use a rejected draft, so wait until it is sent for approval
// again: choices added to, and columns drawing on, a list whose addition was rejected, orders that
// place a choice or column whose addition was rejected, and people given one.
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
    people: selection.people.filter((id) => held({ people: [id] })),
    choices: selection.choices.filter((id) => held({ choices: [id] })),
    orders: selection.orders.filter((id) => held({ orders: [id] })),
    columns: selection.columns.filter((id) => held({ columns: [id] })),
    records: selection.records.filter((ref) => held({ records: [ref] })),
  };
}

// The selection without the drafts in another.
export const without = (
  selection: DraftSelection,
  other: DraftSelection,
): DraftSelection => ({
  people: selection.people.filter((id) => !other.people.includes(id)),
  plannedHires: selection.plannedHires.filter(
    (id) => !other.plannedHires.includes(id),
  ),
  featureTeams: selection.featureTeams.filter(
    (id) => !other.featureTeams.includes(id),
  ),
  lists: selection.lists.filter((id) => !other.lists.includes(id)),
  choices: selection.choices.filter((id) => !other.choices.includes(id)),
  orders: selection.orders.filter((id) => !other.orders.includes(id)),
  columns: selection.columns.filter((id) => !other.columns.includes(id)),
  records: recordsWithout(selection.records, other.records),
});

// The drafts that use any in the selection, which must be rejected with them: the choices added to,
// the order of, and the columns drawing on, a list only drafted to be added; the orders that place
// such a choice, or column; and the people given any of them.
export function usingDrafts(
  selection: DraftSelection,
  lists: readonly List[],
  columns?: Columns,
): DraftSelection {
  const fields = columns?.fields ?? [];
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
  const fieldIds = new Set(
    fields
      .filter(
        ({ id, listId, draft }) =>
          draft?.action === "created" &&
          listId !== null &&
          selection.lists.includes(listId) &&
          addedList(lists, listId) &&
          !selection.columns.includes(id),
      )
      .map(({ id }) => id),
  );
  const rejecting = {
    choices: new Set([...selection.choices, ...choices]),
    columns: new Set([...selection.columns, ...fieldIds]),
  };
  const people = (columns?.people ?? [])
    // Only published drafts are decided, so only they must be rejected together.
    .filter(
      ({ id, draft }) =>
        draft !== undefined &&
        draft.unpublished !== true &&
        !selection.people.includes(id),
    )
    .filter((person) => {
      const used = usedByPerson(person, lists, fields);
      return (
        used.columns.some((id) => rejecting.columns.has(id)) ||
        used.choices.some((id) => rejecting.choices.has(id))
      );
    })
    .map(({ id }) => id);
  return {
    ...noDrafts(),
    people,
    choices: [...choices].filter((id) => !selection.choices.includes(id)),
    orders: [...orders].filter((id) => !selection.orders.includes(id)),
    columns: [...fieldIds],
    records: usingRecords(selection.records, columns?.records ?? []),
  };
}

// The selection with others added.
export const joined = (
  first: DraftSelection,
  second: DraftSelection,
): DraftSelection => ({
  people: [...new Set([...first.people, ...second.people])],
  plannedHires: [...new Set([...first.plannedHires, ...second.plannedHires])],
  featureTeams: [...new Set([...first.featureTeams, ...second.featureTeams])],
  lists: [...new Set([...first.lists, ...second.lists])],
  choices: [...new Set([...first.choices, ...second.choices])],
  orders: [...new Set([...first.orders, ...second.orders])],
  columns: [...new Set([...first.columns, ...second.columns])],
  records: recordsJoined(first.records, second.records),
});

// The drafts in a selection by name, for saying which others an approval includes.
export function draftNames(
  selection: DraftSelection,
  lists: readonly List[],
  fields: readonly Field[] = [],
  people: readonly Person[] = [],
  records: readonly RecordNode[] = [],
): string[] {
  const names: string[] = [
    ...people
      .filter(({ id }) => selection.people.includes(id))
      .map(({ preferredName }) => preferredName),
    ...people
      .filter(({ id }) => selection.plannedHires.includes(id))
      .map((hire) => `the planned hire ${rowName(hire, lists)}`),
  ];
  names.push(
    ...fields
      .filter(({ id }) => selection.columns.includes(id))
      .map(({ name }) => `the column ${name}`),
  );
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
  names.push(...recordNames(selection.records, records));
  return names;
}

// Whether any draft in the selection waits for a rejected draft it depends on, so cannot be
// approved until that one is resubmitted. Every list, with its rejected drafts, is needed to tell.
export const waitsForRejected = (
  selection: DraftSelection,
  lists: readonly List[],
  columns?: Columns,
): boolean => draftTotal(heldBack(selection, lists, columns)) > 0;

// The drafts to approve or reject once asked: those chosen, with any others the decision includes.
export interface Decision {
  asking: Asking;
  selection: DraftSelection;
  // The other drafts included, named: those the chosen ones use, when approving, or those that use
  // the ones rejected.
  included?: string[];
  // How many drafts chosen are skipped, since they depend on a rejected draft.
  leftOut?: number;
  // When every draft chosen depends on a rejected draft, so none can be approved yet.
  waiting?: true;
  // The drafts the approval would apply that this user changed, named, when their role does not let
  // them approve their own: another approver must approve them, so nothing is approved.
  othersApprove?: string[];
  // The drafts the decision covers whose areas this user's role does not approve, named: another
  // approver must decide them, so nothing is decided.
  beyondRole?: string[];
}

// The drafts in a selection that this user changed and may not approve themselves.
function needingOthers(
  selection: DraftSelection,
  lists: readonly List[],
  columns?: Columns,
): DraftSelection {
  const flagged = (draft?: { needsOtherApprover?: boolean | undefined }) =>
    draft?.needsOtherApprover === true;
  const people = columns?.people ?? [];
  return {
    ...noDrafts(),
    people: people
      .filter(
        ({ id, draft }) => selection.people.includes(id) && flagged(draft),
      )
      .map(({ id }) => id),
    plannedHires: people
      .filter(
        ({ id, draft }) =>
          selection.plannedHires.includes(id) && flagged(draft),
      )
      .map(({ id }) => id),
    lists: lists
      .filter(({ id, draft }) => selection.lists.includes(id) && flagged(draft))
      .map(({ id }) => id),
    choices: choicesOf(lists)
      .filter(
        ({ choice }) =>
          selection.choices.includes(choice.id) && flagged(choice.draft),
      )
      .map(({ choice }) => choice.id),
    orders: lists
      .filter(
        ({ id, orderDraft }) =>
          selection.orders.includes(id) && flagged(orderDraft),
      )
      .map(({ id }) => id),
    columns: (columns?.fields ?? [])
      .filter(
        ({ id, draft }) => selection.columns.includes(id) && flagged(draft),
      )
      .map(({ id }) => id),
    records: (columns?.records ?? [])
      .filter(
        ({ ref, draft }) =>
          selection.records.some(
            (one) => one.type === ref.type && one.id === ref.id,
          ) && flagged(draft),
      )
      .map(({ ref }) => ref),
  };
}

// Whether a person's draft holds what a fill drafts on them, rather than only changes of their own.
const partOfFill = (draft: Person["draft"]) =>
  draft?.action === "created" ||
  ["positionId", "managerId", "managerFrom", "isManager"].some(
    (field) => draft?.changed.includes(field) === true,
  );

// The other drafts of any fill those chosen are part of, which are decided with them: the hire, the
// person who fills it, and the planned hires it moves to them. The server decides them together.
function fillDrafts(
  selection: DraftSelection,
  columns?: Columns,
): DraftSelection {
  const people = columns?.people ?? [];
  const found = noDrafts();
  for (const hire of people) {
    if (typeof hire.filler !== "string") continue;
    const moved = people.filter(
      (one) =>
        one.kind === "planned-hire" &&
        one.manager?.id === hire.filler &&
        one.draft?.live.managerId === hire.id,
    );
    const hires = [hire.id, ...moved.map(({ id }) => id)];
    const filler = people.filter(
      ({ id, draft }) => id === hire.filler && partOfFill(draft),
    );
    if (
      !hires.some((id) => selection.plannedHires.includes(id)) &&
      !filler.some(({ id }) => selection.people.includes(id))
    ) {
      continue;
    }
    found.plannedHires.push(
      ...hires.filter((id) => !selection.plannedHires.includes(id)),
    );
    found.people.push(
      ...filler
        .map(({ id }) => id)
        .filter((id) => !selection.people.includes(id)),
    );
  }
  return found;
}

// A decision on the drafts chosen, by a user who approves drafts of the kinds given: approving
// includes the drafts they depend on, and skips any that depend on a rejected draft; rejecting
// includes the drafts that depend on them. Asked to, it names the drafts chosen, when there are
// several.
export function decisionFor(
  asking: Asking,
  chosen: DraftSelection,
  approves: readonly DraftKind[],
  lists: readonly List[],
  columns?: Columns,
): Decision {
  const fields = columns?.fields ?? [];
  const names = (decided: DraftSelection) =>
    draftNames(decided, lists, fields, columns?.people, columns?.records);
  const beyond = (selection: DraftSelection) =>
    draftsWhere(selection, (kind) => !approves.includes(kind));
  if (asking === "reject") {
    const dependents = joined(
      usingDrafts(chosen, lists, columns),
      fillDrafts(chosen, columns),
    );
    const selection = joined(chosen, dependents);
    const outside = beyond(selection);
    if (draftTotal(outside) > 0) {
      return { asking, selection, beyondRole: names(outside) };
    }
    return {
      asking,
      selection,
      ...(draftTotal(dependents) > 0 ? { included: names(dependents) } : {}),
    };
  }
  const held = heldBack(chosen, lists, columns);
  const ready = without(chosen, held);
  if (draftTotal(ready) === 0)
    return { asking, selection: chosen, waiting: true };
  const used = joined(
    usedDrafts(ready, lists, columns),
    fillDrafts(ready, columns),
  );
  const selection = joined(ready, used);
  const outside = beyond(selection);
  if (draftTotal(outside) > 0) {
    return { asking, selection, beyondRole: names(outside) };
  }
  const mine = needingOthers(selection, lists, columns);
  if (draftTotal(mine) > 0) {
    return { asking, selection, othersApprove: names(mine) };
  }
  return {
    asking,
    selection,
    ...(draftTotal(used) > 0 ? { included: names(used) } : {}),
    ...(draftTotal(held) > 0 ? { leftOut: draftTotal(held) } : {}),
  };
}

// Whether two values are the same, a list holding the same items in the same order.
const sameValue = (one: unknown, other: unknown): boolean =>
  Array.isArray(one) && Array.isArray(other)
    ? one.length === other.length &&
      one.every((item, index) => item === other.at(index))
    : one === other;

// The keys, of those given, whose values differ between a record as shown and as it is live.
export function differingKeys<Key extends string>(
  values: object,
  live: object,
  keys: readonly Key[],
): Key[] {
  const shownNow = new Map(Object.entries(values));
  const liveNow = new Map(Object.entries(live));
  return keys.filter((key) => !sameValue(shownNow.get(key), liveNow.get(key)));
}

// The latest of several drafts, by when each was last changed.
export const latestDraft = <Draft extends { madeAt?: string | null }>(
  drafts: readonly Draft[],
): Draft | undefined =>
  drafts.reduce<Draft | undefined>(
    (one, other) =>
      one === undefined || (other.madeAt ?? "") > (one.madeAt ?? "")
        ? other
        : one,
    undefined,
  );

// Who changed each value of a row whose values several drafts change, such as a schedule's row its
// patterns' and releases' drafts change: whoever last changed a draft changing it.
export const creditedBy = (
  byKey: readonly {
    key: string;
    drafts: readonly { madeAt?: string | null; madeBy: string | null }[];
  }[],
): Record<string, string | null> =>
  Object.fromEntries(
    byKey.flatMap(({ key, drafts }) => {
      const last = latestDraft(drafts);
      return last === undefined ? [] : [[key, last.madeBy]];
    }),
  );

// Whether an Approver may decide a record's draft now: it waits, is published, and nobody has
// unpublished changes to it, so nobody approves a version that is about to change.
export const decidable = (record: {
  draft?: { state: string; unpublished?: boolean | undefined } | undefined;
  heldBy?: string | undefined;
}): boolean =>
  record.draft?.state === "waiting" &&
  record.draft.unpublished !== true &&
  record.heldBy === undefined;

// A record being added has no key until the server numbers it; no key has this number.
export const unsavedKeyNumber = 0;

// A draft as it is shown until the server has saved it, holding its live values.
export const pendingDraft = <Live>(
  action: "created" | "changed" | "deleted",
  live: Live,
) => ({
  action,
  changed: [] as string[],
  live,
  state: "waiting" as const,
  madeBy: null,
  madeAt: new Date().toISOString(),
});

// A record whose rejected draft has been sent for approval again, as it is shown until saved.
export function draftSentAgain<
  Rec extends { draft?: { reason?: string | undefined } | undefined },
>(record: Rec): Rec {
  if (record.draft === undefined) return record;
  const draft = { ...record.draft, state: "waiting" };
  delete draft.reason;
  return { ...record, draft };
}

// The user's own changes that go together, as the server links them, each the whole way along both
// ways: each change's group, by key, itself included, the same list for every change in a group.
export function linkedGroups(
  linked: ReadonlyMap<string, readonly string[]>,
): Map<string, string[]> {
  const groupOf = new Map<string, Set<string>>();
  const join = (one: string, other: string) => {
    const first = groupOf.get(one) ?? new Set([one]);
    const second = groupOf.get(other) ?? new Set([other]);
    if (first === second) return;
    const both = new Set([...first, ...second]);
    for (const key of both) groupOf.set(key, both);
  };
  for (const [key, others] of linked) {
    join(key, key);
    for (const other of others) join(key, other);
  }
  const lists = new Map<Set<string>, string[]>();
  return new Map(
    [...groupOf].map(([key, group]) => {
      const list = lists.get(group) ?? [...group];
      lists.set(group, list);
      return [key, list];
    }),
  );
}
