// SPDX-License-Identifier: Apache-2.0

// The rules a change to a column goes through, checked again on publishing a private change of it,
// against the data as it is now. Part of the data access layer.

import { ConflictError } from "../errors.ts";
import { type Transaction } from "./changes.ts";
import { type Actor } from "../access.ts";
import {
  checkColumnRemoval,
  checkColumnSettings,
  refuseIfDraftsFill,
} from "./column-drafts.ts";
import { type ColumnsState, draftedField } from "./column-state.ts";
import { type Recorded, wantsNoDraft } from "./draft-records.ts";

const conflict = (message: string) => new ConflictError(message);

// A column as the user's draft makes it, its removal or its taking back, with the columns as the
// user's drafts make them and as everyone else has them, checked as the actor.
export async function checkColumnDraft(
  transaction: Transaction,
  actor: Actor,
  mine: ColumnsState,
  theirs: ColumnsState,
  id: string,
  row: { action: string; fields: Recorded },
): Promise<void> {
  const live = theirs.fields.get(id);
  if (wantsNoDraft(row)) {
    const added = draftedField(theirs, id);
    if (live === undefined && added !== undefined) {
      await refuseIfDraftsFill(transaction, actor.user.id, id, added);
    }
    return;
  }
  const after = draftedField(mine, id);
  // A removal is of a live column, since a column removed since takes the change with it.
  if (after === undefined) {
    await checkColumnRemoval(transaction, actor, mine, id, live as Recorded);
    return;
  }
  await checkColumnSettings(
    transaction,
    actor,
    mine,
    id,
    draftedField(theirs, id),
    after,
    conflict,
  );
}
