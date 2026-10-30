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
]);

export type AccessAction = z.infer<typeof accessActionSchema>;

export const historyDetailsSchema = z.object({
  roles: z.array(roleSchema).optional(),
  previousRoles: z.array(roleSchema).optional(),
});

export type HistoryDetails = z.infer<typeof historyDetailsSchema>;

// A person named in the history, whose name is null if their account no longer exists.
const personSchema = z.object({ id: z.string(), name: z.string().nullable() });

// Entries can never be changed, so one recorded by another version of Fathom, with an action this
// version does not know, is shown as it was stored rather than refused.
export const historyEntrySchema = z.object({
  id: z.number(),
  occurredAt: z.iso.datetime({ offset: true }),
  // Null for the server's operators, such as when the account command created an account.
  actor: personSchema.nullable(),
  action: z.string(),
  subject: personSchema,
  details: historyDetailsSchema,
});

export type HistoryEntry = z.infer<typeof historyEntrySchema>;

export const historyListSchema = z.object({
  entries: z.array(historyEntrySchema),
});
