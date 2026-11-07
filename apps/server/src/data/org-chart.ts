// SPDX-License-Identifier: Apache-2.0

// The org chart: today's reporting lines as approved, and the chart as drafts make it. Part of the
// data access layer. Each person's draft of their manager and of their team's name comes beside
// the approved chart, as People shows them: a draft's manager only to readers who see Restricted
// details, since it is Restricted until approved, and the reader's own unpublished drafts in place
// of the published ones. Everyone current today appears, with each manager they still report to,
// up the chain, even one whose end date has passed, as People names them. A reader who does not
// see Restricted details sees no further up than such a manager, and only their name and team, as
// People shows them; anything more would tell them who else has left. A reader who does not see
// people sees each person's name, position, and team, but no Employee ID, which is a detail of
// People and would let them look people up there. Positions show only as the positions list's tier
// allows, as on People, except that a General one shows to every reader. Both charts follow these
// rules alike.

import { type Database, listItems, people, teams } from "@fathom/db";
import {
  knownColour,
  type OrgChart,
  type OrgChartDraft,
  type OrgChartPerson,
  type PaletteColour,
} from "@fathom/shared";
import { eq, inArray } from "drizzle-orm";
import { NotFoundError } from "../errors.ts";
import { type Actor, seesTier } from "../access.ts";
import {
  type Draft,
  drafted,
  readPersonDrafts,
  type Recorded,
} from "./drafts.ts";
import { inForceOn } from "./in-force.ts";
import { currentOn, restrictedPersonFields } from "./people.ts";
import { readLines, readTeams, text } from "./reporting.ts";
import { readToday } from "./settings.ts";
import { builtInTier } from "./values.ts";

export interface OrgChartRead extends OrgChart {
  // Whether the chart told anyone that a manager has left, or showed them Restricted details of a
  // draft, which the access history records.
  includedRestricted: boolean;
}

// A person as the chart draws them: their position by its label, and the manager and team name in
// force today.
interface ChartRecord {
  preferredName: string;
  employeeId: string;
  positionId: string;
  position: string | null;
  startDate: string | null;
  endDate: string | null;
  managerId: string | null;
  teamName: string | null;
}

// What a reader of the chart may see.
interface Reader {
  restricted: boolean;
  seesPeople: boolean;
  seesPositions: boolean;
  today: string;
}

// The chart the records give: everyone current today, with each manager they still report to, up
// the chain, even one whose end date has passed. A reader who does not see Restricted details sees
// no further up than such a manager, and only their name and team.
function chartOf(
  records: ReadonlyMap<string, ChartRecord>,
  colours: ReadonlyMap<string, string | null>,
  { restricted, seesPeople, seesPositions, today }: Reader,
): OrgChartPerson[] {
  // Every person on the chart is among the records.
  const recordOf = (id: string) => records.get(id) as ChartRecord;
  const current = ({ startDate, endDate }: ChartRecord) =>
    currentOn({ startDate, endDate }, today);
  // Someone not current today, shown only as the manager of someone who is.
  const hidden = (id: string) => !restricted && !current(recordOf(id));
  const shown = new Set<string>();
  for (const [first, record] of records) {
    if (!current(record)) continue;
    // Up the chain until someone already shown, so a loop, which the rules never let in, ends.
    let id: string | null = first;
    while (id !== null && !shown.has(id) && records.has(id)) {
      shown.add(id);
      id = hidden(id) ? null : recordOf(id).managerId;
    }
  }
  return [...shown].map((id): OrgChartPerson => {
    const record = recordOf(id);
    const gone = record.endDate !== null && record.endDate < today;
    return {
      id,
      preferredName: record.preferredName,
      employeeId: hidden(id) || !seesPeople ? null : record.employeeId,
      position: hidden(id) || !seesPositions ? null : record.position,
      teamName: record.teamName,
      // A team whose name comes off loses its colour.
      teamColour:
        record.teamName === null ? null : knownColour(colours.get(id)),
      managerId: hidden(id) ? null : record.managerId,
      ...(hidden(id) ? { nameOnly: true } : {}),
      ...(restricted && gone ? { left: true } : {}),
    };
  });
}

export async function readOrgChart(
  database: Database,
  actor: Actor,
  asOf?: string,
): Promise<OrgChartRead> {
  const today = asOf ?? (await readToday(database));
  // Restricted and Confidential details are details of people, so they show only with people, as
  // the Roles page says; a role can be given them without people, but then they do nothing here.
  const seesPeople = actor.permissions.includes("people:view");
  const restricted = seesPeople && seesTier(actor, "restricted");
  // Read as of one moment, so an approval saved meanwhile is seen whole or not at all.
  const { rows, lines, teams, drafts, positionTier, labels } =
    await database.transaction(
      async (transaction) => {
        const drafts = await readPersonDrafts(
          transaction,
          undefined,
          actor.user.id,
        );
        const draftedPositions = [
          ...new Set(
            [...drafts.values()].flatMap(({ fields }) =>
              typeof fields.positionId === "string" ? [fields.positionId] : [],
            ),
          ),
        ];
        return {
          rows: await transaction
            .select({
              id: people.id,
              preferredName: people.preferredName,
              employeeId: people.employeeId,
              positionId: people.positionId,
              position: listItems.label,
              startDate: people.startDate,
              endDate: people.endDate,
            })
            .from(people)
            .innerJoin(listItems, eq(listItems.id, people.positionId)),
          lines: await readLines(transaction),
          teams: await readTeams(transaction),
          drafts,
          positionTier: await builtInTier(transaction, "positions"),
          labels:
            draftedPositions.length === 0
              ? []
              : await transaction
                  .select({ id: listItems.id, label: listItems.label })
                  .from(listItems)
                  .where(inArray(listItems.id, draftedPositions)),
        };
      },
      { isolationLevel: "repeatable read", accessMode: "read only" },
    );
  const colours = new Map(
    [...teams].map(([managerId, { colour }]) => [managerId, colour]),
  );
  const live = new Map(
    rows.map(({ id, ...row }): [string, ChartRecord] => [
      id,
      {
        ...row,
        managerId: inForceOn(lines.get(id) ?? [], today)?.managerId ?? null,
        teamName: teams.get(id)?.name ?? null,
      },
    ]),
  );
  const reader: Reader = {
    restricted,
    seesPeople,
    seesPositions:
      positionTier === "general" ||
      (seesPeople && seesTier(actor, positionTier)),
    today,
  };
  const draftedChart = chartOf(
    draftedRecords(live, drafts, {
      restricted,
      seesPosition: reader.seesPositions,
      labelOf: new Map(labels.map(({ id, label }) => [id, label])),
    }),
    colours,
    reader,
  );
  const chart = chartOf(live, colours, reader).map((person): OrgChartPerson => {
    // Everyone on the approved chart is live.
    const before = live.get(person.id) as ChartRecord;
    const draft = draftBeside(before, drafts.get(person.id), { restricted });
    return draft === undefined ? person : { ...person, draft };
  });
  return {
    people: chart,
    drafted: draftedChart,
    includedRestricted:
      chart.some(
        (person) =>
          person.left === true || person.draft?.managerId !== undefined,
      ) ||
      (restricted &&
        (draftedChart.some((person) => person.left === true) ||
          [...drafts.values()].some(
            (draft) =>
              draft.state !== "rejected" &&
              (draft.action === "created" ||
                restrictedPersonFields.some((field) => field in draft.fields)),
          ))),
  };
}

// Everyone as their drafts make them, as the reader may see them, with rejected drafts taken back:
// a draft's manager and dates only to readers who see Restricted details, and its position only to
// those who see the Positions list. A drafted line starts today or earlier for anyone current, so
// its manager is the one they will report to today.
function draftedRecords(
  live: ReadonlyMap<string, ChartRecord>,
  drafts: ReadonlyMap<string, Draft>,
  {
    restricted,
    seesPosition,
    labelOf,
  }: {
    restricted: boolean;
    seesPosition: boolean;
    labelOf: ReadonlyMap<string, string>;
  },
): Map<string, ChartRecord> {
  const records = new Map<string, ChartRecord>();
  for (const id of new Set([...live.keys(), ...drafts.keys()])) {
    const before = live.get(id);
    const draft = drafts.get(id);
    if (draft === undefined || draft.state === "rejected") {
      if (before !== undefined) records.set(id, before);
      continue;
    }
    const after = draftedRecord(before, draft);
    if (after === undefined) continue;
    const positionId = String(after.positionId);
    records.set(id, {
      preferredName: String(after.preferredName),
      employeeId: String(after.employeeId),
      positionId,
      position:
        (seesPosition ? labelOf.get(positionId) : undefined) ??
        before?.position ??
        null,
      ...(restricted || before === undefined
        ? { startDate: text(after.startDate), endDate: text(after.endDate) }
        : { startDate: before.startDate, endDate: before.endDate }),
      managerId: restricted
        ? text(after.managerId)
        : (before?.managerId ?? null),
      teamName: text(after.teamName),
    });
  }
  return records;
}

// What a person's draft changes of their manager and team name, drawn beside the approved chart,
// rejected or not: a drafted manager only to readers who see Restricted details. A draft adding or
// removing someone is drawn only on the chart as drafts make it.
function draftBeside(
  before: ChartRecord,
  draft: Draft | undefined,
  { restricted }: { restricted: boolean },
): OrgChartDraft | undefined {
  if (draft?.action !== "changed") return undefined;
  const managerId = draft.fields.managerId as string | null | undefined;
  const teamName = draft.fields.teamName as string | null | undefined;
  const changes = {
    ...(restricted && managerId !== undefined && managerId !== before.managerId
      ? { managerId }
      : {}),
    ...(teamName !== undefined && teamName !== before.teamName
      ? { teamName }
      : {}),
  };
  if (Object.keys(changes).length === 0) return undefined;
  return {
    ...changes,
    state: draft.state,
    unpublished: draft.unpublished === true,
  };
}

// The minimal record a draft is applied to, as the change history records a person.
function draftedRecord(
  before: ChartRecord | undefined,
  draft: Draft,
): Recorded | undefined {
  return drafted(
    before === undefined
      ? undefined
      : {
          preferredName: before.preferredName,
          employeeId: before.employeeId,
          positionId: before.positionId,
          startDate: before.startDate,
          endDate: before.endDate,
          managerId: before.managerId,
          teamName: before.teamName,
        },
    draft,
  );
}

// Sets the colour of a manager's named team, or removes it. A colour is how the chart is drawn, not
// a detail of anyone, so it is no draft: it changes at once, for everyone. Only a team with an
// approved name has one.
export async function setTeamColour(
  database: Database,
  managerId: string,
  colour: PaletteColour | null,
): Promise<void> {
  const changed = await database
    .update(teams)
    .set({ colour })
    .where(eq(teams.managerId, managerId))
    .returning({ managerId: teams.managerId });
  if (changed.length === 0) {
    throw new NotFoundError(
      "This team has no name yet, so it cannot have a colour",
    );
  }
}
