// SPDX-License-Identifier: Apache-2.0

// Signing in: how long a session lasts without use, what the sign-in form sends, and the session
// endpoint's response: the signed-in user as the front end shows them, with the role they act as,
// the others they hold, and what the one they act as lets them do, whether they must change their
// password first, and the settings every screen follows; and switching to another role.

import { z } from "zod";
import { permissionSchema } from "./access.ts";
import { accountRoleSchema } from "./accounts.ts";
import { settingsSchema } from "./settings.ts";

export const sessionIdleMinutes = 30;

export const signInRequestSchema = z.object({
  email: z.email(),
  password: z.string().min(1),
});

export type SignInRequest = z.infer<typeof signInRequestSchema>;

export const sessionResponseSchema = z.object({
  user: z.object({
    id: z.string(),
    name: z.string(),
    email: z.string(),
  }),
  // The role the session acts as, the only one whose permissions apply, with the key of the
  // starting role it is, if any, or null for an account whose roles could not be read.
  role: z
    .object({
      id: z.uuid(),
      key: z.string().nullable(),
      name: z.string(),
      description: z.string(),
    })
    .nullable(),
  // Every role the account holds, by name, which the session may switch to, and its default.
  roles: z.array(accountRoleSchema),
  defaultRoleId: z.uuid().nullable(),
  permissions: z.array(permissionSchema),
  // Set while the user signs in with a password Fathom generated: until they change it, the server
  // refuses everything else.
  mustChangePassword: z.boolean(),
  settings: settingsSchema,
});

export type SessionResponse = z.infer<typeof sessionResponseSchema>;

// Switches the session to another of the account's roles.
export const roleSwitchSchema = z.object({ roleId: z.uuid() });

export type RoleSwitchRequest = z.infer<typeof roleSwitchSchema>;
