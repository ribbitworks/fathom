// SPDX-License-Identifier: Apache-2.0

// The Overview's jobs: each job and task on the starting roles' Help pages, by its heading, with the
// area it shows under, what it needs, where it's done and the role pages that hold it.

import type { ClassifiedView, Permission, Role } from "@fathom/shared";

export const overviewAreas = [
  "Plan",
  "People",
  "Capacity",
  "Administration",
  "Drafts",
  "History",
] as const;

export type OverviewArea = (typeof overviewAreas)[number];

// What a job or task needs: a permission, either of several, a permission to approve any kind of
// draft, one that shows any data the change history records, or a view needing classified details.
export type Need =
  | Permission
  | readonly Permission[]
  | "approve:any"
  | "view:any"
  | { view: ClassifiedView };

// A sidebar page by its name, and a part of it that needs no record, such as a tab.
export interface PlaceName {
  page: string;
  part?: string;
}

export const helpPageOf = (role: Role): string =>
  `working-as-${/^[aeiou]/u.test(role) ? "an" : "a"}-${role}`;

// The role pages that hold a heading, the first the one its Help link goes to for a role whose own
// page doesn't.
export type HelpPages = readonly [Role, ...Role[]];

export interface TaskTag {
  title: string;
  // What it needs beyond its job's, and beyond opening its place.
  needs?: readonly Need[];
  place: PlaceName;
  // The role pages that hold it, when not its job's.
  help?: HelpPages;
}

export interface JobTag {
  title: string;
  area: OverviewArea;
  needs: readonly Need[];
  place: PlaceName;
  help: HelpPages;
  tasks: readonly TaskTag[];
}

const on = (page: string, part?: string): PlaceName =>
  part === undefined ? { page } : { page, part };

// In the one order every role sees them: areas as the sidebar has them, then in each area the jobs
// that change data before those that only read.
export const overviewJobs: readonly JobTag[] = [
  {
    title: "Plan the Features",
    area: "Plan",
    needs: ["features:edit"],
    place: on("Features"),
    help: ["product-manager"],
    tasks: [
      { title: "Add a Feature", place: on("Features") },
      { title: "Say When a Feature Is Needed", place: on("Features") },
      { title: "Choose the Target Cycle and Team", place: on("Features") },
      {
        title: "Add a Column to Features",
        needs: ["people:view"],
        place: on("Features"),
      },
    ],
  },
  {
    title: "Keep Projects and Proposals Current",
    area: "Plan",
    needs: ["plan:edit"],
    place: on("Projects"),
    help: ["product-manager", "project-manager"],
    tasks: [
      { title: "Add Customers, Proposals and Projects", place: on("Projects") },
      { title: "Change a Proposal's Status", place: on("Projects") },
      {
        title: "Add or Change Milestones",
        place: on("Projects"),
        help: ["project-manager", "product-manager"],
      },
    ],
  },
  {
    title: "Tie Features to Projects and Proposals",
    area: "Plan",
    needs: ["plan:edit"],
    place: on("Projects"),
    help: ["product-manager", "project-manager"],
    tasks: [
      {
        title: "Choose the Features a Project Needs",
        needs: ["features:view"],
        place: on("Projects"),
      },
      {
        title: "Say Why a Feature Leaves a Proposal",
        needs: ["features:view"],
        place: on("Projects"),
        help: ["product-manager"],
      },
      {
        title: "Read the Scope History",
        needs: ["features:view"],
        place: on("Projects"),
      },
      {
        title: "See Where Each Feature Stands",
        needs: ["features:view"],
        place: on("Projects"),
        help: ["project-manager"],
      },
    ],
  },
  {
    title: "Keep the Team's Features Current",
    area: "Plan",
    needs: ["features:edit"],
    place: on("Features"),
    help: ["feature-lead"],
    tasks: [
      { title: "Change a Feature's Status", place: on("Features") },
      { title: "Write a Note", place: on("Features") },
    ],
  },
  {
    title: "Move Work When Dates Change",
    area: "Plan",
    needs: [["plan:edit", "features:edit"]],
    place: on("Features"),
    help: ["project-manager"],
    tasks: [
      {
        title: "Move a Feature to Another Cycle",
        needs: ["features:edit"],
        place: on("Features"),
      },
      {
        title: "Move a Milestone",
        needs: ["plan:edit"],
        place: on("Projects"),
      },
    ],
  },
  {
    title: "Ship Features in Releases",
    area: "Plan",
    needs: ["features:edit"],
    place: on("Releases"),
    help: ["project-manager"],
    tasks: [
      { title: "Make a Release", place: on("Releases") },
      { title: "Write What a Release Ships", place: on("Releases") },
      { title: "See What a Release Holds", place: on("Releases") },
    ],
  },
  {
    title: "Estimate the Features",
    area: "Plan",
    needs: ["features:edit"],
    place: on("Features"),
    help: ["engineering-manager"],
    tasks: [
      {
        title: "Give an Estimate",
        place: on("Features"),
        help: ["engineering-manager", "feature-lead"],
      },
      { title: "See What Each Cycle Holds", place: on("Features") },
      { title: "Find Features Not Staffed", place: on("Features") },
    ],
  },
  {
    title: "See What's Planned",
    area: "Plan",
    needs: ["features:view"],
    place: on("Features"),
    help: ["team-member", "feature-lead", "executive"],
    tasks: [
      {
        title: "See What Each Cycle or Release Holds",
        place: on("Features"),
      },
      {
        title: "See Features as a Board",
        place: on("Features"),
        help: ["feature-lead"],
      },
      {
        title: "See When Each Release Ships",
        place: on("Releases"),
        help: ["team-member", "executive"],
      },
      {
        title: "See Only What's Approved",
        place: on("Features"),
        help: ["executive"],
      },
    ],
  },
  {
    title: "Look at a Project",
    area: "Plan",
    needs: ["plan:view"],
    place: on("Projects"),
    help: ["team-member"],
    tasks: [
      { title: "See a Project's Details", place: on("Projects") },
      { title: "See a Project's Milestones", place: on("Projects") },
    ],
  },
  {
    title: "Plan the Hiring",
    area: "People",
    needs: ["hiring-plan:edit"],
    place: on("People"),
    help: ["engineering-director", "workforce-administrator"],
    tasks: [
      { title: "Request a Hire", place: on("People") },
      { title: "Mark a Hire Approved", place: on("People") },
      { title: "Fill a Hire", place: on("People") },
    ],
  },
  {
    title: "Keep People Current",
    area: "People",
    needs: ["people:edit"],
    place: on("People"),
    help: ["workforce-administrator", "engineering-director"],
    tasks: [
      {
        title: "Add a New Starter",
        needs: ["personal:edit"],
        place: on("People"),
        help: ["workforce-administrator"],
      },
      {
        title: "Record Someone Leaving",
        needs: ["personal:edit"],
        place: on("People"),
      },
      { title: "Give Someone a New Manager", place: on("People") },
    ],
  },
  {
    title: "Find Someone",
    area: "People",
    needs: ["people:view"],
    place: on("Org chart"),
    help: ["team-member", "feature-lead", "executive"],
    tasks: [
      {
        title: "Find a Person or Team",
        place: on("Org chart"),
        help: [
          "team-member",
          "feature-lead",
          "executive",
          "engineering-manager",
        ],
      },
      {
        title: "See Someone's Details",
        place: on("Org chart"),
        help: ["team-member", "feature-lead"],
      },
      {
        title: "Count People by a Column",
        place: on("People", "Metrics"),
        help: ["executive"],
      },
    ],
  },
  {
    title: "Look at the Teams",
    area: "People",
    needs: ["people:view"],
    place: on("Org chart"),
    help: ["engineering-manager"],
    tasks: [
      { title: "Show One Team Alone", place: on("Org chart") },
      {
        title: "See Another Date",
        needs: [{ view: "orgChartOtherDates" }],
        place: on("Org chart"),
        help: ["executive", "engineering-manager", "engineering-director"],
      },
    ],
  },
  {
    title: "Staff the Feature Teams",
    area: "Capacity",
    needs: ["feature-teams:edit"],
    place: on("Capacity", "Feature teams"),
    help: ["engineering-manager", "workforce-administrator", "feature-lead"],
    tasks: [
      {
        title: "Put Someone on a Team From a Month",
        place: on("Capacity", "Feature teams"),
        help: ["engineering-manager", "workforce-administrator"],
      },
      {
        title: "Change a Team's Lead or Members",
        place: on("Org chart", "Feature teams"),
        help: ["engineering-manager", "feature-lead"],
      },
      {
        title: "Add, Rename or Remove a Team",
        place: on("Org chart", "Feature teams"),
        help: ["workforce-administrator"],
      },
    ],
  },
  {
    title: "Set the Working Time and Cycles",
    area: "Capacity",
    needs: [["configuration:edit", "plan:edit"]],
    place: on("Planning settings"),
    help: ["workforce-administrator"],
    tasks: [
      {
        title: "Set Hours and Working Days",
        needs: ["configuration:edit"],
        place: on("Planning settings"),
      },
      {
        title: "Add a Schedule and Its Cycles",
        place: on("Releases", "Schedules"),
      },
    ],
  },
  {
    title: "See Who Works on What",
    area: "Capacity",
    needs: [["feature-teams:view", "allocations:view"]],
    place: on("Capacity"),
    help: ["project-manager", "executive"],
    tasks: [
      {
        title: "See Who Is on Each Feature Team",
        place: on("Capacity", "Feature teams"),
      },
      {
        title: "See What Each Person Works On",
        place: on("Capacity", "Allocations"),
      },
    ],
  },
  {
    title: "Check Who Is Over or Under Allocated",
    area: "Capacity",
    needs: ["allocations:view"],
    place: on("Capacity", "Allocations"),
    help: ["engineering-manager"],
    tasks: [
      {
        title: "Group by Feature Team",
        place: on("Capacity", "Allocations"),
        help: ["engineering-manager", "project-manager"],
      },
      {
        title: "Show Only Who Is Over or Under",
        place: on("Capacity", "Allocations"),
      },
    ],
  },
  {
    title: "Choose Who Sees Personal and Confidential Data",
    area: "Administration",
    needs: ["data:classify"],
    place: on("Data classes"),
    help: ["engineering-director", "workforce-administrator"],
    tasks: [
      { title: "See What Each Class Holds", place: on("Data classes") },
      { title: "Change a Class", place: on("Data classes") },
    ],
  },
  {
    title: "Set Up the Choices People Pick From",
    area: "Administration",
    needs: ["configuration:edit"],
    place: on("Lists"),
    help: ["workforce-administrator"],
    tasks: [
      { title: "Add Choices to a List", place: on("Lists") },
      { title: "Rename the Statuses Fathom Starts With", place: on("Lists") },
      { title: "Retire a Choice No Longer Used", place: on("Lists") },
      { title: "Make a New List", needs: ["people:view"], place: on("Lists") },
    ],
  },
  {
    title: "Set Up the Roles",
    area: "Administration",
    needs: ["administration:view"],
    place: on("Roles"),
    help: ["administrator"],
    tasks: [
      { title: "See What a Role Gives", place: on("Roles") },
      {
        title: "Change What a Role Gives",
        needs: ["administration:edit"],
        place: on("Roles"),
      },
      {
        title: "Make a Role From a Copy",
        needs: ["administration:edit"],
        place: on("Roles"),
      },
      {
        title: "Restore a Starting Role",
        needs: ["administration:edit"],
        place: on("Roles"),
      },
    ],
  },
  {
    title: "Look After Accounts",
    area: "Administration",
    needs: ["administration:edit"],
    place: on("Accounts"),
    help: ["administrator"],
    tasks: [
      { title: "Make an Account", place: on("Accounts") },
      { title: "Change an Account's Roles", place: on("Accounts") },
      { title: "Reset a Password", place: on("Accounts") },
      { title: "Deactivate an Account", place: on("Accounts") },
    ],
  },
  {
    title: "Review Who Holds Each Role",
    area: "Administration",
    needs: ["administration:view"],
    place: on("Accounts"),
    help: ["administrator"],
    tasks: [
      { title: "Filter Accounts by Role", place: on("Accounts") },
      {
        title: "Take Away Roles No Longer Needed",
        needs: ["administration:edit"],
        place: on("Accounts"),
      },
    ],
  },
  {
    title: "Change the Application Settings",
    area: "Administration",
    needs: ["administration:edit"],
    place: on("Application settings"),
    help: ["administrator"],
    tasks: [
      { title: "Change the Time Zone", place: on("Application settings") },
      {
        title: "Set the Rules for Passwords",
        place: on("Application settings"),
      },
    ],
  },
  {
    title: "Approve or Reject Drafts",
    area: "Drafts",
    needs: ["approve:any"],
    place: on("Drafts", "To decide"),
    help: ["product-manager", "project-manager", "engineering-director"],
    tasks: [
      {
        title: "Approve on the Drafts Page",
        place: on("Drafts", "To decide"),
      },
      {
        title: "Approve All a Table Shows",
        needs: ["features:approve"],
        place: on("Features"),
        help: ["product-manager"],
      },
      {
        title: "Check What a Draft Holds",
        place: on("Drafts", "To decide"),
        help: ["project-manager"],
      },
      {
        title: "Approve Own Drafts",
        needs: ["drafts:approve-own"],
        place: on("Drafts", "To decide"),
        help: ["engineering-director"],
      },
      {
        title: "Reject a Draft With a Reason",
        place: on("Drafts", "To decide"),
      },
    ],
  },
  {
    title: "Follow What Changed",
    area: "History",
    needs: ["view:any"],
    place: on("Change history"),
    help: ["executive"],
    tasks: [
      { title: "Find a Change", place: on("Change history") },
      {
        title: "Look at Accounts, Roles and Application Settings",
        needs: ["administration:view"],
        place: on("Accounts"),
      },
    ],
  },
  {
    title: "Check the Access History",
    area: "History",
    needs: ["administration:view"],
    place: on("Access history"),
    help: ["administrator", "executive"],
    tasks: [
      { title: "Find an Entry", place: on("Access history") },
      {
        title: "Check the Marked Entries",
        place: on("Access history"),
        help: ["administrator"],
      },
    ],
  },
];
