// SPDX-License-Identifier: Apache-2.0

// Record keys, such as FEATURE-123: each kind's word, and reading and writing keys and their links.

import { z } from "zod";
import type { DraftKind } from "./drafts.ts";

// Each kind is its word in lower case, as a link names it. The migration that numbers records names
// the same kinds, and numbers activities too, which links don't name yet.
export const recordKeyKinds = [
  "feature",
  "project",
  "proposal",
  "customer",
  "milestone",
  "release",
  "schedule",
  "person",
  "hire",
  "team",
  "list",
  "column",
  "account",
  "role",
] as const;

export const recordKeyKindSchema = z.enum(recordKeyKinds);

export type RecordKeyKind = z.infer<typeof recordKeyKindSchema>;

// The kind each kind of draft numbers, or null for those without keys, such as a list's choices.
// The migration's record_key_kind function names the same, and numbers activities' drafts too.
export const draftKeyKinds: Record<DraftKind, RecordKeyKind | null> = {
  person: "person",
  "planned-hire": "hire",
  "feature-team": "team",
  list: "list",
  "list-item": null,
  "choice-order": null,
  field: "column",
  "release-stream": "schedule",
  "cycle-pattern": null,
  release: "release",
  feature: "feature",
  customer: "customer",
  proposal: "proposal",
  project: "project",
  milestone: "milestone",
  allocation: null,
  "planning-settings": null,
};

// The largest number PostgreSQL's integer holds, so a number typed into a link that no record could
// have is refused before it is looked up.
const largestKeyNumber = 2_147_483_647;

export const keyNumberSchema = z.number().int().min(1).max(largestKeyNumber);

export const keyMark = "#";

export const recordKey = (kind: RecordKeyKind, keyNumber: number): string =>
  `${kind.toUpperCase()}-${String(keyNumber)}`;

// The key as Fathom shows it, such as #FEATURE-123.
export const shownRecordKey = (
  kind: RecordKeyKind,
  keyNumber: number,
): string => keyMark + recordKey(kind, keyNumber);

// The path a link to a record opens, under the address Fathom is served from.
export const recordLinkPath = (
  kind: RecordKeyKind,
  keyNumber: number,
): string => `/go/${kind}/${String(keyNumber)}`;

export type RecordKeyOf = { kind: RecordKeyKind; keyNumber: number };

export const sameRecordKey = (one: RecordKeyOf, other: RecordKeyOf): boolean =>
  one.kind === other.kind && one.keyNumber === other.keyNumber;

const keyPattern = /^#?([a-z]+)-([1-9][0-9]*)$/iu;

// A key as typed, in any letter case and with or without the #, or undefined when it isn't one.
export function parseRecordKey(text: string): RecordKeyOf | undefined {
  const match = keyPattern.exec(text.trim());
  if (match === null) return undefined;
  const [, word = "", digits = ""] = match;
  const kind = recordKeyKindSchema.safeParse(word.toLowerCase());
  const keyNumber = keyNumberSchema.safeParse(Number(digits));
  return kind.success && keyNumber.success
    ? { kind: kind.data, keyNumber: keyNumber.data }
    : undefined;
}

// A link's kind and number as its path gives them, in any letter case, or undefined when they
// aren't a key's.
export const parseRecordLink = (
  kind: string,
  keyNumber: string,
): RecordKeyOf | undefined => parseRecordKey(`${kind}-${keyNumber}`);
