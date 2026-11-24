// SPDX-License-Identifier: Apache-2.0

// The fictional organization's lists, the columns on people drawing on them, and its note column.

import type { Tier } from "@fathom/shared";
import { fictionalId } from "./fictional-id.ts";
import type { FictionalColumn, FictionalList } from "./types.ts";

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
export const sites = list("sites", "Sites", [
  "Kestrel Bay",
  "Northmere",
  "Ashgrove",
  "Corran Quay",
]);
// The choices of the built-in Positions list. Architect is never given to anyone, so the seed data
// can draft removing a choice no one has.
export const positions = list("positions", "Positions", [
  "Software Engineer",
  "Test Engineer",
  "SDET",
  "Engineering Manager",
  "Architect",
]);
export const levels = list("levels", "Levels", [
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
export const teamRoles = list("team-roles", "Roles on the team", [
  "Team Lead",
  "Design Authority",
]);
// Lists no column draws on, so the seed data can draft removing one and retiring the other.
export const certifications = list("certifications", "Certifications", [
  "Fictional Cloud Practitioner",
  "Fictional Test Analyst",
]);
export const languages = list("languages", "Languages", ["English", "French"]);
// A Personal list, so a list, its column and its values in a class beyond General are seeded.
export const workPatterns = list(
  "work-patterns",
  "Work patterns",
  ["Full time", "Part time", "Compressed hours"],
  "personal",
);

// Confidential lists, so a list, its column and its values in the narrowest class are seeded.
export const compensationBands = list(
  "compensation-bands",
  "Compensation bands",
  ["Band 1", "Band 2", "Band 3", "Band 4", "Band 5", "Band 6"],
  "confidential",
);
export const performanceRatings = list(
  "performance-ratings",
  "Performance ratings",
  ["Exceeds", "Meets", "Developing", "Too early"],
  "confidential",
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

export const siteColumn = column("site", "Site", sites);
export const levelColumn = column("level", "Level", levels);
export const teamRoleColumn = column(
  "team-role",
  "Role on team",
  teamRoles,
  true,
);
export const workPatternColumn = column(
  "work-pattern",
  "Work pattern",
  workPatterns,
);
export const compensationColumn = column(
  "compensation-band",
  "Compensation band",
  compensationBands,
);
export const ratingColumn = column(
  "performance-rating",
  "Performance rating",
  performanceRatings,
);

export const onboardingColumn: FictionalColumn = {
  id: fictionalId("column:onboarding"),
  name: "Onboarding",
  type: "note",
  listId: null,
  visibility: "general",
  multiple: false,
};

// The choice in a list with the given label, which the lists above always have.
export function choice(from: FictionalList, label: string): string {
  return (
    from.choices.find((option) => option.label === label) as {
      id: string;
    }
  ).id;
}
