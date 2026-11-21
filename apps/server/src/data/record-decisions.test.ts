// SPDX-License-Identifier: Apache-2.0

// Unit tests for who may discard drafts that take a stream's cycles along.

import type { Permission, RecordRef } from "@fathom/shared";
import { describe, expect, it } from "vitest";
import { cyclesDiscardRefusal } from "./record-decisions.ts";

const cycles: RecordRef = { type: "cycle-pattern", id: "pattern-1" };
const release: RecordRef = { type: "release", id: "release-1" };
const changesCycles: Permission[] = [
  "configuration:edit",
  "configuration:view",
];
const changesReleasesOnly: Permission[] = ["features:edit", "features:view"];
const refusal = "Only someone who changes cycles can discard this.";

describe("discarding drafts that take cycles along", () => {
  it("is refused to a role that doesn't change cycles", () => {
    expect(cyclesDiscardRefusal([release, cycles], changesReleasesOnly)).toBe(
      refusal,
    );
  });

  it("is allowed to a role that changes cycles", () => {
    expect(
      cyclesDiscardRefusal([release, cycles], changesCycles),
    ).toBeUndefined();
  });

  it("is allowed to any role when no cycles are discarded", () => {
    expect(
      cyclesDiscardRefusal([release], changesReleasesOnly),
    ).toBeUndefined();
  });
});
