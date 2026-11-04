// SPDX-License-Identifier: Apache-2.0

// The columns and choices a person's draft may use before they are approved: those drafted to be
// added, as the viewer sees them, beside the live ones. A person's draft that holds a value in a
// column, or a choice, drafted to be added uses that column's or choice's draft, as the Decisions
// Log sets out, so the two are approved together. Part of the data access layer.

import { type Database, fields } from "@fathom/db";
import { inArray } from "drizzle-orm";
import { mostSensitive } from "../access.ts";
import { type Draft, readDrafts, refuseHeld, type Viewer } from "./drafts.ts";
import { typeOf } from "./column-types.ts";
import { draftedList, listTier, readState } from "./lists.ts";
import { type ColumnInfo, inListOrder, readColumns } from "./values.ts";

type Reader = Pick<Database, "select">;

const added = (drafts: ReadonlyMap<string, Draft>, live: ReadonlySet<string>) =>
  [...drafts].filter(
    ([id, draft]) => draft.action === "created" && !live.has(id),
  );

// The People table's live columns, then those drafted to be added that the viewer sees, as their
// drafts make them, each with its values' tier as its type sets it: the most sensitive of the
// column as the viewer drafted it, with its lists as the viewer sees them and as published, and of
// the column as published, with its lists as published, so the viewer's own unpublished changes
// never make values less sensitive. An added column is required only once approved, which checks
// that the people fit it. Locking locks the live columns, as readColumns does.
export async function columnsWithAdded(
  reader: Reader,
  viewer: Viewer,
  lock = false,
): Promise<ColumnInfo[]> {
  const live = await readColumns(reader, lock);
  const fieldDrafts = await readDrafts(reader, "field", undefined, viewer);
  const columns = added(fieldDrafts, new Set(live.map(({ id }) => id)));
  if (columns.length === 0) return live;
  const lists = await readState(reader, viewer);
  const published = await readState(reader);
  // A column's published draft is read only when the viewer has changed it unpublished.
  const publishedFields = columns.some(([, draft]) => draft.unpublished)
    ? await readDrafts(reader, "field")
    : new Map<string, Draft>();
  return [
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
}

// The choices given that are live, in list order, then those drafted to be added that the editor
// sees, in the order drafted, which approving places them in. A choice drafted to be added that
// someone else holds is refused, since they may be discarding it.
export async function choicesWithAdded(
  reader: Reader,
  editor: string,
  choiceIds: readonly string[],
): Promise<{ id: string; listId: string; retired: boolean }[]> {
  const live = await inListOrder(reader, choiceIds);
  const found = new Set(live.map(({ id }) => id));
  const wanted = new Set(choiceIds.filter((id) => !found.has(id)));
  if (wanted.size === 0) return live;
  await refuseHeldPublished(reader, editor, "list-item", [...wanted]);
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

// Refuses giving values in a column only drafted to be added that someone else holds, since they may
// be discarding it.
export async function refuseHeldColumns(
  reader: Reader,
  editor: string,
  columnIds: readonly string[],
): Promise<void> {
  const live = await reader
    .select({ id: fields.id })
    .from(fields)
    .where(inArray(fields.id, [...columnIds]));
  await refuseHeldPublished(
    reader,
    editor,
    "field",
    columnIds.filter((id) => !live.some((column) => column.id === id)),
  );
}

// Refuses records whose published drafts someone else holds. A record only in someone else's
// unpublished draft is left to be refused as one that does not exist, so its maker's draft and
// name stay private.
async function refuseHeldPublished(
  reader: Reader,
  editor: string,
  recordType: "field" | "list-item",
  ids: readonly string[],
): Promise<void> {
  const published = await readDrafts(reader, recordType, ids);
  await refuseHeld(reader, editor, recordType, [...published.keys()]);
}
