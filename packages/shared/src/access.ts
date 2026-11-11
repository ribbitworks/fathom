// SPDX-License-Identifier: Apache-2.0

// The roles Fathom starts with, and the permissions roles grant, with what each permission means in
// plain English, as the Decisions Log sets out. Roles are kept in the database, where they can be
// edited; the front end uses a user's permissions to show only what they can do, and the server
// enforces them.

import { z } from "zod";

export const roleSchema = z.enum([
  "team-member",
  "product-manager",
  "feature-lead",
  "project-manager",
  "engineering-manager",
  "engineering-director",
  "workforce-administrator",
  "executive",
  "resource-planner",
  "administrator",
]);

export type Role = z.infer<typeof roleSchema>;

export const permissionSchema = z.enum([
  "plan:view",
  "plan:edit",
  "plan:approve",
  // Features and their estimates, apart from the rest of the plan, which Edit Plan changes.
  "features:edit",
  // Releases are an area of their own, apart from the plan, for approving.
  "releases:approve",
  "allocations:view",
  "allocations:edit",
  "allocations:approve",
  "people:view",
  "people:edit",
  "people:approve",
  // The org chart, apart from People: without people:view, each card shows only a name, position,
  // and team, and opens nothing.
  "org-chart:view",
  // A team's colour is how the org chart is drawn, not a detail of anyone, so it has its own
  // permission. Until accounts are linked to people, it reaches every team.
  "team-colours:edit",
  // Feature teams are General data. Roles proposes that seeing them comes with seeing the plan.
  "feature-teams:propose",
  "feature-teams:edit",
  "feature-teams:approve",
  "personal:view",
  "personal:edit",
  "confidential:view",
  "confidential:edit",
  // The hiring plan is Confidential, but has a permission area of its own, apart from other
  // Confidential data.
  "hiring-plan:view",
  "hiring-plan:edit",
  "hiring-plan:approve",
  // Opens the configuration pages, such as Lists; configuration the plan uses is seen with the plan.
  "configuration:view",
  "configuration:edit",
  "configuration:approve",
  "drafts:submit",
  // Approving drafts the approver changed themselves, in the areas they approve, which nobody may
  // do without it.
  "drafts:approve-own",
  "accounts:view",
  "accounts:manage",
  "roles:view",
  // Changing what roles grant, apart from managing accounts, as the Decisions Log sets out.
  "roles:edit",
  "settings:view",
  // Changing settings for the whole of Fathom, such as its time zone.
  "settings:edit",
  "history:view",
  // The change history, holding only changes to data the reader may see.
  "changes:view",
]);

export type Permission = z.infer<typeof permissionSchema>;

// What each permission lets a user do, and what a user without it cannot, in plain English, for
// showing the result of setting roles, and the permissions it does nothing without any of. Pages that
// do not appear without a permission are worked out from the pages themselves, so these speak only of
// data and actions. Every permission must be described, which the compiler checks.
export const permissionDescriptions: Record<
  Permission,
  { allows: string; without: string; needs?: readonly Permission[] }
> = {
  "plan:view": {
    allows:
      "Sees the plan: projects, proposals, features, milestones, and releases.",
    without: "Does not see the plan.",
  },

  "plan:edit": {
    allows:
      "Changes the plan across every project, apart from features and estimates.",
    without: "Cannot change the plan.",
  },
  "plan:approve": {
    allows:
      "Approves or rejects drafts of the plan: features, projects, proposals, and the roadmap.",
    without: "Cannot approve drafts of the plan.",
    needs: ["plan:view"],
  },
  "features:edit": {
    allows:
      "Adds, changes, and removes features and their estimates, without changing the rest of the plan.",
    without: "Cannot change features or estimates.",
  },
  "releases:approve": {
    allows:
      "Approves or rejects drafts of releases, release streams, and cycle patterns.",
    without: "Cannot approve drafts of releases.",
    needs: ["plan:view", "configuration:view"],
  },
  "allocations:view": {
    allows: "Sees allocations: who is assigned to what, and when.",
    without: "Does not see allocations.",
  },
  "allocations:edit": {
    allows: "Changes allocations across the whole plan.",
    without: "Cannot change allocations.",
  },
  "allocations:approve": {
    allows: "Approves or rejects drafts of allocations.",
    without: "Cannot approve drafts of allocations.",
    needs: ["allocations:view"],
  },
  "people:view": {
    allows:
      "Sees people and their General details, such as position, site, level, and manager.",
    without:
      "Does not see people's details; people appear in the plan only by name.",
  },
  "people:edit": {
    allows:
      "Adds, changes, and removes people, with their teams and reporting lines.",
    without: "Cannot change people.",
  },
  "people:approve": {
    allows:
      "Approves or rejects drafts of people, with their teams and reporting lines.",
    without: "Cannot approve drafts of people.",
    needs: ["people:view"],
  },
  "org-chart:view": {
    allows:
      "Sees the org chart: who reports to whom, with each person's name, position, and the team they lead. With View People, a person's card opens them on People.",
    without: "Does not see the org chart.",
  },
  "team-colours:edit": {
    allows:
      "Chooses the colour each team is drawn in on the org chart, for every team.",
    without: "Cannot change teams' colours.",
    needs: ["org-chart:view"],
  },
  "feature-teams:propose": {
    allows: "Proposes feature teams for approval.",
    without: "Cannot propose feature teams.",
    needs: ["people:view"],
  },
  "feature-teams:edit": {
    allows: "Changes feature teams.",
    without: "Cannot change feature teams.",
    needs: ["people:view"],
  },
  "feature-teams:approve": {
    allows: "Approves or rejects proposed feature teams.",
    without: "Cannot approve feature teams.",
    needs: ["people:view"],
  },
  "personal:view": {
    allows:
      "Sees people who haven't started yet, and Personal details of the people the role sees, such as gender, start and end dates, and past managers.",
    without:
      "Personal details are hidden wherever they appear, and people who haven't started yet aren't listed.",
    needs: ["people:view"],
  },

  "personal:edit": {
    allows: "Changes Personal details of people.",
    without: "Cannot change Personal details.",
    needs: ["people:edit"],
  },

  "confidential:view": {
    allows:
      "Sees Confidential data, such as future-dated reorganizations and columns marked Confidential.",
    without: "Confidential data is hidden wherever it appears.",
    needs: ["people:view"],
  },

  "confidential:edit": {
    allows: "Changes Confidential data, such as columns marked Confidential.",
    without: "Cannot change Confidential data.",
    needs: ["people:edit"],
  },

  "hiring-plan:view": {
    allows:
      "Sees the hiring plan: every planned hire, with its target date, drafts, and history.",
    without: "Planned hires appear only as placeholders.",
    needs: ["people:view"],
  },

  "hiring-plan:edit": {
    allows: "Adds, changes, and removes planned hires.",
    without: "Cannot change the hiring plan.",
    needs: ["people:edit"],
  },

  "hiring-plan:approve": {
    allows: "Approves or rejects drafts of planned hires.",
    without: "Cannot approve drafts of planned hires.",
    needs: ["hiring-plan:view"],
  },

  "configuration:view": {
    allows:
      "Sees configuration, such as lists of choices and People's columns.",
    without:
      "Does not see configuration; choices still show wherever they are used.",
  },
  "configuration:edit": {
    allows:
      "Changes configuration, such as lists of choices, People's columns, and release streams.",
    without: "Cannot change configuration.",
  },
  "configuration:approve": {
    allows:
      "Approves or rejects drafts of configuration, such as lists of choices and People's columns.",
    without: "Cannot approve drafts of configuration.",
    needs: ["configuration:view", "people:view"],
  },
  "drafts:submit": {
    allows:
      "Makes drafts of changes to the plan and allocations, for approval, once those can be changed in Fathom.",
    without: "Cannot make drafts of changes to the plan or allocations.",
  },

  "drafts:approve-own": {
    allows:
      "Approves drafts they changed themselves, in the areas they approve, which otherwise need another approver.",
    without: "Drafts they changed need someone else to approve them.",
    needs: [
      "plan:approve",
      "releases:approve",
      "allocations:approve",
      "people:approve",
      "hiring-plan:approve",
      "feature-teams:approve",
      "configuration:approve",
    ],
  },
  "accounts:view": {
    allows:
      "Sees user accounts: their names, email addresses, the role each holds, and whether each is active.",
    without: "Does not see user accounts.",
  },
  "accounts:manage": {
    allows:
      "Manages user accounts: creates them, changes their names, email addresses, and the role each holds, resets passwords, and deactivates them.",
    without: "Cannot manage user accounts.",
  },
  "roles:view": {
    allows: "Sees roles: their names, descriptions, and what they grant.",
    without: "Does not see roles.",
  },
  "roles:edit": {
    allows:
      "Creates and changes roles: their names, descriptions, and what they grant, including the role the user holds.",
    without: "Cannot change roles.",
  },
  "settings:view": {
    allows: "Sees settings for the whole of Fathom, such as its time zone.",
    without: "Does not see Fathom's settings.",
  },
  "settings:edit": {
    allows:
      "Changes settings for the whole of Fathom, such as the time zone that decides which day is today.",
    without: "Cannot change Fathom's settings.",
  },
  "history:view": {
    allows:
      "Sees the access history: who changed accounts or protected data, or looked at protected data, and when.",
    without: "Does not see the access history.",
  },

  "changes:view": {
    allows: "Sees the change history of the data their role lets them see.",
    without: "Does not see the change history.",
  },
};

// The permissions that let a user make drafts, any of which gives them unpublished changes to
// publish or discard.
export const draftingPermissions: readonly Permission[] = [
  "people:edit",
  "configuration:edit",
  "plan:edit",
  "features:edit",
  "allocations:edit",
  "feature-teams:propose",
  "feature-teams:edit",
  "hiring-plan:edit",
];

// Permissions a role can grant before Fathom has the features they govern, so they do nothing yet.
// The Roles page marks them, as the Decisions Log sets out, so roles can be set up ahead of the
// features. Building a feature takes its permissions out of this list.
export const unbuiltPermissions: readonly Permission[] = ["drafts:submit"];

// The sensitivity tiers of Fathom's data. Roles grant access to tiers, not to screens.
export const tierSchema = z.enum(["general", "personal", "confidential"]);

export type Tier = z.infer<typeof tierSchema>;

// Editing data lets a user view it too, as Roles decides, so a role granting the first grants the
// second, whether or not it is stored.
export const impliedPermissions: Partial<Record<Permission, Permission>> = {
  "plan:edit": "plan:view",
  "features:edit": "plan:view",
  "allocations:edit": "allocations:view",
  "people:edit": "people:view",
  "personal:edit": "personal:view",
  "confidential:edit": "confidential:view",
  "hiring-plan:edit": "hiring-plan:view",
  "configuration:edit": "configuration:view",
  "accounts:manage": "accounts:view",
  "roles:edit": "roles:view",
  "settings:edit": "settings:view",
};

// Everything some granted permissions let a user do, in the order of the shared list. A permission
// not in the list grants nothing, rather than being trusted.
export function withImplied(granted: readonly string[]): Permission[] {
  const known = permissionSchema.options.filter((permission) =>
    granted.includes(permission),
  );
  const implied = known.flatMap(
    // The permission is always one of the list above.
    // eslint-disable-next-line security/detect-object-injection
    (permission) => impliedPermissions[permission] ?? [],
  );
  return permissionSchema.options.filter(
    (permission) => known.includes(permission) || implied.includes(permission),
  );
}

// Whether two lists of permissions hold the same ones, whatever their order.
export function sameGrants(
  one: readonly Permission[],
  other: readonly Permission[],
): boolean {
  return (
    one.length === other.length &&
    one.every((permission) => other.includes(permission))
  );
}

// The actions a role can be given on an area, as the columns of the grid that sets them.
export const gridActions = ["view", "draft", "approve", "edit"] as const;

export type GridAction = (typeof gridActions)[number];

// The areas a role grants actions on, as the rows of the grid that sets them, with the permission
// each action on the area is. Every permission is in exactly one place, which a test checks.
export const permissionGrid: readonly {
  area: string;
  actions: Partial<Record<GridAction, Permission>>;
}[] = [
  {
    area: "Plan",
    actions: { view: "plan:view", approve: "plan:approve", edit: "plan:edit" },
  },
  { area: "Features", actions: { edit: "features:edit" } },
  { area: "Releases", actions: { approve: "releases:approve" } },
  {
    area: "Allocations",
    actions: {
      view: "allocations:view",
      approve: "allocations:approve",
      edit: "allocations:edit",
    },
  },
  {
    area: "People",
    actions: {
      view: "people:view",
      approve: "people:approve",
      edit: "people:edit",
    },
  },
  { area: "Org chart", actions: { view: "org-chart:view" } },
  { area: "Team colours", actions: { edit: "team-colours:edit" } },
  {
    area: "Personal details",
    actions: { view: "personal:view", edit: "personal:edit" },
  },
  {
    area: "Confidential data",
    actions: { view: "confidential:view", edit: "confidential:edit" },
  },
  {
    area: "Hiring plan",
    actions: {
      view: "hiring-plan:view",
      approve: "hiring-plan:approve",
      edit: "hiring-plan:edit",
    },
  },
  {
    area: "Feature teams",
    actions: {
      draft: "feature-teams:propose",
      approve: "feature-teams:approve",
      edit: "feature-teams:edit",
    },
  },
  {
    area: "Drafts",
    actions: { draft: "drafts:submit" },
  },
  { area: "Their own drafts", actions: { approve: "drafts:approve-own" } },
  {
    area: "Configuration",
    actions: {
      view: "configuration:view",
      approve: "configuration:approve",
      edit: "configuration:edit",
    },
  },
  { area: "Change history", actions: { view: "changes:view" } },
  { area: "Access history", actions: { view: "history:view" } },
  {
    area: "Accounts",
    actions: { view: "accounts:view", edit: "accounts:manage" },
  },
  { area: "Roles", actions: { view: "roles:view", edit: "roles:edit" } },
  {
    area: "Settings",
    actions: { view: "settings:view", edit: "settings:edit" },
  },
];

const actionNames: Record<GridAction, string> = {
  view: "View",
  draft: "Draft",
  approve: "Approve",
  edit: "Edit",
};

// A permission's short name, such as "Edit People", for lists of what changed.
export function permissionLabel(permission: string): string {
  for (const { area, actions } of permissionGrid) {
    for (const action of gridActions) {
      // The action is always one of the fixed list above.
      // eslint-disable-next-line security/detect-object-injection
      const [granted, name] = [actions[action], actionNames[action]];
      if (granted === permission) return `${name} ${area}`;
    }
  }
  return permission;
}

// The roles Fathom starts with, one for each persona, as the migrations store them, which a test
// checks: their names, what each is for, and what each grants. A starting role can be put back to
// this version from the Roles page. Every role must be listed, which the compiler checks.
export const startingRoles: Record<
  Role,
  { name: string; description: string; permissions: readonly Permission[] }
> = {
  "team-member": {
    name: "Team Member",
    description:
      "Sees the plan, including everyone's work assignments, and the org chart.",
    permissions: ["plan:view", "allocations:view", "org-chart:view"],
  },
  "product-manager": {
    name: "Product Manager",
    description:
      "Edits projects, proposals, features, milestones, releases, products, customers, and estimates across the whole plan, and approves or rejects drafts of the plan.",
    permissions: [
      "plan:edit",
      "plan:approve",
      "features:edit",
      "allocations:view",
      "org-chart:view",
      "drafts:submit",
      "changes:view",
    ],
  },
  "feature-lead": {
    name: "Feature Lead",
    description:
      "Sees the plan and people's General details, edits features, estimates, and allocations, and proposes feature teams.",
    permissions: [
      "plan:view",
      "features:edit",
      "allocations:edit",
      "org-chart:view",
      "people:view",
      "feature-teams:propose",
      "drafts:submit",
      "changes:view",
    ],
  },
  // Project Managers approve drafts, so they see lists, people, and the hiring plan, and can judge
  // drafts of them.
  "project-manager": {
    name: "Project Manager",
    description:
      "Edits the plan, sees people and the hiring plan, and approves or rejects drafts of the data the role sees, including feature teams.",
    permissions: [
      "plan:edit",
      "plan:approve",
      "features:edit",
      "releases:approve",
      "allocations:view",
      "allocations:approve",
      "org-chart:view",
      "people:view",
      "people:approve",
      "feature-teams:approve",
      "hiring-plan:view",
      "hiring-plan:approve",
      "configuration:view",
      "configuration:approve",
      "drafts:submit",
      "changes:view",
    ],
  },
  "engineering-manager": {
    name: "Engineering Manager",
    description:
      "Edits the plan and allocations, sees people, with everyone's Personal details and the hiring plan, colours teams on the org chart, and proposes feature teams.",
    permissions: [
      "plan:edit",
      "features:edit",
      "allocations:edit",
      "org-chart:view",
      "people:view",
      "team-colours:edit",
      "feature-teams:propose",
      "personal:view",
      "hiring-plan:view",
      "drafts:submit",
      "changes:view",
    ],
  },
  "engineering-director": {
    name: "Engineering Director",
    description:
      "Edits and approves the plan, features, allocations, people, feature teams, the hiring plan, and configuration, sees all Personal and Confidential data, and sees accounts, roles, settings, and the access history without changing them.",
    permissions: [
      "plan:edit",
      "plan:approve",
      "features:edit",
      "releases:approve",
      "allocations:edit",
      "allocations:approve",
      "people:edit",
      "people:approve",
      "org-chart:view",
      "team-colours:edit",
      "feature-teams:propose",
      "feature-teams:edit",
      "feature-teams:approve",
      "personal:edit",
      "confidential:edit",
      "hiring-plan:edit",
      "hiring-plan:approve",
      "configuration:edit",
      "configuration:approve",
      "drafts:submit",
      "drafts:approve-own",
      "accounts:view",
      "roles:view",
      "settings:view",
      "history:view",
      "changes:view",
    ],
  },
  "workforce-administrator": {
    name: "Workforce Administrator",
    description:
      "Sees the plan, maintains people, teams, reporting lines, feature teams, the hiring plan, and planning configuration, and sees all Personal and Confidential data.",
    permissions: [
      "plan:view",
      "allocations:view",
      "org-chart:view",
      "people:edit",
      "team-colours:edit",
      "feature-teams:edit",
      "personal:edit",
      "confidential:edit",
      "hiring-plan:edit",
      "configuration:edit",
      "changes:view",
    ],
  },
  executive: {
    name: "Executive",
    description:
      "Sees the plan, people, with their Personal and Confidential data and the hiring plan, configuration, accounts, roles, settings, and both histories, without changing them.",
    permissions: [
      "plan:view",
      "allocations:view",
      "people:view",
      "org-chart:view",
      "personal:view",
      "confidential:view",
      "hiring-plan:view",
      "configuration:view",
      "accounts:view",
      "roles:view",
      "settings:view",
      "history:view",
      "changes:view",
    ],
  },
  // Resource Planners see people, since they allocate them, but not their Personal details.
  "resource-planner": {
    name: "Resource Planner",
    description:
      "Sees the plan and people's General details, and edits allocations across the whole plan.",
    permissions: [
      "plan:view",
      "allocations:edit",
      "org-chart:view",
      "people:view",
      "drafts:submit",
      "changes:view",
    ],
  },
  administrator: {
    name: "Administrator",
    description:
      "Manages user accounts, roles, and system settings, without access to the plan or people's data.",
    permissions: [
      "accounts:manage",
      "roles:edit",
      "settings:edit",
      "history:view",
    ],
  },
};
