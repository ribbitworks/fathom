// SPDX-License-Identifier: Apache-2.0

// A user's unpublished changes to drafts, as ADR 0008 sets out: listing them, publishing them all
// at once, so they wait for approval and everyone who sees the records sees them, and discarding
// them all at once. Part of the data access layer. Publishing writes each unpublished draft over
// the published draft of the same record, or removes the published draft when the user wants none,
// and publishes the change sets that hold the changes; discarding records the changes it takes
// back, as a change set only the user sees, so the change sets it ends are never published.

import {
  changes,
  changeSets,
  type Database,
  drafts,
  unpublishedDrafts,
} from "@fathom/db";
import type { DraftKind, Unpublished } from "@fathom/shared";
import { and, asc, eq, max } from "drizzle-orm";
import {
  type Actor,
  requireAnyPermission,
  seesSensitivity,
} from "../access.ts";
import { ConflictError } from "../errors.ts";
import { type Change, recordChanges, type Transaction } from "./changes.ts";
import {
  columnOrderChanges,
  columnRow,
  type ColumnsState,
  draftedColumnOrder,
  draftedField,
  nameTaken,
  readColumnsState,
  removeEmptyColumnOrder,
} from "./column-drafts.ts";
import {
  asDraft,
  type Draft,
  drafted,
  lockDrafts,
  openChangeSets,
  readPersonDrafts,
  type Recorded,
  takenEmployeeIds,
  wantsNoDraft,
} from "./drafts.ts";
import { typeOf } from "./column-types.ts";
import { fieldChanges } from "./fields.ts";
import {
  choiceChanges,
  choiceLabelTaken,
  draftedChoice,
  draftedList,
  draftedOrder,
  listChanges,
  listExists,
  listNameTaken,
  listOfChoice,
  type ListsState,
  keptOffered,
  orderChanges,
  readState,
  removeEmptyOrders,
} from "./lists.ts";
import {
  isRecordType,
  readRecordVersions,
  recordFits,
  type RecordVersions,
  recordSubject,
  takingBackRecord,
} from "./records.ts";
import { personChanges, readLive, recordSensitiveChanges } from "./people.ts";
import {
  hireChanges,
  type HireTier,
  hireIdOf,
  readHireDrafts,
  readHireTier,
  readLiveHires,
  recordHiringChanges,
} from "./hires.ts";
import { columnsWithAdded } from "./added-columns.ts";
import type { PeopleColumns } from "./values.ts";

type Reader = Pick<Database, "select">;
type Row = typeof unpublishedDrafts.$inferSelect;

// Anyone who may make drafts may publish or discard their own changes.
const requireDrafting = (actor: Actor) => {
  requireAnyPermission(actor, [
    "people:edit",
    "configuration:edit",
    "plan:edit",
  ]);
};

// The user's unpublished drafts, in the order they were made.
const ownRows = (reader: Reader, userId: string): Promise<Row[]> =>
  reader
    .select()
    .from(unpublishedDrafts)
    .where(eq(unpublishedDrafts.userId, userId))
    .orderBy(asc(unpublishedDrafts.sequence));

const idsOf = (rows: readonly Row[], recordType: DraftKind) =>
  rows
    .filter((row) => row.recordType === recordType)
    .map(({ recordId }) => recordId);

// The action that takes a record from one version to another.
function actionTo(
  before: Recorded | undefined,
  after: Recorded | undefined,
): Change["action"] {
  if (before === undefined) return "created";
  return after === undefined ? "deleted" : "changed";
}

// Everything the user's unpublished drafts change, as the user sees it, and as everyone else does,
// read together.
interface Versions {
  rows: Row[];
  mine: { lists: ListsState; columns: ColumnsState };
  theirs: { lists: ListsState; columns: ColumnsState };
  people: {
    columns: PeopleColumns;
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
  records: RecordVersions;
}

async function readVersions(
  reader: Reader,
  userId: string,
  rows: Row[],
): Promise<Versions> {
  const personIds = idsOf(rows, "person");
  const hireIds = idsOf(rows, "planned-hire");
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
  if (recordType === "list") {
    return draftedList(mine.lists, id) ?? draftedList(theirs.lists, id);
  }
  if (recordType === "list-item") {
    return draftedChoice(mine.lists, id) ?? draftedChoice(theirs.lists, id);
  }
  return draftedField(mine.columns, id) ?? draftedField(theirs.columns, id);
}

// What a change is to, as the Drafts page names drafts.
function subjectOf(versions: Versions, row: Row, actor: Actor): string {
  const id = row.recordId;
  // A list's name is always text.
  const listName = (listId: string) =>
    (versionOf(versions, "list", listId)?.name as string | undefined) ??
    "a removed list";
  if (isRecordType(row.recordType)) {
    return recordSubject(versions.records, row.recordType, id);
  }
  if (row.recordType === "person") {
    return String(versionOf(versions, "person", id)?.preferredName);
  }
  if (row.recordType === "planned-hire") {
    // A hire is named by its name, or, while it has none, by its position and ID, such as
    // "Software Engineer, TBD-7", or by its ID alone to those who cannot see the Positions list's
    // tier. A hire whose draft is listed is live or drafted, so has a version.
    const hire = versionOf(versions, "planned-hire", id) as Recorded;
    if (typeof hire.name === "string") return `the planned hire ${hire.name}`;
    const { requisition, temporaryId } = hireIdOf(hire);
    const shownId = String(requisition ?? temporaryId);
    if (!seesSensitivity(actor, versions.hires.tierOf("positionId"))) {
      return `the planned hire ${shownId}`;
    }
    const position = versionOf(versions, "list-item", String(hire.positionId));
    return `the planned hire ${String(position?.label)}, ${shownId}`;
  }
  if (row.recordType === "list") return `the list ${listName(id)}`;
  if (row.recordType === "list-item") {
    const choice = versionOf(versions, "list-item", id);
    return `the choice ${String(choice?.label)} in ${listName(String(choice?.listId))}`;
  }
  if (row.recordType === "choice-order") {
    return `the new order for ${listName(id)}`;
  }
  if (row.recordType === "field") {
    return `the column ${String(versionOf(versions, "field", id)?.name)}`;
  }
  return "the new order for People's columns";
}

const orders = new Set(["choice-order", "column-order"]);

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
          `${recordType} ${recordId}`,
          Number(last),
        ]),
      );
      const versions = await readVersions(transaction, userId, rows);
      // Every unpublished draft is saved with the changes that make it.
      const last = (row: Row) =>
        lastOf.get(`${row.recordType} ${row.recordId}`) as number;
      const newest = [...rows].sort(
        (first, second) => last(second) - last(first),
      );
      return {
        changes: newest.map((row) => ({
          subject: subjectOf(versions, row, actor),
          ...(wantsNoDraft(row) ? { discarded: true } : {}),
          ...(orders.has(row.recordType) || wantsNoDraft(row)
            ? {}
            : { action: row.action as Change["action"] }),
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
  if (row.recordType === "column-order" || wantsNoDraft(row)) return true;
  if (isRecordType(row.recordType)) {
    return recordFits(versions.records, row.recordType, id);
  }
  if (row.recordType === "choice-order") {
    return draftedList(lists, id) !== undefined;
  }
  if (row.recordType === "person") return !taken.has(id);
  if (row.recordType === "planned-hire") return true;
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
  if (nameTaken(columns, String(field.name), id)) return false;
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

// Publishes every one of the actor's unpublished drafts, all together or none, and returns how many
// records' changes it published.
export async function publishUnpublished(
  database: Database,
  actor: Actor,
): Promise<number> {
  requireDrafting(actor);
  return database.transaction(async (transaction) => {
    await lockDrafts(transaction);
    const userId = actor.user.id;
    const rows = await ownRows(transaction, userId);
    if (rows.length === 0) return 0;
    const versions = await readVersions(transaction, userId, rows);
    const taken = await takenPeople(transaction, versions);
    const misfit = rows.find((row) => !fits(versions, row, taken));
    if (misfit !== undefined) {
      throw new ConflictError(
        `Your change to ${subjectOf(versions, misfit, actor)} no longer fits the data as it is now; change or discard it, then publish again`,
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
    await transaction
      .delete(unpublishedDrafts)
      .where(eq(unpublishedDrafts.userId, userId));
    await transaction
      .update(changeSets)
      .set({ unpublished: false })
      .where(openChangeSets(userId));
    await removeEmptyOrders(transaction);
    await removeEmptyColumnOrder(transaction);
    return rows.length;
  });
}

// The changes that take a record back from the user's draft to the published one, or the live
// record.
function takingBack(versions: Versions, row: Row): Change[] {
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
  if (row.recordType === "field") {
    const before = draftedField(mine.columns, id);
    const after = draftedField(theirs.columns, id);
    return fieldChanges(
      id,
      actionTo(before, after),
      before && columnRow(id, before),
      after && columnRow(id, after),
    );
  }
  return columnOrderChanges(
    draftedColumnOrder(mine.columns),
    draftedColumnOrder(theirs.columns),
  );
}

// Discards every one of the actor's unpublished drafts, recording the changes that takes back, and
// returns how many records' changes it discarded.
export async function discardUnpublished(
  database: Database,
  actor: Actor,
): Promise<number> {
  requireDrafting(actor);
  return database.transaction(async (transaction) => {
    await lockDrafts(transaction);
    const userId = actor.user.id;
    const rows = await ownRows(transaction, userId);
    if (rows.length === 0) return 0;
    const versions = await readVersions(transaction, userId, rows);
    const made = asDraft(rows.flatMap((row) => takingBack(versions, row)));
    await transaction
      .delete(unpublishedDrafts)
      .where(eq(unpublishedDrafts.userId, userId));
    await recordSensitiveChanges(transaction, userId, made);
    await recordHiringChanges(transaction, userId, made);
    await recordChanges(transaction, userId, made, "withdrawal");
    return rows.length;
  });
}
