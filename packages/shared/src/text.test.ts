// SPDX-License-Identifier: Apache-2.0

// Tests for plain text, as Fathom keeps names and a link's text.

import { describe, expect, it } from "vitest";
import { isPlainText } from "./text.ts";

// Built from their code points, so the test's own source holds no marks that change direction.
const mark = (codePoint: number) => `a${String.fromCodePoint(codePoint)}b`;

describe("isPlainText", () => {
  it.each([
    ["a control character", "a\u0007b"],
    ["a mark that turns text right to left", mark(0x202e)],
    ["an isolate mark", mark(0x2066)],
  ])("refuses text holding %s", (_, text) => {
    expect(isPlainText(text)).toBe(false);
  });

  it("accepts letters in any script, and emoji joined by format characters", () => {
    expect(isPlainText("Ávery Ōta 한국 👩‍💻")).toBe(true);
  });
});
