// SPDX-License-Identifier: Apache-2.0

// Allocations: one person or planned hire on one feature or activity, as a share of a month from
// each month it changes.

import { z } from "zod";
import { addToMonth } from "./cycles.ts";
import { monthSchema } from "./days.ts";
import {
  draftActionSchema,
  draftShape,
  heldBySchema,
  recordDraftSchema,
} from "./drafts.ts";
import { type Meaning, meaningSchema } from "./lists.ts";
import { paletteColourSchema } from "./palette.ts";

// The percentages of a month offered when allocating; filling a planned hire can make others, such
// as 35%, by adding two together.
export const allocationPercentages = [10, 25, 50, 75, 90, 100] as const;

// A whole month, the most one allocation can hold.
export const wholeMonth = 100;

const keptPercentage = z.number().int().min(1).max(wholeMonth);

// The month each percentage takes effect from, by month; null stops the allocation.
export const allocationMonthsSchema = z.record(
  monthSchema,
  keptPercentage.nullable(),
);

export type AllocationMonths = z.infer<typeof allocationMonthsSchema>;

// A change to one allocation: a percentage, or none to stop it, from a month, until a month or with
// no end.
export const allocationChangeSchema = z
  .object({
    personId: z.uuid().optional(),
    plannedHireId: z.uuid().optional(),
    featureId: z.uuid().optional(),
    activityId: z.uuid().optional(),
    percentage: z.literal(allocationPercentages).nullable(),
    from: monthSchema,
    to: monthSchema.optional(),
  })
  .refine(
    ({ personId, plannedHireId }) =>
      (personId === undefined) !== (plannedHireId === undefined),
    "Choose a person or a planned hire",
  )
  .refine(
    ({ featureId, activityId }) =>
      (featureId === undefined) !== (activityId === undefined),
    "Choose a feature or an activity",
  )
  .refine(
    ({ from, to }) => to === undefined || from <= to,
    "Choose a last month from the first month on",
  );

export type AllocationChange = z.infer<typeof allocationChangeSchema>;

// The percentage in force in a month: the last given from then or before, or none.
export function percentageIn(
  months: AllocationMonths,
  month: string,
): number | null {
  const from = Object.keys(months)
    .filter((key) => key <= month)
    .sort()
    .at(-1);
  // The key is one of the allocation's own months.
  // eslint-disable-next-line security/detect-object-injection
  return from === undefined ? null : (months[from] ?? null);
}

// The months in order, leaving out any that changes nothing, such as a stop with nothing before it.
export function tidiedMonths(months: AllocationMonths): AllocationMonths {
  const kept: [string, number | null][] = [];
  for (const month of Object.keys(months).sort()) {
    // The key is one of the allocation's own months.
    // eslint-disable-next-line security/detect-object-injection
    const percentage = months[month] ?? null;
    if (percentage !== (kept.at(-1)?.[1] ?? null)) {
      kept.push([month, percentage]);
    }
  }
  return Object.fromEntries(kept);
}

// The months as a change makes them: its percentage from its first month, and, when it has a last
// month, what was in force after that month from the month after it, so the months around keep
// their percentage. Months it covers lose what they held.
export function withChange(
  months: AllocationMonths,
  {
    percentage,
    from,
    to,
  }: Pick<AllocationChange, "percentage" | "from" | "to">,
): AllocationMonths {
  const after = to === undefined ? undefined : addToMonth(to, 1);
  const kept = Object.entries(months).filter(
    ([month]) => month < from || (after !== undefined && month >= after),
  );
  const resumed =
    after === undefined || after in months
      ? []
      : [[after, percentageIn(months, after)] as const];
  return tidiedMonths(
    Object.fromEntries([...kept, [from, percentage], ...resumed]),
  );
}

// A run of months, with no last month when it runs on, and the percentage in force through it.
export interface MonthSpan {
  from: string;
  to?: string;
  percentage: number | null;
}

// The runs of months whose percentage differs between two versions of an allocation, with the
// percentage the second gives them.
export function changedSpans(
  before: AllocationMonths,
  after: AllocationMonths,
): MonthSpan[] {
  const starts = [
    ...new Set([...Object.keys(before), ...Object.keys(after)]),
  ].sort();
  return starts.flatMap((from, index): MonthSpan[] => {
    const percentage = percentageIn(after, from);
    if (percentage === percentageIn(before, from)) return [];
    const next = starts[index + 1];
    return [
      next === undefined
        ? { from, percentage }
        : { from, to: addToMonth(next, -1), percentage },
    ];
  });
}

// A month's allocations added up. Possible features may never be worked on, so their allocations
// take up no time; done and cancelled ones still do, since their allocations are time spent. An
// activity counts as a feature does.
export function allocatedTotal(
  allocations: readonly { percentage: number; meaning: Meaning | null }[],
): number {
  return allocations
    .filter(({ meaning }) => meaning !== "possible")
    .reduce((total, { percentage }) => total + percentage, 0);
}

export type LoadMark = "over" | "under";

// How a month's total reads from the current month on: over a whole month, or, in a month the
// person or planned hire can be allocated in, under it. Past months are shown unmarked.
export function loadMark({
  total,
  month,
  currentMonth,
  allocatable,
}: {
  total: number;
  month: string;
  currentMonth: string;
  allocatable: boolean;
}): LoadMark | undefined {
  if (month < currentMonth) return undefined;
  if (total > wholeMonth) return "over";
  return allocatable && total < wholeMonth ? "under" : undefined;
}

// Capacity, in hundredths of a person-month: what is allocated against what is available.
export interface Capacity {
  allocated: number;
  available: number;
}

const noCapacity: Capacity = { allocated: 0, available: 0 };

// A month of one person or planned hire: a whole month available, with its total allocated, when
// they can be allocated in it, and otherwise nothing, since allocations left outside employment do
// not count.
export const monthCapacity = ({
  total,
  allocatable,
}: {
  total: number;
  allocatable: boolean;
}): Capacity =>
  allocatable ? { allocated: total, available: wholeMonth } : noCapacity;

export const summedCapacity = (capacities: readonly Capacity[]): Capacity =>
  capacities.reduce(
    (sum, { allocated, available }) => ({
      allocated: sum.allocated + allocated,
      available: sum.available + available,
    }),
    noCapacity,
  );

export const workEffortSchema = z.object({
  estimate: z.number().nullable(),
  needed: z.number().nullable(),
  // The month its allocations' hours are counted to; none for work with no dates.
  lastMonth: monthSchema.nullable(),
});

export type WorkEffort = z.infer<typeof workEffortSchema>;

// The hours a whole month of someone's time gives, after the planning settings' focus.
export const allocationHoursSchema = z.number();

export type AllocationHours = z.infer<typeof allocationHoursSchema>;

// A feature as allocations name it, with the meaning of its status, which decides whether it counts
// toward over-allocation.
export const allocatedFeatureSchema = z.object({
  id: z.string(),
  name: z.string(),
  meaning: meaningSchema.nullable(),
  // Its feature team's, sent only to those who see feature teams.
  colour: paletteColourSchema.nullable(),
  // Set for a feature the reader can't read, named only by its kind.
  unseen: z.literal(true).optional(),
  // The feature's draft, where it renames the feature, with its live name.
  rename: recordDraftSchema
    .pick({
      action: true,
      changed: true,
      live: true,
      state: true,
      reason: true,
      unpublished: true,
    })
    .optional(),
  // Its estimate, and the hours it needs, the estimate with the planning settings' buffer, as
  // approved and as its draft makes them, but for a rejected draft. Sent only for a feature or
  // activity the reader reads, to a reader who sees the planning settings, since the hours tell
  // the buffer.
  effort: z
    .object({ live: workEffortSchema, drafted: workEffortSchema.optional() })
    .optional(),
});

export type AllocatedFeature = z.infer<typeof allocatedFeatureSchema>;

// An activity as allocations name it, as a feature is, with its project's or release's name, which
// tells apart activities of the same name.
export const allocatedActivitySchema = allocatedFeatureSchema.extend({
  // None for an activity the reader can't read.
  owner: z.string().optional(),
});

export type AllocatedActivity = z.infer<typeof allocatedActivitySchema>;

export const allocationDraftSchema = z.object({
  action: draftActionSchema,
  months: allocationMonthsSchema,
  ...draftShape,
});

export type AllocationDraft = z.infer<typeof allocationDraftSchema>;

// An allocation as approved, with its draft, if any, beside it; one only drafted to be added has
// no months yet.
export const allocationSchema = z.object({
  id: z.string(),
  personId: z.string().nullable(),
  plannedHireId: z.string().nullable(),
  // One of the two is set.
  featureId: z.string().nullable(),
  activityId: z.string().nullable(),
  months: allocationMonthsSchema,
  // The hours a whole month of its person's or planned hire's time gives, sent only to a reader who
  // sees the planning settings, since the hours tell the focus.
  hours: allocationHoursSchema.optional(),
  draft: allocationDraftSchema.optional(),
  heldBy: heldBySchema,
});

export type Allocation = z.infer<typeof allocationSchema>;

// The allocations the reader sees, and the features and activities they name.
export const allocationsSchema = z.object({
  allocations: z.array(allocationSchema),
  features: z.array(allocatedFeatureSchema),
  activities: z.array(allocatedActivitySchema),
  // The planning settings' Default buffer, as approved, which the hours a work needs include; sent
  // only to a reader who sees the planning settings.
  bufferPercent: z.number().optional(),
});

export type Allocations = z.infer<typeof allocationsSchema>;
