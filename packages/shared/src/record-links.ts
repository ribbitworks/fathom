// SPDX-License-Identifier: Apache-2.0

// Links to records by their keys, as the Decisions Log's Record keys sets out: what the server
// answers for a link, and the page each kind of record opens on, whose needs decide who a link
// finds the record for.

import { z } from "zod";
import type { GuardedPage } from "./page-access.ts";
import { columnTables } from "./people.ts";
import { recordKeyKindSchema, type RecordKeyKind } from "./record-keys.ts";

// What a link opens, as the server finds it under the reader's permissions: the record, by its kind
// and identifier, as a planned hire filled opens the person who filled it, with the table an added
// column is on; a record removed, to those who may see its history; or nothing, the same whether no
// record has the key or the reader may not see it, so a link never shows that a record exists.
export const recordLookupSchema = z.discriminatedUnion("result", [
  z.object({
    result: z.literal("found"),
    kind: recordKeyKindSchema,
    id: z.string(),
    table: z.enum(columnTables).optional(),
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

// The page each kind's link opens; an added column opens on the table it is on.
const recordPages: Record<Exclude<RecordKeyKind, "column">, GuardedPage> = {
  feature: "features",
  project: "projects",
  proposal: "projects",
  customer: "projects",
  milestone: "projects",
  release: "releases",
  schedule: "releases",
  person: "people",
  hire: "people",
  team: "org-chart",
  list: "lists",
  account: "accounts",
  role: "roles",
};

export const recordPage = (
  found: Pick<FoundRecord, "kind" | "table">,
): GuardedPage =>
  found.kind === "column" ? (found.table ?? "people") : recordPages[found.kind];
