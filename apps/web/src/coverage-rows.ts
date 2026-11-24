// SPDX-License-Identifier: Apache-2.0

// Capacity's Coverage rows: each work, its effort needed, the hours its allocations deliver, and how
// its effort spreads over the months, from the plan, the allocations and the planning settings.

import {
  type Coverage,
  deliveredHours,
  effortNeeded,
  type Feature,
  firstMonthIn,
  isForecast,
  type Meaning,
  neededByMonth,
  type PlanningSettings,
  type ReleaseStreams,
  type Show,
  targetCycleMonths,
} from "@fathom/shared";
import type { CellRecord } from "./record-table.ts";
import {
  allocatableIn,
  type AllocationRow,
  shownPercentage,
} from "./allocation-months.tsx";

// A work Coverage shows: a feature, or work allocated to that the plan doesn't list, such as a
// project's own work, named as allocations name it.
export interface CoverageRow extends CellRecord {
  id: string;
  name: string;
  feature?: Feature;
  // The effort needed, with the buffer; none for work with no estimate.
  effort?: number;
  allocated: number;
  // What is left of the effort after every month's allocated hours; below zero when over it.
  remaining?: number;
  coverage: Coverage;
}

// The hours each work's allocations deliver, by work and month: each line's percentage as the Draft
// menu shows it, in the months each person or planned hire can be allocated in.
export function deliveredByWork({
  rows,
  months,
  settings,
  show,
}: {
  rows: readonly AllocationRow[];
  months: readonly string[];
  settings: PlanningSettings;
  show: Show;
}): Map<string, Map<string, number>> {
  const byWork = new Map<string, Map<string, number>>();
  for (const row of rows) {
    const firstMonth = firstMonthIn(row.outside, months);
    for (const month of months) {
      if (!allocatableIn(row, month)) continue;
      for (const line of row.allocated.get(month) ?? []) {
        const percentage = shownPercentage(line, show);
        if (percentage === 0) continue;
        const hours = deliveredHours({
          percentage,
          month,
          firstMonth,
          settings,
        });
        const ofWork = byWork.get(line.featureId) ?? new Map<string, number>();
        ofWork.set(month, (ofWork.get(month) ?? 0) + hours);
        byWork.set(line.featureId, ofWork);
      }
    }
  }
  return byWork;
}

const total = (byMonth: ReadonlyMap<string, number>) =>
  [...byMonth.values()].reduce((sum, hours) => sum + hours, 0);

// A row for each feature still to be done, and for each other work its allocations name, such as a
// project's own.
// The ramp-up counts from a first month among the grid's months only, so someone who started before
// the grid's first month is taken as past their ramp-up.
export function coverageRows({
  features,
  meanings,
  allocatedWork,
  streams,
  settings,
  delivered,
  currentMonth,
}: {
  features: readonly Feature[];
  // Each feature status's meaning, by status.
  meanings: ReadonlyMap<string, Meaning>;
  allocatedWork: readonly { id: string; name: string }[];
  streams: ReleaseStreams["streams"];
  settings: PlanningSettings;
  delivered: ReadonlyMap<string, ReadonlyMap<string, number>>;
  currentMonth: string;
}): CoverageRow[] {
  const listed = new Set(features.map(({ id }) => id));
  const row = (
    id: string,
    name: string,
    feature: Feature | undefined,
  ): CoverageRow => {
    const allocatedByMonth = delivered.get(id) ?? new Map<string, number>();
    const effort = effortNeeded(feature?.estimateHours, settings.bufferPercent);
    const allocated = total(allocatedByMonth);
    return {
      id,
      name,
      values: {},
      links: {},
      ...(feature === undefined ? {} : { feature }),
      ...(effort === undefined
        ? {}
        : { effort, remaining: effort - allocated }),
      allocated,
      coverage: neededByMonth({
        needed: effort,
        plan:
          feature === undefined
            ? {}
            : {
                cycleMonths: targetCycleMonths(feature, streams),
                neededBy: feature.neededBy,
              },
        allocatedByMonth,
        currentMonth,
      }),
    };
  };
  return [
    ...features
      .filter((feature) => isForecast(meanings.get(feature.statusId)))
      .map((feature) => row(feature.id, feature.name, feature)),
    ...allocatedWork
      .filter(({ id }) => !listed.has(id) && delivered.has(id))
      .map(({ id, name }) => row(id, name, undefined)),
  ];
}
