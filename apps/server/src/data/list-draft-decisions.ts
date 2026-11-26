// SPDX-License-Identifier: Apache-2.0

// Discarding and resubmitting a draft of a list, a choice or a list's order. Part of the data
// access layer.

import { type Database } from "@fathom/db";
import type { DraftKind } from "@fathom/shared";

import { type Actor } from "../access.ts";
import { ConflictError, NotFoundError } from "../errors.ts";
import { type Change, recordChanges } from "./changes.ts";
import { setRejection } from "./drafts.ts";
import { clearedRejection, type Draft } from "./draft-records.ts";
import {
  refuseIfDraftsChoose,
  refuseIfUsed,
  refuseLastKept,
} from "./list-rules.ts";
import {
  addedChoices,
  choiceExists,
  listExists,
  listOfChoice,
  type ListsState,
} from "./list-state.ts";
import {
  discardingChoice,
  discardingList,
  discardingOrder,
  drafting,
  noChoice,
  noList,
  refuseUnseenList,
  removeDiscarded,
} from "./lists.ts";

const noDraft = "There is no such draft";

export type ListDraftKind = "list" | "choice" | "order";

// Finds a draft of a list, a choice, or a list's order, refusing one that does not exist.
function draftOf(
  state: ListsState,
  kind: ListDraftKind,
  listId: string,
  choiceId?: string,
): Draft {
  if (!listExists(state, listId)) throw new NotFoundError(noList);
  if (kind === "choice") {
    const id = choiceId as string;
    if (!choiceExists(state, id) || listOfChoice(state, id) !== listId) {
      throw new NotFoundError(noChoice);
    }
  }
  let draft: Draft | undefined;
  if (kind === "list") {
    draft = state.listDrafts.get(listId);
  } else if (kind === "order") {
    draft = state.orderDrafts.get(listId);
  } else {
    draft = state.choiceDrafts.get(choiceId as string);
  }
  if (draft === undefined) throw new NotFoundError(noDraft);
  return draft;
}

// Discards a draft of a list, a choice, or a list's order, so the record is as it is live, or, for
// one only drafted to be added, gone, with the drafts of its choices.
export async function discardListDraft(
  database: Database,
  maker: Actor,
  kind: ListDraftKind,
  listId: string,
  choiceId?: string,
): Promise<string | null> {
  return drafting(database, maker.user.id, async (transaction, state) => {
    draftOf(state, kind, listId, choiceId);
    refuseUnseenList(maker, state, listId);
    if (kind === "list" && !state.lists.has(listId)) {
      await refuseIfUsed(transaction, listId, "discarded", maker.user.id);
      await refuseIfDraftsChoose(
        transaction,
        maker.user.id,
        addedChoices(state, listId),
      );
    }
    if (kind === "choice") {
      const id = choiceId as string;
      refuseLastKept(state, listId, id, state.choices.get(id)?.record);
      if (!state.choices.has(id)) {
        await refuseIfDraftsChoose(transaction, maker.user.id, [id]);
      }
    }
    let made: Change[];
    if (kind === "list") made = discardingList(state, listId);
    else if (kind === "order") made = discardingOrder(state, listId);
    else made = discardingChoice(state, choiceId as string);
    await removeDiscarded(transaction, maker.user.id, made);
    return recordChanges(transaction, maker, made, "discard");
  });
}

// Sends a rejected draft of a list, a choice, or a list's order for approval again, unchanged.
export async function resubmitListDraft(
  database: Database,
  maker: Actor,
  kind: ListDraftKind,
  listId: string,
  choiceId?: string,
): Promise<string | null> {
  return drafting(database, maker.user.id, async (transaction, state) => {
    const draft = draftOf(state, kind, listId, choiceId);
    refuseUnseenList(maker, state, listId);
    if (draft.state !== "rejected") {
      throw new ConflictError("Only a rejected draft can be resubmitted");
    }
    const recordType = draftTypeOf(kind);
    const id = kind === "choice" ? (choiceId as string) : listId;
    await setRejection(transaction, recordType, [id], {
      state: "waiting",
      reason: null,
    });
    return recordChanges(
      transaction,
      maker,
      clearedRejection(id, () => "general", undefined, draft, recordType),
      "resubmission",
    );
  });
}

export const draftTypeOf = (kind: ListDraftKind): DraftKind => {
  if (kind === "list") return "list";
  return kind === "order" ? "choice-order" : "list-item";
};
