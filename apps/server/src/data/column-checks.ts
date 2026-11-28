// SPDX-License-Identifier: Apache-2.0

// The rules a change to a column goes through, checked again on publishing a private change of it,
// against the data as it is now. Part of the data access layer.

import { ConflictError } from "../errors.ts";
import { type Transaction } from "./changes.ts";
import { refuseIfDraftsChange, refuseIfDraftsFill } from "./column-drafts.ts";
import {
  checkList,
  columnRow,
  type ColumnsState,
  draftedField,
  duplicateField,
  nameTaken,
  refuseSensitiveOnFeatures,
} from "./column-state.ts";
import { type Recorded, wantsNoDraft } from "./draft-records.ts";
import { checkValuesFit } from "./fields.ts";

const conflict = (message: string) => new ConflictError(message);

// A column as the user's draft makes it, its removal or its taking back, with the columns as the
// user's drafts make them and as everyone else has them.
export async function checkColumnDraft(
  transaction: Transaction,
  editor: string,
  mine: ColumnsState,
  theirs: ColumnsState,
  id: string,
  row: { action: string; fields: Recorded },
): Promise<void> {
  const live = theirs.fields.get(id);
  if (wantsNoDraft(row)) {
    const added = draftedField(theirs, id);
    if (live === undefined && added !== undefined) {
      await refuseIfDraftsFill(transaction, editor, id, added);
    }
    return;
  }
  const after = draftedField(mine, id);
  if (after === undefined) {
    // A removal is of a live column, since a column removed since takes the change with it.
    await refuseIfDraftsChange(transaction, editor, id, live as Recorded);
    return;
  }
  if (nameTaken(mine, String(after.name), id, after.tableName)) {
    throw new ConflictError(duplicateField);
  }
  const wanted = columnRow(id, after);
  // The live values are checked against the live column, as a fresh change checks them.
  const current = columnRow(id, live ?? { ...after, required: false });
  await checkValuesFit(transaction, current, wanted, editor);
  const liveList = live === undefined ? null : current.listId;
  if (wanted.listId !== null && wanted.listId !== liveList) {
    await checkList(transaction, mine, wanted.listId, conflict);
  }
  refuseSensitiveOnFeatures(mine, after);
}
