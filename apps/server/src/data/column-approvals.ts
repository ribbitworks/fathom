// SPDX-License-Identifier: Apache-2.0

// Approving and rejecting drafts of the People table's columns. Part of the data access layer;
// approvals.ts runs these with the drafts of lists and people approved or rejected at the same
// time, in one change set. Approving checks again that each column's settings fit the people's
// values, and approving a removal deletes the column's values, so the Approver must see them.

import { fields, lists } from "@fathom/db";
import type { DraftsRequest } from "@fathom/shared";
import { eq } from "drizzle-orm";
import { type Actor, mostSensitive, seesSensitivity } from "../access.ts";
import { ConflictError, ForbiddenError, NotFoundError } from "../errors.ts";
import type { Change, Transaction } from "./changes.ts";
import {
  refuseSensitiveOnFeatures,
  columnRow,
  columnTier,
  draftedField,
  readColumnsState,
} from "./column-drafts.ts";
import { appendColumn } from "./column-order.ts";
import {
  deleteDrafts,
  type Draft,
  draftsUse,
  refuseHeldDecision,
  refuseRejected,
  rejectedField,
  setRejection,
} from "./drafts.ts";
import { checkValuesFit, deleteLiveField, fieldChanges } from "./fields.ts";

export type ColumnSelection = Pick<DraftsRequest, "columns">;

const gone = "One of these drafts no longer exists; refresh to see the latest";

export const asksForColumns = (asked: ColumnSelection) =>
  asked.columns.length > 0;

// Reads the columns with the drafts asked for, refusing drafts that do not exist, and columns whose
// values the actor may not see, live or drafted.
async function stateWithDrafts(
  transaction: Transaction,
  actor: Actor,
  asked: ColumnSelection,
) {
  const state = await readColumnsState(transaction);
  if (asked.columns.some((id) => !state.fieldDrafts.has(id))) {
    throw new NotFoundError(gone);
  }
  for (const id of asked.columns) {
    const versions = [state.fields.get(id), draftedField(state, id)].filter(
      (version) => version !== undefined,
    );
    if (
      !seesSensitivity(
        actor,
        mostSensitive(versions.map((one) => columnTier(state, one))),
      )
    ) {
      throw new ForbiddenError(
        "One of these drafts is of a column holding details your role does not let you see, so an Approver who sees them must decide it",
      );
    }
  }
  await refuseHeldDecision(transaction, "field", asked.columns);
  return state;
}

// Approves the drafts of columns asked for, applying them to the live columns, and returns the
// changes made, for approvals.ts to record.
export async function approveColumnDrafts(
  transaction: Transaction,
  actor: Actor,
  asked: ColumnSelection,
): Promise<Change[]> {
  const state = await stateWithDrafts(transaction, actor, asked);
  const approved = [...state.fieldDrafts.keys()].filter((id) =>
    asked.columns.includes(id),
  );
  refuseRejected(approved.map((id) => state.fieldDrafts.get(id)));
  const made: Change[] = [];
  for (const id of approved) {
    const live = state.fields.get(id);
    const field = draftedField(state, id);
    if (field === undefined) {
      if (await draftsUse(transaction, { column: id })) {
        throw new ConflictError(
          "Drafts change a column drafted to be deleted; approve or discard them first",
        );
      }
      // The values deleted are as sensitive as the column, which the Approver sees, as checked above.
      made.push(...(await deleteLiveField(transaction, id)));
      continue;
    }
    refuseSensitiveOnFeatures(state, field);
    const after = columnRow(id, field);
    if (after.listId !== null) {
      // The list is locked, so it cannot be retired while the column comes to draw on it.
      const [list] = await transaction
        .select({ retired: lists.retired })
        .from(lists)
        .where(eq(lists.id, after.listId))
        .for("share");
      if (
        list === undefined ||
        (list.retired && live?.listId !== after.listId)
      ) {
        throw new ConflictError(
          `The list the column ${after.name} draws on is no longer offered; change the column, then approve it`,
        );
      }
    }
    const before =
      live === undefined ? { ...after, required: false } : columnRow(id, live);
    await checkValuesFit(transaction, before, after);
    if (live === undefined) {
      await transaction.insert(fields).values(after);
      // Only People's columns have an order kept yet.
      if (after.tableName === "people") await appendColumn(transaction, id);
      made.push(...fieldChanges(id, "created", undefined, after));
    } else {
      const { name, listId, visibility, multiple, required, onPlannedHires } =
        after;
      await transaction
        .update(fields)
        .set({ name, listId, visibility, multiple, required, onPlannedHires })
        .where(eq(fields.id, id));
      made.push(...fieldChanges(id, "changed", before, after));
    }
  }
  await deleteDrafts(transaction, "field", approved);
  return made;
}

// Rejects the drafts of columns asked for, with a reason, and returns the changes to record.
export async function rejectColumnDrafts(
  transaction: Transaction,
  actor: Actor,
  asked: ColumnSelection,
  reason: string,
): Promise<Change[]> {
  const state = await stateWithDrafts(transaction, actor, asked);
  const made: Change[] = [];
  for (const id of asked.columns) {
    // Every draft asked for exists, as stateWithDrafts checks.
    const draft = state.fieldDrafts.get(id) as Draft;
    if (!(draft.state === "rejected" && draft.reason === reason)) {
      made.push({
        recordType: "field",
        recordId: id,
        action: "changed",
        field: rejectedField,
        tier: "general",
        oldValue: draft.state === "rejected" ? draft.reason : null,
        newValue: reason,
        draft: true,
      });
    }
    await setRejection(transaction, "field", [id], {
      state: "rejected",
      reason,
    });
  }
  return made;
}
