// SPDX-License-Identifier: Apache-2.0

// Tests for the words of a removal's question and of its notification.

import { describe, expect, it } from "vitest";
import { removalQuestion, removedWords } from "./removal-question.tsx";

describe("a removal's words", () => {
  const removed = { kind: "page", name: "Follow-ups" };

  it("asks by the kind and the name, with Remove", () => {
    expect(removalQuestion(removed)).toEqual({
      title: "Remove the Follow-ups page?",
      action: "Remove",
    });
  });

  it("says what was removed", () => {
    expect(removedWords(removed)).toBe("Removed the Follow-ups page.");
  });
});
