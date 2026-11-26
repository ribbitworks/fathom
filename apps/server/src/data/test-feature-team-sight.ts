// SPDX-License-Identifier: Apache-2.0

// Fictional people, planned hires, roles and drafts for the unit tests of what a reader sees of a
// feature team and its draft.

import {
  type ClassAccess,
  defaultClasses,
  type Permission,
  startingRoles,
  withImplied,
} from "@fathom/shared";
import type { Draft } from "./draft-records.ts";
import type { Everyone, Member } from "./feature-team-rules.ts";
import { plannedHire, someone } from "./test-feature-team-people.ts";

export const today = "2026-06-15";
export const lead = "person-lead";
export const member = "person-member";
export const starter = "person-starter";
export const leaver = "person-leaver";
export const unknown = "person-unknown";
export const hire = "hire-open";

export const everyone: Everyone = new Map<string, Member>([
  [hire, plannedHire({ preferredName: "Fictional Hire" })],
  [lead, someone({ preferredName: "Fictional Lead" })],
  [member, someone({ preferredName: "Fictional Member" })],
  [
    starter,
    someone({
      preferredName: "Fictional Starter",
      startDate: "2099-01-01",
      started: false,
    }),
  ],
  [
    leaver,
    someone({
      preferredName: "Fictional Leaver",
      endDate: "2021-06-30",
      left: true,
    }),
  ],
]);

const roleOf = (
  permissions: readonly Permission[],
  dataClasses = defaultClasses,
): ClassAccess => ({ permissions: withImplied(permissions), dataClasses });

// Sees people, and Personal and Confidential data.
export const workforceAdministrator = roleOf(
  startingRoles["workforce-administrator"].permissions,
);
// Sees people and feature teams, but not Personal data.
export const teamMember = roleOf(startingRoles["team-member"].permissions);
// Sees feature teams and Personal data, but not people.
export const chartOnly = roleOf(["feature-teams:view", "personal:view"]);
// Sees Personal data but not Confidential data, so not future reorganizations.
export const personalOnly = roleOf(
  startingRoles["engineering-manager"].permissions.filter(
    (permission) => permission !== "confidential:view",
  ),
);
// Sees people but not Personal data, with the days members join in General.
export const teamMemberSeeingDays = roleOf(
  startingRoles["team-member"].permissions,
  {
    ...defaultClasses,
    featureTeamDates: "general",
  },
);
// Sees Personal data but not Confidential data, with the days members join in Confidential.
export const personalOnlyWithConfidentialDays = roleOf(
  personalOnly.permissions,
  {
    ...defaultClasses,
    featureTeamDates: "confidential",
  },
);

export const draftOf = (
  fields: Record<string, unknown>,
  details: Partial<Draft> = {},
): Draft => ({
  action: "changed",
  fields,
  state: "waiting",
  reason: null,
  sequence: 1,
  ...details,
});
