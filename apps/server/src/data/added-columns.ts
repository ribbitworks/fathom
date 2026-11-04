// SPDX-License-Identifier: Apache-2.0

// The columns and choices a person's draft may use before they are approved: those drafted to be
// added, as the viewer sees them, beside the live ones. A person's draft that holds a value in a
// column, or a choice, drafted to be added uses that column's or choice's draft, as the Decisions
// Log sets out, so the two are approved together. Part of the data access layer.

import { type Database, fields } from "@fathom/db";
import { inArray } from "drizzle-orm";
import { mostSensitive, storedTier } from "../access.ts";
import { type Draft, readDrafts, refuseHeld, type Viewer } from "./drafts.ts";
import { draftedList, listTier, readState } from "./lists.ts";
import { type ColumnInfo, inListOrder, readColumns } from "./values.ts";

type Reader = Pick<Database, "select">;

const added = (drafts: ReadonlyMap<string, Draft>, live: ReadonlySet<string>) =>
  [...drafts].filter(
    ([id, draft]) => draft.action === "created" && !live.has(id),
  );

// The People table's live columns, then those drafted to be added that the viewer sees, as their
// drafts make them, each with its values' tier: an added choice column's is its list's, live or as
// drafted, and an added web link column's its visibility, published or as the viewer drafted it,
// whichever is more sensitive. An added column is required only once approved, which checks that
// the people fit it. Locking locks the live columns, as readColumns does.
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
  // Only an added web link column's tier depends on its published draft.
  const publishedFields = columns.some(
    ([, draft]) => draft.fields.type === "link",
  )
    ? await readDrafts(reader, "field")
    : new Map<string, Draft>();
  return [
    ...live,
    ...columns.map(([id, draft]): ColumnInfo => {
      const field = draft.fields;
      const common = {
        id,
        tableName: String(field.tableName),
        name: String(field.name),
        required: false,
      };
      if (field.type === "link") {
        return {
          ...common,
          type: "link",
          listId: null,
          visibility: String(field.visibility),
          multiple: false,
          // The viewer's own unpublished change never makes its values less sensitive.
          tier: mostSensitive([
            storedTier(field.visibility),
            storedTier(
              publishedFields.get(id)?.fields.visibility ?? field.visibility,
            ),
          ]),
          listRetired: false,
        };
      }
      const listId = String(field.listId);
      return {
        ...common,
        type: "choice",
        listId,
        visibility: null,
        multiple: field.multiple === true,
        // The viewer's own unpublished change to the list never makes its values less sensitive.
        tier: mostSensitive([
          listTier(lists, listId),
          listTier(published, listId),
        ]),
        listRetired: draftedList(lists, listId)?.retired === true,
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
