// SPDX-License-Identifier: Apache-2.0

// Giving up, on publishing, what a user's private changes kept for someone else's: taking it out of
// their private changes, and recording one change given up for each private change it takes back,
// in their own history alone. Part of the data access layer.

import { changes, changeSets, privateChanges } from "@fathom/db";
import { type DataClasses, type DraftKind, isDraftKind } from "@fathom/shared";
import { and, desc, eq, inArray, sql } from "drizzle-orm";
import { type Actor, storedTier } from "../access.ts";
import { type Change, type Transaction } from "./changes.ts";
import { listedKinds } from "./change-set-kinds.ts";
import { openChangeSets } from "./draft-makers.ts";
import { givenUpWith } from "./give-up-rules.ts";
import { timesOf } from "./history-order.ts";
import { asDraft } from "./draft-records.ts";
import { type Resolved } from "./private-resolutions.ts";
import { type Versions } from "./private-versions.ts";
import { changeKey } from "./unpublished-uses.ts";
import { givingUp, recordTakingBack, undone } from "./private-withdrawals.ts";

// A user's change still private, with where it is in the history and whether it discarded a draft.
interface Held {
  change: Change;
  id: number;
  changeSetId: string;
  discarded: boolean;
}

// The user's changes to the records given, still private and not yet taken back, since they last
// took each record back by hand, newest first: those giving up takes back, each with whether it
// discarded a draft.
async function heldChanges(
  transaction: Transaction,
  userId: string,
  records: readonly { recordId: string }[],
): Promise<Held[]> {
  const held = await transaction
    .select({
      id: changes.id,
      changeSetId: changes.changeSetId,
      discarded: sql<boolean>`${changeSets.kind} IN (${listedKinds(({ resetsMakers }) => resetsMakers)})`,
      change: {
        recordType: changes.recordType,
        recordId: changes.recordId,
        action: changes.action,
        field: changes.field,
        tier: changes.tier,
        oldValue: changes.oldValue,
        newValue: changes.newValue,
      },
      // What decides whether a give-up takes it back.
      facts: {
        madeAtMicros: timesOf.madeAtMicros,
        sinceMicros: sql<
          number | null
        >`(extract(epoch from ${privateChanges.since}) * 1000000)::bigint`.mapWith(
          Number,
        ),
        takenBack: sql<boolean>`EXISTS (SELECT 1 FROM fathom.changes AS taken WHERE taken.takes_back = ${changes.id})`,
        undone: sql<boolean>`EXISTS (SELECT 1 FROM fathom.change_sets AS undoing WHERE undoing.undoes = ${changeSets.id})`,
        undoesPrivate: sql<boolean>`EXISTS (SELECT 1 FROM fathom.change_sets AS undone WHERE undone.id = ${changeSets.undoes} AND undone.private)`,
      },
    })
    .from(changes)
    .innerJoin(changeSets, eq(changeSets.id, changes.changeSetId))
    .leftJoin(
      privateChanges,
      and(
        eq(privateChanges.userId, userId),
        eq(privateChanges.recordType, changes.recordType),
        eq(privateChanges.recordId, changes.recordId),
      ),
    )
    .where(
      and(
        openChangeSets(userId),
        eq(changes.draft, true),
        inArray(
          changes.recordId,
          records.map(({ recordId }) => recordId),
        ),
      ),
    )
    .orderBy(desc(changes.id));
  // Changes to drafts are always of a kind of draft.
  return held
    .filter(({ facts }) => givenUpWith(facts))
    .map(({ id, changeSetId, discarded, change }) => ({
      id,
      changeSetId,
      discarded,
      change: { ...change, tier: storedTier(change.tier) },
    }))
    .filter(
      (each): each is typeof each & { change: { recordType: DraftKind } } =>
        isDraftKind(each.change.recordType),
    );
}

// A private change undone, naming the change it takes back.
const takingBackHeld = ({ id, change }: Held): Change => ({
  ...undone(change),
  takesBack: id,
});

// The changes giving up what a private change gave up, one for each of the user's private changes
// it takes back, naming it, so each is taken back exactly once: for a field, each from the user's
// value to the other; for a whole record, each private change undone.
function givingUpEach(
  versions: Versions,
  { row, givenUp: fields, whole }: Resolved,
  held: readonly Held[],
  classes: DataClasses,
): Change[] {
  const ofRecord = held.filter(
    ({ change }) =>
      change.recordType === row.recordType && change.recordId === row.recordId,
  );
  if (whole) {
    return ofRecord.map(takingBackHeld);
  }
  return givingUp(versions, row, fields, classes).flatMap((change) =>
    ofRecord
      .filter((each) => each.change.field === change.field)
      .map(({ id }) => ({ ...change, takesBack: id })),
  );
}

// Takes what is given up out of the user's private changes, as kept, and removes those left with
// nothing of their own, recording their taking back in the user's own history alone.
export async function giveUp(
  transaction: Transaction,
  actor: Actor,
  versions: Versions,
  givenUp: readonly Resolved[],
): Promise<void> {
  const userId = actor.user.id;
  const held = await heldChanges(
    transaction,
    userId,
    givenUp.map(({ row }) => row),
  );
  await recordTakingBack(transaction, { userId, roleId: actor.roleId }, [
    {
      kind: "given-up",
      changes: asDraft(
        givenUp.flatMap((each) =>
          givingUpEach(versions, each, held, actor.dataClasses),
        ),
      ),
    },
  ]);
  for (const { row, publishing } of givenUp) {
    const kept = and(
      eq(privateChanges.userId, userId),
      eq(privateChanges.recordType, row.recordType),
      eq(privateChanges.recordId, row.recordId),
    );
    if (publishing === undefined) {
      await transaction.delete(privateChanges).where(kept);
    } else {
      await transaction
        .update(privateChanges)
        .set({ fields: publishing.fields, startedFrom: publishing.startedFrom })
        .where(kept);
    }
  }
}

// Gives up the user's private discards of the drafts of the records given, or those of one change
// set, which their discarding them by choice, or undoing that change set, takes back, so such a
// discard never starts the drafts' history again once its change set is published with their next
// changes.
export async function givingUpDiscards(
  transaction: Transaction,
  actor: Actor,
  records: readonly { recordType: string; recordId: string }[],
  changeSetId?: string,
): Promise<void> {
  const userId = actor.user.id;
  const keys = new Set(records.map(changeKey));
  const held = await heldChanges(transaction, userId, records);
  await recordTakingBack(transaction, { userId, roleId: actor.roleId }, [
    {
      kind: "given-up",
      changes: asDraft(
        held
          .filter(
            (each) =>
              each.discarded &&
              keys.has(changeKey(each.change)) &&
              (changeSetId === undefined || each.changeSetId === changeSetId),
          )
          .map(takingBackHeld),
      ),
    },
  ]);
}
