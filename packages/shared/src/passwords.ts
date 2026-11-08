// SPDX-License-Identifier: Apache-2.0

// The password settings an organization chooses: the rules every password a person chooses must
// meet, and the recipe for the passwords Fathom makes for new accounts and resets, which must meet
// those rules too. The front end and the server check both the same way. Whether a password is too
// easy to guess is checked in guessable-passwords.ts, apart from these, since its dictionaries are
// too large for the browser to load before they are needed.

import { z } from "zod";
import { passwordLength } from "./accounts.ts";
import { allOf } from "./words.ts";

export const characterTypes = [
  "uppercase",
  "lowercase",
  "digits",
  "symbols",
] as const;

export type CharacterType = (typeof characterTypes)[number];

// A type of character: the characters of it Fathom's passwords draw on, how a rule names one of
// them and a recipe names them all, and how a password a person chose is checked for one.
export interface CharacterKind {
  type: CharacterType;
  characters: string;
  one: string;
  all: string;
  pattern: RegExp;
}

// Symbols leave out quotes, slashes, brackets, spaces, and punctuation that is hard to tell apart,
// such as | , . ; :, so a password can be read aloud, typed by hand, and pasted into a command line.
// A person's own password may use any symbol: anything but a letter, a digit, or a space.
export const characterKinds: readonly CharacterKind[] = [
  {
    type: "uppercase",
    characters: "ABCDEFGHIJKLMNOPQRSTUVWXYZ",
    one: "an uppercase letter",
    all: "uppercase letters",
    pattern: /\p{Lu}/u,
  },
  {
    type: "lowercase",
    characters: "abcdefghijklmnopqrstuvwxyz",
    one: "a lowercase letter",
    all: "lowercase letters",
    pattern: /\p{Ll}/u,
  },
  {
    type: "digits",
    characters: "0123456789",
    one: "a digit",
    all: "digits",
    pattern: /\p{Nd}/u,
  },
  {
    type: "symbols",
    characters: "!#$%&*+-=?@^_~",
    one: "a symbol",
    all: "symbols",
    pattern: /[^\p{L}\p{N}\s]/u,
  },
];

export const generatedPasswordLength = { minimum: 12, maximum: 128 } as const;

// Characters that are easily mistaken for one another when read aloud or copied by hand.
export const lookAlikeCharacters = "ILOilo01";

const lookAlikePattern = new RegExp(`[${lookAlikeCharacters}]`, "gu");

// The characters of a kind a recipe draws on.
export const recipeCharacters = (
  { characters }: CharacterKind,
  avoidLookAlikes: boolean,
): string =>
  avoidLookAlikes ? characters.replace(lookAlikePattern, "") : characters;

const typeFlags = z.object({
  uppercase: z.boolean(),
  lowercase: z.boolean(),
  digits: z.boolean(),
  symbols: z.boolean(),
});

export const passwordRulesSchema = typeFlags.extend({
  minimumLength: z
    .int()
    .min(passwordLength.minimum)
    .max(passwordLength.maximum),
});

export type PasswordRules = z.infer<typeof passwordRulesSchema>;

export const passwordRecipeSchema = typeFlags.extend({
  length: z
    .int()
    .min(generatedPasswordLength.minimum)
    .max(generatedPasswordLength.maximum),
  avoidLookAlikes: z.boolean(),
});

export type PasswordRecipe = z.infer<typeof passwordRecipeSchema>;

export const passwordSettingsSchema = z.object({
  rules: passwordRulesSchema,
  recipe: passwordRecipeSchema,
});

export type PasswordSettings = z.infer<typeof passwordSettingsSchema>;

export const defaultPasswordSettings: PasswordSettings = {
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
};

// The kinds a rule or recipe asks for.
export const kindsIn = (
  flags: Record<CharacterType, boolean>,
): CharacterKind[] => characterKinds.filter((kind) => flags[kind.type]);

// One thing the rules ask of a password, as the form for a new password lists it, and whether a
// password meets it.
export interface PasswordRequirement {
  label: string;
  isMet: (password: string) => boolean;
}

// The rules, one requirement at a time: the length, then each type of character needed.
export function passwordRequirements(
  rules: PasswordRules,
): PasswordRequirement[] {
  const { minimumLength } = rules;
  return [
    {
      label: `${String(minimumLength)} to ${String(passwordLength.maximum)} characters`,
      isMet: (password) =>
        password.length >= minimumLength &&
        password.length <= passwordLength.maximum,
    },
    ...kindsIn(rules).map(({ one, pattern }) => ({
      label: one.charAt(0).toUpperCase() + one.slice(1),
      isMet: (password: string) => pattern.test(password),
    })),
  ];
}

// What a password a person chose lacks to meet the rules, or undefined when it meets them.
export function passwordProblem(
  rules: PasswordRules,
  password: string,
): string | undefined {
  if (password.length < rules.minimumLength) {
    return `The password must have at least ${String(rules.minimumLength)} characters.`;
  }
  if (password.length > passwordLength.maximum) {
    return `The password must have at most ${String(passwordLength.maximum)} characters.`;
  }
  const missing = kindsIn(rules).filter(
    ({ pattern }) => !pattern.test(password),
  );
  return missing.length === 0
    ? undefined
    : `The password must include ${allOf(missing.map(({ one }) => one))}.`;
}

// Why the recipe cannot be saved with the rules, one reason for each problem, or none.
export function recipeProblems({ rules, recipe }: PasswordSettings): string[] {
  const problems: string[] = [];
  if (kindsIn(recipe).length === 0) {
    problems.push(
      "Select at least one character type for generated passwords.",
    );
  }
  if (recipe.length < rules.minimumLength) {
    problems.push(
      `Generated passwords must have at least ${String(rules.minimumLength)} characters to meet the minimum length.`,
    );
  }
  for (const kind of kindsIn(rules)) {
    if (!recipe[kind.type]) {
      problems.push(
        `Generated passwords must include ${kind.all}, because passwords must contain ${kind.one}.`,
      );
    }
  }
  return problems;
}

// Passwords a person chooses must score at least this on zxcvbn's scale of 0 to 4, which estimates
// how many guesses an attacker would need: 3 means at least 10^8.
export const safeGuessScore = 3;

export const guessablePasswordMessage =
  "This password is too common or easy to guess.";

// Whose password it is, so one built from their own name or email address counts as easy to guess.
export interface PasswordOwner {
  name: string;
  email: string;
}

// The words of an owner's name and email address that zxcvbn treats as easy to guess: each whole,
// each word of the name, and the email address's local part, whole and in its pieces.
export function ownerWords({ name, email }: PasswordOwner): string[] {
  const localPart = email.replace(/@.*$/su, "");
  const words = [
    name,
    ...name.split(/[\s\p{P}]+/u),
    email,
    localPart,
    ...localPart.split(/[._+-]+/u),
  ];
  return [...new Set(words.map((word) => word.trim()))].filter(
    (word) => word.length > 0,
  );
}
