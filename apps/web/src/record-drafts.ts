// SPDX-License-Identifier: Apache-2.0

// Drafts of the plan's records, such as release streams, as decisions on them need them: each
// record with its draft, named as the Drafts page names it, and which drafts approving some
// includes, or rejecting them must include, from the drafts each draft uses, as the server says.

import type { RecordDraft, RecordRef } from "@fathom/shared";

// What decisions need of a record's draft, whatever its live values hold.
type NodeDraft = Omit<RecordDraft, "live"> & { live: object };

export interface RecordNode {
  ref: RecordRef;
  // The record as the Drafts page names it, such as "the release stream Platform".
  subject: string;
  draft: NodeDraft | undefined;
  heldBy: string | undefined;
}

export const recordNode = (
  type: RecordRef["type"],
  record: {
    id: string;
    draft?: NodeDraft | undefined;
    heldBy?: string | undefined;
  },
  subject: string,
): RecordNode => ({
  ref: { type, id: record.id },
  subject,
  draft: record.draft,
  heldBy: record.heldBy,
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
