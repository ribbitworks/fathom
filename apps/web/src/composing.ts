// SPDX-License-Identifier: Apache-2.0

// Telling keys pressed while composing a word with an input method, such as the Enter that accepts
// the word, from the reader's own Enter, Esc and Tab.

// Safari sends the Enter that accepts the word with isComposing false, and only the old key code
// 229 marks it.
export const composingWord = ({
  nativeEvent,
}: {
  nativeEvent: KeyboardEvent;
}): boolean =>
  // eslint-disable-next-line @typescript-eslint/no-deprecated -- Safari marks composing only so
  nativeEvent.isComposing || nativeEvent.keyCode === 229;
