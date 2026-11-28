// SPDX-License-Identifier: Apache-2.0

// The rules a change to a list, a choice or a list's order goes through, checked again on
// publishing a private change of it, against the data as it is now. Part of the data access layer.

import { type Actor } from "../access.ts";
import { NotFoundError } from "../errors.ts";
import { type Transaction } from "./changes.ts";
import { type Recorded, wantsNoDraft } from "./draft-records.ts";
import {
  refuseIfChosen,
  refuseIfDraftsChoose,
  refuseUnoffered,
} from "./list-rules.ts";
import {
  draftedChoice,
  draftedList,
  listExists,
  listOfChoice,
  type ListsState,
} from "./list-state.ts";
import {
  checkChoiceSettings,
  checkListDiscard,
  checkListRemoval,
  checkListSettings,
  noList,
  refuseUnseenList,
} from "./lists.ts";

// A change to a list, a choice or an order, with the lists as the user's drafts make them and as
// everyone else has them, checked as the actor.
export interface ListDraft {
  transaction: Transaction;
  actor: Actor;
  mine: ListsState;
  theirs: ListsState;
  id: string;
  row: { action: string; fields: Recorded };
}

// Refuses a change to a list, or to its choices or order, to a role that can't see the list's
// values, as the user's drafts have it, or, where they remove or take it back, as everyone else
// does.
const refuseUnseen = ({ actor, mine, theirs }: ListDraft, listId: string) => {
  refuseUnseenList(
    actor,
    draftedList(mine, listId) === undefined ? theirs : mine,
    listId,
  );
};

// A list as the user's draft makes it, its removal or its taking back, against the list as
// everyone else has it.
export async function checkListDraft(draft: ListDraft): Promise<void> {
  const { transaction, actor, mine, theirs, id, row } = draft;
  refuseUnseen(draft, id);
  if (wantsNoDraft(row)) {
    if (!theirs.lists.has(id)) {
      await checkListDiscard(transaction, actor.user.id, theirs, id);
    }
    return;
  }
  const after = draftedList(mine, id);
  if (after === undefined) {
    await checkListRemoval(transaction, actor.user.id, mine, id);
    return;
  }
  await checkListSettings(
    transaction,
    actor,
    mine,
    id,
    draftedList(theirs, id),
    after,
  );
}

// A choice as the user's draft makes it, its removal or its taking back, against the choice as
// everyone else has it; whatever it is, its list must still offer a choice for all it keeps.
export async function checkChoiceDraft(draft: ListDraft): Promise<void> {
  const { transaction, actor, mine, theirs, id, row } = draft;
  // A choice still has a list, mine or theirs, since one gone takes the change with it.
  const listId = String(listOfChoice(mine, id) ?? listOfChoice(theirs, id));
  refuseUnseen(draft, listId);
  refuseUnoffered(mine, listId);
  if (wantsNoDraft(row)) {
    if (!theirs.choices.has(id)) {
      await refuseIfDraftsChoose(transaction, actor.user.id, [id]);
    }
    return;
  }
  const after = draftedChoice(mine, id);
  if (after === undefined) {
    await refuseIfChosen(transaction, id, actor.user.id);
    return;
  }
  if (!listExists(mine, listId) || draftedList(mine, listId) === undefined) {
    throw new NotFoundError(noList);
  }
  await checkChoiceSettings(
    transaction,
    actor.user.id,
    mine,
    id,
    draftedChoice(theirs, id),
    after,
  );
}

// A new order of a list's choices: the list must still be there. Taking an order back asks nothing.
export function checkOrderDraft(draft: ListDraft) {
  const { mine, id, row } = draft;
  refuseUnseen(draft, id);
  return !wantsNoDraft(row) && draftedList(mine, id) === undefined
    ? Promise.reject(new NotFoundError(noList))
    : Promise.resolve();
}
