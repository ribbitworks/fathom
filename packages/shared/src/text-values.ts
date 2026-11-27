// SPDX-License-Identifier: Apache-2.0

// The values text columns hold: plain text with no formatting, on one line, and never empty.

import { z } from "zod";
import { isPlainText } from "./text.ts";

// The most characters a text column's value may hold.
export const textLimit = 200;

// Text as kept: trimmed, with each line break written alike, whatever the system it was typed on.
export const tidiedText = (text: string): string =>
  text.replace(/\r\n?/gu, "\n").trim();

// What is wrong with a text column's value, in words to follow its column's name, or undefined.
export function textProblem(text: string): string | undefined {
  if (text.includes("\n")) return "use one line";
  if (!isPlainText(text)) return "use plain text";
  return text.length > textLimit
    ? `use ${textLimit.toLocaleString("en")} characters or fewer`
    : undefined;
}

// A text asked for, tidied, or null for none, as empty text is; its column checks the rest.
export const textValueSchema = z
  .string()
  .nullable()
  .transform((text) => {
    const tidied = text === null ? "" : tidiedText(text);
    return tidied === "" ? null : tidied;
  });
