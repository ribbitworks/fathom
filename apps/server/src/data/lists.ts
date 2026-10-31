// SPDX-License-Identifier: Apache-2.0

// The lists of choices for some of a person's details, such as their site or position: reading
// them, and adding, editing, and removing choices. Part of the data access layer, the only server
// code that queries the database; the caller checks the actor's permissions. Every change is
// recorded in the change history, in the same transaction, field by field. The lists are General
// data.

import { type Database, listItems } from "@fathom/db";
import {
  type ListItem,
  type ListItemRequest,
  type ListName,
  listNameSchema,
  type Lists,
  type Tier,
} from "@fathom/shared";
import { and, eq } from "drizzle-orm";
import { randomUUID } from "node:crypto";
import { ConflictError, NotFoundError } from "../errors.ts";
import {
  type Change,
  recordChanges,
  readStamps,
  type Stamps,
} from "./changes.ts";
import { hasDatabaseCode, uniqueViolation } from "./database-errors.ts";

// Natural order, so "P10" follows "P9", the same on every server.
const naturalOrder = new Intl.Collator("en", {
  numeric: true,
  sensitivity: "base",
});

const duplicate = "This list already has that choice";
const missing = "There is no such choice";

// The fields of a choice, each recorded separately in the change history.
const fields = ["label", "description"] as const;

type Fields = Pick<ListItem, (typeof fields)[number]>;

// The changes between two versions of a choice, one for each field that differs. A missing version
// is the choice before it was added or after it was removed.
function changesBetween(
  id: string,
  action: Change["action"],
  before: Fields | undefined,
  after: Fields | undefined,
): Change[] {
  return fields.flatMap((field) => {
    // The field is always one of the fixed fields above.
    /* eslint-disable security/detect-object-injection */
    const oldValue = before?.[field] ?? null;
    const newValue = after?.[field] ?? null;
    /* eslint-enable security/detect-object-injection */
    if (oldValue === newValue) return [];
    return [
      {
        recordType: "list-item",
        recordId: id,
        action,
        field,
        tier: "general",
        oldValue,
        newValue,
      } as const,
    ];
  });
}

// Every change to a list is recorded with it, so a choice without history was added another way.
function requireStamps(stamps: Map<string, Stamps>, id: string): Stamps {
  const found = stamps.get(id);
  if (found === undefined) throw new Error("A list item has no change history");
  return found;
}

export async function readLists(
  database: Database,
  tiers: readonly Tier[],
): Promise<Lists> {
  const rows = await database.select().from(listItems);
  const stamps = await readStamps(
    database,
    "list-item",
    rows.map(({ id }) => id),
    tiers,
  );
  return listNameSchema.options.map((name) => ({
    name,
    items: rows
      .filter(({ list }) => list === name)
      .map(({ id, label, description }) => ({
        id,
        label,
        description,
        ...requireStamps(stamps, id),
      }))
      .sort((first, second) => naturalOrder.compare(first.label, second.label)),
  }));
}

// A choice just saved, with who created and last changed it.
async function savedItem(
  database: Database,
  id: string,
  saved: Fields,
  tiers: readonly Tier[],
): Promise<ListItem> {
  const stamps = await readStamps(database, "list-item", [id], tiers);
  return { id, ...saved, ...requireStamps(stamps, id) };
}

// Runs a change, answering a duplicate choice plainly.
async function refusingDuplicates<Result>(
  change: () => Promise<Result>,
): Promise<Result> {
  try {
    return await change();
  } catch (error) {
    if (hasDatabaseCode(error, uniqueViolation)) {
      throw new ConflictError(duplicate);
    }
    throw error;
  }
}

export async function addListItem(
  database: Database,
  madeBy: string,
  list: ListName,
  item: ListItemRequest,
  tiers: readonly Tier[],
): Promise<ListItem> {
  const id = randomUUID();
  const added = { label: item.label, description: item.description };
  await refusingDuplicates(() =>
    database.transaction(async (transaction) => {
      await transaction.insert(listItems).values({ id, list, ...added });
      await recordChanges(
        transaction,
        madeBy,
        changesBetween(id, "created", undefined, added),
      );
    }),
  );
  return savedItem(database, id, added, tiers);
}

export async function updateListItem(
  database: Database,
  madeBy: string,
  list: ListName,
  id: string,
  item: ListItemRequest,
  tiers: readonly Tier[],
): Promise<ListItem> {
  const updated = { label: item.label, description: item.description };
  await refusingDuplicates(() =>
    database.transaction(async (transaction) => {
      const [before] = await transaction
        .select({ label: listItems.label, description: listItems.description })
        .from(listItems)
        .where(and(eq(listItems.list, list), eq(listItems.id, id)))
        .for("update");
      if (before === undefined) throw new NotFoundError(missing);
      const made = changesBetween(id, "changed", before, updated);
      if (made.length > 0) {
        await transaction
          .update(listItems)
          .set(updated)
          .where(eq(listItems.id, id));
      }
      await recordChanges(transaction, madeBy, made);
    }),
  );
  return savedItem(database, id, updated, tiers);
}

export async function deleteListItem(
  database: Database,
  madeBy: string,
  list: ListName,
  id: string,
): Promise<void> {
  await database.transaction(async (transaction) => {
    const [removed] = await transaction
      .delete(listItems)
      .where(and(eq(listItems.list, list), eq(listItems.id, id)))
      .returning({
        label: listItems.label,
        description: listItems.description,
      });
    if (removed === undefined) throw new NotFoundError(missing);
    await recordChanges(
      transaction,
      madeBy,
      changesBetween(id, "deleted", removed, undefined),
    );
  });
}
