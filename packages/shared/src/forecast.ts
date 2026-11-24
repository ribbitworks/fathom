// SPDX-License-Identifier: Apache-2.0

// The forecast of work: the hours an allocation delivers in a month, the effort a work needs, and
// how what is left of it spreads over the months it is done in.

import { wholeMonth } from "./allocations.ts";
import { addToMonth } from "./cycles.ts";
import type { PlanningSettings } from "./planning-settings.ts";
import { fullOutputPercent } from "./planning-settings.ts";

// The share of full output someone gives in a month, from their first month: the ramp-up's
// percentages, one a month, then full output. Before the first month, or with none known, full.
export function rampUpPercent(
  month: string,
  firstMonth: string | undefined,
  rampUpPercents: readonly number[],
): number {
  if (firstMonth === undefined || month < firstMonth) return fullOutputPercent;
  const into = monthsThrough(firstMonth, month).length - 1;
  return rampUpPercents.at(into) ?? fullOutputPercent;
}

// The hours an allocation of a percentage of a month delivers in that month: the month's working
// hours, at the focus the settings give, and at the ramp-up of someone in their first months.
export function deliveredHours({
  percentage,
  month,
  firstMonth,
  settings,
}: {
  percentage: number;
  month: string;
  firstMonth?: string | undefined;
  settings: Pick<
    PlanningSettings,
    "hoursPerDay" | "daysPerMonth" | "focusPercent" | "rampUpPercents"
  >;
}): number {
  const monthHours = settings.hoursPerDay * settings.daysPerMonth;
  return (
    (monthHours *
      (percentage / wholeMonth) *
      (settings.focusPercent / fullOutputPercent) *
      rampUpPercent(month, firstMonth, settings.rampUpPercents)) /
    fullOutputPercent
  );
}

// The effort a work needs: its estimate with the buffer the settings add; none without an estimate.
export const effortNeeded = (
  estimateHours: number | null | undefined,
  bufferPercent: number,
): number | undefined =>
  estimateHours === null || estimateHours === undefined
    ? undefined
    : estimateHours * (1 + bufferPercent / fullOutputPercent);

// Every month from the first to the last, in order; none when the last comes before the first.
export function monthsThrough(first: string, last: string): string[] {
  const months: string[] = [];
  for (let month = first; month <= last; month = addToMonth(month, 1)) {
    months.push(month);
  }
  return months;
}

// Where a work's months come from, in the order tried: its target cycle's months, then from the
// current month to the month it is needed by. A work with neither has no window of its own.
export interface WorkPlan {
  cycleMonths?: readonly string[] | undefined;
  neededBy?: string | null | undefined;
}

// The months a work is done in: its plan's, widened to every month its allocations deliver in, so
// staffed months always show; none when it has neither, and so is done Later.
export function workWindow(
  plan: WorkPlan,
  allocatedMonths: readonly string[],
  currentMonth: string,
): string[] | undefined {
  const planned =
    plan.cycleMonths !== undefined && plan.cycleMonths.length > 0
      ? plan.cycleMonths
      : plan.neededBy !== null && plan.neededBy !== undefined
        ? [currentMonth, plan.neededBy]
        : [];
  const months = [...planned, ...allocatedMonths].sort();
  const first = months.at(0);
  const last = months.at(-1);
  if (first === undefined || last === undefined) return undefined;
  return monthsThrough(first, last);
}

// A month of a work: the hours allocated in it, and, from the current month on, its share of what
// is left of the effort needed; a past month, or a work with no effort, needs nothing shown.
export interface CoveredMonth {
  month: string;
  allocated: number;
  needed?: number;
}

export interface Coverage {
  months: CoveredMonth[];
  // A work with no window, all of what is left needed with no month of its own.
  later?: { allocated: number; needed?: number };
}

// How a work's effort spreads over its months: what is left after the hours allocated in past
// months, spread evenly over the window's months from the current month on, or over the current
// month alone once the window has passed.
export function neededByMonth({
  needed,
  plan,
  allocatedByMonth,
  currentMonth,
}: {
  needed: number | undefined;
  plan: WorkPlan;
  allocatedByMonth: ReadonlyMap<string, number>;
  currentMonth: string;
}): Coverage {
  const allocatedIn = (month: string) => allocatedByMonth.get(month) ?? 0;
  const window = workWindow(plan, [...allocatedByMonth.keys()], currentMonth);
  if (window === undefined) {
    return {
      months: [],
      later: { allocated: 0, ...(needed === undefined ? {} : { needed }) },
    };
  }
  const past = window.filter((month) => month < currentMonth);
  const coming = window.filter((month) => month >= currentMonth);
  const spreadOver = coming.length > 0 ? coming : [currentMonth];
  const months = [...past, ...spreadOver];
  const left =
    needed === undefined
      ? undefined
      : Math.max(
          0,
          needed - past.reduce((total, month) => total + allocatedIn(month), 0),
        );
  return {
    months: months.map((month) => ({
      month,
      allocated: allocatedIn(month),
      ...(left === undefined || month < currentMonth
        ? {}
        : { needed: left / spreadOver.length }),
    })),
  };
}
