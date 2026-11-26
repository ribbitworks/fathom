// SPDX-License-Identifier: Apache-2.0

// Links to records by their keys: what the server answers for a link, and the page each kind of
// record opens on.

import { z } from "zod";
import type { GuardedPage } from "./page-access.ts";
import { type ColumnTable, columnTables } from "./people.ts";
import {
  randomKeyKindSchema,
  recordKeyKindSchema,
  type RecordKeyKind,
} from "./record-keys.ts";

// What a link opens, as the server finds it under the reader's permissions: the record, by its kind
// and identifier, as a planned hire filled opens the person who filled it, with the table an added
// column is on, or the page a private row is on; a record removed, to those who may see its history;
// or nothing, the same whether no record has the key or the reader may not see it, so a link never
// shows that a record exists.
const foundSchema = z.object({
  result: z.literal("found"),
  kind: recordKeyKindSchema,
  id: z.string(),
  table: z.enum(columnTables).optional(),
});

// A private page found, or a row with the page it is on.
const foundPrivateSchema = z.object({
  result: z.literal("found"),
  kind: randomKeyKindSchema,
  id: z.string(),
  pageId: z.string(),
});

// A plain union, since a numbered record and a private one are both found.
export const recordLookupSchema = z.union([
  foundSchema,
  foundPrivateSchema,
  z.object({
    result: z.literal("removed"),
    kind: recordKeyKindSchema,
    id: z.string(),
  }),
  z.object({ result: z.literal("nothing") }),
]);

export type RecordLookup = z.infer<typeof recordLookupSchema>;

export type FoundRecord = z.infer<typeof foundSchema>;

export type FoundPrivateRecord = z.infer<typeof foundPrivateSchema>;

export const isFoundPrivate = (
  found: FoundRecord | FoundPrivateRecord,
): found is FoundPrivateRecord => "pageId" in found;

// A record a link names by its key, with the table an added column is on, which decides its page.
export type LinkedRecord =
  | { kind: Exclude<RecordKeyKind, "column">; keyNumber: number }
  | { kind: "column"; keyNumber: number; table: ColumnTable };

// The page each kind's link opens; an added column opens on the table it is on.
const recordPages = {
  feature: "features",
  activity: "activities",
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
} as const satisfies Record<Exclude<RecordKeyKind, "column">, GuardedPage>;

export type RecordPage =
  (typeof recordPages)[keyof typeof recordPages] | ColumnTable;

export const recordPage = (
  found: Pick<FoundRecord, "kind" | "table">,
): RecordPage =>
  found.kind === "column" ? (found.table ?? "people") : recordPages[found.kind];
