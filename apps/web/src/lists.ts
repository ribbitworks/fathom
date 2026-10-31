// SPDX-License-Identifier: Apache-2.0

// Lists of choices through the server's API: reading them, and every change to lists and choices,
// with the names users see for each visibility.

import {
  type Choice,
  type ChoiceRequest,
  choiceSchema,
  type List,
  type ListRequest,
  listSchema,
  listsSchema,
  type Tier,
} from "@fathom/shared";
import { queryOptions } from "@tanstack/react-query";
import { z } from "zod";
import { getJson, sendDelete, sendJson, sendJsonFor } from "./api.ts";

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
const listResponse = z.object({ list: listSchema });

export async function createList(request: ListRequest): Promise<List> {
  return (await sendJsonFor("POST", "/api/lists", request, listResponse)).list;
}

export async function updateList(
  id: string,
  request: ListRequest,
): Promise<List> {
  return (await sendJsonFor("PUT", listPath(id), request, listResponse)).list;
}

export async function setListRetired(
  id: string,
  retired: boolean,
): Promise<void> {
  await sendJson("PUT", `${listPath(id)}/retired`, { retired });
}

export async function deleteList(id: string): Promise<void> {
  await sendDelete(listPath(id));
}

// Adds choices to the end of a list, all saved together.
export async function addChoices(
  listId: string,
  choices: ChoiceRequest[],
): Promise<Choice[]> {
  return (
    await sendJsonFor(
      "POST",
      `${listPath(listId)}/choices`,
      { choices },
      z.object({ choices: z.array(choiceSchema) }),
    )
  ).choices;
}

export async function updateChoice(
  listId: string,
  id: string,
  request: ChoiceRequest,
): Promise<Choice> {
  return (
    await sendJsonFor(
      "PUT",
      choicePath(listId, id),
      request,
      z.object({ choice: choiceSchema }),
    )
  ).choice;
}

// Moves a choice to just after another, or to the top when there is none.
export async function moveChoice(
  listId: string,
  id: string,
  after: string | null,
): Promise<void> {
  await sendJson("PUT", `${choicePath(listId, id)}/position`, { after });
}

// Retires a choice, or restores it, to the end of the list unless it keeps its place.
export async function setChoiceRetired(
  listId: string,
  id: string,
  retired: boolean,
  keepPlace = false,
): Promise<void> {
  await sendJson("PUT", `${choicePath(listId, id)}/retired`, {
    retired,
    keepPlace,
  });
}

export async function deleteChoice(listId: string, id: string): Promise<void> {
  await sendDelete(choicePath(listId, id));
}

// Text for comparing names: trimmed and in lower case.
export function sameName(first: string, second: string): boolean {
  return first.trim().toLowerCase() === second.trim().toLowerCase();
}
