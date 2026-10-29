// SPDX-License-Identifier: Apache-2.0

// The response of the greeting endpoint, which proves the front end, server, and database work
// together.

import { z } from "zod";

export const greetingResponseSchema = z.object({
  greeting: z.string(),
});

export type GreetingResponse = z.infer<typeof greetingResponseSchema>;
