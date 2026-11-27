// SPDX-License-Identifier: Apache-2.0

// Withdrawing a user's private changes: the changes that return each record to the version
// everyone else sees, recorded as the user's own, with the access history they write. Part of the
// data access layer.

import {
  type ChangeMaker,
  type ChangeRecord,
  type ChangeSetKind,
} from "@fathom/db";
import { type DataClasses } from "@fathom/shared";
import { type Change, recordChangesAs, type Transaction } from "./changes.ts";
import { columnRow, draftedField } from "./column-state.ts";
import { actionTo, asDraft, drafted } from "./draft-records.ts";
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
import { removeRows, type Row, type Versions } from "./private-versions.ts";

// The changes that take a record back from the user's draft to the published one, or the live
// record.
export function takingBack(
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

// Some of a user's private changes, taken back as one change set of a kind, with what takes back a
// row whose draft is now no different from everyone else's, when it isn't nothing.
export interface Withdrawal {
  kind: ChangeSetKind;
  rows: readonly Row[];
  otherwise?: (row: Row) => ChangeRecord[];
}

// The action that undoes each, so a change taken back reads as what it does.
const undoing: Record<Change["action"], Change["action"]> = {
  created: "deleted",
  changed: "changed",
  deleted: "created",
};

// A change undone, by the action and values that undo it.
export const undone = <
  Made extends ChangeRecord & { action: Change["action"] },
>(
  change: Made,
): Made => ({
  ...change,
  action: undoing[change.action],
  oldValue: change.newValue,
  newValue: change.oldValue,
});

// The changes giving up some fields of a user's private change for the values everyone else sees.
export const givingUp = (
  versions: Versions,
  row: Row,
  fields: ReadonlySet<string>,
  classes: DataClasses,
): Change[] =>
  takingBack(versions, row, classes).filter(({ field }) => fields.has(field));

// Records changes taking back a user's private changes as change sets of theirs, each of a kind,
// with the access history the changes write; what is recorded besides them changes no value.
export async function recordTakingBack(
  transaction: Transaction,
  maker: ChangeMaker,
  made: readonly {
    kind: ChangeSetKind;
    changes: Change[];
    recorded?: readonly ChangeRecord[];
  }[],
): Promise<void> {
  const all = made.flatMap(({ changes }) => changes);
  await recordSensitiveChanges(transaction, maker.userId, all);
  await recordHiringChanges(transaction, maker.userId, all);
  await recordTeamDayChanges(transaction, maker.userId, all);
  for (const { kind, changes, recorded = changes } of made) {
    await recordChangesAs(transaction, maker, recorded, kind);
  }
}

// Takes back a user's private changes, from the versions given, removing them and recording each
// withdrawal as a change set of theirs, with the access history taking them back writes.
export async function withdraw(
  transaction: Transaction,
  maker: ChangeMaker,
  versions: Versions,
  withdrawals: readonly Withdrawal[],
  classes: DataClasses,
): Promise<void> {
  // A row with nothing to take back changes no value, so writes no access history.
  const made = withdrawals.map(({ kind, rows, otherwise }) => {
    const taken = rows.map((row) => ({
      row,
      changes: asDraft(takingBack(versions, row, classes)),
    }));
    return {
      kind,
      changes: taken.flatMap(({ changes }) => changes),
      recorded: taken.flatMap(({ row, changes }): readonly ChangeRecord[] =>
        changes.length > 0 || otherwise === undefined
          ? changes
          : otherwise(row),
      ),
    };
  });
  await removeRows(
    transaction,
    maker.userId,
    withdrawals.flatMap(({ rows }) => rows),
  );
  await recordTakingBack(transaction, maker, made);
}
