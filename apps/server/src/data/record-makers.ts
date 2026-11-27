// SPDX-License-Identifier: Apache-2.0

// Who changed each of the plan's records' drafts, as the viewer may see it, and which of them the
// viewer may discard. Part of the data access layer.

import type { Reader } from "@fathom/db";
import type { RecordType } from "@fathom/shared";
import type { Actor } from "../access.ts";
import { draftMakers, everything, type Maker } from "./draft-makers.ts";
import { planDiscardRule } from "./record-discards.ts";
import { type RecordsState, refKey, stateOf } from "./record-state.ts";
import { type Makers, recordKinds } from "./records.ts";

// The makers of the drafts of the records of one kind given, and those the viewer may discard by
// the plan's rule, worked out once for the read.
export async function kindMakers(
  reader: Reader,
  viewer: Actor,
  rule: ReturnType<typeof planDiscardRule>,
  type: RecordType,
  ids: readonly string[],
): Promise<{ makers: Map<string, Maker>; discardable: string[] }> {
  const makers = await draftMakers(reader, type, ids, everything, viewer);
  return {
    makers,
    discardable: ids
      .map((id) => ({ type, id }))
      .filter(
        (ref) =>
          rule(ref, makers.get(ref.id)?.changedByUser === true) === undefined,
      )
      .map(refKey),
  };
}

export async function readRecordMakers(
  reader: Reader,
  state: RecordsState,
  viewer: Actor,
): Promise<Makers> {
  const rule = planDiscardRule(state, viewer);
  const byKind = new Map<RecordType, Map<string, Maker>>();
  const discardable = new Set<string>();
  for (const kind of recordKinds) {
    const found = await kindMakers(reader, viewer, rule, kind.type, [
      ...stateOf(state, kind.type).drafts.keys(),
    ]);
    byKind.set(kind.type, found.makers);
    for (const key of found.discardable) discardable.add(key);
  }
  return { byKind, discardable };
}
