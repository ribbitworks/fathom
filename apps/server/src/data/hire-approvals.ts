// SPDX-License-Identifier: Apache-2.0

// Deciding planned hires' drafts: approving or rejecting them, and undoing a change set's changes
// to them. Part of the data access layer.

import { refuseFillingAllocated, removeAllocationsOf } from "./allocations.ts";
import {
  drafts,
  fieldValues,
  inChunks,
  listItems,
  people,
  plannedHires,
} from "@fathom/db";
import { and, eq, inArray, lt } from "drizzle-orm";
import { type Actor, seesSensitivity } from "../access.ts";
import { ConflictError, ForbiddenError, NotFoundError } from "../errors.ts";
import { columnsWithAdded } from "./added-columns.ts";
import { peoplesMeaning } from "./lists.ts";
import { fieldOfValue, readColumns, valueRows } from "./values.ts";
import { type Change, type Transaction } from "./changes.ts";
import {
  type Draft,
  drafted,
  draftFields,
  draftTier,
  type Recorded,
  refuseRejected,
  rejectedField,
  unseenDraft,
} from "./draft-records.ts";
import { refuseHeldDecision, setRejection, writeDraft } from "./drafts.ts";
import { takenEmployeeIds } from "./drafted-values.ts";
import { reassignReports, text } from "./reporting.ts";
import {
  fitOffered,
  hireChanges,
  readHireTier,
  recordType,
  rejectionTier,
  seesHireField,
} from "./hire-fields.ts";
import { readHireDrafts, readLiveHires } from "./hire-reads.ts";
import {
  hiredState,
  hiresAmong,
  hiresReportTo,
  managerAllowed,
  newlyManaged,
  refuseHireLoop,
  refuseHireLoopsLive,
  refuseUnmarked,
  unfilled,
} from "./hire-checks.ts";

const noDraft =
  "One of these planned hires has no draft; refresh to see the latest";

// Checks the actor may approve or reject the drafts of the hires asked for, and reads them with the
// hires as they are live. Only those who see the hiring plan see hires' drafts, so for anyone else
// they are answered as drafts that do not exist.
async function seenHires(
  transaction: Transaction,
  actor: Actor,
  ids: readonly string[],
) {
  if (!seesSensitivity(actor, "hiring-plan")) throw new NotFoundError(noDraft);
  const found = await readHireDrafts(transaction, ids);
  if (found.size !== ids.length) throw new NotFoundError(noDraft);
  const live = await readLiveHires(transaction, ids, true);
  const tierOf = await readHireTier(transaction);
  for (const [id, draft] of found) {
    const fields = draftFields(live.get(id), draft);
    if (!fields.every(seesHireField(actor, tierOf))) {
      throw new ForbiddenError(unseenDraft);
    }
  }
  await refuseHeldDecision(transaction, recordType, ids);
  return { found, live, tierOf };
}

// Checked before any drafts are approved or rejected, so a draft the actor may not decide is refused
// before anything changes.
export async function checkHiresAsked(
  transaction: Transaction,
  actor: Actor,
  ids: readonly string[],
): Promise<void> {
  if (ids.length > 0) await seenHires(transaction, actor, ids);
}

// Makes the live hires as their drafts make them, and returns the changes recorded.
export async function approveHiresIn(
  transaction: Transaction,
  actor: Actor,
  ids: readonly string[],
  today: string,
): Promise<Change[]> {
  if (ids.length === 0) return [];
  const { found, live, tierOf } = await seenHires(transaction, actor, ids);
  refuseRejected(found.values());
  const wanted = ids.map((id) => {
    const before = live.get(id);
    const draft = found.get(id) as Draft;
    return { id, before, draft, hire: drafted(before, draft) };
  });
  // Columns approved with the hires are live by now.
  if (
    !(await fitOffered(
      transaction,
      await readColumns(transaction, true),
      wanted.flatMap(({ hire }) => (hire === undefined ? [] : [hire])),
    ))
  ) {
    throw new ConflictError(
      "A planned hire's draft no longer fits the columns; change it, then approve it",
    );
  }
  const made: Change[] = [];
  const heldValues: (typeof fieldValues.$inferInsert)[] = [];
  const removed: string[] = [];
  const seesPositions = seesSensitivity(actor, tierOf("positionId"));
  const managingHires = await hiresAmong(
    transaction,
    wanted.flatMap(({ hire }) =>
      typeof hire?.managerId === "string" ? [hire.managerId] : [],
    ),
  );
  // The columns that hold a hire's manager: a person's, or a planned hire's.
  const managerColumns = (managerId: string | null) =>
    managerId !== null && managingHires.has(managerId)
      ? { managerId: null, managerHireId: managerId }
      : { managerId, managerHireId: null };
  for (const { id, before, draft, hire } of wanted) {
    made.push(...hireChanges(id, draft.action, before, hire, tierOf));
    if (hire !== undefined && newlyManaged(before, hire)) {
      await refuseUnmarked(
        transaction,
        String(hire.managerId),
        (message) => new ConflictError(message),
        { seesPositions },
      );
    }
    if (hire === undefined) {
      removed.push(id);
      continue;
    }
    // Whoever fills it may have been given an end date that has passed since the fill was drafted,
    // and the hire allocations since, which filling can't move yet.
    if (unfilled(before ?? {}) && typeof hire.filledBy === "string") {
      await refuseFillingAllocated(transaction, id);
      const [left] = await transaction
        .select({ name: people.preferredName })
        .from(people)
        .where(and(eq(people.id, hire.filledBy), lt(people.endDate, today)));
      if (left !== undefined) {
        throw new ConflictError(
          `${left.name} has left, so can't fill a planned hire`,
        );
      }
    }
    // The state may have come to mean Hired or Left since the draft was made.
    if (unfilled(hire)) {
      const [state] = await transaction
        .select({ meaning: listItems.meaning })
        .from(listItems)
        .where(eq(listItems.id, String(hire.stateId)));
      if (peoplesMeaning(state?.meaning)) throw new ConflictError(hiredState);
    }
    const row = {
      name: text(hire.name),
      requisition: text(hire.requisition),
      temporaryNumber:
        typeof hire.temporaryNumber === "number" ? hire.temporaryNumber : null,
      positionId: String(hire.positionId),
      targetDate: text(hire.targetDate),
      stateId: String(hire.stateId),
      ...managerColumns(text(hire.managerId)),
      isManager: hire.isManager === true,
      filledBy: text(hire.filledBy),
    };
    if (before === undefined) {
      await transaction.insert(plannedHires).values({ id, ...row });
    } else {
      await transaction
        .update(plannedHires)
        .set(row)
        .where(eq(plannedHires.id, id));
    }
    for (const [field, value] of Object.entries(hire)) {
      const fieldId = fieldOfValue(field);
      if (fieldId !== null) {
        heldValues.push(...valueRows(id, fieldId, value, "planned-hire"));
      }
    }
  }
  // Hires approved together may move a planned manager's hires away and clear its mark, so marks
  // cleared are checked once every change is made. A removal needs no check: drafting it, and naming
  // a manager drafted to be removed, are both refused.
  const unmarked = wanted.flatMap(({ id, before, hire }) =>
    before?.isManager === true && hire !== undefined && hire.isManager !== true
      ? [id]
      : [],
  );
  if (await hiresReportTo(transaction, unmarked, { drafted: false })) {
    throw new ConflictError(reassignReports);
  }
  made.push(
    ...(await removeAllocationsOf(transaction, "plannedHireId", removed)),
  );
  for (const chunk of inChunks(removed)) {
    await transaction
      .delete(plannedHires)
      .where(inArray(plannedHires.id, chunk));
  }
  await refuseHireLoopsLive(transaction, ids, seesPositions);
  // Each hire approved holds the values its draft makes, replacing those it had.
  for (const chunk of inChunks([...ids])) {
    await transaction
      .delete(fieldValues)
      .where(inArray(fieldValues.plannedHireId, chunk));
  }
  for (const chunk of inChunks(heldValues)) {
    await transaction.insert(fieldValues).values(chunk);
  }
  for (const chunk of inChunks([...ids])) {
    await transaction
      .delete(drafts)
      .where(
        and(eq(drafts.recordType, recordType), inArray(drafts.recordId, chunk)),
      );
  }
  return made;
}

// Rejects the drafts of the hires asked for, with a reason, and returns the changes recorded.
export async function rejectHiresIn(
  transaction: Transaction,
  actor: Actor,
  ids: readonly string[],
  reason: string,
): Promise<Change[]> {
  if (ids.length === 0) return [];
  const { found, live, tierOf } = await seenHires(transaction, actor, ids);
  const made: Change[] = [];
  for (const id of ids) {
    const draft = found.get(id) as Draft;
    if (draft.state === "rejected" && draft.reason === reason) continue;
    made.push({
      recordType,
      recordId: id,
      action: "changed",
      field: rejectedField,
      tier: draftTier(rejectionTier(tierOf), live.get(id), draft),
      oldValue: draft.state === "rejected" ? draft.reason : null,
      newValue: reason,
      draft: true,
    });
  }
  await setRejection(transaction, recordType, ids, {
    state: "rejected",
    reason,
  });
  return made;
}

// Puts back the drafts of the hires a change set changed in their drafts: the hire it drafted adding
// taken out, the one it drafted removing put back as it was, and the fields it changed put back. A
// hire must still be there to change, a requisition still be one no one else has, and a manager put
// back must still be a live person, checked as a manager while the hire is not yet filled.
export async function undoHireDrafts(
  transaction: Transaction,
  editor: string,
  records: readonly {
    id: string;
    action: Change["action"];
    old: ReadonlyMap<string, unknown>;
  }[],
  changedSince: string,
): Promise<void> {
  const ids = records.map(({ id }) => id);
  const live = await readLiveHires(transaction, ids, true);
  const draftsNow = await readHireDrafts(transaction, ids, editor);
  const columns = await columnsWithAdded(transaction, editor);
  for (const record of records) {
    const old = new Map(record.old);
    old.delete(rejectedField);
    const now = drafted(live.get(record.id), draftsNow.get(record.id));
    let hire: Recorded | undefined;
    if (record.action === "deleted") {
      hire = {
        name: null,
        requisition: null,
        temporaryNumber: null,
        targetDate: null,
        managerId: null,
        filledBy: null,
        ...Object.fromEntries([...old].filter(([, value]) => value !== null)),
      };
      // A hire recorded before it had a position, a state, and an ID, all recorded together since,
      // cannot be put back.
      if (hire.positionId === undefined) {
        throw new ConflictError(changedSince);
      }
    } else if (record.action === "changed") {
      // A hire changed since is refused before this, so it is still there.
      hire = { ...(now as Recorded), ...Object.fromEntries(old) };
    }
    if (
      (hire !== undefined &&
        !(await fitOffered(transaction, columns, [hire]))) ||
      !(await managerAllowed(transaction, hire?.managerId, editor)) ||
      (typeof hire?.requisition === "string" &&
        (await takenEmployeeIds(transaction, [hire.requisition], [record.id]))
          .length > 0)
    ) {
      throw new ConflictError(changedSince);
    }
    // Undoing can take a planned manager's mark away, or the manager itself, as clearing or
    // removing it can.
    if (
      now?.isManager === true &&
      hire?.isManager !== true &&
      (await hiresReportTo(transaction, [record.id], { drafted: true }))
    ) {
      throw new ConflictError(changedSince);
    }
    if (hire !== undefined && newlyManaged(now, hire)) {
      await refuseUnmarked(
        transaction,
        String(hire.managerId),
        (message) => new ConflictError(message),
        { seesPositions: false },
      );
      await refuseHireLoop(transaction, editor, record.id, hire.managerId);
    }
    await writeDraft(
      transaction,
      editor,
      recordType,
      record.id,
      live.get(record.id),
      hire,
    );
  }
}
