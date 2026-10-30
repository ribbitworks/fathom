// SPDX-License-Identifier: Apache-2.0

// The response of the session endpoint: the signed-in user, as the front end shows them.

import { z } from "zod";

export const sessionResponseSchema = z.object({
  user: z.object({
    id: z.string(),
    name: z.string(),
    email: z.string(),
  }),
});

export type SessionResponse = z.infer<typeof sessionResponseSchema>;
