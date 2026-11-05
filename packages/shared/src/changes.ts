// SPDX-License-Identifier: Apache-2.0

// The change history as users see it: each change set saved, newest first, with who saved it and
// when, and the records it changed, holding only the changes the reader's roles let them see.
// Identifiers in values are replaced by the names of what they identify, so the front end only puts
// them in words.

import { z } from "zod";
import { textLimit } from "./views.ts";

// The labels of the People table's built-in columns, in the order a new table starts with them,
// shared so the table and the history name them alike. A person's team is the team of their
// manager; their team name is that of their own team.
export const builtInColumnNames: ReadonlyMap<string, string> = new Map([
  ["preferredName", "Name"],
  ["employeeId", "Employee ID"],
  ["positionId", "Position"],
  ["startDate", "Start"],
  ["endDate", "End"],
  ["managerId", "Manager"],
  ["managerFrom", "Manager since"],
  ["team", "Team"],
  ["teamName", "Team name"],
]);

// A value as the history shows it: text, such as a name or a date, yes or no, the names of several
// choices or columns, or nothing.
export const changeValueSchema = z.union([
  z.string(),
  z.boolean(),
  z.array(z.string()),
  z.null(),
]);

export type ChangeValue = z.infer<typeof changeValueSchema>;

export const changedFieldSchema = z.object({
  // The field as the history names it, such as "name" or "order", or "value" for a person's choices
  // in a column.
  field: z.string(),
  // For a person's choices, the name of the column they are in.
  column: z.string().optional(),
  oldValue: changeValueSchema,
  newValue: changeValueSchema,
});

export type ChangedField = z.infer<typeof changedFieldSchema>;

export const changedRecordSchema = z.object({
  // The kind of record, such as "person" or "list-item", which the front end names in words; a kind
  // it does not know is named generally.
  kind: z.string(),
  action: z.string(),
  // The record's latest name, or null if it never had one.
  name: z.string().nullable(),
  // For a choice, the name of its list.
  list: z.string().nullable(),
  fields: z.array(changedFieldSchema),
  // Whether the changes were to the record's draft rather than to the live record.
  draft: z.boolean(),
});

export type ChangedRecord = z.infer<typeof changedRecordSchema>;

// What a change set did: saved changes, or approved, rejected, or discarded drafts, or rejected drafts
// sent for approval again unchanged.
export const changeKindSchema = z.enum([
  "edit",
  "approval",
  "rejection",
  "discard",
  "resubmission",
]);

export type ChangeKind = z.infer<typeof changeKindSchema>;

export const changeEntrySchema = z.object({
  id: z.string(),
  kind: changeKindSchema,
  madeAt: z.iso.datetime({ offset: true }),
  // The name of who saved it, or null for Fathom itself, as for the seed data.
  madeBy: z.string().nullable(),
  records: z.array(changedRecordSchema),
});

export type ChangeEntry = z.infer<typeof changeEntrySchema>;

export const changeHistorySchema = z.object({
  entries: z.array(changeEntrySchema),
  // Where older entries start, when any remain: the last change set read, which may hold nothing
  // the reader sees, to name as the one to read before.
  next: z.uuid().nullable(),
});

export type ChangeHistory = z.infer<typeof changeHistorySchema>;

// The longest search the history pages send, as long as a table's.
export const historySearchLength = textLimit;

export const changeHistoryQuerySchema = z.object({
  before: z.uuid().optional(),
  search: z.string().max(historySearchLength).optional(),
});

// The text a search looks in for one record a change set changed: its name, its list, and the
// columns and values it changed, the same on the server, which finds change sets, and in the
// browser, which shows what matches first.
export function recordSearchText(record: ChangedRecord): string {
  return [
    record.name ?? "",
    record.list ?? "",
    ...record.fields.flatMap((field) => [
      field.column ?? "",
      ...[field.oldValue, field.newValue].flatMap((value) =>
        typeof value === "boolean" || value === null ? [] : value,
      ),
    ]),
  ].join(" ");
}
