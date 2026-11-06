// SPDX-License-Identifier: Apache-2.0

// The org chart: today's reporting lines as approved. Part of the data access layer. Drafts never
// show, since the chart is of the lines in force. Everyone current today appears, with each
// manager they still report to, up the chain, even one whose end date has passed, as People names
// them. A reader who does not see Restricted details sees no further up than such a manager, and
// only their name and team, as People shows them; anything more would tell them who else has left.

import { type Database, listItems, people } from "@fathom/db";
import type { OrgChart, OrgChartPerson } from "@fathom/shared";
import { eq } from "drizzle-orm";
import { type Actor, seesTier } from "../access.ts";
import { inForceOn } from "./in-force.ts";
import { currentOn } from "./people.ts";
import { readLines, readTeamNames } from "./reporting.ts";
import { readToday } from "./settings.ts";

export interface OrgChartRead extends OrgChart {
  // Whether the chart told anyone that a manager has left, which the access history records.
  includedRestricted: boolean;
}

export async function readOrgChart(
  database: Database,
  actor: Actor,
  asOf?: string,
): Promise<OrgChartRead> {
  const today = asOf ?? (await readToday(database));
  const restricted = seesTier(actor, "restricted");
  // Read as of one moment, so an approval saved meanwhile is seen whole or not at all.
  const { rows, lines, teamNames } = await database.transaction(
    async (transaction) => ({
      rows: await transaction
        .select({
          id: people.id,
          preferredName: people.preferredName,
          employeeId: people.employeeId,
          position: listItems.label,
          startDate: people.startDate,
          endDate: people.endDate,
        })
        .from(people)
        .innerJoin(listItems, eq(listItems.id, people.positionId)),
      lines: await readLines(transaction),
      teamNames: await readTeamNames(transaction),
    }),
    { isolationLevel: "repeatable read", accessMode: "read only" },
  );
  const byId = new Map(rows.map((row) => [row.id, row]));
  const managerOf = (id: string) =>
    inForceOn(lines.get(id) ?? [], today)?.managerId ?? null;
  // Every person on the chart was read above.
  const rowOf = (id: string) => byId.get(id) as (typeof rows)[number];
  // Someone not current today, shown only as the manager of someone who is.
  const hidden = (id: string) => !restricted && !currentOn(rowOf(id), today);
  const shown = new Set<string>();
  for (const row of rows) {
    if (!currentOn(row, today)) continue;
    // Up the chain until someone already shown, so a loop, which the rules never let in, ends.
    let id: string | null = row.id;
    while (id !== null && !shown.has(id)) {
      shown.add(id);
      id = hidden(id) ? null : managerOf(id);
    }
  }
  const chart = [...shown].map((id): OrgChartPerson => {
    const row = rowOf(id);
    const gone = row.endDate !== null && row.endDate < today;
    return {
      id,
      preferredName: row.preferredName,
      employeeId: hidden(id) ? null : row.employeeId,
      position: hidden(id) ? null : row.position,
      teamName: teamNames.get(id) ?? null,
      managerId: hidden(id) ? null : managerOf(id),
      ...(restricted && gone ? { left: true } : {}),
    };
  });
  return {
    people: chart,
    includedRestricted: chart.some((person) => person.left === true),
  };
}
