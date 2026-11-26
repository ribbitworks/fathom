// SPDX-License-Identifier: Apache-2.0

// The state of lists and choices as a viewer sees them, live and drafted, the changes that record
// them, and each list's order of choices. Part of the data access layer.

import { listItems, lists, type Reader } from "@fathom/db";
import { type Tier } from "@fathom/shared";
import { asc } from "drizzle-orm";
import { mostSensitive, storedTier } from "../access.ts";
import { type Change, changesBetween, type Transaction } from "./changes.ts";
import { readDrafts, writeDraft } from "./drafts.ts";
import {
  type Draft,
  drafted,
  type Recorded,
  type Viewer,
} from "./draft-records.ts";
import { type KeyNumbers, readKeyNumbers } from "./record-keys.ts";

type ListRow = typeof lists.$inferSelect;
export type ChoiceRow = typeof listItems.$inferSelect;

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
  "meaning",
  "weight",
] as const;

// The details of lists and choices are General data, whatever the visibility of the values chosen
// from a list.
export const listChanges = (
  id: string,
  action: Change["action"],
  before: Recorded | undefined,
  after: Recorded | undefined,
) => changesBetween("list", id, action, before, after, listFields);
export const choiceChanges = (
  id: string,
  action: Change["action"],
  before: Recorded | undefined,
  after: Recorded | undefined,
) => changesBetween("list-item", id, action, before, after, choiceFields);

// The change that records a new order of a list's choices: the whole order before and after.
export function orderChanges(
  listId: string,
  before: readonly string[],
  after: readonly string[],
): Change[] {
  return before.join() === after.join()
    ? []
    : [
        {
          recordType: "choice-order",
          recordId: listId,
          action: "changed",
          field: "order",
          tier: "general",
          oldValue: [...before],
          newValue: [...after],
        },
      ];
}

export const listRecord = (row: ListRow): Recorded => ({
  name: row.name,
  description: row.description,
  visibility: row.visibility,
  retired: row.retired,
});

export const choiceRecord = (row: ChoiceRow): Recorded => ({
  listId: row.listId,
  label: row.label,
  description: row.description,
  retired: row.retired,
  meaning: row.meaning,
  weight: row.weight,
});

// Every list and choice, live and in drafts, and each list's draft of its order, read together, as
// the viewer sees them, with the records others hold.
export interface ListsState {
  lists: Map<string, Recorded>;
  // The key of each built-in list, by list.
  builtIn: Map<string, string>;
  choices: Map<string, { record: Recorded; position: number }>;
  listDrafts: Map<string, Draft>;
  choiceDrafts: Map<string, Draft>;
  orderDrafts: Map<string, Draft>;
  // The key numbers of the lists, live and drafted to be added.
  keys: KeyNumbers;
}

export async function readState(
  reader: Reader,
  viewer?: Viewer,
): Promise<ListsState> {
  const listRows = await reader.select().from(lists).orderBy(asc(lists.id));
  const choiceRows = await reader
    .select()
    .from(listItems)
    .orderBy(asc(listItems.position), asc(listItems.id));
  return {
    lists: new Map(listRows.map((row) => [row.id, listRecord(row)])),
    builtIn: new Map(
      listRows.flatMap(({ id, builtIn }) =>
        builtIn === null ? [] : [[id, builtIn]],
      ),
    ),
    choices: new Map(
      choiceRows.map((row) => [
        row.id,
        { record: choiceRecord(row), position: row.position },
      ]),
    ),
    listDrafts: await readDrafts(reader, "list", undefined, viewer),
    choiceDrafts: await readDrafts(reader, "list-item", undefined, viewer),
    orderDrafts: await readDrafts(reader, "choice-order", undefined, viewer),
    keys: await readKeyNumbers(reader, "list"),
  };
}

// The tier of a list's choices: its visibility, live or as drafted, whichever is more sensitive, so
// a draft never shows values to someone the live list would not. A list the state does not hold,
// live or drafted, is treated as the most sensitive.
export function listTier(state: ListsState, listId: string): Tier {
  const versions = [state.lists.get(listId), draftedList(state, listId)].filter(
    (version) => version !== undefined,
  );
  // A tier the server no longer knows is treated as the most sensitive rather than trusted.
  return mostSensitive(
    (versions.length === 0 ? [{}] : versions).map((version) =>
      storedTier(version.visibility),
    ),
  );
}

// A list or choice as its draft makes it: undefined once removed, or before it is added.
export const draftedList = (state: ListsState, id: string) =>
  drafted(state.lists.get(id), state.listDrafts.get(id));

export const draftedChoice = (state: ListsState, id: string) =>
  drafted(state.choices.get(id)?.record, state.choiceDrafts.get(id));

// Whether a list or choice is live, or drafted to be added.
export const listExists = (state: ListsState, id: string) =>
  state.lists.has(id) || state.listDrafts.get(id)?.action === "created";

export const choiceExists = (state: ListsState, id: string) =>
  state.choices.has(id) || state.choiceDrafts.get(id)?.action === "created";

// The list a choice belongs to, live or as drafted to be added.
export function listOfChoice(
  state: ListsState,
  id: string,
): string | undefined {
  return (state.choices.get(id)?.record.listId ??
    state.choiceDrafts.get(id)?.fields.listId) as string | undefined;
}

// A list's live choices, in order.
export const liveOrder = (state: ListsState, listId: string): string[] =>
  [...state.choices]
    .filter(([, { record }]) => record.listId === listId)
    .map(([id]) => id);

// A list's choices drafted to be added, in the order they were drafted.
export const addedChoices = (state: ListsState, listId: string): string[] =>
  [...state.choiceDrafts]
    .filter(
      ([id, draft]) =>
        draft.action === "created" &&
        !state.choices.has(id) &&
        draft.fields.listId === listId,
    )
    .map(([id]) => id);

// The order a list's draft of its order holds, of choices that still exist.
export function heldOrder(
  state: ListsState,
  listId: string,
): string[] | undefined {
  const draft = state.orderDrafts.get(listId);
  if (draft === undefined) return undefined;
  return (draft.fields.order as string[]).filter(
    (id) => choiceExists(state, id) && listOfChoice(state, id) === listId,
  );
}

// A list's choices in order, as its draft of the order, if any, makes it: those it places, then the
// live ones it does not, in their live order, then those drafted to be added, in the order drafted.
export function draftedOrder(state: ListsState, listId: string): string[] {
  const held = heldOrder(state, listId) ?? [];
  const rest = [
    ...liveOrder(state, listId),
    ...addedChoices(state, listId),
  ].filter((id) => !held.includes(id));
  return [...held, ...rest];
}

// The order to hold in a draft for a list's choices to be in the order wanted: choices drafted to
// be added that end the order in the order they were drafted are left for the reading to put
// there, so the draft does not use their drafts. Undefined when the order wanted is the live one.
export function orderToHold(
  state: ListsState,
  listId: string,
  wanted: readonly string[],
): string[] | undefined {
  const added = addedChoices(state, listId);
  // The longest ending of the order made only of choices drafted to be added, in the order drafted.
  let kept = wanted.length;
  let next = Infinity;
  for (const id of [...wanted].reverse()) {
    const at = added.indexOf(id);
    if (at === -1 || at > next) break;
    next = at;
    kept -= 1;
  }
  const held = wanted.slice(0, kept);
  return held.join() === liveOrder(state, listId).join() ? undefined : held;
}

// Keeps the editor's draft of a list's order as needed for the order wanted, or discards it.
export async function writeOrderDraft(
  transaction: Transaction,
  editor: string,
  state: ListsState,
  listId: string,
  wanted: readonly string[],
): Promise<void> {
  const held = orderToHold(state, listId, wanted);
  await writeDraft(
    transaction,
    editor,
    "choice-order",
    listId,
    { order: liveOrder(state, listId) },
    { order: held ?? liveOrder(state, listId) },
  );
}

// The choices drafted to be added that a list's draft of its order uses, by placing them.
export function choicesOrderUses(state: ListsState, listId: string): string[] {
  return (heldOrder(state, listId) ?? []).filter(
    (id) => !state.choices.has(id),
  );
}
