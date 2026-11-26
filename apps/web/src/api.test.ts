// SPDX-License-Identifier: Apache-2.0

// Tests for reading JSON from the API: the request it makes, and the errors for a failed response
// and for a response in an unexpected shape.

import { afterEach, describe, expect, it, vi } from "vitest";
import { z } from "zod";
import { getJson } from "./api.ts";

const answerSchema = z.object({ answer: z.string() });

function serverAnswers(response: Response) {
  const fetch = vi.fn(() => Promise.resolve(response));
  vi.stubGlobal("fetch", fetch);
  return fetch;
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("reading JSON from the API", () => {
  it("asks for JSON and returns what the server answers", async () => {
    const fetch = serverAnswers(Response.json({ answer: "Fictional" }));
    await expect(getJson("/api/fictional", answerSchema)).resolves.toEqual({
      answer: "Fictional",
    });
    expect(fetch).toHaveBeenCalledWith("/api/fictional", {
      headers: { accept: "application/json" },
    });
  });

  it("fails with the server's status and message when it does not succeed", async () => {
    serverAnswers(Response.json({ error: "Not Found" }, { status: 404 }));
    await expect(getJson("/api/fictional", answerSchema)).rejects.toMatchObject(
      { status: 404, message: "Not Found" },
    );
  });

  it.each([
    ["is not JSON", new Response("Not JSON", { status: 502 })],
    ["is JSON of another shape", Response.json("Bad Gateway", { status: 502 })],
  ])(
    "fails with the status alone when the server's answer %s",
    async (_case, answer) => {
      serverAnswers(answer);
      await expect(
        getJson("/api/fictional", answerSchema),
      ).rejects.toMatchObject({
        status: 502,
        message: "The server answered with status 502",
      });
    },
  );

  it("fails when the response is not in the expected shape", async () => {
    serverAnswers(Response.json({ answer: 42 }));
    await expect(getJson("/api/fictional", answerSchema)).rejects.toThrow();
  });
});
