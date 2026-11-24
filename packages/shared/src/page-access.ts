// SPDX-License-Identifier: Apache-2.0

// What opens each page: any one of some permissions, each with the other permissions and the
// classified view it needs where the page shows nothing without them, so a page a role would find
// empty or unable to load is left out rather than shown cut down. The sidebar and the pages'
// addresses read each page's needs from here, so they give one answer.

import { changeHistoryViews, type Permission } from "./access.ts";
import {
  allocationsGridPermissions,
  featureTeamsTabPermissions,
  type ClassAccess,
  type ClassifiedView,
  seesView,
} from "./data-classes.ts";

export interface PageNeed {
  permission: Permission;
  // Other permissions the page reads with it, such as those of data it draws on.
  with?: readonly Permission[];
  view?: ClassifiedView;
}

export type PageNeeds = Permission | readonly (Permission | PageNeed)[];

const needsOf = (needs: PageNeeds): PageNeed[] =>
  (typeof needs === "string" ? [needs] : needs).map((need) =>
    typeof need === "string" ? { permission: need } : need,
  );

// Whether a role holds a permission that would open the page, whatever data it sees.
export const reaches = (needs: PageNeeds, permissions: readonly Permission[]) =>
  needsOf(needs).some(({ permission }) => permissions.includes(permission));

// Whether a role opens the page: it holds one of the permissions with the others that one needs, and
// sees the data it needs.
export const opensWith = (needs: PageNeeds, access: ClassAccess) =>
  needsOf(needs).some(
    ({ permission, with: others = [], view }) =>
      [permission, ...others].every((one) =>
        access.permissions.includes(one),
      ) &&
      (view === undefined || seesView(view, access)),
  );

export const capacityModeNames = [
  "feature-teams",
  "allocations",
  "coverage",
  "settings",
] as const;

export type CapacityMode = (typeof capacityModeNames)[number];

const [allocationsOpening, ...allocationsOthers] = allocationsGridPermissions;
const [featureTeamsOpening] = featureTeamsTabPermissions;

// Allocations also needs what its grid reads, the feature teams' months and the org chart's planned
// hires, with the Personal details they need.
export const capacityModeNeeds: Record<CapacityMode, PageNeed> = {
  "feature-teams": {
    permission: featureTeamsOpening,
    view: "featureAssignments",
  },
  allocations: {
    permission: allocationsOpening,
    with: allocationsOthers,
    view: "allocations",
  },
  // Coverage reads the allocations as Allocations does, and the features and planning settings its
  // forecast needs.
  coverage: {
    permission: allocationsOpening,
    with: [...allocationsOthers, "features:view", "configuration:view"],
    view: "allocations",
  },
  settings: { permission: "configuration:view" },
};

// The pages that need a permission; every other page, such as Help, is open to everyone signed in.
export const pageNeeds = {
  overview: "plan:view",
  projects: "plan:view",
  features: "features:view",
  releases: ["features:view", "configuration:view"],
  people: "people:view",
  "org-chart": "people:view",
  // Drafts of people and feature teams, of lists, which Approvers see, and of the plan's records.
  drafts: ["people:view", "configuration:view", "plan:view", "features:view"],
  // The page opens for a role that sees any of its modes.
  capacity: Object.values(capacityModeNeeds),
  lists: "configuration:view",
  accounts: "administration:view",
  roles: "administration:view",
  settings: "administration:view",
  "data-classes": "data:classify",
  changes: changeHistoryViews,
  history: "administration:view",
} as const satisfies Record<string, PageNeeds>;

export type GuardedPage = keyof typeof pageNeeds;
