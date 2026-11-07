// SPDX-License-Identifier: Apache-2.0

// Building blocks for fictional records, used by the seed data generator and test data. Everything is
// generated from a fixed seed and reference date, so the same records come out every time, with the
// same identifiers. Names are made up from names common where the organization works, and some
// from elsewhere, in other scripts too, so they look realistic without describing anyone real. No
// real company, site, or product names are used. A development-only package, never included in the
// runtime image.

import {
  base,
  da,
  de,
  en,
  en_CA,
  en_IN,
  es,
  Faker,
  fr,
  fr_CA,
  ja,
  ko,
  ru,
  sv,
  zh_CN,
} from "@faker-js/faker";
import { createHash } from "node:crypto";

// The fixed namespace every fictional identifier is made in.
const namespace = "6f1c2a8e-3b7d-4f0a-9e65-2d4c8b1a7f30";

// A UUID made from a name, the same every time (version 5, as RFC 9562 sets out).
export function fictionalId(name: string): string {
  const hash = createHash("sha1")
    .update(Buffer.from(namespace.replaceAll("-", ""), "hex"))
    .update(name)
    .digest();
  hash[6] = (hash.readUInt8(6) & 0x0f) | 0x50;
  hash[8] = (hash.readUInt8(8) & 0x3f) | 0x80;
  const hex = hash.subarray(0, 16).toString("hex");
  return [
    hex.slice(0, 8),
    hex.slice(8, 12),
    hex.slice(12, 16),
    hex.slice(16, 20),
    hex.slice(20, 32),
  ].join("-");
}

export interface FictionalList {
  id: string;
  name: string;
  choices: { id: string; label: string }[];
}

// A column drawing on a list, which gives its values their visibility, or holding one note for each
// person, with a visibility of its own.
export type FictionalColumn =
  | {
      id: string;
      name: string;
      type: "choice";
      listId: string;
      visibility: null;
      multiple: boolean;
    }
  | {
      id: string;
      name: string;
      type: "note";
      listId: null;
      visibility: "general";
      multiple: false;
    };

export interface FictionalPerson {
  id: string;
  preferredName: string;
  employeeId: string;
  // A choice in the built-in Positions list.
  positionId: string;
  // As YYYY-MM-DD, or null when not set.
  startDate: string | null;
  endDate: string | null;
  // Marked as a manager, whom others can report to: everyone whose position is Manager.
  isManager: boolean;
  // The chosen choices of each column, by column.
  values: Record<string, string[]>;
  // Each note column's note, as Markdown, by column; a column with no note is left out.
  notes: Record<string, string>;
}

// Who a person reports to, from a date, as YYYY-MM-DD.
export interface FictionalLine {
  personId: string;
  managerId: string;
  fromDate: string;
}

export interface FictionalTeam {
  managerId: string;
  name: string;
  // A colour from the palette, as the theme names it, or null for none.
  colour: string | null;
}

// A planned hire: named, if it has a name, and known by its requisition, or by a temporary ID the
// seed data gives it while it has none, in the first hiring state with its meaning, due on its
// target date, as YYYY-MM-DD, if it has one, filled by a person, when it is, and with choices in
// some of the columns it shares with people, by column.
export interface FictionalHire {
  id: string;
  name: string | null;
  requisition: string | null;
  positionId: string;
  meaning: "proposed" | "open";
  targetDate: string | null;
  managerId: string | null;
  filledBy: string | null;
  values: Record<string, string[]>;
}

export interface FictionalOrganization {
  lists: FictionalList[];
  // The choices the seed data adds to the built-in Positions list, which Fathom makes itself.
  positions: FictionalList["choices"];
  columns: FictionalColumn[];
  people: FictionalPerson[];
  // One current line for everyone but the person at the top and those no manager was employed for.
  reportingLines: FictionalLine[];
  // Names for about half the managers' teams; the rest have none.
  teams: FictionalTeam[];
  // People made like the rest but not added, for drafts that add them.
  newcomers: FictionalPerson[];
  // Planned hires in each state, with requisitions and temporary IDs, most under current managers,
  // and one filled by someone who has not started yet, and one by an internal transfer.
  hires: FictionalHire[];
}

// How many newcomers an organization has.
export const newcomerCount = 2;

function list(key: string, name: string, labels: string[]): FictionalList {
  return {
    id: fictionalId(`list:${key}`),
    name,
    choices: labels.map((label) => ({
      id: fictionalId(`list:${key}:${label}`),
      label,
    })),
  };
}

// Invented site names, which describe no real place the organization has.
const sites = list("sites", "Sites", [
  "Kestrel Bay",
  "Northmere",
  "Ashgrove",
  "Corran Quay",
]);
// The choices of the built-in Positions list. Architect is never given to anyone, so the seed data
// can draft removing a choice no one has.
const positions = list("positions", "Positions", [
  "Software Engineer",
  "Test Engineer",
  "SDET",
  "Engineering Manager",
  "Architect",
]);
const levels = list("levels", "Levels", [
  "P1",
  "P2",
  "P3",
  "P4",
  "P5",
  "M1",
  "M2",
  "M3",
  "M4",
  "M5",
  "Co-op",
]);
const teamRoles = list("team-roles", "Roles on the team", [
  "Team Lead",
  "Design Authority",
]);
// Lists no column draws on, so the seed data can draft removing one and retiring the other.
const certifications = list("certifications", "Certifications", [
  "Fictional Cloud Practitioner",
  "Fictional Test Analyst",
]);
const languages = list("languages", "Languages", ["English", "French"]);

function column(
  key: string,
  name: string,
  from: FictionalList,
  multiple = false,
): FictionalColumn {
  return {
    id: fictionalId(`column:${key}`),
    name,
    type: "choice",
    listId: from.id,
    visibility: null,
    multiple,
  };
}

const siteColumn = column("site", "Site", sites);
const levelColumn = column("level", "Level", levels);
const teamRoleColumn = column("team-role", "Role on team", teamRoles, true);
const onboardingColumn: FictionalColumn = {
  id: fictionalId("column:onboarding"),
  name: "Onboarding",
  type: "note",
  listId: null,
  visibility: "general",
  multiple: false,
};

// Who has an onboarding note: the newest few who start after the reference date, and the newest
// who have already started.
export const onboarding = { starting: 2, started: 6 } as const;

// The steps of an onboarding checklist, the second naming the starter's buddy.
export const onboardingSteps = (buddy: string): string[] => [
  "Laptop and accounts ready",
  `Met the team and their buddy, **${buddy}**`,
  "First change merged",
  "Shadowed an on-call shift",
];

const months = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

// A day, given as YYYY-MM-DD, in words, such as 18 February 2027, the same whatever the computer's
// language.
function inWords(day: string): string {
  const [year, month, date] = day.split("-").map(Number);
  return `${String(date)} ${String(months.at(Number(month) - 1))} ${String(year)}`;
}

// An onboarding checklist as a note, with its first steps done and a status in colour: to start on
// a day, on track, or done once every step is.
function onboardingNote(
  buddy: string,
  done: number,
  startsOn: string | null,
): string {
  const steps = onboardingSteps(buddy);
  const status =
    startsOn !== null
      ? `<span data-colour="orange">Starts on ${inWords(startsOn)}</span>`
      : done === steps.length
        ? '<span data-colour="green">Done</span>'
        : '<span data-colour="teal">On track</span>';
  return [
    startsOn === null ? "## First weeks" : "## Before day one",
    "",
    ...steps.map((step, index) => `- [${index < done ? "x" : " "}] ${step}`),
    "",
    status,
    "",
    "Steps from the [onboarding guide](https://example.com/onboarding).",
  ].join("\n");
}

// The choice in a list with the given label, which the lists above always have.
function choice(from: FictionalList, label: string): string {
  return (
    from.choices.find((option) => option.label === label) as {
      id: string;
    }
  ).id;
}

const day = (date: Date) => date.toISOString().slice(0, 10);

// Where people's names come from, and how many in each hundred: mostly Canada, in English and
// French, then India, where the organization also works, then a few from elsewhere, some with
// accented letters and some in other scripts, so every screen and search is tried with them.
// Faker's Canadian locales have no names of their own, so English Canadian names come from its
// English ones and French Canadian names from its French ones. Each source has a generator of its
// own, so names never change anything else generated.
const nameSources = [
  { weight: 45, locale: [en_CA, en, base], order: "given first" },
  { weight: 10, locale: [fr_CA, fr, en, base], order: "given first" },
  { weight: 15, locale: [en_IN, en, base], order: "given first" },
  { weight: 5, locale: [de, en, base], order: "given first" },
  { weight: 5, locale: [es, en, base], order: "given first" },
  { weight: 3, locale: [sv, en, base], order: "given first" },
  { weight: 2, locale: [da, en, base], order: "given first" },
  { weight: 4, locale: [ko, en, base], order: "as written" },
  { weight: 4, locale: [ja, en, base], order: "as written" },
  { weight: 4, locale: [zh_CN, en, base], order: "as written" },
  { weight: 3, locale: [ru, en, base], order: "given first" },
] as const;

type NameSource = (typeof nameSources)[number];

// A name as people from the country write it: Korean, Japanese, and Chinese names family name first,
// as Faker writes them, and others given name first, with a family name that matches, as Russian
// family names do, and never with a title such as Dr.
function name(namer: Faker, order: NameSource["order"]): string {
  if (order === "as written") return namer.person.fullName();
  const sex = namer.person.sexType();
  return `${namer.person.firstName(sex)} ${namer.person.lastName(sex)}`;
}

const teamNames = [
  "Platform",
  "Payments",
  "Mobile",
  "Data",
  "Search",
  "Identity",
  "Billing",
  "Tools",
  "Quality",
  "Integrations",
  "Reporting",
  "Infrastructure",
];

// The colours the first named teams are given, from the palette; the rest have none.
const teamColours = ["teal", "grape", "orange", "indigo", "yellow", "pink"];

// Who reports to whom: the earliest current manager at the top, with no manager; other managers
// under someone who started before them, so there are no loops; and everyone else under a manager.
// Each line starts when both have started, so the manager is employed that day, and a new
// employee's starts on their start date. One manager who has left keeps reports who were never
// moved, so the warning about them shows. Made by a generator of their own, so they change nothing
// else generated.
function reporting(
  people: readonly FictionalPerson[],
  positionOf: (person: FictionalPerson) => string,
  managerChoice: string,
  seed: number,
  referenceDate: string,
): { reportingLines: FictionalLine[]; teams: FictionalTeam[] } {
  const faker = new Faker({ locale: [base], seed: seed + 50 });
  const started = (person: FictionalPerson) =>
    String(person.startDate) <= referenceDate;
  const managers = people
    .filter((person) => positionOf(person) === managerChoice && started(person))
    .sort((a, b) => String(a.startDate).localeCompare(String(b.startDate)));
  const top = managers.find(({ endDate }) => endDate === null);
  const departed = managers.find(
    ({ endDate }) => endDate !== null && endDate < referenceDate,
  );
  // The day a line starts, once both have started, or undefined when either has left by then.
  const fromFor = (person: FictionalPerson, manager: FictionalPerson) => {
    const from =
      String(person.startDate) > String(manager.startDate)
        ? String(person.startDate)
        : String(manager.startDate);
    return [manager.endDate, person.endDate].every(
      (end) => end === null || from <= end,
    )
      ? from
      : undefined;
  };
  const reportingLines: FictionalLine[] = [];
  let keptByDeparted = 0;
  for (const person of people) {
    if (person === top) continue;
    const isManager = managers.includes(person);
    const candidates = managers.filter(
      (manager) =>
        manager !== person &&
        manager.endDate === null &&
        fromFor(person, manager) !== undefined &&
        (!isManager || managers.indexOf(manager) < managers.indexOf(person)),
    );
    const stays =
      departed !== undefined &&
      !isManager &&
      person.endDate === null &&
      keptByDeparted < 3 &&
      fromFor(person, departed) !== undefined;
    let manager = stays ? departed : undefined;
    if (manager === undefined && candidates.length > 0) {
      manager = faker.helpers.arrayElement(candidates);
    }
    if (manager === undefined) continue;
    if (stays) keptByDeparted += 1;
    reportingLines.push({
      personId: person.id,
      managerId: manager.id,
      fromDate: String(fromFor(person, manager)),
    });
  }
  const named = managers.filter((_, index) => index % 2 === 0);
  const teams = teamNames.slice(0, named.length).map((name, index) => ({
    managerId: String(named.at(index)?.id),
    name: `${name} team`,
    colour: teamColours.at(index) ?? null,
  }));
  return { reportingLines, teams };
}

// The planned hires not yet filled, each due some months after the reference date, or with no
// target date, under the current managers in turn, but for those with none, and with a site and
// level where decided. Invented requisitions.
const openings: readonly {
  name: string | null;
  requisition: string | null;
  position: string;
  meaning: FictionalHire["meaning"];
  months: number | null;
  managed: boolean;
  site?: string;
  level?: string;
}[] = [
  {
    name: "Backend engineer 1",
    requisition: null,
    position: "Software Engineer",
    meaning: "proposed",
    months: 5,
    managed: true,
    site: "Kestrel Bay",
  },
  {
    name: "Payments tester",
    requisition: "REQ-2041",
    position: "Test Engineer",
    meaning: "open",
    months: 3,
    managed: true,
    site: "Northmere",
    level: "P2",
  },
  {
    name: null,
    requisition: "REQ-2042",
    position: "SDET",
    meaning: "open",
    months: 2,
    managed: true,
    level: "P3",
  },
  {
    name: "Backend engineer 2",
    requisition: null,
    position: "Software Engineer",
    meaning: "open",
    months: 1,
    managed: true,
    site: "Ashgrove",
    level: "P1",
  },
  {
    name: null,
    requisition: null,
    position: "Engineering Manager",
    meaning: "proposed",
    months: null,
    managed: false,
  },
  {
    name: null,
    requisition: "REQ-2047",
    position: "Software Engineer",
    meaning: "open",
    months: 2,
    managed: false,
  },
];

function hiresFor(
  people: readonly FictionalPerson[],
  reportingLines: readonly FictionalLine[],
  referenceDate: string,
): FictionalHire[] {
  const managerOf = new Map(
    reportingLines.map(({ personId, managerId }) => [personId, managerId]),
  );
  const current = (person: FictionalPerson) =>
    person.endDate === null &&
    person.startDate !== null &&
    person.startDate <= referenceDate;
  // The seed data's drafts change the first few people, so hires name only those after them.
  const named = people.slice(10);
  const managers = named.filter(
    (person) => person.isManager && current(person),
  );
  const reference = new Date(`${referenceDate}T00:00:00Z`);
  const due = (months: number) => {
    const target = new Date(reference);
    target.setUTCMonth(target.getUTCMonth() + months);
    return day(target);
  };
  let next = 0;
  const open = openings.map(
    (
      { position, months, managed, site, level, ...hire },
      index,
    ): FictionalHire => ({
      id: fictionalId(`planned-hire:${String(index)}`),
      ...hire,
      positionId: choice(positions, position),
      targetDate: months === null ? null : due(months),
      managerId: managed
        ? String(managers.at(next++ % managers.length)?.id)
        : null,
      filledBy: null,
      values: {
        ...(site === undefined
          ? {}
          : { [siteColumn.id]: [choice(sites, site)] }),
        ...(level === undefined
          ? {}
          : { [levelColumn.id]: [choice(levels, level)] }),
      },
    }),
  );
  // Someone who has not started yet, and someone current who manages no one, as an internal
  // transfer, each filling a hire under the manager they report to.
  const starter = named.find(
    (person) =>
      person.endDate === null &&
      person.startDate !== null &&
      person.startDate > referenceDate &&
      managerOf.has(person.id),
  );
  const transfer = named.find(
    (person) =>
      current(person) && !person.isManager && managerOf.has(person.id),
  );
  const filled = (
    [
      ["REQ-2036", starter, starter?.startDate ?? null],
      ["REQ-2031", transfer, due(-2)],
    ] as const
  ).flatMap(([requisition, person, targetDate], index): FictionalHire[] =>
    person === undefined
      ? []
      : [
          {
            id: fictionalId(`planned-hire:filled:${String(index)}`),
            name: null,
            requisition,
            positionId: person.positionId,
            meaning: "open",
            targetDate,
            // Both were found among those with a manager.
            managerId: String(managerOf.get(person.id)),
            filledBy: person.id,
            values: { ...person.values },
          },
        ],
  );
  return [...open, ...filled];
}

// A fictional organization of the given size: its lists, the columns on people drawing on them and
// a note column, and its people, current and former, and a few who start after the reference date,
// the newest with onboarding notes, with a few newcomers made after them, so making newcomers
// changes nothing else, and its planned hires.
export function fictionalOrganization({
  size,
  seed = 2026,
  referenceDate = "2026-11-01",
}: {
  size: number;
  seed?: number;
  referenceDate?: string;
}): FictionalOrganization {
  const faker = new Faker({ locale: [en, base], seed });
  const chooser = new Faker({ locale: [base], seed: seed + 1 });
  const namers = nameSources.map((source, index) => ({
    source,
    namer: new Faker({ locale: [...source.locale], seed: seed + 2 + index }),
  }));
  const pickName = () => {
    const { source, namer } = chooser.helpers.weightedArrayElement(
      namers.map((value) => ({ weight: value.source.weight, value })),
    );
    return name(namer, source.order);
  };
  const reference = new Date(`${referenceDate}T00:00:00Z`);
  const everyone = Array.from(
    { length: size + newcomerCount },
    (_, index): FictionalPerson => {
      const manager = faker.number.float() < 0.12;
      const position = manager
        ? "Engineering Manager"
        : faker.helpers.arrayElement([
            "Software Engineer",
            "Software Engineer",
            "Test Engineer",
            "SDET",
          ]);
      const level = manager
        ? faker.helpers.arrayElement(["M1", "M2", "M3", "M4", "M5"])
        : faker.helpers.weightedArrayElement([
            { weight: 1, value: "Co-op" },
            { weight: 3, value: "P1" },
            { weight: 5, value: "P2" },
            { weight: 5, value: "P3" },
            { weight: 3, value: "P4" },
            { weight: 1, value: "P5" },
          ]);
      const roll = faker.number.float();
      // Most are current; some have left, and a few start soon.
      const starting = roll < 0.04;
      const left = !starting && roll < 0.1;
      const start = starting
        ? faker.date.soon({ days: 120, refDate: reference })
        : faker.date.past({ years: 12, refDate: reference });
      const end = left
        ? faker.date.between({ from: start, to: reference })
        : null;
      const roles: string[] = [];
      if (faker.number.float() < 0.15) roles.push("Team Lead");
      if (faker.number.float() < 0.06) roles.push("Design Authority");
      return {
        id: fictionalId(`person:${String(index)}`),
        preferredName: pickName(),
        employeeId: `E${String(10001 + index)}`,
        positionId: choice(positions, position),
        startDate: day(start),
        endDate: end === null ? null : day(end),
        isManager: manager,
        values: {
          [siteColumn.id]: [
            choice(
              sites,
              faker.helpers.arrayElement(
                sites.choices.map(({ label }) => label),
              ),
            ),
          ],
          [levelColumn.id]: [choice(levels, level)],
          ...(roles.length > 0
            ? {
                [teamRoleColumn.id]: roles.map((label) =>
                  choice(teamRoles, label),
                ),
              }
            : {}),
        },
        notes: {},
      };
    },
  );
  const people = everyone.slice(0, size);
  const managerChoice = choice(positions, "Engineering Manager");
  // The last to leave was a manager, so someone who has left still has reports.
  const lastToLeave = people
    .filter(({ endDate }) => endDate !== null)
    .sort((a, b) => String(b.endDate).localeCompare(String(a.endDate)))[0];
  if (lastToLeave !== undefined) {
    lastToLeave.positionId = managerChoice;
    lastToLeave.values[levelColumn.id] = [choice(levels, "M1")];
    lastToLeave.isManager = true;
  }
  // The newest starters who have not left, each with a buddy who started before all of them: those
  // still to start have done nothing yet, and those who have started are further along the earlier
  // they started, the earliest done. A buddy is never the starter, so an organization too small for
  // every starter to have one gives notes to fewer.
  const current = people
    .filter(({ endDate }) => endDate === null)
    .sort((a, b) => String(b.startDate).localeCompare(String(a.startDate)));
  const starting = current
    .filter(({ startDate }) => String(startDate) > referenceDate)
    .slice(0, onboarding.starting);
  const started = current
    .filter(({ startDate }) => String(startDate) <= referenceDate)
    .slice(0, onboarding.started);
  const buddies = current.filter(
    (person) =>
      String(person.startDate) <= referenceDate && !started.includes(person),
  );
  const paired = [...starting, ...started].flatMap((person, index) => {
    const buddy = buddies.at(index);
    return buddy === undefined ? [] : [{ person, buddy }];
  });
  const begun = paired.filter(({ person }) => started.includes(person));
  const stepCount = onboardingSteps("").length;
  for (const { person, buddy } of paired) {
    const at = begun.findIndex((pair) => pair.person === person);
    person.notes[onboardingColumn.id] = onboardingNote(
      buddy.preferredName,
      at < 0 ? 0 : Math.ceil(((at + 1) * stepCount) / begun.length),
      at < 0 ? String(person.startDate) : null,
    );
  }
  const lines = reporting(
    people,
    (person) => person.positionId,
    managerChoice,
    seed,
    referenceDate,
  );
  return {
    lists: [sites, levels, teamRoles, certifications, languages],
    positions: positions.choices,
    columns: [siteColumn, levelColumn, teamRoleColumn, onboardingColumn],
    people,
    ...lines,
    newcomers: everyone.slice(size),
    hires: hiresFor(people, lines.reportingLines, referenceDate),
  };
}
