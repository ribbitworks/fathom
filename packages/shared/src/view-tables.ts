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
  "release-streams",
  "lists",
  "feature-assignments",
  "capacity",
  "org-chart",
  "accounts",
]);

export type ViewTable = z.infer<typeof viewTableSchema>;

export const planModeSchema = z.enum(["table", "board"]);

export type PlanMode = z.infer<typeof planModeSchema>;

// What a Features card may show besides its name, in the order it shows them.
export const cardPartSchema = z.enum([
  "status",
  "priority",
  "size",
  "risk",
  "neededBy",
  "staffed",
]);

export type CardPart = z.infer<typeof cardPartSchema>;

const noChoices = z.strictObject({});

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
  "release-streams": noChoices,
  lists: noChoices,
  "feature-assignments": noChoices,
  capacity: noChoices,
  "org-chart": noChoices,
  accounts: noChoices,
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
  "release-streams": "configuration:edit",
  lists: "configuration:edit",
  "feature-assignments": "configuration:edit",
  capacity: "configuration:edit",
  "org-chart": "configuration:edit",
  accounts: "administration:edit",
};

export const sharesViews = (
  table: ViewTable,
  permissions: readonly string[],
): boolean =>
  // The table is always one of the fixed tables.
  // eslint-disable-next-line security/detect-object-injection
  permissions.includes(viewSharers[table]);
