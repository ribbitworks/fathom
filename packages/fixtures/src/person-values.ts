// SPDX-License-Identifier: Apache-2.0

// The values people are given by their place rather than at random: their work patterns, and their
// Confidential compensation bands and performance ratings.

import { addDays } from "@fathom/shared";
import {
  choice,
  compensationBands,
  compensationColumn,
  levelColumn,
  levels,
  performanceRatings,
  ratingColumn,
} from "./lists.ts";
import type { FictionalPerson } from "./types.ts";

const bandOfLevel: Readonly<Record<string, string>> = {
  "Co-op": "Band 1",
  P1: "Band 1",
  P2: "Band 2",
  P3: "Band 3",
  P4: "Band 4",
  P5: "Band 5",
  M1: "Band 4",
  M2: "Band 4",
  M3: "Band 5",
  M4: "Band 5",
  M5: "Band 6",
};

// Ratings come a year in, and are picked by a person's place rather than at random, so adding them
// shifts nothing else the seed makes: two in ten exceed expectations and one in ten is developing.
const ratedAfterDays = 365;
const ratings = { every: 10, exceedsBelow: 2, developingAt: 9 } as const;

const ratingOf = (index: number, started: string, referenceDate: string) => {
  if (started > addDays(referenceDate, -ratedAfterDays)) return "Too early";
  const turn = index % ratings.every;
  if (turn < ratings.exceedsBelow) return "Exceeds";
  return turn === ratings.developingAt ? "Developing" : "Meets";
};

// Set once every level is final, since the last to leave is made a manager, and before planned
// hires copy the values of those who fill them.
export function setConfidential(
  people: readonly FictionalPerson[],
  referenceDate: string,
): void {
  const labelOf = new Map(levels.choices.map(({ id, label }) => [id, label]));
  people.forEach((person, index) => {
    const [level] = person.values[levelColumn.id] as string[];
    person.values[compensationColumn.id] = [
      choice(
        compensationBands,
        bandOfLevel[String(labelOf.get(String(level)))] as string,
      ),
    ];
    person.values[ratingColumn.id] = [
      choice(
        performanceRatings,
        ratingOf(index, String(person.startDate), referenceDate),
      ),
    ];
  });
}

// Most work full time; a few part time or compressed hours. Picked by a person's place rather than
// at random, so adding the column changes nothing else the seed makes.
const partTime = { every: 9, from: 4 };
const compressedHours = { every: 13, from: 7 };
export const workPatternOf = (index: number): string =>
  index % partTime.every === partTime.from
    ? "Part time"
    : index % compressedHours.every === compressedHours.from
      ? "Compressed hours"
      : "Full time";
