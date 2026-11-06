// SPDX-License-Identifier: Apache-2.0

// The lists Fathom builds in, which its built-in columns draw on: Positions, for people and planned
// hires, and the hiring states, a list with meanings. Part of the data access layer. A built-in
// column takes only a live choice of its list, since the database refers to the choice itself.

import { type Database, listItems, lists } from "@fathom/db";
import {
  type BuiltInList,
  type HiringMeaning,
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
]);

const columnName = (key: BuiltInList) =>
  String(builtInColumns.get(key)).toLowerCase();

// Refuses a choice that is not a live one of the built-in list, or that is retired, unless the
// record already has it, since a choice a record has stays valid when retired. In a list with
// meanings, a choice must have one, since Fathom acts on the meaning.
export async function checkBuiltInChoice(
  reader: Reader,
  key: BuiltInList,
  choiceId: string,
  had?: unknown,
): Promise<void> {
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
}

// The first choice offered for a meaning, in the list's order, refusing when none is.
export async function firstChoiceMeaning(
  reader: Reader,
  key: BuiltInList,
  meaning: HiringMeaning,
): Promise<string> {
  const [choice] = await reader
    .select({ id: listItems.id })
    .from(listItems)
    .innerJoin(lists, eq(lists.id, listItems.listId))
    .where(
      and(
        eq(lists.builtIn, key),
        eq(listItems.meaning, meaning),
        eq(listItems.retired, false),
      ),
    )
    .orderBy(asc(listItems.position), asc(listItems.id))
    .limit(1);
  if (choice === undefined) {
    throw new ConflictError(
      `No ${columnName(key)} means ${meaningName(meaning)}. Choose one for the hire.`,
    );
  }
  return choice.id;
}
