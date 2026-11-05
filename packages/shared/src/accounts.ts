// SPDX-License-Identifier: Apache-2.0

// Accounts as administrators see and change them, and the password rules every form and the server
// apply, so a password the form accepts is never refused by the server.

import { z } from "zod";
import { roleSchema } from "./access.ts";
import { isPlainText } from "./text.ts";

export const passwordLength = { minimum: 12, maximum: 128 } as const;

export const accountLengths = { name: 100 } as const;

// Characters that show nothing and are not spaces, which could make two names that look the same
// differ. The joiner emoji need is left alone, and a byte order mark counts as a space.
const invisible = /[\u00AD\u200B\u2060]/u;

// An account's name, as others see it: plain text, with each run of spaces kept as one, so it is
// harder to make it look like someone else's.
const accountName = z
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

export const accountSchema = z.object({
  id: z.string(),
  name: z.string(),
  email: z.string(),
  roles: z.array(roleSchema),
  active: z.boolean(),
  createdAt: z.iso.datetime({ offset: true }),
});

export type Account = z.infer<typeof accountSchema>;

export const accountListSchema = z.object({ accounts: z.array(accountSchema) });

export const newAccountSchema = z.object({
  name: accountName,
  email: z.email(),
  password: newPasswordSchema,
  roles: z.array(roleSchema),
});

export type NewAccountRequest = z.infer<typeof newAccountSchema>;

// Any of an account's name, email address, and roles, changed together.
export const accountChangeSchema = newAccountSchema
  .pick({ name: true, email: true, roles: true })
  .partial();

export type AccountChangeRequest = z.infer<typeof accountChangeSchema>;

// A user's change to their own account's name; its email address and roles stay with Administrators.
export const ownNameSchema = newAccountSchema.pick({ name: true });

export type OwnNameRequest = z.infer<typeof ownNameSchema>;

export const accountActiveSchema = z.object({ active: z.boolean() });

export const passwordResetSchema = z.object({ password: newPasswordSchema });

export const passwordChangeSchema = z.object({
  currentPassword: z.string().min(1),
  newPassword: newPasswordSchema,
});

export type PasswordChangeRequest = z.infer<typeof passwordChangeSchema>;
