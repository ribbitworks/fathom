// SPDX-License-Identifier: Apache-2.0

// Lists of choices and their choices: reading them with their drafts in place, and drafting,
// discarding and resubmitting changes to them. Part of the data access layer.

import {
  type Database,
  drafts,
  fields,
  fieldValues,
  listItems,
  lists,
  people,
  plannedHires,
  type Reader,
  unpublishedDrafts,
} from "@fathom/db";
import type {
  Choice,
  ChoiceDraft,
  ChoiceRequest,
  DraftKind,
  List,
  ListDraft,
  ListRequest,
  OrderDraft,
} from "@fathom/shared";
import {
  featuresListGeneral,
  featureBuiltInLists,
  builtInListSchema,
  draftKey,
  type Kept,
  keptOf,
  type Meaning,
  meaningName,
  meaningSchema,
  meaningsOf,
  weighs,
  eitherOf,
  type Tier,
  tierSchema,
} from "@fathom/shared";
import { and, asc, count, eq, inArray, isNull, or, sql } from "drizzle-orm";
import { randomUUID } from "node:crypto";
import {
  type Actor,
  mostSensitive,
  requirePermission,
  seesSensitivity,
  storedTier,
} from "../access.ts";
import {
  BadRequestError,
  ConflictError,
  ForbiddenError,
  NotFoundError,
} from "../errors.ts";
import {
  type Change,
  changesBetween,
  recordChanges,
  type Saved,
  type Transaction,
} from "./changes.ts";
import {
  addDrafts,
  asDraft,
  clearedRejection,
  deleteDrafts,
  discardDrafts,
  type Draft,
  drafted,
  draftFields,
  draftMakers,
  draftsUse,
  everything,
  type Held,
  heldByOf,
  heldMessage,
  lockDrafts,
  type Maker,
  otherApprover,
  readDrafts,
  readHeld,
  type Recorded,
  setRejection,
  type Viewer,
  writeDraft,
} from "./drafts.ts";
import { builtInColumns } from "./built-in-lists.ts";
import {
  classifyDraft,
  recordMove,
  requireClassify,
  requireMove,
} from "./data-classes.ts";
import { type KeyNumbers, keyNumberOf, readKeyNumbers } from "./record-keys.ts";
import { isNamedByRecord } from "./records.ts";

type ListRow = typeof lists.$inferSelect;
type ChoiceRow = typeof listItems.$inferSelect;

const noList = "There is no such list";
const noChoice = "There is no such choice";
const duplicateList = "There is already a list with that name";
const duplicateChoice = "This list already has a choice with that name";
const listToBeRemoved =
  "This list's draft removes it; discard the draft to change it";
const choiceToBeRemoved =
  "This choice's draft removes it; discard the draft to change it";
const noDraft = "There is no such draft";

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
  held: {
    lists: Map<string, Held>;
    choices: Map<string, Held>;
    orders: Map<string, Held>;
  };
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
    held: {
      lists: await readHeld(reader, "list", viewer),
      choices: await readHeld(reader, "list-item", viewer),
      orders: await readHeld(reader, "choice-order", viewer),
    },
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

const choiceExists = (state: ListsState, id: string) =>
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

const lower = (value: unknown) => String(value).trim().toLowerCase();

// Whether drafts give another record a name, ignoring letter case.
const draftsName = (
  found: ReadonlyMap<string, Draft>,
  field: string,
  wanted: string,
  except: string | undefined,
  mayHave: (id: string) => boolean = () => true,
) =>
  [...found].some(
    ([id, draft]) =>
      id !== except &&
      mayHave(id) &&
      // The field is one of the record's own, named by the caller.
      // eslint-disable-next-line security/detect-object-injection
      draft.fields[field] !== undefined &&
      // eslint-disable-next-line security/detect-object-injection
      lower(draft.fields[field]) === wanted,
  );

const heldDrafts = (held: ReadonlyMap<string, Held>) =>
  new Map([...held].map(([id, { draft }]) => [id, draft]));

// Whether another list has the name, live or in a draft, published or not: a live list's name stays
// taken until a draft that changes it is approved, and an unpublished draft's until it is
// discarded.
export function listNameTaken(
  state: ListsState,
  name: string,
  except?: string,
): boolean {
  const wanted = lower(name);
  return (
    [...state.lists].some(
      ([id, record]) => id !== except && lower(record.name) === wanted,
    ) ||
    draftsName(state.listDrafts, "name", wanted, except) ||
    draftsName(heldDrafts(state.held.lists), "name", wanted, except)
  );
}

// Whether another choice in the list has the label, live or in a draft, as for lists' names.
export function choiceLabelTaken(
  state: ListsState,
  listId: string,
  label: string,
  except?: string,
): boolean {
  const wanted = lower(label);
  return (
    [...state.choices].some(
      ([id, { record }]) =>
        id !== except &&
        record.listId === listId &&
        lower(record.label) === wanted,
    ) ||
    draftsName(
      state.choiceDrafts,
      "label",
      wanted,
      except,
      (id) => listOfChoice(state, id) === listId,
    ) ||
    draftsName(
      heldDrafts(state.held.choices),
      "label",
      wanted,
      except,
      (id) => heldListOf(state, id) === listId,
    )
  );
}

// The list of a choice someone else holds: as they draft it, or as the viewer sees it.
const heldListOf = (state: ListsState, id: string) =>
  (state.held.choices.get(id)?.draft.fields.listId as string | undefined) ??
  listOfChoice(state, id);

// Whether any of a list's choices, or their order, has a draft, published or not.
export const choicesHaveDrafts = (state: ListsState, listId: string) =>
  state.orderDrafts.has(listId) ||
  state.held.orders.has(listId) ||
  [...state.choiceDrafts.keys()].some(
    (id) => listOfChoice(state, id) === listId,
  ) ||
  [...state.held.choices.keys()].some((id) => heldListOf(state, id) === listId);

// Refuses a change to a list while a column draws on it, live or in a draft, naming the columns
// others may see: live ones and published drafts. A column only in someone's unpublished draft
// counts too, so the list cannot go from under it, but is not named, since only its maker sees it.
// The editor's unpublished drafts of columns stand in for the published drafts of the same columns.
// A built-in list's built-in column always draws on it.
export async function refuseIfUsed(
  transaction: Reader,
  id: string,
  change: string,
  editor?: string,
): Promise<void> {
  const builtIn = await transaction
    .select({ key: lists.builtIn })
    .from(lists)
    .where(eq(lists.id, id));
  const live = [
    ...builtIn.flatMap(({ key }) => {
      const name = key === null ? undefined : builtInColumns.get(key);
      return name === undefined ? [] : [{ id: key, name }];
    }),
    ...(await transaction
      .select({ id: fields.id, name: fields.name })
      .from(fields)
      .where(eq(fields.listId, id))),
  ];
  const drafted = async (table: typeof drafts | typeof unpublishedDrafts) =>
    transaction
      .select({
        id: table.recordId,
        name: sql<string>`${table.fields}->>'name'`,
      })
      .from(table)
      .where(
        and(
          eq(table.recordType, "field"),
          sql`${table.fields}->>'listId' = ${id}`,
        ),
      );
  const replaced =
    editor === undefined
      ? new Set<string>()
      : new Set(
          (
            await transaction
              .select({ id: unpublishedDrafts.recordId })
              .from(unpublishedDrafts)
              .where(
                and(
                  eq(unpublishedDrafts.recordType, "field"),
                  eq(unpublishedDrafts.userId, editor),
                ),
              )
          ).map((row) => row.id),
        );
  const shown = [
    ...live,
    ...(await drafted(drafts)).filter((column) => !replaced.has(column.id)),
  ];
  const named = [...new Set(shown.map(({ name }) => name))].sort((a, b) =>
    a.toLowerCase().localeCompare(b.toLowerCase()),
  );
  const unnamed = (await drafted(unpublishedDrafts)).filter(
    (column) => !shown.some((other) => other.id === column.id),
  ).length;
  if (named.length === 0 && unnamed === 0) return;
  const users = [
    ...named,
    ...(unnamed === 0
      ? []
      : [unnamed === 1 ? "a column being drafted" : "columns being drafted"]),
  ];
  throw new ConflictError(
    `This list cannot be ${change} while ${named.length + unnamed === 1 ? "a column draws" : "columns draw"} on it: ${users.join(", ")}`,
  );
}

export const choiceInUse =
  "This choice cannot be removed while it is in use; retire it instead";

// Refuses removing a choice that people, planned hires, or the plan's records have, live or in a
// draft, as the editor sees the drafts: as a value in a column, a position, a state, or a status.
export async function refuseIfChosen(
  transaction: Reader,
  id: string,
  editor?: string,
): Promise<void> {
  const [held] = await transaction
    .select({ total: count() })
    .from(fieldValues)
    .where(eq(fieldValues.choiceId, id));
  const [positioned] = await transaction
    .select({ total: count() })
    .from(people)
    .where(or(eq(people.positionId, id), eq(people.stateId, id)));
  const [hired] = await transaction
    .select({ total: count() })
    .from(plannedHires)
    .where(or(eq(plannedHires.positionId, id), eq(plannedHires.stateId, id)));
  if (
    Number(held?.total) + Number(positioned?.total) + Number(hired?.total) >
      0 ||
    (await isNamedByRecord(transaction, "choice", [id], editor)) ||
    (await draftsUse(transaction, { choice: id }, editor))
  ) {
    throw new ConflictError(choiceInUse);
  }
}

// Whether a meaning is one only people have: Hired, or Left.
export const peoplesMeaning = (meaning: unknown) =>
  meaning === "hired" || meaning === "left";

// Refuses giving a hiring state a meaning only people have, Hired or Left, while planned hires not
// yet filled are in it, live or in a hire's draft, published or not. A filled hire's state no
// longer matters, since its person is shown instead.
export async function refusePeoplesMeaningWhileHeld(
  transaction: Reader,
  id: string,
  meaning: Meaning,
): Promise<void> {
  const [held] = await transaction
    .select({ total: count() })
    .from(plannedHires)
    .where(and(eq(plannedHires.stateId, id), isNull(plannedHires.filledBy)));
  let drafted = false;
  for (const table of [drafts, unpublishedDrafts]) {
    const [found] = await transaction
      .select({ total: count() })
      .from(table)
      .where(
        and(
          eq(table.recordType, "planned-hire"),
          sql`${table.fields}->>'stateId' = ${id}`,
        ),
      );
    drafted ||= Number(found?.total) > 0;
  }
  if (Number(held?.total) > 0 || drafted) {
    throw new ConflictError(
      `Planned hires are in this state, so it can't mean ${meaningName(meaning)}. Move them to another state first.`,
    );
  }
}

// A list's built-in key: one the server no longer knows is taken as none rather than trusted.
const builtInKey = (key: unknown) =>
  builtInListSchema
    .nullable()
    .catch(null)
    .parse(key ?? null);

// The meanings a list's choices are tied to: none unless it is a built-in list with meanings.
export const meaningsIn = (state: ListsState, listId: string) =>
  meaningsOf(builtInKey(state.builtIn.get(listId)));

// Refuses a choice's meaning that does not fit its list: a list with meanings needs one of its
// own for each choice, and any other list takes none.
function refuseMeaningMisfit(
  state: ListsState,
  listId: string,
  meaning: Meaning | null,
): void {
  const meanings = meaningsIn(state, listId);
  if (meanings.length === 0) {
    if (meaning !== null) {
      throw new BadRequestError("Only a built-in list's choices have meanings");
    }
  } else if (meaning === null || !meanings.includes(meaning)) {
    throw new BadRequestError(
      `Choose what the choice means: ${eitherOf(meanings.map(meaningName))}`,
    );
  }
}

// Refuses a choice's weight that does not fit its list: feature sizes need one for each choice, and
// any other list takes none.
function refuseWeightMisfit(
  state: ListsState,
  listId: string,
  weight: number | null,
): void {
  if (!weighs(builtInKey(state.builtIn.get(listId)))) {
    if (weight !== null) {
      throw new BadRequestError("Only feature sizes have weights");
    }
  } else if (weight === null) {
    throw new BadRequestError("Give the size a weight");
  }
}

// What a list must keep a choice offered for, as its built-in key says.
const keptIn = (state: ListsState, listId: string) =>
  keptOf(builtInKey(state.builtIn.get(listId)));

const offers = (choice: Recorded | undefined, kept: Kept) =>
  choice !== undefined &&
  choice.retired !== true &&
  (kept === "any" || choice.meaning === kept);

// Whether another of the list's choices than the one given is offered for what the list keeps, as
// the state's drafts make the list.
const othersOffer = (
  state: ListsState,
  listId: string,
  id: string | undefined,
  kept: Kept,
) =>
  draftedOrder(state, listId).some(
    (other) => other !== id && offers(draftedChoice(state, other), kept),
  );

// Whether a list offers a choice for everything it keeps, as the state's drafts make it.
export const keptOffered = (state: ListsState, listId: string) =>
  keptIn(state, listId).every((kept) =>
    othersOffer(state, listId, undefined, kept),
  );

// What a built-in list lacks, in words, once it has no choice for what it keeps.
const needs = (name: string, kept: Kept) =>
  kept === "any"
    ? `${name} needs a choice.`
    : `${name} needs a choice that means ${meaningName(kept)}.`;

// Refuses a draft of a choice that would leave a built-in list with no choice offered for something
// it keeps, as the editor sees the list's drafts: retiring, removing, or giving another meaning to
// the only choice offered for a meaning, or to the last choice offered in Positions.
export function refuseLastKept(
  state: ListsState,
  listId: string,
  id: string,
  after: Recorded | undefined,
): void {
  const before = draftedChoice(state, id);
  for (const kept of keptIn(state, listId)) {
    if (!offers(before, kept) || offers(after, kept)) continue;
    if (!othersOffer(state, listId, id, kept)) {
      throw new ConflictError(
        needs(String(draftedList(state, listId)?.name), kept),
      );
    }
  }
}

// Refuses approving drafts that would leave one of the built-in lists given with no live choice
// offered for something it keeps, as when one retires the only live choice for a meaning while
// the choice another draft adds for it waits.
export async function refuseKeptUnoffered(
  transaction: Reader,
  listIds: readonly (string | undefined)[],
): Promise<void> {
  const ids = listIds.filter((id) => id !== undefined);
  if (ids.length === 0) return;
  const rows = await transaction
    .select({
      id: lists.id,
      name: lists.name,
      builtIn: lists.builtIn,
      meaning: listItems.meaning,
      retired: listItems.retired,
    })
    .from(lists)
    .leftJoin(listItems, eq(listItems.listId, lists.id))
    .where(and(sql`${lists.builtIn} IS NOT NULL`, inArray(lists.id, ids)));
  const offered = new Map<
    string,
    { name: string; builtIn: string | null; live: Set<string | null> }
  >();
  for (const { id, name, builtIn, meaning, retired } of rows) {
    const list = offered.get(id) ?? { name, builtIn, live: new Set() };
    if (retired === false) list.live.add(meaning);
    offered.set(id, list);
  }
  for (const { name, builtIn, live } of offered.values()) {
    for (const kept of keptOf(builtInKey(builtIn))) {
      if (kept === "any" ? live.size === 0 : !live.has(kept)) {
        throw new ConflictError(
          `This would leave ${name} with no ${kept === "any" ? "choices" : `choice that means ${meaningName(kept)}`}.`,
        );
      }
    }
  }
}

// Refuses discarding the drafts adding the choices given while people's drafts, published or not,
// have any of them, as the editor sees the drafts.
async function refuseIfDraftsChoose(
  transaction: Reader,
  editor: string,
  choiceIds: readonly string[],
): Promise<void> {
  for (const id of choiceIds) {
    if (await draftsUse(transaction, { choice: id }, editor)) {
      throw new ConflictError(
        "This choice can't be discarded while other drafts depend on it. Discard those drafts, or change them so they no longer use it, then try again.",
      );
    }
  }
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
    .orderBy(asc(listItems.position), asc(listItems.id))
    .for("update");
}

// Puts a live choice just after another in the list, or at the top or end, renumbering the list.
// Only undoing changes saved before lists had drafts moves a live choice on its own.
export async function placeChoice(
  transaction: Transaction,
  listId: string,
  id: string,
  where: { after: string | null } | "end",
): Promise<void> {
  const rows = await lockChoices(transaction, listId);
  const others = rows.filter((row) => row.id !== id);
  let at = others.length;
  if (where !== "end") {
    at =
      where.after === null
        ? 0
        : others.findIndex((row) => row.id === where.after) + 1;
  }
  const ordered = [
    ...others.slice(0, at),
    ...rows.filter((row) => row.id === id),
    ...others.slice(at),
  ];
  await writePositions(
    transaction,
    rows,
    ordered.map(({ id: choiceId }) => choiceId),
  );
}

// Numbers a list's live choices in the order given, saving each position that changes.
export async function writePositions(
  transaction: Transaction,
  rows: readonly { id: string; position: number }[],
  order: readonly string[],
): Promise<void> {
  for (const [index, choiceId] of order.entries()) {
    if (rows.find(({ id }) => id === choiceId)?.position !== index + 1) {
      await transaction
        .update(listItems)
        .set({ position: index + 1 })
        .where(eq(listItems.id, choiceId));
    }
  }
}

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
const meaningOf = (choice: Recorded): Meaning | null =>
  meaningSchema
    .nullable()
    .catch(null)
    .parse(choice.meaning ?? null);

const weightOf = (choice: Recorded): number | null =>
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

async function readMakers(
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

export async function readListsWithin(
  transaction: Transaction,
  viewer: Actor,
): Promise<List[]> {
  const state = await readState(transaction, viewer.user.id);
  return listsOut(
    state,
    await readMakers(transaction, state, viewer),
    await featureListIds(transaction),
  );
}

// The list as the editor now sees it, with its drafts.
async function listNow(
  transaction: Transaction,
  editor: Actor,
  id: string,
): Promise<List> {
  const state = await readState(transaction, editor.user.id);
  // The list was just saved, so is there.
  return listsOut(
    state,
    await readMakers(transaction, state, editor),
    await featureListIds(transaction),
  ).find((other) => other.id === id) as List;
}

// Runs a change to the editor's drafts of lists, after every other change to drafts, with the lists
// as they see them.
async function drafting<Result>(
  database: Database,
  editor: string,
  change: (transaction: Transaction, state: ListsState) => Promise<Result>,
): Promise<Result> {
  return database.transaction(async (transaction) => {
    await lockDrafts(transaction);
    return change(transaction, await readState(transaction, editor));
  });
}

// Refuses a change to a record someone else holds.
function refuseHeldIn(held: ReadonlyMap<string, Held>, id: string): void {
  const holder = held.get(id)?.holder;
  if (holder !== undefined) throw new ConflictError(heldMessage(holder));
}

// A list as its draft makes it, refusing one that does not exist or is drafted to be removed.
function usableList(state: ListsState, id: string): Recorded {
  if (!listExists(state, id)) throw new NotFoundError(noList);
  const list = draftedList(state, id);
  if (list === undefined) throw new ConflictError(listToBeRemoved);
  return list;
}

// A list to change, refusing one that cannot be used, or that someone else holds.
function changeableList(actor: Actor, state: ListsState, id: string): Recorded {
  if (!listExists(state, id)) throw new NotFoundError(noList);
  refuseUnseenList(actor, state, id);
  refuseHeldIn(state.held.lists, id);
  return usableList(state, id);
}

// A choice in the list as its draft makes it, refusing one that does not exist, that it, or its
// list, is drafted to remove, or that someone else holds.
function changeableChoice(
  actor: Actor,
  state: ListsState,
  listId: string,
  id: string,
): Recorded {
  if (!listExists(state, listId)) throw new NotFoundError(noList);
  refuseUnseenList(actor, state, listId);
  usableList(state, listId);
  if (!choiceExists(state, id) || listOfChoice(state, id) !== listId) {
    throw new NotFoundError(noChoice);
  }
  refuseHeldIn(state.held.choices, id);
  const choice = draftedChoice(state, id);
  if (choice === undefined) throw new ConflictError(choiceToBeRemoved);
  return choice;
}

// Saves a list's or choice's draft as wanted and records the changes, clearing a rejection.
async function saveDraft(
  transaction: Transaction,
  maker: Actor,
  recordType: "list" | "list-item",
  id: string,
  live: Recorded | undefined,
  before: Recorded | undefined,
  after: Recorded | undefined,
  draft: Draft | undefined,
): Promise<string | null> {
  const toRecord = recordType === "list" ? listChanges : choiceChanges;
  let action: Change["action"] = "changed";
  if (before === undefined) action = "created";
  else if (after === undefined) action = "deleted";
  const made = asDraft(toRecord(id, action, before, after));
  if (made.length === 0) return null;
  await writeDraft(transaction, maker.user.id, recordType, id, live, after);
  return recordChanges(transaction, maker, [
    ...made,
    ...clearedRejection(id, () => "general", live, draft, recordType),
  ]);
}

// A list's visibility is the tier of the columns that draw on it, so, as for a column, it can be
// given only a tier the editor sees, and only someone who sees a list's values may change it.
function refuseUnseenVisibility(actor: Actor, tier: Tier, message: string) {
  if (!seesSensitivity(actor, tier)) throw new ForbiddenError(message);
}

const unseenVisibility = "Give the list a visibility this role can see";

export const unseenDetails = (name: string) =>
  `${name} holds people's details this role can't see, so someone who can see them must change it`;

// Refuses a change to a list, its choices or its order to a role that can't see the list's values,
// live or as drafted.
export function refuseUnseenList(
  actor: Actor,
  state: ListsState,
  listId: string,
): void {
  const list = draftedList(state, listId) ?? state.lists.get(listId);
  refuseUnseenVisibility(
    actor,
    listTier(state, listId),
    unseenDetails(String(list?.name)),
  );
}

export async function createList(
  database: Database,
  actor: Actor,
  request: ListRequest,
): Promise<Saved<List>> {
  refuseUnseenVisibility(actor, request.visibility, unseenVisibility);
  return drafting(database, actor.user.id, async (transaction, state) => {
    if (listNameTaken(state, request.name)) {
      throw new ConflictError(duplicateList);
    }
    classifyDraft(actor, {
      live: false,
      name: request.name,
      from: "general",
      to: request.visibility,
    });
    const id = randomUUID();
    const changeSetId = await saveDraft(
      transaction,
      actor,
      "list",
      id,
      undefined,
      undefined,
      { ...request, retired: false },
      undefined,
    );
    return { result: await listNow(transaction, actor, id), changeSetId };
  });
}

type ListChange = (
  transaction: Transaction,
  state: ListsState,
  list: Recorded,
) => Promise<Recorded>;

// Drafts a change to a list's settings, or to whether it is retired.
async function changeList(
  database: Database,
  maker: Actor,
  id: string,
  change: ListChange,
): Promise<Saved<List>> {
  return drafting(database, maker.user.id, async (transaction, state) => {
    const changeSetId = await draftListChange(
      transaction,
      maker,
      state,
      id,
      change,
    );
    return { result: await listNow(transaction, maker, id), changeSetId };
  });
}

async function draftListChange(
  transaction: Transaction,
  maker: Actor,
  state: ListsState,
  id: string,
  change: ListChange,
): Promise<string | null> {
  const list = changeableList(maker, state, id);
  const after = await change(transaction, state, list);
  return saveDraft(
    transaction,
    maker,
    "list",
    id,
    state.lists.get(id),
    list,
    after,
    state.listDrafts.get(id),
  );
}

// The lists a column on Features draws on, built in or added, live or in a draft, published or not.
// Anyone's unpublished drafts count, since raising such a list is refused whoever's draft it is, so
// telling readers says no more than the refusal would.
export async function featureListIds(reader: Reader): Promise<Set<string>> {
  const live = await reader
    .select({ listId: fields.listId })
    .from(fields)
    .where(eq(fields.tableName, "features"));
  const builtIn = await reader
    .select({ listId: lists.id })
    .from(lists)
    .where(inArray(lists.builtIn, [...featureBuiltInLists]));
  const drafted: { listId: string | null }[] = [];
  // One after the other, since a transaction runs one query at a time.
  for (const table of [drafts, unpublishedDrafts]) {
    drafted.push(
      ...(await reader
        .select({ listId: sql<string | null>`${table.fields}->>'listId'` })
        .from(table)
        .where(
          and(
            eq(table.recordType, "field"),
            sql`${table.fields}->>'tableName' = 'features'`,
          ),
        )),
    );
  }
  return new Set(
    [...live, ...builtIn, ...drafted]
      .map(({ listId }) => listId)
      .filter((listId): listId is string => listId !== null),
  );
}

// Whether a column on Features draws on the list.
export const featureColumnDrawsOn = async (
  reader: Reader,
  listId: string,
): Promise<boolean> => (await featureListIds(reader)).has(listId);

// Refuses a visibility other than General for a list a column on Features draws on.
export async function refuseSensitiveFeatureList(
  reader: Reader,
  listId: string,
  visibility: string,
): Promise<void> {
  if (
    visibility !== "general" &&
    (await featureColumnDrawsOn(reader, listId))
  ) {
    throw new ConflictError(featuresListGeneral);
  }
}

export async function updateList(
  database: Database,
  actor: Actor,
  id: string,
  request: ListRequest,
): Promise<Saved<List>> {
  return changeList(database, actor, id, listSettings(actor, id, request));
}

// The change to a list's settings a request asks for, refused where the actor can't make it.
const listSettings =
  (actor: Actor, id: string, request: ListRequest): ListChange =>
  async (transaction, state, list) => {
    await refuseSensitiveFeatureList(transaction, id, request.visibility);
    refuseUnseenVisibility(actor, request.visibility, unseenVisibility);
    if (listNameTaken(state, request.name, id)) {
      throw new ConflictError(duplicateList);
    }
    classifyDraft(actor, {
      live: state.lists.has(id),
      name: String(list.name),
      from: storedTier(list.visibility),
      to: request.visibility,
    });
    return { ...list, ...request };
  };

export const listMoved = (name: unknown) => `the ${String(name)} list`;

// Moves a list, and so the values chosen from it, to another class: at once for an approved list,
// and in its draft for one only drafted to be added.
export async function moveListClass(
  database: Database,
  actor: Actor,
  id: string,
  to: Tier,
): Promise<string | null> {
  requireClassify(actor);
  return database.transaction(async (transaction) => {
    await lockDrafts(transaction);
    const [row] = await transaction
      .select()
      .from(lists)
      .where(eq(lists.id, id))
      .for("update");
    const state = await readState(transaction, actor.user.id);
    if (row === undefined) {
      const list = changeableList(actor, state, id);
      requirePermission(actor, "configuration:edit");
      return draftListChange(
        transaction,
        actor,
        state,
        id,
        listSettings(actor, id, {
          name: String(list.name),
          description: String(list.description),
          visibility: to,
        }),
      );
    }
    changeableList(actor, state, id);
    const from = storedTier(row.visibility);
    requireMove(actor, from, to);
    if (from === to) return null;
    await refuseSensitiveFeatureList(transaction, id, to);
    await transaction
      .update(lists)
      .set({ visibility: to })
      .where(eq(lists.id, id));
    await recordMove(transaction, actor, listMoved(row.name), from, to);
    const before = listRecord(row);
    return recordChanges(
      transaction,
      actor,
      listChanges(id, "changed", before, { ...before, visibility: to }),
    );
  });
}

// Drafts retiring or restoring a list. A list cannot be retired while a column draws on it.
export async function setListRetired(
  database: Database,
  maker: Actor,
  id: string,
  retired: boolean,
): Promise<string | null> {
  return (
    await changeList(database, maker, id, async (transaction, _state, list) => {
      if (retired && list.retired !== true) {
        await refuseIfUsed(transaction, id, "retired", maker.user.id);
      }
      return { ...list, retired };
    })
  ).changeSetId;
}

// The changes that discard a list's draft, and, for a list only drafted to be added, the drafts of
// its choices and their order, with each one's rejection cleared.
function discardingList(state: ListsState, id: string): Change[] {
  const draft = state.listDrafts.get(id) as Draft;
  const live = state.lists.get(id);
  const list = draftedList(state, id);
  const made = [
    ...asDraft(listChanges(id, actionTo(list, live), list, live)),
    ...clearedRejection(id, () => "general", live, draft, "list"),
  ];
  if (live !== undefined) return made;
  for (const choiceId of addedChoices(state, id)) {
    made.push(...discardingChoice(state, choiceId));
  }
  if (state.orderDrafts.has(id)) made.push(...discardingOrder(state, id));
  return made;
}

// The action that takes a record from one version to another.
function actionTo(
  before: Recorded | undefined,
  after: Recorded | undefined,
): Change["action"] {
  if (before === undefined) return "created";
  return after === undefined ? "deleted" : "changed";
}

function discardingChoice(state: ListsState, id: string): Change[] {
  const draft = state.choiceDrafts.get(id) as Draft;
  const live = state.choices.get(id)?.record;
  const choice = draftedChoice(state, id);
  return [
    ...asDraft(choiceChanges(id, actionTo(choice, live), choice, live)),
    ...clearedRejection(id, () => "general", live, draft, "list-item"),
  ];
}

function discardingOrder(state: ListsState, listId: string): Change[] {
  const draft = state.orderDrafts.get(listId) as Draft;
  const natural = [...liveOrder(state, listId), ...addedChoices(state, listId)];
  return [
    ...asDraft(orderChanges(listId, draftedOrder(state, listId), natural)),
    ...clearedRejection(
      listId,
      () => "general",
      undefined,
      draft,
      "choice-order",
    ),
  ];
}

// Discards the editor's drafts the changes discard: each record's whose changes are recorded.
async function removeDiscarded(
  transaction: Transaction,
  editor: string,
  made: readonly Change[],
): Promise<void> {
  const seen = new Set<string>();
  for (const { recordType, recordId } of made) {
    const key = draftKey(recordType, recordId);
    if (seen.has(key)) continue;
    seen.add(key);
    await discardDrafts(transaction, editor, recordType as DraftKind, [
      recordId,
    ]);
  }
  await removeEmptyOrders(transaction, editor);
}

// Removes drafts of lists' orders that no longer change anything, as when the choice drafted to be
// added that one placed is discarded: the published drafts, or the editor's own unpublished ones,
// leaving published ones the editor sees for publishing to remove. They hold nothing to approve, so
// nothing is recorded.
export async function removeEmptyOrders(
  transaction: Transaction,
  editor?: string,
): Promise<void> {
  const state = await readState(transaction, editor);
  const empty = [...state.orderDrafts].filter(
    ([listId, draft]) =>
      (editor === undefined || draft.unpublished === true) &&
      orderToHold(state, listId, draftedOrder(state, listId)) === undefined,
  );
  const ids = empty.map(([listId]) => listId);
  if (editor === undefined)
    await deleteDrafts(transaction, "choice-order", ids);
  else await discardDrafts(transaction, editor, "choice-order", ids);
}

// Drafts deleting a list and its choices; deleting a list only drafted to be added discards its
// draft, and those of its choices. A list cannot be deleted while a column draws on it, or drafted
// to be deleted while its choices or their order have drafts.
export async function deleteList(
  database: Database,
  maker: Actor,
  id: string,
): Promise<string | null> {
  return drafting(database, maker.user.id, async (transaction, state) => {
    const list = changeableList(maker, state, id);
    const live = state.lists.get(id);
    if (live === undefined) {
      await refuseIfUsed(transaction, id, "discarded", maker.user.id);
      await refuseIfDraftsChoose(
        transaction,
        maker.user.id,
        addedChoices(state, id),
      );
      const made = discardingList(state, id);
      await removeDiscarded(transaction, maker.user.id, made);
      return recordChanges(transaction, maker, made, "discard");
    }
    await refuseIfUsed(transaction, id, "deleted", maker.user.id);
    if (choicesHaveDrafts(state, id)) {
      throw new ConflictError(
        "This list's choices have drafts; approve or discard them before deleting the list",
      );
    }
    return saveDraft(
      transaction,
      maker,
      "list",
      id,
      live,
      list,
      undefined,
      state.listDrafts.get(id),
    );
  });
}

// Drafts adding choices to the end of a list, in the order given, all saved together.
export async function addChoices(
  database: Database,
  maker: Actor,
  listId: string,
  requests: readonly ChoiceRequest[],
): Promise<Saved<Choice[]>> {
  return drafting(database, maker.user.id, async (transaction, state) => {
    changeableList(maker, state, listId);
    const labels = requests.map(({ label }) => lower(label));
    if (
      new Set(labels).size !== labels.length ||
      requests.some(({ label }) => choiceLabelTaken(state, listId, label))
    ) {
      throw new ConflictError(duplicateChoice);
    }
    for (const { meaning, weight } of requests) {
      refuseMeaningMisfit(state, listId, meaning ?? null);
      refuseWeightMisfit(state, listId, weight ?? null);
    }
    const added = requests.map((request) => ({
      id: randomUUID(),
      record: {
        listId,
        label: request.label,
        description: request.description,
        retired: false,
        meaning: request.meaning ?? null,
        weight: request.weight ?? null,
      },
    }));
    await addDrafts(
      transaction,
      maker.user.id,
      "list-item",
      added.map(({ id, record }) => ({ id, fields: record })),
    );
    const changeSetId = await recordChanges(
      transaction,
      maker,
      asDraft(
        added.flatMap(({ id, record }) =>
          choiceChanges(id, "created", undefined, record),
        ),
      ),
    );
    const list = await listNow(transaction, maker, listId);
    return {
      result: added.map(
        ({ id }) => list.choices.find((choice) => choice.id === id) as Choice,
      ),
      changeSetId,
    };
  });
}

// Drafts a change to a choice's details, or to whether it is retired. A restored choice keeps its
// place.
async function changeChoice(
  database: Database,
  maker: Actor,
  listId: string,
  id: string,
  change: (state: ListsState, choice: Recorded) => Recorded,
): Promise<Saved<Choice>> {
  return drafting(database, maker.user.id, async (transaction, state) => {
    const choice = changeableChoice(maker, state, listId, id);
    const after = change(state, choice);
    refuseLastKept(state, listId, id, after);
    if (peoplesMeaning(after.meaning) && !peoplesMeaning(choice.meaning)) {
      await refusePeoplesMeaningWhileHeld(transaction, id, after.meaning);
    }
    const changeSetId = await saveDraft(
      transaction,
      maker,
      "list-item",
      id,
      state.choices.get(id)?.record,
      choice,
      after,
      state.choiceDrafts.get(id),
    );
    const list = await listNow(transaction, maker, listId);
    // The choice was just saved, so is there.
    const result = list.choices.find((other) => other.id === id) as Choice;
    return { result, changeSetId };
  });
}

export async function updateChoice(
  database: Database,
  maker: Actor,
  listId: string,
  id: string,
  request: ChoiceRequest,
): Promise<Saved<Choice>> {
  return changeChoice(database, maker, listId, id, (state, choice) => {
    if (choiceLabelTaken(state, listId, request.label, id)) {
      throw new ConflictError(duplicateChoice);
    }
    const {
      meaning = meaningOf(choice),
      weight = weightOf(choice),
      ...details
    } = request;
    refuseMeaningMisfit(state, listId, meaning);
    refuseWeightMisfit(state, listId, weight);
    return { ...choice, ...details, meaning, weight };
  });
}

export async function setChoiceRetired(
  database: Database,
  maker: Actor,
  listId: string,
  id: string,
  retired: boolean,
): Promise<string | null> {
  return (
    await changeChoice(database, maker, listId, id, (_state, choice) => ({
      ...choice,
      retired,
    }))
  ).changeSetId;
}

// Drafts putting a choice just after another in its list, or at the top, as a new order of the
// list's choices.
export async function moveChoice(
  database: Database,
  maker: Actor,
  listId: string,
  id: string,
  after: string | null,
): Promise<string | null> {
  if (after === id) {
    throw new BadRequestError("A choice cannot follow itself");
  }
  return drafting(database, maker.user.id, async (transaction, state) => {
    changeableChoice(maker, state, listId, id);
    refuseHeldIn(state.held.orders, listId);
    const before = draftedOrder(state, listId);
    const others = before.filter((other) => other !== id);
    const at = after === null ? 0 : others.indexOf(after) + 1;
    if (after !== null && at === 0) {
      throw new BadRequestError("Choose a choice in the same list to follow");
    }
    const wanted = [...others.slice(0, at), id, ...others.slice(at)];
    const made = asDraft(orderChanges(listId, before, wanted));
    if (made.length === 0) return null;
    await writeOrderDraft(transaction, maker.user.id, state, listId, wanted);
    const draft = state.orderDrafts.get(listId);
    return recordChanges(transaction, maker, [
      ...made,
      ...clearedRejection(
        listId,
        () => "general",
        undefined,
        draft,
        "choice-order",
      ),
    ]);
  });
}

// Drafts removing a choice; removing one only drafted to be added discards its draft. A choice
// cannot be removed while people have it, live or in a draft.
export async function deleteChoice(
  database: Database,
  maker: Actor,
  listId: string,
  id: string,
): Promise<string | null> {
  return drafting(database, maker.user.id, async (transaction, state) => {
    const choice = changeableChoice(maker, state, listId, id);
    const live = state.choices.get(id)?.record;
    refuseLastKept(state, listId, id, undefined);
    if (live === undefined) {
      await refuseIfDraftsChoose(transaction, maker.user.id, [id]);
      const made = discardingChoice(state, id);
      await removeDiscarded(transaction, maker.user.id, made);
      return recordChanges(transaction, maker, made, "discard");
    }
    await refuseIfChosen(transaction, id, maker.user.id);
    return saveDraft(
      transaction,
      maker,
      "list-item",
      id,
      live,
      choice,
      undefined,
      state.choiceDrafts.get(id),
    );
  });
}

export type ListDraftKind = "list" | "choice" | "order";

// Finds a draft of a list, a choice, or a list's order, refusing one that does not exist.
function draftOf(
  state: ListsState,
  kind: ListDraftKind,
  listId: string,
  choiceId?: string,
): Draft {
  if (!listExists(state, listId)) throw new NotFoundError(noList);
  if (kind === "choice") {
    const id = choiceId as string;
    if (!choiceExists(state, id) || listOfChoice(state, id) !== listId) {
      throw new NotFoundError(noChoice);
    }
  }
  let draft: Draft | undefined;
  if (kind === "list") {
    refuseHeldIn(state.held.lists, listId);
    draft = state.listDrafts.get(listId);
  } else if (kind === "order") {
    refuseHeldIn(state.held.orders, listId);
    draft = state.orderDrafts.get(listId);
  } else {
    refuseHeldIn(state.held.choices, choiceId as string);
    draft = state.choiceDrafts.get(choiceId as string);
  }
  if (draft === undefined) throw new NotFoundError(noDraft);
  return draft;
}

// Discards a draft of a list, a choice, or a list's order, so the record is as it is live, or, for
// one only drafted to be added, gone, with the drafts of its choices.
export async function discardListDraft(
  database: Database,
  maker: Actor,
  kind: ListDraftKind,
  listId: string,
  choiceId?: string,
): Promise<string | null> {
  return drafting(database, maker.user.id, async (transaction, state) => {
    draftOf(state, kind, listId, choiceId);
    refuseUnseenList(maker, state, listId);
    if (kind === "list" && !state.lists.has(listId)) {
      await refuseIfUsed(transaction, listId, "discarded", maker.user.id);
      await refuseIfDraftsChoose(
        transaction,
        maker.user.id,
        addedChoices(state, listId),
      );
    }
    if (kind === "choice") {
      const id = choiceId as string;
      refuseLastKept(state, listId, id, state.choices.get(id)?.record);
      if (!state.choices.has(id)) {
        await refuseIfDraftsChoose(transaction, maker.user.id, [id]);
      }
    }
    let made: Change[];
    if (kind === "list") made = discardingList(state, listId);
    else if (kind === "order") made = discardingOrder(state, listId);
    else made = discardingChoice(state, choiceId as string);
    await removeDiscarded(transaction, maker.user.id, made);
    return recordChanges(transaction, maker, made, "discard");
  });
}

// Sends a rejected draft of a list, a choice, or a list's order for approval again, unchanged.
export async function resubmitListDraft(
  database: Database,
  maker: Actor,
  kind: ListDraftKind,
  listId: string,
  choiceId?: string,
): Promise<string | null> {
  return drafting(database, maker.user.id, async (transaction, state) => {
    const draft = draftOf(state, kind, listId, choiceId);
    refuseUnseenList(maker, state, listId);
    if (draft.state !== "rejected") {
      throw new ConflictError("Only a rejected draft can be resubmitted");
    }
    const recordType = draftTypeOf(kind);
    const id = kind === "choice" ? (choiceId as string) : listId;
    await setRejection(transaction, recordType, [id], {
      state: "waiting",
      reason: null,
    });
    return recordChanges(
      transaction,
      maker,
      clearedRejection(id, () => "general", undefined, draft, recordType),
      "resubmission",
    );
  });
}

export const draftTypeOf = (kind: ListDraftKind): DraftKind => {
  if (kind === "list") return "list";
  return kind === "order" ? "choice-order" : "list-item";
};
