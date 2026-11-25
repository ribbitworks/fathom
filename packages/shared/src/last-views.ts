// SPDX-License-Identifier: Apache-2.0

// The view each account last showed on each page with a Views menu: the pages, the tables each
// shows, and the schemas of a last view as it is sent and received.

import { z } from "zod";
import type { GuardedPage } from "./page-access.ts";
import {
  planModeSchema,
  type ViewTable,
  viewTableSchema,
} from "./view-tables.ts";
import { strictDefinitionSchema } from "./views.ts";

export const viewPageSchema = z.enum([
  "people",
  "features",
  "activities",
  "projects",
  "releases",
  "lists",
  "capacity",
  "org-chart",
  "accounts",
  "drafts",
]);

export type ViewPage = z.infer<typeof viewPageSchema>;

// Every page with a Views menu is a page whose access is checked.
viewPageSchema.options satisfies readonly GuardedPage[];

// The page each table is shown on; each tab of Projects, Releases and Capacity is a table of its own.
export const viewPageOf: Record<ViewTable, ViewPage> = {
  people: "people",
  features: "features",
  activities: "activities",
  projects: "projects",
  proposals: "projects",
  customers: "projects",
  milestones: "projects",
  releases: "releases",
  cycles: "releases",
  "release-streams": "releases",
  lists: "lists",
  "feature-assignments": "capacity",
  capacity: "capacity",
  "org-chart": "org-chart",
  accounts: "accounts",
  drafts: "drafts",
};

// The table a page shows first, before a tab is chosen.
export const firstTables: Record<ViewPage, ViewTable> = {
  people: "people",
  features: "features",
  activities: "activities",
  projects: "projects",
  releases: "releases",
  lists: "lists",
  capacity: "feature-assignments",
  "org-chart": "org-chart",
  accounts: "accounts",
  drafts: "drafts",
};

// The modes a page shows its table in. Capacity's Settings has no table, so it is not kept.
export const lastViewModes: Partial<Record<ViewPage, z.ZodType<string>>> = {
  features: planModeSchema,
};

// The longest mode any page has, checked against the page's own modes by the server.
const modeLength = 20;

// The last view as the page sends it, which must fit as a whole.
export const lastViewRequestSchema = z.object({
  table: viewTableSchema,
  definition: strictDefinitionSchema,
  view: z.uuid().optional(),
  mode: z.string().max(modeLength).optional(),
});

export type LastViewRequest = z.infer<typeof lastViewRequestSchema>;

// The last view as the page receives it, without what the reader's role can no longer see.
export const lastViewSchema = z.object({
  table: viewTableSchema,
  definition: strictDefinitionSchema,
  view: z.uuid().optional(),
  mode: z.string().optional(),
});

export type LastView = z.infer<typeof lastViewSchema>;

// Each page's last view, for the pages whose last view the reader is sent.
export const lastViewsSchema = z.partialRecord(viewPageSchema, lastViewSchema);

export type LastViews = Partial<Record<ViewPage, LastView>>;
