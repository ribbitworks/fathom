// SPDX-License-Identifier: Apache-2.0

// Reads the greeting from the server's API, checking the response against the shared schema so the
// page never shows data in a shape it does not expect.

import { type GreetingResponse, greetingResponseSchema } from "@fathom/shared";

export async function fetchGreeting(): Promise<GreetingResponse> {
  const response = await fetch("/api/greeting", {
    headers: { accept: "application/json" },
  });
  if (!response.ok) {
    throw new Error(
      `The server answered with status ${String(response.status)}`,
    );
  }
  return greetingResponseSchema.parse(await response.json());
}
