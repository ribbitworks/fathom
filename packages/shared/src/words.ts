// SPDX-License-Identifier: Apache-2.0

// Several names in one phrase, as a sentence says them: "A, B, and C", or "A, B, or C".

const language = "en";
const all = new Intl.ListFormat(language, { type: "conjunction" });
const either = new Intl.ListFormat(language, { type: "disjunction" });

export const allOf = (names: readonly string[]): string => all.format(names);

export const eitherOf = (names: readonly string[]): string =>
  either.format(names);
