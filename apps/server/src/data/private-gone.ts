// SPDX-License-Identifier: Apache-2.0

// Discarding everyone's private changes to records that go away, by an approval, a publish or an
// undo, each as its maker's own withdrawal. Part of the data access layer.

import { type DataClasses, draftKey } from "@fathom/shared";
import {
  allocations,
  changes,
  changeSets,
  drafts,
  inChunks,
  listItems,
  privateChanges,
  type ChangeRecord,
  recordChanges,
} from "@fathom/db";
import { and, eq, inArray, ne, or, type SQL, sql } from "drizzle-orm";
import { type StoredChange, type Transaction } from "./changes.ts";
import { storedKind } from "./change-set-kinds.ts";
import { fieldExists } from "./column-state.ts";
import { type Draft } from "./draft-records.ts";
import { chunksByKind, openChangeSets } from "./draft-makers.ts";
import { madeInOrder } from "./history-order.ts";
import { choiceExists, listExists } from "./list-state.ts";
import { isRecordType } from "./records.ts";
import { type RecordsState, stateOf } from "./record-state.ts";
import { changeKey } from "./unpublished-uses.ts";
import {
  type OpenDraftChange,
  openDraftChanges,
  ownRows,
  readVersions,
  type Row,
  type Versions,
} from "./private-versions.ts";
import { undone, withdraw } from "./private-withdrawals.ts";

export interface RecordRef {
  recordType: string;
  recordId: string;
}

// The private changes to a list's order and choices, live or drafted to be added.
const changesToListsOf = (reader: Transaction, ids: string[]) => [
  and(
    eq(privateChanges.recordType, "choice-order"),
    inArray(privateChanges.recordId, ids),
  ),
  and(
    eq(privateChanges.recordType, "list-item"),
    or(
      inArray(
        privateChanges.recordId,
        reader
          .select({ id: sql`${listItems.id}::text` })
          .from(listItems)
          .where(inArray(listItems.listId, ids)),
      ),
      inArray(
        privateChanges.recordId,
        reader
          .select({ id: drafts.recordId })
          .from(drafts)
          .where(
            and(
              eq(drafts.recordType, "list-item"),
              inArray(sql`${drafts.fields}->>'listId'`, ids),
            ),
          ),
      ),
    ),
  ),
];

const assignees = new Map<
  string,
  typeof allocations.personId | typeof allocations.plannedHireId
>([
  ["person", allocations.personId],
  ["planned-hire", allocations.plannedHireId],
]);

// The private changes to records that go away with records of a kind, without a draft of their
// own: a list's order and choices, and the allocations of a person or planned hire.
function changesGoingWith(
  reader: Transaction,
  recordType: string,
  ids: string[],
): (SQL | undefined)[] {
  if (recordType === "list") return changesToListsOf(reader, ids);
  const assignee = assignees.get(recordType);
  return assignee === undefined
    ? []
    : [
        and(
          eq(privateChanges.recordType, "allocation"),
          inArray(
            privateChanges.recordId,
            reader
              .select({ id: sql`${allocations.id}::text` })
              .from(allocations)
              .where(inArray(assignee, ids)),
          ),
        ),
      ];
}

const added = (draft: Draft | undefined) => draft?.action === "created";

// Whether the record a private change is to is there for everyone else: live, or added by a
// published draft, even while a published draft waits to remove it.
export function existsFor(versions: Versions, row: Row): boolean {
  const id = row.recordId;
  const { lists, columns } = versions.theirs;
  if (isRecordType(row.recordType)) {
    const kind = stateOf(versions.records.theirs, row.recordType);
    return kind.live.has(id) || added(kind.drafts.get(id));
  }
  if (row.recordType === "person") {
    return (
      versions.people.live.has(id) || added(versions.people.theirs.get(id))
    );
  }
  if (row.recordType === "planned-hire") {
    return versions.hires.live.has(id) || added(versions.hires.theirs.get(id));
  }
  if (row.recordType === "feature-team") {
    return versions.teams.live.has(id) || added(versions.teams.theirs.get(id));
  }
  if (row.recordType === "list" || row.recordType === "choice-order") {
    return listExists(lists, id);
  }
  if (row.recordType === "list-item") return choiceExists(lists, id);
  return fieldExists(columns, id);
}

// The versions everyone else saw, with no published draft removing the records given, so taking
// back a change to one returns it to the record as everyone last saw it, and records only the
// fields its maker changed, each at its own class. A record a published draft added keeps that
// draft, so its maker's withdrawal is of their own fields too.
export function withoutRemovals(
  versions: Versions,
  gone: readonly Row[],
): Versions {
  const keys = new Set(gone.map(changeKey));
  const drop = (kept: ReadonlyMap<string, Draft>, type: string) =>
    new Map(
      [...kept].filter(
        ([id, draft]) =>
          draft.action !== "deleted" || !keys.has(draftKey(type, id)),
      ),
    );
  const { lists, columns } = versions.theirs;
  return {
    ...versions,
    theirs: {
      lists: {
        ...lists,
        listDrafts: drop(lists.listDrafts, "list"),
        choiceDrafts: drop(lists.choiceDrafts, "list-item"),
      },
      columns: { ...columns, fieldDrafts: drop(columns.fieldDrafts, "field") },
    },
    people: {
      ...versions.people,
      theirs: drop(versions.people.theirs, "person"),
    },
    hires: {
      ...versions.hires,
      theirs: drop(versions.hires.theirs, "planned-hire"),
    },
    teams: {
      ...versions.teams,
      theirs: drop(versions.teams.theirs, "feature-team"),
    },
    records: {
      ...versions.records,
      theirs: Object.fromEntries(
        Object.entries(versions.records.theirs).map(([type, kind]) => [
          type,
          { ...kind, drafts: drop(kind.drafts, type) },
        ]),
      ) as RecordsState,
    },
  };
}

// The role a user last made any of the changes given as, from their changes in open change sets,
// oldest first; none when none of their open changes is to those records.
export function lastRoleFor(
  open: readonly OpenDraftChange[],
  rows: readonly Row[],
): string | null {
  const keys = new Set(rows.map(changeKey));
  return (
    open.filter((change) => keys.has(changeKey(change))).at(-1)?.madeAsRoleId ??
    null
  );
}

// Those of the records given whose published draft is of the action given.
export async function publishedDraftsOf(
  transaction: Transaction,
  action: Draft["action"],
  refs: readonly RecordRef[],
): Promise<RecordRef[]> {
  const found: RecordRef[] = [];
  for (const [recordType, chunks] of chunksByKind(refs)) {
    for (const chunk of chunks) {
      found.push(
        ...(await transaction
          .select({ recordType: drafts.recordType, recordId: drafts.recordId })
          .from(drafts)
          .where(
            and(
              eq(drafts.action, action),
              eq(drafts.recordType, recordType),
              inArray(drafts.recordId, chunk),
            ),
          )),
      );
    }
  }
  return found;
}

// Each maker's private changes, with the versions they make, read before a change that may take
// some of the records they change away.
export type PrivateBefore = ReadonlyMap<
  string,
  { all: Row[]; versions: Versions }
>;

// Reads, before the records given go, the private changes of everyone but except who changes any
// of them, or any record that may go with them.
export async function readPrivateBefore(
  transaction: Transaction,
  going: readonly RecordRef[],
  except?: string,
): Promise<PrivateBefore> {
  const users = new Set<string>();
  // One query reads them all, unless the records going are too many for one.
  for (const chunk of inChunks([...going])) {
    const found = await transaction
      .selectDistinct({ userId: privateChanges.userId })
      .from(privateChanges)
      .where(
        and(
          except === undefined ? undefined : ne(privateChanges.userId, except),
          or(
            ...chunksByKind(chunk).flatMap(([recordType, chunks]) => {
              const ids = chunks.flat();
              return [
                and(
                  eq(privateChanges.recordType, recordType),
                  inArray(privateChanges.recordId, ids),
                ),
                ...changesGoingWith(transaction, recordType, ids),
              ];
            }),
          ),
        ),
      );
    for (const { userId } of found) users.add(userId);
  }
  const makers = new Map<string, { all: Row[]; versions: Versions }>();
  for (const userId of users) {
    const all = await ownRows(transaction, userId);
    makers.set(userId, {
      all,
      versions: await readVersions(transaction, userId, all),
    });
  }
  return makers;
}

// A change as the history stores it, to record again: as a copy, or undone.
const asRecorded = (change: StoredChange): ChangeRecord => ({
  recordType: change.recordType,
  recordId: change.recordId,
  action: change.action,
  field: change.field,
  tier: change.tier,
  oldValue: change.oldValue,
  newValue: change.newValue,
  draft: change.draft,
});

// Copies, at its time and role, each of the user's open change sets that changed both a record gone
// and another: its changes to records gone, which the withdrawal closes, and the rest, published as
// they would have been. The history can't be changed to part the change set, which, open when the
// withdrawal is made, is then never published nor shown, so nobody else sees what went.
async function partOpenSets(
  transaction: Transaction,
  userId: string,
  gone: readonly Row[],
): Promise<StoredChange[]> {
  const goneKeys = new Set(gone.map(changeKey));
  // Only the change sets that changed a record gone, none when nothing went.
  const touching = transaction
    .selectDistinct({ id: changes.changeSetId })
    .from(changes)
    .where(
      or(
        ...gone.map(({ recordType, recordId }) =>
          and(
            eq(changes.recordType, recordType),
            eq(changes.recordId, recordId),
          ),
        ),
      ),
    );
  const rows = await transaction
    .select({
      change: changes,
      kind: changeSets.kind,
      roleId: changeSets.madeAsRoleId,
    })
    .from(changes)
    .innerJoin(changeSets, eq(changeSets.id, changes.changeSetId))
    .where(and(openChangeSets(userId), inArray(changes.changeSetId, touching)))
    .orderBy(...madeInOrder);
  const sets = new Map<
    string,
    {
      set: (typeof rows)[number];
      withdrawn: StoredChange[];
      kept: StoredChange[];
    }
  >();
  const ofGone: StoredChange[] = [];
  for (const row of rows) {
    const held = sets.get(row.change.changeSetId) ?? {
      set: row,
      withdrawn: [],
      kept: [],
    };
    const key = changeKey(row.change);
    if (goneKeys.has(key)) {
      held.withdrawn.push(row.change);
      ofGone.push(row.change);
    } else {
      held.kept.push(row.change);
    }
    sets.set(row.change.changeSetId, held);
  }
  for (const [setId, { set, withdrawn, kept }] of sets) {
    if (withdrawn.length === 0 || kept.length === 0) continue;
    for (const part of [withdrawn, kept]) {
      await recordChanges(
        transaction,
        { userId, roleId: set.roleId },
        part.map(asRecorded),
        storedKind(set.kind),
        true,
        sql`(SELECT made_at FROM fathom.change_sets WHERE id = ${setId})`,
      );
    }
  }
  return ofGone;
}

// Discards each maker's private changes, read before, to records there before and gone now, as
// their own withdrawal, seen only by them, as the role they last changed one of those records as.
// A maker is read only for a change to a record going, and withdrawing nothing writes nothing.
export async function discardPrivateOfGone(
  transaction: Transaction,
  classes: DataClasses,
  before: PrivateBefore,
): Promise<void> {
  const withdrawing = [];
  for (const [userId, { all, versions }] of before) {
    const now = await readVersions(transaction, userId, all);
    withdrawing.push({
      userId,
      versions,
      gone: all.filter(
        (row) => existsFor(versions, row) && !existsFor(now, row),
      ),
    });
  }
  // A maker with nothing gone has nothing to withdraw.
  for (const { userId, versions, gone } of withdrawing.filter(
    (maker) => maker.gone.length > 0,
  )) {
    const roleId = lastRoleFor(
      await openDraftChanges(transaction, userId),
      gone,
    );
    const ofGone = await partOpenSets(transaction, userId, gone);
    // A record whose withdrawal has no field to take back, such as an order now the same as
    // everyone's, takes back each of the maker's changes to it instead, so it is still named.
    await withdraw(
      transaction,
      { userId, roleId },
      withoutRemovals(versions, gone),
      [
        {
          kind: "gone",
          rows: gone,
          otherwise: (row) =>
            ofGone
              .filter((change) => changeKey(change) === changeKey(row))
              .map((change) => undone({ ...asRecorded(change), draft: true }))
              .reverse(),
        },
      ],
      classes,
    );
  }
}
