// SPDX-License-Identifier: Apache-2.0

// Tests for the check of passwords that are too common or easy to guess: zxcvbn's scores for common
// passwords and for passwords built from the owner's name or email address, and where the line is.

import { describe, expect, it } from "vitest";
import { guessScore, isGuessable } from "./guessable-passwords.ts";
import { ownerWords, safeGuessScore } from "./passwords.ts";

const owner = {
  name: "Fictional Chooser",
  email: "fictional.chooser@example.test",
};
const stranger = { name: "Someone Else", email: "someone.else@example.test" };

describe("guessScore", () => {
  it.each([
    "test12345678",
    "password1234",
    "Passw0rd!Passw0rd!",
    "qwertyuiop12",
  ])("scores %s, a common password or pattern, below the line", (password) => {
    expect(guessScore(password, stranger)).toBeLessThan(safeGuessScore);
  });

  it.each(["fictional password 2", "Correct-horse-9", "hire-the-best-1"])(
    "scores %s at or above the line",
    (password) => {
      expect(guessScore(password, stranger)).toBeGreaterThanOrEqual(
        safeGuessScore,
      );
    },
  );

  it("scores a password built from the owner's name or email address lower than for anyone else", () => {
    for (const password of [
      "fictional.chooser@example.test",
      "FictionalChooser",
    ]) {
      expect(guessScore(password, owner)).toBeLessThan(
        guessScore(password, stranger),
      );
    }
    expect(guessScore("FictionalChooser", owner)).toBeLessThan(safeGuessScore);
    expect(guessScore("fictional.chooser1234", owner)).toBeLessThan(
      safeGuessScore,
    );
  });
});

describe("isGuessable", () => {
  it("refuses a password scoring below 3, and accepts one scoring 3 or more", () => {
    expect(safeGuessScore).toBe(3);
    expect(guessScore("QuietMaple42", owner)).toBe(3);
    expect(isGuessable("QuietMaple42", owner)).toBe(false);
    expect(guessScore("thirteen-char", owner)).toBe(2);
    expect(isGuessable("thirteen-char", owner)).toBe(true);
    expect(isGuessable("test12345678", owner)).toBe(true);
    expect(isGuessable("Correct-horse-9", owner)).toBe(false);
  });
});

describe("ownerWords", () => {
  it("gives the name and email address whole and in their words", () => {
    expect(ownerWords(owner)).toEqual([
      "Fictional Chooser",
      "Fictional",
      "Chooser",
      "fictional.chooser@example.test",
      "fictional.chooser",
      "fictional",
      "chooser",
    ]);
  });

  it("leaves out repeats and empty words", () => {
    expect(
      ownerWords({
        name: " Ann-Marie  O'Neil ",
        email: "ann+fathom@example.test",
      }),
    ).toEqual([
      "Ann-Marie  O'Neil",
      "Ann",
      "Marie",
      "O",
      "Neil",
      "ann+fathom@example.test",
      "ann+fathom",
      "ann",
      "fathom",
    ]);
  });
});
