// SPDX-License-Identifier: Apache-2.0

// The rules lists and choices keep: names taken, choices and lists in use, meanings and the
// choices kept, choices' positions, and the lists a Features column draws on. Part of the data
// access layer.

import {
  drafts,
  fields,
  fieldValues,
  listItems,
  lists,
  people,
  plannedHires,
  privateChanges,
  type Reader,
} from "@fathom/db";
import {
  columnTablePolicies,
  columnTables,
  featuresListGeneral,
  featureBuiltInLists,
  builtInListUses,
  builtInListSchema,
  type Kept,
  keptOf,
  type Meaning,
  meaningName,
  meaningsOf,
  weighs,
  eitherOf,
} from "@fathom/shared";
import { and, asc, count, eq, inArray, isNull, or, sql } from "drizzle-orm";
import { BadRequestError, ConflictError } from "../errors.ts";
import { type Transaction } from "./changes.ts";
import { type Draft, drafted, type Recorded } from "./draft-records.ts";

import { draftsUse } from "./drafted-values.ts";
import { asSeenBy, readDrafts } from "./drafts.ts";
import { isNamedByRecord } from "./records.ts";
import {
  type ChoiceRow,
  draftedChoice,
  draftedList,
  draftedOrder,
  listOfChoice,
  type ListsState,
} from "./list-state.ts";

export const lower = (value: unknown) => String(value).trim().toLowerCase();

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

// Whether another list has the name, live or in a draft as the viewer sees the drafts: a live list's
// name stays taken until a draft that changes it is approved. Someone else's private change takes no
// name; publishing checks again.
export function listNameTaken(
  state: ListsState,
  name: string,
  except?: string,
): boolean {
  const wanted = lower(name);
  return (
    [...state.lists].some(
      ([id, record]) => id !== except && lower(record.name) === wanted,
    ) || draftsName(state.listDrafts, "name", wanted, except)
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
    )
  );
}

// Whether any of a list's choices, or their order, has a draft, as the viewer sees them.
export const choicesHaveDrafts = (state: ListsState, listId: string) =>
  state.orderDrafts.has(listId) ||
  [...state.choiceDrafts.keys()].some(
    (id) => listOfChoice(state, id) === listId,
  );

// The names of the columns that draw on a list, live or in a draft as the editor, when given, sees
// the drafts, their own private changes to columns included. A built-in list's built-in column
// always draws on it.
export async function columnsDrawingOn(
  transaction: Reader,
  id: string,
  editor: string | undefined,
): Promise<string[]> {
  const builtIn = await transaction
    .select({ key: lists.builtIn })
    .from(lists)
    .where(eq(lists.id, id));
  const builtInColumns = builtIn.flatMap(({ key }) => {
    const known = builtInKey(key);
    // The key is always one of the built-in lists.
    // eslint-disable-next-line security/detect-object-injection
    return known === null ? [] : [builtInListUses[known].column];
  });
  // Every added column as the editor sees it, since a draft may move one onto the list or off it,
  // or rename it.
  const live = new Map(
    (
      await transaction
        .select({ id: fields.id, name: fields.name, listId: fields.listId })
        .from(fields)
    ).map(({ id: column, name, listId }) => [column, { name, listId }]),
  );
  const seen = await readDrafts(transaction, "field", undefined, editor);
  const named = [...new Set([...live.keys(), ...seen.keys()])].flatMap(
    (column) => {
      const version = drafted(live.get(column), seen.get(column));
      return version?.listId === id ? [String(version.name)] : [];
    },
  );
  return [...new Set([...builtInColumns, ...named])].sort((a, b) =>
    a.toLowerCase().localeCompare(b.toLowerCase()),
  );
}

// Refuses a change to a list while a column draws on it, naming those others may see.
export async function refuseIfUsed(
  transaction: Reader,
  id: string,
  change: string,
  editor: string | undefined,
): Promise<void> {
  const named = await columnsDrawingOn(transaction, id, editor);
  if (named.length === 0) return;
  throw new ConflictError(
    `This list cannot be ${change} while ${named.length === 1 ? "a column draws" : "columns draw"} on it: ${named.join(", ")}`,
  );
}

export const choiceInUse =
  "This choice cannot be removed while it is in use; retire it instead";

// Refuses removing a choice that people, planned hires, or the plan's records have, live or in a
// draft, as the editor sees the drafts: as a value in a column, a position, a state, or a status.
export async function refuseIfChosen(
  transaction: Reader,
  id: string,
  editor: string | undefined,
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
// yet filled are in it, live or in a hire's draft as the editor, when given, sees the drafts. A
// filled hire's state no longer matters, since its person is shown instead.
export async function refusePeoplesMeaningWhileHeld(
  transaction: Reader,
  id: string,
  meaning: Meaning,
  editor: string | undefined,
): Promise<void> {
  const [held] = await transaction
    .select({ total: count() })
    .from(plannedHires)
    .where(and(eq(plannedHires.stateId, id), isNull(plannedHires.filledBy)));
  let drafted = false;
  for (const table of [drafts, privateChanges]) {
    const [found] = await transaction
      .select({ total: count() })
      .from(table)
      .where(
        and(
          eq(table.recordType, "planned-hire"),
          sql`${table.fields}->>'stateId' = ${id}`,
          asSeenBy(table, editor, "stateId"),
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
export const builtInKey = (key: unknown) =>
  builtInListSchema
    .nullable()
    .catch(null)
    .parse(key ?? null);

// The meanings a list's choices are tied to: none unless it is a built-in list with meanings.
export const meaningsIn = (state: ListsState, listId: string) =>
  meaningsOf(builtInKey(state.builtIn.get(listId)));

// Refuses a choice's meaning that does not fit its list: a list with meanings needs one of its
// own for each choice, and any other list takes none.
export function refuseMeaningMisfit(
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
export function refuseWeightMisfit(
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

// Refuses discarding the drafts adding the choices given while people's drafts, as the editor sees
// them, have any of them.
export async function refuseIfDraftsChoose(
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

// The tables whose columns may draw only on General lists, as each table's policy says.
const generalOnlyTables = columnTables.filter(
  // The table is always one of the fixed tables.
  // eslint-disable-next-line security/detect-object-injection
  (table) => columnTablePolicies[table].generalOnly,
);

// The lists a column on Features or Activities draws on, built in or added, live or in a draft as
// the reader, when given, sees the drafts.
export async function generalOnlyListIds(
  reader: Reader,
  editor: string | undefined,
): Promise<Set<string>> {
  const live = await reader
    .select({ listId: fields.listId })
    .from(fields)
    .where(inArray(fields.tableName, [...generalOnlyTables]));
  const builtIn = await reader
    .select({ listId: lists.id })
    .from(lists)
    .where(inArray(lists.builtIn, [...featureBuiltInLists]));
  const drafted: { listId: string | null }[] = [];
  // One after the other, since a transaction runs one query at a time.
  for (const table of editor === undefined
    ? [drafts]
    : [drafts, privateChanges]) {
    drafted.push(
      ...(await reader
        .select({ listId: sql<string | null>`${table.fields}->>'listId'` })
        .from(table)
        .where(
          and(
            eq(table.recordType, "field"),
            inArray(sql`${table.fields}->>'tableName'`, [...generalOnlyTables]),
            asSeenBy(table, editor, "listId"),
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

// Whether a column on Features or Activities draws on the list.
export const generalOnlyColumnDrawsOn = async (
  reader: Reader,
  listId: string,
  editor: string | undefined,
): Promise<boolean> => (await generalOnlyListIds(reader, editor)).has(listId);

// Refuses a visibility other than General for a list a column on Features or Activities draws on.
export async function refuseSensitivePlanningList(
  reader: Reader,
  listId: string,
  visibility: string,
  editor: string | undefined,
): Promise<void> {
  if (
    visibility !== "general" &&
    (await generalOnlyColumnDrawsOn(reader, listId, editor))
  ) {
    throw new ConflictError(featuresListGeneral);
  }
}
