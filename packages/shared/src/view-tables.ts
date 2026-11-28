// SPDX-License-Identifier: Apache-2.0

// The tables that keep saved views, and the choices each page keeps in a view beyond its columns,
// such as the stream the Features Board shows, by the names its address gives them, so old links
// still open as they did.

import { z } from "zod";
import type { Permission } from "./access.ts";
import { recordEditors } from "./drafts.ts";
import type { ViewChoices } from "./views.ts";

export const viewTableSchema = z.enum([
  "people",
  "features",
  "activities",
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
  "roles",
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

// Capacity's Allocations' own choices: only the rows over, or under, a whole month from the current
// month on, each kept while set, and either while both are.
export const allocationsViewChoices = z.strictObject({
  over: shownChoiceSchema.optional(),
  under: shownChoiceSchema.optional(),
});

// The Drafts page's tabs, kept in its view as a choice of its own: the drafts the reader may decide
// now, shown only to a role that approves drafts; the reader's own changes, not yet published; and
// every published draft, to see what is waiting or rejected.
export const draftsTabSchema = z.enum(["decide", "unpublished", "all"]);

export type DraftsTab = z.infer<typeof draftsTabSchema>;

// Each table's choices, which a request must fit as a whole. A table whose page keeps no choices in
// its view takes none.
export const viewChoiceSchemas: Record<ViewTable, z.ZodType<ViewChoices>> = {
  people: noChoices,
  features: z
    .strictObject({
      stream: z.uuid().optional(),
      schedule: z.uuid().optional(),
      finished: shownChoiceSchema.optional(),
      hide: z
        .array(cardPartSchema)
        .max(cardPartSchema.options.length)
        .refine(
          (parts) => new Set(parts).size === parts.length,
          "Repeated part",
        )
        .optional(),
      // The customer whose features alone show, by its identifier.
      customer: z.uuid().optional(),
    })
    .refine(
      ({ stream, schedule }) => stream === undefined || schedule === undefined,
      "Columns of a schedule's cycles or of months, not both",
    ),
  activities: noChoices,
  projects: noChoices,
  proposals: noChoices,
  customers: noChoices,
  milestones: noChoices,
  releases: releasesViewChoices,
  cycles: cyclesViewChoices,
  "release-streams": noChoices,
  lists: noChoices,
  "feature-assignments": noChoices,
  capacity: allocationsViewChoices,
  "org-chart": z.strictObject({
    teams: z.literal("feature").optional(),
    levels: chartLevelsSchema.optional(),
    // By Fathom's own ID, so a shared view names no Employee ID its reader isn't sent.
    team: z.uuid().optional(),
  }),
  accounts: noChoices,
  roles: noChoices,
  // Any tab may be named: a shared view opens on the reader's first tab when their role lacks it.
  drafts: z.strictObject({ tab: draftsTabSchema.optional() }),
};

// What shares a table's views, and changes or deletes others' shared ones, any one sufficing: what
// edits the table's records, so the plan's tables follow its record editors. Lists are
// configuration's; Drafts, which holds every area's drafts, takes Edit Configuration.
const viewSharers: Record<ViewTable, readonly Permission[]> = {
  people: ["people:edit"],
  features: recordEditors.feature,
  activities: recordEditors.activity,
  projects: recordEditors.project,
  proposals: recordEditors.proposal,
  customers: recordEditors.customer,
  milestones: recordEditors.milestone,
  releases: recordEditors.release,
  cycles: recordEditors["cycle-pattern"],
  "release-streams": recordEditors["release-stream"],
  lists: ["configuration:edit"],
  "feature-assignments": ["feature-teams:edit"],
  capacity: recordEditors.allocation,
  "org-chart": ["people:edit"],
  accounts: ["administration:edit"],
  roles: ["administration:edit"],
  drafts: ["configuration:edit"],
};

export const sharesViews = (
  table: ViewTable,
  permissions: readonly string[],
): boolean =>
  // The table is always one of the fixed tables.
  // eslint-disable-next-line security/detect-object-injection
  viewSharers[table].some((sharer) => permissions.includes(sharer));
