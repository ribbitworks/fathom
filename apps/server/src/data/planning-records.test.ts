// SPDX-License-Identifier: Apache-2.0

// Unit tests for reading what a batch of records asks for once per thing asked.

import { describe, expect, it, vi } from "vitest";
import { readOnce } from "./planning-records.ts";

describe("reading once", () => {
  it("reads each thing asked for once, however often it is asked for", async () => {
    const read = vi.fn((list: string, asked: string | null, had: unknown) =>
      Promise.resolve(`${list} ${String(asked)} ${String(had)}`),
    );
    const once = readOnce(read);

    const answers = [
      await once("feature-sizes", "small", undefined),
      await once("feature-sizes", "small", undefined),
      await once("feature-sizes", "large", undefined),
      await once("feature-sizes", "small", "small"),
      await once("feature-risks", "small", undefined),
    ];

    expect(answers[0]).toBe(answers[1]);
    expect(read.mock.calls).toEqual([
      ["feature-sizes", "small", undefined],
      ["feature-sizes", "large", undefined],
      ["feature-sizes", "small", "small"],
      ["feature-risks", "small", undefined],
    ]);
  });

  it("keeps a refusal, refusing each later ask for the same thing without reading again", async () => {
    const read = vi.fn((asked: string) =>
      Promise.reject(new Error(`Choose a ${asked} that is offered`)),
    );
    const once = readOnce(read);

    await expect(once("size")).rejects.toThrow("Choose a size that is offered");
    await expect(once("size")).rejects.toThrow("Choose a size that is offered");
    expect(read).toHaveBeenCalledTimes(1);
  });
});
