// SPDX-License-Identifier: Apache-2.0

// The drafts of the plan's records bound together, by what they use, and those a discard takes
// along. Part of the data access layer.

import type { RecordRef } from "@fathom/shared";
import {
  addedOnly,
  linkedIds,
  type RecordsState,
  refKey,
  shownIds,
  stateOf,
  usesOf,
  versionOf,
} from "./record-state.ts";
import { kindOf, recordKinds } from "./records.ts";

// Every record with a draft, of every kind, as the viewer sees them.
export const draftedRefs = (state: RecordsState): RecordRef[] =>
  recordKinds.flatMap((kind) =>
    [...stateOf(state, kind.type).drafts.keys()].map((id) => ({
      type: kind.type,
      id,
    })),
  );

// The records asked for, with every draft they use, and those those use, and so on.
export function withUsedRecords(
  state: RecordsState,
  asked: readonly RecordRef[],
): RecordRef[] {
  const found = new Map(asked.map((ref) => [refKey(ref), ref]));
  const queue = [...asked];
  for (let next = queue.shift(); next !== undefined; next = queue.shift()) {
    for (const used of usesOf(kindOf(next.type), state, next.id)) {
      if (!found.has(refKey(used))) {
        found.set(refKey(used), used);
        queue.push(used);
      }
    }
  }
  return [...found.values()];
}

// The drafts that use any of those given, and those that use them, and so on.
export function usingRecords(
  state: RecordsState,
  given: readonly RecordRef[],
): RecordRef[] {
  const found = new Set(given.map(refKey));
  const dependents: RecordRef[] = [];
  let grew = true;
  while (grew) {
    grew = false;
    for (const ref of draftedRefs(state)) {
      if (found.has(refKey(ref))) continue;
      if (
        usesOf(kindOf(ref.type), state, ref.id).some((used) =>
          found.has(refKey(used)),
        )
      ) {
        found.add(refKey(ref));
        dependents.push(ref);
        grew = true;
      }
    }
  }
  return dependents;
}

// A record's draft with the drafts bound to it, which it uses and which use it in turn, such as the
// patterns and moved releases of a change of one cycle's length, which are discarded only together.
export function boundWith(state: RecordsState, root: RecordRef): RecordRef[] {
  const users = new Set(usingRecords(state, [root]).map(refKey));
  return withUsedRecords(state, [root]).filter(
    (ref) => refKey(ref) === refKey(root) || users.has(refKey(ref)),
  );
}

// The records only drafted to be added that belong to one, through the links of their kinds, and
// those that belong to them, and so on.
function addedBelow(state: RecordsState, root: RecordRef): RecordRef[] {
  const found = new Map([[refKey(root), root]]);
  const queue = [root];
  for (let next = queue.shift(); next !== undefined; next = queue.shift()) {
    const parent = next;
    for (const kind of recordKinds) {
      const linking = Object.entries(kind.links).filter(
        ([, type]) => type === parent.type,
      );
      if (linking.length === 0) continue;
      for (const id of shownIds(state, kind.type)) {
        const version = versionOf(state, kind.type, id);
        const ref = { type: kind.type, id };
        if (
          !addedOnly(state, kind.type, id) ||
          found.has(refKey(ref)) ||
          !linking.some(([name]) =>
            linkedIds(version, name).includes(parent.id),
          )
        ) {
          continue;
        }
        found.set(refKey(ref), ref);
        queue.push(ref);
      }
    }
  }
  return [...found.values()];
}

// The drafts discarding a record's draft discards: those bound to it, and the drafts of the records
// only drafted to be added that belong to any of them.
export const discardedWith = (
  state: RecordsState,
  root: RecordRef,
): RecordRef[] => [
  ...new Map(
    boundWith(state, root)
      .flatMap((ref) =>
        addedOnly(state, ref.type, ref.id) ? addedBelow(state, ref) : [ref],
      )
      .map((ref) => [refKey(ref), ref]),
  ).values(),
];
