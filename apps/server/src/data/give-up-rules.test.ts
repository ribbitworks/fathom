// SPDX-License-Identifier: Apache-2.0

// Unit tests for which of a user's private changes a give-up takes back.

import { describe, expect, it } from "vitest";
import { givenUpWith, type HeldCandidate } from "./give-up-rules.ts";

const held: HeldCandidate = {
  madeAtMicros: 20,
  sinceMicros: 10,
  takenBack: false,
  undone: false,
  undoesPrivate: false,
};

describe("a private change a give-up takes back", () => {
  it.each([
    [
      "one made since the user began their private change to the record, an undo of a change set already published included",
      held,
      true,
    ],
    [
      "one made at the moment they began it",
      { ...held, madeAtMicros: 10 },
      true,
    ],
    [
      "one made before they last took the record back by hand, by discarding or reverting it",
      { ...held, madeAtMicros: 5 },
      false,
    ],
    [
      "one of a record they hold no private change to",
      { ...held, sinceMicros: null },
      false,
    ],
    [
      "one a change given up names already",
      { ...held, takenBack: true },
      false,
    ],
    [
      "one in a private change set undone since",
      { ...held, undone: true },
      false,
    ],
    [
      "the undo of a private change set",
      { ...held, undoesPrivate: true },
      false,
    ],
  ])("is %s", (_, change, taken) => {
    expect(givenUpWith(change)).toBe(taken);
  });
});
