// SPDX-License-Identifier: Apache-2.0

// Requests to Fathom's API, and how failed ones are handled: each failure carries the server's
// status, refusals such as a missing sign-in are not retried, and a request refused because the
// session has ended sends the user to sign in again.

import type { z } from "zod";

const unauthorized = 401;
const firstServerError = 500;
const maximumRetries = 2;

export class ApiError extends Error {
  readonly status: number;

  constructor(status: number) {
    super(`The server answered with status ${String(status)}`);
    this.status = status;
  }
}

export function isSignedOut(error: unknown): boolean {
  return error instanceof ApiError && error.status === unauthorized;
}

// Server errors and lost connections may pass, so are tried again; the server's refusals will not.
export function shouldRetry(failureCount: number, error: unknown): boolean {
  if (error instanceof ApiError && error.status < firstServerError)
    return false;
  return failureCount < maximumRetries;
}

// Reads JSON from the API, checked against the given schema.
export async function getJson<Schema extends z.ZodType>(
  path: string,
  schema: Schema,
): Promise<z.infer<Schema>> {
  const response = await fetch(path, {
    headers: { accept: "application/json" },
  });
  if (!response.ok) throw new ApiError(response.status);
  return schema.parse(await response.json());
}
