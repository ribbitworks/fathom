// SPDX-License-Identifier: Apache-2.0

// Lists of choices through the server's API: reading them, with their drafts, every change to lists
// and choices, each a draft, and discarding drafts or sending rejected ones for approval again, with
// the names users see for each visibility. Each change returns the change set it was saved in, which
// undoing it names, or null when nothing changed.

import {
  changeSetIdSchema,
  type Choice,
  type ChoiceRequest,
  choiceSchema,
  type List,
  type ListRequest,
  listSchema,
  listsSchema,
  savedSchema,
  type Tier,
} from "@fathom/shared";
import { queryOptions } from "@tanstack/react-query";
import { z } from "zod";
import { getJson, sendDeleteFor, sendJsonFor } from "./api.ts";

// Every tier must be named, which the compiler checks.
const visibilityNames: Record<Tier, string> = {
  general: "Everyone",
  restricted: "Restricted",
  confidential: "Confidential",
};

export function visibilityName(tier: Tier): string {
  // The tier is always one of the fixed tiers named above.
  // eslint-disable-next-line security/detect-object-injection
  return visibilityNames[tier];
}

export const listsQuery = queryOptions({
  queryKey: ["lists"],
  queryFn: async () => (await getJson("/api/lists", listsSchema)).lists,
});

const listPath = (id: string) => `/api/lists/${encodeURIComponent(id)}`;
const choicePath = (listId: string, id: string) =>
  `${listPath(listId)}/choices/${encodeURIComponent(id)}`;
const listResponse = z.object({
  list: listSchema,
  changeSetId: changeSetIdSchema,
});

export async function createList(
  request: ListRequest,
): Promise<{ list: List; changeSetId: string | null }> {
  return sendJsonFor("POST", "/api/lists", request, listResponse);
}

export async function updateList(
  id: string,
  request: ListRequest,
): Promise<{ list: List; changeSetId: string | null }> {
  return sendJsonFor("PUT", listPath(id), request, listResponse);
}

export async function setListRetired(
  id: string,
  retired: boolean,
): Promise<string | null> {
  return (
    await sendJsonFor(
      "PUT",
      `${listPath(id)}/retired`,
      { retired },
      savedSchema,
    )
  ).changeSetId;
}

export async function deleteList(id: string): Promise<string | null> {
  return (await sendDeleteFor(listPath(id), savedSchema)).changeSetId;
}

// Adds choices to the end of a list, all saved together.
export async function addChoices(
  listId: string,
  choices: ChoiceRequest[],
): Promise<{ choices: Choice[]; changeSetId: string | null }> {
  return sendJsonFor(
    "POST",
    `${listPath(listId)}/choices`,
    { choices },
    z.object({
      choices: z.array(choiceSchema),
      changeSetId: changeSetIdSchema,
    }),
  );
}

export async function updateChoice(
  listId: string,
  id: string,
  request: ChoiceRequest,
): Promise<string | null> {
  return (
    await sendJsonFor("PUT", choicePath(listId, id), request, savedSchema)
  ).changeSetId;
}

// Moves a choice to just after another, or to the top when there is none.
export async function moveChoice(
  listId: string,
  id: string,
  after: string | null,
): Promise<string | null> {
  return (
    await sendJsonFor(
      "PUT",
      `${choicePath(listId, id)}/position`,
      { after },
      savedSchema,
    )
  ).changeSetId;
}

// Retires a choice, or restores it to the end of the list.
export async function setChoiceRetired(
  listId: string,
  id: string,
  retired: boolean,
): Promise<string | null> {
  return (
    await sendJsonFor(
      "PUT",
      `${choicePath(listId, id)}/retired`,
      { retired },
      savedSchema,
    )
  ).changeSetId;
}

export async function deleteChoice(
  listId: string,
  id: string,
): Promise<string | null> {
  return (await sendDeleteFor(choicePath(listId, id), savedSchema)).changeSetId;
}

// Which draft of a list: its own, one of its choices', or that of its choices' order.
export type ListDraftTarget =
  | { kind: "list"; listId: string }
  | { kind: "choice"; listId: string; choiceId: string }
  | { kind: "order"; listId: string };

function draftPath(target: ListDraftTarget): string {
  if (target.kind === "choice") {
    return `${choicePath(target.listId, target.choiceId)}/draft`;
  }
  return target.kind === "order"
    ? `${listPath(target.listId)}/order/draft`
    : `${listPath(target.listId)}/draft`;
}

// Discards a draft, so the record is as it is live, or, if the draft added it, gone.
export async function discardListDraft(
  target: ListDraftTarget,
): Promise<string | null> {
  return (await sendDeleteFor(draftPath(target), savedSchema)).changeSetId;
}

// Sends a rejected draft for approval again, unchanged.
export async function resubmitListDraft(
  target: ListDraftTarget,
): Promise<string | null> {
  return (await sendDeleteFor(`${draftPath(target)}/rejection`, savedSchema))
    .changeSetId;
}

// Whether a choice can be given to people: it is live, so not only drafted to be added, and not
// retired, as its draft makes it.
export const offered = (choice: Choice) =>
  !choice.retired && choice.draft?.action !== "created";

// Text for comparing names: trimmed and in lower case.
export function sameName(first: string, second: string): boolean {
  return first.trim().toLowerCase() === second.trim().toLowerCase();
}

// Every list as it is live, without drafts: those only drafted to be added are left out, with the
// choices only drafted to be added, and each list and choice has its live values back, with its
// choices in their live order.
export function liveLists(lists: readonly List[]): List[] {
  return lists.flatMap((list): List[] => {
    if (list.draft?.action === "created") return [];
    const { draft, orderDraft, ...rest } = list;
    const choices = list.choices.flatMap((choice) => {
      if (choice.draft?.action === "created") return [];
      const { draft: choiceDraft, ...live } = choice;
      const was = choiceDraft?.action === "changed" ? choiceDraft.live : {};
      return [
        {
          ...live,
          label: was.label ?? live.label,
          description: was.description ?? live.description,
          retired: was.retired ?? live.retired,
        },
      ];
    });
    const order = orderDraft?.live ?? [];
    const place = (id: string) => {
      const at = order.indexOf(id);
      return at === -1 ? order.length : at;
    };
    return [
      {
        ...rest,
        ...(draft?.action === "changed"
          ? {
              name: draft.live.name ?? rest.name,
              description: draft.live.description ?? rest.description,
              visibility: draft.live.visibility ?? rest.visibility,
              retired: draft.live.retired ?? rest.retired,
            }
          : {}),
        choices: [...choices].sort((a, b) => place(a.id) - place(b.id)),
      },
    ];
  });
}
