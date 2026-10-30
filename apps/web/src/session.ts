// SPDX-License-Identifier: Apache-2.0

// Signing in and out, and the signed-in user, through the server's API. Responses are checked
// against the shared schemas, so the page never shows data in a shape it does not expect.

import {
  sessionResponseSchema,
  type SessionResponse,
  type SignInRequest,
} from "@fathom/shared";
import { queryOptions } from "@tanstack/react-query";
import { ApiError, getJson, isSignedOut } from "./api.ts";

export type SignedInUser = SessionResponse["user"];

const unauthorized = 401;
const tooManyRequests = 429;
const json = {
  accept: "application/json",
  "content-type": "application/json",
};

async function fetchSession(): Promise<SignedInUser | null> {
  try {
    return (await getJson("/api/session", sessionResponseSchema)).user;
  } catch (error) {
    if (isSignedOut(error)) return null;
    throw error;
  }
}

// The signed-in user, or null when no one is signed in.
export const sessionQuery = queryOptions({
  queryKey: ["session"],
  queryFn: fetchSession,
});

export type SignInResult = "signed-in" | "refused" | "too-many-attempts";

export async function signIn(request: SignInRequest): Promise<SignInResult> {
  const response = await fetch("/api/auth/sign-in/email", {
    method: "POST",
    headers: json,
    body: JSON.stringify(request),
  });
  if (response.ok) return "signed-in";
  if (response.status === tooManyRequests) return "too-many-attempts";
  if (response.status === unauthorized) return "refused";
  throw new ApiError(response.status);
}

export async function signOut(): Promise<void> {
  const response = await fetch("/api/auth/sign-out", {
    method: "POST",
    headers: json,
    body: "{}",
  });
  if (!response.ok) throw new ApiError(response.status);
}

// Where to go after signing in: a page within Fathom, or the home page. The address is resolved as
// the browser would resolve it, so one that leads anywhere else, however it is written, is ignored,
// and a crafted link cannot send a user away after sign-in.
export function safeRedirect(
  target: string | undefined,
  origin: string = window.location.origin,
): string {
  const url = target === undefined ? null : URL.parse(target, origin);
  if (url?.origin !== origin) return "/";
  return `${url.pathname}${url.search}${url.hash}`;
}
