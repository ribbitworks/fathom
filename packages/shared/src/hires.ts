// SPDX-License-Identifier: Apache-2.0

// Planned hires: roles to be filled, kept apart from people, as the Decisions Log sets out. The
// hiring plan is Confidential, apart from each open hire's placeholder: its title, manager, and the
// first month it can be allocated, which everyone who sees people sees. What a user receives leaves
// out what their roles do not let them see.

import { z } from "zod";
import { draftActionSchema, draftShape, heldBySchema } from "./drafts.ts";

export const hireLengths = { title: 60, stateName: 40 } as const;

// Fathom's fixed hiring states, in order, which Fathom acts on. The first four are open.
export const hiringStateSchema = z.enum([
  "proposed",
  "approved",
  "recruiting",
  "offer-accepted",
  "filled",
  "cancelled",
]);

export type HiringState = z.infer<typeof hiringStateSchema>;

export const openHiringStates: readonly HiringState[] = [
  "proposed",
  "approved",
  "recruiting",
  "offer-accepted",
];

export const hiringStateNames: Readonly<Record<HiringState, string>> = {
  proposed: "Proposed",
  approved: "Approved",
  recruiting: "Recruiting",
  "offer-accepted": "Offer accepted",
  filled: "Filled",
  cancelled: "Cancelled",
};

// The states a hire may be moved to by changing it: forward or back one state among the open ones,
// from any open one to Cancelled, and from Cancelled back to the state it left. A hire reaches Filled
// only by being filled, and never leaves it.
export function nextHiringStates(
  state: HiringState,
  cancelledFrom: HiringState | null,
): HiringState[] {
  if (state === "cancelled")
    return cancelledFrom === null ? [] : [cancelledFrom];
  const at = openHiringStates.indexOf(state);
  if (at === -1) return [];
  return [
    ...[openHiringStates[at - 1], openHiringStates[at + 1]].filter(
      (next): next is HiringState => next !== undefined,
    ),
    "cancelled",
  ];
}

// A date without a time, such as 2026-10-31, and a month, such as 2026-10.
const day = z.iso.date();
const month = z.string().regex(/^\d{4}-\d{2}$/);

// A hire's draft, as the user may see it: whether it adds, changes, or removes the hire, the fields it
// changes, and their live values, which a draft adding the hire has none of.
export const hireDraftSchema = z.object({
  action: draftActionSchema,
  changed: z.array(z.string()),
  live: z.object({
    title: z.string().optional(),
    targetDate: day.optional(),
    state: hiringStateSchema.optional(),
    managerId: z.string().nullable().optional(),
  }),
  ...draftShape,
});

export type HireDraft = z.infer<typeof hireDraftSchema>;

// A planned hire as the user sees it. Everyone who sees it sees its title, manager, and first month;
// only those who see Confidential data see the rest, the hire as its draft, if any, makes it, and
// the draft beside.
export const hireSchema = z.object({
  id: z.string(),
  title: z.string(),
  // None, too, for readers who cannot see Restricted data while the manager is not current staff.
  managerId: z.string().nullable(),
  managerName: z.string().nullable(),
  // The first month the hire can be allocated: the month of its target date.
  firstMonth: month,
  targetDate: day.optional(),
  state: hiringStateSchema.optional(),
  // The state a cancelled hire left, which it can go back to.
  cancelledFrom: hiringStateSchema.nullable().optional(),
  draft: hireDraftSchema.optional(),
  heldBy: heldBySchema,
});

export type Hire = z.infer<typeof hireSchema>;

// The hires the user may see: the whole hiring plan, or only the placeholders, with whether it is
// the whole plan.
export const hiresSchema = z.object({
  hires: z.array(hireSchema),
  wholePlan: z.boolean(),
});

export type Hires = z.infer<typeof hiresSchema>;

const title = z.string().trim().min(1).max(hireLengths.title);

// Adds a planned hire, in any open state.
export const hireRequestSchema = z.object({
  title,
  targetDate: day,
  state: hiringStateSchema.exclude(["filled", "cancelled"]).default("proposed"),
  managerId: z.uuid().nullable().default(null),
});

export type HireRequest = z.infer<typeof hireRequestSchema>;

// Changes some of a hire's details, or moves it to another state.
export const hireChangeSchema = z.object({
  title: title.optional(),
  targetDate: day.optional(),
  state: hiringStateSchema.exclude(["filled"]).optional(),
  managerId: z.uuid().nullable().optional(),
});

export type HireChange = z.infer<typeof hireChangeSchema>;
