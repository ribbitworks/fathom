// SPDX-License-Identifier: Apache-2.0

// Schemas and types shared by the front end and the server, so both agree on what the API sends.
// Only code that is safe to reach the browser belongs here.

export { type GreetingResponse, greetingResponseSchema } from "./greeting.ts";
