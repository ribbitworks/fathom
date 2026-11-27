// SPDX-License-Identifier: Apache-2.0

// Who may discard a draft, for every kind of record: the one rule the discardable mark and every
// discard's refusal follow. Part of the data access layer.

import type { Reader } from "@fathom/db";
import type { DraftKind, RecordRef, RecordType } from "@fathom/shared";
import type { Actor } from "../access.ts";
import { ForbiddenError } from "../errors.ts";
import { addedBelow, boundWith, draftedRefs } from "./bound-drafts.ts";
import { editsKind } from "./draft-editors.ts";
import { changedByActor, ownDiscardRefusal } from "./draft-makers.ts";
import {
  addedOnly,
  type RecordsState,
  refKey,
  stateOf,
} from "./record-state.ts";

const cyclesRefusal = "Only someone who changes cycles can discard this.";

const isCycles = ({ type }: RecordRef) => type === "cycle-pattern";

// The drafts bound to any of those given. Binding goes both ways, so these are the drafts whose own
// bound drafts hold one of them.
const boundToAny = (
  state: RecordsState,
  roots: readonly RecordRef[],
): Set<string> =>
  new Set(roots.flatMap((root) => boundWith(state, root)).map(refKey));

// Why the actor may not discard a plan record's draft, given whether they changed it, or undefined
// when they may, worked out once for every draft of the plan. Discarding one that takes a draft of a
// schedule's cycles along is left to roles that may change cycles, who discard a draft bound to one
// whoever changed it; any other draft only one who changed it discards.
export function planDiscardRule(
  state: RecordsState,
  actor: Actor,
): (ref: RecordRef, changedByUser: boolean) => string | undefined {
  const own = (_ref: RecordRef, changedByUser: boolean) =>
    ownDiscardRefusal(changedByUser);
  const cycles = [...stateOf(state, "cycle-pattern").drafts.keys()].map(
    (id): RecordRef => ({ type: "cycle-pattern", id }),
  );
  if (cycles.length === 0) return own;
  if (editsKind(actor, "cycle-pattern")) {
    const bound = boundToAny(state, cycles);
    return (ref, changedByUser) =>
      bound.has(refKey(ref)) ? undefined : own(ref, changedByUser);
  }
  // A discard takes cycles along through a draft bound to it that is of cycles, or that is only
  // drafted to be added and has new cycles below it, as a new schedule does.
  const taking = boundToAny(
    state,
    draftedRefs(state).filter(
      (ref) =>
        isCycles(ref) ||
        (addedOnly(state, ref.type, ref.id) &&
          addedBelow(state, ref).some(isCycles)),
    ),
  );
  return (ref, changedByUser) =>
    taking.has(refKey(ref)) ? cyclesRefusal : own(ref, changedByUser);
}

const refuseWith = (refusal: string | undefined) => {
  if (refusal !== undefined) throw new ForbiddenError(refusal);
};

// Refuses discarding the draft of a plan record asked for, by the plan as the discard reads it, to
// anyone the rule above refuses; the drafts discarded with it go whoever made them.
export async function refuseRecordDiscard(
  transaction: Reader,
  state: RecordsState,
  actor: Actor,
  ref: { type: RecordType; id: string },
): Promise<void> {
  refuseWith(
    planDiscardRule(state, actor)(
      ref,
      await changedByActor(transaction, actor, ref.type, ref.id),
    ),
  );
}

// Refuses discarding the draft asked for, of a kind outside the plan's records, to anyone who didn't
// change it; the drafts discarded with it go whoever made them. Every such discard, and every removal
// of a record only drafted to be added, which discards it, is checked here.
export async function refuseDiscardingOthers(
  transaction: Reader,
  actor: Actor,
  recordType: Exclude<DraftKind, RecordType>,
  id: string,
): Promise<void> {
  refuseWith(
    ownDiscardRefusal(await changedByActor(transaction, actor, recordType, id)),
  );
}
