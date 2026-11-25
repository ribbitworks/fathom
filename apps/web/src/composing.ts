// SPDX-License-Identifier: Apache-2.0

// Telling the Enter that accepts a word composed with an input method from the reader's own Enter.

// Safari sends that Enter with isComposing false, and only the old key code 229 marks it.
export const composingWord = ({
  nativeEvent,
}: {
  nativeEvent: KeyboardEvent;
}) =>
  // eslint-disable-next-line @typescript-eslint/no-deprecated -- Safari marks composing only so
  nativeEvent.isComposing || nativeEvent.keyCode === 229;
