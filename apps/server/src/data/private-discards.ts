// SPDX-License-Identifier: Apache-2.0

// Discarding a user's private changes, all at once or those chosen, recording what takes each
// record back. Part of the data access layer.

import { type Database } from "@fathom/db";
import { type DataClasses, type DraftsRequest } from "@fathom/shared";

import { type Actor } from "../access.ts";
import { type Change, recordChanges } from "./changes.ts";
import { columnRow, draftedField } from "./column-state.ts";
import { actionTo, asDraft, drafted } from "./draft-records.ts";
import { draftKeys } from "./draft-makers.ts";
import { lockDrafts } from "./drafts.ts";
import { fieldChanges } from "./fields.ts";
import {
  choiceChanges,
  draftedChoice,
  draftedList,
  draftedOrder,
  listChanges,
  orderChanges,
} from "./list-state.ts";
import { isRecordType } from "./records.ts";
import { takingBackRecord } from "./record-drafting.ts";
import { personChanges, recordSensitiveChanges } from "./person-fields.ts";
import { hireChanges, recordHiringChanges } from "./hire-fields.ts";
import { recordTeamDayChanges, teamChanges } from "./feature-teams.ts";
import { changeKey } from "./unpublished-uses.ts";
import {
  requireDrafting,
  type Row,
  type Versions,
} from "./private-versions.ts";
import { readGoing, removeRows } from "./unpublished.ts";

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
