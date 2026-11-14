// SPDX-License-Identifier: Apache-2.0

// How searches match text, the same in the browser and on the server: every word typed must appear
// somewhere, ignoring letter case and accents.

// Text folded for matching, so letter case and accents do not matter. Only accents are dropped, such
// as on é or ё, not marks that make another letter in other scripts, such as Japanese が from か, and
// Korean syllables are put back together after their parts are separated to find accents. Cyrillic
// letters with a breve, such as й, fold like accented ones, so they also match the plain letter.
// Letters drawn with a stroke rather than an accent, such as ø, đ and ł, which don't separate into a
// letter and an accent, fold to the plain letter too.
const stroked: readonly (readonly [RegExp, string])[] = [
  [/ø/g, "o"],
  [/đ/g, "d"],
  [/ł/g, "l"],
  [/ħ/g, "h"],
  [/ŧ/g, "t"],
];

export function folded(text: string): string {
  const lower = text
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .normalize("NFC")
    .toLocaleLowerCase();
  return stroked.reduce(
    (foldedSoFar, [letter, plain]) => foldedSoFar.replace(letter, plain),
    lower,
  );
}

// The words of a search, folded, leaving out empty ones.
export function searchWords(search: string): string[] {
  return folded(search).split(/\s+/).filter(Boolean);
}

// Whether text holds every word of a search.
export function matchesWords(text: string, words: readonly string[]): boolean {
  const haystack = folded(text);
  return words.every((word) => haystack.includes(word));
}
