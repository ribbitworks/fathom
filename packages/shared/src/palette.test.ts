// SPDX-License-Identifier: Apache-2.0

// Tests for the colour a record is shown in.

import { describe, expect, it } from "vitest";
import { colourChangeSchema, shownColourOf } from "./palette.ts";

describe("a colour chosen", () => {
  it("is one of the palette, or none", () => {
    expect(colourChangeSchema.parse({ colour: "teal" })).toEqual({
      colour: "teal",
    });
    expect(colourChangeSchema.parse({ colour: null })).toEqual({
      colour: null,
    });
    expect(colourChangeSchema.safeParse({ colour: "sea" }).success).toBe(false);
  });
});

describe("shownColourOf", () => {
  it("shows a record's own colour over the one it inherits", () => {
    expect(shownColourOf("teal", "grape")).toBe("teal");
  });

  it("shows the inherited colour while the record has none", () => {
    expect(shownColourOf(null, "grape")).toBe("grape");
  });

  it("shows none when neither has a colour", () => {
    expect(shownColourOf(null, null)).toBeNull();
  });
});
