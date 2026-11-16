// SPDX-License-Identifier: Apache-2.0

// The tables that keep saved views, and the choices each page keeps in a view beyond its columns,
// such as the stream the Features Board shows, by the names its address gives them, so old links
// still open as they did.

import { z } from "zod";
import type { Permission } from "./access.ts";
import type { ViewChoices } from "./views.ts";

export const viewTableSchema = z.enum([
  "people",
  "features",
  "projects",
  "proposals",
  "customers",
  "milestones",
  "releases",
  "cycles",
  "release-streams",
  "lists",
  "feature-assignments",
  "capacity",
  "org-chart",
  "accounts",
  "drafts",
]);

export type ViewTable = z.infer<typeof viewTableSchema>;

export const planModeSchema = z.enum(["table", "board"]);

export type PlanMode = z.infer<typeof planModeSchema>;

// What a Features card may show besides its name, in the order it shows them.
export const cardPartSchema = z.enum([
  "key",
  "status",
  "priority",
  "size",
  "risk",
  "neededBy",
  "staffed",
]);

export type CardPart = z.infer<typeof cardPartSchema>;

// The Org chart's levels shown, as a view keeps them: a count from the top, or all of them.
const mostChartLevels = 999;
export const allChartLevels = "all";
export const chartLevelsSchema = z.union([
  z.literal(allChartLevels),
  z
    .string()
    .regex(/^[1-9][0-9]*$/u)
    .refine((count) => Number(count) <= mostChartLevels, "Too many levels"),
]);

const noChoices = z.strictObject({});

// A choice that shows records a table otherwise leaves out, such as shipped releases, while set.
export const shownChoiceSchema = z.literal("shown");

// The Releases page's tables' own choices: shipped releases on Releases, and past and later cycles
// on Cycles, each shown while set.
export const releasesViewChoices = z.strictObject({
  shipped: shownChoiceSchema.optional(),
});
export const cyclesViewChoices = z.strictObject({
  past: shownChoiceSchema.optional(),
  later: shownChoiceSchema.optional(),
});

// Each table's choices, which a request must fit as a whole. A table whose page keeps no choices in
// its view takes none.
export const viewChoiceSchemas: Record<ViewTable, z.ZodType<ViewChoices>> = {
  people: noChoices,
  features: z.strictObject({
    stream: z.uuid().optional(),
    hide: z
      .array(cardPartSchema)
      .max(cardPartSchema.options.length)
      .refine((parts) => new Set(parts).size === parts.length, "Repeated part")
      .optional(),
  }),
  projects: noChoices,
  proposals: noChoices,
  customers: noChoices,
  milestones: noChoices,
  releases: releasesViewChoices,
  cycles: cyclesViewChoices,
  "release-streams": noChoices,
  lists: noChoices,
  "feature-assignments": noChoices,
  capacity: noChoices,
  "org-chart": z.strictObject({
    teams: z.literal("feature").optional(),
    levels: chartLevelsSchema.optional(),
    // By Fathom's own ID, so a shared view names no Employee ID its reader isn't sent.
    team: z.uuid().optional(),
  }),
  accounts: noChoices,
  drafts: z.strictObject({
    // Only the drafts the reader may decide now.
    decide: z.literal("mine").optional(),
    // The reader's own changes, not yet published, in place of those for approval.
    tab: z.literal("mine").optional(),
  }),
};

// The permission that shares a table's views, and changes or deletes others' shared ones. Nobody who
// opens Accounts may change planning configuration.
const viewSharers: Record<ViewTable, Permission> = {
  people: "configuration:edit",
  features: "configuration:edit",
  projects: "configuration:edit",
  proposals: "configuration:edit",
  customers: "configuration:edit",
  milestones: "configuration:edit",
  releases: "configuration:edit",
  cycles: "configuration:edit",
  "release-streams": "configuration:edit",
  lists: "configuration:edit",
  "feature-assignments": "configuration:edit",
  capacity: "configuration:edit",
  "org-chart": "configuration:edit",
  accounts: "administration:edit",
  drafts: "configuration:edit",
};

export const sharesViews = (
  table: ViewTable,
  permissions: readonly string[],
): boolean =>
  // The table is always one of the fixed tables.
  // eslint-disable-next-line security/detect-object-injection
  permissions.includes(viewSharers[table]);
