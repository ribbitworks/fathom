// SPDX-License-Identifier: Apache-2.0

// A user's private changes to drafts: listing and publishing them, all at once or those chosen.
// Part of the data access layer.

import {
  changes,
  changeSets,
  type Database,
  drafts,
  privateChanges,
  type Reader,
} from "@fathom/db";
import {
  draftKey,
  type Unpublished,
  type UnpublishedPublish,
  type UnpublishedPublished,
} from "@fathom/shared";
import { and, desc, eq, notExists, sql } from "drizzle-orm";
import { type Actor } from "../access.ts";
import { type Change, type Transaction } from "./changes.ts";
import { wantsNoDraft } from "./draft-records.ts";
import { openChangeSets } from "./draft-makers.ts";
import { latestFirst } from "./history-order.ts";
import { lockDrafts } from "./drafts.ts";
import { removeEmptyOrders } from "./lists.ts";
import { editsDraft } from "./draft-editors.ts";
import {
  changeKey,
  linksAmong,
  publishableAmong,
  usesAmong,
} from "./unpublished-uses.ts";
import {
  openDraftChanges,
  orders,
  ownDrafts,
  ownRows,
  readGoing,
  readVersions,
  removeRows,
  requireDrafting,
  type Row,
  subjectOf,
  versionOf,
  type Versions,
} from "./private-versions.ts";
import { withValuesKept } from "./private-conflict-answers.ts";
import { refuseMisfits } from "./publish-checks.ts";
import { overApproved, seenByOthers } from "./private-conflicts.ts";
import {
  discardPrivateOfGone,
  publishedDraftsOf,
  readPrivateBefore,
} from "./private-gone.ts";

// The user's unpublished changes, newest first: by the last change made to each record.
export async function readUnpublished(
  database: Database,
  actor: Actor,
): Promise<Unpublished> {
  requireDrafting(actor);
  return database.transaction(
    async (transaction) => {
      const userId = actor.user.id;
      const rows = await ownRows(transaction, userId);
      // By when each record was last changed, as the change history orders it, so a copy of a change
      // set parted as a record went stays where its original was.
      const last = transaction
        .selectDistinctOn([changes.recordType, changes.recordId], {
          recordType: changes.recordType,
          recordId: changes.recordId,
          madeAt: sql`${changeSets.madeAt}`.as("made_at"),
          id: sql`${changes.id}`.as("id"),
        })
        .from(changes)
        .innerJoin(changeSets, eq(changeSets.id, changes.changeSetId))
        .where(and(openChangeSets(userId), eq(changes.draft, true)))
        .orderBy(changes.recordType, changes.recordId, ...latestFirst)
        .as("last");
      const latest = await transaction
        .select({ recordType: last.recordType, recordId: last.recordId })
        .from(last)
        .orderBy(desc(last.madeAt), desc(last.id));
      const placeOf = new Map(
        latest.map(({ recordType, recordId }, place) => [
          draftKey(recordType, recordId),
          place,
        ]),
      );
      const versions = await readVersions(transaction, userId, rows);
      // Every unpublished draft is saved with the changes that make it.
      const place = (row: Row) => placeOf.get(changeKey(row)) as number;
      const newest = [...rows].sort(
        (first, second) => place(first) - place(second),
      );
      const linked = linksAmong(
        await ownDrafts(transaction, userId, versions, "publish"),
        newest,
      );
      return {
        changes: linked.map(({ change: row, key, uses }) => ({
          subject: subjectOf(versions, row, actor),
          ...(wantsNoDraft(row) ? { discarded: true } : {}),
          ...(orders.has(row.recordType) || wantsNoDraft(row)
            ? {}
            : { action: row.action as Change["action"] }),
          key,
          linked: uses,
        })),
      };
    },
    { isolationLevel: "repeatable read", accessMode: "read only" },
  );
}
// The user's open change sets with no change to a draft they still have unpublished changes to, so
// a change set saved with changes to several records is published once all of them are.
const noneStillUnpublished = (reader: Reader, userId: string) =>
  notExists(
    reader
      .select({ id: changes.id })
      .from(changes)
      .innerJoin(
        privateChanges,
        and(
          eq(privateChanges.recordType, changes.recordType),
          eq(privateChanges.recordId, changes.recordId),
          eq(privateChanges.userId, userId),
        ),
      )
      .where(
        and(eq(changes.changeSetId, changeSets.id), eq(changes.draft, true)),
      ),
  );

// Rewrites the user's private changes to records whose addition was approved since they began, as
// they now publish, so the check and the drafts written meet them as they are, and says whether it
// rewrote any.
async function rebasedOverApproved(
  transaction: Transaction,
  userId: string,
  versions: Versions,
): Promise<boolean> {
  let rebased = false;
  for (const row of versions.rows) {
    const now = overApproved(row, seenByOthers(versions, row));
    if (now === row) continue;
    rebased = true;
    await transaction
      .update(privateChanges)
      .set({ action: now.action, fields: now.fields })
      .where(
        and(
          eq(privateChanges.userId, userId),
          eq(privateChanges.recordType, row.recordType),
          eq(privateChanges.recordId, row.recordId),
        ),
      );
  }
  return rebased;
}

// Those of the changes going that the actor's role may publish, with every change each needs, and
// how many are left for a role that may. A change made as the role in use is its own, with whatever
// moved with it, such as the releases a cycle's new length moves; one made under another of the
// user's roles is published only by a role that may make its kind, since a session acts as one role
// and only that role's permissions apply.
async function publishableBy(
  transaction: Transaction,
  actor: Actor,
  versions: Versions,
  going: readonly Row[],
): Promise<{ rows: Row[]; left: number }> {
  const open = await openDraftChanges(transaction, actor.user.id);
  const madeAsOther = new Set(
    open
      .filter(({ madeAsRoleId }) => madeAsRoleId !== actor.roleId)
      .map(changeKey),
  );
  // A column's draft is judged by the column's table; no other row has a column to give.
  const mayMake = (row: Row) =>
    editsDraft(
      actor,
      row.recordType,
      versionOf(versions, "field", row.recordId),
    );
  const refused = going
    .filter((row) => madeAsOther.has(changeKey(row)) && !mayMake(row))
    .map(changeKey);
  if (refused.length === 0) return { rows: [...going], left: 0 };
  const uses = usesAmong(
    await ownDrafts(transaction, actor.user.id, versions, "publish", open),
    going,
  );
  const kept = publishableAmong(uses, going.map(changeKey), refused);
  return {
    rows: going.filter((row) => kept.has(changeKey(row))),
    left: going.length - kept.size,
  };
}

// Publishes the actor's unpublished drafts a request chooses, with those they use, or every one when
// it chooses none, all together or none, of those the actor's role may publish, and returns how many
// records' changes it published and how many it left for another role. A field someone else changed
// since the actor's change began is published only once the request says which value to keep.
export async function publishUnpublished(
  database: Database,
  actor: Actor,
  chosen?: UnpublishedPublish,
): Promise<UnpublishedPublished> {
  requireDrafting(actor);
  return database.transaction(async (transaction) => {
    await lockDrafts(transaction);
    const userId = actor.user.id;
    const readChosen = () =>
      readGoing(transaction, userId, chosen?.drafts, "publish");
    let going = await readChosen();
    if (await rebasedOverApproved(transaction, userId, going.versions)) {
      going = await readChosen();
    }
    const { rows, left } = await publishableBy(
      transaction,
      actor,
      going.versions,
      going.rows,
    );
    if (rows.length === 0) return { total: 0, left };
    const kept = await withValuesKept(
      transaction,
      actor,
      going.versions,
      rows,
      chosen?.resolutions ?? [],
    );
    await refuseMisfits(transaction, actor, kept.versions, kept.rows);
    const privateBefore = await readPrivateBefore(
      transaction,
      await publishedDraftsOf(
        transaction,
        "created",
        kept.rows.filter(wantsNoDraft),
      ),
      userId,
    );
    for (const row of kept.rows) {
      const record = and(
        eq(drafts.recordType, row.recordType),
        eq(drafts.recordId, row.recordId),
      );
      if (wantsNoDraft(row)) {
        await transaction.delete(drafts).where(record);
        continue;
      }
      const draft = {
        action: row.action,
        fields: row.fields,
        state: "waiting",
        reason: null,
      };
      await transaction
        .insert(drafts)
        .values({
          recordType: row.recordType,
          recordId: row.recordId,
          ...draft,
        })
        .onConflictDoUpdate({
          target: [drafts.recordType, drafts.recordId],
          set: draft,
        });
    }
    await removeRows(transaction, userId, rows);
    await transaction
      .update(changeSets)
      .set({ private: false, publishedAt: sql`(SELECT clock_timestamp())` })
      .where(
        and(openChangeSets(userId), noneStillUnpublished(transaction, userId)),
      );
    await removeEmptyOrders(transaction, undefined);
    // Publishing the discard of a draft that added a record leaves it gone.
    await discardPrivateOfGone(transaction, actor.dataClasses, privateBefore);
    return {
      total: kept.rows.length,
      left,
      ...(kept.givenUp.length > 0 ? { givenUp: kept.givenUp } : {}),
    };
  });
}
