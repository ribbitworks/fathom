// SPDX-License-Identifier: Apache-2.0

// Unit tests for how a user's private changes are named to their role: whether it reads a change's
// kind.

import { describe, expect, it } from "vitest";
import { type Actor } from "../access.ts";
import { readsChange, type Versions } from "./private-versions.ts";
import { privateChange } from "./test-private-changes.ts";

describe("whether a role reads a change's kind", () => {
  it("is never so for a kind Fathom no longer has", () => {
    const row = { ...privateChange({}, {}), recordType: "retired-kind" };

    expect(
      readsChange({} as Versions, row, {
        permissions: ["people:view"],
      } as unknown as Actor),
    ).toBe(false);
  });
});
