// SPDX-License-Identifier: Apache-2.0

// Unit tests for the checks on publishing private changes: what they do with an error that is no
// refusal.

import { describe, expect, it } from "vitest";
import { type Actor } from "../access.ts";
import { type Transaction } from "./changes.ts";
import { type Versions } from "./private-versions.ts";
import { refuseMisfits } from "./publish-checks.ts";
import { privateChange } from "./test-private-changes.ts";

describe("checking private changes on publishing", () => {
  it("passes on an error that is no refusal, as it is", async () => {
    // Given records that can't be read, so checking a release fails
    const versions = {
      rows: [],
      records: { mine: {}, theirs: {} },
    } as unknown as Versions;
    const row = {
      ...privateChange({ name: "Fictional" }, {}, "created"),
      recordType: "release",
    };

    // When it is checked, then the failure isn't taken for a refusal
    await expect(
      refuseMisfits(
        {} as unknown as Transaction,
        { user: { id: "user-ben" } } as Actor,
        versions,
        [row],
      ),
    ).rejects.toBeInstanceOf(TypeError);
  });
});
