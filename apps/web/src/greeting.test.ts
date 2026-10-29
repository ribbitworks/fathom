// SPDX-License-Identifier: Apache-2.0

// Tests for reading the greeting from the API: the request it makes, and the errors for a failed
// response and for a response in an unexpected shape.

import { afterEach, describe, expect, it, vi } from "vitest";
import { fetchGreeting } from "./greeting.ts";

function serverAnswers(response: Response) {
  const fetch = vi.fn(() => Promise.resolve(response));
  vi.stubGlobal("fetch", fetch);
  return fetch;
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("reading the greeting", () => {
  it("asks the API for JSON and returns the greeting", async () => {
    const fetch = serverAnswers(Response.json({ greeting: "Hello, Fathom" }));
    await expect(fetchGreeting()).resolves.toEqual({
      greeting: "Hello, Fathom",
    });
    expect(fetch).toHaveBeenCalledWith("/api/greeting", {
      headers: { accept: "application/json" },
    });
  });

  it("fails with the status when the server does not succeed", async () => {
    serverAnswers(Response.json({ error: "Not Found" }, { status: 404 }));
    await expect(fetchGreeting()).rejects.toThrow(
      "The server answered with status 404",
    );
  });

  it("fails when the response is not in the expected shape", async () => {
    serverAnswers(Response.json({ greeting: 42 }));
    await expect(fetchGreeting()).rejects.toThrow();
  });
});
