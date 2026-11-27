// SPDX-License-Identifier: Apache-2.0

// The forecast of work: the hours an allocation delivers in a month, the effort a work needs, and
// how what is left of it spreads over the months it is done in.

import {
  type AllocationHours,
  type AllocationMonths,
  percentageIn,
  wholeMonth,
} from "./allocations.ts";
import type { Feature } from "./features.ts";
import { byMeaning } from "./lists.ts";
import { monthsBetween } from "./monthly-grid.ts";
import type { PlanningSettings } from "./planning-settings.ts";
import { hundredPercent } from "./planning-settings.ts";
import type { ReleaseStream } from "./releases.ts";

// The settings the hours someone's time gives are worked out from.
export type HourSettings = Pick<
  PlanningSettings,
  "hoursPerDay" | "daysPerMonth" | "focusPercent"
>;

// The hours a whole month of someone's time gives: the month's working hours, at the focus the
// settings give. The figures are multiplied first and divided once, so one such as 110.25 h stays
// exact.
export const allocationHours = ({
  hoursPerDay,
  daysPerMonth,
  focusPercent,
}: HourSettings): AllocationHours =>
  (hoursPerDay * daysPerMonth * focusPercent) / hundredPercent;

// The hours an allocation's percentages give over some months, at each month's percentage in force.
export const hoursAllocated = (
  percentages: AllocationMonths,
  hours: AllocationHours,
  months: readonly string[],
): number =>
  months.reduce(
    (total, month) =>
      total + ((percentageIn(percentages, month) ?? 0) * hours) / wholeMonth,
    0,
  );

// What remains of the hours a work needs once its allocations' hours are taken off: below zero
// once they give it more, and none without an estimate.
export const remainingHours = (
  needed: number | null,
  allocated: number,
): number | undefined => (needed === null ? undefined : needed - allocated);

// Whether work is still to be done, and so forecast: not once it is done or cancelled.
export const isForecast = byMeaning(
  {
    proposed: true,
    open: true,
    hired: true,
    left: true,
    possible: true,
    planned: true,
    "in-progress": true,
    done: false,
    cancelled: false,
  },
  true,
);

// The effort a work needs: its estimate with the buffer the settings add, multiplied before it is
// divided so 50 h with 15% stays 57.5 h; none without an estimate.
export const effortNeeded = (
  estimateHours: number | null | undefined,
  bufferPercent: number,
): number | undefined =>
  estimateHours === null || estimateHours === undefined
    ? undefined
    : (estimateHours * (hundredPercent + bufferPercent)) / hundredPercent;

// The months a feature's target cycle covers, from its schedule's cycles; none without one.
export function targetCycleMonths(
  feature: Pick<Feature, "targetStreamId" | "targetCycle">,
  streams: readonly Pick<ReleaseStream, "id" | "cycles">[],
): string[] | undefined {
  return streams
    .find(({ id }) => id === feature.targetStreamId)
    ?.cycles.find(({ startsOn }) => startsOn === feature.targetCycle)
    ?.months.map(({ month }) => month);
}

// Where a work's months come from, in the order tried: its target cycle's months, then from the
// current month to the month it is needed by. A work with neither has no months planned.
export interface WorkPlan {
  cycleMonths?: readonly string[] | undefined;
  neededBy?: string | null | undefined;
}

// The months a work is planned in: its target cycle's, or from the current month to Needed by, the
// current month alone once Needed by has passed; none with neither.
export function plannedMonths(
  plan: WorkPlan,
  currentMonth: string,
): string[] | undefined {
  if (plan.cycleMonths !== undefined && plan.cycleMonths.length > 0) {
    return [...plan.cycleMonths];
  }
  if (plan.neededBy === null || plan.neededBy === undefined) return undefined;
  return plan.neededBy < currentMonth
    ? [currentMonth]
    : monthsBetween(currentMonth, plan.neededBy);
}

// A month of a work: the hours allocated in it, and, in a planned month from the current one on,
// its share of what is left of the effort; none in a past month, a month allocated outside the
// plan, or for a work with no effort.
export interface CoveredMonth {
  month: string;
  allocated: number;
  needed?: number;
}

export interface Coverage {
  months: CoveredMonth[];
  // A work with no months planned: what is left of its effort, needed with no month of its own.
  later?: { needed: number };
}

// How a work's effort spreads over its months: what is left after the hours allocated before the
// current month, spread evenly over its planned months from the current month on, or over the
// current month alone once they have passed. Every month allocated is listed too.
export function coverageByMonth({
  effort,
  plan,
  allocatedByMonth,
  currentMonth,
}: {
  effort: number | undefined;
  plan: WorkPlan;
  allocatedByMonth: ReadonlyMap<string, number>;
  currentMonth: string;
}): Coverage {
  const allocatedIn = (month: string) => allocatedByMonth.get(month) ?? 0;
  const allocatedBefore = [...allocatedByMonth.keys()]
    .filter((month) => month < currentMonth)
    .reduce((total, month) => total + allocatedIn(month), 0);
  const left =
    effort === undefined ? undefined : Math.max(0, effort - allocatedBefore);
  const planned = plannedMonths(plan, currentMonth);
  const coming = planned?.filter((month) => month >= currentMonth) ?? [];
  const spreadOver =
    planned === undefined ? [] : coming.length > 0 ? coming : [currentMonth];
  const months = [
    ...new Set([...(planned ?? []), ...spreadOver, ...allocatedByMonth.keys()]),
  ].sort();
  return {
    months: months.map((month) => ({
      month,
      allocated: allocatedIn(month),
      ...(left === undefined || !spreadOver.includes(month)
        ? {}
        : { needed: left / spreadOver.length }),
    })),
    ...(planned === undefined && left !== undefined
      ? { later: { needed: left } }
      : {}),
  };
}
