// SPDX-License-Identifier: Apache-2.0

// The data access layer's interface to lists and their choices, each bound to a database, and the
// check that the actor may change planning configuration.

import type { Database } from "@fathom/db";
import type {
  Choice,
  ChoiceRequest,
  List,
  ListRequest,
  RetiredRequest,
} from "@fathom/shared";
import { type Actor, requirePermission } from "../access.ts";
import { discardListDraft, resubmitListDraft } from "./list-draft-decisions.ts";
import * as lists from "./lists.ts";
import type { Saved, ChangeSetId } from "./changes.ts";
import { seenLists } from "./page-reads.ts";

// Which draft of a list: the list's own, one of its choices', or that of its choices' order.
export type ListDraftTarget =
  | { kind: "list"; listId: string }
  | { kind: "choice"; listId: string; choiceId: string }
  | { kind: "order"; listId: string };

// Every change to lists and choices is a draft, which reaches the live lists once approved.
export interface ListAccess {
  read(actor: Actor): Promise<List[]>;
  create(actor: Actor, request: ListRequest): Promise<Saved<List>>;
  update(actor: Actor, id: string, request: ListRequest): Promise<Saved<List>>;
  setRetired(
    actor: Actor,
    id: string,
    request: RetiredRequest,
  ): Promise<ChangeSetId>;
  delete(actor: Actor, id: string): Promise<ChangeSetId>;
  addChoices(
    actor: Actor,
    listId: string,
    requests: readonly ChoiceRequest[],
  ): Promise<Saved<Choice[]>>;
  updateChoice(
    actor: Actor,
    listId: string,
    id: string,
    request: ChoiceRequest,
  ): Promise<Saved<Choice>>;
  // Moves a choice to just after another, or to the top when there is none.
  moveChoice(
    actor: Actor,
    listId: string,
    id: string,
    after: string | null,
  ): Promise<ChangeSetId>;
  setChoiceRetired(
    actor: Actor,
    listId: string,
    id: string,
    request: RetiredRequest,
  ): Promise<ChangeSetId>;
  deleteChoice(actor: Actor, listId: string, id: string): Promise<ChangeSetId>;
  discardDraft(actor: Actor, target: ListDraftTarget): Promise<ChangeSetId>;
  // Sends a rejected draft for approval again, unchanged.
  resubmitDraft(actor: Actor, target: ListDraftTarget): Promise<ChangeSetId>;
}

// Checks the actor may change planning configuration, such as lists and the planning settings, and
// returns who to record as making the change.
export function editor(actor: Actor): Actor {
  requirePermission(actor, "configuration:edit");
  return actor;
}

export function createListAccess(database: Database): ListAccess {
  return {
    read: async (actor) => seenLists(database, actor),
    create: async (actor, request) => {
      editor(actor);
      return lists.createList(database, actor, request);
    },
    update: async (actor, id, request) => {
      editor(actor);
      return lists.updateList(database, actor, id, request);
    },
    setRetired: async (actor, id, { retired }) =>
      lists.setListRetired(database, editor(actor), id, retired),
    delete: async (actor, id) => lists.deleteList(database, editor(actor), id),
    addChoices: async (actor, listId, requests) =>
      lists.addChoices(database, editor(actor), listId, requests),
    updateChoice: async (actor, listId, id, request) =>
      lists.updateChoice(database, editor(actor), listId, id, request),
    moveChoice: async (actor, listId, id, after) =>
      lists.moveChoice(database, editor(actor), listId, id, after),
    setChoiceRetired: async (actor, listId, id, { retired }) =>
      lists.setChoiceRetired(database, editor(actor), listId, id, retired),
    deleteChoice: async (actor, listId, id) =>
      lists.deleteChoice(database, editor(actor), listId, id),
    discardDraft: async (actor, target) =>
      discardListDraft(
        database,
        editor(actor),
        target.kind,
        target.listId,
        target.kind === "choice" ? target.choiceId : undefined,
      ),
    resubmitDraft: async (actor, target) =>
      resubmitListDraft(
        database,
        editor(actor),
        target.kind,
        target.listId,
        target.kind === "choice" ? target.choiceId : undefined,
      ),
  };
}
