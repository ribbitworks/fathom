// SPDX-License-Identifier: Apache-2.0

// A user's unpublished changes to drafts: listing, publishing and discarding them, all at once or
// those chosen. Part of the data access layer.

import {
  changes,
  changeSets,
  type Database,
  drafts,
  privateChanges,
  type Reader,
} from "@fathom/db";
import {
  type DataClasses,
  type DraftKind,
  draftKey,
  draftKeysOf,
  type DraftsRequest,
  draftingPermissions,
  hireCalled,
  type Permission,
  type RecordType,
  type Unpublished,
  type UnpublishedPublished,
  withNeeded,
  withUsers,
} from "@fathom/shared";
import { and, asc, eq, inArray, max, notExists } from "drizzle-orm";
import {
  type Actor,
  requireAnyPermission,
  seesSensitivity,
} from "../access.ts";
import { ConflictError, NotFoundError } from "../errors.ts";
import { type Change, recordChanges, type Transaction } from "./changes.ts";
import {
  columnRow,
  type ColumnsState,
  draftedField,
  nameTaken,
  readColumnsState,
} from "./column-state.ts";
import {
  actionTo,
  asDraft,
  type Draft,
  drafted,
  type Recorded,
  wantsNoDraft,
} from "./draft-records.ts";
import { chunksByKind, draftKeys, openChangeSets } from "./draft-makers.ts";
import { lockDrafts, overPublished, readPersonDrafts } from "./drafts.ts";
import { takenEmployeeIds } from "./drafted-values.ts";
import { typeOf } from "./column-types.ts";
import { fieldChanges } from "./fields.ts";
import { choiceLabelTaken, listNameTaken, keptOffered } from "./list-rules.ts";
import {
  choiceChanges,
  draftedChoice,
  draftedList,
  draftedOrder,
  listChanges,
  listExists,
  listOfChoice,
  type ListsState,
  orderChanges,
  readState,
} from "./list-state.ts";
import { removeEmptyOrders } from "./lists.ts";
import {
  isRecordType,
  readRecordVersions,
  type RecordVersions,
  recordSubject,
} from "./records.ts";
import { recordFits, takingBackRecord } from "./record-drafting.ts";
import { personChanges, recordSensitiveChanges } from "./person-fields.ts";
import { readLive } from "./people-reads.ts";
import {
  hireChanges,
  type HireTier,
  hireIdOf,
  readHireTier,
  recordHiringChanges,
} from "./hire-fields.ts";
import { readHireDrafts, readLiveHires } from "./hire-reads.ts";
import { columnsWithAdded } from "./added-columns.ts";
import { readLiveTeams, readTeamDrafts } from "./feature-team-reads.ts";
import { recordTeamDayChanges } from "./feature-team-days.ts";
import { teamChanges } from "./feature-teams.ts";
import { readFills } from "./fills.ts";
import { readToday } from "./settings.ts";
import { editsDraft } from "./draft-editors.ts";
import {
  changeKey,
  fillKeys,
  linksAmong,
  type OwnDrafts,
  publishableAmong,
  usesAmong,
} from "./unpublished-uses.ts";
import type { TableColumns } from "./values.ts";

type Row = typeof privateChanges.$inferSelect;

// Anyone who may make drafts may publish or discard their own changes.
const requireDrafting = (actor: Actor) => {
  requireAnyPermission(actor, draftingPermissions);
};

// The user's unpublished drafts, in the order they were made.
const ownRows = async (reader: Reader, userId: string): Promise<Row[]> =>
  overPublished(
    reader,
    await reader
      .select()
      .from(privateChanges)
      .where(eq(privateChanges.userId, userId))
      .orderBy(asc(privateChanges.sequence)),
  );

const idsOf = (rows: readonly Row[], recordType: DraftKind) =>
  rows
    .filter((row) => row.recordType === recordType)
    .map(({ recordId }) => recordId);

// Everything the user's unpublished drafts change, as the user sees it, and as everyone else does,
// read together.
interface Versions {
  rows: Row[];
  mine: { lists: ListsState; columns: ColumnsState };
  theirs: { lists: ListsState; columns: ColumnsState };
  people: {
    columns: TableColumns;
    live: Map<string, Recorded>;
    mine: Map<string, Draft>;
    theirs: Map<string, Draft>;
  };
  hires: {
    live: Map<string, Recorded>;
    mine: Map<string, Draft>;
    theirs: Map<string, Draft>;
    tierOf: HireTier;
  };
  teams: {
    live: Map<string, Recorded>;
    mine: Map<string, Draft>;
    theirs: Map<string, Draft>;
  };
  records: RecordVersions;
}

async function readVersions(
  reader: Reader,
  userId: string,
  rows: Row[],
): Promise<Versions> {
  const personIds = idsOf(rows, "person");
  const hireIds = idsOf(rows, "planned-hire");
  const teamIds = idsOf(rows, "feature-team");
  const columns = await columnsWithAdded(reader, userId);
  return {
    rows,
    mine: {
      lists: await readState(reader, userId),
      columns: await readColumnsState(reader, userId),
    },
    theirs: {
      lists: await readState(reader),
      columns: await readColumnsState(reader),
    },
    people: {
      columns,
      live: await readLive(reader, columns, { ids: personIds }),
      mine: await readPersonDrafts(reader, personIds, userId),
      theirs: await readPersonDrafts(reader, personIds),
    },
    hires: {
      live: await readLiveHires(reader, hireIds),
      mine: await readHireDrafts(reader, hireIds, userId),
      theirs: await readHireDrafts(reader, hireIds),
      tierOf: await readHireTier(reader),
    },
    teams: {
      live: (
        await readLiveTeams(reader, await readToday(reader), { ids: teamIds })
      ).teams,
      mine: await readTeamDrafts(reader, teamIds, userId),
      theirs: await readTeamDrafts(reader, teamIds),
    },
    records: await readRecordVersions(reader, userId),
  };
}

// A record as the user sees it, or, where their draft removes it, or wants none of a record only
// drafted to be added, as everyone else does.
function versionOf(
  versions: Versions,
  recordType: DraftKind,
  id: string,
): Recorded | undefined {
  const { mine, theirs } = versions;
  if (recordType === "person") {
    const live = versions.people.live.get(id);
    return (
      drafted(live, versions.people.mine.get(id)) ??
      drafted(live, versions.people.theirs.get(id))
    );
  }
  if (recordType === "planned-hire") {
    const live = versions.hires.live.get(id);
    return (
      drafted(live, versions.hires.mine.get(id)) ??
      drafted(live, versions.hires.theirs.get(id))
    );
  }
  if (recordType === "feature-team") {
    const live = versions.teams.live.get(id);
    return (
      drafted(live, versions.teams.mine.get(id)) ??
      drafted(live, versions.teams.theirs.get(id))
    );
  }
  if (recordType === "list") {
    return draftedList(mine.lists, id) ?? draftedList(theirs.lists, id);
  }
  if (recordType === "list-item") {
    return draftedChoice(mine.lists, id) ?? draftedChoice(theirs.lists, id);
  }
  return draftedField(mine.columns, id) ?? draftedField(theirs.columns, id);
}

const holds =
  (permission: Permission) =>
  (actor: Actor): boolean =>
    actor.permissions.includes(permission);

// Planned hires are read as the change history reads them: with people, and the hiring plan's class.
const readsHires = (actor: Actor): boolean =>
  holds("people:view")(actor) && seesSensitivity(actor, "hiring-plan");

interface OtherKind {
  reads: (actor: Actor) => boolean;
  unseen: string;
}

// Who reads each kind of draft kept outside the plan's records, and how a change to one is named to
// a role that doesn't, since the change may have been made under another role.
const otherKinds: Record<Exclude<DraftKind, RecordType>, OtherKind> = {
  person: { reads: holds("people:view"), unseen: "a person" },
  "planned-hire": { reads: readsHires, unseen: "a planned hire" },
  "feature-team": {
    reads: holds("feature-teams:view"),
    unseen: "a feature team",
  },
  list: { reads: holds("configuration:view"), unseen: "a list" },
  "list-item": { reads: holds("configuration:view"), unseen: "a choice" },
  "choice-order": {
    reads: holds("configuration:view"),
    unseen: "the new order for a list",
  },
  field: { reads: holds("configuration:view"), unseen: "a column" },
};

const otherKindOf = new Map<string, OtherKind>(Object.entries(otherKinds));

// A change of a kind Fathom no longer has, which no role reads, so one stored row can't keep the user
// from seeing the rest of their changes, or discarding them.
const unknownKind: OtherKind = { reads: () => false, unseen: "a change" };

// What a change is to, as the Drafts page names drafts, by name only to a role that reads its kind.
function subjectOf(versions: Versions, row: Row, actor: Actor): string {
  const id = row.recordId;
  // A list's name is always text.
  const listName = (listId: string) =>
    (versionOf(versions, "list", listId)?.name as string | undefined) ??
    "a removed list";
  if (isRecordType(row.recordType)) {
    return recordSubject(versions.records, row.recordType, id, actor);
  }
  const other = otherKindOf.get(row.recordType) ?? unknownKind;
  if (!other.reads(actor)) return other.unseen;
  if (row.recordType === "person") {
    return String(versionOf(versions, "person", id)?.preferredName);
  }
  if (row.recordType === "planned-hire") {
    // A hire is named by its name, or, while it has none, by its position and ID, such as
    // "Software Engineer, TBD-7", or by its ID alone to those who cannot see the Positions list's
    // tier. A hire whose draft is listed is live or drafted, so has a version.
    const hire = versionOf(versions, "planned-hire", id) as Recorded;
    const { requisition, temporaryId } = hireIdOf(hire);
    const position = seesSensitivity(actor, versions.hires.tierOf("positionId"))
      ? String(versionOf(versions, "list-item", String(hire.positionId))?.label)
      : undefined;
    return `the planned hire ${hireCalled(
      typeof hire.name === "string" ? hire.name : null,
      String(requisition ?? temporaryId),
      position,
    )}`;
  }
  if (row.recordType === "feature-team") {
    // A team whose draft is listed is live or drafted, so has a version.
    return `the feature team ${String(versionOf(versions, "feature-team", id)?.name)}`;
  }
  if (row.recordType === "list") return `the list ${listName(id)}`;
  if (row.recordType === "list-item") {
    const choice = versionOf(versions, "list-item", id);
    return `the choice ${String(choice?.label)} in ${listName(String(choice?.listId))}`;
  }
  if (row.recordType === "choice-order") {
    return `the new order for ${listName(id)}`;
  }
  return `the column ${String(versionOf(versions, "field", id)?.name)}`;
}

const orders = new Set(["choice-order"]);

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
  versions: Versions,
): Promise<Set<string>> {
  const taken = new Set<string>();
  for (const id of idsOf(versions.rows, "person")) {
    const person = drafted(
      versions.people.live.get(id),
      versions.people.mine.get(id),
    );
    if (
      person !== undefined &&
      (await takenEmployeeIds(transaction, [String(person.employeeId)], [id]))
        .length > 0
    ) {
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
async function readGoing(
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

async function removeRows(
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
    const taken = await takenPeople(transaction, versions);
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
    await removeEmptyOrders(transaction);
    return { total: rows.length, left };
  });
}

// The changes that take a record back from the user's draft to the published one, or the live
// record.
function takingBack(
  versions: Versions,
  row: Row,
  classes: DataClasses,
): Change[] {
  const id = row.recordId;
  const { mine, theirs } = versions;
  if (isRecordType(row.recordType)) {
    return takingBackRecord(versions.records, row.recordType, id);
  }
  if (row.recordType === "person") {
    const live = versions.people.live.get(id);
    const before = drafted(live, versions.people.mine.get(id));
    const after = drafted(live, versions.people.theirs.get(id));
    return personChanges(
      versions.people.columns,
      id,
      actionTo(before, after),
      before,
      after,
    );
  }
  if (row.recordType === "planned-hire") {
    const live = versions.hires.live.get(id);
    const before = drafted(live, versions.hires.mine.get(id));
    const after = drafted(live, versions.hires.theirs.get(id));
    return hireChanges(
      id,
      actionTo(before, after),
      before,
      after,
      versions.hires.tierOf,
    );
  }
  if (row.recordType === "feature-team") {
    const live = versions.teams.live.get(id);
    const before = drafted(live, versions.teams.mine.get(id));
    const after = drafted(live, versions.teams.theirs.get(id));
    return teamChanges(id, actionTo(before, after), before, after, classes);
  }
  if (row.recordType === "list" || row.recordType === "list-item") {
    const isList = row.recordType === "list";
    const versionIn = isList ? draftedList : draftedChoice;
    const before = versionIn(mine.lists, id);
    const after = versionIn(theirs.lists, id);
    return (isList ? listChanges : choiceChanges)(
      id,
      actionTo(before, after),
      before,
      after,
    );
  }
  if (row.recordType === "choice-order") {
    return orderChanges(
      id,
      draftedOrder(mine.lists, id),
      draftedOrder(theirs.lists, id),
    );
  }
  const before = draftedField(mine.columns, id);
  const after = draftedField(theirs.columns, id);
  return fieldChanges(
    id,
    actionTo(before, after),
    before && columnRow(id, before),
    after && columnRow(id, after),
  );
}

// Discards the actor's unpublished drafts a request chooses, with those that use them, or every one
// when it chooses none, recording the changes that takes back, and returns how many records'
// changes it discarded. Discarding them all ends every change set they were saved in, so none is
// ever published. Discarding some is recorded as discarding each record's draft is: a discard where
// no published draft is left, which no longer credits who changed it, and an edit back to the
// published draft otherwise, both published with the user's next changes.
export async function discardUnpublished(
  database: Database,
  actor: Actor,
  chosen?: DraftsRequest,
): Promise<number> {
  requireDrafting(actor);
  return database.transaction(async (transaction) => {
    await lockDrafts(transaction);
    const userId = actor.user.id;
    const { versions, rows } = await readGoing(
      transaction,
      userId,
      chosen,
      "discard",
    );
    if (rows.length === 0) return 0;
    const takenBack = (some: readonly Row[]) =>
      asDraft(
        some.flatMap((row) => takingBack(versions, row, actor.dataClasses)),
      );
    const record = async (made: readonly Change[]) => {
      await recordSensitiveChanges(transaction, userId, made);
      await recordHiringChanges(transaction, userId, made);
      await recordTeamDayChanges(transaction, userId, made);
    };
    if (chosen === undefined) {
      const made = takenBack(rows);
      await removeRows(transaction, userId, rows);
      await record(made);
      await recordChanges(transaction, actor, made, "withdrawal");
      return rows.length;
    }
    const published = await draftKeys(transaction, rows);
    const toPublished = takenBack(
      rows.filter((row) => published.has(changeKey(row))),
    );
    const toNone = takenBack(
      rows.filter((row) => !published.has(changeKey(row))),
    );
    await removeRows(transaction, userId, rows);
    await record([...toNone, ...toPublished]);
    await recordChanges(transaction, actor, toNone, "discard");
    await recordChanges(transaction, actor, toPublished);
    return rows.length;
  });
}
