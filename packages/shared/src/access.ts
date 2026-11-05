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
