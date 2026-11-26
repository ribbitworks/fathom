// SPDX-License-Identifier: Apache-2.0

// Record keys, such as FEATURE-123, and the random keys of private pages and rows, such as ROW-4X9T:
// each kind's word, and reading and writing keys and their links.

import { z } from "zod";
import type { DraftKind } from "./drafts.ts";

// Each kind is its word in lower case, as a link names it. The migration that numbers records names
// the same kinds.
export const recordKeyKinds = [
  "feature",
  "activity",
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

// The kinds named by a random code rather than a number, as ADR 0014 sets out.
export const randomKeyKindSchema = z.enum(["page", "row"]);

export type RandomKeyKind = z.infer<typeof randomKeyKindSchema>;

// Four or five of the thirty characters that can't be taken for one another, as the database makes
// them.
const randomCodePattern = /^[2-9ABCDEFGHJKMNPQRSTVWXYZ]{4,5}$/u;

// The kind each kind of draft numbers, or null for those without keys, such as a list's choices.
// The migration's record_key_kind function names the same.
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
  activity: "activity",
  allocation: null,
  "planning-settings": null,
};

// The largest number PostgreSQL's integer holds, so a number typed into a link that no record could
// have is refused before it is looked up.
const largestKeyNumber = 2_147_483_647;

export const keyNumberSchema = z.number().int().min(1).max(largestKeyNumber);

export const keyMark = "#";

// A record's key: a number within its kind, or, for a private page or row, a random code.
export type NumberedRecordKey = { kind: RecordKeyKind; keyNumber: number };
export type CodedRecordKey = { kind: RandomKeyKind; code: string };
export type RecordKeyOf = NumberedRecordKey | CodedRecordKey;

export const isCodedKey = (key: RecordKeyOf): key is CodedRecordKey =>
  "code" in key;

// What a key holds after its kind: its number, or its code.
export const keyValue = (key: RecordKeyOf): string =>
  isCodedKey(key) ? key.code : String(key.keyNumber);

export const recordKey = (key: RecordKeyOf): string =>
  `${key.kind.toUpperCase()}-${keyValue(key)}`;

// The key as Fathom shows it, such as #FEATURE-123 or #ROW-4X9T.
export const shownRecordKey = (key: RecordKeyOf): string =>
  keyMark + recordKey(key);

// The path a link to a record opens, under the address Fathom is served from: a numbered key by its
// kind and number, a random one whole.
export const recordLinkPath = (key: RecordKeyOf): string =>
  isCodedKey(key)
    ? `/go/${recordKey(key)}`
    : `/go/${key.kind}/${String(key.keyNumber)}`;

export const sameRecordKey = (one: RecordKeyOf, other: RecordKeyOf): boolean =>
  recordKey(one) === recordKey(other);

const keyPattern = /^#?([a-z]+)-([0-9a-z]+)$/iu;
const numberPattern = /^[1-9][0-9]*$/u;

// A key as typed, in any letter case and with or without the #, or undefined when it isn't one.
export function parseRecordKey(text: string): RecordKeyOf | undefined {
  const match = keyPattern.exec(text.trim());
  if (match === null) return undefined;
  const [, word = "", after = ""] = match;
  const coded = randomKeyKindSchema.safeParse(word.toLowerCase());
  if (coded.success) {
    const code = after.toUpperCase();
    return randomCodePattern.test(code)
      ? { kind: coded.data, code }
      : undefined;
  }
  const kind = recordKeyKindSchema.safeParse(word.toLowerCase());
  const keyNumber = keyNumberSchema.safeParse(Number(after));
  return kind.success && keyNumber.success && numberPattern.test(after)
    ? { kind: kind.data, keyNumber: keyNumber.data }
    : undefined;
}

// A link's kind and number as its path gives them, in any letter case, or undefined when they
// aren't a key's.
export const parseRecordLink = (
  kind: string,
  keyNumber: string,
): RecordKeyOf | undefined => parseRecordKey(`${kind}-${keyNumber}`);
