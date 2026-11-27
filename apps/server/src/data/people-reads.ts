// SPDX-License-Identifier: Apache-2.0

// Reading people as recorded, live, and when each is current. Part of the data access layer.

import { inChunks, people, type Reader } from "@fathom/db";
import { monthOf, seesEmployment } from "@fathom/shared";
import { inArray } from "drizzle-orm";
import type { Actor } from "../access.ts";
import type { Recorded } from "./draft-records.ts";
import { readToday } from "./settings.ts";
import { readLines, readTeams, reportingOf } from "./reporting.ts";
import { type ColumnInfo, readValues } from "./values.ts";
import { recorded, type PersonRow } from "./person-fields.ts";

// The live people given, or everyone, as recorded, by person, with their current reporting lines as
// of today, locked for a change when asked.
export async function readLive(
  reader: Reader,
  columns: readonly ColumnInfo[],
  {
    ids,
    lock = false,
    asOf,
  }: {
    ids?: readonly string[] | undefined;
    lock?: boolean;
    asOf?: string | undefined;
  } = {},
): Promise<Map<string, Recorded>> {
  const today = asOf ?? (await readToday(reader));
  const rows: PersonRow[] = [];
  const read = async (chunk?: readonly string[]) => {
    const query = reader
      .select()
      .from(people)
      .where(chunk === undefined ? undefined : inArray(people.id, [...chunk]))
      .orderBy(people.id);
    rows.push(...(await (lock ? query.for("update") : query)));
  };
  if (ids === undefined) await read();
  else for (const chunk of inChunks([...ids])) await read(chunk);
  const values = await readValues(
    reader,
    rows.map(({ id }) => id),
    columns.map(({ id }) => id),
    "person",
  );
  const lines = await readLines(reader, ids);
  const teams = await readTeams(reader, ids);
  return new Map(
    rows.map((row) => [
      row.id,
      {
        ...recorded(row, values.get(row.id) ?? new Map()),
        ...reportingOf(lines.get(row.id), teams.get(row.id), today),
      },
    ]),
  );
}

// A person's start and end dates, as the database keeps them.
export type Employment = {
  startDate: string | null;
  endDate: string | null;
};

// The first and last months a person is employed in, as far as their dates set them.
export const employedMonths = ({
  startDate,
  endDate,
}: Employment): { first?: string; last?: string } => ({
  ...(startDate === null ? {} : { first: monthOf(startDate) }),
  ...(endDate === null ? {} : { last: monthOf(endDate) }),
});

// Whether a person has a start date still to come on a day.
export const notStarted = (person: Recorded, today: string): boolean =>
  typeof person.startDate === "string" && person.startDate > today;

// Whether a person is current on a day: from their start date until their end date passes, or with
// no start date at all.
export function currentOn(person: Recorded, today: string): boolean {
  const { startDate, endDate } = person;
  return (
    (typeof startDate !== "string" || startDate <= today) &&
    (typeof endDate !== "string" || endDate >= today)
  );
}

// The people a reader sees among those given, as People shows them: each who exists, unless hidden
// as below.
export async function shownPeople(
  transaction: Reader,
  reader: Actor,
  ids: readonly string[],
  today: string,
): Promise<Set<string>> {
  const shown = new Set<string>();
  const seesAll = seesEmployment(reader);
  for (const chunk of inChunks([...new Set(ids)])) {
    for (const person of await transaction
      .select({ id: people.id, startDate: people.startDate })
      .from(people)
      .where(inArray(people.id, chunk))) {
      if (seesAll || !notStarted(person, today)) shown.add(person.id);
    }
  }
  return shown;
}

// The people a reader doesn't see among those given, as People hides them: those not yet started,
// to a reader who doesn't see start and end dates. Those who have left stay named, retired.
export async function hiddenPeople(
  transaction: Reader,
  reader: Actor,
  ids: readonly string[],
  today: string,
): Promise<Set<string>> {
  const hidden = new Set<string>();
  if (seesEmployment(reader)) return hidden;
  for (const chunk of inChunks([...new Set(ids)])) {
    for (const person of await transaction
      .select({ id: people.id, startDate: people.startDate })
      .from(people)
      .where(inArray(people.id, chunk))) {
      if (notStarted(person, today)) hidden.add(person.id);
    }
  }
  return hidden;
}
