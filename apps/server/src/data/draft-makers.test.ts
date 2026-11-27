// SPDX-License-Identifier: Apache-2.0

// Unit tests for who changed a draft, as the makers shown read it from its history.

import { describe, expect, it } from "vitest";
import { makersOf, type MakerRow } from "./draft-makers.ts";

describe("the makers of a draft", () => {
  const made = (
    id: number,
    makerId: string,
    kind: string,
    field: string,
    draft = true,
  ): MakerRow => ({
    id,
    takesBack: null,
    recordType: "person",
    recordId: "r1",
    field,
    tier: field === "secret" ? "confidential" : "general",
    draft,
    kind,
    unpublished: false,
    open: false,
    madeBy: makerId,
    madeAs: null,
    makerId,
    madeAt: new Date(0),
    madeAtMicros: id,
    publishedAtMicros: id,
  });

  it("start again after an approval of fields the reader doesn't see", () => {
    // Given Dan's change, then an approval only of a field the reader doesn't see
    const rows = [
      made(1, "dan", "edit", "name"),
      made(2, "ann", "approval", "secret", false),
    ];

    // When a reader who doesn't see it reads the makers
    const makers = makersOf(
      rows,
      new Set(),
      { userId: "uma", approvesOwn: false },
      (field) => field !== "secret",
    );

    // Then Dan is no longer one
    expect(makers.get("r1")).toBeUndefined();
  });
});
