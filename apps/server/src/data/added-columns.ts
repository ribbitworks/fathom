// SPDX-License-Identifier: Apache-2.0

// The columns and choices drafted to be added that a draft of a person, planned hire or feature may
// use before they are approved. Part of the data access layer.

import { type Reader } from "@fathom/db";
import type { ColumnTable } from "@fathom/shared";
import { mostSensitive } from "../access.ts";
import type { Draft, Viewer } from "./draft-records.ts";
import { readDrafts } from "./drafts.ts";
import { typeOf } from "./column-types.ts";
import { draftedList, listTier, readState } from "./list-state.ts";
import {
  builtInTiersOf,
  type ColumnInfo,
  inListOrder,
  type TableColumns,
  readColumns,
} from "./values.ts";

const added = (drafts: ReadonlyMap<string, Draft>, live: ReadonlySet<string>) =>
  [...drafts].filter(
    ([id, draft]) => draft.action === "created" && !live.has(id),
  );

// A table's live columns, People's by default, then those drafted to be added to it that the viewer
// sees, as their drafts make them, each with its values' tier as its type sets it: the most
// sensitive of the column as the viewer drafted it, with its lists as the viewer sees them and as
// published, and of the column as published, with its lists as published, so the viewer's own
// unpublished changes never make values less sensitive. An added column is required only once
// approved, which checks that the table's records fit it. Locking locks the live columns, as
// readColumns does.
export async function columnsWithAdded(
  reader: Reader,
  viewer: Viewer,
  lock = false,
  table: ColumnTable = "people",
): Promise<TableColumns> {
  const live = await readColumns(reader, lock, table);
  const fieldDrafts = await readDrafts(reader, "field", undefined, viewer);
  const columns = added(fieldDrafts, new Set(live.map(({ id }) => id))).filter(
    ([, draft]) => draft.fields.tableName === table,
  );
  if (columns.length === 0) return live;
  const lists = await readState(reader, viewer);
  const published = await readState(reader);
  // A column's published draft is read only when the viewer has changed it unpublished.
  const publishedFields = columns.some(([, draft]) => draft.unpublished)
    ? await readDrafts(reader, "field")
    : new Map<string, Draft>();
  const all = [
    ...live,
    ...columns.map(([id, draft]): ColumnInfo => {
      const field = draft.fields;
      const type = typeOf(field);
      const settings = type.settings(field);
      const publishedField = publishedFields.get(id)?.fields ?? field;
      return {
        id,
        tableName: String(field.tableName),
        name: String(field.name),
        ...settings,
        required: false,
        onPlannedHires: field.onPlannedHires === true,
        tier: mostSensitive([
          type.tier(settings, (listId) => listTier(lists, listId)),
          type.tier(settings, (listId) => listTier(published, listId)),
          type.tier(type.settings(publishedField), (listId) =>
            listTier(published, listId),
          ),
        ]),
        listRetired:
          settings.listId !== null &&
          draftedList(lists, settings.listId)?.retired === true,
      };
    }),
  ];
  return Object.assign(all, builtInTiersOf(live));
}

// The choices given that are live, in list order, then those drafted to be added that the editor
// sees, in the order drafted, which approving places them in.
export async function choicesWithAdded(
  reader: Reader,
  editor: string,
  choiceIds: readonly string[],
): Promise<{ id: string; listId: string; retired: boolean }[]> {
  const live = await inListOrder(reader, choiceIds);
  const found = new Set(live.map(({ id }) => id));
  const wanted = new Set(choiceIds.filter((id) => !found.has(id)));
  if (wanted.size === 0) return live;
  const choiceDrafts = await readDrafts(
    reader,
    "list-item",
    [...wanted],
    editor,
  );
  return [
    ...live,
    ...added(choiceDrafts, found).map(([id, draft]) => ({
      id,
      listId: String(draft.fields.listId),
      retired: draft.fields.retired === true,
    })),
  ];
}
