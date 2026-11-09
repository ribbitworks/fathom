// SPDX-License-Identifier: Apache-2.0

// The lists Fathom builds in, which its built-in columns draw on: Positions, for people and planned
// hires, the hiring states and the feature statuses, lists with meanings, and proposals' statuses.
// Part of the data access layer. A built-in column takes only a live choice of its list, since the
// database refers to the choice itself.

import { type Database, listItems, lists } from "@fathom/db";
import {
  type BuiltInList,
  type HiringMeaning,
  type Meaning,
  meaningName,
  meaningsOf,
} from "@fathom/shared";
import { and, asc, eq } from "drizzle-orm";
import { BadRequestError, ConflictError } from "../errors.ts";

type Reader = Pick<Database, "select">;

// The built-in column that draws on each built-in list.
export const builtInColumns: ReadonlyMap<string, string> = new Map([
  ["positions", "Position"],
  ["hiring-states", "State"],
  ["proposal-statuses", "Status"],
  ["feature-statuses", "Status"],
]);

const columnName = (key: BuiltInList) =>
  String(builtInColumns.get(key)).toLowerCase();

// Refuses a choice that is not a live one of the built-in list, or that is retired, unless the
// record already has it, since a choice a record has stays valid when retired. In a list with
// meanings, a choice must have one, since Fathom acts on the meaning, which it returns.
export async function checkBuiltInChoice(
  reader: Reader,
  key: BuiltInList,
  choiceId: string,
  had?: unknown,
): Promise<string | null> {
  const [choice] = await reader
    .select({
      retired: listItems.retired,
      meaning: listItems.meaning,
      builtIn: lists.builtIn,
    })
    .from(listItems)
    .innerJoin(lists, eq(lists.id, listItems.listId))
    .where(eq(listItems.id, choiceId));
  const name = columnName(key);
  if (
    choice?.builtIn !== key ||
    (meaningsOf(key).length > 0 && choice.meaning === null)
  ) {
    throw new BadRequestError(`Choose a ${name} from its list`);
  }
  if (choice.retired && choiceId !== had) {
    throw new BadRequestError(`Choose a ${name} that is offered`);
  }
  return choice.meaning;
}

// A built-in list's choices, in its order.
export const listChoices = (reader: Reader, key: BuiltInList) =>
  reader
    .select({
      id: listItems.id,
      name: listItems.label,
      retired: listItems.retired,
      meaning: listItems.meaning,
    })
    .from(listItems)
    .innerJoin(lists, eq(lists.id, listItems.listId))
    .where(eq(lists.builtIn, key))
    .orderBy(asc(listItems.position), asc(listItems.id));

// The first choice offered, for a meaning when one is given, in the list's order, if any is.
export async function firstOffered(
  reader: Reader,
  key: BuiltInList,
  meaning?: Meaning,
): Promise<string | undefined> {
  const [choice] = await reader
    .select({ id: listItems.id })
    .from(listItems)
    .innerJoin(lists, eq(lists.id, listItems.listId))
    .where(
      and(
        eq(lists.builtIn, key),
        meaning === undefined ? undefined : eq(listItems.meaning, meaning),
        eq(listItems.retired, false),
      ),
    )
    .orderBy(asc(listItems.position), asc(listItems.id))
    .limit(1);
  return choice?.id;
}

// The first choice offered for a meaning, in the list's order, refusing when none is.
export async function firstChoiceMeaning(
  reader: Reader,
  key: BuiltInList,
  meaning: HiringMeaning,
): Promise<string> {
  const id = await firstOffered(reader, key, meaning);
  if (id === undefined) {
    throw new ConflictError(
      `No ${columnName(key)} means ${meaningName(meaning)}. Choose one for the hire.`,
    );
  }
  return id;
}
