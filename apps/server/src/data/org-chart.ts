// SPDX-License-Identifier: Apache-2.0

// The org chart: today's reporting lines as approved, and the chart as drafts make it. Part of the
// data access layer. Each person's draft of their manager, their position and their team's name
// comes beside the approved chart, as People shows them: a draft's manager only to readers who see
// Personal details, since it is Personal until approved, its position only beside a position
// the reader is shown, and the reader's own unpublished drafts in place of the published ones.
// Everyone current today appears, with each manager they still report to, up the chain, even one
// whose end date has passed, as People names them. A reader who does not see Personal details
// sees no further up than such a manager, and only their name and team, as People shows them;
// anything more would tell them who else has left. A reader who does not see people sees each
// person's name, position, and team, but no Employee ID, which is a detail of People and would let
// them look people up there. Positions show only as the positions list's tier allows, as on People,
// except that a General one shows to every reader. Both charts follow these rules alike. Planned
// hires join the chart as placeholders, to every reader, as People shows them: each hire not yet
// filled, and, to readers who do not see Personal details, each filled one whose person has not
// started; named by its name, or by its position and ID, under its manager, a person or a planned
// manager, and with the month it is expected. Readers who see the hiring plan see its drafts too.

import { type Database, listItems, people, teams } from "@fathom/db";
import {
  hireCalled,
  knownColour,
  type OrgChart,
  type OrgChartDraft,
  mayDateLineChange,
  type OrgChartPerson,
  type PaletteColour,
} from "@fathom/shared";
import { eq } from "drizzle-orm";
import { NotFoundError } from "../errors.ts";
import {
  type Actor,
  requireView,
  seesPersonalDetails,
  seesSensitivity,
} from "../access.ts";
import {
  type Draft,
  drafted,
  heldByOf,
  readHeld,
  readPersonDrafts,
  type Recorded,
} from "./drafts.ts";
import {
  expectedMonth,
  hireIdOf,
  readHireDrafts,
  readLiveHires,
} from "./hires.ts";
import { inForceOn } from "./in-force.ts";
import { currentOn, notStarted, personalDetailFields } from "./people.ts";
import {
  changesLine,
  changesLineFields,
  draftedLine,
  draftedLines,
  readLines,
  readTeams,
  text,
} from "./reporting.ts";
import { readToday } from "./settings.ts";
import { builtInTier, choiceLabels } from "./values.ts";

export interface OrgChartRead extends OrgChart {
  // Whether the chart told anyone that a manager has left, showed them Personal details of a
  // draft, or showed positions more sensitive than General, which the access history records.
  includedPersonal: boolean;
  // Whether the chart showed anyone hires' drafts, part of the hiring plan, which the access history
  // records as a view of the hiring plan.
  includedHiringPlan: boolean;
}

// A person as the chart draws them: their position by its label, and the manager and team name in
// force today.
interface PersonRecord {
  kind: "person";
  preferredName: string;
  employeeId: string;
  positionId: string;
  position: string | null;
  startDate: string | null;
  endDate: string | null;
  managerId: string | null;
  teamName: string | null;
}

// A planned hire's placeholder as the chart draws it: named as its People row is, with its ID when
// that stands for a name of its own, its position by its label, its manager, and the month it is
// expected.
interface HireRecord {
  kind: "planned-hire";
  preferredName: string;
  shownId?: string;
  positionId: string;
  position: string;
  managerId: string | null;
  expected: string;
}

type ChartRecord = PersonRecord | HireRecord;

// What a reader of the chart may see.
interface Reader {
  seesPersonal: boolean;
  seesPeople: boolean;
  seesPositions: boolean;
  today: string;
}

// The chart the records give: everyone current today, with each manager they still report to, up
// the chain, even one whose end date has passed, marked as having left only for readers who see
// end dates.
function chartOf(
  records: ReadonlyMap<string, ChartRecord>,
  colours: ReadonlyMap<string, string | null>,
  { seesPersonal, seesPeople, seesPositions, today }: Reader,
): OrgChartPerson[] {
  // Every person on the chart is among the records.
  const recordOf = (id: string) => records.get(id) as ChartRecord;
  const current = (record: ChartRecord): boolean => {
    switch (record.kind) {
      case "person":
        return currentOn(
          { startDate: record.startDate, endDate: record.endDate },
          today,
        );
      // A placeholder is drawn for as long as it is one.
      case "planned-hire":
        return true;
    }
  };
  const shown = new Set<string>();
  for (const [first, record] of records) {
    if (!current(record)) continue;
    // Up the chain until someone already shown, so a loop, which the rules never let in, ends.
    let id: string | null = first;
    while (id !== null && !shown.has(id) && records.has(id)) {
      shown.add(id);
      id = recordOf(id).managerId;
    }
  }
  const card = (id: string, record: ChartRecord): OrgChartPerson => {
    switch (record.kind) {
      case "person":
        return personCard(id, record);
      case "planned-hire":
        return {
          id,
          preferredName: record.preferredName,
          employeeId: null,
          position: seesPositions ? record.position : null,
          teamName: null,
          teamColour: null,
          managerId: record.managerId,
          planned: {
            expected: record.expected,
            ...(record.shownId === undefined
              ? {}
              : { shownId: record.shownId }),
          },
        };
    }
  };
  const personCard = (id: string, record: PersonRecord): OrgChartPerson => {
    const gone = record.endDate !== null && record.endDate < today;
    return {
      id,
      preferredName: record.preferredName,
      // People hides someone who has left from those who do not see end dates, so their card
      // names no one there.
      employeeId:
        seesPeople && (seesPersonal || !gone) ? record.employeeId : null,
      position: seesPositions ? record.position : null,
      teamName: record.teamName,
      // A team whose name comes off loses its colour.
      teamColour:
        record.teamName === null ? null : knownColour(colours.get(id)),
      managerId: record.managerId,
      ...(seesPersonal && gone ? { left: true } : {}),
    };
  };
  return [...shown].map((id) => card(id, recordOf(id)));
}

// The chart on a chosen day, for readers who see every class of data other dates need, and future
// ones too: as approved, without planned hires, which belong to today, and with drafts laid over
// it only for those who may change reporting lines from that day.
export async function readOrgChartOn(
  database: Database,
  actor: Actor,
  day: string,
): Promise<OrgChartRead> {
  requireView(
    actor,
    day > (await readToday(database))
      ? "orgChartFutureDates"
      : "orgChartOtherDates",
  );
  return {
    ...(await readOrgChart(database, actor, { day })),
    includedPersonal: true,
  };
}

export async function readOrgChart(
  database: Database,
  actor: Actor,
  { day }: { day?: string } = {},
): Promise<OrgChartRead> {
  const today = await readToday(database);
  const shownDay = day ?? today;
  const seesPeople = actor.permissions.includes("people:view");
  const seesPersonal = seesPersonalDetails(actor);
  const approvedOnly =
    day !== undefined &&
    !(
      actor.permissions.includes("people:edit") &&
      mayDateLineChange(actor.permissions.includes("personal:edit"), day, today)
    );
  const withHires = day === undefined;
  // Hires' drafts are part of the hiring plan, which does nothing without seeing people.
  const wholePlan =
    withHires && seesPeople && seesSensitivity(actor, "hiring-plan");
  // Read as of one moment, so an approval saved meanwhile is seen whole or not at all.
  const {
    rows,
    lines,
    teams,
    drafts,
    hires,
    hireDrafts,
    positionTier,
    labelOf,
    held,
  } = await database.transaction(
    async (transaction) => {
      // Drafts are details of people, so those who do not see people are sent none.
      const drafts =
        seesPeople && !approvedOnly
          ? await readPersonDrafts(transaction, undefined, actor.user.id)
          : new Map<string, Draft>();
      const hires = withHires
        ? await readLiveHires(transaction)
        : new Map<string, Recorded>();
      const hireDrafts = wholePlan
        ? await readHireDrafts(transaction, undefined, actor.user.id)
        : new Map<string, Draft>();
      const draftedPositions = [
        ...new Set(
          [
            ...drafts.values(),
            ...hireDrafts.values(),
            ...[...hires.values()].map((fields) => ({ fields })),
          ].flatMap(({ fields }) =>
            typeof fields.positionId === "string" ? [fields.positionId] : [],
          ),
        ),
      ];
      return {
        hires,
        hireDrafts,
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
        labelOf: await choiceLabels(transaction, draftedPositions),
        // Who holds each person or planned hire by unpublished changes, to those sent their drafts.
        held: new Map([
          ...(seesPeople && !approvedOnly
            ? await readHeld(transaction, "person", actor.user.id)
            : []),
          ...(wholePlan
            ? await readHeld(transaction, "planned-hire", actor.user.id)
            : []),
        ]),
      };
    },
    { isolationLevel: "repeatable read", accessMode: "read only" },
  );
  const colours = new Map(
    [...teams].map(([managerId, { colour }]) => [managerId, colour]),
  );
  const live = new Map(
    rows.map(({ id, ...row }): [string, PersonRecord] => [
      id,
      {
        kind: "person",
        ...row,
        managerId: inForceOn(lines.get(id) ?? [], shownDay)?.managerId ?? null,
        teamName: teams.get(id)?.name ?? null,
      },
    ]),
  );
  const reader: Reader = {
    seesPersonal,
    seesPeople,
    seesPositions:
      positionTier === "general" ||
      (seesPeople && seesSensitivity(actor, positionTier)),
    today: shownDay,
  };
  // Start dates of everyone live, and of those only drafted to be added, such as a new person a
  // fill drafts, so a hire is drawn under them, or gives way to them, only once they start.
  const startOf = new Map([
    ...[...drafts].flatMap(([id, draft]): [string, string | null][] =>
      draft.action === "created" ? [[id, text(draft.fields.startDate)]] : [],
    ),
    ...rows.map(({ id, startDate }): [string, string | null] => [
      id,
      startDate,
    ]),
  ]);
  const managerShown = managerOnChart(startOf, shownDay);
  const managerOn: ManagerOn = (id, fields) => {
    const own = lines.get(id) ?? [];
    const line = draftedLine(own, fields, today);
    return line === undefined
      ? undefined
      : {
          managerId:
            inForceOn(draftedLines(own, fields, today), shownDay)?.managerId ??
            null,
          from: line.fromDate,
        };
  };
  const placeholder = placeholderOf(startOf, managerShown, labelOf, reader);
  const liveHires = hireRecords(hires, placeholder);
  const draftedHires = hireRecords(
    new Map(
      [...new Set([...hires.keys(), ...hireDrafts.keys()])].flatMap(
        (id): [string, Recorded][] => {
          const before = hires.get(id);
          const draft = hireDrafts.get(id);
          const after =
            draft === undefined || draft.state === "rejected"
              ? before
              : drafted(before, draft);
          return after === undefined ? [] : [[id, after]];
        },
      ),
    ),
    placeholder,
  );
  const draftedChart = chartOf(
    new Map<string, ChartRecord>([
      ...draftedRecords(live, drafts, {
        seesPersonal,
        seesPosition: reader.seesPositions,
        labelOf,
        managerOn,
      }),
      ...draftedHires,
    ]),
    colours,
    reader,
  );
  // Someone only a draft adds is on the drafted chart alone, so it carries the draft's state there,
  // for their card's mark.
  const withAddedDraft = (person: OrgChartPerson): OrgChartPerson => {
    const draft = drafts.get(person.id) ?? hireDrafts.get(person.id);
    return draft?.action === "created"
      ? {
          ...person,
          draft: {
            state: draft.state,
            unpublished: draft.unpublished === true,
          },
        }
      : person;
  };
  const heldOf = (person: OrgChartPerson): OrgChartPerson => ({
    ...person,
    ...heldByOf(held, person.id),
  });
  const approved = new Map<string, ChartRecord>([...live, ...liveHires]);
  const chart = chartOf(approved, colours, reader).map(
    (person): OrgChartPerson => {
      const draft = draftBeside(
        // Everyone on the approved chart is among its records.
        approved.get(person.id) as ChartRecord,
        person,
        drafts.get(person.id) ?? hireDrafts.get(person.id),
        { seesPersonal, labelOf, managerShown, managerOn },
      );
      return heldOf(draft === undefined ? person : { ...person, draft });
    },
  );
  const hireDraftsShown = chart.some(
    (person) => person.planned !== undefined && person.draft !== undefined,
  );
  return {
    people: chart,
    drafted: draftedChart.map((person) => heldOf(withAddedDraft(person))),
    includedPersonal:
      chart.some(
        (person) =>
          person.left === true ||
          (person.planned === undefined &&
            person.draft?.managerId !== undefined),
      ) ||
      (positionTier !== "general" &&
        [...chart, ...draftedChart].some(
          ({ position }) => position !== null,
        )) ||
      (seesPersonal &&
        (draftedChart.some((person) => person.left === true) ||
          [...drafts.values()].some(
            (draft) =>
              draft.state !== "rejected" &&
              (draft.action === "created" ||
                personalDetailFields.some((field) => field in draft.fields)),
          ))),
    includedHiringPlan:
      hireDraftsShown ||
      draftedChart.some(
        (person) => person.planned !== undefined && hireDrafts.has(person.id),
      ),
  };
}

// The manager the chart draws a planned hire under: the one it names, unless a person who has not
// started, since the chart draws today, so the hire is at the top until they do.
type ManagerShown = (managerId: string | null) => string | null;

function managerOnChart(
  startOf: ReadonlyMap<string, string | null>,
  today: string,
): ManagerShown {
  return (managerId) =>
    managerId !== null &&
    startOf.has(managerId) &&
    notStarted({ startDate: startOf.get(managerId) }, today)
      ? null
      : managerId;
}

// A planned hire as the chart draws it, or none when the reader sees its person instead: its name, or
// its position and ID, the manager the chart draws it under, and the month it is expected.
type Placeholder = (hire: Recorded) => HireRecord | undefined;

function placeholderOf(
  startOf: ReadonlyMap<string, string | null>,
  managerShown: ManagerShown,
  labelOf: ReadonlyMap<string, string>,
  { seesPersonal, seesPositions, today }: Reader,
): Placeholder {
  return (hire) => {
    const filledBy = text(hire.filledBy);
    const fillerStart = filledBy === null ? null : startOf.get(filledBy);
    // A filled hire gives way to its person once they have started, or to readers who see them.
    if (
      filledBy !== null &&
      (seesPersonal || !notStarted({ startDate: fillerStart }, today))
    ) {
      return undefined;
    }
    const positionId = String(hire.positionId);
    // Every hire's position is read with the chart.
    const position = labelOf.get(positionId) as string;
    const { requisition, temporaryId } = hireIdOf(hire);
    const shownId = String(requisition ?? temporaryId);
    const name = text(hire.name);
    return {
      kind: "planned-hire",
      preferredName: hireCalled(
        name,
        shownId,
        seesPositions ? position : undefined,
      ),
      ...(name === null ? { shownId } : {}),
      positionId,
      position,
      managerId: managerShown(text(hire.managerId)),
      expected: expectedMonth(
        { fillerStart: fillerStart ?? null, targetDate: text(hire.targetDate) },
        today,
      ),
    };
  };
}

function hireRecords(
  hires: ReadonlyMap<string, Recorded>,
  placeholder: Placeholder,
): Map<string, HireRecord> {
  return new Map(
    [...hires].flatMap(([id, hire]): [string, HireRecord][] => {
      const record = placeholder(hire);
      return record === undefined ? [] : [[id, record]];
    }),
  );
}

// The manager a draft changing a person's line gives them on the day the chart draws, from the
// draft's fields, and the day that line takes effect from.
// None for someone with neither a line nor a date, who has no manager.
type ManagerOn = (
  id: string,
  fields: Recorded,
) => { managerId: string | null; from: string } | undefined;

// Everyone as their drafts make them, as the reader may see them, with rejected drafts taken back:
// a draft's manager, as on the day drawn, and dates only to readers who see Personal details, and
// its position only to those who see the Positions list.
function draftedRecords(
  live: ReadonlyMap<string, PersonRecord>,
  drafts: ReadonlyMap<string, Draft>,
  {
    seesPersonal,
    seesPosition,
    labelOf,
    managerOn,
  }: {
    seesPersonal: boolean;
    seesPosition: boolean;
    labelOf: ReadonlyMap<string, string>;
    managerOn: ManagerOn;
  },
): Map<string, PersonRecord> {
  const records = new Map<string, PersonRecord>();
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
      kind: "person",
      preferredName: String(after.preferredName),
      employeeId: String(after.employeeId),
      positionId,
      position:
        (seesPosition ? labelOf.get(positionId) : undefined) ??
        before?.position ??
        null,
      ...(seesPersonal || before === undefined
        ? { startDate: text(after.startDate), endDate: text(after.endDate) }
        : { startDate: before.startDate, endDate: before.endDate }),
      managerId: !seesPersonal
        ? (before?.managerId ?? null)
        : changesLine(draft)
          ? (managerOn(id, draft.fields)?.managerId ?? null)
          : text(after.managerId),
      teamName: text(after.teamName),
    });
  }
  return records;
}

// What a draft is shown beside the approved chart with: a person's drafted manager, as on the day
// drawn, only to readers who see Personal details, a drafted position, by its label, only beside a
// position shown, so never for a manager shown by name alone, and a hire under the manager the chart
// would draw it under.
interface BesideRules {
  seesPersonal: boolean;
  labelOf: ReadonlyMap<string, string>;
  managerShown: ManagerShown;
  managerOn: ManagerOn;
}

// What a draft changes, drawn beside the approved chart, rejected or not. A draft adding or
// removing someone is drawn only on the chart as drafts make it.
function draftBeside(
  before: ChartRecord,
  shown: OrgChartPerson,
  draft: Draft | undefined,
  rules: BesideRules,
): OrgChartDraft | undefined {
  if (draft?.action !== "changed") return undefined;
  const changes = changesBeside(before, shown, draft.fields, rules);
  if (Object.keys(changes).length === 0) return undefined;
  return {
    ...changes,
    state: draft.state,
    unpublished: draft.unpublished === true,
  };
}

// A person's drafted manager, with the day it takes effect from, position and team name, and a
// planned hire's drafted manager and position, each left out when the draft keeps it as it is or the
// reader may not see it.
function changesBeside(
  before: ChartRecord,
  shown: OrgChartPerson,
  fields: Recorded,
  { seesPersonal, labelOf, managerShown, managerOn }: BesideRules,
): Pick<OrgChartDraft, "managerId" | "managerFrom" | "position" | "teamName"> {
  const positionId = fields.positionId as string | undefined;
  const position =
    shown.position !== null &&
    positionId !== undefined &&
    positionId !== before.positionId
      ? labelOf.get(positionId)
      : undefined;
  const positionChange = position === undefined ? {} : { position };
  switch (before.kind) {
    case "person": {
      const line = changesLineFields(fields)
        ? managerOn(shown.id, fields)
        : undefined;
      const teamName = fields.teamName as string | null | undefined;
      return {
        ...(seesPersonal &&
        line !== undefined &&
        line.managerId !== before.managerId
          ? { managerId: line.managerId, managerFrom: line.from }
          : {}),
        ...positionChange,
        ...(teamName !== undefined && teamName !== before.teamName
          ? { teamName }
          : {}),
      };
    }
    case "planned-hire": {
      const managerId =
        "managerId" in fields
          ? managerShown(text(fields.managerId))
          : before.managerId;
      return {
        ...(managerId === before.managerId ? {} : { managerId }),
        ...positionChange,
      };
    }
  }
}

// The minimal record a draft is applied to, as the change history records a person.
function draftedRecord(
  before: PersonRecord | undefined,
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
