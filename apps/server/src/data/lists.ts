// SPDX-License-Identifier: Apache-2.0

// Lists of choices that people define, and their choices: reading them, and creating, editing,
// retiring, restoring, and deleting lists; adding choices one at a time or several at once, and
// editing, ordering, retiring, restoring, and removing them. Part of the data access layer, the
// only server code that queries the database; the caller checks the actor's permissions. Every
// change is recorded in the change history, in the same transaction, field by field. A move is
// recorded as the choice a choice now follows.

import {
  type Database,
  databaseCodes,
  fields,
  hasDatabaseCode,
  listItems,
  lists,
} from "@fathom/db";
import type { Choice, ChoiceRequest, List, ListRequest } from "@fathom/shared";
import { tierSchema } from "@fathom/shared";
import { and, asc, eq, sql } from "drizzle-orm";
import { randomUUID } from "node:crypto";
import { BadRequestError, ConflictError, NotFoundError } from "../errors.ts";
import {
  type Change,
  changesBetween,
  orderChange,
  recordChanges,
  refusingDuplicates,
  type Saved,
  type Transaction,
} from "./changes.ts";
import { type Place, place, previousOf } from "./order.ts";

type ListRow = typeof lists.$inferSelect;
type ChoiceRow = typeof listItems.$inferSelect;

const noList = "There is no such list";
const noChoice = "There is no such choice";
const duplicateList = "There is already a list with that name";
const duplicateChoice = "This list already has a choice with that name";

export const listFields = [
  "name",
  "description",
  "visibility",
  "retired",
] as const;
// A choice records its list too, so its history can be tied back to the list after either is deleted.
export const choiceFields = [
  "listId",
  "label",
  "description",
  "retired",
] as const;

// The details of lists and choices are General data, whatever the visibility of the values chosen
// from a list.
const listChanges = (
  id: string,
  action: Change["action"],
  before: ListRow | undefined,
  after: ListRow | undefined,
) => changesBetween("list", id, action, before, after, listFields);
const choiceChanges = (
  id: string,
  action: Change["action"],
  before: ChoiceRow | undefined,
  after: ChoiceRow | undefined,
) => changesBetween("list-item", id, action, before, after, choiceFields);

function toChoice(row: ChoiceRow): Choice {
  return {
    id: row.id,
    label: row.label,
    description: row.description,
    retired: row.retired,
  };
}

function toList(row: ListRow, choices: readonly ChoiceRow[]): List {
  return {
    id: row.id,
    name: row.name,
    description: row.description,
    // A tier the server no longer knows is treated as General rather than trusted.
    visibility: tierSchema.catch("general").parse(row.visibility),
    retired: row.retired,
    choices: choices.map(toChoice),
  };
}

const choiceOrder = [asc(listItems.position), asc(listItems.id)] as const;

// Every list by name, ignoring letter case, each with its choices in order.
export async function readLists(database: Database): Promise<List[]> {
  const listRows = await database
    .select()
    .from(lists)
    .orderBy(asc(sql`lower(${lists.name})`), asc(lists.id));
  const choiceRows = await database
    .select()
    .from(listItems)
    .orderBy(...choiceOrder);
  return listRows.map((row) =>
    toList(
      row,
      choiceRows.filter((choice) => choice.listId === row.id),
    ),
  );
}

// Locks a list for a change, refusing one that does not exist.
export async function lockList(
  transaction: Transaction,
  id: string,
): Promise<ListRow> {
  const [row] = await transaction
    .select()
    .from(lists)
    .where(eq(lists.id, id))
    .for("update");
  if (row === undefined) throw new NotFoundError(noList);
  return row;
}

// Every choice in a list, locked, in order.
export async function lockChoices(
  transaction: Transaction,
  listId: string,
): Promise<ChoiceRow[]> {
  return transaction
    .select()
    .from(listItems)
    .where(eq(listItems.listId, listId))
    .orderBy(...choiceOrder)
    .for("update");
}

// Locks a choice for a change, refusing one that is not in the list. Its list is locked first, as
// every change to a list's choices does, so two changes at once cannot deadlock.
async function lockChoice(
  transaction: Transaction,
  listId: string,
  id: string,
): Promise<ChoiceRow> {
  await lockList(transaction, listId);
  const [row] = await transaction
    .select()
    .from(listItems)
    .where(and(eq(listItems.listId, listId), eq(listItems.id, id)))
    .for("update");
  if (row === undefined) throw new NotFoundError(noChoice);
  return row;
}

// Refuses a change to a list while a column draws on it, naming the columns.
export async function refuseIfUsed(
  transaction: Transaction,
  id: string,
  change: string,
): Promise<void> {
  const users = await transaction
    .select({ name: fields.name })
    .from(fields)
    .where(eq(fields.listId, id))
    .orderBy(asc(sql`lower(${fields.name})`));
  if (users.length > 0) {
    const names = users.map(({ name }) => name).join(", ");
    throw new ConflictError(
      `This list cannot be ${change} while ${users.length === 1 ? "a column draws" : "columns draw"} on it: ${names}`,
    );
  }
}

// Runs a deletion, answering one refused because something still uses the record plainly.
export async function refusingInUse<Result>(
  message: string,
  change: () => Promise<Result>,
): Promise<Result> {
  try {
    return await change();
  } catch (error) {
    if (hasDatabaseCode(error, databaseCodes.restrictViolation)) {
      throw new ConflictError(message);
    }
    throw error;
  }
}

export async function createList(
  database: Database,
  madeBy: string,
  request: ListRequest,
): Promise<Saved<List>> {
  const id = randomUUID();
  const row = { id, ...request, retired: false };
  const changeSetId = await refusingDuplicates(duplicateList, () =>
    database.transaction(async (transaction) => {
      await transaction.insert(lists).values(row);
      return recordChanges(
        transaction,
        madeBy,
        listChanges(id, "created", undefined, row),
      );
    }),
  );
  return { result: toList(row, []), changeSetId };
}

export async function updateList(
  database: Database,
  madeBy: string,
  id: string,
  request: ListRequest,
): Promise<Saved<List>> {
  return refusingDuplicates(duplicateList, () =>
    database.transaction(async (transaction) => {
      const before = await lockList(transaction, id);
      const after = { ...before, ...request };
      const changeSetId = await recordChanges(
        transaction,
        madeBy,
        listChanges(id, "changed", before, after),
      );
      if (changeSetId !== null) {
        await transaction.update(lists).set(request).where(eq(lists.id, id));
      }
      return {
        result: toList(after, await lockChoices(transaction, id)),
        changeSetId,
      };
    }),
  );
}

// Retires or restores a list. A list cannot be retired while a column draws on it.
export async function setListRetired(
  database: Database,
  madeBy: string,
  id: string,
  retired: boolean,
): Promise<string | null> {
  return database.transaction(async (transaction) => {
    const before = await lockList(transaction, id);
    if (retired && !before.retired) {
      await refuseIfUsed(transaction, id, "retired");
    }
    const changeSetId = await recordChanges(
      transaction,
      madeBy,
      listChanges(id, "changed", before, { ...before, retired }),
    );
    if (changeSetId !== null) {
      await transaction.update(lists).set({ retired }).where(eq(lists.id, id));
    }
    return changeSetId;
  });
}

// Deletes a list and its choices, recording each, and each choice's place, in the change history. A
// list cannot be deleted while a column draws on it.
export async function deleteList(
  database: Database,
  madeBy: string,
  id: string,
): Promise<string | null> {
  return database.transaction(async (transaction) => {
    const before = await lockList(transaction, id);
    await refuseIfUsed(transaction, id, "deleted");
    const choices = await lockChoices(transaction, id);
    const changeSetId = await recordChanges(transaction, madeBy, [
      ...listChanges(id, "deleted", before, undefined),
      ...choices.flatMap((choice) => [
        ...choiceChanges(choice.id, "deleted", choice, undefined),
        ...orderChange(
          "list-item",
          choice.id,
          "deleted",
          previousOf(choices, choice.id),
          null,
        ),
      ]),
    ]);
    await transaction.delete(lists).where(eq(lists.id, id));
    return changeSetId;
  });
}

// Adds choices to the end of a list, in the order given, all saved together.
export async function addChoices(
  database: Database,
  madeBy: string,
  listId: string,
  requests: readonly ChoiceRequest[],
): Promise<Saved<Choice[]>> {
  return refusingDuplicates(duplicateChoice, () =>
    database.transaction(async (transaction) => {
      await lockList(transaction, listId);
      const existing = await lockChoices(transaction, listId);
      const end = Math.max(0, ...existing.map(({ position }) => position));
      const added = requests.map((request, index) => ({
        id: randomUUID(),
        listId,
        label: request.label,
        description: request.description,
        position: end + index + 1,
        retired: false,
      }));
      await transaction.insert(listItems).values(added);
      const changeSetId = await recordChanges(
        transaction,
        madeBy,
        added.flatMap((choice) =>
          choiceChanges(choice.id, "created", undefined, choice),
        ),
      );
      return { result: added.map(toChoice), changeSetId };
    }),
  );
}

export async function updateChoice(
  database: Database,
  madeBy: string,
  listId: string,
  id: string,
  request: ChoiceRequest,
): Promise<Saved<Choice>> {
  return refusingDuplicates(duplicateChoice, () =>
    database.transaction(async (transaction) => {
      const before = await lockChoice(transaction, listId, id);
      const after = { ...before, ...request };
      const changeSetId = await recordChanges(
        transaction,
        madeBy,
        choiceChanges(id, "changed", before, after),
      );
      if (changeSetId !== null) {
        await transaction
          .update(listItems)
          .set(request)
          .where(eq(listItems.id, id));
      }
      return { result: toChoice(after), changeSetId };
    }),
  );
}

// Puts a choice just after another in the list, or at the top or end, renumbering the list, and
// returns the change to record: the choice it followed before and the one it follows now.
export async function placeChoice(
  transaction: Transaction,
  listId: string,
  id: string,
  where: Place,
): Promise<Change[]> {
  const rows = await lockChoices(transaction, listId);
  if (!rows.some((row) => row.id === id)) throw new NotFoundError(noChoice);
  const moved = await place(rows, id, where, async (choiceId, position) => {
    await transaction
      .update(listItems)
      .set({ position })
      .where(eq(listItems.id, choiceId));
  });
  if (moved === null) {
    throw new BadRequestError("Choose a choice in the same list to follow");
  }
  return orderChange("list-item", id, "changed", moved.before, moved.after);
}

export async function moveChoice(
  database: Database,
  madeBy: string,
  listId: string,
  id: string,
  after: string | null,
): Promise<string | null> {
  if (after === id) {
    throw new BadRequestError("A choice cannot follow itself");
  }
  return database.transaction(async (transaction) => {
    await lockList(transaction, listId);
    return recordChanges(
      transaction,
      madeBy,
      await placeChoice(transaction, listId, id, { after }),
    );
  });
}

// Retires a choice, or restores it to the end of the list.
export async function setChoiceRetired(
  database: Database,
  madeBy: string,
  listId: string,
  id: string,
  retired: boolean,
): Promise<string | null> {
  return database.transaction(async (transaction) => {
    const before = await lockChoice(transaction, listId, id);
    if (before.retired === retired) return null;
    await transaction
      .update(listItems)
      .set({ retired })
      .where(eq(listItems.id, id));
    const moved = retired
      ? []
      : await placeChoice(transaction, listId, id, "end");
    return recordChanges(transaction, madeBy, [
      ...choiceChanges(id, "changed", before, { ...before, retired }),
      ...moved,
    ]);
  });
}

// Removes a choice, recording its place. A choice cannot be removed while people have it.
export async function deleteChoice(
  database: Database,
  madeBy: string,
  listId: string,
  id: string,
): Promise<string | null> {
  return refusingInUse(
    "This choice cannot be removed while it is in use; retire it instead",
    () =>
      database.transaction(async (transaction) => {
        const before = await lockChoice(transaction, listId, id);
        const previous = previousOf(await lockChoices(transaction, listId), id);
        await transaction.delete(listItems).where(eq(listItems.id, id));
        return recordChanges(transaction, madeBy, [
          ...choiceChanges(id, "deleted", before, undefined),
          ...orderChange("list-item", id, "deleted", previous, null),
        ]);
      }),
  );
}
