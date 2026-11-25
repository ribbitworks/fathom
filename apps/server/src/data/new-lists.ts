// SPDX-License-Identifier: Apache-2.0

// A new General list drafted with the column that draws on it, and taken back or discarded with it.
// Part of the data access layer.

import { changes, type Reader } from "@fathom/db";
import { duplicateList, type NewList } from "@fathom/shared";
import { and, eq, inArray, or } from "drizzle-orm";
import { randomUUID } from "node:crypto";
import type { Actor } from "../access.ts";
import { ConflictError } from "../errors.ts";
import { type Change, type Transaction } from "./changes.ts";
import { asDraft } from "./draft-records.ts";
import { addDrafts, writeDraft } from "./drafts.ts";
import { columnsDrawingOn, listNameTaken } from "./list-rules.ts";
import {
  addedChoices,
  choiceChanges,
  listChanges,
  type ListsState,
} from "./list-state.ts";
import { discardingList, removeDiscarded } from "./lists.ts";

// Drafts a General list and its choices, in order, inside the change that draws a new column on
// it, returning the list and the changes to record with the column's, so one undo takes back all.
export async function draftNewList(
  transaction: Transaction,
  maker: Actor,
  state: ListsState,
  { name, choices }: NewList,
): Promise<{ id: string; changes: Change[] }> {
  if (listNameTaken(state, name)) throw new ConflictError(duplicateList);
  const id = randomUUID();
  const list = { name, description: "", visibility: "general", retired: false };
  await writeDraft(transaction, maker.user.id, "list", id, undefined, list);
  const added = choices.map(({ label, description }) => ({
    id: randomUUID(),
    fields: {
      listId: id,
      label,
      description,
      retired: false,
      meaning: null,
      weight: null,
    },
  }));
  await addDrafts(transaction, maker.user.id, "list-item", added);
  return {
    id,
    changes: asDraft([
      ...listChanges(id, "created", undefined, list),
      ...added.flatMap(({ id: choiceId, fields }) =>
        choiceChanges(choiceId, "created", undefined, fields),
      ),
    ]),
  };
}

// The change sets that changed any of the records given, drafts included.
async function changeSetsOf(
  reader: Reader,
  records: readonly { recordType: string; ids: readonly string[] }[],
): Promise<Set<string>> {
  const rows = await reader
    .select({ changeSetId: changes.changeSetId })
    .from(changes)
    .where(
      or(
        ...records
          .filter(({ ids }) => ids.length > 0)
          .map(({ recordType, ids }) =>
            and(
              eq(changes.recordType, recordType),
              inArray(changes.recordId, [...ids]),
            ),
          ),
      ),
    );
  return new Set(rows.map(({ changeSetId }) => changeSetId));
}

// Whether a list's or choice's draft was added in one change with a column and a list, as only New
// list in a Features column's dialog does, so it goes with the column.
export async function madeWithColumn(
  reader: Reader,
  recordType: "list" | "list-item",
  id: string,
): Promise<boolean> {
  const createdIn = reader
    .select({ changeSetId: changes.changeSetId })
    .from(changes)
    .where(
      and(
        eq(changes.recordType, recordType),
        eq(changes.recordId, id),
        eq(changes.action, "created"),
      ),
    );
  const kinds = await reader
    .select({ recordType: changes.recordType })
    .from(changes)
    .where(
      and(
        inArray(changes.changeSetId, createdIn),
        eq(changes.action, "created"),
        inArray(changes.recordType, ["field", "list"]),
      ),
    );
  const made = new Set(kinds.map(({ recordType: kind }) => kind));
  return made.has("field") && made.has("list");
}

// The choices drafted into a new list in the same change as the column drawing on it, which come
// with the list when the column is approved; a list drafted on Lists keeps its choices apart.
export async function choicesMadeWithColumn(
  reader: Reader,
  state: ListsState,
  listId: string,
  columnId: string,
): Promise<string[]> {
  const choiceIds = addedChoices(state, listId);
  if (choiceIds.length === 0) return [];
  const columnSets = await changeSetsOf(reader, [
    { recordType: "field", ids: [columnId] },
  ]);
  const rows = await reader
    .select({ recordId: changes.recordId, changeSetId: changes.changeSetId })
    .from(changes)
    .where(
      and(
        eq(changes.recordType, "list-item"),
        inArray(changes.recordId, choiceIds),
        eq(changes.action, "created"),
      ),
    );
  const made = new Set(
    rows
      .filter(({ changeSetId }) => columnSets.has(changeSetId))
      .map(({ recordId }) => recordId),
  );
  return choiceIds.filter((id) => made.has(id));
}

// Discards a list made with a column, and its choices, with the last column drawing on it, whether
// the one it was made with or another since, returning the changes to record with the column's. The
// list stays while another column draws on it, when anything changed it, its choices or their order
// since it was made, or when someone else is changing it or one of its choices.
export async function discardingNewList(
  transaction: Transaction,
  maker: Actor,
  state: ListsState,
  listId: string,
): Promise<Change[]> {
  if (
    state.lists.has(listId) ||
    state.listDrafts.get(listId)?.action !== "created"
  ) {
    return [];
  }
  const heldByOthers =
    state.held.lists.has(listId) ||
    state.held.orders.has(listId) ||
    [...state.held.choices.values()].some(
      ({ draft }) => draft.fields.listId === listId,
    );
  if (heldByOthers) return [];
  const listSets = await changeSetsOf(transaction, [
    { recordType: "list", ids: [listId] },
    { recordType: "choice-order", ids: [listId] },
    { recordType: "list-item", ids: addedChoices(state, listId) },
  ]);
  if (
    listSets.size !== 1 ||
    !(await madeWithColumn(transaction, "list", listId))
  ) {
    return [];
  }
  const { named, unnamed } = await columnsDrawingOn(
    transaction,
    listId,
    maker.user.id,
  );
  if (named.length > 0 || unnamed > 0) return [];
  const made = discardingList(state, listId);
  await removeDiscarded(transaction, maker.user.id, made);
  return made;
}
