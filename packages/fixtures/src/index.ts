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

export interface FictionalColumn {
  id: string;
  name: string;
  listId: string;
  multiple: boolean;
}

export interface FictionalPerson {
  id: string;
  preferredName: string;
  employeeId: string;
  // As YYYY-MM-DD, or null when not set.
  startDate: string | null;
  endDate: string | null;
  // The chosen choices of each column, by column.
  values: Record<string, string[]>;
}

export interface FictionalOrganization {
  lists: FictionalList[];
  columns: FictionalColumn[];
  people: FictionalPerson[];
  // People made like the rest but not added, for drafts that add them.
  newcomers: FictionalPerson[];
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
const positions = list("positions", "Positions", [
  "Software Engineer",
  "Test Engineer",
  "SDET",
  "Manager",
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

function column(
  key: string,
  name: string,
  from: FictionalList,
  multiple = false,
): FictionalColumn {
  return { id: fictionalId(`column:${key}`), name, listId: from.id, multiple };
}

const siteColumn = column("site", "Site", sites);
const positionColumn = column("position", "Position", positions);
const levelColumn = column("level", "Level", levels);
const teamRoleColumn = column("team-role", "Role on team", teamRoles, true);

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

// A fictional organization of the given size: its lists, the columns on people drawing on them, and
// its people, current and former, and a few who start after the reference date, with a few
// newcomers made after them, so making newcomers changes nothing else.
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
        ? "Manager"
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
        startDate: day(start),
        endDate: end === null ? null : day(end),
        values: {
          [siteColumn.id]: [
            choice(
              sites,
              faker.helpers.arrayElement(
                sites.choices.map(({ label }) => label),
              ),
            ),
          ],
          [positionColumn.id]: [choice(positions, position)],
          [levelColumn.id]: [choice(levels, level)],
          ...(roles.length > 0
            ? {
                [teamRoleColumn.id]: roles.map((label) =>
                  choice(teamRoles, label),
                ),
              }
            : {}),
        },
      };
    },
  );
  return {
    lists: [sites, positions, levels, teamRoles],
    columns: [siteColumn, positionColumn, levelColumn, teamRoleColumn],
    people: everyone.slice(0, size),
    newcomers: everyone.slice(size),
  };
}
