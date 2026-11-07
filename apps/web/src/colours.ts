// SPDX-License-Identifier: Apache-2.0

// The palette's colours as the page shows them: as CSS values from the theme, and in words.

// A shade of a theme colour, as a CSS value.
export const colourVariable = (colour: string, shade: "filled" | "light") =>
  `var(--mantine-color-${colour}-${shade})`;

// A colour's name in words, such as "Grape".
export const colourWords = (colour: string) =>
  `${colour.charAt(0).toUpperCase()}${colour.slice(1)}`;
