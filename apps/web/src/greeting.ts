// SPDX-License-Identifier: Apache-2.0

// Reads the greeting from the server's API, checking the response against the shared schema so the
// page never shows data in a shape it does not expect.

import { type GreetingResponse, greetingResponseSchema } from "@fathom/shared";
import { getJson } from "./api.ts";

export function fetchGreeting(): Promise<GreetingResponse> {
  return getJson("/api/greeting", greetingResponseSchema);
}
