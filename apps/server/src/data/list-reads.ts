// SPDX-License-Identifier: Apache-2.0

// Reading lists and their choices with their drafts in place, as each reader may see them. Part
// of the data access layer.

import { type Database, type Reader } from "@fathom/db";
import type {
  Choice,
  ChoiceDraft,
  List,
  ListDraft,
  OrderDraft,
} from "@fathom/shared";
import {
  listUses,
  type Meaning,
  meaningSchema,
  opensWith,
  pageNeeds,
  tierSchema,
} from "@fathom/shared";

import { type Actor } from "../access.ts";
import { type Transaction } from "./changes.ts";
import { type AddedUse, addedColumnsByList } from "./list-uses.ts";
import { heldByOf } from "./drafts.ts";
import {
  type Draft,
  drafted,
  draftFields,
  type Recorded,
} from "./draft-records.ts";
import {
  draftMakers,
  everything,
  type Maker,
  otherApprover,
} from "./draft-makers.ts";
import { keyNumberOf } from "./record-keys.ts";
import { builtInKey, generalOnlyListIds } from "./list-rules.ts";
import {
  choicesOrderUses,
  draftedOrder,
  listFields,
  type ListsState,
  liveOrder,
  orderToHold,
  readState,
} from "./list-state.ts";

function draftOut<Live extends Record<string, unknown>>(
  fieldNames: readonly string[],
  live: Recorded | undefined,
  draft: Draft,
  maker: Maker | undefined,
) {
  // In the record's own order, since drafts are stored without one.
  const touched = draftFields(live, draft);
  const changed = fieldNames.filter((field) => touched.includes(field));
  return {
    action: draft.action,
    changed,
    live: (live === undefined
      ? {}
      : Object.fromEntries(
          // The fields are the record's own, named just above.
          // eslint-disable-next-line security/detect-object-injection
          changed.map((field) => [field, live[field]]),
        )) as Partial<Live>,
    state: draft.state,
    ...(draft.state === "rejected" && draft.reason !== null
      ? { reason: draft.reason }
      : {}),
    ...unpublishedMark(draft),
    madeBy: maker?.madeBy ?? null,
    madeAs: maker?.madeAs ?? null,
    madeAt: maker?.madeAt.toISOString() ?? null,
    editors: maker?.editors ?? [],
    ...otherApprover(maker),
    changedBy: Object.fromEntries(
      changed.map((field) => [field, maker?.fieldEditors.get(field) ?? null]),
    ),
  };
}

// Marks a draft holding the viewer's own changes, not yet published.
export const unpublishedMark = (draft: Draft) =>
  draft.unpublished === true ? { unpublished: true } : {};

const shownChoiceFields = [
  "label",
  "description",
  "retired",
  "meaning",
  "weight",
] as const;

const withMeaning = (meaning: Meaning | null) =>
  meaning === null ? {} : { meaning };

// A choice's meaning as recorded: one the server no longer knows is shown as none rather than
// trusted.
export const meaningOf = (choice: Recorded): Meaning | null =>
  meaningSchema
    .nullable()
    .catch(null)
    .parse(choice.meaning ?? null);

export const weightOf = (choice: Recorded): number | null =>
  typeof choice.weight === "number" ? choice.weight : null;

const withWeight = (weight: number | null) =>
  weight === null ? {} : { weight };

interface Makers {
  list: Map<string, Maker>;
  choice: Map<string, Maker>;
  order: Map<string, Maker>;
}

function choiceOut(state: ListsState, makers: Makers, id: string): Choice {
  const live = state.choices.get(id)?.record;
  const draft = state.choiceDrafts.get(id);
  // A draft that removes a choice shows it as it is. A list's drafted order holds only choices that
  // are live or drafted to be added.
  const choice = (drafted(live, draft) ?? live) as Recorded;
  return {
    id,
    label: String(choice.label),
    description: String(choice.description),
    retired: choice.retired === true,
    ...withMeaning(meaningOf(choice)),
    ...withWeight(weightOf(choice)),
    ...(draft === undefined
      ? {}
      : {
          draft: draftOut<ChoiceDraft["live"]>(
            shownChoiceFields,
            live,
            draft,
            makers.choice.get(id),
          ),
        }),
    ...heldByOf(state.held.choices, id),
  };
}

const byName = new Intl.Collator("en", { sensitivity: "base" });

// The lists, by name, as their drafts make them, each with its choices in order and the drafts
// beside. A draft that removes a list or choice shows it as it is.
export function listsOut(
  state: ListsState,
  makers: Makers,
  onFeatures: ReadonlySet<string>,
  // The columns added to tables that use each list, by the list, for a reader who opens Lists.
  added: ReadonlyMap<string, readonly AddedUse[]> | undefined,
): List[] {
  const ids = [
    ...state.lists.keys(),
    ...[...state.listDrafts.keys()].filter((id) => !state.lists.has(id)),
  ];
  const shown = ids.flatMap((id): List[] => {
    const live = state.lists.get(id);
    const draft = state.listDrafts.get(id);
    const list = drafted(live, draft) ?? live;
    if (list === undefined) return [];
    const orderDraft = state.orderDrafts.get(id);
    // A draft of the order that no longer changes it is not shown.
    const order: OrderDraft | undefined =
      orderDraft === undefined ||
      orderToHold(state, id, draftedOrder(state, id)) === undefined
        ? undefined
        : {
            live: liveOrder(state, id),
            uses: choicesOrderUses(state, id),
            state: orderDraft.state,
            ...(orderDraft.state === "rejected" && orderDraft.reason !== null
              ? { reason: orderDraft.reason }
              : {}),
            ...unpublishedMark(orderDraft),
            madeBy: makers.order.get(id)?.madeBy ?? null,
            madeAs: makers.order.get(id)?.madeAs ?? null,
            madeAt: makers.order.get(id)?.madeAt.toISOString() ?? null,
            editors: makers.order.get(id)?.editors ?? [],
            ...otherApprover(makers.order.get(id)),
          };
    return [
      {
        id,
        keyNumber: keyNumberOf(state.keys, id),
        name: String(list.name),
        description: String(list.description),
        // A tier the server no longer knows is treated as General rather than trusted.
        visibility: tierSchema.catch("general").parse(list.visibility),
        retired: list.retired === true,
        builtIn: builtInKey(state.builtIn.get(id)),
        ...(onFeatures.has(id) ? { onFeatures: true } : {}),
        ...(added === undefined
          ? {}
          : {
              usedBy: listUses(
                builtInKey(state.builtIn.get(id)),
                added.get(id) ?? [],
              ),
            }),
        choices: draftedOrder(state, id).map((choiceId) =>
          choiceOut(state, makers, choiceId),
        ),
        ...(draft === undefined
          ? {}
          : {
              draft: draftOut<ListDraft["live"]>(
                listFields,
                live,
                draft,
                makers.list.get(id),
              ),
            }),
        ...heldByOf(state.held.lists, id),
        ...(order === undefined ? {} : { orderDraft: order }),
        ...(state.held.orders.has(id)
          ? { orderHeldBy: state.held.orders.get(id)?.holder }
          : {}),
      },
    ];
  });
  return shown.sort(
    (a, b) => byName.compare(a.name, b.name) || a.id.localeCompare(b.id),
  );
}

export async function readMakers(
  reader: Reader,
  state: ListsState,
  viewer: Actor,
): Promise<Makers> {
  return {
    list: await draftMakers(
      reader,
      "list",
      [...state.listDrafts.keys()],
      everything,
      viewer,
    ),
    choice: await draftMakers(
      reader,
      "list-item",
      [...state.choiceDrafts.keys()],
      everything,
      viewer,
    ),
    order: await draftMakers(
      reader,
      "choice-order",
      [...state.orderDrafts.keys()],
      everything,
      viewer,
    ),
  };
}

// Every list by name, ignoring letter case, as its draft makes it for the viewer, each with its
// choices in order.
export async function readLists(
  database: Database,
  viewer: Actor,
): Promise<List[]> {
  // Lists and their drafts are read as of one moment, so an approval saved meanwhile is seen whole
  // or not at all.
  return database.transaction(
    (transaction) => readListsWithin(transaction, viewer),
    { isolationLevel: "repeatable read", accessMode: "read only" },
  );
}

// The columns that use each list are configuration, so only a reader who opens Lists is sent them.
export const usesFor = async (reader: Reader, viewer: Actor) =>
  opensWith(pageNeeds.lists, viewer) ? addedColumnsByList(reader) : undefined;

export async function readListsWithin(
  transaction: Transaction,
  viewer: Actor,
): Promise<List[]> {
  const state = await readState(transaction, viewer.user.id);
  return listsOut(
    state,
    await readMakers(transaction, state, viewer),
    await generalOnlyListIds(transaction),
    await usesFor(transaction, viewer),
  );
}
