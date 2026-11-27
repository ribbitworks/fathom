// SPDX-License-Identifier: Apache-2.0

// The drafts of the plan's records bound together: those a draft uses, those that use it, and those
// approved or discarded only together, such as the patterns and moved releases of a change of one
// cycle's length, with the drafts any role that may change cycles discards. Part of the data access
// layer.

import type { RecordRef } from "@fathom/shared";
import type { Actor } from "../access.ts";
import { editsKind } from "./draft-editors.ts";
import { type RecordsState, refKey, stateOf, usesOf } from "./record-state.ts";
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

// The drafts the actor may discard whoever changed them, by record: each draft of a schedule's
// cycles, with those bound to it, when their role may change cycles. A new schedule is not one, as
// it uses none of its new cycles' drafts.
export function discardedByAnyEditor(
  state: RecordsState,
  actor: Actor,
): ReadonlySet<string> {
  if (!editsKind(actor, "cycle-pattern")) return new Set();
  return new Set(
    [...stateOf(state, "cycle-pattern").drafts.keys()]
      .flatMap((id) => boundWith(state, { type: "cycle-pattern", id }))
      .map(refKey),
  );
}
