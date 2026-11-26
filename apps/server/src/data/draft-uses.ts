// SPDX-License-Identifier: Apache-2.0

// Finding the drafts of other kinds that a draft uses, so they are approved and rejected together.
// Part of the data access layer.

import { fieldOfValue } from "@fathom/db";
import {
  approvesKind,
  type DraftsRequest,
  type RecordRef,
  takenAlongRefusal,
} from "@fathom/shared";
import type { Actor } from "../access.ts";
import { ConflictError, ForbiddenError } from "../errors.ts";
import type { Transaction } from "./changes.ts";
import {
  type ColumnsState,
  draftedField,
  readColumnsState,
  usesAddedList,
} from "./column-state.ts";
import type { Draft } from "./draft-records.ts";
import { readPersonDrafts } from "./drafts.ts";
import { readHireDrafts } from "./hire-reads.ts";
import { addedChoices } from "./list-state.ts";
import { withUsedRecords } from "./record-decisions.ts";
import { type RecordsState, refKey, stateOf } from "./record-state.ts";
import { readRecordsState, recordKinds } from "./records.ts";

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

// The columns and choices only drafted to be added that a draft of a person, planned hire, or record
// of a kind with added columns, such as a feature, gives it.
export function usedByRecord(state: ColumnsState, draft: Draft) {
  const columns: string[] = [];
  const choices: string[] = [];
  for (const [field, value] of Object.entries(draft.fields)) {
    const columnId = fieldOfValue(field);
    if (columnId === null) continue;
    if (addedColumn(state, columnId)) columns.push(columnId);
    for (const choiceId of Array.isArray(value) ? value.map(String) : []) {
      if (addedChoice(state, choiceId)) choices.push(choiceId);
    }
  }
  return { columns, choices };
}

// The drafts of the plan's records whose kinds hold values in added columns, such as features, of
// the records kept, by record.
const valueHolders = (
  records: RecordsState,
  kept: (ref: RecordRef) => boolean,
): [string, Draft][] =>
  recordKinds
    .filter((kind) => kind.addedColumns !== undefined)
    .flatMap((kind) =>
      [...stateOf(records, kind.type).drafts].filter(([id]) =>
        kept({ type: kind.type, id }),
      ),
    );

// The drafts of records holding values in added columns approved with the records asked for.
async function recordsApproved(
  transaction: Transaction,
  asked: readonly RecordRef[],
): Promise<Draft[]> {
  if (asked.length === 0) return [];
  const records = await readRecordsState(transaction);
  const approved = new Set(withUsedRecords(records, asked).map(refKey));
  return valueHolders(records, (ref) => approved.has(refKey(ref))).map(
    ([, draft]) => draft,
  );
}

// The drafts asked for, with the columns and choices only drafted to be added that the people,
// planned hires, and the plan's records approved with them are given, and the lists only drafted to
// be added that those columns and the columns asked for draw on.
export async function withUsedAcross(
  transaction: Transaction,
  asked: DraftsRequest,
): Promise<DraftsRequest> {
  const state = await readColumnsState(transaction);
  const columns = new Set(asked.columns);
  const choices = new Set(asked.choices);
  for (const draft of [
    ...(await readPersonDrafts(transaction, asked.people)).values(),
    ...(await readHireDrafts(transaction, asked.plannedHires)).values(),
    ...(await recordsApproved(transaction, asked.records)),
  ]) {
    const used = usedByRecord(state, draft);
    for (const id of used.columns) columns.add(id);
    for (const id of used.choices) choices.add(id);
  }
  const lists = new Set(asked.lists);
  for (const { id, field } of draftedColumns(state)) {
    if (columns.has(id) && usesAddedList(state, field)) {
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

// Refuses approving drafts that take along a column or choice only drafted to be added whose area
// the approver's role does not approve, naming the first, since approving one approves both. A list
// is only taken along with a column drawing on it, which is named instead.
export async function refuseTakenAlongBeyondRole(
  transaction: Transaction,
  actor: Actor,
  chosen: DraftsRequest,
  asked: DraftsRequest,
): Promise<void> {
  const takenAlong = [
    { kind: "field", ids: without(asked.columns, chosen.columns) },
    { kind: "list-item", ids: without(asked.choices, chosen.choices) },
  ] as const;
  const refused = takenAlong.find(
    ({ kind, ids }) => ids.length > 0 && !approvesKind(actor.permissions, kind),
  );
  if (refused === undefined) return;
  const id = String(refused.ids.at(0));
  const { lists, fieldDrafts } = await readColumnsState(transaction);
  const named: Record<(typeof takenAlong)[number]["kind"], () => string> = {
    field: () => `the new column ${String(fieldDrafts.get(id)?.fields.name)}`,
    "list-item": () =>
      `the new choice ${String(lists.choiceDrafts.get(id)?.fields.label)}`,
  };
  throw new ForbiddenError(
    String(
      takenAlongRefusal(actor.permissions, refused.kind, named[refused.kind]()),
    ),
  );
}

const without = (ids: readonly string[], left: readonly string[]) =>
  ids.filter((id) => !left.includes(id));

const usedTogether =
  "Other drafts depend on these drafts. Reject them together, or wait until those drafts no longer depend on these.";

// Refuses rejecting drafts that others not rejected with them use: a list only drafted to be added
// that a column's draft draws on, and a column or choice only drafted to be added, or a list only
// drafted to be added with such choices or columns, that a draft of a person, planned hire, or
// feature gives it.
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
  if (columns.size === 0 && choices.size === 0) return;
  const rejected = new Set(asked.records.map(refKey));
  const others = [
    ...[...(await readPersonDrafts(transaction))].filter(
      ([id]) => !asked.people.includes(id),
    ),
    ...[...(await readHireDrafts(transaction))].filter(
      ([id]) => !asked.plannedHires.includes(id),
    ),
    ...valueHolders(
      await readRecordsState(transaction),
      (ref) => !rejected.has(refKey(ref)),
    ),
  ];
  for (const [, draft] of others) {
    const used = usedByRecord(state, draft);
    if (
      used.columns.some((one) => columns.has(one)) ||
      used.choices.some((one) => choices.has(one))
    ) {
      throw new ConflictError(usedTogether);
    }
  }
}
