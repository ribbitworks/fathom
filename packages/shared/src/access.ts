// SPDX-License-Identifier: Apache-2.0

// The roles Fathom starts with, and the permissions roles grant, with what each permission means in
// plain English, as the Decisions Log sets out. Roles are kept in the database, where they can be
// edited; the front end uses a user's permissions to show only what they can do, and the server
// enforces them.

import { z } from "zod";

export const roleSchema = z.enum([
  "viewer",
  "project-planner",
  "resource-planner",
  "people-manager",
  "workforce-administrator",
  "leadership",
  "approver",
  "administrator",
]);

export type Role = z.infer<typeof roleSchema>;

export const permissionSchema = z.enum([
  "plan:view",
  "plan:edit",
  "allocations:view",
  "allocations:edit",
  "people:view",
  "people:edit",
  // Feature teams are General data. Roles proposes that seeing them comes with seeing the plan.
  "feature-teams:propose",
  "feature-teams:edit",
  "feature-teams:approve",
  "restricted:view",
  "restricted:edit",
  "confidential:view",
  "confidential:edit",
  // Opens the configuration pages, such as Lists; configuration the plan uses is seen with the plan.
  "configuration:view",
  "configuration:edit",
  "drafts:submit",
  "drafts:approve",
  "accounts:manage",
  // Changing what roles grant, apart from managing accounts, as the Decisions Log sets out.
  "roles:edit",
  "history:view",
  // The change history, holding only changes to data the reader may see.
  "changes:view",
]);

export type Permission = z.infer<typeof permissionSchema>;

// What each permission lets a user do, and what a user without it cannot, in plain English, for
// showing the result of setting roles, and any permission it does nothing without. Pages that do not
// appear without a permission are worked out from the pages themselves, so these speak only of data
// and actions. Every permission must be described, which the compiler checks.
export const permissionDescriptions: Record<
  Permission,
  { allows: string; without: string; needs?: Permission }
> = {
  "plan:view": {
    allows:
      "Sees the plan: projects, proposals, features, milestones, and releases.",
    without: "Does not see the plan.",
  },

  "plan:edit": {
    allows: "Changes the plan across every project.",
    without: "Cannot change the plan.",
  },
  "allocations:view": {
    allows: "Sees allocations: who is assigned to what, and when.",
    without: "Does not see allocations.",
  },
  "allocations:edit": {
    allows: "Changes allocations across the whole plan.",
    without: "Cannot change allocations.",
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
  "feature-teams:propose": {
    allows: "Proposes feature teams for approval.",
    without: "Cannot propose feature teams.",
  },
  "feature-teams:edit": {
    allows: "Changes feature teams.",
    without: "Cannot change feature teams.",
  },
  "feature-teams:approve": {
    allows: "Approves or rejects proposed feature teams.",
    without: "Cannot approve feature teams.",
  },
  "restricted:view": {
    allows:
      "Sees former employees, and Restricted details of the people the role sees, such as gender, start and end dates, and past managers.",
    without:
      "Restricted details are hidden wherever they appear, and only current staff are listed.",
    needs: "people:view",
  },

  "restricted:edit": {
    allows: "Changes Restricted details of people.",
    without: "Cannot change Restricted details.",
    needs: "people:edit",
  },

  "confidential:view": {
    allows:
      "Sees Confidential data, such as the hiring plan and future-dated reorganizations.",
    without:
      "Confidential data is hidden; planned hires appear only as placeholders.",
    needs: "people:view",
  },

  "confidential:edit": {
    allows: "Changes Confidential data, such as the hiring plan.",
    without: "Cannot change Confidential data.",
    needs: "people:edit",
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
  "drafts:submit": {
    allows:
      "Makes drafts of changes to the plan and allocations, for approval, once those can be changed in Fathom.",
    without: "Cannot make drafts of changes to the plan or allocations.",
  },

  "drafts:approve": {
    allows: "Approves or rejects drafts of the data their roles let them see.",
    without: "Cannot approve drafts.",
  },
  "accounts:manage": {
    allows:
      "Manages user accounts: creates them, changes their names, email addresses, and roles, resets passwords, and deactivates them.",
    without: "Cannot manage user accounts.",
  },
  "roles:edit": {
    allows:
      "Creates and changes roles: their names, descriptions, and what they grant, including roles the user holds.",
    without: "Cannot change roles.",
  },
  "history:view": {
    allows:
      "Sees the access history: who changed accounts or protected data, or looked at protected data, and when.",
    without: "Does not see the access history.",
  },

  "changes:view": {
    allows: "Sees the change history of the data their roles let them see.",
    without: "Does not see the change history.",
  },
};

// The sensitivity tiers of Fathom's data. Roles grant access to tiers, not to screens.
export const tierSchema = z.enum(["general", "restricted", "confidential"]);

export type Tier = z.infer<typeof tierSchema>;

// Editing data lets a user view it too, as Roles decides, so a role granting the first grants the
// second, whether or not it is stored.
export const impliedPermissions: Partial<Record<Permission, Permission>> = {
  "plan:edit": "plan:view",
  "allocations:edit": "allocations:view",
  "people:edit": "people:view",
  "restricted:edit": "restricted:view",
  "confidential:edit": "confidential:view",
  "configuration:edit": "configuration:view",
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

// The actions a role can be given on an area, as the columns of the grid that sets them.
export const gridActions = ["view", "draft", "approve", "edit"] as const;

export type GridAction = (typeof gridActions)[number];

// The areas a role grants actions on, as the rows of the grid that sets them, with the permission
// each action on the area is. Every permission is in exactly one place, which a test checks.
export const permissionGrid: readonly {
  area: string;
  actions: Partial<Record<GridAction, Permission>>;
}[] = [
  { area: "Plan", actions: { view: "plan:view", edit: "plan:edit" } },
  {
    area: "Allocations",
    actions: { view: "allocations:view", edit: "allocations:edit" },
  },
  { area: "People", actions: { view: "people:view", edit: "people:edit" } },
  {
    area: "Restricted details",
    actions: { view: "restricted:view", edit: "restricted:edit" },
  },
  {
    area: "Confidential data",
    actions: { view: "confidential:view", edit: "confidential:edit" },
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
    area: "Drafts of every kind",
    actions: { draft: "drafts:submit", approve: "drafts:approve" },
  },
  {
    area: "Configuration",
    actions: { view: "configuration:view", edit: "configuration:edit" },
  },
  { area: "Change history", actions: { view: "changes:view" } },
  { area: "Access history", actions: { view: "history:view" } },
  { area: "Accounts", actions: { edit: "accounts:manage" } },
  { area: "Roles", actions: { edit: "roles:edit" } },
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

// The roles Fathom starts with, as the migrations store them, which a test checks: their names,
// what each is for, and what each grants. A starting role can be put back to this version from the
// Roles page. Every role must be listed, which the compiler checks.
export const startingRoles: Record<
  Role,
  { name: string; description: string; permissions: readonly Permission[] }
> = {
  viewer: {
    name: "Viewer",
    description: "Sees the plan, including everyone's work assignments.",
    permissions: ["plan:view", "allocations:view", "changes:view"],
  },
  "project-planner": {
    name: "Project Planner",
    description:
      "Edits projects, proposals, features, milestones, releases, products, customers, and estimates across the whole plan.",
    permissions: ["plan:edit", "drafts:submit", "changes:view"],
  },
  // Resource Planners see people, since they allocate them.
  "resource-planner": {
    name: "Resource Planner",
    description:
      "Sees people's General details, and edits allocations across the whole plan.",
    permissions: [
      "people:view",
      "allocations:edit",
      "drafts:submit",
      "changes:view",
    ],
  },
  // People Managers edit feature teams directly until plan approval arrives, as Roles sets out.
  "people-manager": {
    name: "People Manager",
    description:
      "Sees people, including everyone's Restricted details, and proposes feature teams.",
    permissions: [
      "people:view",
      "feature-teams:propose",
      "feature-teams:edit",
      "restricted:view",
      "changes:view",
    ],
  },
  "workforce-administrator": {
    name: "Workforce Administrator",
    description:
      "Maintains people, teams, reporting lines, feature teams, the hiring plan, and planning configuration, and sees all Restricted and Confidential data.",
    permissions: [
      "people:edit",
      "feature-teams:edit",
      "restricted:edit",
      "confidential:edit",
      "configuration:edit",
      "changes:view",
    ],
  },
  leadership: {
    name: "Leadership",
    description:
      "Sees people, with their Restricted and Confidential data, without editing it.",
    permissions: [
      "people:view",
      "restricted:view",
      "confidential:view",
      "changes:view",
    ],
  },
  // Approvers see lists, so every Approver can judge drafts of them.
  approver: {
    name: "Approver",
    description:
      "Approves or rejects drafts of the data their roles let them see.",
    permissions: [
      "drafts:approve",
      "feature-teams:approve",
      "configuration:view",
      "changes:view",
    ],
  },
  administrator: {
    name: "Administrator",
    description:
      "Manages user accounts, role assignments, and system settings, without access to Restricted or Confidential data.",
    permissions: ["accounts:manage", "roles:edit", "history:view"],
  },
};
