// SPDX-License-Identifier: Apache-2.0

// Accounts as administrators see and change them, and the password rules every form and the server
// apply, so a password the form accepts is never refused by the server.

import { z } from "zod";
import { roleSchema } from "./access.ts";

export const passwordLength = { minimum: 12, maximum: 128 } as const;

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
  name: z.string().trim().min(1),
  email: z.email(),
  password: newPasswordSchema,
  roles: z.array(roleSchema),
});

export type NewAccountRequest = z.infer<typeof newAccountSchema>;

export const accountRolesSchema = z.object({ roles: z.array(roleSchema) });

export const accountActiveSchema = z.object({ active: z.boolean() });

export const passwordResetSchema = z.object({ password: newPasswordSchema });

export const passwordChangeSchema = z.object({
  currentPassword: z.string().min(1),
  newPassword: newPasswordSchema,
});

export type PasswordChangeRequest = z.infer<typeof passwordChangeSchema>;
