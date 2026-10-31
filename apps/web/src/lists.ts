// SPDX-License-Identifier: Apache-2.0

// Lists of choices through the server's API: reading them, and every change to lists and choices,
// with the names users see for each visibility. Each change returns the change set it was saved in,
// which undoing it names, or null when nothing changed.

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

// Text for comparing names: trimmed and in lower case.
export function sameName(first: string, second: string): boolean {
  return first.trim().toLowerCase() === second.trim().toLowerCase();
}
