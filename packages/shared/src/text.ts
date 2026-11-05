// SPDX-License-Identifier: Apache-2.0

// Plain text, as Fathom keeps names and a link's text: without control characters or the marks that
// change which way text runs, which could make what is shown beside it read as something else. Other
// format characters, such as those joining emoji, are left alone.

const notPlain = /[\p{Cc}\u200E\u200F\u202A-\u202E\u2066-\u2069]/u;

export const isPlainText = (text: string): boolean => !notPlain.test(text);
