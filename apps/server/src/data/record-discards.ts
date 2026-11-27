// SPDX-License-Identifier: Apache-2.0

// Who may discard a draft, for every kind of record: the one rule the discardable mark and every
// discard's refusal follow. Part of the data access layer.

import type { DraftKind, RecordRef } from "@fathom/shared";
import type { Actor } from "../access.ts";
import { ForbiddenError } from "../errors.ts";
import { boundWith, discardedWith } from "./bound-drafts.ts";
import { editsKind } from "./draft-editors.ts";
import { changedByActor, ownDiscardRefusal } from "./draft-makers.ts";
import { type RecordsState, stateOf } from "./record-state.ts";
import { isRecordType, readRecordsState } from "./records.ts";

const cyclesRefusal = "Only someone who changes cycles can discard this.";

const isCycles = ({ type }: RecordRef) => type === "cycle-pattern";

// Why the actor may not discard a plan record's draft, or undefined when they may. Discarding one
// that takes a draft of a schedule's cycles along is left to roles that may change cycles, who
// discard a draft bound to one whoever changed it; any other draft only one who changed it
// discards.
export function recordDiscardRefusal(
  state: RecordsState,
  actor: Actor,
  ref: RecordRef,
  changedByUser: boolean,
): string | undefined {
  // With no draft of cycles, none is bound or taken along.
  if (stateOf(state, "cycle-pattern").drafts.size === 0) {
    return ownDiscardRefusal(changedByUser);
  }
  if (!editsKind(actor, "cycle-pattern")) {
    return discardedWith(state, ref).some(isCycles)
      ? cyclesRefusal
      : ownDiscardRefusal(changedByUser);
  }
  return boundWith(state, ref).some(isCycles)
    ? undefined
    : ownDiscardRefusal(changedByUser);
}

// Refuses discarding the draft asked for, of any kind, to anyone the rule above refuses; the drafts
// discarded with it go whoever made them. Every discard, and every removal of a record only
// drafted to be added, which discards it, is checked here.
export async function refuseDiscardingOthers(
  transaction: Parameters<typeof readRecordsState>[0],
  actor: Actor,
  recordType: DraftKind,
  id: string,
): Promise<void> {
  const changed = await changedByActor(transaction, actor, recordType, id);
  const refusal = isRecordType(recordType)
    ? recordDiscardRefusal(
        await readRecordsState(transaction, actor.user.id),
        actor,
        { type: recordType, id },
        changed,
      )
    : ownDiscardRefusal(changed);
  if (refusal !== undefined) throw new ForbiddenError(refusal);
}
