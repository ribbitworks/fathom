// SPDX-License-Identifier: Apache-2.0

// The columns added to a table, through the server's API: adding, changing, and removing them, and
// their drafts. Each change returns the change set it was saved in, which undoing it names, or null
// when nothing changed.

import {
  changeSetIdSchema,
  type ColumnTable,
  type Field,
  type FieldRequest,
  fieldSchema,
  savedSchema,
} from "@fathom/shared";
import { z } from "zod";
import { sendDeleteFor, sendJsonFor } from "./api.ts";

const columnsPaths: Readonly<Record<ColumnTable, string>> = {
  people: "/api/people/columns",
  features: "/api/features/columns",
};

const columnPath = (id: string, table: ColumnTable) =>
  // The table is always one of the fixed tables.
  // eslint-disable-next-line security/detect-object-injection
  `${columnsPaths[table]}/${encodeURIComponent(id)}`;

const columnDraftPath = (id: string, table: ColumnTable) =>
  `${columnPath(id, table)}/draft`;

const fieldResponse = z.object({
  field: fieldSchema,
  changeSetId: changeSetIdSchema,
});

export async function createField(
  request: FieldRequest,
  table: ColumnTable,
): Promise<{ field: Field; changeSetId: string | null }> {
  // The table is always one of the fixed tables.
  // eslint-disable-next-line security/detect-object-injection
  return sendJsonFor("POST", columnsPaths[table], request, fieldResponse);
}

export async function updateField(
  id: string,
  request: FieldRequest,
  table: ColumnTable,
): Promise<{ field: Field; changeSetId: string | null }> {
  return sendJsonFor("PUT", columnPath(id, table), request, fieldResponse);
}

export async function discardColumnDraft(
  id: string,
  table: ColumnTable,
): Promise<string | null> {
  return (await sendDeleteFor(columnDraftPath(id, table), savedSchema))
    .changeSetId;
}

// Sends a rejected draft of a column for approval again, unchanged.
export async function resubmitColumnDraft(
  id: string,
  table: ColumnTable,
): Promise<string | null> {
  return (
    await sendDeleteFor(`${columnDraftPath(id, table)}/rejection`, savedSchema)
  ).changeSetId;
}

export async function deleteField(
  id: string,
  table: ColumnTable,
): Promise<string | null> {
  return (await sendDeleteFor(columnPath(id, table), savedSchema)).changeSetId;
}
