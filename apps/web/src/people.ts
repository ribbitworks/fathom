// SPDX-License-Identifier: Apache-2.0

// People and the People table's saved views, through the server's API, with the drafts of people
// and their approval. Each change returns the change set it was saved in, which
// undoing it names, or null when nothing changed.

import {
  changeSetIdSchema,
  type PersonChange,
  type PersonRequest,
  peopleSchema,
  savedSchema,
  type SavedViewChange,
  type SavedViewRequest,
  savedViewSchema,
} from "@fathom/shared";
import { queryOptions } from "@tanstack/react-query";
import { z } from "zod";
import { getJson, sendDeleteFor, sendJsonFor } from "./api.ts";

export type PeopleData = z.infer<typeof peopleSchema>;

export const peopleQuery = queryOptions({
  queryKey: ["people"],
  queryFn: () => getJson("/api/people", peopleSchema),
});

const personPath = (id: string) => `/api/people/${encodeURIComponent(id)}`;

// Adds people, all saved together, and gives their identifiers and the change set they were saved in.
export async function createPeople(
  people: PersonRequest[],
): Promise<{ ids: string[]; changeSetId: string | null }> {
  return sendJsonFor(
    "POST",
    "/api/people",
    { people },
    z.object({ ids: z.array(z.string()), changeSetId: changeSetIdSchema }),
  );
}

export async function updatePerson(
  id: string,
  change: PersonChange,
): Promise<string | null> {
  return (await sendJsonFor("PATCH", personPath(id), change, savedSchema))
    .changeSetId;
}

// Drafts removing a person, or discards the draft of someone only drafted to be added.
export async function deletePerson(id: string): Promise<string | null> {
  return (await sendDeleteFor(personPath(id), savedSchema)).changeSetId;
}

export async function discardDraft(id: string): Promise<string | null> {
  return (await sendDeleteFor(`${personPath(id)}/draft`, savedSchema))
    .changeSetId;
}

// Sends a rejected draft for approval again, unchanged.
export async function resubmitDraft(id: string): Promise<string | null> {
  return (await sendDeleteFor(`${personPath(id)}/draft/rejection`, savedSchema))
    .changeSetId;
}

const viewPath = (id: string) => `/api/people/views/${encodeURIComponent(id)}`;
const viewResponse = z.object({
  view: savedViewSchema,
  changeSetId: changeSetIdSchema,
});

export async function createView(
  request: SavedViewRequest,
): Promise<z.infer<typeof viewResponse>> {
  return sendJsonFor("POST", "/api/people/views", request, viewResponse);
}

// Renames a saved view, saves a new view over it, or both.
export async function updateView(
  id: string,
  change: SavedViewChange,
): Promise<z.infer<typeof viewResponse>> {
  return sendJsonFor("PUT", viewPath(id), change, viewResponse);
}

export async function deleteView(id: string): Promise<string | null> {
  return (await sendDeleteFor(viewPath(id), savedSchema)).changeSetId;
}
