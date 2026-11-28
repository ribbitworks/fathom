// SPDX-License-Identifier: Apache-2.0

// The checks publishing private changes makes: each change is checked by the rules a fresh change of
// its kind goes through, against the data as it is now. Part of the data access layer.

import { capitalized, type DraftKind, type RecordType } from "@fathom/shared";
import { type Actor } from "../access.ts";
import { ConflictError, RequestError } from "../errors.ts";
import { refuseAllocatedActivity } from "./activities.ts";
import { checkColumnDraft } from "./column-checks.ts";
import { checkAllocationDraft } from "./allocations.ts";
import { type Transaction } from "./changes.ts";
import { drafted, type Recorded, wantsNoDraft } from "./draft-records.ts";
import { columnsWithAdded } from "./added-columns.ts";
import { checkPersonChange, checkPersonRemoval } from "./person-checks.ts";
import { refuseFeatureFieldChanges } from "./feature-field-editors.ts";
import {
  checkChoiceDraft,
  checkListDraft,
  checkOrderDraft,
  type ListDraft,
} from "./list-checks.ts";
import {
  checkPlanningDraft,
  planningColumns,
  type PlanningTable,
} from "./planning-records.ts";
import {
  readsChange,
  type Row,
  subjectOf,
  type Versions,
} from "./private-versions.ts";
import { checkOwnerDraft, checkProposalDraft } from "./projects.ts";
import { recordMisfit } from "./record-drafting.ts";
import { versionOf } from "./record-state.ts";
import { readToday } from "./settings.ts";
import { type ColumnInfo, type TableColumns } from "./values.ts";
import { isRecordType, recordKinds } from "./records.ts";

interface Checking {
  transaction: Transaction;
  actor: Actor;
  versions: Versions;
  // The People table's columns, as the user sees them, read once.
  peopleColumns: () => Promise<TableColumns>;
  // Today, read once, when a check first needs it.
  today: () => Promise<string>;
  // The columns added to a planning table, as the user sees them, read once for each table.
  columnsOf: (table: PlanningTable) => Promise<readonly ColumnInfo[]>;
}

// A record of the plan as the user's draft makes it, or undefined for its removal, against the
// record as everyone else has it.
interface RecordDraft {
  checking: Checking;
  id: string;
  after: Recorded | undefined;
  before: Recorded | undefined;
}

// A kind of record's own rules beyond those across records.
type RecordCheck = (draft: RecordDraft) => Promise<void>;

const noCheck: RecordCheck = () => Promise.resolve();

// A record's own rules where it is kept, not removed.
const whenKept =
  (
    check: (draft: RecordDraft & { after: Recorded }) => Promise<void>,
  ): RecordCheck =>
  ({ after, ...draft }) =>
    after === undefined ? Promise.resolve() : check({ ...draft, after });

const planningCheck = (table: PlanningTable) =>
  whenKept(async ({ checking, after, before }) => {
    const { transaction, actor, columnsOf } = checking;
    await checkPlanningDraft(
      transaction,
      actor.user.id,
      await columnsOf(table),
      after,
      before,
    );
  });

// Each kind of the plan's records, by its own rules; every kind must be listed, which the compiler
// checks.
const recordChecks: Record<RecordType, RecordCheck> = {
  "release-stream": noCheck,
  "cycle-pattern": noCheck,
  release: noCheck,
  feature: async (draft) => {
    refuseFeatureFieldChanges(draft.checking.actor, draft.before, draft.after);
    await planningCheck("features")(draft);
  },
  customer: noCheck,
  proposal: whenKept(async ({ checking, after, before }) =>
    checkProposalDraft(
      checking.transaction,
      checking.actor,
      after,
      before,
      await checking.today(),
    ),
  ),
  project: whenKept(async ({ checking, after, before }) =>
    checkOwnerDraft(
      checking.transaction,
      checking.actor,
      after,
      before,
      await checking.today(),
    ),
  ),
  milestone: noCheck,
  activity: (draft) => {
    const { transaction, actor, versions } = draft.checking;
    return draft.after === undefined
      ? refuseAllocatedActivity(
          transaction,
          versions.records.mine,
          draft.id,
          actor,
        )
      : planningCheck("activities")(draft);
  },
  allocation: whenKept(async ({ checking, after, before }) =>
    checkAllocationDraft(
      checking.transaction,
      checking.versions.records.mine,
      after,
      before,
      await checking.today(),
    ),
  ),
  "planning-settings": noCheck,
};

// A record of the plan as the user's draft makes it: the rules across records, as the role acting
// sees them, then its kind's own.
async function checkRecord(
  checking: Checking,
  row: Row & { recordType: RecordType },
): Promise<void> {
  if (wantsNoDraft(row)) return;
  const { recordType: type, recordId: id } = row;
  const { mine, theirs } = checking.versions.records;
  const misfit = recordMisfit(mine, type, id, checking.actor);
  if (misfit !== undefined) throw misfit;
  // The type is one of the plan's record types, narrowed above.
  // eslint-disable-next-line security/detect-object-injection
  await recordChecks[type]({
    checking,
    id,
    after: versionOf(mine, type, id),
    before: versionOf(theirs, type, id),
  });
}

// A person as the user's draft makes them, or their removal, against them as everyone else has
// them. Taking a draft back asks nothing of a person.
async function checkPerson(checking: Checking, row: Row): Promise<void> {
  if (wantsNoDraft(row)) return;
  const { transaction, actor, versions } = checking;
  const { live: lives, mine, theirs } = versions.people;
  const id = row.recordId;
  const live = lives.get(id);
  const after = drafted(live, mine.get(id));
  const person = drafted(live, theirs.get(id));
  const columns = await checking.peopleColumns();
  if (after === undefined) {
    // A removal is of someone others still have, since one removed since takes the change with it.
    await checkPersonRemoval(
      transaction,
      actor,
      columns,
      id,
      live,
      person as Recorded,
    );
    return;
  }
  await checkPersonChange({
    transaction,
    actor,
    columns,
    id,
    live,
    person,
    after,
    today: await checking.today(),
  });
}

// A kind whose rules on publishing are still to come.
const unchecked = () => Promise.resolve();

// A change to a list, a choice or an order, checked with the lists as the user's drafts make them
// and as everyone else has them.
const listCheck =
  (check: (draft: ListDraft) => Promise<void>) =>
  ({ transaction, actor, versions }: Checking, row: Row) =>
    check({
      transaction,
      actor,
      mine: versions.mine.lists,
      theirs: versions.theirs.lists,
      id: row.recordId,
      row,
    });

// Each kind of change kept outside the plan's records, by how it is checked.
const otherChecks: Record<
  Exclude<DraftKind, RecordType>,
  (checking: Checking, row: Row) => Promise<void>
> = {
  list: listCheck(checkListDraft),
  "list-item": listCheck(checkChoiceDraft),
  "choice-order": listCheck(checkOrderDraft),
  field: ({ transaction, actor, versions }, row) =>
    checkColumnDraft(
      transaction,
      actor,
      versions.mine.columns,
      versions.theirs.columns,
      row.recordId,
      row,
    ),
  person: checkPerson,
  "planned-hire": unchecked,
  "feature-team": unchecked,
};

const otherCheckOf = new Map<
  string,
  (checking: Checking, row: Row) => Promise<void>
>(Object.entries(otherChecks));

// The order changes are checked in, so a change is checked after those it may rely on: lists, their
// choices and order, columns, people, planned hires, feature teams, then the plan's records in the
// order approving adds them.
const kindOrder = [
  ...Object.keys(otherChecks),
  ...recordKinds.map(({ type }) => type),
];

// A kind Fathom no longer has comes first, which is no matter, since nothing checks it.
const placeOf = (row: Row) => kindOrder.indexOf(row.recordType);

// Refuses publishing the changes given while any breaks a rule a fresh change of its kind goes
// through, as the data is now and as the user's role sees it, naming the first that does and why.
// A role that doesn't read a change's kind is told only that it no longer fits, since the reason
// may name records it can't see.
export async function refuseMisfits(
  transaction: Transaction,
  actor: Actor,
  versions: Versions,
  rows: readonly Row[],
): Promise<void> {
  const columns = new Map<PlanningTable, Promise<readonly ColumnInfo[]>>();
  let today: Promise<string> | undefined;
  let people: Promise<TableColumns> | undefined;
  const checking: Checking = {
    transaction,
    actor,
    versions,
    peopleColumns: () => {
      people ??= columnsWithAdded(transaction, actor.user.id, true);
      return people;
    },
    today: () => {
      today ??= readToday(transaction);
      return today;
    },
    columnsOf: (table) => {
      const read =
        columns.get(table) ??
        planningColumns(transaction, actor.user.id, table);
      columns.set(table, read);
      return read;
    },
  };
  const check = (row: Row) => {
    const kind = row.recordType;
    return isRecordType(kind)
      ? checkRecord(checking, { ...row, recordType: kind })
      : otherCheckOf.get(kind)?.(checking, row);
  };
  const ordered = [...rows].sort(
    (first, second) => placeOf(first) - placeOf(second),
  );
  for (const row of ordered) {
    try {
      await check(row);
    } catch (error) {
      if (!(error instanceof RequestError)) throw error;
      const subject = subjectOf(versions, row, actor);
      if (readsChange(versions, row, actor)) {
        const named = capitalized(subject);
        // A reason that names the record already says what it is to.
        throw new ConflictError(
          error.message.startsWith(named)
            ? error.message
            : `${named}: ${error.message}`,
        );
      }
      throw new ConflictError(
        `The change to ${subject} no longer fits the data; change or discard it, then publish again`,
      );
    }
  }
}
