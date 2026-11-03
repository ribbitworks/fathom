// SPDX-License-Identifier: Apache-2.0

// Approving and rejecting drafts of the People table's columns and of their order. Part of the data
// access layer; approvals.ts runs these with the drafts of lists and people approved or rejected at
// the same time, in one change set. Approving checks again that each column's settings fit the
// people's values, and approving a removal deletes the column's values, so the Approver must see
// them. A draft of the order that places a column drafted to be added uses the column's draft, so
// approving the order approves the column too, and the column is rejected only together with it.

import { fields, lists } from "@fathom/db";
import type { DraftsRequest } from "@fathom/shared";
import { eq } from "drizzle-orm";
import { type Actor, mostSensitive, seesTier } from "../access.ts";
import { ConflictError, ForbiddenError, NotFoundError } from "../errors.ts";
import type { Change, Transaction } from "./changes.ts";
import {
  columnOrderChanges,
  columnOrderId,
  columnRow,
  columnTier,
  draftedField,
  fieldsOrderUses,
  heldColumnOrder,
  readColumnsState,
  removeEmptyColumnOrder,
} from "./column-drafts.ts";
import {
  appendColumn,
  readColumnOrder,
  writeColumnOrder,
} from "./column-order.ts";
import {
  deleteDrafts,
  type Draft,
  draftsUse,
  refuseRejected,
  rejectedField,
  setRejection,
} from "./drafts.ts";
import { checkValuesFit, deleteLiveField, fieldChanges } from "./fields.ts";

export type ColumnSelection = Pick<DraftsRequest, "columns" | "columnOrder">;

const gone = "One of these drafts no longer exists; refresh to see the latest";

export const asksForColumns = (asked: ColumnSelection) =>
  asked.columns.length > 0 || asked.columnOrder;

// Reads the columns with the drafts asked for, refusing drafts that do not exist, and columns, among
// those asked for and those the order places, whose values the actor may not see, live or drafted.
async function stateWithDrafts(
  transaction: Transaction,
  actor: Actor,
  asked: ColumnSelection,
) {
  const state = await readColumnsState(transaction);
  if (
    asked.columns.some((id) => !state.fieldDrafts.has(id)) ||
    (asked.columnOrder && heldColumnOrder(state) === undefined)
  ) {
    throw new NotFoundError(gone);
  }
  const deciding = [
    ...asked.columns,
    ...(asked.columnOrder ? fieldsOrderUses(state) : []),
  ];
  for (const id of deciding) {
    const versions = [state.fields.get(id), draftedField(state, id)].filter(
      (version) => version !== undefined,
    );
    if (
      !seesTier(
        actor,
        mostSensitive(versions.map((one) => columnTier(state, one))),
      )
    ) {
      throw new ForbiddenError(
        "One of these drafts is of a column holding details your roles do not let you see, so an Approver who sees them must decide it",
      );
    }
  }
  return state;
}

// Approves the drafts of columns asked for, and of the order, with the columns it places, applying
// them to the live columns, and returns the changes made, for approvals.ts to record.
export async function approveColumnDrafts(
  transaction: Transaction,
  actor: Actor,
  asked: ColumnSelection,
): Promise<Change[]> {
  const state = await stateWithDrafts(transaction, actor, asked);
  const used = asked.columnOrder ? fieldsOrderUses(state) : [];
  const approved = [...state.fieldDrafts.keys()].filter(
    (id) => asked.columns.includes(id) || used.includes(id),
  );
  refuseRejected([
    ...approved.map((id) => state.fieldDrafts.get(id)),
    ...(asked.columnOrder ? [state.orderDraft] : []),
  ]);
  const made: Change[] = [];
  for (const id of approved) {
    const live = state.fields.get(id);
    const field = draftedField(state, id);
    if (field === undefined) {
      if (await draftsUse(transaction, { column: id })) {
        throw new ConflictError(
          "Drafts of people change a column drafted to be deleted; approve or discard them first",
        );
      }
      // The values deleted are as sensitive as the column, which the Approver sees, as checked above.
      made.push(...(await deleteLiveField(transaction, id)));
      continue;
    }
    const after = columnRow(id, field);
    // The list is locked, so it cannot be retired while the column comes to draw on it.
    const [list] = await transaction
      .select({ retired: lists.retired })
      .from(lists)
      .where(eq(lists.id, after.listId))
      .for("share");
    if (list === undefined || (list.retired && live?.listId !== after.listId)) {
      throw new ConflictError(
        `The list the column ${after.name} draws on is no longer offered; change the column, then approve it`,
      );
    }
    const before =
      live === undefined ? { ...after, required: false } : columnRow(id, live);
    await checkValuesFit(transaction, before, after);
    if (live === undefined) {
      await transaction.insert(fields).values(after);
      await appendColumn(transaction, id);
      made.push(...fieldChanges(id, "created", undefined, after));
    } else {
      const { name, listId, multiple, required } = after;
      await transaction
        .update(fields)
        .set({ name, listId, multiple, required })
        .where(eq(fields.id, id));
      made.push(...fieldChanges(id, "changed", before, after));
    }
  }
  if (asked.columnOrder) {
    const before = await readColumnOrder(transaction);
    // Asked for only when the order has a draft, as stateWithDrafts checks.
    const held = (heldColumnOrder(state) as string[]).filter((key) =>
      before.includes(key),
    );
    const after = [...held, ...before.filter((key) => !held.includes(key))];
    await writeColumnOrder(transaction, after);
    made.push(...columnOrderChanges(before, after));
  }
  await deleteDrafts(transaction, "field", approved);
  if (asked.columnOrder)
    await deleteDrafts(transaction, "column-order", [columnOrderId]);
  await removeEmptyColumnOrder(transaction);
  return made;
}

// Rejects the drafts of columns asked for, and of the order, with a reason, refusing a column the
// order uses unless the order is rejected too, and returns the changes to record.
export async function rejectColumnDrafts(
  transaction: Transaction,
  actor: Actor,
  asked: ColumnSelection,
  reason: string,
): Promise<Change[]> {
  const state = await stateWithDrafts(transaction, actor, asked);
  if (
    !asked.columnOrder &&
    fieldsOrderUses(state).some((id) => asked.columns.includes(id))
  ) {
    throw new ConflictError(
      "Other drafts use one of these drafts; reject them together, or once they no longer use it",
    );
  }
  const made: Change[] = [];
  const rejecting = [
    ...asked.columns.map((id) => ({
      recordType: "field" as const,
      id,
      draft: state.fieldDrafts.get(id),
    })),
    ...(asked.columnOrder
      ? [
          {
            recordType: "column-order" as const,
            id: columnOrderId,
            draft: state.orderDraft,
          },
        ]
      : []),
  ];
  for (const { recordType, id, draft: found } of rejecting) {
    // Every draft asked for exists, as stateWithDrafts checks.
    const draft = found as Draft;
    if (!(draft.state === "rejected" && draft.reason === reason)) {
      made.push({
        recordType,
        recordId: id,
        action: "changed",
        field: rejectedField,
        tier: "general",
        oldValue: draft.state === "rejected" ? draft.reason : null,
        newValue: reason,
        draft: true,
      });
    }
    await setRejection(transaction, recordType, [id], {
      state: "rejected",
      reason,
    });
  }
  return made;
}
