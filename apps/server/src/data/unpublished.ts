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
  draftKeysOf,
  type DraftsRequest,
  type Unpublished,
  type UnpublishedPublished,
  withNeeded,
  withUsers,
} from "@fathom/shared";
import { and, eq, inArray, max, notExists } from "drizzle-orm";
import { type Actor } from "../access.ts";
import { ConflictError, NotFoundError } from "../errors.ts";
import { type Change, type Transaction } from "./changes.ts";
import { draftedField, nameTaken } from "./column-state.ts";
import { drafted, wantsNoDraft } from "./draft-records.ts";
import { chunksByKind, openChangeSets } from "./draft-makers.ts";
import { lockDrafts } from "./drafts.ts";
import { takenEmployeeIds } from "./drafted-values.ts";
import { typeOf } from "./column-types.ts";
import { choiceLabelTaken, listNameTaken, keptOffered } from "./list-rules.ts";
import {
  draftedChoice,
  draftedList,
  listExists,
  listOfChoice,
} from "./list-state.ts";
import { removeEmptyOrders } from "./lists.ts";
import { isRecordType } from "./records.ts";
import { recordFits } from "./record-drafting.ts";
import { readFills } from "./fills.ts";
import { editsDraft } from "./draft-editors.ts";
import {
  changeKey,
  fillKeys,
  linksAmong,
  type OwnDrafts,
  publishableAmong,
  usesAmong,
} from "./unpublished-uses.ts";
import {
  idsOf,
  orders,
  ownRows,
  readVersions,
  requireDrafting,
  type Row,
  subjectOf,
  versionOf,
  type Versions,
} from "./private-versions.ts";

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
      const latest = await transaction
        .select({
          recordType: changes.recordType,
          recordId: changes.recordId,
          last: max(changes.id),
        })
        .from(changes)
        .innerJoin(changeSets, eq(changeSets.id, changes.changeSetId))
        .where(and(openChangeSets(userId), eq(changes.draft, true)))
        .groupBy(changes.recordType, changes.recordId);
      const lastOf = new Map(
        latest.map(({ recordType, recordId, last }) => [
          draftKey(recordType, recordId),
          Number(last),
        ]),
      );
      const versions = await readVersions(transaction, userId, rows);
      // Every unpublished draft is saved with the changes that make it.
      const last = (row: Row) => lastOf.get(changeKey(row)) as number;
      const newest = [...rows].sort(
        (first, second) => last(second) - last(first),
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
// Whether the record as the user's draft makes it still fits the data as it is now: a name or
// Employee ID no one else has, a list to belong to or draw on, live or drafted to be added, and,
// for a choice in a built-in list, a choice still offered for everything the list keeps. Every
// change to drafts counts unpublished drafts too, so this holds unless the data was changed
// some other way.
function fits(versions: Versions, row: Row, taken: Set<string>): boolean {
  const { lists, columns } = versions.mine;
  const id = row.recordId;
  // Discarding a choice's draft can leave its list with nothing offered for something it keeps.
  if (row.recordType === "list-item") {
    const choiceList =
      listOfChoice(lists, id) ?? listOfChoice(versions.theirs.lists, id);
    if (choiceList !== undefined && !keptOffered(lists, choiceList)) {
      return false;
    }
  }
  if (wantsNoDraft(row)) return true;
  if (isRecordType(row.recordType)) {
    return recordFits(versions.records, row.recordType, id);
  }
  if (row.recordType === "choice-order") {
    return draftedList(lists, id) !== undefined;
  }
  if (row.recordType === "person") return !taken.has(id);
  if (row.recordType === "planned-hire" || row.recordType === "feature-team") {
    return true;
  }
  if (row.recordType === "list") {
    const list = draftedList(lists, id);
    return list === undefined || !listNameTaken(lists, String(list.name), id);
  }
  if (row.recordType === "list-item") {
    const choice = draftedChoice(lists, id);
    if (choice === undefined) return true;
    const listId = String(choice.listId);
    return (
      listExists(lists, listId) &&
      draftedList(lists, listId) !== undefined &&
      !choiceLabelTaken(lists, listId, String(choice.label), id)
    );
  }
  const field = draftedField(columns, id);
  if (field === undefined) return true;
  if (nameTaken(columns, String(field.name), id, field.tableName)) return false;
  const { listId } = typeOf(field).settings(field);
  return (
    listId === null ||
    (listExists(columns.lists, listId) &&
      draftedList(columns.lists, listId) !== undefined)
  );
}

// The people whose Employee ID, as the user's drafts make them, someone else has.
async function takenPeople(
  transaction: Transaction,
  userId: string,
  versions: Versions,
): Promise<Set<string>> {
  const taken = new Set<string>();
  for (const id of idsOf(versions.rows, "person")) {
    const person = drafted(
      versions.people.live.get(id),
      versions.people.mine.get(id),
    );
    if (person === undefined) continue;
    const ids = [String(person.employeeId)];
    if ((await takenEmployeeIds(transaction, ids, [id], userId)).length > 0) {
      taken.add(id);
    }
  }
  return taken;
}

const notOwn =
  "One of these changes is no longer unpublished; refresh to see the latest";

// The user's changes to drafts in their open change sets, each with its change set and the role it
// was made as.
const openDraftChanges = (reader: Reader, userId: string) =>
  reader
    .select({
      changeSetId: changes.changeSetId,
      recordType: changes.recordType,
      recordId: changes.recordId,
      madeAsRoleId: changeSets.madeAsRoleId,
    })
    .from(changes)
    .innerJoin(changeSets, eq(changeSets.id, changes.changeSetId))
    .where(and(openChangeSets(userId), eq(changes.draft, true)));

type OpenDraftChange = Awaited<ReturnType<typeof openDraftChanges>>[number];

// The records whose drafts each of the user's open change sets changes, by key, which are
// published only together, since a change set is published whole.
function savedTogether(rows: readonly OpenDraftChange[]): string[][] {
  const sets = new Map<string, Set<string>>();
  for (const row of rows) {
    sets.set(
      row.changeSetId,
      (sets.get(row.changeSetId) ?? new Set()).add(changeKey(row)),
    );
  }
  return [...sets.values()].map((keys) => [...keys]);
}

// The drafts as the user's own changes make them, with the changes that go together whole when
// publishing, those of a fill and those saved together, or, when discarding, those of a fill.
async function ownDrafts(
  reader: Reader,
  userId: string,
  versions: Versions,
  sending: "publish" | "discard",
  open?: readonly OpenDraftChange[],
): Promise<OwnDrafts> {
  const fills = fillKeys(await readFills(reader, userId));
  return {
    lists: versions.mine.lists,
    columns: versions.mine.columns,
    people: versions.people.mine,
    hires: versions.hires.mine,
    records: versions.records.mine,
    together:
      sending === "publish"
        ? [
            ...fills,
            ...savedTogether(open ?? (await openDraftChanges(reader, userId))),
          ]
        : fills,
  };
}

// The actor's unpublished drafts, with what they change, and those a request chooses, with those
// that go with them, or all of them when it chooses none: those they use, and those that go together
// with them, when publishing; those that use them, and the rest of a fill, when discarding. A change
// that is not the user's own unpublished change is answered as one that does not exist, so asking
// reveals nothing of anyone else's.
export async function readGoing(
  transaction: Transaction,
  userId: string,
  chosen: DraftsRequest | undefined,
  sending: "publish" | "discard",
) {
  const all = await ownRows(transaction, userId);
  const versions = await readVersions(transaction, userId, all);
  if (chosen === undefined) return { versions, rows: all };
  const asked = draftKeysOf(chosen);
  const own = new Set(all.map(changeKey));
  if (asked.some((key) => !own.has(key))) throw new NotFoundError(notOwn);
  const uses = usesAmong(
    await ownDrafts(transaction, userId, versions, sending),
    all,
  );
  const going = (sending === "publish" ? withNeeded : withUsers)(uses, asked);
  return { versions, rows: all.filter((row) => going.has(changeKey(row))) };
}

export async function removeRows(
  transaction: Transaction,
  userId: string,
  rows: readonly Row[],
): Promise<void> {
  for (const [recordType, chunks] of chunksByKind(rows)) {
    for (const chunk of chunks) {
      await transaction
        .delete(privateChanges)
        .where(
          and(
            eq(privateChanges.userId, userId),
            eq(privateChanges.recordType, recordType),
            inArray(privateChanges.recordId, chunk),
          ),
        );
    }
  }
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
// records' changes it published and how many it left for another role.
export async function publishUnpublished(
  database: Database,
  actor: Actor,
  chosen?: DraftsRequest,
): Promise<UnpublishedPublished> {
  requireDrafting(actor);
  return database.transaction(async (transaction) => {
    await lockDrafts(transaction);
    const userId = actor.user.id;
    const going = await readGoing(transaction, userId, chosen, "publish");
    const { versions } = going;
    const { rows, left } = await publishableBy(
      transaction,
      actor,
      versions,
      going.rows,
    );
    if (rows.length === 0) return { total: 0, left };
    const taken = await takenPeople(transaction, userId, versions);
    const misfit = rows.find((row) => !fits(versions, row, taken));
    if (misfit !== undefined) {
      throw new ConflictError(
        `The change to ${subjectOf(versions, misfit, actor)} no longer fits the data; change or discard it, then publish again`,
      );
    }
    for (const row of rows) {
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
      .set({ private: false })
      .where(
        and(openChangeSets(userId), noneStillUnpublished(transaction, userId)),
      );
    await removeEmptyOrders(transaction, undefined);
    return { total: rows.length, left };
  });
}
