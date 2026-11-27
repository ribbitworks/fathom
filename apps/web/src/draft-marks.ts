// SPDX-License-Identifier: Apache-2.0

// Which draft marks a record, its values and its parts, and the words its dot stands for, shared by
// every page's marks.

import type { DraftState } from "@fathom/shared";

export interface DraftLike {
  action?: "created" | "changed" | "deleted" | undefined;
  state: DraftState;
  reason?: string | undefined;
  // Whether a change retires the record, or restores it, when it does either.
  retiring?: boolean;
  // Whether it moves an item to another place in its list.
  moved?: boolean;
  // Whether it holds the user's own changes, which only they see until they publish them.
  unpublished?: boolean | undefined;
}

const rejectedWord = "Rejected";

// What a draft does to its item, in a word, where it does more than change a value.
type ChangeWord =
  "moved" | "added" | "removed" | "reordered" | "retired" | "restored";

export function changeWord(draft: DraftLike): ChangeWord | undefined {
  if (draft.moved === true) return "moved";
  if (draft.action === "created") return "added";
  if (draft.action === "deleted") return "removed";
  if (draft.action === undefined) return "reordered";
  if (draft.retiring !== undefined) {
    return draft.retiring ? "retired" : "restored";
  }
  return undefined;
}

// What a waiting draft does to an item, as Live's words name it.
const waitingChanges: Record<ChangeWord, string> = {
  moved: "A move",
  added: "Its addition",
  removed: "Its removal",
  reordered: "A new order",
  retired: "Its retirement",
  restored: "Its restoration",
};

// What kind of change waits for an item, where the view shows only what is live, so the change is
// named without showing it, as Live's tip and an exported file say it.
export function waitingWords(draft: DraftLike): string {
  if (draft.unpublished === true) return "A change isn't published yet.";
  const change = changeWord(draft);
  const waiting =
    // The key is one of the union's own.
    // eslint-disable-next-line security/detect-object-injection
    change === undefined ? "A change" : waitingChanges[change];
  return `${waiting} is waiting for approval.`;
}

export const rejectedChangeWords = "A change was rejected.";

// Live's words where the view shows only what is live.
export const liveWaitingWords = (draft: DraftLike): string =>
  `Live. ${waitingWords(draft)}`;

// What a draft is, in words, naming what it does, so a rejected one still says what was rejected.
export function draftWords(draft: DraftLike): string {
  const change = changeWord(draft);
  if (draft.state === "rejected") {
    const rejected =
      change === undefined ? rejectedWord : `${rejectedWord}, ${change}`;
    return draft.reason === undefined
      ? rejected
      : `${rejected}: ${draft.reason}`;
  }
  return change === undefined ? "Draft" : `Draft: ${change}`;
}

// What a value was before a draft changed it, as wasWords gives it, or null where it was empty.
export type Was = string | null;

// What a draft's change says of a value: when it takes effect, who made it, and what the value was,
// where each is known.
export interface Change {
  from?: string | undefined;
  by?: string | undefined;
  was?: Was | undefined;
  // Whether the draft leaves the value empty, so the tip says so, since nothing shows in its place.
  emptied?: boolean | undefined;
}

// The words a draft's dot stands for: its tip, and what is read aloud after the item it marks, with
// what the value was, when the change takes effect and who made it, where those are known, and a
// rejection's reason last, since it is a sentence of its own.
export function draftTip(
  draft: DraftLike,
  { from, by, was, emptied = false }: Change = {},
): string {
  const words = draftWords({ ...draft, reason: undefined });
  const told = [
    wasPhrase(words, was, emptied),
    ...(draft.unpublished === true ? ["unpublished"] : []),
    ...(from === undefined ? [] : [`from ${from}`]),
    ...(by === undefined ? [] : [`by ${by}`]),
  ].join(", ");
  return draft.state === "rejected" && draft.reason !== undefined
    ? `${told}: ${draft.reason}`
    : told;
}

// What a draft did to a value, after the draft's words: emptied it, filled it in, or changed it.
function wasPhrase(words: string, was: Was | undefined, emptied: boolean) {
  if (was === undefined) return words;
  if (emptied && was !== null) return `${words}, emptied, was ${was}`;
  const change = was === null ? "filled in" : `changed from ${was}`;
  return `${words}${words === "Draft" ? ":" : ","} ${change}`;
}

// A value as it was before a draft changed it, as a dot's tip names it: quoted, cut short when long,
// or null when it was empty, since the draft then fills it in rather than changing it.
export function wasWords(words: string): Was {
  if (words === "") return null;
  return `“${words.length > wasLength ? `${words.slice(0, wasLength - 1)}…` : words}”`;
}

// The words for none inside a sentence, such as "no description".
export function noneInSentence(name: string, emptyLabel?: string): string {
  const none = emptiedWords(name, emptyLabel);
  return none.charAt(0).toLowerCase() + none.slice(1);
}

const wasLength = 40;

// What kind of change a draft is, where its dot cannot say it: shown in a box after the item.
export function draftKind(draft: DraftLike): string | undefined {
  if (draft.state === "rejected") return undefined;
  if (draft.moved === true) return "Moved";
  if (draft.action === undefined) return "Reordered";
  if (draft.retiring !== undefined) {
    return draft.retiring ? "Retired" : "Restored";
  }
  return undefined;
}

// The draft a value is marked with when the record's draft changes it, apart from the record's own
// marks in its row's slot: the draft's state, and whether it is the user's own and unpublished, but
// not the kind of change, which belongs to the record.
// The value as it is live, in the record's Live row, is marked Live wherever this marks it.
export function changedValue(
  draft: (DraftLike & { changed: readonly string[] }) | undefined,
  ...fields: (string | undefined)[]
): DraftLike | undefined {
  return draft?.action === "changed" &&
    fields.some((field) => field !== undefined && draft.changed.includes(field))
    ? {
        action: "changed",
        state: draft.state,
        reason: draft.reason,
        unpublished: draft.unpublished,
      }
    : undefined;
}

// A record's own mark, in its row's slot: its draft, unless the draft only changes values the row
// shows, each marked by its own dot, so the slot would only repeat them.
export function recordMark<
  Draft extends DraftLike & { changed?: readonly string[] },
>(draft: Draft | undefined, shown: ReadonlySet<string>): Draft | undefined {
  return draft?.action === "changed" &&
    draft.changed !== undefined &&
    draft.changed.length > 0 &&
    draft.changed.every((field) => shown.has(field))
    ? undefined
    : draft;
}

// The mark of drafts in a record's parts, such as a list's choices or a stream's releases, before
// them: waiting while any waits, and rejected only once every one was. Drafts applied leaves
// rejected drafts out, as it shows them taken back.
export function partsMark(
  drafts: readonly (DraftLike | undefined)[],
  leaveOutRejected = false,
): DraftLike | undefined {
  const counted = drafts.filter(
    (draft): draft is DraftLike =>
      draft !== undefined && !(leaveOutRejected && draft.state === "rejected"),
  );
  if (counted.some(({ state }) => state === "waiting")) {
    return { action: "changed", state: "waiting" };
  }
  return counted.length > 0
    ? { action: "changed", state: "rejected" }
    : undefined;
}

// A column's name inside a sentence: its first letter lower-cased for a name written as a phrase,
// as in "needed by" or "proposal ID", and kept for an abbreviation, as in "ID", or a name whose
// later words are capitalized, as an added column's "Fictional Score".
export function inSentence(name: string): string {
  const [first = "", ...later] = name.split(" ");
  const asNamed =
    first.slice(1) !== first.slice(1).toLowerCase() ||
    later.some((word) => /^\p{Lu}\p{Ll}/u.test(word));
  return asNamed ? name : name.charAt(0).toLowerCase() + name.slice(1);
}

// What an empty value says, in grey, where a draft's mark would otherwise mark nothing, as where a
// draft empties a value, or fills one that was empty: a column's own words for none, or else "No"
// and the value's name, as in "No needed by".
export function emptiedWords(name: string, emptyLabel?: string): string {
  return emptyLabel ?? `No ${inSentence(name)}`;
}
