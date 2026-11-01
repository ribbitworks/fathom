// SPDX-License-Identifier: Apache-2.0

// A person's initials, for their avatar: the first letters of their first two names.

// Each name's first character is taken whole, as the reader sees it, so no character is ever split,
// whatever its script.
const characters = new Intl.Segmenter(undefined, { granularity: "grapheme" });

export function initials(name: string): string {
  return name
    .split(/\s+/)
    .filter((part) => part !== "")
    .slice(0, 2)
    .map((part) =>
      [...characters.segment(part)]
        .slice(0, 1)
        .map(({ segment }) => segment.toUpperCase())
        .join(""),
    )
    .join("");
}
