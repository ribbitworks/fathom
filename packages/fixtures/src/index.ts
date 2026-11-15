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
import { addDays, addMonths, type Tier } from "@fathom/shared";
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
  visibility: Tier;
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

// A feature team: its name, lead, if any, colour, if any, and every record of people joining and
// leaving it, each from a day.
export interface FictionalFeatureTeam {
  id: string;
  name: string;
  leadId: string | null;
  colour: string | null;
  memberships: { personId: string; member: boolean; fromDate: string }[];
}

// A planned hire: named, if it has a name, and known by its requisition, or by a temporary ID the
// seed data gives it while it has none, in the first hiring state with its meaning, due on its
// target date, as YYYY-MM-DD, if it has one, filled by a person, when it is, and with choices in
// some of the columns it shares with people, by column. Its manager is a person or a planned hire
// marked as a manager.
export interface FictionalHire {
  id: string;
  name: string | null;
  requisition: string | null;
  positionId: string;
  meaning: "proposed" | "open";
  targetDate: string | null;
  managerId: string | null;
  isManager: boolean;
  filledBy: string | null;
  values: Record<string, string[]>;
}

export interface FictionalOrganization {
  // The day, as YYYY-MM-DD, its dates are worked out from, such as the day the seed data is added.
  referenceDate: string;
  lists: FictionalList[];
  // The choices the seed data adds to the built-in Positions list, which Fathom makes itself.
  positions: FictionalList["choices"];
  columns: FictionalColumn[];
  people: FictionalPerson[];
  // One current line for everyone but the person at the top and those no manager was employed for.
  reportingLines: FictionalLine[];
  // Names for about half the managers' teams; the rest have none.
  teams: FictionalTeam[];
  // Feature teams drawn from current people across managers' teams: some coloured, one with no
  // lead, someone on two teams, and someone who has left a team, so its history holds a past member.
  featureTeams: FictionalFeatureTeam[];
  // People made like the rest but not added, for drafts that add them.
  newcomers: FictionalPerson[];
  // Planned hires in each state, with requisitions and temporary IDs, most under current managers,
  // and one filled by someone who has not started yet, and one by an internal transfer.
  hires: FictionalHire[];
}

// How many newcomers an organization has.
export const newcomerCount = 2;

function list(
  key: string,
  name: string,
  labels: string[],
  visibility: Tier = "general",
): FictionalList {
  return {
    id: fictionalId(`list:${key}`),
    name,
    visibility,
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
// A Personal list, so a list, its column and its values in a class beyond General are seeded.
const workPatterns = list(
  "work-patterns",
  "Work patterns",
  ["Full time", "Part time", "Compressed hours"],
  "personal",
);

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
const workPatternColumn = column("work-pattern", "Work pattern", workPatterns);

// Most work full time; a few part time or compressed hours. Picked by a person's place rather than
// at random, so adding the column changes nothing else the seed makes.
const partTime = { every: 9, from: 4 };
const compressedHours = { every: 13, from: 7 };
const workPatternOf = (index: number): string =>
  index % partTime.every === partTime.from
    ? "Part time"
    : index % compressedHours.every === compressedHours.from
      ? "Compressed hours"
      : "Full time";
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

// The handbook the starter furthest along keeps in their onboarding note, a few pages long, so a
// long note shows folded in their details.
export const starterHandbook = [
  "## Starter handbook",
  "",
  "These are the notes kept through the first weeks, so the next starter can pick them up. Each section is short on its own; together they cover what comes up most often.",
  "",
  "### The first day",
  "",
  "Arrive by half past nine. The team meets by the windows on the third floor, and the first hour goes on getting into the laptop and the accounts it needs. Bring identification for the building pass; the pass desk closes at noon.",
  "",
  "- Sign in to the laptop and change the password it came with",
  "- Join the team's chat channels and the shared calendar",
  "- Read the team's working agreement, which takes about twenty minutes",
  "- Book a short call with the buddy for the end of the day",
  "",
  "Lunch on the first day is with the whole team. Nobody expects any real work before the afternoon, and most of the afternoon goes on reading.",
  "",
  "### The first week",
  "",
  "The first week is for reading and asking. Every question is a good one, and the buddy answers or knows who can. Keep a list of anything that surprised you; the team uses it to improve this handbook.",
  "",
  "- Read the architecture overview and the decisions behind it",
  "- Build the product on the laptop, and run its tests",
  "- Pair with the buddy on a small change, from the first line to its review",
  "- Sit in on the planning meeting and the review at the end of the week",
  "- Write down three things that could be clearer, and share them",
  "",
  "By Friday, the aim is to have made one small change and to know where to look for help.",
  "",
  "### How the team works",
  "",
  "The team plans in two-week cycles. Each cycle starts with planning on a Monday and ends with a review and a short look back on the second Friday. Work is picked from the top of the backlog, and anything urgent is talked about in the morning stand-up before it is started.",
  "",
  "- **Stand-up:** fifteen minutes at ten, standing or on a call",
  "- **Reviews:** every change is read by someone else before it merges",
  "- **Pairing:** encouraged for anything new or tricky, and for the first month",
  "- **Focus time:** no meetings on Wednesday afternoons",
  "",
  "Questions about priorities go to the team lead. Questions about the product go to its product manager, who sits with the team two days a week.",
  "",
  "### Tools to learn",
  "",
  "Most of the tools are the usual ones, set up the team's way. Learn them in this order, since each builds on the last.",
  "",
  "- The editor and the shared settings for it",
  "- Version control, and the branch and review rules",
  "- The build and its tests, and how to run one test alone",
  "- The issue tracker, and the labels the team uses",
  "- The dashboards that show how the product is doing",
  "",
  "### On call",
  "",
  "Nobody goes on call alone in their first three months. After the first month, shadow two shifts, then take one with the buddy as a second. The runbooks are kept beside the code, and each alert links to the one it needs.",
  "",
  "- [x] Read the runbooks for the three busiest alerts",
  "- [x] Shadow a weekday shift",
  "- [ ] Shadow a weekend shift",
  "- [ ] Take a shift with the buddy as second",
  "",
  "### The first month",
  "",
  "By the end of the first month, the aim is to work on the team's usual changes without help, to have reviewed others' changes, and to have taken part in a planning meeting with ideas of one's own.",
  "",
  "- [x] Merge a change that users see",
  "- [x] Review three changes by others",
  "- [ ] Lead the demonstration at a review",
  "- [ ] Suggest an improvement to this handbook",
  "",
  "### People to meet",
  "",
  "Besides the team, a few people are worth meeting early, each for half an hour. The buddy can set up the meetings.",
  "",
  "- The product manager, about where the product is heading",
  "- The designer, about how screens are decided and checked",
  "- Someone from support, about what users ask most",
  "- The team lead of the neighbouring team, about the work the two teams share",
  "",
  "### Where things are",
  "",
  "The kitchen is at the end of the corridor, and the quiet room beside it can be booked for calls. Printers are on every floor. The first-aid kit is in the kitchen, and the fire exits are marked at both ends of the floor.",
  "",
  "### Common questions",
  "",
  "**When are changes released?** At the end of each cycle, after the review. Small fixes can go out between cycles once the team lead agrees, and the release notes say what went out and why.",
  "",
  "**What if a review takes a long time?** Mention it at stand-up. Reviews are meant to be done within a working day, and anyone on the team may pick one up, not only the person asked.",
  "",
  "**How much should a change hold?** As little as makes sense on its own. A change that can be read in ten minutes gets a better review than one that takes an hour, and it is easier to undo.",
  "",
  "**Who decides what goes in a cycle?** The team, at planning, from the backlog the product manager keeps in order. Anyone may suggest moving something up, with a reason.",
  "",
  "**What happens when something breaks?** Whoever notices says so in the team's channel straight away. The person on call leads, others help where asked, and a short write-up follows within the week, without blame.",
  "",
  "**Where do ideas go?** Into the backlog, as a short description of the problem rather than a solution. The product manager looks at new ideas every week and talks about them at planning.",
  "",
  "**How is time off booked?** In the shared calendar, as early as possible, and mentioned at planning if it falls in the cycle. Cover for on call is swapped with someone on the rota and noted in the calendar too.",
  "",
  "### Habits that help",
  "",
  "- Write down what you learn the day you learn it",
  "- Ask early rather than late; an hour stuck is long enough",
  "- Leave the code a little clearer than you found it",
  "- Say what you are working on, so nobody does it twice",
  "- Take the breaks; the work is better for them",
  "",
  "### Looking back",
  "",
  "At the end of the third month, the starter and their manager look back together: what went well, what was hard, and what to change for the next starter. Add what you learn here, so the handbook keeps getting better.",
].join("\n");

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
// target date, under the current managers in turn, but for those with none and those under a
// planned manager, named by its key, which comes earlier in the list, and with a site and level
// where decided. Invented requisitions.
const openings: readonly {
  name: string | null;
  requisition: string | null;
  position: string;
  meaning: FictionalHire["meaning"];
  months: number | null;
  managed: boolean;
  // A place among the current managers instead of the next turn, so a later hire keeps off a manager
  // the manual tests count reports or Capacity rows for.
  managerPlace?: number;
  key?: string;
  managedBy?: string;
  isManager?: boolean;
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
    key: "planned-manager",
    isManager: true,
  },
  {
    name: null,
    requisition: "REQ-2047",
    position: "Software Engineer",
    meaning: "open",
    months: 2,
    managed: false,
  },
  {
    name: "Platform engineer",
    requisition: null,
    position: "Software Engineer",
    meaning: "proposed",
    months: 6,
    managed: false,
    managedBy: "planned-manager",
  },
  {
    name: null,
    requisition: null,
    position: "SDET",
    meaning: "proposed",
    months: null,
    managed: false,
    managedBy: "planned-manager",
  },
  {
    name: "Data engineer",
    requisition: "REQ-2053",
    position: "Software Engineer",
    meaning: "open",
    months: -1,
    managed: true,
    managerPlace: 5,
    level: "P2",
  },
  {
    name: "Mobile developer",
    requisition: "REQ-2055",
    position: "Software Engineer",
    meaning: "proposed",
    months: 4,
    managed: true,
    managerPlace: 6,
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
  const due = (months: number) => addMonths(referenceDate, months);
  let next = 0;
  const openingId = (index: number) =>
    fictionalId(`planned-hire:${String(index)}`);
  const managerOfOpening = (
    managed: boolean,
    managedBy?: string,
    managerPlace?: number,
  ) => {
    if (managedBy !== undefined) {
      return openingId(openings.findIndex(({ key }) => key === managedBy));
    }
    if (!managed || managers.length === 0) return null;
    const place = managerPlace ?? next++;
    return String(managers.at(place % managers.length)?.id);
  };
  const open = openings.map(
    (
      {
        name,
        requisition,
        meaning,
        position,
        months,
        managed,
        managedBy,
        managerPlace,
        isManager,
        site,
        level,
      },
      index,
    ): FictionalHire => ({
      id: openingId(index),
      name,
      requisition,
      meaning,
      positionId: choice(positions, position),
      targetDate: months === null ? null : due(months),
      managerId: managerOfOpening(managed, managedBy, managerPlace),
      isManager: isManager ?? false,
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
            isManager: false,
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
          [workPatternColumn.id]: [choice(workPatterns, workPatternOf(index))],
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
    const note = onboardingNote(
      buddy.preferredName,
      at < 0 ? 0 : Math.ceil(((at + 1) * stepCount) / begun.length),
      at < 0 ? String(person.startDate) : null,
    );
    // The starter furthest along, the last of those begun, keeps the handbook too.
    person.notes[onboardingColumn.id] =
      person === begun.at(-1)?.person ? `${note}\n\n${starterHandbook}` : note;
  }
  const lines = reporting(
    people,
    (person) => person.positionId,
    managerChoice,
    seed,
    referenceDate,
  );
  const hires = hiresFor(people, lines.reportingLines, referenceDate);
  const featureTeams = featureTeamsFor(people, referenceDate);
  setLeaving(people, hires, featureTeams, referenceDate);
  return {
    referenceDate,
    lists: [sites, levels, teamRoles, certifications, languages, workPatterns],
    positions: positions.choices,
    columns: [
      siteColumn,
      levelColumn,
      teamRoleColumn,
      onboardingColumn,
      workPatternColumn,
    ],
    people,
    ...lines,
    newcomers: everyone.slice(size),
    hires,
    featureTeams,
  };
}

// The seed data's drafts and tests name the first people, so what is added later changes only those
// after them.
export const firstUnnamed = 12;

// How many days after the reference date each of those leaving soon leaves: one within the month,
// one later.
export const leavingInDays = [12, 45] as const;

const featureTeamMembers = (featureTeams: readonly FictionalFeatureTeam[]) =>
  new Set(
    featureTeams.flatMap(({ memberships }) =>
      memberships.map(({ personId }) => personId),
    ),
  );

// The latest person current on the reference date on no feature team, whom a seed draft adds to one.
export const lastOnNoTeam = (
  people: readonly FictionalPerson[],
  featureTeams: readonly FictionalFeatureTeam[],
  referenceDate: string,
): FictionalPerson | undefined => {
  const onTeams = featureTeamMembers(featureTeams);
  return people.findLast(
    ({ id, startDate, endDate }) =>
      !onTeams.has(id) &&
      endDate === null &&
      String(startDate) <= referenceDate,
  );
};

// Set last, on people nothing else picks, since everything worked out above, and the seed data's
// own picks, read an end date as having left.
function setLeaving(
  people: readonly FictionalPerson[],
  hires: readonly FictionalHire[],
  featureTeams: readonly FictionalFeatureTeam[],
  referenceDate: string,
): void {
  const onTeams = featureTeamMembers(featureTeams);
  const filling = new Set(hires.map(({ filledBy }) => filledBy));
  const notes = people.flatMap(({ notes }) => Object.values(notes)).join("\n");
  const joining = lastOnNoTeam(people, featureTeams, referenceDate);
  const leaving = people
    .slice(firstUnnamed)
    .filter(
      (person) =>
        person !== joining &&
        person.endDate === null &&
        person.startDate !== null &&
        person.startDate <= referenceDate &&
        !person.isManager &&
        Object.keys(person.notes).length === 0 &&
        !notes.includes(`**${person.preferredName}**`) &&
        !onTeams.has(person.id) &&
        !filling.has(person.id),
    )
    .slice(-leavingInDays.length);
  leavingInDays.forEach((days, at) => {
    const person = leaving.at(at);
    if (person !== undefined) person.endDate = addDays(referenceDate, days);
  });
}

// The feature teams, as the organization's feature teams list says, from people current on the
// reference date, oldest starters first, so the same people lead them on every run.
const featureTeamJoinedDaysAgo = 300;
const featureTeamLeftDaysAgo = 153;

const featureTeamPlans: readonly {
  name: string;
  colour: string | null;
  size: number;
  lead: boolean;
}[] = [
  { name: "Payments core", colour: "teal", size: 5, lead: true },
  { name: "Search", colour: "indigo", size: 4, lead: true },
  { name: "Platform reliability", colour: null, size: 3, lead: false },
  { name: "Mobile apps", colour: "orange", size: 4, lead: true },
];

function featureTeamsFor(
  people: readonly FictionalPerson[],
  referenceDate: string,
): FictionalFeatureTeam[] {
  const current = people
    .filter(
      ({ startDate, endDate }) =>
        String(startDate) <= referenceDate && endDate === null,
    )
    .sort((a, b) => String(a.startDate).localeCompare(String(b.startDate)));
  const joined = addDays(referenceDate, -featureTeamJoinedDaysAgo);
  let next = 0;
  return featureTeamPlans.map((plan, index) => {
    const members = current.slice(next, next + plan.size);
    next += plan.size - (index === 0 ? 1 : 0);
    const memberships = members.map(({ id, startDate }) => ({
      personId: id,
      member: true,
      fromDate: String(startDate) > joined ? String(startDate) : joined,
    }));
    // The last team had one more member, who left it.
    const leaver = current.at(next + plan.size);
    if (index === featureTeamPlans.length - 1 && leaver !== undefined) {
      memberships.push(
        { personId: leaver.id, member: true, fromDate: joined },
        {
          personId: leaver.id,
          member: false,
          fromDate: addDays(referenceDate, -featureTeamLeftDaysAgo),
        },
      );
    }
    return {
      id: fictionalId(`feature-team:${plan.name}`),
      name: plan.name,
      leadId: plan.lead ? (members[0]?.id ?? null) : null,
      colour: plan.colour,
      memberships,
    };
  });
}
