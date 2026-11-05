// SPDX-License-Identifier: Apache-2.0

// The access history as users who may view it see it: who did what, when, and to whom, with
// details that hold no sensitive values, only which roles were involved.

import { z } from "zod";
import { roleSchema } from "./access.ts";

export const accessActionSchema = z.enum([
  "account-created",
  "roles-changed",
  "name-changed",
  "email-changed",
  "password-reset",
  // A user changed their own password, giving their current one, or their own name.
  "password-changed",
  "own-name-changed",
  "account-deactivated",
  "account-reactivated",
  // Someone saw people's Restricted or Confidential details, such as start and end dates. Recorded
  // at most once a day for each user, without naming whose, since a page shows many people at once.
  "restricted-viewed",
  // Someone changed a person's Restricted or Confidential details, naming the person to readers
  // who may see people.
  "restricted-changed",
  // Someone changed the hiring plan, which is Confidential, without naming the planned hire.
  "hiring-plan-changed",
  // Someone saw the whole hiring plan. Recorded at most once a day for each user, as Restricted
  // views are.
  "hiring-plan-viewed",
  // Someone created a role, or changed a role's name, description, or what it grants, naming the
  // role and the permissions granted or withdrawn.
  "role-created",
  "role-changed",
]);

export type AccessAction = z.infer<typeof accessActionSchema>;

export const historyDetailsSchema = z.object({
  roles: z.array(roleSchema).optional(),
  previousRoles: z.array(roleSchema).optional(),
  // For a role created or changed: its name then, any name it had before, and the permissions
  // granted or withdrawn, as stored, so a permission renamed since is still shown.
  role: z.string().optional(),
  previousName: z.string().optional(),
  granted: z.array(z.string()).optional(),
  withdrawn: z.array(z.string()).optional(),
});

export type HistoryDetails = z.infer<typeof historyDetailsSchema>;

// An account or person named in the history, whose name is null if it no longer exists.
// An account, or a person whose details changed. An account's email address, which signs it in,
// tells it from another with a name that looks the same; a person has none.
const personSchema = z.object({
  id: z.string(),
  name: z.string().nullable(),
  email: z.string().nullable().optional(),
});

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
