// SPDX-License-Identifier: Apache-2.0

// Unit tests for making a password from the recipe in the password settings: its length, the kinds
// of character it uses, at least one of each, how hard it is to guess, and leaving out look-alikes.

import { defaultPasswordSettings, type PasswordRecipe } from "@fathom/shared";
import { guessScore } from "@fathom/shared/guessable-passwords";
import { describe, expect, it } from "vitest";
import { generatePassword } from "./accounts.ts";

describe("generatePassword", () => {
  const every: PasswordRecipe = {
    length: 12,
    uppercase: true,
    lowercase: true,
    digits: true,
    symbols: true,
    avoidLookAlikes: true,
  };

  it("has the recipe's length, from only the kinds it uses", () => {
    expect(generatePassword(defaultPasswordSettings.recipe)).toMatch(
      /^[A-Za-z\d]{20}$/u,
    );
    expect(
      generatePassword({ ...every, length: 128, uppercase: false }),
    ).toMatch(/^[a-z\d!#$%&*+\-=?@^_~]{128}$/u);
  });

  it("has at least one character of each kind the recipe uses, anywhere in it", () => {
    const firsts = new Set<string>();
    for (let tries = 0; tries < 200; tries += 1) {
      const made = generatePassword(every);
      expect(made).toMatch(/[A-Z]/u);
      expect(made).toMatch(/[a-z]/u);
      expect(made).toMatch(/\d/u);
      expect(made).toMatch(/[!#$%&*+\-=?@^_~]/u);
      firsts.add(/[A-Z]/u.test(made.charAt(0)) ? "uppercase" : "other");
    }
    expect(firsts.size).toBe(2);
  });

  it("is never too easy to guess with the default recipe, though it is not checked", () => {
    const owner = { name: "Fictional Person", email: "person@example.test" };
    for (let tries = 0; tries < 50; tries += 1) {
      expect(
        guessScore(generatePassword(defaultPasswordSettings.recipe), owner),
      ).toBeGreaterThanOrEqual(3);
    }
  });

  it("leaves out characters that look alike, unless asked not to", () => {
    const made = Array.from({ length: 50 }, () =>
      generatePassword({ ...every, length: 128 }),
    ).join("");
    expect(made).not.toMatch(/[ILOilo01]/u);
    const mixed = Array.from({ length: 50 }, () =>
      generatePassword({ ...every, length: 128, avoidLookAlikes: false }),
    ).join("");
    for (const character of "ILOilo01") expect(mixed).toContain(character);
  });
});
