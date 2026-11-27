// SPDX-License-Identifier: Apache-2.0

// A person's own pages under Mine: making one with its columns, and renaming, moving and removing
// one. Part of the data access layer.

import { type Database, privatePages } from "@fathom/db";
import {
  makesPrivatePages,
  type PrivatePage,
  type PrivatePageRequest,
} from "@fathom/shared";
import { asc, eq } from "drizzle-orm";
import { randomUUID } from "node:crypto";
import { type Actor, requirePermission } from "../access.ts";
import {
  type Change,
  recordChanges,
  refusingDuplicates,
  type Saved,
} from "./changes.ts";
import { deletePageColumnOrder, readPageColumnOrder } from "./column-order.ts";
import { addColumns, columnsAsked, columnsRemoved } from "./private-columns.ts";
import { makeRandomKey } from "./private-keys.ts";
import {
  changingPage,
  lockPageOrder,
  madePage,
  pageChanges,
  type PageVersion,
  recordingPageChange,
} from "./private-page-changes.ts";
import { answeredPage, pageRows } from "./private-page-reads.ts";
import { rowsRemoved } from "./private-rows.ts";
import { type FieldRow, readPageColumns } from "./values.ts";

const duplicatePage = "Another page has that name";

// Makes a page after the maker's others, with its columns, the first naming each row.
export async function makePage(
  database: Database,
  actor: Actor,
  request: PrivatePageRequest,
): Promise<Saved<PrivatePage>> {
  requirePermission(actor, makesPrivatePages);
  const { out, changeSetId } = await refusingDuplicates(duplicatePage, () =>
    database.transaction(async (transaction) => {
      await lockPageOrder(transaction, actor);
      const mine = await transaction
        .select({ position: privatePages.position })
        .from(privatePages)
        .where(eq(privatePages.userId, actor.user.id));
      const id = randomUUID();
      const columns = columnsAsked(id, request.columns);
      const page: PageVersion & { id: string } = {
        id,
        userId: actor.user.id,
        name: request.name,
        position: Math.max(-1, ...mine.map(({ position }) => position)) + 1,
        // The request always holds a column.
        firstFieldId: (columns[0] as FieldRow).id,
      };
      await transaction.insert(privatePages).values(page);
      await makeRandomKey(transaction, "page", id);
      const changeSetId = await recordChanges(transaction, actor, [
        ...pageChanges(id, "created", undefined, page),
        ...(await addColumns(transaction, actor, id, columns)),
      ]);
      return { out: await madePage(transaction, actor, id), changeSetId };
    }),
  );
  return { result: await answeredPage(database, actor, out), changeSetId };
}

export async function renamePage(
  database: Database,
  actor: Actor,
  id: string,
  name: string,
): Promise<Saved<PrivatePage>> {
  return refusingDuplicates(duplicatePage, () =>
    changingPage(database, actor, id, async (transaction, page) => {
      await transaction
        .update(privatePages)
        .set({ name })
        .where(eq(privatePages.id, id));
      return pageChanges(id, "changed", page, { ...page, name });
    }),
  );
}

// Moves a page to a place among its maker's pages, counting from the first, or last if beyond them.
export async function movePage(
  database: Database,
  actor: Actor,
  id: string,
  position: number,
): Promise<string | null> {
  return recordingPageChange(
    database,
    actor,
    id,
    async (transaction, page) => {
      const mine = await transaction
        .select()
        .from(privatePages)
        .where(eq(privatePages.userId, page.userId))
        .orderBy(asc(privatePages.position), asc(privatePages.id))
        .for("update");
      const others = mine.filter((other) => other.id !== id);
      const order = [
        ...others.slice(0, position),
        page,
        ...others.slice(position),
      ];
      const made: Change[] = [];
      for (const [index, moved] of order.entries()) {
        if (moved.position === index) continue;
        await transaction
          .update(privatePages)
          .set({ position: index })
          .where(eq(privatePages.id, moved.id));
        made.push(
          ...pageChanges(moved.id, "changed", moved, {
            ...moved,
            position: index,
          }),
        );
      }
      return made;
    },
    true,
  );
}

// Removes a page with its columns and rows.
export async function removePage(
  database: Database,
  actor: Actor,
  id: string,
): Promise<string | null> {
  return recordingPageChange(
    database,
    actor,
    id,
    async (transaction, page) => {
      const columns = await readPageColumns(transaction, id);
      // The page's order of its columns goes with it, kept in its history so undoing puts it back.
      const columnOrder: Change = {
        recordType: "private-page",
        recordId: id,
        action: "deleted",
        field: "columnOrder",
        tier: "general",
        oldValue: await readPageColumnOrder(
          transaction,
          id,
          columns.map((column) => column.id),
        ),
        newValue: null,
      };
      const made = [
        ...pageChanges(id, "deleted", page, undefined),
        columnOrder,
        ...columnsRemoved(columns),
        ...(await rowsRemoved(
          transaction,
          await pageRows(transaction, id),
          columns,
        )),
      ];
      await transaction.delete(privatePages).where(eq(privatePages.id, id));
      await deletePageColumnOrder(transaction, id);
      return made;
    },
    false,
  );
}
