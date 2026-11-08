// SPDX-License-Identifier: Apache-2.0

// Accounts as administrators see and change them, the passwords Fathom generates for new accounts
// and resets, and the password rules every form and the server apply, so a password the form accepts
// is never refused by the server.

import { z } from "zod";
import { isPlainText } from "./text.ts";

// The bounds of every password: the rules an organization sets in Settings may ask for more than the
// minimum, which the server checks on each password a person chooses.
export const passwordLength = { minimum: 8, maximum: 128 } as const;

export const accountLengths = { name: 100 } as const;

// Characters that show nothing and are not spaces, which could make two names that look the same
// differ. The joiner emoji need is left alone, and a byte order mark counts as a space.
const invisible = /[\u00AD\u200B\u2060]/u;

// An account's or role's name, as others see it: plain text, with each run of spaces kept as one,
// so it is harder to make it look like another's.
export const accountName = z
  .string()
  .overwrite((name) => name.replace(/\s+/gu, " ").trim())
  .min(1, "Enter a name")
  .max(
    accountLengths.name,
    `Use at most ${String(accountLengths.name)} characters`,
  )
  .refine(
    (name) => isPlainText(name) && !invisible.test(name),
    "Use plain text, without control characters",
  );

const newPasswordSchema = z
  .string()
  .min(passwordLength.minimum)
  .max(passwordLength.maximum);

// A role an account holds, by its ID, with its name for showing.
export const accountRoleSchema = z.object({ id: z.uuid(), name: z.string() });

export type AccountRole = z.infer<typeof accountRoleSchema>;

export const accountSchema = z.object({
  id: z.string(),
  name: z.string(),
  email: z.string(),
  // The account's default role, which it signs in as the first time; null only for an account
  // whose roles could not be read, which Fathom never makes.
  role: accountRoleSchema.nullable(),
  // Every role the account holds, the default among them, by name.
  roles: z.array(accountRoleSchema),
  active: z.boolean(),
  createdAt: z.iso.datetime({ offset: true }),
});

export type Account = z.infer<typeof accountSchema>;

export const accountListSchema = z.object({ accounts: z.array(accountSchema) });

// Fathom generates the first password, so the request names none. The server refuses a default
// role outside the roles the account holds.
export const newAccountSchema = z.object({
  name: accountName,
  email: z.email(),
  // The account's default role, any role, starting or made later.
  roleId: z.uuid(),
  // Every role the account holds, the default among them; left out, the default alone.
  roleIds: z.array(z.uuid()).min(1, "Choose at least one role").optional(),
});

export type NewAccountRequest = z.infer<typeof newAccountSchema>;

// Any of an account's name, email address, roles, and default role, changed together. A default
// given without the roles makes it the account's only role, as for a new account.
export const accountChangeSchema = newAccountSchema.partial();

export type AccountChangeRequest = z.infer<typeof accountChangeSchema>;

// A user's change to their own account's name; its email address and role stay with Administrators.
export const ownNameSchema = newAccountSchema.pick({ name: true });

export type OwnNameRequest = z.infer<typeof ownNameSchema>;

export const accountActiveSchema = z.object({ active: z.boolean() });

// A password Fathom generated, for a new account or a reset, which the server sends only once.
export const generatedPasswordSchema = z.object({ password: z.string() });

export const createdAccountSchema = generatedPasswordSchema.extend({
  account: accountSchema,
});

export type CreatedAccount = z.infer<typeof createdAccountSchema>;

export const passwordChangeFields = z.object({
  currentPassword: z.string().min(1),
  newPassword: newPasswordSchema,
});

export const samePasswordMessage =
  "The new password must differ from the current password";

// Refuses a new password that is the current one, so nobody keeps a password Fathom generated.
export function refusingSamePassword<
  Schema extends z.ZodType<{ currentPassword: string; newPassword: string }>,
>(schema: Schema): Schema {
  return schema.refine(
    ({ currentPassword, newPassword }) => newPassword !== currentPassword,
    { path: ["newPassword"], message: samePasswordMessage },
  );
}

export const passwordChangeSchema = refusingSamePassword(passwordChangeFields);

export type PasswordChangeRequest = z.infer<typeof passwordChangeSchema>;
