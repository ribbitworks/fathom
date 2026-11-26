// SPDX-License-Identifier: Apache-2.0

// Tests that the Overview's tags match the starting roles' Help pages, heading for heading.

import { type Role, roleSchema } from "@fathom/shared";
import { describe, expect, it } from "vitest";
import { helpPage } from "./help-pages.ts";
import { headingsOf } from "./test-help-pages.ts";
import { helpPageOf, overviewJobs } from "./overview-jobs.ts";

const roles = roleSchema.options;

// Each role page's job and task headings, What to Know First and what it holds left out.
const headingsOn = (role: Role) => {
  const page = helpPage(helpPageOf(role));
  if (page === undefined) throw new Error(`No Help page for ${role}`);
  let skipping = false;
  const jobs: string[] = [];
  const tasks: string[] = [];
  for (const { depth, title } of headingsOf(page)) {
    if (depth === 2) {
      skipping = title === "What to Know First";
      if (!skipping) jobs.push(title);
    } else if (depth === 3 && !skipping) {
      tasks.push(title);
    }
  }
  return { jobs, tasks };
};

const holding = (title: string, depth: "jobs" | "tasks") =>
  roles.filter((role) => {
    const { jobs, tasks } = headingsOn(role);
    return (depth === "jobs" ? jobs : tasks).includes(title);
  });

const allTasks = overviewJobs.flatMap((job) =>
  job.tasks.map((task) => ({ job, task })),
);

describe("the Overview's tags", () => {
  it.each(roles)(
    "tag every job and task heading on the %s's Help page",
    (role) => {
      const { jobs, tasks } = headingsOn(role);
      const jobTitles = overviewJobs.map(({ title }) => title);
      const taskTitles = allTasks.map(({ task }) => task.title);
      expect(jobs.filter((title) => !jobTitles.includes(title))).toEqual([]);
      expect(tasks.filter((title) => !taskTitles.includes(title))).toEqual([]);
    },
  );

  it("name for each job the role pages that hold its heading, and only those", () => {
    for (const job of overviewJobs) {
      expect([...job.help].sort(), job.title).toEqual(
        holding(job.title, "jobs").sort(),
      );
    }
  });

  it("name for each task the role pages that hold its heading, and only those", () => {
    for (const { job, task } of allTasks) {
      expect([...(task.help ?? job.help)].sort(), task.title).toEqual(
        holding(task.title, "tasks").sort(),
      );
    }
  });

  it("give each task once", () => {
    const titles = allTasks.map(({ task }) => task.title);
    expect(
      titles.filter((title, index) => titles.indexOf(title) !== index),
    ).toEqual([]);
  });
});
