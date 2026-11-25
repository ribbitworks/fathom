// SPDX-License-Identifier: Apache-2.0

// A person's timeline: each day something about them changed, or will, as the reader's role may see
// it. Part of the data access layer.

import {
  dayIn,
  seesField,
  seesHiringPlan,
  type Timeline,
  type TimelineChange,
  type TimelineDay,
  type TimelineField,
  type TimelineRecord,
  timelineFieldSchema,
} from "@fathom/shared";
import {
  changes,
  changeSets,
  type Database,
  featureTeamLeads,
  featureTeamMemberships,
  featureTeams,
  people,
  plannedHires,
} from "@fathom/db";
import { and, eq, inArray, sql } from "drizzle-orm";
import type { Actor } from "../access.ts";
import { NotFoundError } from "../errors.ts";
import type { Transaction } from "./changes.ts";
import { inForceOn } from "./in-force.ts";
import { readKeyNumbers } from "./record-keys.ts";
import { readLines } from "./reporting.ts";
import { readTimeZone } from "./settings.ts";

// What a person's timeline is made from, each part earliest first.
export interface TimelineSources {
  start: string | null;
  end: string | null;
  fills: readonly { day: string; hire: TimelineRecord }[];
  // Each reporting line, with how many others were given the same manager from the same day.
  lines: readonly {
    fromDate: string;
    manager: TimelineRecord | null;
    others: number;
  }[];
  memberships: readonly {
    fromDate: string;
    team: TimelineRecord;
    member: boolean;
  }[];
  leads: readonly { fromDate: string; team: TimelineRecord; leads: boolean }[];
}

const fieldOrder = new Map<TimelineField, number>(
  timelineFieldSchema.options.map((field, place) => [field, place]),
);

// The days of a person's timeline, earliest first, each with its changes in the order a day lists
// them. On the day someone leaves, the feature teams and leads that end with them aren't listed
// again: End says it.
export function timelineDays({
  start,
  end,
  fills,
  lines,
  memberships,
  leads,
}: TimelineSources): TimelineDay[] {
  const byDay = new Map<string, TimelineChange[]>();
  const add = (day: string, change: TimelineChange) => {
    byDay.set(day, [...(byDay.get(day) ?? []), change]);
  };
  const leaving = (day: string, part: "added" | "removed") =>
    part === "removed" && end !== null && day >= end;
  for (const { day, hire } of fills) add(day, { field: "filled", value: hire });
  if (start !== null) add(start, { field: "start" });
  lines.forEach(({ fromDate, manager, others }, place) => {
    const before = lines[place - 1];
    add(fromDate, {
      field: "manager",
      value: manager,
      ...(before === undefined ? {} : { was: before.manager }),
      ...(before === undefined || others === 0 ? {} : { others }),
    });
  });
  for (const { fromDate, team, member } of memberships) {
    const part = member ? "added" : "removed";
    if (!leaving(fromDate, part)) {
      add(fromDate, { field: "featureTeams", value: team, part });
    }
  }
  for (const { fromDate, team, leads: leading } of leads) {
    const part = leading ? "added" : "removed";
    if (!leaving(fromDate, part)) {
      add(fromDate, { field: "leads", value: team, part });
    }
  }
  if (end !== null) add(end, { field: "end" });
  return [...byDay.entries()]
    .sort(([first], [second]) => first.localeCompare(second))
    .map(([day, held]) => ({
      day,
      changes: held.toSorted(
        (first, second) =>
          Number(fieldOrder.get(first.field)) -
          Number(fieldOrder.get(second.field)),
      ),
    }));
}

// The days someone began and stopped leading each team: they lead from a lead record naming them
// while they are a member, as a team's lead is read on any day, until the team's next record or the
// end of their membership.
export function leadingDays(
  personId: string,
  records: readonly {
    teamId: string;
    leadId: string | null;
    fromDate: string;
  }[],
  memberships: readonly { teamId: string; member: boolean; fromDate: string }[],
): { teamId: string; fromDate: string; leads: boolean }[] {
  const teamIds = [...new Set(records.map(({ teamId }) => teamId))];
  return teamIds.flatMap((teamId) => {
    const byDay = <Row extends { teamId: string; fromDate: string }>(
      rows: readonly Row[],
    ) =>
      rows
        .filter((row) => row.teamId === teamId)
        .toSorted((first, second) =>
          first.fromDate.localeCompare(second.fromDate),
        );
    const teamLeads = byDay(records);
    const teamMemberships = byDay(memberships);
    const days = [
      ...new Set(
        [...teamLeads, ...teamMemberships].map(({ fromDate }) => fromDate),
      ),
    ].sort();
    const leadsOn = (day: string) =>
      inForceOn(teamLeads, day)?.leadId === personId &&
      inForceOn(teamMemberships, day)?.member === true;
    return days.flatMap((day, place) => {
      const before = days[place - 1];
      const leads = leadsOn(day);
      const led = before !== undefined && leadsOn(before);
      return leads === led ? [] : [{ teamId, fromDate: day, leads }];
    });
  });
}

// The reporting lines a reader sees: those in force until today with Past managers' class, those
// from a later day with Future reorganizations'.
export function seenLines<Line extends { fromDate: string }>(
  lines: readonly Line[],
  today: string,
  sees: { past: boolean; later: boolean },
): Line[] {
  return lines.filter(({ fromDate }) =>
    fromDate > today ? sees.later : sees.past,
  );
}

// Someone's preferred names, by their identifier.
async function namesOf(
  reader: Transaction,
  ids: readonly string[],
): Promise<Map<string, string>> {
  if (ids.length === 0) return new Map();
  const rows = await reader
    .select({ id: people.id, name: people.preferredName })
    .from(people)
    .where(inArray(people.id, [...ids]));
  return new Map(rows.map(({ id, name }) => [id, name]));
}

// A person's reporting lines, each with how many others were given the same manager that day,
// leaving out those starting with them, as the reader sees them. A line's change from the one before
// it is worked out from every line, so a later line seen alone still says what it changes from.
async function linesOf(
  reader: Transaction,
  actor: Actor,
  personId: string,
  today: string,
): Promise<{ all: TimelineSources["lines"]; seen: ReadonlySet<string> }> {
  const all = (await readLines(reader, [personId])).get(personId) ?? [];
  const shared = await reader.execute<{
    from_date: string;
    manager_id: string | null;
    others: number;
  }>(sql`
    SELECT line.from_date::text AS from_date, line.manager_id, count(*)::int AS others
    FROM fathom.reporting_lines AS line
    WHERE line.person_id <> ${personId}
      AND (line.from_date, line.manager_id) IN (
        SELECT mine.from_date, mine.manager_id FROM fathom.reporting_lines AS mine
        WHERE mine.person_id = ${personId}
      )
      AND EXISTS (
        SELECT 1 FROM fathom.reporting_lines AS earlier
        WHERE earlier.person_id = line.person_id AND earlier.from_date < line.from_date
      )
    GROUP BY line.from_date, line.manager_id
  `);
  const othersOn = (fromDate: string, managerId: string | null) =>
    shared.rows.find(
      (row) => row.from_date === fromDate && row.manager_id === managerId,
    )?.others ?? 0;
  const names = await namesOf(
    reader,
    all.flatMap(({ managerId }) => (managerId === null ? [] : [managerId])),
  );
  const seen = seenLines(all, today, {
    past: seesField(actor, "managerHistory"),
    later: seesField(actor, "futureReorganizations"),
  });
  return {
    all: all.map(({ fromDate, managerId }) => ({
      fromDate,
      manager:
        managerId === null
          ? null
          : { id: managerId, name: names.get(managerId) ?? "" },
      others: othersOn(fromDate, managerId),
    })),
    seen: new Set(seen.map(({ fromDate }) => fromDate)),
  };
}

// The feature teams a person joined and left, and led, for a role that sees feature teams and their
// dates.
async function teamsOf(
  reader: Transaction,
  actor: Actor,
  personId: string,
): Promise<Pick<TimelineSources, "memberships" | "leads">> {
  if (
    !actor.permissions.includes("feature-teams:view") ||
    !seesField(actor, "featureTeamDates")
  ) {
    return { memberships: [], leads: [] };
  }
  const memberships = await reader
    .select({
      teamId: featureTeamMemberships.teamId,
      member: featureTeamMemberships.member,
      fromDate: featureTeamMemberships.fromDate,
    })
    .from(featureTeamMemberships)
    .where(eq(featureTeamMemberships.personId, personId));
  const teamIds = [...new Set(memberships.map(({ teamId }) => teamId))];
  if (teamIds.length === 0) return { memberships: [], leads: [] };
  const leadRecords = await reader
    .select({
      teamId: featureTeamLeads.teamId,
      leadId: featureTeamLeads.leadId,
      fromDate: featureTeamLeads.fromDate,
    })
    .from(featureTeamLeads)
    .where(inArray(featureTeamLeads.teamId, teamIds));
  const teams = await reader
    .select({ id: featureTeams.id, name: featureTeams.name })
    .from(featureTeams)
    .where(inArray(featureTeams.id, teamIds));
  const names = new Map(teams.map(({ id, name }) => [id, name]));
  const team = (id: string): TimelineRecord => ({
    id,
    name: names.get(id) ?? "",
  });
  const earliestFirst = <Row extends { fromDate: string }>(rows: Row[]) =>
    rows.toSorted((first, second) =>
      first.fromDate.localeCompare(second.fromDate),
    );
  return {
    memberships: earliestFirst(memberships).map(
      ({ teamId, member, fromDate }) => ({
        fromDate,
        team: team(teamId),
        member,
      }),
    ),
    leads: leadingDays(personId, leadRecords, memberships).map(
      ({ teamId, leads, fromDate }) => ({
        fromDate,
        team: team(teamId),
        leads,
      }),
    ),
  };
}

// The planned hires a person filled, each on the day its fill was last approved, for a role that sees
// the hiring plan.
async function fillsOf(
  reader: Transaction,
  actor: Actor,
  personId: string,
  timeZone: string,
): Promise<TimelineSources["fills"]> {
  if (!seesHiringPlan(actor)) return [];
  const hires = await reader
    .select({ id: plannedHires.id })
    .from(plannedHires)
    .where(eq(plannedHires.filledBy, personId));
  if (hires.length === 0) return [];
  const ids = hires.map(({ id }) => id);
  const approvals = await reader
    .select({ hireId: changes.recordId, madeAt: changeSets.madeAt })
    .from(changes)
    .innerJoin(changeSets, eq(changeSets.id, changes.changeSetId))
    .where(
      and(
        eq(changes.recordType, "planned-hire"),
        inArray(changes.recordId, ids),
        eq(changes.field, "filledBy"),
        eq(changes.draft, false),
        eq(changeSets.kind, "approval"),
        sql`${changes.newValue} = ${JSON.stringify(personId)}::jsonb`,
      ),
    );
  const latest = new Map<string, Date>();
  for (const { hireId, madeAt } of approvals) {
    const before = latest.get(hireId);
    if (before === undefined || madeAt > before) latest.set(hireId, madeAt);
  }
  const keys = await readKeyNumbers(reader, "hire", ids);
  return [...latest.entries()]
    .map(([hireId, madeAt]) => ({
      day: dayIn(timeZone, madeAt),
      hire: {
        id: hireId,
        name: `HIRE-${String(keys.get(hireId))}`,
        keyNumber: Number(keys.get(hireId)),
      },
    }))
    .toSorted((first, second) => first.day.localeCompare(second.day));
}

// A person's timeline as the reader's role may see it, all read at one moment, and whether it named
// a planned hire, which the access history records; refused for a person who doesn't exist.
export async function readPersonTimeline(
  database: Database,
  actor: Actor,
  personId: string,
): Promise<{ timeline: Timeline; includedHiringPlan: boolean }> {
  return database.transaction(
    async (reader) => {
      const [person] = await reader
        .select({ start: people.startDate, end: people.endDate })
        .from(people)
        .where(eq(people.id, personId));
      if (person === undefined) throw new NotFoundError();
      const timeZone = await readTimeZone(reader);
      const today = dayIn(timeZone);
      const fills = await fillsOf(reader, actor, personId, timeZone);
      const lines = await linesOf(reader, actor, personId, today);
      const days = timelineDays({
        start: person.start,
        end: person.end,
        fills,
        lines: lines.all,
        ...(await teamsOf(reader, actor, personId)),
      });
      // A manager's change shows only on a day whose line the reader sees.
      const shown = days.flatMap((day) => {
        const kept = day.changes.filter(
          ({ field }) => field !== "manager" || lines.seen.has(day.day),
        );
        return kept.length === 0 ? [] : [{ ...day, changes: kept }];
      });
      return {
        timeline: { days: shown },
        includedHiringPlan: fills.length > 0,
      };
    },
    { isolationLevel: "repeatable read", accessMode: "read only" },
  );
}
