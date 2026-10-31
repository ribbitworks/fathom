// SPDX-License-Identifier: Apache-2.0

// Building blocks for fictional records, used by the seed data generator and test data. Everything is
// generated from a fixed seed and reference date, so the same records come out every time, with the
// same identifiers. Names are made up from names common in the countries the organization works in,
// so they look realistic without describing anyone real. No real company, site, or product names are
// used. A development-only package, never included in the runtime image.

import { base, en, en_CA, en_IN, Faker } from "@faker-js/faker";
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
}

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

// A fictional organization of the given size: its lists, the columns on people drawing on them, and
// its people, current and former, and a few who start after the reference date.
export function fictionalOrganization({
  size,
  seed = 2026,
  referenceDate = "2026-11-01",
}: {
  size: number;
  seed?: number;
  referenceDate?: string;
}): FictionalOrganization {
  const faker = new Faker({ locale: [en_CA, en_IN, en, base], seed });
  const reference = new Date(`${referenceDate}T00:00:00Z`);
  const people = Array.from({ length: size }, (_, index): FictionalPerson => {
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
      preferredName: `${faker.person.firstName()} ${faker.person.lastName()}`,
      employeeId: `E${String(10001 + index)}`,
      startDate: day(start),
      endDate: end === null ? null : day(end),
      values: {
        [siteColumn.id]: [
          choice(
            sites,
            faker.helpers.arrayElement(sites.choices.map(({ label }) => label)),
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
  });
  return {
    lists: [sites, positions, levels, teamRoles],
    columns: [siteColumn, positionColumn, levelColumn, teamRoleColumn],
    people,
  };
}
