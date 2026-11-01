// SPDX-License-Identifier: Apache-2.0

// Signing in: how long a session lasts without use, what the sign-in form sends, and the session
// endpoint's response: the signed-in user as the front end shows them, with their roles and what
// those roles let them do.

import { z } from "zod";
import { permissionSchema, roleSchema } from "./access.ts";

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
  roles: z.array(roleSchema),
  permissions: z.array(permissionSchema),
});

export type SessionResponse = z.infer<typeof sessionResponseSchema>;
