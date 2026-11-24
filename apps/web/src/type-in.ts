// SPDX-License-Identifier: Apache-2.0

// Puts what a text box shows after a key, laid out as typed, such as a date, back in the box with its
// cursor, for every box that lays its text out as it is typed.

import type { Typing } from "@fathom/shared";

// Writing the box before React renders means React finds it already showing the text, so it leaves
// the cursor in place rather than at the end.
export function typeIn(
  box: HTMLInputElement,
  asTyped: (typing: Typing) => Typing,
): string {
  const { text, cursor } = asTyped({
    text: box.value,
    cursor: box.selectionStart,
  });
  box.value = text;
  box.setSelectionRange(cursor, cursor);
  return text;
}
