// SPDX-License-Identifier: Apache-2.0

// Whether a key ends composing a word with an input method, as Enter does to accept the word: then
// it isn't the reader's Enter, and a field that acts on Enter leaves it alone.

// Safari sends that Enter with isComposing false, and only the old key code 229 marks it.
export const composingWord = ({
  nativeEvent,
}: {
  nativeEvent: KeyboardEvent;
}) =>
  // eslint-disable-next-line @typescript-eslint/no-deprecated -- Safari marks composing only so
  nativeEvent.isComposing || nativeEvent.keyCode === 229;
