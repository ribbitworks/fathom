// SPDX-License-Identifier: Apache-2.0

// Builds a fictional organization of a given size: its people, with their values and notes, and
// everything worked out from them.

import { base, en, Faker } from "@faker-js/faker";
import { featureTeamsFor, growFeatureTeams } from "./feature-teams.ts";
import { fictionalId } from "./fictional-id.ts";
import { setLeaving } from "./leaving.ts";
import {
  certifications,
  choice,
  compensationBands,
  compensationColumn,
  languages,
  levelColumn,
  levels,
  onboardingColumn,
  performanceRatings,
  positions,
  ratingColumn,
  siteColumn,
  sites,
  teamRoleColumn,
  teamRoles,
  workPatternColumn,
  workPatterns,
} from "./lists.ts";
import { name, nameSources } from "./names.ts";
import { addOnboardingNotes } from "./onboarding.ts";
import { setConfidential, workPatternOf } from "./person-values.ts";
import { hiresFor } from "./planned-hires.ts";
import { reporting } from "./reporting.ts";
import type { FictionalOrganization, FictionalPerson } from "./types.ts";

// How many newcomers an organization has.
export const newcomerCount = 2;

const day = (date: Date) => date.toISOString().slice(0, 10);

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
  setConfidential(everyone, referenceDate);
  addOnboardingNotes(people, referenceDate);
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
  growFeatureTeams(people, hires, featureTeams, referenceDate);
  return {
    referenceDate,
    lists: [
      sites,
      levels,
      teamRoles,
      certifications,
      languages,
      workPatterns,
      compensationBands,
      performanceRatings,
    ],
    positions: positions.choices,
    columns: [
      siteColumn,
      levelColumn,
      teamRoleColumn,
      onboardingColumn,
      workPatternColumn,
      compensationColumn,
      ratingColumn,
    ],
    people,
    ...lines,
    newcomers: everyone.slice(size),
    hires,
    featureTeams,
  };
}
