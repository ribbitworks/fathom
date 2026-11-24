// SPDX-License-Identifier: Apache-2.0

// Links to records by their keys: what the server answers for a link, and the page each kind of
// record opens on.

import { z } from "zod";
import type { GuardedPage } from "./page-access.ts";
import { type ColumnTable, columnTables } from "./people.ts";
import { recordKeyKindSchema, type RecordKeyKind } from "./record-keys.ts";

// What a link opens, as the server finds it under the reader's permissions: the record, by its kind
// and identifier, as a planned hire filled opens the person who filled it, with the table an added
// column is on, or the project or release an activity belongs to; a record removed, to those who
// may see its history; or nothing, the same whether no record has the key or the reader may not see
// it, so a link never shows that a record exists.
export const recordLookupSchema = z.discriminatedUnion("result", [
  z.object({
    result: z.literal("found"),
    kind: recordKeyKindSchema,
    id: z.string(),
    table: z.enum(columnTables).optional(),
    activityOf: z
      .object({ owner: z.enum(["project", "release"]), id: z.string() })
      .optional(),
  }),
  z.object({
    result: z.literal("removed"),
    kind: recordKeyKindSchema,
    id: z.string(),
  }),
  z.object({ result: z.literal("nothing") }),
]);

export type RecordLookup = z.infer<typeof recordLookupSchema>;

export type FoundRecord = Extract<RecordLookup, { result: "found" }>;

// A record a link names by its key, with the table an added column is on, which decides its page.
export type LinkedRecord =
  | { kind: Exclude<RecordKeyKind, "column">; keyNumber: number }
  | { kind: "column"; keyNumber: number; table: ColumnTable };

type Placed = Pick<FoundRecord, "kind" | "table" | "activityOf">;

// The pages records open on, beside the tables an added column may be on.
type PageOfRecords = Extract<
  GuardedPage,
  | "features"
  | "projects"
  | "releases"
  | "people"
  | "org-chart"
  | "lists"
  | "accounts"
  | "roles"
>;

export type RecordPage = PageOfRecords | ColumnTable;

const on = (page: PageOfRecords) => (): RecordPage => page;

// The page each kind's link opens; an added column opens on the table it is on, and an activity on
// its project's or release's.
const recordPages: Record<RecordKeyKind, (found: Placed) => RecordPage> = {
  feature: on("features"),
  project: on("projects"),
  proposal: on("projects"),
  customer: on("projects"),
  milestone: on("projects"),
  activity: ({ activityOf }) =>
    activityOf?.owner === "release" ? "releases" : "projects",
  release: on("releases"),
  schedule: on("releases"),
  person: on("people"),
  hire: on("people"),
  team: on("org-chart"),
  list: on("lists"),
  column: ({ table }) => table ?? "people",
  account: on("accounts"),
  role: on("roles"),
};

export const recordPage = (found: Placed): RecordPage =>
  recordPages[found.kind](found);
