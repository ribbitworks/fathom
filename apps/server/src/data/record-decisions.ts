// SPDX-License-Identifier: Apache-2.0

// Discarding, resubmitting, approving and rejecting drafts of the plan's records, with the drafts
// each one takes along. Part of the data access layer.

import type { Database } from "@fathom/db";
import type { RecordRef, RecordType } from "@fathom/shared";
import { eq } from "drizzle-orm";
import type { Actor } from "../access.ts";
import { ConflictError, ForbiddenError, NotFoundError } from "../errors.ts";
import { type Change, recordChanges, type Transaction } from "./changes.ts";
import {
  asDraft,
  clearedRejection,
  type Draft,
  drafted,
  type Recorded,
  refuseRejected,
  rejectedField,
} from "./draft-records.ts";
import {
  deleteDrafts,
  discardDrafts,
  refuseHeldDecision,
  setRejection,
} from "./drafts.ts";
import {
  addedOnly,
  linkedIds,
  liveOnly,
  type RecordKind,
  recordExists,
  type RecordsState,
  refKey,
  shownIds,
  stateOf,
  type Touched,
  usesOf,
  versionOf,
  withVersion,
} from "./record-state.ts";
import {
  deleteValues,
  fieldOfValue,
  insertLiveValues,
  valueFieldsIn,
  type ValueRow,
  valueRows,
} from "./values.ts";
import { editsKind } from "./draft-editors.ts";
import { refuseCustomersChange } from "./feature-customers.ts";
import {
  gone,
  idOf,
  kindOf,
  noDraft,
  noRecord,
  ownFields,
  readRecordsState,
  recordKinds,
  ruleProblem,
} from "./records.ts";
import { drafting, kindChanges, refuseHeldIn } from "./record-drafting.ts";

// The records only drafted to be added that belong to one, through the links of their kinds, and
// those that belong to them, and so on.
function addedBelow(state: RecordsState, root: RecordRef): RecordRef[] {
  const found = new Map([[refKey(root), root]]);
  const queue = [root];
  for (let next = queue.shift(); next !== undefined; next = queue.shift()) {
    const parent = next;
    for (const kind of recordKinds) {
      const linking = Object.entries(kind.links).filter(
        ([, type]) => type === parent.type,
      );
      if (linking.length === 0) continue;
      for (const id of shownIds(state, kind.type)) {
        const version = versionOf(state, kind.type, id);
        const ref = { type: kind.type, id };
        if (
          !addedOnly(state, kind.type, id) ||
          found.has(refKey(ref)) ||
          !linking.some(([name]) =>
            linkedIds(version, name).includes(parent.id),
          )
        ) {
          continue;
        }
        found.set(refKey(ref), ref);
        queue.push(ref);
      }
    }
  }
  return [...found.values()];
}

// Every record with a draft, of every kind, as the viewer sees them.
const draftedRefs = (state: RecordsState): RecordRef[] =>
  recordKinds.flatMap((kind) =>
    [...stateOf(state, kind.type).drafts.keys()].map((id) => ({
      type: kind.type,
      id,
    })),
  );

// A record's draft with the drafts bound to it, which it uses and which use it in turn, such as the
// patterns and moved releases of a change of one cycle's length, which are discarded only together.
function boundWith(state: RecordsState, root: RecordRef): RecordRef[] {
  const users = new Set(usingRecords(state, [root]).map(refKey));
  return withUsedRecords(state, [root]).filter(
    (ref) => refKey(ref) === refKey(root) || users.has(refKey(ref)),
  );
}

export function cyclesDiscardRefusal(
  discarded: readonly RecordRef[],
  maker: Actor,
): string | undefined {
  return discarded.some((ref) => ref.type === "cycle-pattern") &&
    !editsKind(maker, "cycle-pattern")
    ? "Only someone who changes cycles can discard this."
    : undefined;
}

// Discards the editor's draft of a record, so the record is as it is live, or, for one only drafted
// to be added, gone, with the drafts bound to it and the drafts of the records only drafted to be
// added that belong to any of them. Refused while other drafts, published or not, use any of them,
// and, to an editor who may not change cycles, when it would discard a draft of a stream's cycles.
export async function discardRecordDraft(
  database: Database,
  maker: Actor,
  type: RecordType,
  id: string,
): Promise<string | null> {
  return drafting(database, maker.user.id, async (transaction, state) => {
    if (!recordExists(state, type, id)) throw new NotFoundError(noRecord);
    refuseHeldIn(state, type, id);
    if (!stateOf(state, type).drafts.has(id)) throw new NotFoundError(noDraft);
    const discarded = [
      ...new Map(
        boundWith(state, { type, id })
          .flatMap((ref) =>
            addedOnly(state, ref.type, ref.id) ? addedBelow(state, ref) : [ref],
          )
          .map((ref) => [refKey(ref), ref]),
      ).values(),
    ];
    const refusal = cyclesDiscardRefusal(discarded, maker);
    if (refusal !== undefined) throw new ForbiddenError(refusal);
    for (const ref of discarded.filter(
      ({ type: kind }) => kind === "feature",
    )) {
      // Discarding a change puts the live customers back, as much a change of them as drafting
      // one; discarding a feature's addition or removal chooses no customers.
      const live = stateOf(state, "feature").live.get(ref.id);
      const drafted = versionOf(state, "feature", ref.id);
      if (live !== undefined && drafted !== undefined) {
        refuseCustomersChange(maker, drafted, live);
      }
    }
    const keys = new Set(discarded.map(refKey));
    const added = discarded.filter((ref) => addedOnly(state, ref.type, ref.id));
    const addedKeys = new Set(added.map(refKey));
    const usedElsewhere =
      draftedRefs(state).some(
        (ref) =>
          !keys.has(refKey(ref)) &&
          usesOf(kindOf(ref.type), state, ref.id).some((used) =>
            addedKeys.has(refKey(used)),
          ),
      ) ||
      recordKinds.some((kind) =>
        [...stateOf(state, kind.type).held].some(([heldId, { draft }]) => {
          const version = drafted(
            stateOf(state, kind.type).live.get(heldId),
            draft,
          );
          return Object.entries(kind.links).some(([name, linked]) =>
            linkedIds(version, name).some((target) =>
              addedKeys.has(refKey({ type: linked, id: target })),
            ),
          );
        }),
      );
    if (usedElsewhere) {
      throw new ConflictError(
        "This draft can't be discarded while other drafts depend on it. Discard those drafts, or change them so they no longer use it, then try again.",
      );
    }
    // Going back to the live record must keep the rules for the drafts that rely on it, such as a
    // release on the cycles a change of pattern makes.
    let after = state;
    for (const ref of discarded) {
      after = withVersion(
        after,
        ref.type,
        ref.id,
        stateOf(state, ref.type).live.get(ref.id),
      );
    }
    const problem = ruleProblem(
      after,
      discarded
        .filter((ref) => !addedOnly(state, ref.type, ref.id))
        .map((ref) => ({
          ...ref,
          record: stateOf(state, ref.type).live.get(ref.id) as Recorded,
        })),
      maker,
    );
    if (problem !== undefined) throw new ConflictError(problem);
    const made: Change[] = [];
    for (const ref of discarded) {
      const kind = kindOf(ref.type);
      const live = stateOf(state, ref.type).live.get(ref.id);
      made.push(
        ...asDraft(
          kindChanges(kind, ref.id, versionOf(state, ref.type, ref.id), live),
        ),
        ...clearedRejection(
          ref.id,
          () => "general",
          live,
          stateOf(state, ref.type).drafts.get(ref.id),
          ref.type,
        ),
      );
      await discardDrafts(transaction, maker.user.id, ref.type, [ref.id]);
    }
    return recordChanges(transaction, maker, made, "discard");
  });
}

// Sends a rejected draft of a record for approval again, unchanged.
export async function resubmitRecordDraft(
  database: Database,
  maker: Actor,
  type: RecordType,
  id: string,
): Promise<string | null> {
  return drafting(database, maker.user.id, async (transaction, state) => {
    if (!recordExists(state, type, id)) throw new NotFoundError(noRecord);
    refuseHeldIn(state, type, id);
    const draft = stateOf(state, type).drafts.get(id);
    if (draft === undefined) throw new NotFoundError(noDraft);
    if (draft.state !== "rejected") {
      throw new ConflictError("Only a rejected draft can be resubmitted");
    }
    if (type === "feature") {
      refuseCustomersChange(
        maker,
        stateOf(state, type).live.get(id),
        versionOf(state, type, id),
      );
    }
    await setRejection(transaction, type, [id], {
      state: "waiting",
      reason: null,
    });
    return recordChanges(
      transaction,
      maker,
      clearedRejection(id, () => "general", undefined, draft, type),
      "resubmission",
    );
  });
}

// The records asked for, with every draft they use, and those those use, and so on.
export function withUsedRecords(
  state: RecordsState,
  asked: readonly RecordRef[],
): RecordRef[] {
  const found = new Map(asked.map((ref) => [refKey(ref), ref]));
  const queue = [...asked];
  for (let next = queue.shift(); next !== undefined; next = queue.shift()) {
    for (const used of usesOf(kindOf(next.type), state, next.id)) {
      if (!found.has(refKey(used))) {
        found.set(refKey(used), used);
        queue.push(used);
      }
    }
  }
  return [...found.values()];
}

// The drafts that use any of those given, and those that use them, and so on.
function usingRecords(
  state: RecordsState,
  given: readonly RecordRef[],
): RecordRef[] {
  const found = new Set(given.map(refKey));
  const dependents: RecordRef[] = [];
  let grew = true;
  while (grew) {
    grew = false;
    for (const ref of draftedRefs(state)) {
      if (found.has(refKey(ref))) continue;
      if (
        usesOf(kindOf(ref.type), state, ref.id).some((used) =>
          found.has(refKey(used)),
        )
      ) {
        found.add(refKey(ref));
        dependents.push(ref);
        grew = true;
      }
    }
  }
  return dependents;
}

function requireRecordDrafts(state: RecordsState, asked: readonly RecordRef[]) {
  if (asked.some(({ type, id }) => !stateOf(state, type).drafts.has(id))) {
    throw new NotFoundError(gone);
  }
}

async function refuseHeldRecords(
  transaction: Transaction,
  refs: readonly RecordRef[],
): Promise<void> {
  for (const kind of recordKinds) {
    await refuseHeldDecision(
      transaction,
      kind.type,
      refs.filter(({ type }) => type === kind.type).map(({ id }) => id),
    );
  }
}

// Approves the drafts of the records asked for, and those they use, applying them to the live
// records, and returns the changes made, for approvals.ts to record with the other drafts approved
// at the same time, and the values still to write: those in a column or choice only drafted to be
// added, written once it is approved with the records. The live records must still keep every rule
// once they are applied.
export async function approveRecordDrafts(
  transaction: Transaction,
  approver: Actor,
  asked: readonly RecordRef[],
): Promise<{ made: Change[]; values: (readonly ValueRow[])[] }> {
  if (asked.length === 0) return { made: [], values: [] };
  const state = await readRecordsState(transaction);
  requireRecordDrafts(state, asked);
  const approved = withUsedRecords(state, asked);
  await refuseHeldRecords(transaction, approved);
  refuseRejected(
    approved.map(({ type, id }) => stateOf(state, type).drafts.get(id)),
  );
  const made: Change[] = [];
  const columnValues: ValueRow[][] = [];
  const touched: Touched[] = [];
  const removed: { kind: RecordKind; id: string }[] = [];
  for (const kind of recordKinds) {
    const live = stateOf(state, kind.type).live;
    const rows = new Map(stateOf(state, kind.type).rows);
    const table = kind.table;
    for (const id of shownIds(state, kind.type)) {
      if (!approved.some((ref) => ref.type === kind.type && ref.id === id)) {
        continue;
      }
      const before = live.get(id);
      const after = versionOf(state, kind.type, id);
      touched.push({
        type: kind.type,
        id,
        record: (after ?? before) as Recorded,
      });
      if (after === undefined) {
        removed.push({ kind, id });
        continue;
      }
      const values = ownFields(kind, after);
      if (before === undefined) {
        const row = { ...values, ...kind.added?.(rows) };
        await transaction.insert(table).values({ id, ...row } as never);
        rows.set(id, row);
        await kind.onAdded?.(transaction, id);
      } else {
        await transaction
          .update(table)
          .set(values)
          .where(eq(idOf(table), id));
      }
      if (kind.addedColumns !== undefined) {
        for (const field of valueFieldsIn(before, after)) {
          // The field names an added column's value.
          /* eslint-disable security/detect-object-injection */
          const same =
            JSON.stringify(before?.[field]) === JSON.stringify(after[field]);
          /* eslint-enable security/detect-object-injection */
          if (same) {
            continue;
          }
          const fieldId = String(fieldOfValue(field));
          const { owner } = kind.addedColumns;
          await deleteValues(transaction, id, fieldId, owner);
          // The field names an added column's value.
          // eslint-disable-next-line security/detect-object-injection
          columnValues.push(valueRows(id, fieldId, after[field], owner));
        }
      }
      made.push(...kindChanges(kind, id, before, after));
    }
  }
  const drafted = await insertLiveValues(transaction, columnValues);
  // Judged before anything is deleted, so a record still linked to is refused by name rather than
  // by the database.
  const problem = ruleProblem(
    removed.reduce(
      (left, { kind, id }) => withVersion(left, kind.type, id, undefined),
      liveOnly(await readRecordsState(transaction)),
    ),
    touched,
    approver,
  );
  if (problem !== undefined) throw new ConflictError(problem);
  for (const { kind, id } of removed.reverse()) {
    made.push(
      ...kindChanges(
        kind,
        id,
        stateOf(state, kind.type).live.get(id),
        undefined,
      ),
    );
    await kind.onRemoving?.(transaction, id);
    await transaction.delete(kind.table).where(eq(idOf(kind.table), id));
  }
  for (const kind of recordKinds) {
    await deleteDrafts(
      transaction,
      kind.type,
      approved.filter(({ type }) => type === kind.type).map(({ id }) => id),
    );
  }
  return { made, values: drafted };
}

// Rejects the drafts of the records asked for with a reason, refusing a draft that others use
// unless they are rejected too, and returns the changes to record.
export async function rejectRecordDrafts(
  transaction: Transaction,
  asked: readonly RecordRef[],
  reason: string,
): Promise<Change[]> {
  if (asked.length === 0) return [];
  const state = await readRecordsState(transaction);
  requireRecordDrafts(state, asked);
  await refuseHeldRecords(transaction, asked);
  if (usingRecords(state, asked).length > 0) {
    throw new ConflictError(
      "Other drafts depend on these drafts. Reject them together, or wait until those drafts no longer depend on these.",
    );
  }
  const made: Change[] = [];
  for (const kind of recordKinds) {
    const ids = asked
      .filter(({ type }) => type === kind.type)
      .map(({ id }) => id);
    for (const id of ids) {
      const draft = stateOf(state, kind.type).drafts.get(id) as Draft;
      if (draft.state === "rejected" && draft.reason === reason) continue;
      made.push({
        recordType: kind.type,
        recordId: id,
        action: "changed",
        field: rejectedField,
        tier: "general",
        oldValue: draft.state === "rejected" ? draft.reason : null,
        newValue: reason,
        draft: true,
      });
    }
    await setRejection(transaction, kind.type, ids, {
      state: "rejected",
      reason,
    });
  }
  return made;
}
