// SPDX-License-Identifier: Apache-2.0

// The data access layer's interface to the columns added to one table of planned work, such as
// Features or Activities, each change a draft by those who may set up the table's columns.

import type { Database } from "@fathom/db";
import type { ColumnTable, Field, FieldRequest } from "@fathom/shared";
import type { Actor } from "../access.ts";
import type { ChangeSetId, Saved } from "./changes.ts";
import * as columnDrafts from "./column-drafts.ts";
import { columnEditor } from "./column-state.ts";

export interface ColumnAccess {
  create(actor: Actor, request: FieldRequest): Promise<Saved<Field>>;
  update(
    actor: Actor,
    id: string,
    request: FieldRequest,
  ): Promise<Saved<Field>>;
  remove(actor: Actor, id: string): Promise<ChangeSetId>;
  discardDraft(actor: Actor, id: string): Promise<ChangeSetId>;
  resubmitDraft(actor: Actor, id: string): Promise<ChangeSetId>;
}

export function createColumnAccess(
  database: Database,
  table: Exclude<ColumnTable, "people">,
): ColumnAccess {
  const editor = (actor: Actor) => columnEditor(actor, table);
  return {
    create: async (actor, request) =>
      columnDrafts.createField(database, editor(actor), request, table),
    update: async (actor, id, request) =>
      columnDrafts.updateField(database, editor(actor), id, request, table),
    remove: async (actor, id) =>
      columnDrafts.deleteField(database, editor(actor), id, table),
    discardDraft: async (actor, id) =>
      columnDrafts.discardColumnDraft(database, editor(actor), { id, table }),
    resubmitDraft: async (actor, id) =>
      columnDrafts.resubmitColumnDraft(database, editor(actor), { id, table }),
  };
}
