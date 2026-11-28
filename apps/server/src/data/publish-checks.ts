// SPDX-License-Identifier: Apache-2.0

// The checks publishing private changes makes: each change is checked by the rules a fresh change of
// its kind goes through, against the data as it is now. Part of the data access layer.

import { capitalized, type DraftKind, type RecordType } from "@fathom/shared";
import { type Actor } from "../access.ts";
import { ConflictError, RequestError } from "../errors.ts";
import { refuseAllocatedActivity } from "./activities.ts";
import { checkAllocationDraft } from "./allocations.ts";
import { type Transaction } from "./changes.ts";
import { typeOf } from "./column-types.ts";
import { draftedField, nameTaken } from "./column-state.ts";
import { drafted, type Recorded, wantsNoDraft } from "./draft-records.ts";
import { takenEmployeeIds } from "./drafted-values.ts";
import { refuseFeatureFieldChanges } from "./feature-field-editors.ts";
import {
  checkChoiceDraft,
  checkListDraft,
  checkOrderDraft,
  type ListDraft,
} from "./list-checks.ts";
import { draftedList, listExists } from "./list-state.ts";
import { checkPlanningDraft } from "./planning-records.ts";
import {
  idsOf,
  readsChange,
  type Row,
  subjectOf,
  type Versions,
} from "./private-versions.ts";
import { checkOwnerDraft } from "./projects.ts";
import { recordMisfit } from "./record-drafting.ts";
import { type RecordsState, versionOf } from "./record-state.ts";
import { isRecordType, recordKinds } from "./records.ts";

interface Checking {
  transaction: Transaction;
  actor: Actor;
  versions: Versions;
  // The people whose Employee ID, as the user's drafts make them, someone else has.
  taken: Set<string>;
}

// A kind of record's own rules beyond those across records, for a record as the user's draft makes
// it, or undefined for its removal, against the record as everyone else has it.
type RecordCheck = (
  transaction: Transaction,
  actor: Actor,
  mine: RecordsState,
  id: string,
  after: Recorded | undefined,
  before: Recorded | undefined,
) => Promise<void>;

const ownerCheck: RecordCheck = async (
  transaction,
  actor,
  _,
  __,
  after,
  before,
) => {
  if (after !== undefined) {
    await checkOwnerDraft(transaction, actor, after, before);
  }
};

const recordChecks = new Map<RecordType, RecordCheck>([
  [
    "feature",
    async (transaction, actor, _, __, after, before) => {
      refuseFeatureFieldChanges(actor, before, after);
      if (after !== undefined) {
        await checkPlanningDraft(
          transaction,
          actor.user.id,
          "features",
          after,
          before,
        );
      }
    },
  ],
  [
    "activity",
    (transaction, actor, mine, id, after, before) =>
      after === undefined
        ? refuseAllocatedActivity(transaction, mine, id, actor)
        : checkPlanningDraft(
            transaction,
            actor.user.id,
            "activities",
            after,
            before,
          ),
  ],
  ["project", ownerCheck],
  ["proposal", ownerCheck],
  [
    "allocation",
    async (transaction, _, mine, __, after, before) => {
      if (after !== undefined) {
        await checkAllocationDraft(transaction, mine, after, before);
      }
    },
  ],
]);

// A record of the plan as the user's draft makes it: the rules across records, as the role acting
// sees them, then its kind's own.
async function checkRecord(
  { transaction, actor, versions }: Checking,
  row: Row,
): Promise<void> {
  if (wantsNoDraft(row)) return;
  const type = row.recordType as RecordType;
  const { mine, theirs } = versions.records;
  const misfit = recordMisfit(mine, type, row.recordId, actor);
  if (misfit !== undefined) throw misfit;
  await recordChecks.get(type)?.(
    transaction,
    actor,
    mine,
    row.recordId,
    versionOf(mine, type, row.recordId),
    versionOf(theirs, type, row.recordId),
  );
}

// Whether a change of a kind with no rules of its own on publishing yet still fits the data as it is
// now: a name or Employee ID no one else has, and a list to draw on, live or drafted to be added.
function fits({ versions, taken }: Checking, row: Row): boolean {
  if (wantsNoDraft(row)) return true;
  const id = row.recordId;
  if (row.recordType === "person") return !taken.has(id);
  if (row.recordType !== "field") return true;
  const { columns } = versions.mine;
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

// The refusal of a change whose kind still has no rules of its own on publishing.
class NoLongerFits extends Error {}

const fitting = (checking: Checking, row: Row): Promise<void> =>
  fits(checking, row) ? Promise.resolve() : Promise.reject(new NoLongerFits());

// A change to a list, a choice or an order, checked with the lists as the user's drafts make them
// and as everyone else has them.
const listCheck =
  (check: (draft: ListDraft) => Promise<void>) =>
  ({ transaction, actor, versions }: Checking, row: Row) =>
    check({
      transaction,
      editor: actor.user.id,
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
  field: fitting,
  person: fitting,
  "planned-hire": fitting,
  "feature-team": fitting,
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
  const checking: Checking = {
    transaction,
    actor,
    versions,
    taken: await takenPeople(transaction, actor.user.id, versions),
  };
  const ordered = [...rows].sort(
    (first, second) => placeOf(first) - placeOf(second),
  );
  for (const row of ordered) {
    const check = isRecordType(row.recordType)
      ? checkRecord
      : otherCheckOf.get(row.recordType);
    try {
      await check?.(checking, row);
    } catch (error) {
      if (!(error instanceof RequestError || error instanceof NoLongerFits)) {
        throw error;
      }
      const subject = subjectOf(versions, row, actor);
      if (error instanceof RequestError && readsChange(versions, row, actor)) {
        throw new ConflictError(`${capitalized(subject)}: ${error.message}`);
      }
      throw new ConflictError(
        `The change to ${subject} no longer fits the data; change or discard it, then publish again`,
      );
    }
  }
}
