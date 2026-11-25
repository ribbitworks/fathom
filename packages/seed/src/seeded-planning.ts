// SPDX-License-Identifier: Apache-2.0

// The planning values seeded features and activities share, turned into their columns from the
// built-in lists as Fathom starts them. A development-only package, never in the runtime image.

import { listItems, lists, type Reader } from "@fathom/db";
import {
  addMonths,
  featureBuiltInLists,
  type Meaning,
  monthOf,
} from "@fathom/shared";
import { asc, eq, inArray } from "drizzle-orm";

// A status is named by its meaning, a priority, size and risk by their names in their built-in
// lists, a feature team by its place among the organization's, and the month it is needed by is
// counted from the seed day's.
export interface SeededPlanning {
  status: Meaning;
  priority?: "Critical" | "High" | "Medium" | "Low";
  size?: "XS" | "S" | "M" | "L" | "XL";
  risk?: "Low" | "Medium" | "High";
  neededIn?: number;
  team: number | null;
}

export interface PlanningColumns {
  statusId: string;
  priorityId: string | null;
  sizeId: string | null;
  riskId: string | null;
  neededBy: string | null;
  featureTeamId: string | null;
}

// Reads the built-in lists once, then gives each seeded record's planning columns. A new record
// starts in the first status in use for its meaning, as one added by hand does.
export async function planningColumns(
  reader: Reader,
  today: string,
  teamIds: readonly string[],
): Promise<(seeded: SeededPlanning) => PlanningColumns> {
  const choices = await reader
    .select({
      id: listItems.id,
      label: listItems.label,
      meaning: listItems.meaning,
      retired: listItems.retired,
      list: lists.builtIn,
    })
    .from(listItems)
    .innerJoin(lists, eq(lists.id, listItems.listId))
    .where(inArray(lists.builtIn, [...featureBuiltInLists, "feature-statuses"]))
    .orderBy(asc(listItems.position), asc(listItems.id));
  const byName = new Map(
    choices.map(({ id, label, list }) => [`${String(list)}:${label}`, id]),
  );
  const statusOf = new Map<string | null, string>();
  for (const { id, meaning, retired, list } of choices) {
    if (list === "feature-statuses" && !retired && !statusOf.has(meaning)) {
      statusOf.set(meaning, id);
    }
  }
  const choiceId = (list: string, name: string | undefined) =>
    name === undefined ? null : (byName.get(`${list}:${name}`) ?? null);
  return (seeded) => {
    const statusId = statusOf.get(seeded.status);
    if (statusId === undefined) {
      throw new Error(`No status means ${seeded.status}`);
    }
    return {
      statusId,
      priorityId: choiceId("feature-priorities", seeded.priority),
      sizeId: choiceId("feature-sizes", seeded.size),
      riskId: choiceId("feature-risks", seeded.risk),
      neededBy:
        seeded.neededIn === undefined
          ? null
          : monthOf(addMonths(today, seeded.neededIn)),
      featureTeamId:
        seeded.team === null ? null : (teamIds.at(seeded.team) ?? null),
    };
  };
}
