// SPDX-License-Identifier: Apache-2.0

// People, through the server's API, with the drafts of people and their approval. Each change
// returns the change set it was saved in, which undoing it names, or null when nothing changed.

import {
  changeSetIdSchema,
  type PersonChange,
  type PersonRequest,
  peopleColumnsSchema,
  peopleSchema,
  savedSchema,
} from "@fathom/shared";
import { queryOptions } from "@tanstack/react-query";
import { z } from "zod";
import { dayQuery, getJson, sendDeleteFor, sendJsonFor } from "./api.ts";

export type PeopleData = z.infer<typeof peopleSchema>;

export const peopleQuery = queryOptions({
  queryKey: ["people"],
  queryFn: () => getJson("/api/people", peopleSchema),
});

// People on another day, under the people's key, or today's with none, keeping what is shown while
// another day's loads.
export const peopleQueryOn = dayQuery("people", "/api/people", peopleSchema);

// People's added columns alone, under the people's key, so whatever reloads the people reloads them.
export const peopleColumnsQuery = queryOptions({
  queryKey: [...peopleQuery.queryKey, "columns"],
  queryFn: () => getJson("/api/people/columns", peopleColumnsSchema),
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
