// SPDX-License-Identifier: Apache-2.0

// The values text columns hold: plain text with no formatting, on one line, or on several where the
// column is set to hold them, and never empty.

import { z } from "zod";
import { isPlainText } from "./text.ts";

export const textLimits = { oneLine: 200, severalLines: 2000 } as const;

// The most characters a text column's value may hold.
export const textLimit = (multiline: boolean): number =>
  multiline ? textLimits.severalLines : textLimits.oneLine;

// Text as kept: trimmed, with each line break written alike, whatever the system it was typed on.
export const tidiedText = (text: string): string =>
  text.replace(/\r\n?/gu, "\n").trim();

// What is wrong with a text column's value, in words to follow its column's name, or undefined.
export function textProblem(
  text: string,
  multiline: boolean,
): string | undefined {
  const lines = text.split("\n");
  if (!multiline && lines.length > 1) return "use one line";
  if (!lines.every(isPlainText)) return "use plain text";
  const limit = textLimit(multiline);
  return text.length > limit
    ? `use ${limit.toLocaleString("en")} characters or fewer`
    : undefined;
}

// A text asked for, tidied, or null for none, as empty text is; its column checks the rest.
export const textValueSchema = z
  .string()
  .nullable()
  .transform((text) => {
    const tidied = text === null ? "" : tidiedText(text);
    return tidied === "" ? null : tidied;
  })
  .refine(
    (text) => text === null || text.length <= textLimits.severalLines,
    `Use ${textLimits.severalLines.toLocaleString("en")} characters or fewer`,
  );
