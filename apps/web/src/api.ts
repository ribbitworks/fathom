// SPDX-License-Identifier: Apache-2.0

// Requests to Fathom's API, and how failed ones are handled: each failure carries the server's
// status and message, refusals such as a missing sign-in are not retried, a request refused because
// the session has ended sends the user to sign in again, and every failure can be put plainly.

import { keepPreviousData, queryOptions } from "@tanstack/react-query";
import { z } from "zod";

const unauthorized = 401;
const conflictStatus = 409;
const firstServerError = 500;
const maximumRetries = 2;

// A failed request, with the server's status, its message for users when it gave one, and Better
// Auth's code for the problem when it gave one.
export class ApiError extends Error {
  readonly status: number;
  readonly code: string | undefined;
  // The server's own message for users, when it gave one.
  readonly serverMessage: string | undefined;

  constructor(status: number, message?: string, code?: string) {
    super(message ?? `The server answered with status ${String(status)}`);
    this.status = status;
    this.code = code;
    this.serverMessage = message;
  }
}

// Whether the server refused a request as conflicting with a record it has, such as a name taken.
export const isConflict = (error: unknown): boolean =>
  error instanceof ApiError && error.status === conflictStatus;

const failureSchema = z.object({
  error: z.string().optional(),
  code: z.string().optional(),
});

async function failure(response: Response): Promise<ApiError> {
  const body = failureSchema.safeParse(await response.json().catch(() => ({})));
  const { error, code } = body.success ? body.data : {};
  return new ApiError(response.status, error, code);
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
  if (!response.ok) throw await failure(response);
  return schema.parse(await response.json());
}

type Method = "POST" | "PUT" | "PATCH";

async function send(
  method: Method,
  path: string,
  body: object,
): Promise<Response> {
  const response = await fetch(path, {
    method,
    headers: {
      accept: "application/json",
      "content-type": "application/json",
    },
    body: JSON.stringify(body),
  });
  if (!response.ok) throw await failure(response);
  return response;
}

// Sends JSON to the API with a method that changes data.
export async function sendJson(
  method: Method,
  path: string,
  body: object,
): Promise<void> {
  await send(method, path, body);
}

// Sends JSON to the API with a method that changes data, and returns the answer, checked against
// the given schema.
export async function sendJsonFor<Schema extends z.ZodType>(
  method: Method,
  path: string,
  body: object,
  schema: Schema,
): Promise<z.infer<Schema>> {
  return schema.parse(await (await send(method, path, body)).json());
}

async function remove(path: string): Promise<Response> {
  const response = await fetch(path, {
    method: "DELETE",
    headers: { accept: "application/json" },
  });
  if (!response.ok) throw await failure(response);
  return response;
}

// Asks the API to remove something, and returns its answer, checked against the given schema.
export async function sendDeleteFor<Schema extends z.ZodType>(
  path: string,
  schema: Schema,
): Promise<z.infer<Schema>> {
  return schema.parse(await (await remove(path)).json());
}

const forbidden = 403;
const tooManyRequests = 429;

export const notAllowedMessage =
  "Not allowed for this account. Its roles may have changed.";

// Puts a failed request plainly for users: the server's own message when it refused the request for
// a reason the user can act on, and otherwise a plain sentence, never a raw error.
export function describeProblem(error: unknown, fallback: string): string {
  if (!(error instanceof ApiError)) return fallback;
  if (error.status === forbidden) return notAllowedMessage;
  if (error.status === tooManyRequests) {
    return "Too many requests. Wait a minute, then try again.";
  }
  const isRefusal = error.status >= 400 && error.status < firstServerError;
  return isRefusal && error.serverMessage !== undefined
    ? error.serverMessage
    : fallback;
}

// A read of something as it is today, or as of a chosen day, keeping what is shown while another
// day's loads.
export const dayQuery =
  <Schema extends z.ZodType>(name: string, path: string, schema: Schema) =>
  (day: string | undefined) =>
    queryOptions({
      queryKey: day === undefined ? [name] : [name, day],
      queryFn: () =>
        getJson(
          day === undefined ? path : `${path}?on=${encodeURIComponent(day)}`,
          schema,
        ),
      placeholderData: keepPreviousData,
    });
