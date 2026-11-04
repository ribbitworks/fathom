// SPDX-License-Identifier: Apache-2.0

// Drafts of one kind that use drafts of another, as the Decisions Log sets out: a column drawing on
// a list only drafted to be added uses the list's draft, and a person given a value in a column, or a
// choice, only drafted to be added uses that column's or choice's draft. Part of the data access
// layer; approvals.ts approves the drafts asked for with those they use, and rejects a draft that
// others use only together with them. Drafts that use others of their own kind are found in
// list-approvals.ts and column-approvals.ts, which also add the list a choice is added to.

import { fieldOfValue } from "@fathom/db";
import type { DraftsRequest } from "@fathom/shared";
import { ConflictError } from "../errors.ts";
import type { Transaction } from "./changes.ts";
import {
  type ColumnsState,
  draftedField,
  fieldsOrderUses,
  readColumnsState,
  usesAddedList,
} from "./column-drafts.ts";
import { type Draft, readPersonDrafts } from "./drafts.ts";
import { addedChoices } from "./lists.ts";

// The published drafts of columns, by column, as they make each column: removals left out.
function draftedColumns(state: ColumnsState) {
  return [...state.fieldDrafts.keys()].flatMap((id) => {
    const field = draftedField(state, id);
    return field === undefined ? [] : [{ id, field }];
  });
}

const addedColumn = (state: ColumnsState, id: string) =>
  !state.fields.has(id) && state.fieldDrafts.get(id)?.action === "created";

const addedChoice = (state: ColumnsState, id: string) =>
  !state.lists.choices.has(id) &&
  state.lists.choiceDrafts.get(id)?.action === "created";

// The columns and choices only drafted to be added that a person's draft gives them.
function usedByPerson(state: ColumnsState, draft: Draft) {
  const columns: string[] = [];
  const choices: string[] = [];
  for (const [field, value] of Object.entries(draft.fields)) {
    const columnId = fieldOfValue(field);
    if (columnId === null) continue;
    if (addedColumn(state, columnId)) columns.push(columnId);
    for (const choiceId of [value].flat().map(String)) {
      if (addedChoice(state, choiceId)) choices.push(choiceId);
    }
  }
  return { columns, choices };
}

// The drafts asked for, with the columns and choices only drafted to be added that the people asked
// for are given, and the lists only drafted to be added that those columns, the columns asked for,
// and those the draft of the column order places, draw on.
export async function withUsedAcross(
  transaction: Transaction,
  asked: DraftsRequest,
): Promise<DraftsRequest> {
  const state = await readColumnsState(transaction);
  const columns = new Set(asked.columns);
  const choices = new Set(asked.choices);
  for (const draft of (
    await readPersonDrafts(transaction, asked.people)
  ).values()) {
    const used = usedByPerson(state, draft);
    for (const id of used.columns) columns.add(id);
    for (const id of used.choices) choices.add(id);
  }
  const placed = asked.columnOrder ? fieldsOrderUses(state) : [];
  const lists = new Set(asked.lists);
  for (const { id, field } of draftedColumns(state)) {
    if (
      (columns.has(id) || placed.includes(id)) &&
      usesAddedList(state, field)
    ) {
      lists.add(String(field.listId));
    }
  }
  return {
    ...asked,
    lists: [...lists],
    choices: [...choices],
    columns: [...columns],
  };
}

const usedTogether =
  "Other drafts depend on these drafts. Reject them together, or wait until those drafts no longer depend on these.";

// Refuses rejecting drafts that others not rejected with them use: a list only drafted to be added
// that a column's draft draws on, and a column or choice only drafted to be added, or a list only
// drafted to be added with such choices or columns, that a person's draft gives someone.
export async function refuseUsedAcross(
  transaction: Transaction,
  asked: DraftsRequest,
): Promise<void> {
  const state = await readColumnsState(transaction);
  const onLists = draftedColumns(state).filter(
    ({ field }) =>
      asked.lists.includes(String(field.listId)) && usesAddedList(state, field),
  );
  if (onLists.some(({ id }) => !asked.columns.includes(id))) {
    throw new ConflictError(usedTogether);
  }
  const columns = new Set([...asked.columns, ...onLists.map(({ id }) => id)]);
  const choices = new Set([
    ...asked.choices,
    ...asked.lists.flatMap((id) => addedChoices(state.lists, id)),
  ]);
  for (const [id, draft] of await readPersonDrafts(transaction)) {
    const used = usedByPerson(state, draft);
    if (
      !asked.people.includes(id) &&
      (used.columns.some((one) => columns.has(one)) ||
        used.choices.some((one) => choices.has(one)))
    ) {
      throw new ConflictError(usedTogether);
    }
  }
}
