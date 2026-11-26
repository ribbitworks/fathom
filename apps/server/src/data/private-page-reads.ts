// SPDX-License-Identifier: Apache-2.0

// A person's own pages: the one check every read of a page goes through, and reading the actor's
// pages and one page with its columns and rows. Part of the data access layer.

import {
  type Database,
  privatePages,
  privateRows,
  type Reader,
} from "@fathom/db";
import {
  type ListedPrivatePage,
  makesPrivatePages,
  mayReadPrivatePage,
  type PrivateColumn,
  type PrivatePage,
  seesClass,
} from "@fathom/shared";
import { asc, eq } from "drizzle-orm";
import { type Actor, requirePermission } from "../access.ts";
import { NotFoundError } from "../errors.ts";
import { readPageColumnOrder } from "./column-order.ts";
import { typeOf } from "./column-types.ts";
import type { Recorded } from "./draft-records.ts";
import { recordPersonalView } from "./history.ts";
import { shownValuesOf } from "./person-fields.ts";
import { readTimeZone } from "./settings.ts";
import {
  type ColumnInfo,
  readPageColumns,
  readValues,
  recordedValues,
} from "./values.ts";

type PageRow = typeof privatePages.$inferSelect;

// The same answer as for a page nobody made, so a refusal never says that a page exists.
const noPage = "There is no such page";

const mayRead = (actor: Actor, page: Pick<PageRow, "userId">) =>
  mayReadPrivatePage(
    { id: actor.user.id, permissions: actor.permissions },
    page,
  );

// The pages the actor may read, in their order under Mine. Only a role that may make pages has a
// Mine to list.
export async function listPages(
  database: Database,
  actor: Actor,
): Promise<ListedPrivatePage[]> {
  requirePermission(actor, makesPrivatePages);
  const pages = await database
    .select()
    .from(privatePages)
    .where(eq(privatePages.userId, actor.user.id))
    .orderBy(asc(privatePages.position), asc(privatePages.id));
  return pages
    .filter((page) => mayRead(actor, page))
    .map(({ id, name, position }) => ({ id, name, position }));
}

// The page, once the actor may read it; for anyone else it is not there.
async function checkedPage(
  reader: Reader,
  actor: Actor,
  id: string,
): Promise<PageRow> {
  const [page] = await reader
    .select()
    .from(privatePages)
    .where(eq(privatePages.id, id));
  if (page === undefined || !mayRead(actor, page)) {
    throw new NotFoundError(noPage);
  }
  return page;
}

// The columns of a page whose class the actor sees, in the page's order.
async function seenColumns(
  reader: Reader,
  actor: Actor,
  pageId: string,
): Promise<ColumnInfo[]> {
  const seen = (await readPageColumns(reader, pageId)).filter(({ tier }) =>
    seesClass(actor.permissions, tier),
  );
  const order = await readPageColumnOrder(
    reader,
    pageId,
    seen.map(({ id }) => id),
  );
  // The order names only the columns given.
  return order.map(
    (id) => seen.find((column) => column.id === id) as ColumnInfo,
  );
}

const columnOut = (column: ColumnInfo): PrivateColumn => {
  const { type, listId, visibility, multiple } = typeOf(column).settings({
    ...column,
  });
  return {
    id: column.id,
    name: column.name,
    type,
    listId,
    visibility,
    multiple,
  };
};

// Each row's values in the columns given, by row, as recorded.
async function rowValues(
  reader: Reader,
  rowIds: readonly string[],
  columns: readonly ColumnInfo[],
): Promise<Map<string, Recorded>> {
  const values = await readValues(
    reader,
    rowIds,
    columns.map(({ id }) => id),
    "private-row",
  );
  return new Map(
    rowIds.map((id) => [id, recordedValues(values.get(id) ?? new Map())]),
  );
}

async function pageRows(reader: Reader, pageId: string) {
  return reader
    .select()
    .from(privateRows)
    .where(eq(privateRows.pageId, pageId))
    .orderBy(asc(privateRows.position), asc(privateRows.id));
}

// A page as the actor sees it, and whether it showed them a column beyond General.
async function pageOut(
  reader: Reader,
  actor: Actor,
  page: PageRow,
): Promise<{ page: PrivatePage; sensitive: boolean }> {
  const columns = await seenColumns(reader, actor, page.id);
  const rows = await pageRows(reader, page.id);
  const values = await rowValues(
    reader,
    rows.map(({ id }) => id),
    columns,
  );
  return {
    page: {
      id: page.id,
      name: page.name,
      position: page.position,
      // Rows are named by a column the reader is shown, or by none.
      firstFieldId: columns.some(({ id }) => id === page.firstFieldId)
        ? page.firstFieldId
        : null,
      columns: columns.map(columnOut),
      rows: rows.map(({ id }) => ({
        id,
        // Every row read has its values, if none.
        ...shownValuesOf(values.get(id) as Recorded, () => true),
      })),
    },
    sensitive: columns.some(({ tier }) => tier !== "general"),
  };
}

// A page as the actor sees it, read as of one moment, so a change saved meanwhile is seen whole or
// not at all. Seeing a column beyond General is recorded in the access history, once a day.
export async function readPage(
  database: Database,
  actor: Actor,
  id: string,
): Promise<PrivatePage> {
  const { page, sensitive } = await database.transaction(
    async (transaction) =>
      pageOut(transaction, actor, await checkedPage(transaction, actor, id)),
    { isolationLevel: "repeatable read", accessMode: "read only" },
  );
  if (sensitive) {
    await recordPersonalView(
      database,
      actor.user.id,
      await readTimeZone(database),
    );
  }
  return page;
}
