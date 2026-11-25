// SPDX-License-Identifier: Apache-2.0

// Every API route and what it needs, which the permission tests check against the routes served.

import {
  changeHistoryViews,
  defaultPasswordSettings,
  defaultTimeZone,
  firstTables,
  startingPlanningSettings,
  viewPageSchema,
  viewTableSchema,
} from "@fathom/shared";
import { randomUUID } from "node:crypto";
import { testPosition, unique } from "./test-app.ts";

import {
  allOf,
  anyOf,
  changingSchedules,
  changingTeams,
  draftKinds,
  first,
  id,
  milestone,
  named,
  open,
  pattern,
  recordKinds,
  rejected,
  release,
  retired,
  role,
  type Route,
  signedIn,
  teamMember,
  viewTableNeeds,
} from "./test-permission-needs.ts";

export const routes: Route[] = [
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
  // Any signed-in account may follow a link; what it finds depends on what the role sees, which
  // the record keys tests cover.
  { method: "GET", pattern: "/api/go/:kind/:keyNumber", needs: signedIn },
  { method: "GET", pattern: "/api/go/:key", needs: signedIn },
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
  // Refusing a column the role can't see is left to the exports tests.
  {
    method: "POST",
    pattern: "/api/exports",
    variant: "people",
    needs: allOf("people:view"),
    body: () => ({ table: "people", columns: ["preferredName"] }),
  },
  {
    method: "POST",
    pattern: "/api/exports",
    variant: "features",
    needs: allOf("features:view"),
    body: () => ({ table: "features", columns: ["name"] }),
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
  // A timeline holds start and end dates, Personal details.
  {
    method: "GET",
    pattern: "/api/people/:personId/timeline",
    needs: allOf("people:view", "personal:view"),
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
    needs: allOf("people:edit", "people:view"),
    body: () => ({ ...named(), type: "link", visibility: "general" }),
  },
  {
    method: "PUT",
    pattern: "/api/people/columns/:fieldId",
    needs: allOf("people:edit", "people:view"),
    body: () => ({ ...named(), type: "link", visibility: "general" }),
  },
  {
    method: "DELETE",
    pattern: "/api/people/columns/:fieldId",
    needs: allOf("people:edit", "people:view"),
  },
  ...["/draft", "/draft/rejection"].map((end): Route => ({
    method: "DELETE",
    pattern: `/api/people/columns/:fieldId${end}`,
    needs: allOf("people:edit", "people:view"),
  })),

  // Features' and Activities' columns, set up by those who edit them and see people.
  ...["features", "activities"].flatMap((table): Route[] => [
    {
      method: "POST",
      pattern: `/api/${table}/columns`,
      needs: allOf("features:edit", "people:view"),
      body: () => ({ ...named(), type: "link", visibility: "general" }),
    },
    {
      method: "PUT",
      pattern: `/api/${table}/columns/:fieldId`,
      needs: allOf("features:edit", "people:view"),
      body: () => ({ ...named(), type: "link", visibility: "general" }),
    },
    ...["", "/draft", "/draft/rejection"].map((end): Route => ({
      method: "DELETE",
      pattern: `/api/${table}/columns/:fieldId${end}`,
      needs: allOf("features:edit", "people:view"),
    })),
  ]),

  // Each table's views need what opens its page. Sharing, and changing or deleting someone else's
  // view, also need what shares views on the table, as the views tests check.
  ...viewTableSchema.options.flatMap((table): Route[] => {
    // The table is always one of the fixed tables.
    // eslint-disable-next-line security/detect-object-injection
    const needs = viewTableNeeds[table];
    const view = `/api/views/${table}/${randomUUID()}`;
    return [
      {
        method: "GET",
        pattern: "/api/views/:table",
        variant: table,
        url: `/api/views/${table}`,
        needs,
      },
      {
        method: "POST",
        pattern: "/api/views/:table",
        variant: table,
        url: `/api/views/${table}`,
        needs,
        body: () => ({ ...named(), scope: "personal", definition: {} }),
      },
      {
        method: "PUT",
        pattern: "/api/views/:table/:viewId",
        variant: table,
        url: view,
        needs,
        body: named,
      },
      {
        method: "DELETE",
        pattern: "/api/views/:table/:viewId",
        variant: table,
        url: view,
        needs,
      },
    ];
  }),

  // Every signed-in account reads its own last views, only of the pages its role opens, which the
  // last views tests check.
  { method: "GET", pattern: "/api/last-views", needs: signedIn },
  // Keeping a page's last view needs what opens its tables, each of a page's tables opening alike.
  ...viewPageSchema.options.flatMap((page): Route[] => {
    // The page is always one of the fixed pages.
    // eslint-disable-next-line security/detect-object-injection
    const table = firstTables[page];
    // The table is always one of the fixed tables.
    // eslint-disable-next-line security/detect-object-injection
    const needs = viewTableNeeds[table];
    const url = `/api/last-views/${page}`;
    return [
      {
        method: "PUT",
        pattern: "/api/last-views/:page",
        variant: page,
        url,
        needs,
        body: () => ({ table, definition: {} }),
      },
    ];
  }),

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
    // The hiring plan is changed only with Edit on its class too, Confidential until moved.
    needs: allOf("people:edit", "hiring-plan:edit", "confidential:edit"),
    body: () => ({ hires: [{ positionId: testPosition }] }),
  },
  {
    method: "PATCH",
    pattern: "/api/planned-hires/:hireId",
    needs: allOf("people:edit", "hiring-plan:edit", "confidential:edit"),
    body: () => ({ targetDate: null }),
  },
  ...["", "/draft", "/draft/rejection"].map((end): Route => ({
    method: "DELETE",
    pattern: `/api/planned-hires/:hireId${end}`,
    needs: allOf("people:edit", "hiring-plan:edit", "confidential:edit"),
  })),
  {
    method: "POST",
    pattern: "/api/planned-hires/:hireId/fill",
    needs: allOf("people:edit", "hiring-plan:edit", "confidential:edit"),
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
    // Changing someone's teams month by month is part of Capacity's Feature teams, which needs
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
    needs: allOf("people:view", "feature-teams:edit"),
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
    needs: changingSchedules,
    body: named,
  },
  {
    method: "PUT",
    pattern: "/api/release-streams/:streamId",
    needs: changingSchedules,
    body: named,
  },
  {
    method: "PUT",
    pattern: "/api/release-streams/:streamId/retired",
    needs: changingSchedules,
    body: retired,
  },
  {
    method: "PUT",
    pattern: "/api/release-streams/:streamId/ends-on",
    needs: changingSchedules,
    body: () => ({ endsOn: null }),
  },
  {
    method: "PUT",
    pattern: "/api/release-streams/:streamId/cycles/:startsOn/length",
    url: `/api/release-streams/${id()}/cycles/2027-01-04/length`,
    needs: changingSchedules,
    body: () => ({ length: 2, later: "keep" }),
  },
  {
    method: "POST",
    pattern: "/api/release-streams/:streamId/patterns",
    needs: changingSchedules,
    body: pattern,
  },
  {
    method: "PUT",
    pattern: "/api/release-streams/:streamId/patterns/:id",
    needs: changingSchedules,
    body: pattern,
  },
  {
    method: "DELETE",
    pattern: "/api/release-streams/:streamId/patterns/:id",
    needs: changingSchedules,
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
  {
    method: "GET",
    pattern: "/api/activities",
    needs: allOf("features:view"),
  },
  // An activity names its project, which a random one isn't found as.
  ...(["POST", "PUT", "DELETE"] as const).map((method): Route => ({
    method,
    pattern: method === "POST" ? "/api/activities" : "/api/activities/:id",
    needs: allOf("features:edit"),
    ...(method === "DELETE"
      ? {}
      : { body: () => ({ ...named(), projectId: id() }) }),
  })),
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
    recordKinds.map(({ type, needs, recordId }): Route => ({
      method: "DELETE",
      pattern: `/api/records/:type/:id${end}`,
      variant: type,
      url: `/api/records/${type}/${recordId ?? id()}${end}`,
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
