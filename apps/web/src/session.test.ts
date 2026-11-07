// SPDX-License-Identifier: Apache-2.0

// Tests for the session and API functions on their own: where a user may be sent after signing in,
// the errors for responses the page does not expect, and which failed requests are tried again.

import { afterEach, describe, expect, it, vi } from "vitest";
import { ApiError, describeProblem, shouldRetry } from "./api.ts";
import { safeRedirect, sessionQuery } from "./session.ts";

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("where to go after signing in", () => {
  const origin = "https://fathom.example.test";

  it("keeps pages within Fathom", () => {
    expect(safeRedirect("/people?tab=details#notes", origin)).toBe(
      "/people?tab=details#notes",
    );
  });

  it.each([
    ["no page asked for", undefined],
    ["another site's address", "https://another.example.test/"],
    ["an address without its scheme", "//another.example.test/"],
    ["a backslash", "/\\another.example.test/"],
    ["a tab", "/\t/another.example.test/"],
    ["a line break", "/\n/another.example.test/"],
    ["something that is not an address", "https://[not-an-address"],
  ])("goes home for %s", (_case, target) => {
    expect(safeRedirect(target, origin)).toBe("/");
  });

  it("uses the page's own address when none is given", () => {
    expect(safeRedirect("/people")).toBe("/people");
  });
});

describe("reading the session", () => {
  it("fails when the server does not answer as expected", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(() =>
        Promise.resolve(Response.json({ error: "Fictional" }, { status: 500 })),
      ),
    );
    await expect(sessionQuery.queryFn?.({} as never)).rejects.toMatchObject({
      status: 500,
    });
  });
});

describe("retrying failed requests", () => {
  it("tries again after server errors and lost connections, up to twice", () => {
    expect(shouldRetry(0, new ApiError(500))).toBe(true);
    expect(shouldRetry(1, new TypeError("Failed to fetch"))).toBe(true);
    expect(shouldRetry(2, new ApiError(503))).toBe(false);
  });

  it("does not try again after the server refuses", () => {
    expect(shouldRetry(0, new ApiError(401))).toBe(false);
    expect(shouldRetry(0, new ApiError(404))).toBe(false);
  });
});

describe("putting failures plainly", () => {
  const fallback = "Fathom could not make this change. Try again in a moment.";

  it.each([
    [
      "the server's own message for a refusal",
      new ApiError(409, "Already exists"),
      "Already exists",
    ],
    ["a refusal without a message", new ApiError(400), fallback],
    [
      "a server error, whatever it says",
      new ApiError(500, "Internal Server Error"),
      fallback,
    ],
    ["a lost connection", new TypeError("Failed to fetch"), fallback],
    [
      "a missing permission",
      new ApiError(403, "Forbidden"),
      "You do not have permission to do this. Your role may have changed.",
    ],
    [
      "too many requests",
      new ApiError(429),
      "Too many requests. Wait a minute, then try again.",
    ],
  ])("describes %s", (_case, error, message) => {
    expect(describeProblem(error, fallback)).toBe(message);
  });
});
