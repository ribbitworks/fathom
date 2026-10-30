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

  it("fails with the server's status and message when it does not succeed", async () => {
    serverAnswers(Response.json({ error: "Not Found" }, { status: 404 }));
    await expect(fetchGreeting()).rejects.toMatchObject({
      status: 404,
      message: "Not Found",
    });
  });

  it.each([
    ["is not JSON", new Response("Not JSON", { status: 502 })],
    ["is JSON of another shape", Response.json("Bad Gateway", { status: 502 })],
  ])(
    "fails with the status alone when the server's answer %s",
    async (_case, answer) => {
      serverAnswers(answer);
      await expect(fetchGreeting()).rejects.toMatchObject({
        status: 502,
        message: "The server answered with status 502",
      });
    },
  );

  it("fails when the response is not in the expected shape", async () => {
    serverAnswers(Response.json({ greeting: 42 }));
    await expect(fetchGreeting()).rejects.toThrow();
  });
});
