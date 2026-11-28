// SPDX-License-Identifier: Apache-2.0

// The rules a change to a list, a choice or a list's order goes through, checked again on
// publishing a private change of it, against the data as it is now. Part of the data access layer.

import { duplicateList } from "@fathom/shared";
import { ConflictError, NotFoundError } from "../errors.ts";
import { type Transaction } from "./changes.ts";
import { type Recorded, wantsNoDraft } from "./draft-records.ts";
import {
  choiceLabelTaken,
  choicesHaveDrafts,
  listNameTaken,
  peoplesMeaning,
  refuseIfChosen,
  refuseIfDraftsChoose,
  refuseIfUsed,
  refuseMeaningMisfit,
  refusePeoplesMeaningWhileHeld,
  refuseSensitivePlanningList,
  refuseUnoffered,
  refuseWeightMisfit,
} from "./list-rules.ts";
import { meaningOf, weightOf } from "./list-reads.ts";
import {
  addedChoices,
  draftedChoice,
  draftedList,
  listExists,
  listOfChoice,
  type ListsState,
} from "./list-state.ts";
import { choicesDrafted, duplicateChoice, noList } from "./lists.ts";

// A change to a list, a choice or an order, with the lists as the user's drafts make them and as
// everyone else has them.
export interface ListDraft {
  transaction: Transaction;
  editor: string;
  mine: ListsState;
  theirs: ListsState;
  id: string;
  row: { action: string; fields: Recorded };
}

// A list taken back while only drafted to be added: as discarding it is refused.
async function checkListTakenBack({
  transaction,
  editor,
  theirs,
  id,
}: ListDraft) {
  if (theirs.lists.has(id)) return;
  await refuseIfUsed(transaction, id, "discarded", editor);
  await refuseIfDraftsChoose(transaction, editor, addedChoices(theirs, id));
}

// A list as the user's draft makes it, or its removal, against the list as everyone else has it.
export async function checkListDraft(draft: ListDraft): Promise<void> {
  const { transaction, editor, mine, theirs, id, row } = draft;
  if (wantsNoDraft(row)) {
    await checkListTakenBack(draft);
    return;
  }
  const after = draftedList(mine, id);
  const before = draftedList(theirs, id);
  if (after === undefined) {
    await refuseIfUsed(transaction, id, "deleted", editor);
    if (choicesHaveDrafts(mine, id)) throw new ConflictError(choicesDrafted);
    return;
  }
  if (listNameTaken(mine, String(after.name), id)) {
    throw new ConflictError(duplicateList);
  }
  if (before !== undefined && after.visibility !== before.visibility) {
    await refuseSensitivePlanningList(
      transaction,
      id,
      String(after.visibility),
      editor,
    );
  }
  if (after.retired === true && before?.retired !== true) {
    await refuseIfUsed(transaction, id, "retired", editor);
  }
}

// A choice as the user's draft makes it, or its removal or taking back, against the choice as
// everyone else has it; whatever it is, its list must still offer a choice for all it keeps.
export async function checkChoiceDraft(draft: ListDraft): Promise<void> {
  const { transaction, editor, mine, theirs, id, row } = draft;
  // A choice gone from every list leaves no list to check, and its list is no built-in one.
  refuseUnoffered(
    mine,
    String(listOfChoice(mine, id) ?? listOfChoice(theirs, id)),
  );
  const before = draftedChoice(theirs, id);
  if (wantsNoDraft(row)) {
    if (!theirs.choices.has(id)) {
      await refuseIfDraftsChoose(transaction, editor, [id]);
    }
    return;
  }
  const after = draftedChoice(mine, id);
  if (after === undefined) {
    await refuseIfChosen(transaction, id, editor);
    return;
  }
  const list = String(after.listId);
  if (!listExists(mine, list) || draftedList(mine, list) === undefined) {
    throw new NotFoundError(noList);
  }
  if (choiceLabelTaken(mine, list, String(after.label), id)) {
    throw new ConflictError(duplicateChoice);
  }
  refuseMeaningMisfit(mine, list, meaningOf(after));
  refuseWeightMisfit(mine, list, weightOf(after));
  if (peoplesMeaning(after.meaning) && !peoplesMeaning(before?.meaning)) {
    await refusePeoplesMeaningWhileHeld(transaction, id, after.meaning, editor);
  }
}

// A new order of a list's choices: the list must still be there. Taking an order back asks nothing.
export function checkOrderDraft({ mine, id, row }: ListDraft): Promise<void> {
  return !wantsNoDraft(row) && draftedList(mine, id) === undefined
    ? Promise.reject(new NotFoundError(noList))
    : Promise.resolve();
}
