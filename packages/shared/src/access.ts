// SPDX-License-Identifier: Apache-2.0

// The roles Fathom starts with, and the permissions roles grant, each with what it means in plain
// English.

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
  "administrator",
]);

export type Role = z.infer<typeof roleSchema>;

export const permissionSchema = z.enum([
  // Projects, proposals, customers and milestones, and schedules and their cycle patterns, which
  // planning configuration changes and approves too. Schedules are seen with features and releases,
  // or with configuration, not with the plan.
  "plan:view",
  "plan:edit",
  "plan:approve",
  // Features and their estimates, and releases.
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

// Whether some granted permissions include at least one of those wanted.
export const holdsAny = (
  granted: readonly string[],
  wanted: readonly Permission[],
): boolean => wanted.some((permission) => granted.includes(permission));

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
    allows:
      "Drafts changes to projects, proposals, customers, and milestones, and, with View Features and releases or View Configuration, to schedules with their cycles.",
    without: "Cannot change the plan.",
  },
  "plan:approve": {
    allows:
      "Approves or rejects drafts of projects, proposals, customers, and milestones, and, with View Features and releases or View Configuration, of schedules and cycle patterns.",
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
      "Drafts changes to features, their estimates, and the columns on Features, without changing the rest of the plan.",
    without: "Cannot change features, estimates, or the columns on Features.",
  },
  "features:approve": {
    allows: "Approves or rejects drafts of features and releases.",
    without: "Cannot approve drafts of features or releases.",
    needs: ["features:view"],
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
      "Drafts adding, changing, and removing people, with their teams, reporting lines, and the columns on People, and chooses the colour each team is drawn in.",
    without: "Cannot change people or the columns on People.",
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
    allows:
      "Drafts adding, changing, and removing feature teams, and, with Edit Features and releases, each feature's feature team.",
    without: "Cannot change feature teams or which team a feature has.",
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
      "Sees configuration, such as lists of choices and the planning settings.",
    without:
      "Does not see configuration; choices still show wherever they are used.",
  },
  "configuration:edit": {
    allows: "Changes configuration, such as lists of choices and schedules.",
    without: "Cannot change configuration.",
  },
  "configuration:approve": {
    allows:
      "Approves or rejects drafts of configuration, such as lists of choices, the columns on People and Features, and, with View Features and releases or View Configuration, schedules and their cycles.",
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
      "Sees people who haven't started yet, and Personal data of the people the role sees.",
    without:
      "Personal details are hidden wherever they appear, and people who haven't started yet aren't listed.",
    needs: ["people:view", "feature-teams:view"],
  },
  "personal:edit": {
    allows: "Changes Personal details of people.",
    without: "Cannot change Personal details.",
    needs: ["people:edit", "feature-teams:edit"],
  },
  "confidential:view": {
    allows: "Sees Confidential data.",
    without: "Confidential data is hidden wherever it appears.",
    needs: ["people:view", "feature-teams:view"],
  },
  "confidential:edit": {
    allows: "Changes Confidential data.",
    without: "Cannot change Confidential data.",
    needs: ["people:edit", "feature-teams:edit"],
  },
  "data:classify": {
    allows: "Updates data classification of details, lists, and columns.",
    without: "Cannot reclassify data.",
    needs: ["personal:view", "confidential:view"],
  },
  "drafts:approve-own": {
    allows:
      "Approves drafts they changed themselves, in the areas they approve, which otherwise need another approver.",
    without: "Cannot approve their own drafted changes.",
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
// A row of the grid, in the part it belongs to: an area a role reaches; a class of data it sees and
// changes within them; or a permission of its own, named, since its action and area together do
// not read as one.
export type GridRow = {
  area: string;
  actions: Partial<Record<GridAction, Permission>>;
} & (
  | { kind: "area" }
  | { kind: "class"; dataClass: Exclude<Tier, "general"> }
  | { kind: "single"; name: string }
);

export const permissionGrid: readonly GridRow[] = [
  {
    area: "Plan",
    kind: "area",
    actions: {
      view: "plan:view",
      approve: "plan:approve",
      edit: "plan:edit",
    },
  },
  {
    area: "Features and releases",
    kind: "area",
    actions: {
      view: "features:view",
      approve: "features:approve",
      edit: "features:edit",
    },
  },
  {
    area: "Allocations",
    kind: "area",
    actions: {
      view: "allocations:view",
      approve: "allocations:approve",
      edit: "allocations:edit",
    },
  },
  {
    area: "People",
    kind: "area",
    actions: {
      view: "people:view",
      approve: "people:approve",
      edit: "people:edit",
    },
  },
  {
    area: "Feature teams",
    kind: "area",
    actions: {
      view: "feature-teams:view",
      approve: "feature-teams:approve",
      edit: "feature-teams:edit",
    },
  },
  {
    area: "Hiring plan",
    kind: "area",
    actions: {
      view: "hiring-plan:view",
      approve: "hiring-plan:approve",
      edit: "hiring-plan:edit",
    },
  },
  {
    area: "Configuration",
    kind: "area",
    actions: {
      view: "configuration:view",
      approve: "configuration:approve",
      edit: "configuration:edit",
    },
  },
  {
    area: "Administration",
    kind: "area",
    actions: { view: "administration:view", edit: "administration:edit" },
  },
  {
    area: "Personal details",
    actions: { view: "personal:view", edit: "personal:edit" },
    kind: "class",
    dataClass: "personal",
  },
  {
    area: "Confidential data",
    actions: { view: "confidential:view", edit: "confidential:edit" },
    kind: "class",
    dataClass: "confidential",
  },
  {
    area: "Classify data",
    actions: { edit: "data:classify" },
    kind: "single",
    name: "Classify data",
  },
  {
    area: "Their own drafts",
    actions: { approve: "drafts:approve-own" },
    kind: "single",
    name: "Approve own drafts",
  },
];

const actionNames: Record<GridAction, string> = {
  view: "View",
  approve: "Approve",
  edit: "Edit",
};

// A permission's short name, such as "Edit People", for lists of what changed.
export function permissionLabel(permission: string): string {
  for (const row of permissionGrid) {
    for (const action of gridActions) {
      // The action is always one of the fixed list above.
      // eslint-disable-next-line security/detect-object-injection
      const [granted, name] = [row.actions[action], actionNames[action]];
      if (granted === permission) {
        return row.kind === "single" ? row.name : `${name} ${row.area}`;
      }
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
    description: "Sees the plan and people's General details.",
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
      "Edits projects, proposals, features, milestones, releases, customers, and estimates across the whole plan, approves or rejects drafts of the plan and releases, and sees people's General details and configuration.",
    permissions: [
      "plan:edit",
      "plan:approve",
      "features:edit",
      "features:approve",
      "allocations:view",
      "people:view",
      "feature-teams:view",
      "configuration:view",
    ],
  },
  "feature-lead": {
    name: "Feature Lead",
    description:
      "Sees the plan and people's General details, edits features and estimates, and edits feature teams and which team each feature has.",
    permissions: [
      "plan:view",
      "features:edit",
      "people:view",
      "feature-teams:edit",
    ],
  },
  // Project Managers approve drafts, so they see lists, people, and the hiring plan, and can judge
  // drafts of them.
  "project-manager": {
    name: "Project Manager",
    description:
      "Edits the plan, sees people with their Personal and Confidential data and the hiring plan, and approves or rejects drafts of the data the role sees, including allocations and feature teams.",
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
      "personal:view",
      "confidential:view",
    ],
  },
  "engineering-manager": {
    name: "Engineering Manager",
    description:
      "Edits the plan and allocations, sees people, with everyone's Personal and Confidential data, the hiring plan, and configuration, and edits feature teams and which team each feature has.",
    permissions: [
      "plan:edit",
      "features:edit",
      "allocations:edit",
      "people:view",
      "feature-teams:edit",
      "hiring-plan:view",
      "configuration:view",
      "personal:view",
      "confidential:view",
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
  administrator: {
    name: "Administrator",
    description:
      "Manages user accounts, roles, and system settings, without access to the plan or people's data.",
    permissions: ["administration:edit"],
  },
};
