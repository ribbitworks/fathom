// SPDX-License-Identifier: Apache-2.0

// Tests that every API route enforces what it needs, against a migrated PostgreSQL server: a table
// of every route, with whether it is open, open to any signed-in account, or needs some
// permissions, checked against the routes the server registers, so a new route fails until it is
// listed; and, for each route, that a signed-out request is refused, that an account holding every
// permission but those needed is refused, that one holding every permission is refused while it
// must change a password Fathom generated, and that one holding only those needed is not. A route
// on a record is sent a random ID, so its allowed request is not found: it proves the checks made
// before the record is read, and checks that depend on the record, such as its tier, are left to
// each feature's own tests.

import {
  changeHistoryViews,
  defaultPasswordSettings,
  defaultTimeZone,
  impliedPermissions,
  type Permission,
  permissionSchema,
  startingPlanningSettings,
} from "@fathom/shared";
import { users } from "@fathom/db";
import { eq } from "drizzle-orm";
import type * as Fastify from "fastify";
import type { FastifyInstance } from "fastify";
import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import {
  type Method,
  startTestApp,
  type TestApp,
  testPosition,
} from "./test-app.ts";
import { findStartingRole } from "./data/roles.ts";

// Every method and URL pattern the server registers, recorded by each Fastify instance the server
// creates, since Fastify offers no list of its routes but a printed tree.
const registered = vi.hoisted(() => new Set<string>());

vi.mock("fastify", async (importOriginal) => {
  const fastify = await importOriginal<typeof Fastify>();
  const create = fastify.default as (...options: unknown[]) => FastifyInstance;
  return {
    ...fastify,
    default: (...options: unknown[]) => {
      const app = create(...options);
      app.addHook("onRoute", ({ method, url }) => {
        for (const each of [method].flat()) registered.add(`${each} ${url}`);
      });
      return app;
    },
  };
});

type Needs =
  | { kind: "open" }
  | { kind: "signed-in" }
  // Every permission in all, and, when any names some, at least one of them.
  | {
      kind: "permissions";
      all: readonly Permission[];
      any: readonly Permission[];
    };

interface Route {
  method: Method;
  pattern: string;
  needs: Needs;
  // What the request asks for, for a route whose needs depend on it.
  variant?: string;
  // The URL to send to, when the pattern's parameters cannot all be random identifiers.
  url?: string;
  body?: () => object;
}

const open: Needs = { kind: "open" };
const signedIn: Needs = { kind: "signed-in" };
const allOf = (...all: Permission[]): Needs => ({
  kind: "permissions",
  all,
  any: [],
});
const anyOf = (...any: Permission[]): Needs => ({
  kind: "permissions",
  all: [],
  any,
});

let count = 0;
// The role a new account is given, which must exist, read once the server has started.
let teamMember = "";

// A name no other request uses, so requests that create something never collide.
function unique(prefix: string): string {
  count += 1;
  return `${prefix} ${String(count)}`;
}

const id = () => randomUUID();
const named = () => ({ name: unique("Fictional Name") });
const retired = () => ({ retired: true });
const first = () => ({ after: null });
const rejected = (asked: object) => ({
  ...asked,
  reason: "Fictional reason",
});
const pattern = () => ({
  startsOn: "2027-01-04",
  length: 2,
  unit: "weeks",
  naming: "Fictional Cycle",
});
const release = () => ({
  name: unique("Fictional Release"),
  firstCycle: "2027-01-04",
  lastCycle: "2027-01-04",
});
const milestone = () => ({
  name: unique("Fictional Milestone"),
  date: "2027-01-04",
});
const role = () => ({
  name: unique("Fictional Role"),
  description: "",
  permissions: [],
});

// The kinds of drafts an Approver decides, each with its area's Approve permission and what seeing it
// needs.
const draftKinds: { variant: string; needs: Needs; asked: () => object }[] = [
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
    // Lists are seen with configuration, and with people, whose columns draw on them.
    needs: {
      kind: "permissions",
      all: ["configuration:approve"],
      any: ["configuration:view", "people:view"],
    } as const,
  })),
  {
    variant: "columns",
    needs: allOf("configuration:approve", "people:view"),
    asked: () => ({ columns: [id()] }),
  },
  {
    // Releases are seen with features and releases, or with planning configuration.
    variant: "records",
    needs: {
      kind: "permissions",
      all: ["features:approve"],
      any: ["features:view", "configuration:view"],
    },
    asked: () => ({ records: [{ type: "release", id: id() }] }),
  },
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
];

// Those who edit feature teams change them, seeing people.
const changingTeams = allOf("people:view", "feature-teams:edit");

// Who may discard and resend drafts of each kind of the plan's records.
const recordKinds: { type: string; needs: Needs }[] = [
  { type: "release-stream", needs: allOf("configuration:edit") },
  { type: "cycle-pattern", needs: allOf("configuration:edit") },
  { type: "release", needs: allOf("features:edit") },
  { type: "feature", needs: allOf("features:edit") },
  { type: "customer", needs: allOf("plan:edit") },
  { type: "proposal", needs: allOf("plan:edit") },
  { type: "project", needs: allOf("plan:edit") },
  { type: "milestone", needs: allOf("plan:edit") },
  { type: "allocation", needs: allOf("allocations:edit") },
];

// Every API route, with what it needs. The web routes are left out: the test app serves no front
// end, so registers none.
const routes: Route[] = [
  { method: "POST", pattern: "/api/auth/sign-in/email", needs: open },
  // Open to the sign-in check; Better Auth itself needs the current password and a session.
  { method: "POST", pattern: "/api/auth/change-password", needs: open },
  { method: "POST", pattern: "/api/auth/sign-out", needs: open },
  { method: "GET", pattern: "/api/auth/get-session", needs: open },
  // Answers who is signed in, or that no one is.
  { method: "GET", pattern: "/api/session", needs: open },
  // Each user switches among their own roles; a random one is not theirs, so is not found.
  {
    method: "PUT",
    pattern: "/api/session/role",
    needs: signedIn,
    body: () => ({ roleId: id() }),
  },

  {
    method: "GET",
    pattern: "/api/accounts",
    needs: allOf("administration:view"),
  },
  {
    method: "POST",
    pattern: "/api/accounts",
    needs: allOf("administration:edit"),
    body: () => ({
      ...named(),
      email: `${unique("fictional").replace(" ", ".")}@example.test`,
      roleId: teamMember,
    }),
  },
  {
    method: "PATCH",
    pattern: "/api/accounts/:id",
    needs: allOf("administration:edit"),
    body: named,
  },
  {
    method: "POST",
    pattern: "/api/accounts/:id/password",
    needs: allOf("administration:edit"),
    body: () => ({}),
  },
  {
    method: "PUT",
    pattern: "/api/accounts/:id/active",
    needs: allOf("administration:edit"),
    body: () => ({ active: true }),
  },
  // Each user changes their own name.
  {
    method: "PUT",
    pattern: "/api/account/name",
    needs: signedIn,
    body: named,
  },

  // Those who manage accounts choose each account's role from every role.
  {
    method: "GET",
    pattern: "/api/roles",
    needs: allOf("administration:view"),
  },
  {
    method: "POST",
    pattern: "/api/roles",
    needs: allOf("administration:edit"),
    body: role,
  },
  {
    method: "PUT",
    pattern: "/api/roles/:id",
    needs: allOf("administration:edit"),
    body: () => ({ ...role(), updatedAt: new Date().toISOString() }),
  },
  {
    method: "POST",
    pattern: "/api/roles/:id/effects",
    needs: allOf("administration:edit"),
    body: () => ({ permissions: [] }),
  },

  {
    method: "PUT",
    pattern: "/api/settings/time-zone",
    needs: allOf("administration:edit"),
    body: () => ({ timeZone: defaultTimeZone }),
  },
  {
    method: "PUT",
    pattern: "/api/data-classes/:field",
    url: "/api/data-classes/startDate",
    needs: allOf("data:classify", "personal:view"),
    body: () => ({ dataClass: "general" }),
  },
  {
    method: "PUT",
    pattern: "/api/lists/:listId/class",
    needs: allOf("data:classify"),
    body: () => ({ dataClass: "general" }),
  },
  {
    method: "PUT",
    pattern: "/api/columns/:fieldId/class",
    needs: allOf("data:classify"),
    body: () => ({ dataClass: "general" }),
  },
  {
    method: "PUT",
    pattern: "/api/settings/passwords",
    needs: allOf("administration:edit"),
    body: () => defaultPasswordSettings,
  },
  {
    method: "GET",
    pattern: "/api/effort-conversions",
    needs: anyOf("plan:view", "features:view"),
  },
  {
    method: "GET",
    pattern: "/api/planning-settings",
    needs: allOf("configuration:view"),
  },
  {
    method: "PATCH",
    pattern: "/api/planning-settings",
    needs: allOf("configuration:edit"),
    body: () => startingPlanningSettings,
  },
  { method: "GET", pattern: "/api/greeting", needs: allOf("plan:view") },
  {
    method: "GET",
    pattern: "/api/allocations",
    needs: allOf("allocations:view", "personal:view"),
  },
  {
    method: "POST",
    pattern: "/api/allocations/changes",
    needs: allOf("allocations:edit", "personal:view"),
    body: () => ({
      personId: randomUUID(),
      featureId: randomUUID(),
      percentage: 50,
      from: "2027-01",
    }),
  },

  {
    method: "GET",
    pattern: "/api/access-history",
    needs: allOf("administration:view"),
  },
  // Holds only changes to data the reader sees, as the change history tests check.
  {
    method: "GET",
    pattern: "/api/changes",
    needs: anyOf(...changeHistoryViews),
  },

  // Lists' choices are read by those who see configuration, and by those who see People, whose
  // columns draw on them.
  {
    method: "GET",
    pattern: "/api/lists",
    needs: anyOf("configuration:view", "people:view"),
  },
  // A list can be given only a visibility its maker sees, and seeing General data needs
  // people:view; changes to existing lists check their visibility in the lists tests.
  {
    method: "POST",
    pattern: "/api/lists",
    needs: allOf("configuration:edit", "people:view"),
    body: named,
  },
  {
    method: "PUT",
    pattern: "/api/lists/:listId",
    needs: allOf("configuration:edit"),
    body: named,
  },
  {
    method: "PUT",
    pattern: "/api/lists/:listId/retired",
    needs: allOf("configuration:edit"),
    body: retired,
  },
  {
    method: "DELETE",
    pattern: "/api/lists/:listId",
    needs: allOf("configuration:edit"),
  },
  {
    method: "POST",
    pattern: "/api/lists/:listId/choices",
    needs: allOf("configuration:edit"),
    body: () => ({ choices: [{ label: unique("Fictional Choice") }] }),
  },
  {
    method: "PUT",
    pattern: "/api/lists/:listId/choices/:choiceId",
    needs: allOf("configuration:edit"),
    body: () => ({ label: unique("Fictional Choice") }),
  },
  {
    method: "PUT",
    pattern: "/api/lists/:listId/choices/:choiceId/position",
    needs: allOf("configuration:edit"),
    body: first,
  },
  {
    method: "PUT",
    pattern: "/api/lists/:listId/choices/:choiceId/retired",
    needs: allOf("configuration:edit"),
    body: retired,
  },
  {
    method: "DELETE",
    pattern: "/api/lists/:listId/choices/:choiceId",
    needs: allOf("configuration:edit"),
  },
  ...[
    "/api/lists/:listId",
    "/api/lists/:listId/choices/:choiceId",
    "/api/lists/:listId/order",
  ].flatMap((path): Route[] =>
    ["/draft", "/draft/rejection"].map((end) => ({
      method: "DELETE",
      pattern: `${path}${end}`,
      needs: allOf("configuration:edit"),
    })),
  ),

  ...["approval", "rejection"].flatMap((decision): Route[] =>
    draftKinds.map(({ variant, needs, asked }) => ({
      method: "POST",
      pattern: `/api/drafts/${decision}`,
      variant,
      needs,
      body: decision === "approval" ? asked : () => rejected(asked()),
    })),
  ),

  // Personal details and former staff are left out for those who may not see them.
  { method: "GET", pattern: "/api/people", needs: allOf("people:view") },
  {
    method: "GET",
    pattern: "/api/people/columns",
    needs: allOf("people:view"),
  },
  // Changing Personal or Confidential details needs those tiers' edit permissions too, as the
  // people tests check; these requests change only General details.
  {
    method: "POST",
    pattern: "/api/people",
    needs: allOf("people:edit"),
    body: () => ({
      people: [
        {
          preferredName: unique("Fictional Person"),
          employeeId: unique("PT"),
          positionId: testPosition,
        },
      ],
    }),
  },
  {
    method: "PATCH",
    pattern: "/api/people/:personId",
    needs: allOf("people:edit"),
    body: () => ({ preferredName: unique("Fictional Person") }),
  },
  {
    method: "DELETE",
    pattern: "/api/people/:personId",
    needs: allOf("people:edit"),
  },
  {
    method: "DELETE",
    pattern: "/api/people/:personId/draft",
    needs: allOf("people:edit"),
  },
  {
    method: "DELETE",
    pattern: "/api/people/:personId/draft/rejection",
    needs: allOf("people:edit"),
  },

  // A column can be given only a visibility its maker sees, and seeing General data needs
  // people:view; changes to existing columns check their visibility in the columns tests.
  {
    method: "POST",
    pattern: "/api/people/columns",
    needs: allOf("configuration:edit", "people:view"),
    body: () => ({ ...named(), type: "link", visibility: "general" }),
  },
  {
    method: "PUT",
    pattern: "/api/people/columns/:fieldId",
    needs: allOf("configuration:edit"),
    body: () => ({ ...named(), type: "link", visibility: "general" }),
  },
  {
    method: "DELETE",
    pattern: "/api/people/columns/:fieldId",
    needs: allOf("configuration:edit"),
  },
  ...["/draft", "/draft/rejection"].map((end): Route => ({
    method: "DELETE",
    pattern: `/api/people/columns/:fieldId${end}`,
    needs: allOf("configuration:edit"),
  })),

  {
    method: "POST",
    pattern: "/api/features/columns",
    needs: allOf("configuration:edit"),
    body: () => ({ ...named(), type: "link", visibility: "general" }),
  },
  {
    method: "PUT",
    pattern: "/api/features/columns/:fieldId",
    needs: allOf("configuration:edit"),
    body: () => ({ ...named(), type: "link", visibility: "general" }),
  },
  ...["", "/draft", "/draft/rejection"].map((end): Route => ({
    method: "DELETE",
    pattern: `/api/features/columns/:fieldId${end}`,
    needs: allOf("configuration:edit"),
  })),

  // Changing or deleting someone else's view also needs configuration:edit, as the views tests
  // check.
  {
    method: "POST",
    pattern: "/api/people/views",
    needs: allOf("people:view"),
    body: () => ({ ...named(), scope: "personal", definition: {} }),
  },
  {
    method: "PUT",
    pattern: "/api/people/views/:viewId",
    needs: allOf("people:view"),
    body: named,
  },
  {
    method: "DELETE",
    pattern: "/api/people/views/:viewId",
    needs: allOf("people:view"),
  },

  // Those who see people see hires as placeholders; the hiring plan's details need
  // hiring-plan:view, as the hires tests check.
  {
    method: "GET",
    pattern: "/api/org-chart",
    // Personal details, and Employee IDs for those who do not see people, are left out, which the
    // org chart tests check.
    needs: allOf("people:view"),
  },
  {
    method: "GET",
    pattern: "/api/org-chart",
    variant: "on another day",
    url: "/api/org-chart?on=2020-01-01",
    needs: allOf("people:view", "personal:view"),
  },
  {
    // Later dates of reporting lines are future reorganizations, which are Confidential.
    method: "GET",
    pattern: "/api/org-chart",
    variant: "on a later day",
    url: "/api/org-chart?on=2099-01-01",
    needs: allOf("people:view", "personal:view", "confidential:view"),
  },
  {
    method: "PUT",
    pattern: "/api/org-chart/teams/:personId/colour",
    needs: allOf("people:edit"),
    body: () => ({ colour: "teal" }),
  },
  {
    method: "GET",
    pattern: "/api/planned-hires",
    // Seeing the hiring plan does nothing without seeing people.
    needs: allOf("people:view"),
  },
  {
    method: "POST",
    pattern: "/api/planned-hires",
    needs: allOf("people:edit", "hiring-plan:edit"),
    body: () => ({ hires: [{ positionId: testPosition }] }),
  },
  {
    method: "PATCH",
    pattern: "/api/planned-hires/:hireId",
    needs: allOf("people:edit", "hiring-plan:edit"),
    body: () => ({ targetDate: null }),
  },
  ...["", "/draft", "/draft/rejection"].map((end): Route => ({
    method: "DELETE",
    pattern: `/api/planned-hires/:hireId${end}`,
    needs: allOf("people:edit", "hiring-plan:edit"),
  })),
  {
    method: "POST",
    pattern: "/api/planned-hires/:hireId/fill",
    needs: allOf("people:edit", "hiring-plan:edit"),
    body: () => ({
      by: "new person",
      preferredName: "Fictional Starter",
      employeeId: "FICTIONAL-FILL",
      startDate: null,
    }),
  },

  // Planning configuration is seen with the plan.
  // Feature teams are seen with View Feature teams; renaming one needs feature-teams:edit, as the
  // feature teams tests check.
  {
    method: "GET",
    pattern: "/api/feature-teams",
    needs: allOf("feature-teams:view"),
  },
  {
    method: "GET",
    pattern: "/api/feature-teams",
    variant: "on another day",
    url: "/api/feature-teams?on=2099-01-01",
    needs: allOf("feature-teams:view", "personal:view"),
  },
  {
    method: "GET",
    pattern: "/api/feature-teams/months",
    needs: allOf("feature-teams:view", "personal:view"),
    url: "/api/feature-teams/months?from=2025-01&to=2025-03",
  },
  {
    method: "POST",
    pattern: "/api/feature-teams",
    needs: changingTeams,
    body: () => ({ name: unique("Fictional Feature Team") }),
  },
  {
    method: "POST",
    pattern: "/api/feature-teams",
    variant: "from another day",
    needs: allOf("people:view", "feature-teams:edit", "personal:view"),
    body: () => ({
      name: unique("Fictional Feature Team"),
      from: "2099-01-01",
    }),
  },
  {
    method: "PATCH",
    pattern: "/api/feature-teams/:teamId",
    needs: changingTeams,
    body: () => ({ leadId: null }),
  },
  {
    method: "PATCH",
    // Changing someone's teams month by month is part of Feature assignments, which needs
    // Personal details.
    pattern: "/api/feature-teams/members/:personId",
    needs: allOf("people:view", "feature-teams:edit", "personal:view"),
    body: () => ({}),
  },
  {
    method: "DELETE",
    pattern: "/api/feature-teams/:teamId",
    needs: changingTeams,
  },
  ...["/draft", "/draft/rejection"].map((end): Route => ({
    method: "DELETE",
    pattern: `/api/feature-teams/:teamId${end}`,
    needs: changingTeams,
  })),
  {
    method: "PUT",
    pattern: "/api/feature-teams/:teamId/colour",
    needs: allOf("feature-teams:edit"),
    body: () => ({ colour: "teal" }),
  },

  {
    method: "GET",
    pattern: "/api/release-streams",
    needs: anyOf("features:view", "configuration:view"),
  },
  {
    method: "POST",
    pattern: "/api/release-streams",
    needs: allOf("configuration:edit"),
    body: named,
  },
  {
    method: "PUT",
    pattern: "/api/release-streams/:streamId",
    needs: allOf("configuration:edit"),
    body: named,
  },
  {
    method: "PUT",
    pattern: "/api/release-streams/:streamId/retired",
    needs: allOf("configuration:edit"),
    body: retired,
  },
  {
    method: "PUT",
    pattern: "/api/release-streams/:streamId/cycles-until",
    needs: allOf("configuration:edit"),
    body: () => ({ cyclesUntil: "2027-06-30" }),
  },
  {
    method: "PUT",
    pattern: "/api/release-streams/:streamId/cycles/:startsOn/length",
    url: `/api/release-streams/${id()}/cycles/2027-01-04/length`,
    needs: allOf("configuration:edit"),
    body: () => ({ length: 2, later: "keep" }),
  },
  {
    method: "POST",
    pattern: "/api/release-streams/:streamId/patterns",
    needs: allOf("configuration:edit"),
    body: pattern,
  },
  {
    method: "PUT",
    pattern: "/api/release-streams/:streamId/patterns/:id",
    needs: allOf("configuration:edit"),
    body: pattern,
  },
  {
    method: "DELETE",
    pattern: "/api/release-streams/:streamId/patterns/:id",
    needs: allOf("configuration:edit"),
  },
  // Releases are part of features and releases, though they sit in a stream.
  {
    method: "POST",
    pattern: "/api/release-streams/:streamId/releases",
    needs: allOf("features:edit"),
    body: release,
  },
  {
    method: "PUT",
    pattern: "/api/release-streams/:streamId/releases/:id",
    needs: allOf("features:edit"),
    body: release,
  },
  {
    method: "DELETE",
    pattern: "/api/release-streams/:streamId/releases/:id",
    needs: allOf("features:edit"),
  },
  {
    method: "PUT",
    pattern: "/api/release-streams/:streamId/releases/:id/note",
    needs: allOf("features:edit"),
    body: () => ({ note: "Fictional **note**" }),
  },
  {
    method: "GET",
    pattern: "/api/projects",
    needs: anyOf("plan:view", "features:view"),
  },
  // Owners by name and proposal statuses, for those who see the plan but not People or Lists.
  {
    method: "GET",
    pattern: "/api/projects/choices",
    needs: anyOf("plan:view", "features:view"),
  },
  ...(
    [
      ["customers", "plan:edit"],
      ["projects", "plan:edit"],
      ["proposals", "plan:edit"],
      ["features", "features:edit"],
    ] as const
  ).flatMap(([path, permission]): Route[] => [
    {
      method: "POST",
      pattern: `/api/${path}`,
      needs: allOf(permission),
      body: named,
    },
    {
      method: "PUT",
      pattern: `/api/${path}/:id`,
      needs: allOf(permission),
      body: named,
    },
    {
      method: "DELETE",
      pattern: `/api/${path}/:id`,
      needs: allOf(permission),
    },
  ]),
  // A feature's projects and proposals are drafts of those projects and proposals.
  {
    method: "PUT",
    pattern: "/api/features/:id/projects-and-proposals",
    needs: allOf("plan:edit"),
    body: () => ({ projectIds: [] }),
  },
  ...["projects", "proposals"].map((path): Route => ({
    method: "GET",
    pattern: `/api/${path}/:id/scope-history`,
    needs: allOf("plan:view"),
  })),
  {
    method: "PUT",
    pattern: "/api/features/:id/proposals/:proposalId/removal-reason",
    needs: allOf("plan:edit"),
    body: () => ({ removalReason: "Fictional reason" }),
  },
  {
    method: "POST",
    pattern: "/api/projects/:projectId/milestones",
    needs: allOf("plan:edit"),
    body: milestone,
  },
  {
    method: "PUT",
    pattern: "/api/projects/:projectId/milestones/:id",
    needs: allOf("plan:edit"),
    body: milestone,
  },
  {
    method: "DELETE",
    pattern: "/api/projects/:projectId/milestones/:id",
    needs: allOf("plan:edit"),
  },
  ...["/draft", "/draft/rejection"].flatMap((end) =>
    recordKinds.map(({ type, needs }): Route => ({
      method: "DELETE",
      pattern: `/api/records/:type/:id${end}`,
      variant: type,
      url: `/api/records/${type}/${id()}${end}`,
      needs,
    })),
  ),

  // Only the maker of a change may undo it, with the permissions changing what it changed needs,
  // as the undo tests check.
  { method: "POST", pattern: "/api/undo/:changeSetId", needs: signedIn },

  // Anyone who may make drafts publishes and discards their own.
  ...[
    { method: "GET" as const, pattern: "/api/unpublished" },
    { method: "POST" as const, pattern: "/api/unpublished/publish" },
    { method: "POST" as const, pattern: "/api/unpublished/discard" },
  ].map((route): Route => ({
    ...route,
    needs: anyOf(
      "people:edit",
      "configuration:edit",
      "plan:edit",
      "features:edit",
      "allocations:edit",
      "feature-teams:edit",
      "hiring-plan:edit",
    ),
  })),
];

const nameOf = ({ method, pattern, variant }: Route) =>
  `${method} ${pattern}${variant === undefined ? "" : ` (${variant})`}`;

// Every permission except those given, and except those that grant one of them, since editing data
// grants seeing it.
function allExcept(dropped: readonly Permission[]): Permission[] {
  const granting = Object.entries(impliedPermissions)
    .filter(([, implied]) => dropped.includes(implied))
    .map(([permission]) => permissionSchema.parse(permission));
  return permissionSchema.options.filter(
    (permission) =>
      !dropped.includes(permission) && !granting.includes(permission),
  );
}

interface Case {
  name: string;
  route: Route;
  holds: readonly Permission[];
}

// Accounts holding every permission but some of those a route needs, one case for each permission
// it needs all of, and one for those it needs any of.
const refusals: Case[] = routes.flatMap((route) => {
  if (route.needs.kind !== "permissions") return [];
  const { all, any } = route.needs;
  return [
    ...all.map((permission) => ({
      name: `refuses ${nameOf(route)} without ${permission}`,
      route,
      holds: allExcept([permission]),
    })),
    ...(any.length === 0
      ? []
      : [
          {
            name: `refuses ${nameOf(route)} without ${any.join(" or ")}`,
            route,
            holds: allExcept(any),
          },
        ]),
  ];
});

// Accounts holding only what a route needs, one case for each of the permissions it needs any of.
const allowances: Case[] = routes.flatMap((route) => {
  if (route.needs.kind === "open") return [];
  if (route.needs.kind === "signed-in") {
    return [
      { name: `allows ${nameOf(route)} with no permissions`, route, holds: [] },
    ];
  }
  const { all, any } = route.needs;
  return (any.length === 0 ? [all] : any.map((one) => [...all, one])).map(
    (holds) => ({
      name: `allows ${nameOf(route)} with only ${holds.join(" and ")}`,
      route,
      holds,
    }),
  );
});

const signedOut = routes.filter(({ needs }) => needs.kind !== "open");

let test: TestApp;

beforeAll(async () => {
  test = await startTestApp();
  teamMember = await findStartingRole(test.connection, "team-member");
});

afterAll(async () => {
  await test.close();
});

// The session cookies of accounts holding exactly some permissions, each made once and shared by
// the tests needing the same permissions. Sharing is safe, since no request sent changes an
// account's role or session: those routes are sent random IDs, and are refused or not found.
const holders = new Map<string, string>();

async function holding(permissions: readonly Permission[]): Promise<string> {
  const key = [...permissions].sort().join(" ");
  const known = holders.get(key);
  if (known !== undefined) return known;
  const who = await test.signedIn(permissions);
  holders.set(key, who.cookie);
  return who.cookie;
}

async function send(cookie: string, route: Route) {
  const url = route.url ?? route.pattern.replaceAll(/:[A-Za-z]+/gu, () => id());
  return test.request(cookie, route.method, url, route.body?.(), {
    publish: false,
  });
}

describe("the routes", () => {
  it("lists every route the server registers", () => {
    const served = [...registered].filter(
      (route) => !route.startsWith("HEAD "),
    );
    const listed = routes.map(
      ({ method, pattern: path }) => `${method} ${path}`,
    );
    expect([...new Set(listed)].sort()).toEqual(served.sort());
  });
});

describe("refusing requests", () => {
  it.each(signedOut.map((route) => ({ name: nameOf(route), route })))(
    "refuses $name when signed out",
    async ({ route }) => {
      const response = await send("", route);
      expect(response.statusCode, response.body).toBe(401);
    },
  );

  it.each(refusals)("$name", async ({ route, holds }) => {
    const response = await send(await holding(holds), route);
    expect(response.statusCode, response.body).toBe(403);
  });

  describe("while a generated password is still to be changed", () => {
    let cookie: string;

    beforeAll(async () => {
      const who = await test.signedIn(permissionSchema.options);
      await test.connection
        .update(users)
        .set({ mustChangePassword: true })
        .where(eq(users.id, who.id));
      cookie = who.cookie;
    });

    it.each(signedOut.map((route) => ({ name: nameOf(route), route })))(
      "refuses $name",
      async ({ route }) => {
        const response = await send(cookie, route);
        expect(response.statusCode, response.body).toBe(403);
        expect(response.json()).toEqual({
          error: "The password must be changed before continuing.",
        });
      },
    );
  });
});

describe("allowing requests", () => {
  it.each(allowances)("$name", async ({ route, holds }) => {
    const response = await send(await holding(holds), route);
    // Neither refused, nor refused as invalid, so the requests the refusals send are valid too, nor
    // failed. A random ID is not found.
    expect([200, 201, 204, 404], response.body).toContain(response.statusCode);
  });
});
