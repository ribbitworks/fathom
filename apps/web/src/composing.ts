// SPDX-License-Identifier: Apache-2.0

// Keeping keys pressed while composing a word with an input method, such as the Enter that accepts
// the word, from acting as the reader's own Enter, Esc and Tab.

// Whether the key belongs to the word being composed, in which case it goes no further, so neither
// the field nor what holds it, such as a panel that Esc closes, acts on it. Safari sends the Enter
// that accepts the word with isComposing false, and only the old key code 229 marks it.
export function heldForComposing(event: {
  nativeEvent: KeyboardEvent;
  stopPropagation: () => void;
}): boolean {
  const { nativeEvent } = event;
  const composing =
    nativeEvent.isComposing ||
    // eslint-disable-next-line @typescript-eslint/no-deprecated -- Safari marks composing only so
    nativeEvent.keyCode === 229;
  if (composing) event.stopPropagation();
  return composing;
}
