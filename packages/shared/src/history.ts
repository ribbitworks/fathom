// SPDX-License-Identifier: Apache-2.0

// The access history as users who may view it see it: who did what, when, and to whom, with
// details that hold no sensitive values, only which roles were involved.

import { z } from "zod";
import { roleSchema } from "./access.ts";

export const accessActionSchema = z.enum([
  "account-created",
  "roles-changed",
  "password-reset",
  "account-deactivated",
  "account-reactivated",
  // Someone saw people's Restricted or Confidential details, such as start and end dates. Recorded
  // at most once a day for each user, without naming whose, since a page shows many people at once.
  "restricted-viewed",
  // Someone changed a person's Restricted or Confidential details, naming the person to readers
  // who may see people.
  "restricted-changed",
]);

export type AccessAction = z.infer<typeof accessActionSchema>;

export const historyDetailsSchema = z.object({
  roles: z.array(roleSchema).optional(),
  previousRoles: z.array(roleSchema).optional(),
});

export type HistoryDetails = z.infer<typeof historyDetailsSchema>;

// An account or person named in the history, whose name is null if it no longer exists.
const personSchema = z.object({ id: z.string(), name: z.string().nullable() });

// Entries can never be changed, so one recorded by another version of Fathom, with an action this
// version does not know, is shown as it was stored rather than refused.
export const historyEntrySchema = z.object({
  id: z.number(),
  occurredAt: z.iso.datetime({ offset: true }),
  // Null for the server's operators, such as when the account command created an account.
  actor: personSchema.nullable(),
  action: z.string(),
  // Null when the entry names no one, as when Restricted details were viewed.
  subject: personSchema.nullable(),
  details: historyDetailsSchema,
});

export type HistoryEntry = z.infer<typeof historyEntrySchema>;

export const historyListSchema = z.object({
  entries: z.array(historyEntrySchema),
});
