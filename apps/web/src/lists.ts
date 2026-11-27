// SPDX-License-Identifier: Apache-2.0

// Lists of choices through the server's API: reading them, with their drafts, every change to lists
// and choices, each a draft, and discarding drafts or sending rejected ones for approval again. Each
// change returns the change set it was saved in, which undoing it names, or null when nothing
// changed.

import {
  featuresListGeneral,
  changeSetIdSchema,
  type Choice,
  type ChoiceRequest,
  choiceSchema,
  type List,
  type ListRequest,
  listSchema,
  listsSchema,
  type Permission,
  savedSchema,
  type Tier,
  whyNoListChange,
} from "@fathom/shared";
import { queryOptions } from "@tanstack/react-query";
import { z } from "zod";
import { getJson, sendDeleteFor, sendJsonFor } from "./api.ts";
import { choicesOf, type DraftSelection } from "./drafts.ts";

// Why a list can't go to a class beyond the role's own reasons: a column on Features draws on it,
// and columns there stay General.
export const listRefusal =
  (list: Pick<List, "onFeatures">) =>
  (to: Tier): string | undefined =>
    list.onFeatures === true && to !== "general"
      ? featuresListGeneral
      : undefined;

// Which lists the Lists page shows: every one, those Fathom builds in, or those people added.
export const listKindSchema = z.enum(["all", "built-in", "custom"]);

export type ListKind = z.infer<typeof listKindSchema>;

const listKindNames: Record<ListKind, string> = {
  all: "All",
  "built-in": "Built in",
  custom: "Custom",
};

export function listKindName(kind: ListKind): string {
  // The kind is always one of the fixed kinds named above.
  // eslint-disable-next-line security/detect-object-injection
  return listKindNames[kind];
}

export const isKind = (list: List, kind: ListKind): boolean =>
  kind === "all" || (list.builtIn != null) === (kind === "built-in");

// The lists Fathom needs first, then an organization's own, each kept in the order given.
export const builtInFirst = (lists: readonly List[]): List[] => [
  ...lists.filter((list) => isKind(list, "built-in")),
  ...lists.filter((list) => isKind(list, "custom")),
];

export const listsQuery = queryOptions({
  queryKey: ["lists"],
  queryFn: async () => (await getJson("/api/lists", listsSchema)).lists,
});

const listPath = (id: string) => `/api/lists/${encodeURIComponent(id)}`;
const choicePath = (listId: string, id: string) =>
  `${listPath(listId)}/choices/${encodeURIComponent(id)}`;
const listResponse = z.object({
  list: listSchema,
  changeSetId: changeSetIdSchema,
});

export async function createList(
  request: ListRequest,
): Promise<{ list: List; changeSetId: string | null }> {
  return sendJsonFor("POST", "/api/lists", request, listResponse);
}

export async function updateList(
  id: string,
  request: ListRequest,
): Promise<{ list: List; changeSetId: string | null }> {
  return sendJsonFor("PUT", listPath(id), request, listResponse);
}

export async function setListRetired(
  id: string,
  retired: boolean,
): Promise<string | null> {
  return (
    await sendJsonFor(
      "PUT",
      `${listPath(id)}/retired`,
      { retired },
      savedSchema,
    )
  ).changeSetId;
}

export async function deleteList(id: string): Promise<string | null> {
  return (await sendDeleteFor(listPath(id), savedSchema)).changeSetId;
}

// Adds choices to the end of a list, all saved together.
export async function addChoices(
  listId: string,
  choices: ChoiceRequest[],
): Promise<{ choices: Choice[]; changeSetId: string | null }> {
  return sendJsonFor(
    "POST",
    `${listPath(listId)}/choices`,
    { choices },
    z.object({
      choices: z.array(choiceSchema),
      changeSetId: changeSetIdSchema,
    }),
  );
}

export async function updateChoice(
  listId: string,
  id: string,
  request: ChoiceRequest,
): Promise<string | null> {
  return (
    await sendJsonFor("PUT", choicePath(listId, id), request, savedSchema)
  ).changeSetId;
}

// Moves a choice to just after another, or to the top when there is none.
export async function moveChoice(
  listId: string,
  id: string,
  after: string | null,
): Promise<string | null> {
  return (
    await sendJsonFor(
      "PUT",
      `${choicePath(listId, id)}/position`,
      { after },
      savedSchema,
    )
  ).changeSetId;
}

// Retires a choice, or restores it to the end of the list.
export async function setChoiceRetired(
  listId: string,
  id: string,
  retired: boolean,
): Promise<string | null> {
  return (
    await sendJsonFor(
      "PUT",
      `${choicePath(listId, id)}/retired`,
      { retired },
      savedSchema,
    )
  ).changeSetId;
}

export async function deleteChoice(
  listId: string,
  id: string,
): Promise<string | null> {
  return (await sendDeleteFor(choicePath(listId, id), savedSchema)).changeSetId;
}

// Which draft of a list: its own, one of its choices', or that of its choices' order.
export type ListDraftTarget =
  | { kind: "list"; listId: string }
  | { kind: "choice"; listId: string; choiceId: string }
  | { kind: "order"; listId: string };

function draftPath(target: ListDraftTarget): string {
  if (target.kind === "choice") {
    return `${choicePath(target.listId, target.choiceId)}/draft`;
  }
  return target.kind === "order"
    ? `${listPath(target.listId)}/order/draft`
    : `${listPath(target.listId)}/draft`;
}

// Discards a draft, so the record is as it is live, or, if the draft added it, gone.
export async function discardListDraft(
  target: ListDraftTarget,
): Promise<string | null> {
  return (await sendDeleteFor(draftPath(target), savedSchema)).changeSetId;
}

// Sends a rejected draft for approval again, unchanged.
export async function resubmitListDraft(
  target: ListDraftTarget,
): Promise<string | null> {
  return (await sendDeleteFor(`${draftPath(target)}/rejection`, savedSchema))
    .changeSetId;
}

// Whether a choice can be given to people: it is not retired, as its draft makes it, nor drafted
// to be removed. A choice only drafted to be added is offered too, and a person given it is
// approved with it.
export const offered = (choice: Choice) =>
  !choice.retired && choice.draft?.action !== "deleted";

// What is wrong with a name, if anything.
export function nameProblem(
  name: string,
  maximum: number,
  taken: boolean,
  duplicate: string,
  needed = "Name needed",
  tooLong = "Name is too long",
): string | undefined {
  if (name.trim() === "") return needed;
  if (name.trim().length > maximum) return tooLong;
  return taken ? duplicate : undefined;
}

// The lists with the drafts chosen taken back: a list or choice only drafted to be added is left out,
// each list and choice has its live values back, and the choices their live order.
function withDraftsUndone(
  lists: readonly List[],
  undone: (draft: { state: string }) => boolean,
): List[] {
  return lists.flatMap((list): List[] => {
    const { draft, orderDraft, ...rest } = list;
    const listUndone = draft !== undefined && undone(draft);
    if (listUndone && draft.action === "created") return [];
    const choices = list.choices.flatMap((choice) => {
      const { draft: choiceDraft, ...live } = choice;
      if (choiceDraft === undefined || !undone(choiceDraft)) return [choice];
      if (choiceDraft.action === "created") return [];
      const was = choiceDraft.action === "changed" ? choiceDraft.live : {};
      const meaning = was.meaning ?? live.meaning;
      const weight = was.weight ?? live.weight;
      return [
        {
          ...live,
          label: was.label ?? live.label,
          description: was.description ?? live.description,
          retired: was.retired ?? live.retired,
          ...(meaning === undefined ? {} : { meaning }),
          ...(weight === undefined ? {} : { weight }),
        },
      ];
    });
    const orderUndone = orderDraft !== undefined && undone(orderDraft);
    const order = orderUndone ? orderDraft.live : [];
    const place = (id: string) => {
      const at = order.indexOf(id);
      return at === -1 ? order.length : at;
    };
    let own: Partial<List> = draft === undefined ? {} : { draft };
    if (listUndone) {
      own =
        draft.action === "changed"
          ? {
              name: draft.live.name ?? rest.name,
              description: draft.live.description ?? rest.description,
              visibility: draft.live.visibility ?? rest.visibility,
              retired: draft.live.retired ?? rest.retired,
            }
          : {};
    }
    return [
      {
        ...rest,
        ...own,
        ...(orderDraft === undefined || orderUndone ? {} : { orderDraft }),
        choices: [...choices].sort((a, b) => place(a.id) - place(b.id)),
      },
    ];
  });
}

// Every list as it is live, without drafts.
export const liveLists = (lists: readonly List[]): List[] =>
  withDraftsUndone(lists, () => true);

// Why another approver must decide some drafts: one of them is of a list, a choice or a list's
// order whose list the role may not change, as unchangeableLists gives, or undefined when none is.
export function unseenInDrafts(
  selection: Pick<DraftSelection, "lists" | "choices" | "orders">,
  lists: readonly List[],
  unchangeable: ReadonlyMap<string, string>,
): string | undefined {
  const listOfChoice = new Map(
    choicesOf(lists).map(({ list, choice }) => [choice.id, list.id] as const),
  );
  return [
    ...selection.lists,
    ...selection.choices.flatMap((id) => listOfChoice.get(id) ?? []),
    ...selection.orders,
  ]
    .map((id) => unchangeable.get(id))
    .find((why) => why !== undefined);
}

// Why the role may not change each list or decide its drafts, by list, for those it may not: the
// list's class, live or as drafted, decides, as the server does.
export function unchangeableLists(
  lists: readonly List[],
  permissions: readonly Permission[],
): Map<string, string> {
  const live = new Map(liveLists(lists).map((list) => [list.id, list]));
  return new Map(
    lists.flatMap((list) => {
      const why = [list, live.get(list.id)]
        .flatMap((version) =>
          version === undefined
            ? []
            : [whyNoListChange(permissions, version.visibility)],
        )
        .find((reason) => reason !== undefined);
      return why === undefined ? [] : [[list.id, why] as const];
    }),
  );
}

// The lists as their drafts will make them once approved, as Drafts applied shows them: rejected
// drafts are taken back, since they are not on their way to being approved, and the lists and
// choices drafted to be removed are left out.
export function draftedLists(lists: readonly List[]): List[] {
  return withDraftsUndone(lists, ({ state }) => state === "rejected")
    .filter((list) => list.draft?.action !== "deleted")
    .map((list) => ({
      ...list,
      choices: list.choices.filter(
        (choice) => choice.draft?.action !== "deleted",
      ),
    }));
}

interface Retirable {
  retired: boolean;
  draft?: { action: string; changed: string[] } | undefined;
}

// Whether a list or choice is retired as it is live, which a draft retiring or restoring it changes.
export const retiredLive = (record: Retirable): boolean =>
  record.draft?.action === "changed" && record.draft.changed.includes("retired")
    ? !record.retired
    : record.retired;

// A record's draft, such as a list's, a choice's or a release stream's, saying whether it retires or
// restores the record when it does either.
export function withRetiring<D extends { action: string; changed: string[] }>(
  record: Retirable & { draft: D },
): D & { retiring?: boolean } {
  return record.draft.action === "changed" &&
    record.draft.changed.includes("retired")
    ? { ...record.draft, retiring: record.retired }
    : record.draft;
}

// What a list's row says about it after its name: Built in, for a list Fathom builds in, and
// Retired, while it is retired as it is live; a draft retiring or restoring it says so in its own box.
export const listFacts = (
  list: Pick<List, "builtIn" | "retired" | "draft">,
): string[] => [
  ...(list.builtIn == null ? [] : ["Built in"]),
  ...(retiredLive(list) ? ["Retired"] : []),
];

export type ListAction = "retire" | "restore" | "remove";

// What may be done to a list from its row besides its drafts: retiring or restoring it and removing
// it, for a list Fathom doesn't build in and no draft removes. A list only drafted to be added isn't
// live yet, so has nothing to retire.
export function listActions(
  list: Pick<List, "builtIn" | "retired" | "draft">,
): ListAction[] {
  if (list.builtIn != null || list.draft?.action === "deleted") return [];
  return [
    ...(list.draft?.action === "created"
      ? []
      : [list.retired ? ("restore" as const) : ("retire" as const)]),
    "remove",
  ];
}

export const choice = (
  id: string,
  label: string,
  retired: boolean,
): Choice => ({
  id,
  label,
  description: "",
  retired,
});
