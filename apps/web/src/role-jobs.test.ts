// SPDX-License-Identifier: Apache-2.0

// Tests for the jobs the Overview shows a role: those its permissions allow, by area, each task once.

import {
  type ClassAccess,
  defaultClasses,
  type Permission,
  permissionSchema,
  type Role,
  roleSchema,
  startingRoles,
  withImplied,
} from "@fathom/shared";
import { describe, expect, it } from "vitest";
import { helpPage } from "./help-pages.ts";
import { headingsOf } from "./test-help-pages.ts";
import { helpPageOf, overviewJobs } from "./overview-jobs.ts";
import { overviewPlace } from "./overview-places.ts";
import { jobsFor } from "./role-jobs.ts";

const access = (permissions: readonly Permission[]): ClassAccess => ({
  permissions: withImplied(permissions),
  dataClasses: defaultClasses,
});

const shown = (
  permissions: readonly Permission[],
  acting: string | null = null,
) => jobsFor(access(permissions), acting, overviewPlace(access(permissions)));

const titles = (
  permissions: readonly Permission[],
  acting: string | null = null,
) =>
  shown(permissions, acting).flatMap(({ jobs }) =>
    jobs.map(({ title }) => title),
  );

// The key is always one of the starting roles'.
// eslint-disable-next-line security/detect-object-injection
const permissionsOf = (key: Role) => startingRoles[key].permissions;

const productManager = permissionsOf("product-manager");

// Each starting role's jobs, in the order the Overview shows them.
const startingJobs: Readonly<Record<Role, readonly string[]>> = {
  "team-member": [
    "See What's Planned",
    "Look at a Project",
    "Find Someone",
    "Look at the Teams",
    "Follow What Changed",
  ],
  "product-manager": [
    "Plan the Features",
    "Keep Projects and Proposals Current",
    "Tie Features to Projects and Proposals",
    "Keep the Team's Features Current",
    "Move Work When Dates Change",
    "Ship Features in Releases",
    "Estimate the Features",
    "See What's Planned",
    "Look at a Project",
    "Find Someone",
    "Look at the Teams",
    "Set the Working Time and Cycles",
    "Approve or Reject Drafts",
    "Follow What Changed",
  ],
  "feature-lead": [
    "Plan the Features",
    "Keep the Team's Features Current",
    "Move Work When Dates Change",
    "Ship Features in Releases",
    "Estimate the Features",
    "See What's Planned",
    "Look at a Project",
    "Find Someone",
    "Look at the Teams",
    "Staff the Feature Teams",
    "Follow What Changed",
  ],
  "project-manager": [
    "Plan the Features",
    "Keep Projects and Proposals Current",
    "Tie Features to Projects and Proposals",
    "Keep the Team's Features Current",
    "Move Work When Dates Change",
    "Ship Features in Releases",
    "Estimate the Features",
    "See What's Planned",
    "Look at a Project",
    "Find Someone",
    "Look at the Teams",
    "Set the Working Time and Cycles",
    "See Who Works on What",
    "Check Who Is Over or Under Allocated",
    "Approve or Reject Drafts",
    "Follow What Changed",
  ],
  "engineering-manager": [
    "Plan the Features",
    "Keep Projects and Proposals Current",
    "Tie Features to Projects and Proposals",
    "Keep the Team's Features Current",
    "Move Work When Dates Change",
    "Ship Features in Releases",
    "Estimate the Features",
    "See What's Planned",
    "Look at a Project",
    "Find Someone",
    "Look at the Teams",
    "Staff the Feature Teams",
    "Set the Working Time and Cycles",
    "See Who Works on What",
    "Check Who Is Over or Under Allocated",
    "Follow What Changed",
  ],
  "engineering-director": [
    "Plan the Features",
    "Keep Projects and Proposals Current",
    "Tie Features to Projects and Proposals",
    "Keep the Team's Features Current",
    "Move Work When Dates Change",
    "Ship Features in Releases",
    "Estimate the Features",
    "See What's Planned",
    "Look at a Project",
    "Plan the Hiring",
    "Keep People Current",
    "Find Someone",
    "Look at the Teams",
    "Staff the Feature Teams",
    "Set the Working Time and Cycles",
    "See Who Works on What",
    "Check Who Is Over or Under Allocated",
    "Choose Who Sees Personal and Confidential Data",
    "Set Up the Choices People Pick From",
    "Set Up the Roles",
    "Review Who Holds Each Role",
    "Approve or Reject Drafts",
    "Follow What Changed",
    "Check the Access History",
  ],
  "workforce-administrator": [
    "See What's Planned",
    "Look at a Project",
    "Plan the Hiring",
    "Keep People Current",
    "Find Someone",
    "Look at the Teams",
    "Staff the Feature Teams",
    "Set the Working Time and Cycles",
    "See Who Works on What",
    "Check Who Is Over or Under Allocated",
    "Choose Who Sees Personal and Confidential Data",
    "Set Up the Choices People Pick From",
    "Follow What Changed",
  ],
  executive: [
    "See What's Planned",
    "Look at a Project",
    "Find Someone",
    "Look at the Teams",
    "See Who Works on What",
    "Check Who Is Over or Under Allocated",
    "Set Up the Roles",
    "Review Who Holds Each Role",
    "Follow What Changed",
    "Check the Access History",
  ],
  administrator: [
    "Set Up the Roles",
    "Look After Accounts",
    "Review Who Holds Each Role",
    "Change the Settings",
    "Check the Access History",
  ],
};

describe("the jobs a role is shown", () => {
  it("are all of them, in their one order, for a role holding every permission", () => {
    expect(titles(permissionSchema.options)).toEqual(
      overviewJobs.map(({ title }) => title),
    );
  });

  it("are grouped by area, in the sidebar's order, leaving out an area with none", () => {
    expect(
      shown(productManager, "product-manager").map(({ area }) => area),
    ).toEqual(["Plan", "People", "Capacity", "Drafts", "History"]);
  });

  it("read no role key: a copy of a starting role is shown the same jobs, tasks and places", () => {
    const placesOf = (acting: string | null) =>
      shown(productManager, acting).map(({ area, jobs }) => ({
        area,
        jobs: jobs.map(({ title, where, tasks }) => ({
          title,
          where: where.link,
          tasks: tasks.map((task) => [task.title, task.where.link]),
        })),
      }));
    expect(placesOf(null)).toEqual(placesOf("product-manager"));
  });

  it("show a role holding every permission every task, so no tag names a place nobody opens", () => {
    const tasks = shown(permissionSchema.options).flatMap(({ jobs }) =>
      jobs.flatMap((job) => job.tasks.map(({ title }) => title)),
    );
    expect(tasks).toEqual(
      overviewJobs.flatMap((job) => job.tasks.map(({ title }) => title)),
    );
  });

  it.each(roleSchema.options)(
    "include every job on the %s's own Help page",
    (key) => {
      const page = helpPage(helpPageOf(key));
      const own = (page === undefined ? [] : headingsOf(page))
        .filter(
          ({ depth, title }) => depth === 2 && title !== "What to Know First",
        )
        .map(({ title }) => title);
      expect(own.length).toBeGreaterThan(0);
      const seen = titles(permissionsOf(key), key);
      expect(own.filter((title) => !seen.includes(title))).toEqual([]);
    },
  );

  it.each(roleSchema.options)(
    "are exactly the %s's, as the approved design gives them",
    (key) => {
      // The key is always one of the starting roles'.
      // eslint-disable-next-line security/detect-object-injection
      expect(titles(permissionsOf(key), key)).toEqual(startingJobs[key]);
    },
  );

  it("are only what a custom role's permissions allow", () => {
    // Given a role that edits and approves the plan and sees people, with nothing on features
    expect(
      titles(["plan:view", "plan:edit", "plan:approve", "people:view"]),
    ).toEqual([
      "Keep Projects and Proposals Current",
      "Move Work When Dates Change",
      "Look at a Project",
      "Find Someone",
      "Look at the Teams",
      "Approve or Reject Drafts",
      "Follow What Changed",
    ]);
    expect(titles(["plan:view"])).toEqual([
      "Look at a Project",
      "Follow What Changed",
    ]);
  });

  it("are none for a role with no permission", () => {
    expect(shown([])).toEqual([]);
  });

  it("show each task once, under the first job shown that has it", () => {
    const tasks = shown(permissionSchema.options).flatMap(({ jobs }) =>
      jobs.flatMap((job) => job.tasks.map(({ title }) => title)),
    );
    expect(
      tasks.filter((title, index) => tasks.indexOf(title) !== index),
    ).toEqual([]);
  });

  it("leave out a task whose place the role doesn't open, and a job left with none", () => {
    const tied = shown(["plan:view", "plan:edit"])
      .flatMap(({ jobs }) => jobs)
      .find(({ title }) => title === "Tie Features to Projects and Proposals");
    expect(tied).toBeUndefined();
    const moved = shown(["plan:view", "plan:edit"])
      .flatMap(({ jobs }) => jobs)
      .find(({ title }) => title === "Move Work When Dates Change");
    expect(moved?.tasks.map(({ title }) => title)).toEqual([
      "Move a Milestone",
    ]);
  });
});

describe("a job's place and Help", () => {
  const jobOf = (
    permissions: readonly Permission[],
    title: string,
    acting: string | null = null,
  ) =>
    shown(permissions, acting)
      .flatMap(({ jobs }) => jobs)
      .find((job) => job.title === title);

  it("is its own page when the role opens it and a task shown is done there, otherwise its first task's", () => {
    expect(
      jobOf(productManager, "Move Work When Dates Change")?.where.item.label,
    ).toBe("Features");
    expect(
      jobOf(["plan:view", "plan:edit"], "Move Work When Dates Change")?.where
        .item.label,
    ).toBe("Projects");
    expect(
      jobOf(
        ["configuration:view", "configuration:edit"],
        "Set the Working Time and Cycles",
      )?.where.item.label,
    ).toBe("Planning settings");
  });

  it("is the acting role's own Help page where it has the heading, otherwise the first that does", () => {
    expect(
      jobOf(productManager, "Approve or Reject Drafts", "project-manager")
        ?.help,
    ).toBe("project-manager");
    expect(jobOf(productManager, "Approve or Reject Drafts")?.help).toBe(
      "product-manager",
    );
  });
});

describe("a part's link", () => {
  it.each([
    ["Drafts", "To decide", "/drafts", { tab: "decide" }],
    ["Capacity", "Feature teams", "/capacity", { mode: "feature-teams" }],
    ["Capacity", "Allocations", "/capacity", { mode: "allocations" }],
    ["Org chart", "Feature teams", "/org-chart", { teams: "feature" }],
    ["Releases", "Schedules", "/releases/{-$streamId}", { tab: "schedules" }],
    ["People", "Metrics", "/people", { breakdown: [] }],
  ])("opens %s › %s on its part", (page, part, to, search) => {
    const where = overviewPlace(access(permissionSchema.options))({
      page,
      part,
    });
    expect(where?.link).toMatchObject({ to, search });
  });

  it("leaves out a part the role doesn't open, though it opens the page", () => {
    expect(
      overviewPlace(access(["plan:view"]))({
        page: "Drafts",
        part: "To decide",
      }),
    ).toBeUndefined();
  });
});
