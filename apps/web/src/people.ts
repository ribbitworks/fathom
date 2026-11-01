// SPDX-License-Identifier: Apache-2.0

// People and the columns on the People table, through the server's API. Each change returns the
// change set it was saved in, which undoing it names, or null when nothing changed.

import {
  changeSetIdSchema,
  type Field,
  type FieldRequest,
  fieldSchema,
  type PersonChange,
  type PersonRequest,
  peopleSchema,
  savedSchema,
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
const columnPath = (id: string) =>
  `/api/people/columns/${encodeURIComponent(id)}`;
const fieldResponse = z.object({
  field: fieldSchema,
  changeSetId: changeSetIdSchema,
});

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

export async function deletePerson(id: string): Promise<string | null> {
  return (await sendDeleteFor(personPath(id), savedSchema)).changeSetId;
}

export async function createField(
  request: FieldRequest,
): Promise<{ field: Field; changeSetId: string | null }> {
  return sendJsonFor("POST", "/api/people/columns", request, fieldResponse);
}

export async function updateField(
  id: string,
  request: FieldRequest,
): Promise<{ field: Field; changeSetId: string | null }> {
  return sendJsonFor("PUT", columnPath(id), request, fieldResponse);
}

// Moves a column, built-in or added, by its key, to just after another, or to the start when there
// is none.
export async function moveColumn(
  key: string,
  after: string | null,
): Promise<string | null> {
  return (
    await sendJsonFor(
      "PUT",
      `${columnPath(key)}/position`,
      { after },
      savedSchema,
    )
  ).changeSetId;
}

export async function deleteField(id: string): Promise<string | null> {
  return (await sendDeleteFor(columnPath(id), savedSchema)).changeSetId;
}
