// SPDX-License-Identifier: Apache-2.0

// Tests for the password settings: the defaults, how the rules are put in words and checked against
// a password a person chose, with the check for one too easy to guess after them, which characters a
// recipe draws on, and which recipes the rules refuse.

import { describe, expect, it, vi } from "vitest";
import {
  characterKinds,
  chosenPasswordProblem,
  defaultPasswordSettings,
  guessablePasswordMessage,
  type PasswordRules,
  passwordProblem,
  passwordRequirements,
  passwordSettingsSchema,
  type PasswordSettings,
  recipeCharacters,
  recipeProblems,
} from "./passwords.ts";

const noRules = defaultPasswordSettings.rules;
const allRules: PasswordRules = {
  minimumLength: 12,
  uppercase: true,
  lowercase: true,
  digits: true,
  symbols: true,
};

const kind = (type: string) => {
  const found = characterKinds.find((each) => each.type === type);
  if (found === undefined) throw new Error(`No kind ${type}`);
  return found;
};

describe("the defaults", () => {
  it("ask for 12 characters and nothing more, and make 20 letters and digits without look-alikes", () => {
    expect(defaultPasswordSettings).toEqual({
      rules: {
        minimumLength: 12,
        uppercase: false,
        lowercase: false,
        digits: false,
        symbols: false,
      },
      recipe: {
        length: 20,
        uppercase: true,
        lowercase: true,
        digits: true,
        symbols: false,
        avoidLookAlikes: true,
      },
    });
    expect(recipeProblems(defaultPasswordSettings)).toEqual([]);
  });
});

describe("passwordSettingsSchema", () => {
  it.each([
    ["a minimum below 8", { rules: { ...noRules, minimumLength: 7 } }],
    ["a minimum above 128", { rules: { ...noRules, minimumLength: 129 } }],
    [
      "a length below 12",
      { recipe: { ...defaultPasswordSettings.recipe, length: 11 } },
    ],
    [
      "a length that is not whole",
      { recipe: { ...defaultPasswordSettings.recipe, length: 20.5 } },
    ],
  ])("refuses %s", (_, change) => {
    expect(
      passwordSettingsSchema.safeParse({
        ...defaultPasswordSettings,
        ...change,
      }).success,
    ).toBe(false);
  });
});

describe("passwordRequirements", () => {
  const labels = (rules: PasswordRules) =>
    passwordRequirements(rules).map(({ label }) => label);

  it("names only the length when nothing else is needed", () => {
    expect(labels(noRules)).toEqual(["12 to 128 characters"]);
  });

  it("names the length, then every kind needed", () => {
    expect(labels({ ...allRules, minimumLength: 14 })).toEqual([
      "14 to 128 characters",
      "An uppercase letter",
      "A lowercase letter",
      "A digit",
      "A symbol",
    ]);
  });

  it("is met by a password of 14 to 128 characters", () => {
    const [length] = passwordRequirements({ ...noRules, minimumLength: 14 });
    expect(length?.isMet("p".repeat(13))).toBe(false);
    expect(length?.isMet("p".repeat(14))).toBe(true);
    expect(length?.isMet("p".repeat(128))).toBe(true);
    expect(length?.isMet("p".repeat(129))).toBe(false);
  });

  it("is met for each kind by a password that has one", () => {
    const [, uppercase, lowercase, digit, symbol] =
      passwordRequirements(allRules);
    expect(uppercase?.isMet("correct")).toBe(false);
    expect(uppercase?.isMet("Correct")).toBe(true);
    expect(lowercase?.isMet("CORRECT")).toBe(false);
    expect(lowercase?.isMet("Correct")).toBe(true);
    expect(digit?.isMet("Correct")).toBe(false);
    expect(digit?.isMet("Correct 9")).toBe(true);
    expect(symbol?.isMet("Correct 9")).toBe(false);
    expect(symbol?.isMet("Correct-9")).toBe(true);
  });
});

describe("passwordProblem", () => {
  it("accepts a password that meets every rule", () => {
    expect(passwordProblem(allRules, "Correct-horse-9")).toBeUndefined();
  });

  it("refuses a password shorter than the minimum", () => {
    expect(
      passwordProblem({ ...noRules, minimumLength: 14 }, "thirteen-char"),
    ).toBe("The password must have at least 14 characters.");
  });

  it("refuses a password longer than 128 characters", () => {
    expect(passwordProblem(noRules, "p".repeat(129))).toBe(
      "The password must have at most 128 characters.",
    );
  });

  it.each([
    [
      "uppercase",
      "correct-horse-9",
      "The password must include an uppercase letter.",
    ],
    [
      "lowercase",
      "CORRECT-HORSE-9",
      "The password must include a lowercase letter.",
    ],
    ["digits", "Correct-horse-nine", "The password must include a digit."],
    ["symbols", "CorrectHorse9xx", "The password must include a symbol."],
  ])(
    "refuses a password without %s when the rule needs them",
    (type, password, problem) => {
      expect(passwordProblem({ ...noRules, [type]: true }, password)).toBe(
        problem,
      );
      expect(passwordProblem(noRules, password)).toBeUndefined();
    },
  );

  it("names everything missing at once", () => {
    expect(passwordProblem(allRules, "correcthorsebattery")).toBe(
      "The password must include an uppercase letter, a digit, and a symbol.",
    );
  });

  it("counts letters and digits of every script, and no space as a symbol", () => {
    expect(passwordProblem(allRules, "Ёжик в тумане ٣")).toBe(
      "The password must include a symbol.",
    );
    expect(passwordProblem(allRules, "Ёжик-в-тумане-٣")).toBeUndefined();
  });
});

describe("recipeCharacters", () => {
  it("draws on every character of a kind, or all but the look-alikes", () => {
    expect(recipeCharacters(kind("uppercase"), false)).toHaveLength(26);
    expect(recipeCharacters(kind("uppercase"), true)).toBe(
      "ABCDEFGHJKMNPQRSTUVWXYZ",
    );
    expect(recipeCharacters(kind("lowercase"), true)).toBe(
      "abcdefghjkmnpqrstuvwxyz",
    );
    expect(recipeCharacters(kind("digits"), true)).toBe("23456789");
    expect(recipeCharacters(kind("symbols"), true)).toBe("!#$%&*+-=?@^_~");
  });

  it("uses only symbols a person would count as one", () => {
    const symbols = kind("symbols");
    expect(
      Array.from(recipeCharacters(symbols, false)).every((character) =>
        symbols.pattern.test(character),
      ),
    ).toBe(true);
  });
});

describe("recipeProblems", () => {
  const settings = (
    rules: Partial<PasswordRules>,
    recipe: Partial<PasswordSettings["recipe"]> = {},
  ): PasswordSettings => ({
    rules: { ...noRules, ...rules },
    recipe: { ...defaultPasswordSettings.recipe, ...recipe },
  });

  it("refuses a recipe with no kind of character", () => {
    expect(
      recipeProblems(
        settings(
          {},
          { uppercase: false, lowercase: false, digits: false, symbols: false },
        ),
      ),
    ).toEqual(["Select at least one character type for generated passwords."]);
  });

  it("refuses a recipe shorter than the rule's minimum", () => {
    expect(recipeProblems(settings({ minimumLength: 24 }))).toEqual([
      "Generated passwords must have at least 24 characters to meet the minimum length.",
    ]);
  });

  it("refuses a recipe without a kind the rules need", () => {
    expect(
      recipeProblems(
        settings({ symbols: true, digits: true }, { digits: false }),
      ),
    ).toEqual([
      "Generated passwords must include digits, because passwords must contain a digit.",
      "Generated passwords must include symbols, because passwords must contain a symbol.",
    ]);
  });

  it("accepts a recipe that uses every kind the rules need", () => {
    expect(
      recipeProblems(settings({ symbols: true }, { symbols: true })),
    ).toEqual([]);
  });
});

describe("chosenPasswordProblem", () => {
  const owner = { name: "Fictional Person", email: "person@example.test" };

  it("names what the password lacks first, without asking whether it is easy to guess", () => {
    const isGuessable = vi.fn(() => true);
    expect(
      chosenPasswordProblem(
        { ...noRules, symbols: true },
        "correcthorse9",
        owner,
        isGuessable,
      ),
    ).toBe("The password must include a symbol.");
    expect(isGuessable).not.toHaveBeenCalled();
  });

  it("refuses a password that meets the rules but is easy to guess for its owner", () => {
    const isGuessable = vi.fn(() => true);
    expect(
      chosenPasswordProblem(noRules, "correct-horse-9", owner, isGuessable),
    ).toBe(guessablePasswordMessage);
    expect(isGuessable).toHaveBeenCalledWith("correct-horse-9", owner);
  });

  it("accepts a password that meets the rules and is hard to guess", () => {
    expect(
      chosenPasswordProblem(noRules, "correct-horse-9", owner, () => false),
    ).toBeUndefined();
  });

  it("accepts a password that meets the rules when there is no check to ask yet", () => {
    expect(
      chosenPasswordProblem(noRules, "correct-horse-9", owner, undefined),
    ).toBeUndefined();
  });
});
