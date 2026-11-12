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
  // Projects, proposals, customers and milestones.
  "plan:view",
  "plan:edit",
  "plan:approve",
  // Features and their estimates, releases, release streams and cycle patterns.
  "features:view",
  "features:edit",
  "features:approve",
  "allocations:view",
  "allocations:edit",
  "allocations:approve",
  // People, their teams and reporting lines, the org chart, and the colours teams are drawn in.
  "people:view",
  "people:edit",
  "people:approve",
  "feature-teams:view",
  "feature-teams:edit",
  "feature-teams:approve",
  // The hiring plan is Confidential, but has a permission area of its own, apart from other
  // Confidential data.
  "hiring-plan:view",
  "hiring-plan:edit",
  "hiring-plan:approve",
  // Opens the configuration pages, such as Lists; configuration the plan uses is seen with the plan.
  "configuration:view",
  "configuration:edit",
  "configuration:approve",
  // Accounts, roles, settings and the access history.
  "administration:view",
  "administration:edit",
  "personal:view",
  "personal:edit",
  "confidential:view",
  "confidential:edit",
  // Moving built-in details, lists, and columns between the classes the role sees.
  "data:classify",
  // Approving drafts the approver changed themselves, in the areas they approve, which nobody may
  // do without it.
  "drafts:approve-own",
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
      "Sees the plan: projects, proposals, customers, and milestones, with the change history of each.",
    without: "Does not see the plan.",
  },
  "plan:edit": {
    allows: "Drafts changes to projects, proposals, customers, and milestones.",
    without: "Cannot change the plan.",
  },
  "plan:approve": {
    allows:
      "Approves or rejects drafts of projects, proposals, customers, and milestones.",
    without: "Cannot approve drafts of the plan.",
    needs: ["plan:view"],
  },
  "features:view": {
    allows:
      "Sees features, their estimates, and releases, with the change history of each.",
    without: "Does not see features or releases.",
  },
  "features:edit": {
    allows:
      "Drafts changes to features and their estimates, without changing the rest of the plan.",
    without: "Cannot change features or estimates.",
  },
  "features:approve": {
    allows:
      "Approves or rejects drafts of features, releases, release streams, and cycle patterns.",
    without: "Cannot approve drafts of features or releases.",
    needs: ["features:view", "configuration:view"],
  },
  "allocations:view": {
    allows: "Sees allocations: who is assigned to what, and when.",
    without: "Does not see allocations.",
  },
  "allocations:edit": {
    allows: "Drafts changes to allocations across the whole plan.",
    without: "Cannot change allocations.",
  },
  "allocations:approve": {
    allows: "Approves or rejects drafts of allocations.",
    without: "Cannot approve drafts of allocations.",
    needs: ["allocations:view"],
  },
  "people:view": {
    allows:
      "Sees people and their General details, such as position, site, level, and manager, on People and the org chart.",
    without:
      "Does not see people's details; people appear in the plan only by name.",
  },
  "people:edit": {
    allows:
      "Drafts adding, changing, and removing people, with their teams and reporting lines, and chooses the colour each team is drawn in.",
    without: "Cannot change people.",
  },
  "people:approve": {
    allows:
      "Approves or rejects drafts of people, with their teams and reporting lines.",
    without: "Cannot approve drafts of people.",
    needs: ["people:view"],
  },
  "feature-teams:view": {
    allows: "Sees feature teams: who is on each, and who leads it.",
    without: "Does not see feature teams.",
    needs: ["people:view"],
  },
  "feature-teams:edit": {
    allows: "Drafts adding, changing, and removing feature teams.",
    without: "Cannot change feature teams.",
    needs: ["people:view"],
  },
  "feature-teams:approve": {
    allows: "Approves or rejects drafts of feature teams.",
    without: "Cannot approve feature teams.",
    needs: ["feature-teams:view"],
  },
  "hiring-plan:view": {
    allows:
      "Sees the hiring plan: every planned hire, with its target date, drafts, and history.",
    without: "Planned hires appear only as placeholders.",
    needs: ["people:view"],
  },
  "hiring-plan:edit": {
    allows: "Drafts adding, changing, and removing planned hires.",
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
  "administration:view": {
    allows:
      "Sees user accounts and the role each holds, roles and what they grant, Fathom's settings, and the access history.",
    without: "Does not see accounts, roles, settings, or the access history.",
  },
  "administration:edit": {
    allows:
      "Manages user accounts, creates and changes roles, including the role the user holds, and changes settings for the whole of Fathom.",
    without: "Cannot manage accounts, roles, or settings.",
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
  "data:classify": {
    allows:
      "Moves built-in details, lists, and columns to another class, between the classes the role sees.",
    without: "Cannot move data to another class.",
    needs: ["personal:view", "confidential:view"],
  },
  "drafts:approve-own": {
    allows:
      "Approves drafts they changed themselves, in the areas they approve, which otherwise need another approver.",
    without: "Drafts they changed need someone else to approve them.",
    needs: [
      "plan:approve",
      "features:approve",
      "allocations:approve",
      "people:approve",
      "hiring-plan:approve",
      "feature-teams:approve",
      "configuration:approve",
    ],
  },
};

// The permissions that keep Fathom manageable: without an active account holding each, nobody could
// give anyone access again.
export const keptPermissions: readonly Permission[] = ["administration:edit"];

// The change history shows each area's changes to those who see the area, so seeing any area opens
// it.
export const changeHistoryViews: readonly Permission[] = [
  "plan:view",
  "features:view",
  "allocations:view",
  "people:view",
  "feature-teams:view",
  "hiring-plan:view",
  "configuration:view",
];

// The permissions that let a user make drafts, any of which gives them unpublished changes to
// publish or discard.
export const draftingPermissions: readonly Permission[] = [
  "people:edit",
  "configuration:edit",
  "plan:edit",
  "features:edit",
  "allocations:edit",
  "feature-teams:edit",
  "hiring-plan:edit",
];

// The sensitivity tiers of Fathom's data. Roles grant access to tiers, not to screens.
export const tierSchema = z.enum(["general", "personal", "confidential"]);

export type Tier = z.infer<typeof tierSchema>;

// Editing data lets a user view it too, as Roles decides, so a role granting the first grants the
// second, whether or not it is stored.
export const impliedPermissions: Partial<Record<Permission, Permission>> = {
  "plan:edit": "plan:view",
  "features:edit": "features:view",
  "allocations:edit": "allocations:view",
  "people:edit": "people:view",
  "feature-teams:edit": "feature-teams:view",
  "personal:edit": "personal:view",
  "confidential:edit": "confidential:view",
  "hiring-plan:edit": "hiring-plan:view",
  "configuration:edit": "configuration:view",
  "administration:edit": "administration:view",
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
export const gridActions = ["view", "approve", "edit"] as const;

export type GridAction = (typeof gridActions)[number];

// The areas a role grants actions on, as the rows of the grid that sets them, with the permission
// each action on the area is. Every permission is in exactly one place, which a test checks.
export const permissionGrid: readonly {
  area: string;
  actions: Partial<Record<GridAction, Permission>>;
  // The name of a row's only permission, when the action and area together do not read as one.
  name?: string;
}[] = [
  {
    area: "Plan",
    actions: {
      view: "plan:view",
      approve: "plan:approve",
      edit: "plan:edit",
    },
  },
  {
    area: "Features and releases",
    actions: {
      view: "features:view",
      approve: "features:approve",
      edit: "features:edit",
    },
  },
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
  {
    area: "Feature teams",
    actions: {
      view: "feature-teams:view",
      approve: "feature-teams:approve",
      edit: "feature-teams:edit",
    },
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
    area: "Configuration",
    actions: {
      view: "configuration:view",
      approve: "configuration:approve",
      edit: "configuration:edit",
    },
  },
  {
    area: "Administration",
    actions: { view: "administration:view", edit: "administration:edit" },
  },
  {
    area: "Personal details",
    actions: { view: "personal:view", edit: "personal:edit" },
  },
  {
    area: "Confidential data",
    actions: { view: "confidential:view", edit: "confidential:edit" },
  },
  {
    area: "Classify data",
    actions: { edit: "data:classify" },
    name: "Classify data",
  },
  { area: "Their own drafts", actions: { approve: "drafts:approve-own" } },
];

const actionNames: Record<GridAction, string> = {
  view: "View",
  approve: "Approve",
  edit: "Edit",
};

// A permission's short name, such as "Edit People", for lists of what changed.
export function permissionLabel(permission: string): string {
  for (const { area, actions, name: own } of permissionGrid) {
    for (const action of gridActions) {
      // The action is always one of the fixed list above.
      // eslint-disable-next-line security/detect-object-injection
      const [granted, name] = [actions[action], actionNames[action]];
      if (granted === permission) return own ?? `${name} ${area}`;
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
      "Sees the plan, including everyone's work assignments, and people's General details.",
    permissions: [
      "plan:view",
      "features:view",
      "allocations:view",
      "people:view",
      "feature-teams:view",
    ],
  },
  "product-manager": {
    name: "Product Manager",
    description:
      "Edits projects, proposals, features, milestones, releases, products, customers, and estimates across the whole plan, approves or rejects drafts of the plan and releases, and sees people's General details.",
    permissions: [
      "plan:edit",
      "plan:approve",
      "features:edit",
      "features:approve",
      "allocations:view",
      "people:view",
      "feature-teams:view",
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
      "people:view",
      "feature-teams:edit",
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
      "features:approve",
      "allocations:view",
      "allocations:approve",
      "people:view",
      "people:approve",
      "feature-teams:view",
      "feature-teams:approve",
      "hiring-plan:view",
      "hiring-plan:approve",
      "configuration:view",
      "configuration:approve",
    ],
  },
  "engineering-manager": {
    name: "Engineering Manager",
    description:
      "Edits the plan and allocations, sees people, with everyone's Personal details and the hiring plan, and proposes feature teams.",
    permissions: [
      "plan:edit",
      "features:edit",
      "allocations:edit",
      "people:view",
      "feature-teams:edit",
      "hiring-plan:view",
      "personal:view",
    ],
  },
  "engineering-director": {
    name: "Engineering Director",
    description:
      "Edits and approves the plan, features, allocations, people, feature teams, the hiring plan, and configuration, sees all Personal and Confidential data and moves data between classes, and sees accounts, roles, settings, and the access history without changing them.",
    permissions: [
      "plan:edit",
      "plan:approve",
      "features:edit",
      "features:approve",
      "allocations:edit",
      "allocations:approve",
      "people:edit",
      "people:approve",
      "feature-teams:edit",
      "feature-teams:approve",
      "hiring-plan:edit",
      "hiring-plan:approve",
      "configuration:edit",
      "configuration:approve",
      "administration:view",
      "personal:edit",
      "confidential:edit",
      "data:classify",
      "drafts:approve-own",
    ],
  },
  "workforce-administrator": {
    name: "Workforce Administrator",
    description:
      "Sees the plan, maintains people, teams, reporting lines, feature teams, the hiring plan, and planning configuration, and sees all Personal and Confidential data and moves data between classes.",
    permissions: [
      "plan:view",
      "features:view",
      "allocations:view",
      "people:edit",
      "feature-teams:edit",
      "hiring-plan:edit",
      "configuration:edit",
      "personal:edit",
      "confidential:edit",
      "data:classify",
    ],
  },
  executive: {
    name: "Executive",
    description:
      "Sees the plan, people, with their Personal and Confidential data and the hiring plan, configuration, accounts, roles, settings, and both histories, without changing them.",
    permissions: [
      "plan:view",
      "features:view",
      "allocations:view",
      "people:view",
      "feature-teams:view",
      "hiring-plan:view",
      "configuration:view",
      "administration:view",
      "personal:view",
      "confidential:view",
    ],
  },
  // Resource Planners see people, since they allocate them, but not their Personal details.
  "resource-planner": {
    name: "Resource Planner",
    description:
      "Sees the plan and people's General details, and edits allocations across the whole plan.",
    permissions: [
      "plan:view",
      "features:view",
      "allocations:edit",
      "people:view",
      "feature-teams:view",
    ],
  },
  administrator: {
    name: "Administrator",
    description:
      "Manages user accounts, roles, and system settings, without access to the plan or people's data.",
    permissions: ["administration:edit"],
  },
};
