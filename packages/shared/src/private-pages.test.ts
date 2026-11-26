// SPDX-License-Identifier: Apache-2.0

// Tests for who may read a private page.

import { describe, expect, it } from "vitest";
import { mayReadPrivatePage } from "./private-pages.ts";

describe("mayReadPrivatePage", () => {
  const maker = "fictional-maker";
  it.each([
    ["its maker, who may make pages", maker, ["private-pages:make"], true],
    ["its maker, no longer allowed to make pages", maker, [], false],
    [
      "another reader, an Administrator",
      "fictional-other",
      ["private-pages:make", "administration:edit"],
      false,
    ],
  ] as const)("lets %s read it: %s", (_who, id, permissions, expected) => {
    expect(mayReadPrivatePage({ id, permissions }, { userId: maker })).toBe(
      expected,
    );
  });
});
