// SPDX-License-Identifier: Apache-2.0

// Which of a user's unpublished changes go together, so they are published and discarded together.
// Part of the data access layer.

import { type DraftKind, draftKey, type RecordType } from "@fathom/shared";
import {
  type ColumnsState,
  draftedField,
  usesAddedList,
} from "./column-state.ts";
import { usedByRecord } from "./draft-uses.ts";
import type { Draft } from "./draft-records.ts";
import type { Fill } from "./fills.ts";
import { withUsed } from "./list-approvals.ts";
import type { ListsState } from "./lists.ts";
import { type RecordsState, usesOf } from "./record-state.ts";
import { isRecordType, kindOf } from "./records.ts";

interface Change {
  recordType: string;
  recordId: string;
}

export const changeKey = ({ recordType, recordId }: Change): string =>
  draftKey(recordType, recordId);

const keysOf = (kind: DraftKind, ids: readonly string[]): string[] =>
  ids.map((id) => draftKey(kind, id));

// The drafts as the user's own changes make them, and the changes that go together whole: each
// fill's, and each change set's.
export interface OwnDrafts {
  lists: ListsState;
  columns: ColumnsState;
  people: ReadonlyMap<string, Draft>;
  hires: ReadonlyMap<string, Draft>;
  records: RecordsState;
  together: readonly (readonly string[])[];
}

// A record's draft given values in columns, and choices, only drafted to be added uses them.
const givenValues =
  (drafts: (own: OwnDrafts) => ReadonlyMap<string, Draft>) =>
  (own: OwnDrafts, id: string): string[] => {
    const draft = drafts(own).get(id);
    if (draft === undefined) return [];
    const used = usedByRecord(own.columns, draft);
    return [
      ...keysOf("field", used.columns),
      ...keysOf("list-item", used.choices),
    ];
  };

// A choice uses the list it is added to, and a new order the choices it places, while they are
// only drafted to be added.
const onLists =
  (asked: "choices" | "orders") =>
  (own: OwnDrafts, id: string): string[] => {
    const used = withUsed(own.lists, {
      lists: [],
      choices: asked === "choices" ? [id] : [],
      orders: asked === "orders" ? [id] : [],
    });
    return [
      ...keysOf("list", used.lists),
      ...keysOf("list-item", used.choices),
    ];
  };

// The drafts each kind kept outside the plan's records uses, by key; a list and a feature team use
// none.
const usesByKind: Record<
  Exclude<DraftKind, RecordType>,
  (own: OwnDrafts, id: string) => string[]
> = {
  person: givenValues((own) => own.people),
  "planned-hire": givenValues((own) => own.hires),
  "feature-team": () => [],
  list: () => [],
  "list-item": onLists("choices"),
  "choice-order": onLists("orders"),
  field: (own, id) => {
    const field = draftedField(own.columns, id);
    return field !== undefined && usesAddedList(own.columns, field)
      ? keysOf("list", [String(field.listId)])
      : [];
  },
};

const usesByKindOf = new Map<string, (own: OwnDrafts, id: string) => string[]>(
  Object.entries(usesByKind),
);

// The drafts one change uses, by key, whoever made them; none for a kind Fathom no longer has.
function usedBy(own: OwnDrafts, { recordType, recordId }: Change): string[] {
  if (isRecordType(recordType)) {
    return usesOf(kindOf(recordType), own.records, recordId).map(
      ({ type, id }) => draftKey(type, id),
    );
  }
  return usesByKindOf.get(recordType)?.(own, recordId) ?? [];
}

// The changes of each fill, by key.
export const fillKeys = (fills: readonly Fill[]): string[][] =>
  fills.map((fill) => [
    ...keysOf("person", fill.people),
    ...keysOf("planned-hire", fill.plannedHires),
  ]);

// Each of the user's changes, in the order given, with its key and the others of theirs it uses or
// goes together with. A group going together links its first change of the user's to all its
// others, and each other to the first, which joins them the whole way along both ways without
// naming every pair.
export function linksAmong<Given extends Change>(
  own: OwnDrafts,
  changes: readonly Given[],
): { change: Given; key: string; uses: string[] }[] {
  const mine = new Set(changes.map(changeKey));
  const groupmates = new Map<string, string[]>();
  for (const group of own.together) {
    const [first, ...others] = group.filter((key) => mine.has(key));
    if (first === undefined) continue;
    groupmates.set(first, [...(groupmates.get(first) ?? []), ...others]);
    for (const other of others) {
      groupmates.set(other, [...(groupmates.get(other) ?? []), first]);
    }
  }
  return changes.map((change) => {
    const key = changeKey(change);
    const used = new Set([
      ...usedBy(own, change),
      ...(groupmates.get(key) ?? []),
    ]);
    return {
      change,
      key,
      uses: [...used].filter((one) => one !== key && mine.has(one)),
    };
  });
}

// The same, by key.
export const usesAmong = (
  own: OwnDrafts,
  changes: readonly Change[],
): Map<string, string[]> =>
  new Map(linksAmong(own, changes).map(({ key, uses }) => [key, uses]));

// The changes given, with every change they use, those use, and so on.
export function withNeeded(
  uses: ReadonlyMap<string, readonly string[]>,
  given: readonly string[],
): Set<string> {
  const found = new Set(given);
  const queue = [...given];
  for (let next = queue.pop(); next !== undefined; next = queue.pop()) {
    for (const used of uses.get(next) ?? []) {
      if (!found.has(used)) {
        found.add(used);
        queue.push(used);
      }
    }
  }
  return found;
}

// The changes given, with every change that uses them, those that use those, and so on.
export function withUsers(
  uses: ReadonlyMap<string, readonly string[]>,
  given: readonly string[],
): Set<string> {
  const usedBy = new Map<string, string[]>();
  for (const [user, used] of uses) {
    for (const one of used) usedBy.set(one, [...(usedBy.get(one) ?? []), user]);
  }
  return withNeeded(usedBy, given);
}

// The changes given that may be published when some may not: all but those refused, and the changes
// that use them or go together with them, so a change and those it needs are published or left
// together.
export function publishableAmong(
  uses: ReadonlyMap<string, readonly string[]>,
  given: readonly string[],
  refused: readonly string[],
): Set<string> {
  const left = withUsers(uses, refused);
  return new Set(given.filter((key) => !left.has(key)));
}
