// SPDX-License-Identifier: Apache-2.0

// Signing in: how long a session lasts without use, what the sign-in form sends, and the session
// endpoint's response: the signed-in user as the front end shows them, with their role and what
// it lets them do, whether they must change their password first, and the settings every screen
// follows.

import { z } from "zod";
import { permissionSchema } from "./access.ts";
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
  // The one role the user holds, with the key of the starting role it is, if any, or null for an
  // account whose role could not be read.
  role: z
    .object({
      id: z.uuid(),
      key: z.string().nullable(),
      name: z.string(),
      description: z.string(),
    })
    .nullable(),
  permissions: z.array(permissionSchema),
  // Set while the user signs in with a password Fathom generated: until they change it, the server
  // refuses everything else.
  mustChangePassword: z.boolean(),
  settings: settingsSchema,
});

export type SessionResponse = z.infer<typeof sessionResponseSchema>;
