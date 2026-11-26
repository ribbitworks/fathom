// SPDX-License-Identifier: Apache-2.0

// The jobs the Overview shows a role: those its permissions allow, by area, each task once.

import {
  approvableKinds,
  changeHistoryViews,
  type ClassAccess,
  type Permission,
  type Role,
  seesView,
} from "@fathom/shared";
import {
  type HelpPages,
  type JobTag,
  type Need,
  type OverviewArea,
  overviewAreas,
  overviewJobs,
  type PlaceName,
} from "./overview-jobs.ts";

export interface ShownTask<Where> {
  title: string;
  where: Where;
  // The role page its Help link goes to.
  help: Role;
}

export interface ShownJob<Where> extends ShownTask<Where> {
  tasks: ShownTask<Where>[];
}

export interface ShownArea<Where> {
  area: OverviewArea;
  jobs: ShownJob<Where>[];
}

export function holdsNeed(access: ClassAccess, need: Need): boolean {
  const held = (permission: Permission) =>
    access.permissions.includes(permission);
  if (need === "approve:any") {
    return approvableKinds(access.permissions).length > 0;
  }
  if (need === "view:any") return changeHistoryViews.some(held);
  if (typeof need === "string") return held(need);
  return "view" in need ? seesView(need.view, access) : need.some(held);
}

const holdsAll = (access: ClassAccess, needs: readonly Need[]) =>
  needs.every((need) => holdsNeed(access, need));

// The acting starting role's own page where it holds the heading, otherwise the first that does.
const helpFor = (pages: HelpPages, acting: string | null): Role =>
  pages.find((page) => page === acting) ?? pages[0];

const doneAt = (task: PlaceName, job: PlaceName) =>
  task.page === job.page && (job.part === undefined || task.part === job.part);

// Every job the role's permissions allow, grouped by area in the one fixed order, each with the tasks
// it holds everything for, a task shown only under the first job shown that has it. A job leads to
// its own place when the role opens it and a task shown is done there, otherwise to its first task's.
export function jobsFor<Where>(
  access: ClassAccess,
  acting: string | null,
  whereOf: (place: PlaceName) => Where | undefined,
  jobs: readonly JobTag[] = overviewJobs,
): ShownArea<Where>[] {
  const seen = new Set<string>();
  const shown = jobs.flatMap((job) => {
    if (!holdsAll(access, job.needs)) return [];
    const tasks = job.tasks.flatMap((task) => {
      const where = whereOf(task.place);
      return where === undefined ||
        seen.has(task.title) ||
        !holdsAll(access, task.needs ?? [])
        ? []
        : [{ task, where }];
    });
    const [first] = tasks;
    if (first === undefined) return [];
    for (const { task } of tasks) seen.add(task.title);
    const own = whereOf(job.place);
    const where =
      own !== undefined &&
      tasks.some(({ task }) => doneAt(task.place, job.place))
        ? own
        : first.where;
    return [
      {
        area: job.area,
        job: {
          title: job.title,
          where,
          help: helpFor(job.help, acting),
          tasks: tasks.map(({ task, where: taskWhere }) => ({
            title: task.title,
            where: taskWhere,
            help: helpFor(task.help ?? job.help, acting),
          })),
        },
      },
    ];
  });
  return overviewAreas.flatMap((area) => {
    const inArea = shown.filter((one) => one.area === area);
    return inArea.length === 0
      ? []
      : [{ area, jobs: inArea.map(({ job }) => job) }];
  });
}
