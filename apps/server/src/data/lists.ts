// SPDX-License-Identifier: Apache-2.0

// Lists of choices that people define, and their choices: reading them, and creating, editing,
// retiring, restoring, and deleting lists; adding choices one at a time or several at once, and
// editing, ordering, retiring, restoring, and removing them. Part of the data access layer, the
// only server code that queries the database; the caller checks the actor's permissions. Every
// change is recorded in the change history, in the same transaction, field by field. A move is
// recorded as the choice a choice now follows.

import { type Database, listItems, lists } from "@fathom/db";
import type { Choice, ChoiceRequest, List, ListRequest } from "@fathom/shared";
import { tierSchema } from "@fathom/shared";
import { and, asc, eq, sql } from "drizzle-orm";
import { randomUUID } from "node:crypto";
import { BadRequestError, ConflictError, NotFoundError } from "../errors.ts";
import { type Change, type RecordType, recordChanges } from "./changes.ts";
import { hasDatabaseCode, uniqueViolation } from "./database-errors.ts";

type Transaction = Parameters<Parameters<Database["transaction"]>[0]>[0];
type ListRow = typeof lists.$inferSelect;
type ChoiceRow = typeof listItems.$inferSelect;

const noList = "There is no such list";
const noChoice = "There is no such choice";
const duplicateList = "There is already a list with that name";
const duplicateChoice = "This list already has a choice with that name";

const listFields = ["name", "description", "visibility", "retired"] as const;
// A choice records its list too, so its history can be tied back to the list after either is deleted.
const choiceFields = ["listId", "label", "description", "retired"] as const;

// The changes between two versions of a list or choice, one for each field that differs. A missing
// version is the record before it was created or after it was deleted. The details of lists and
// choices are General data, whatever the visibility of the values chosen from a list.
function changesBetween<Fields extends Record<string, unknown>>(
  recordType: RecordType,
  id: string,
  action: Change["action"],
  before: Fields | undefined,
  after: Fields | undefined,
  fields: readonly (keyof Fields & string)[],
): Change[] {
  return fields.flatMap((field) => {
    // The field is always one of the fixed fields its caller names.
    /* eslint-disable security/detect-object-injection */
    const oldValue = before?.[field] ?? null;
    const newValue = after?.[field] ?? null;
    /* eslint-enable security/detect-object-injection */
    return oldValue === newValue
      ? []
      : [
          {
            recordType,
            recordId: id,
            action,
            field,
            tier: "general" as const,
            oldValue,
            newValue,
          },
        ];
  });
}

// Runs a change, answering a name already taken plainly.
async function refusingDuplicates<Result>(
  message: string,
  change: () => Promise<Result>,
): Promise<Result> {
  try {
    return await change();
  } catch (error) {
    if (hasDatabaseCode(error, uniqueViolation)) {
      throw new ConflictError(message);
    }
    throw error;
  }
}

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
async function lockList(
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
async function lockChoices(
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

export async function createList(
  database: Database,
  madeBy: string,
  request: ListRequest,
): Promise<List> {
  const id = randomUUID();
  const row = { id, ...request, retired: false };
  await refusingDuplicates(duplicateList, () =>
    database.transaction(async (transaction) => {
      await transaction.insert(lists).values(row);
      await recordChanges(
        transaction,
        madeBy,
        changesBetween("list", id, "created", undefined, row, listFields),
      );
    }),
  );
  return toList(row, []);
}

export async function updateList(
  database: Database,
  madeBy: string,
  id: string,
  request: ListRequest,
): Promise<List> {
  return refusingDuplicates(duplicateList, () =>
    database.transaction(async (transaction) => {
      const before = await lockList(transaction, id);
      const after = { ...before, ...request };
      const made = changesBetween(
        "list",
        id,
        "changed",
        before,
        after,
        listFields,
      );
      await recordChanges(transaction, madeBy, made);
      if (made.length > 0) {
        await transaction.update(lists).set(request).where(eq(lists.id, id));
      }
      return toList(after, await lockChoices(transaction, id));
    }),
  );
}

export async function setListRetired(
  database: Database,
  madeBy: string,
  id: string,
  retired: boolean,
): Promise<void> {
  await database.transaction(async (transaction) => {
    const before = await lockList(transaction, id);
    const made = changesBetween(
      "list",
      id,
      "changed",
      before,
      { ...before, retired },
      listFields,
    );
    await recordChanges(transaction, madeBy, made);
    if (made.length > 0) {
      await transaction.update(lists).set({ retired }).where(eq(lists.id, id));
    }
  });
}

// Deletes a list and its choices, recording each in the change history.
export async function deleteList(
  database: Database,
  madeBy: string,
  id: string,
): Promise<void> {
  await database.transaction(async (transaction) => {
    const before = await lockList(transaction, id);
    const choices = await lockChoices(transaction, id);
    await recordChanges(transaction, madeBy, [
      ...changesBetween("list", id, "deleted", before, undefined, listFields),
      ...choices.flatMap((choice) =>
        changesBetween(
          "list-item",
          choice.id,
          "deleted",
          choice,
          undefined,
          choiceFields,
        ),
      ),
    ]);
    await transaction.delete(lists).where(eq(lists.id, id));
  });
}

// Adds choices to the end of a list, in the order given, all saved together.
export async function addChoices(
  database: Database,
  madeBy: string,
  listId: string,
  requests: readonly ChoiceRequest[],
): Promise<Choice[]> {
  const rows = await refusingDuplicates(duplicateChoice, () =>
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
      await recordChanges(
        transaction,
        madeBy,
        added.flatMap((choice) =>
          changesBetween(
            "list-item",
            choice.id,
            "created",
            undefined,
            choice,
            choiceFields,
          ),
        ),
      );
      return added;
    }),
  );
  return rows.map(toChoice);
}

export async function updateChoice(
  database: Database,
  madeBy: string,
  listId: string,
  id: string,
  request: ChoiceRequest,
): Promise<Choice> {
  const row = await refusingDuplicates(duplicateChoice, () =>
    database.transaction(async (transaction) => {
      const before = await lockChoice(transaction, listId, id);
      const after = { ...before, ...request };
      const made = changesBetween(
        "list-item",
        id,
        "changed",
        before,
        after,
        choiceFields,
      );
      await recordChanges(transaction, madeBy, made);
      if (made.length > 0) {
        await transaction
          .update(listItems)
          .set(request)
          .where(eq(listItems.id, id));
      }
      return after;
    }),
  );
  return toChoice(row);
}

// Puts a choice just after another in the list, or at the top or end, renumbering the list, and
// returns the change to record: the choice it followed before and the one it follows now.
async function place(
  transaction: Transaction,
  listId: string,
  id: string,
  where: { after: string | null } | "end",
): Promise<Change[]> {
  const rows = await lockChoices(transaction, listId);
  const moved = rows.find((row) => row.id === id);
  if (moved === undefined) throw new NotFoundError(noChoice);
  const before = rows.slice(0, rows.indexOf(moved)).at(-1)?.id ?? null;
  const others = rows.filter((row) => row !== moved);
  let insertAt = others.length;
  if (where !== "end") {
    insertAt =
      where.after === null
        ? 0
        : others.findIndex((row) => row.id === where.after) + 1;
    if (insertAt === 0 && where.after !== null) {
      throw new BadRequestError("Choose a choice in the same list to follow");
    }
  }
  const ordered = [
    ...others.slice(0, insertAt),
    moved,
    ...others.slice(insertAt),
  ];
  const after = ordered.slice(0, insertAt).at(-1)?.id ?? null;
  if (after === before) return [];
  for (const [index, row] of ordered.entries()) {
    if (row.position !== index + 1) {
      await transaction
        .update(listItems)
        .set({ position: index + 1 })
        .where(eq(listItems.id, row.id));
    }
  }
  return [
    {
      recordType: "list-item",
      recordId: id,
      action: "changed",
      field: "order",
      tier: "general",
      oldValue: before,
      newValue: after,
    },
  ];
}

export async function moveChoice(
  database: Database,
  madeBy: string,
  listId: string,
  id: string,
  after: string | null,
): Promise<void> {
  if (after === id) {
    throw new BadRequestError("A choice cannot follow itself");
  }
  await database.transaction(async (transaction) => {
    await lockList(transaction, listId);
    await recordChanges(
      transaction,
      madeBy,
      await place(transaction, listId, id, { after }),
    );
  });
}

// Retires a choice, or restores it to the end of the list unless it keeps its place.
export async function setChoiceRetired(
  database: Database,
  madeBy: string,
  listId: string,
  id: string,
  retired: boolean,
  keepPlace: boolean,
): Promise<void> {
  await database.transaction(async (transaction) => {
    const before = await lockChoice(transaction, listId, id);
    if (before.retired === retired) return;
    await transaction
      .update(listItems)
      .set({ retired })
      .where(eq(listItems.id, id));
    const moved =
      retired || keepPlace ? [] : await place(transaction, listId, id, "end");
    await recordChanges(transaction, madeBy, [
      ...changesBetween(
        "list-item",
        id,
        "changed",
        before,
        { ...before, retired },
        choiceFields,
      ),
      ...moved,
    ]);
  });
}

export async function deleteChoice(
  database: Database,
  madeBy: string,
  listId: string,
  id: string,
): Promise<void> {
  await database.transaction(async (transaction) => {
    const before = await lockChoice(transaction, listId, id);
    await transaction.delete(listItems).where(eq(listItems.id, id));
    await recordChanges(
      transaction,
      madeBy,
      changesBetween(
        "list-item",
        id,
        "deleted",
        before,
        undefined,
        choiceFields,
      ),
    );
  });
}
