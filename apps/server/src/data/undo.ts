// SPDX-License-Identifier: Apache-2.0

// Undoing a change set: putting back the old values of everything it changed, recorded as a new
// change set. Part of the data access layer.

import {
  changes,
  changeSets,
  type Database,
  databaseCodes,
  hasDatabaseCode,
  listItems,
  lists,
  people,
  type Reader,
  savedViews,
} from "@fathom/db";
import {
  type DraftKind,
  recordTypeSchema,
  seesClass,
  type Tier,
} from "@fathom/shared";
import { and, asc, eq, gt, inArray, or, sql } from "drizzle-orm";
import { madeWithColumn } from "./new-lists.ts";
import {
  type Actor,
  mostSensitive,
  requirePermission,
  requireSensitivityEdit,
  type Sensitivity,
  storedTier,
  tierOfSensitivity,
} from "../access.ts";
import { columnsWithAdded } from "./added-columns.ts";
import { ConflictError, ForbiddenError, NotFoundError } from "../errors.ts";
import {
  type RecordType,
  recordChanges,
  type StoredChange,
  type Transaction,
} from "./changes.ts";
import { lockDrafts, setRejection } from "./drafts.ts";
import { rejectedField } from "./draft-records.ts";
import { columnAsSeenBy } from "./column-state.ts";
import { editsDraft } from "./draft-editors.ts";
import { lockFields } from "./fields.ts";
import { removeEmptyOrders } from "./lists.ts";
import {
  peopleFitColumns,
  personTier,
  recordSensitiveChanges,
} from "./person-fields.ts";
import { requireViewUndo, type ViewNow, viewNow } from "./views.ts";
import { undoTeamDrafts } from "./feature-team-undo.ts";
import { recordTeamDayChanges } from "./feature-teams.ts";
import {
  hireSensitivities,
  readHireTier,
  recordHiringChanges,
} from "./hire-fields.ts";
import { undoHireDrafts } from "./hire-approvals.ts";
import {
  byKind,
  changedSince,
  recordsOf,
  recreate,
  remove,
  restore,
  reversed,
  type Undone,
} from "./undo-records.ts";
import {
  undoColumnDrafts,
  undoListDrafts,
  undoPersonDrafts,
  undoSettingsDrafts,
} from "./undo-drafts.ts";

// The more sensitive of two tiers.
const higher = (first: Tier, second: Tier): Tier =>
  mostSensitive([first, second]);

// The identifiers of the records of one kind.
const idsOf = (records: readonly Undone[], kind: RecordType) =>
  records.filter((record) => record.recordType === kind).map(({ id }) => id);

// Kinds of the plan's records, whose changes are not undone yet. The planning settings are left
// out: they link to nothing, so putting back their draft breaks no rule across records.
const planRecordTypes: ReadonlySet<string> = new Set(
  recordTypeSchema.options.filter((type) => type !== "planning-settings"),
);

// A feature team's joining, leaving and lead days are Personal, yet those who edit teams without
// Personal details may draft some of them, so undoing checks the days themselves, as drafting them does.
const isTeamDay = ({ recordType, field }: StoredChange) =>
  recordType === "feature-team" &&
  (field === "memberFrom" || field === "leadFrom");

// The permissions each kind of record needs to change it. Planned hires also need the hiring plan,
// checked with its class.
const editPermissions = {
  list: ["configuration:edit"],
  "list-item": ["configuration:edit"],
  "choice-order": ["configuration:edit"],
  // Editing them is checked for each column's table.
  field: [],
  person: ["people:edit"],
  "planned-hire": ["people:edit"],
  // Editing them is checked for the teams themselves.
  "feature-team": ["feature-teams:view"],
  // Who may change each view, by opening its table's page, is checked for the view itself.
  "saved-view": [],
  "planning-settings": ["configuration:edit"],
} as const;

// Whether a change set adds or discards a column only drafted to be added, as Features' and
// Activities' column dialogs do with a new list.
const addsOrDiscardsColumn = (records: readonly Undone[]): boolean =>
  records.some(
    ({ recordType, action, draft }) =>
      recordType === "field" &&
      draft &&
      (action === "created" || action === "deleted"),
  );

// A new list drafted with a column, and its choices, go with the column: their drafts, added or
// discarded in a change set that adds or discards a column, are undone by whoever may undo the
// column, checked with it. Only a list made in one change with a column, as New list does, counts.
async function goesWithColumn(
  reader: Reader,
  records: readonly Undone[],
  record: Undone,
): Promise<boolean> {
  return (
    record.draft &&
    (record.recordType === "list" || record.recordType === "list-item") &&
    (record.action === "created" || record.action === "deleted") &&
    addsOrDiscardsColumn(records) &&
    (await madeWithColumn(reader, record.recordType, record.id))
  );
}

// Lists and columns change class live only when moved, which needs Classify data now, so a move is
// moved back rather than undone.
const isClassMove = ({ recordType, draft, action, old }: Undone): boolean =>
  (recordType === "list" || recordType === "field") &&
  !draft &&
  action === "changed" &&
  old.has("visibility");

// Locks every live record the undo changes that still exists, in the order other changes lock
// them: lists, then their choices, then columns, then people, then saved views. Records it changes
// only in their drafts, such as hires, feature teams and the planning settings, need only the
// drafts' lock. A change saved at the same moment either finishes first, and is then seen as a
// change since, or waits for the undo.
async function lockRecords(
  transaction: Transaction,
  records: readonly Undone[],
): Promise<void> {
  const choiceIds = idsOf(records, "list-item");
  const choiceLists = await transaction
    .select({ listId: listItems.listId })
    .from(listItems)
    .where(inArray(listItems.id, choiceIds));
  const listIds = [
    ...idsOf(records, "list"),
    ...choiceLists.map(({ listId }) => listId),
    // A deleted choice's list, which the undo puts it back in.
    ...records.flatMap((record) => {
      const listId = record.old.get("listId");
      return record.recordType === "list-item" && typeof listId === "string"
        ? [listId]
        : [];
    }),
  ];
  await transaction
    .select({ id: lists.id })
    .from(lists)
    .where(inArray(lists.id, [...new Set(listIds)]))
    .orderBy(asc(lists.id))
    .for("update");
  await transaction
    .select({ id: listItems.id })
    .from(listItems)
    .where(inArray(listItems.id, choiceIds))
    .orderBy(asc(listItems.id))
    .for("update");
  await lockFields(transaction);
  await transaction
    .select({ id: people.id })
    .from(people)
    .where(inArray(people.id, idsOf(records, "person")))
    .orderBy(asc(people.id))
    .for("update");
  await transaction
    .select({ id: savedViews.id })
    .from(savedViews)
    .where(inArray(savedViews.id, idsOf(records, "saved-view")))
    .orderBy(asc(savedViews.id))
    .for("update");
}

async function undoIn(
  transaction: Transaction,
  actor: Actor,
  changeSetId: string,
): Promise<string | null> {
  const [changeSet] = await transaction
    .select()
    .from(changeSets)
    .where(eq(changeSets.id, changeSetId));
  // Unpublished changes are seen only by their maker, so for anyone else they are not there.
  if (
    changeSet === undefined ||
    (changeSet.private && changeSet.madeBy !== actor.user.id)
  ) {
    throw new NotFoundError();
  }
  if (changeSet.madeBy !== actor.user.id) {
    throw new ForbiddenError("Only the person who made a change can undo it");
  }
  if (changeSet.kind === "approval" || changeSet.kind === "rejection") {
    throw new ConflictError(
      "Approving and rejecting drafts cannot be undone; change the draft or the data instead",
    );
  }
  // Undoing the same change twice at once: the second waits, then finds the first's changes since.
  await transaction.execute(
    sql`SELECT pg_advisory_xact_lock(hashtextextended(${changeSetId}, 0))`,
  );
  const rows = await transaction
    .select()
    .from(changes)
    .where(eq(changes.changeSetId, changeSetId))
    .orderBy(asc(changes.id));
  const records = recordsOf(rows);
  if (records.some(isClassMove)) {
    throw new ConflictError(
      "A change of class can't be undone; change it back instead",
    );
  }
  if (records.some(({ recordType }) => planRecordTypes.has(recordType))) {
    throw new ConflictError(
      "Changes to the plan and allocations can't be undone yet; change or discard the draft instead",
    );
  }
  // Before the planning settings were drafted, their changes were saved live, with nothing to put
  // back but the live row.
  if (
    records.some(
      ({ recordType, draft }) => recordType === "planning-settings" && !draft,
    )
  ) {
    throw new ConflictError(
      "This change to the planning settings can't be undone; change them instead",
    );
  }
  for (const record of records) {
    if (await goesWithColumn(transaction, records, record)) continue;
    for (const permission of editPermissions[
      record.recordType as keyof typeof editPermissions
    ]) {
      requirePermission(actor, permission);
    }
    if (record.recordType === "field") {
      // A column's removal records the table it was on; otherwise it is still there to read.
      const recorded = record.old.get("tableName");
      const column =
        typeof recorded === "string"
          ? { tableName: recorded }
          : await columnAsSeenBy(transaction, actor.user.id, record.id);
      if (column === undefined) throw new ConflictError(changedSince);
      if (!editsDraft(actor, "field", column)) throw new ForbiddenError();
    }
  }
  if (records.some(({ recordType }) => recordType === "planned-hire")) {
    requireSensitivityEdit(actor, "hiring-plan");
  }
  const draftRecords = records.filter(({ draft }) => draft);
  const liveRecords = records.filter(({ draft }) => !draft);
  // Drafts are locked before any row, as every change to them does, so an undo that changes a
  // draft, or removes a choice or column one could be given, waits for them.
  await lockDrafts(transaction);
  await lockRecords(transaction, records);
  // A person's details are as sensitive as they are now, such as a position or a column's values
  // as their list, or were when they changed, whichever is more sensitive, as are a hire's, whose
  // own details need Edit Hiring plan instead.
  const tierNow = personTier(await columnsWithAdded(transaction, undefined));
  const hireTierNow = await readHireTier(transaction);
  // So is a saved view's history, as sensitive as the columns it uses are now.
  const views = new Map<string, ViewNow>();
  for (const record of records) {
    if (record.recordType === "saved-view") {
      const held = rows
        .filter(
          (row) => row.recordId === record.id && row.field === "definition",
        )
        .flatMap((row) => [row.oldValue, row.newValue]);
      views.set(record.id, await viewNow(transaction, actor, record.id, held));
    }
  }
  const undoing = reversed(rows).map((change) => {
    if (change.recordType === "person") {
      return { ...change, tier: higher(change.tier, tierNow(change.field)) };
    }
    if (change.recordType === "planned-hire") {
      return {
        ...change,
        tier: higher(change.tier, hireTierNow(change.field)),
      };
    }
    return change.recordType === "saved-view"
      ? {
          ...change,
          // Every view the change set changed has its tier, found just above.
          tier: higher(
            change.tier,
            (views.get(change.recordId) as ViewNow).tier,
          ),
        }
      : change;
  });
  // Each tier is its own permission, so the actor needs every tier a change had and has now, not
  // only the most sensitive. A view's tier is that of the columns it uses, which its maker needs
  // only to see.
  const tiersOf = (change: StoredChange): Sensitivity[] => {
    const recorded = storedTier(change.tier);
    if (change.recordType === "person") {
      return [recorded, tierNow(change.field)];
    }
    if (change.recordType === "planned-hire") {
      return hireSensitivities(change.field, [
        recorded,
        hireTierNow(change.field),
      ]);
    }
    if (change.recordType === "saved-view") {
      return [recorded, (views.get(change.recordId) as ViewNow).tier];
    }
    return [recorded];
  };
  for (const change of rows) {
    for (const tier of new Set(tiersOf(change))) {
      if (change.recordType === "saved-view") {
        if (
          !seesClass(
            actor.permissions,
            tierOfSensitivity(actor.dataClasses)(tier),
          )
        ) {
          throw new ForbiddenError();
        }
      } else if (tier !== "general" && !isTeamDay(change)) {
        requireSensitivityEdit(actor, tier);
      }
    }
  }
  for (const record of records) {
    if (record.recordType === "saved-view") {
      await requireViewUndo(
        transaction,
        actor,
        record.id,
        // Every view the change set changed has its table, found above.
        (views.get(record.id) as ViewNow).table,
        record.old,
      );
    }
  }
  // Only changes the user may see count: another user's unpublished changes stay theirs, and a
  // record they hold refuses the undo for that reason instead.
  const later = await transaction
    .select({ id: changes.id })
    .from(changes)
    .innerJoin(changeSets, eq(changeSets.id, changes.changeSetId))
    .where(
      and(
        gt(changes.id, Math.max(...rows.map(({ id }) => id))),
        or(eq(changeSets.private, false), eq(changeSets.madeBy, actor.user.id)),
        or(
          ...records.map((record) =>
            and(
              eq(changes.recordType, record.recordType),
              eq(changes.recordId, record.id),
            ),
          ),
        ),
      ),
    )
    .limit(1);
  if (later.length > 0) throw new ConflictError(changedSince);
  // Sending rejected drafts again changed the published drafts, so undoing it rejects them again.
  if (changeSet.kind === "resubmission") {
    for (const record of draftRecords) {
      await setRejection(
        transaction,
        record.recordType as DraftKind,
        [record.id],
        {
          state: "rejected",
          reason: String(record.old.get(rejectedField)),
        },
      );
    }
    await recordSensitiveChanges(transaction, actor.user.id, undoing);
    await recordHiringChanges(transaction, actor.user.id, undoing);
    return recordChanges(transaction, actor, undoing, "edit", false);
  }

  const ascending = [...liveRecords].sort((a, b) => byKind(a) - byKind(b));
  for (const record of ascending.filter(({ action }) => action === "deleted")) {
    await recreate(transaction, record);
  }
  for (const record of ascending.filter(({ action }) => action === "changed")) {
    await restore(transaction, record);
  }
  const created = ascending.filter(({ action }) => action === "created");
  // People added together, such as pasted rows, are removed in one statement.
  const addedPeople = idsOf(created, "person");
  await transaction.delete(people).where(inArray(people.id, addedPeople));
  for (const record of created
    .filter((record) => record.recordType !== "person")
    .reverse()) {
    await remove(transaction, record);
  }
  const personDrafts = draftRecords.filter(
    ({ recordType }) => recordType === "person",
  );
  const hireDrafts = draftRecords.filter(
    ({ recordType }) => recordType === "planned-hire",
  );
  const teamDrafts = draftRecords.filter(
    ({ recordType }) => recordType === "feature-team",
  );
  if (teamDrafts.length > 0) {
    await undoTeamDrafts(transaction, actor, teamDrafts, changedSince);
  }
  const columnDrafts = draftRecords.filter(
    ({ recordType }) => recordType === "field",
  );
  const listKinds: readonly RecordType[] = [
    "list",
    "list-item",
    "choice-order",
  ];
  const listDrafts = draftRecords.filter(({ recordType }) =>
    listKinds.includes(recordType),
  );
  // Columns added are taken back first, so their new lists no longer have them to draw on; the
  // rest come back after the lists, so they have their lists to draw on.
  const addedColumns = columnDrafts.filter(
    ({ action, draft }) => draft && action === "created",
  );
  const otherColumns = columnDrafts.filter(
    (record) => !addedColumns.includes(record),
  );
  if (addedColumns.length > 0) {
    await undoColumnDrafts(transaction, actor, addedColumns);
  }
  if (listDrafts.length > 0) {
    await undoListDrafts(transaction, actor, listDrafts);
    await removeEmptyOrders(transaction, actor.user.id);
  }
  if (otherColumns.length > 0) {
    await undoColumnDrafts(transaction, actor, otherColumns);
  }
  const settingsDrafts = draftRecords.filter(
    ({ recordType }) => recordType === "planning-settings",
  );
  if (settingsDrafts.length > 0) {
    await undoSettingsDrafts(transaction, actor.user.id, settingsDrafts);
  }
  // Hires come before people, so undoing a fill puts a planned manager's hires back under it before
  // its person's Manager? mark comes off.
  if (hireDrafts.length > 0) {
    await undoHireDrafts(transaction, actor.user.id, hireDrafts, changedSince);
  }
  if (personDrafts.length > 0) {
    await undoPersonDrafts(
      transaction,
      actor.user.id,
      await columnsWithAdded(transaction, actor.user.id),
      personDrafts,
      hireDrafts.map(({ id }) => id),
    );
  }
  // The people put back must still fit their columns as they are now.
  const restored = liveRecords.filter(
    (record) => record.recordType === "person" && record.action !== "created",
  );
  if (
    !(await peopleFitColumns(
      transaction,
      restored.map(({ id }) => id),
    ))
  ) {
    throw new ConflictError(changedSince);
  }
  await recordSensitiveChanges(transaction, actor.user.id, undoing);
  await recordHiringChanges(transaction, actor.user.id, undoing);
  await recordTeamDayChanges(transaction, actor.user.id, undoing);
  return recordChanges(transaction, actor, undoing);
}

// Undoes a change set the actor made, and returns the change set that undid it.
export async function undoChangeSet(
  database: Database,
  actor: Actor,
  changeSetId: string,
): Promise<string | null> {
  try {
    return await database.transaction((transaction) =>
      undoIn(transaction, actor, changeSetId),
    );
  } catch (error) {
    // Something the undo would put back conflicts with a change made since, such as a name now
    // taken or a choice now deleted.
    if (
      [
        databaseCodes.uniqueViolation,
        databaseCodes.foreignKeyViolation,
        databaseCodes.restrictViolation,
        databaseCodes.checkViolation,
      ].some((code) => hasDatabaseCode(error, code))
    ) {
      throw new ConflictError(changedSince);
    }
    throw error;
  }
}
