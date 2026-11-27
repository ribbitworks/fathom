// SPDX-License-Identifier: Apache-2.0

// The side a user keeps of each clash on publishing their private changes, and their changes as
// they publish once those sides are applied. Part of the data access layer.

import { type Resolution } from "@fathom/shared";
import {
  clashesIn,
  clashKey,
  givenUp,
  keyOf,
  type Seen,
  type Unresolved,
} from "./private-conflicts.ts";
import { type Row } from "./private-versions.ts";

// A private change going, as it publishes, or undefined when it changes nothing over what is there,
// with the fields given up for the values others see, or whether the whole change was.
export interface Resolved {
  row: Row;
  publishing: Row | undefined;
  givenUp: ReadonlySet<string>;
  whole: boolean;
}

// What the role is shown of each clash: a token for the other side as shown, and, of a private
// change, the fields the role no longer sees.
export interface AsShown {
  token: (each: Unresolved) => string;
  unseenFields: (row: Row) => ReadonlySet<string>;
  // Whether the role doesn't see a clash at all, by its kind or its field's class.
  blind: (each: Unresolved) => boolean;
}

// The private changes going, as they publish once the sides kept are applied, and the fields and
// records someone else changed that no side is kept for yet. A side kept for a field or record that
// isn't a clash, for another side than the one there now, or for one the role doesn't see, is
// ignored, and a clash the role doesn't see keeps the other side. Keeping the other side of a
// record clash gives up the whole change; keeping the user's own over a removal still gives up the
// fields the role no longer sees, so nobody publishes what they can't see.
export function resolved(
  rows: readonly Row[],
  seenOf: (row: Row) => Seen,
  resolutions: readonly Resolution[],
  shown: AsShown,
): { rows: Resolved[]; unresolved: Unresolved[] } {
  const keep = new Map(
    resolutions.map(({ recordType, recordId, field, keep: kept, token }) => [
      keyOf(recordType, recordId, field),
      { kept, token },
    ]),
  );
  const clashes = clashesIn(rows, seenOf);
  const unresolved: Unresolved[] = [];
  const going = rows.map((row): Resolved => {
    const seen = seenOf(row);
    const theirs = new Set<string>();
    let whole = false;
    for (const each of clashes.filter((clash) => clash.row === row)) {
      const chosen = keep.get(clashKey(each));
      // A clash the role doesn't see keeps the other side, whatever was sent for it, and a side
      // kept for what the user was shown no longer holds once the other side changes.
      const kept = shown.blind(each)
        ? "theirs"
        : chosen?.token === shown.token(each)
          ? chosen.kept
          : undefined;
      if (kept === undefined) unresolved.push(each);
      else if ("conflict" in each) {
        if (kept === "theirs") theirs.add(each.conflict.field);
      } else if (kept === "theirs") whole = true;
      else if (each.clash.removedBy === "theirs") {
        for (const field of shown.unseenFields(row)) theirs.add(field);
      }
    }
    return {
      row,
      publishing: whole ? undefined : givenUp(row, seen, theirs),
      givenUp: theirs,
      whole,
    };
  });
  return { rows: going, unresolved };
}
