// SPDX-License-Identifier: Apache-2.0

// What each API route needs, and the fictional requests the permission tests send to them.

import {
  type Permission,
  planningSettingsId,
  type ViewTable,
} from "@fathom/shared";
import { randomUUID } from "node:crypto";
import { type Method, unique } from "./test-app.ts";

export type Needs =
  | { kind: "open" }
  | { kind: "signed-in" }
  // Every permission in all, and at least one of each group in any.
  | {
      kind: "permissions";
      all: readonly Permission[];
      any: readonly (readonly Permission[])[];
    };

export interface Route {
  method: Method;
  pattern: string;
  needs: Needs;
  // What the request asks for, for a route whose needs depend on it.
  variant?: string;
  // The URL to send to, when the pattern's parameters cannot all be random identifiers.
  url?: string;
  body?: () => object;
}

export const open: Needs = { kind: "open" };
export const signedIn: Needs = { kind: "signed-in" };
export const allOf = (...all: Permission[]): Needs => ({
  kind: "permissions",
  all,
  any: [],
});
export const anyOf = (...any: Permission[]): Needs => ({
  kind: "permissions",
  all: [],
  any: [any],
});
// Those who change schedules and their cycles: those who edit the plan or planning configuration,
// who see them.
export const changingSchedules: Needs = {
  kind: "permissions",
  all: [],
  any: [
    ["plan:edit", "configuration:edit"],
    ["features:view", "configuration:view"],
  ],
};

// What opens each table's page, and so its views.
export const viewTableNeeds: Record<ViewTable, Needs> = {
  people: allOf("people:view"),
  features: allOf("features:view"),
  projects: allOf("plan:view"),
  proposals: allOf("plan:view"),
  customers: allOf("plan:view"),
  milestones: allOf("plan:view"),
  releases: anyOf("features:view", "configuration:view"),
  cycles: anyOf("features:view", "configuration:view"),
  "release-streams": anyOf("features:view", "configuration:view"),
  lists: allOf("configuration:view"),
  // Feature teams' start and end dates, past managers, and team dates are Personal.
  "feature-assignments": allOf("feature-teams:view", "personal:view"),
  capacity: allOf(
    "allocations:view",
    "feature-teams:view",
    "people:view",
    "personal:view",
  ),
  "org-chart": allOf("people:view"),
  drafts: anyOf(
    "people:view",
    "configuration:view",
    "plan:view",
    "features:view",
  ),
  accounts: allOf("administration:view"),
};

// The role a new account is given, which must exist, read once the server has started.
// The Team Member role's identifier, which adding an account names, read once the server starts.
export let teamMember = "";

export function setTeamMember(id: string): void {
  teamMember = id;
}

export const id = () => randomUUID();
export const named = () => ({ name: unique("Fictional Name") });
export const retired = () => ({ retired: true });
export const first = () => ({ after: null });
export const rejected = (asked: object) => ({
  ...asked,
  reason: "Fictional reason",
});
export const pattern = () => ({
  startsOn: "2027-01-04",
  length: 2,
  unit: "weeks",
  naming: "Fictional Cycle",
});
export const release = () => ({
  name: unique("Fictional Release"),
  firstCycle: "2027-01-04",
  lastCycle: "2027-01-04",
});
export const milestone = () => ({
  name: unique("Fictional Milestone"),
  date: "2027-01-04",
});
export const role = () => ({
  name: unique("Fictional Role"),
  description: "",
  permissions: [],
});

// The kinds of drafts an Approver decides, each with its area's Approve permission and what seeing it
// needs.
export const draftKinds: {
  variant: string;
  needs: Needs;
  asked: () => object;
}[] = [
  {
    variant: "people",
    needs: allOf("people:approve", "people:view"),
    asked: () => ({ people: [id()] }),
  },
  {
    // Only those who also see the hiring plan see hires' drafts; others are told they are gone.
    variant: "planned hires",
    needs: allOf("hiring-plan:approve", "people:view"),
    asked: () => ({ plannedHires: [id()] }),
  },
  {
    // Feature teams' drafts are seen with people.
    variant: "feature teams",
    needs: allOf("feature-teams:approve", "feature-teams:view", "people:view"),
    asked: () => ({ featureTeams: [id()] }),
  },
  ...[
    { variant: "lists", asked: () => ({ lists: [id()] }) },
    { variant: "choices", asked: () => ({ choices: [id()] }) },
    { variant: "orders of choices", asked: () => ({ orders: [id()] }) },
  ].map((kind) => ({
    ...kind,
    // A list's values are people's details, so deciding one needs sight of people.
    needs: allOf("configuration:approve", "people:view"),
  })),
  {
    variant: "columns",
    needs: allOf("configuration:approve", "people:view"),
    asked: () => ({ columns: [id()] }),
  },
  {
    // Releases are seen with features and releases, not with planning configuration.
    variant: "records",
    needs: allOf("features:approve", "features:view"),
    asked: () => ({ records: [{ type: "release", id: id() }] }),
  },
  ...[
    { variant: "schedules", type: "release-stream" },
    { variant: "cycle patterns", type: "cycle-pattern" },
  ].map(({ variant, type }) => ({
    variant,
    // Schedules and their cycles are part of the plan and of planning configuration, either of whose
    // Approvers decides them, and are seen with features and releases, and with planning
    // configuration.
    needs: {
      kind: "permissions",
      all: [],
      any: [
        ["plan:approve", "configuration:approve"],
        ["features:view", "configuration:view"],
      ],
    } as const,
    asked: () => ({ records: [{ type, id: id() }] }),
  })),
  {
    // Projects and features are seen with the plan.
    variant: "plan records",
    needs: allOf("plan:approve", "plan:view"),
    asked: () => ({ records: [{ type: "project", id: id() }] }),
  },
  {
    variant: "allocations",
    needs: allOf("allocations:approve", "allocations:view", "personal:view"),
    asked: () => ({ records: [{ type: "allocation", id: id() }] }),
  },
  {
    variant: "planning settings",
    needs: allOf("configuration:approve", "configuration:view"),
    asked: () => ({
      records: [{ type: "planning-settings", id: planningSettingsId }],
    }),
  },
];

// Those who edit feature teams change them, seeing people.
export const changingTeams = allOf("people:view", "feature-teams:edit");

// Who may discard and resend drafts of each kind of the plan's records.
export const recordKinds: { type: string; needs: Needs; recordId?: string }[] =
  [
    { type: "release-stream", needs: changingSchedules },
    { type: "cycle-pattern", needs: changingSchedules },
    { type: "release", needs: allOf("features:edit") },
    { type: "feature", needs: allOf("features:edit") },
    { type: "customer", needs: allOf("plan:edit") },
    { type: "proposal", needs: allOf("plan:edit") },
    { type: "project", needs: allOf("plan:edit") },
    { type: "milestone", needs: allOf("plan:edit") },
    { type: "allocation", needs: allOf("allocations:edit", "personal:view") },
    {
      type: "planning-settings",
      needs: allOf("configuration:edit"),
      recordId: planningSettingsId,
    },
  ];

// Every API route, with what it needs. The web routes are left out: the test app serves no front
// end, so registers none.
