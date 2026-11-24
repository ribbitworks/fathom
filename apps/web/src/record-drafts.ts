// SPDX-License-Identifier: Apache-2.0

// Drafts of the plan's records, such as release streams, as decisions on them need them: each
// record with its draft, named as the Drafts page names it, and which drafts approving some
// includes, or rejecting them must include, from the drafts each draft uses, as the server says.

import type { RecordDraft, RecordRef } from "@fathom/shared";

// What decisions need of a record's draft, whatever its live values hold.
type NodeDraft = Omit<RecordDraft, "live"> & { live: object };

export interface RecordNode {
  ref: RecordRef;
  // The record as the Drafts page names it, such as "the schedule Platform".
  subject: string;
  draft: NodeDraft | undefined;
  heldBy: string | undefined;
  // The choices in the columns added to its table, by column, for a kind that has them, such as a
  // feature.
  values?: Readonly<Record<string, readonly string[]>> | undefined;
}

export const recordNode = (
  type: RecordRef["type"],
  record: {
    id: string;
    draft?: NodeDraft | undefined;
    heldBy?: string | undefined;
    values?: Readonly<Record<string, readonly string[]>> | undefined;
  },
  subject: string,
): RecordNode => ({
  ref: { type, id: record.id },
  subject,
  draft: record.draft,
  heldBy: record.heldBy,
  ...(record.values === undefined ? {} : { values: record.values }),
});

export const recordKey = ({ type, id }: RecordRef): string => `${type} ${id}`;

const keyed = (refs: readonly RecordRef[]) => new Set(refs.map(recordKey));

// The drafts the records given use, and those those use, and so on, beside the records themselves.
export function usedRecords(
  chosen: readonly RecordRef[],
  nodes: readonly RecordNode[],
): RecordRef[] {
  const byKey = new Map(nodes.map((node) => [recordKey(node.ref), node]));
  const found = keyed(chosen);
  const used: RecordRef[] = [];
  const queue = [...chosen];
  for (let next = queue.shift(); next !== undefined; next = queue.shift()) {
    for (const ref of byKey.get(recordKey(next))?.draft?.uses ?? []) {
      if (found.has(recordKey(ref))) continue;
      found.add(recordKey(ref));
      used.push(ref);
      queue.push(ref);
    }
  }
  return used;
}

// The published drafts that use any of the records given, and those that use them, and so on,
// beside the records themselves.
export function usingRecords(
  chosen: readonly RecordRef[],
  nodes: readonly RecordNode[],
): RecordRef[] {
  const found = keyed(chosen);
  const dependents: RecordRef[] = [];
  let grew = true;
  while (grew) {
    grew = false;
    for (const { ref, draft } of nodes) {
      if (
        draft === undefined ||
        draft.unpublished === true ||
        found.has(recordKey(ref)) ||
        !draft.uses.some((used) => found.has(recordKey(used)))
      ) {
        continue;
      }
      found.add(recordKey(ref));
      dependents.push(ref);
      grew = true;
    }
  }
  return dependents;
}

// The records given whose drafts were rejected.
export function rejectedRecords(
  chosen: readonly RecordRef[],
  nodes: readonly RecordNode[],
): RecordRef[] {
  const rejected = new Set(
    nodes
      .filter(({ draft }) => draft?.state === "rejected")
      .map(({ ref }) => recordKey(ref)),
  );
  return chosen.filter((ref) => rejected.has(recordKey(ref)));
}

// The records given by name, for saying which others a decision includes.
export function recordNames(
  chosen: readonly RecordRef[],
  nodes: readonly RecordNode[],
): string[] {
  const wanted = keyed(chosen);
  return nodes
    .filter(({ ref }) => wanted.has(recordKey(ref)))
    .map(({ subject }) => subject);
}

// The records in one selection that are not in another.
export const recordsWithout = (
  refs: readonly RecordRef[],
  other: readonly RecordRef[],
): RecordRef[] => {
  const left = keyed(other);
  return refs.filter((ref) => !left.has(recordKey(ref)));
};

// The records in either selection, each once.
export const recordsJoined = (
  first: readonly RecordRef[],
  second: readonly RecordRef[],
): RecordRef[] => [...first, ...recordsWithout(second, first)];

// A record as it is with every draft, by its id, from the records a Draft view's records are made
// from, for its marks, which the view decides; the record shown, should it have none there.
export const originalOf = <Rec extends { id: string }>(
  originals: ReadonlyMap<string, Rec>,
  shown: Rec,
): Rec => originals.get(shown.id) ?? shown;
