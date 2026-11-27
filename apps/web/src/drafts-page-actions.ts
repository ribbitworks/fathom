// SPDX-License-Identifier: Apache-2.0

// What the Drafts page's menus do to a published draft: discard it, or resubmit it once rejected,
// through its kind's own requests, each undone as any change is.

import { useState } from "react";
import { draftedReads } from "./draft-reading.ts";
import { discardTarget, resubmitTarget } from "./draft-targets.ts";
import type { DraftRow } from "./drafts-table.tsx";
import { withTicks } from "./row-ticks.tsx";
import { useSaving } from "./saving.ts";

// The page's rows are drawn from every read a draft may be in, so its changes keep no data of their
// own: a discarded draft's row is hidden at once instead, until those reads reload without it.
const draftChangesKey = ["draft-changes"] as const;
const unchanged = () => undefined;

export function useDraftsPageActions({
  listed,
  blocked,
}: {
  // The drafts the page has read, by their rows' identifiers, once read.
  listed: readonly string[] | undefined;
  // Whether a dialog is open, behind which no change is undone.
  blocked: boolean;
}) {
  const { save, done } = useSaving<undefined>({
    queryKey: draftChangesKey,
    refreshes: draftedReads,
    removed: "Someone else has removed this. The drafts have been refreshed.",
    blocked,
  });
  // The rows of drafts discarded but still read, hidden until the reads catch up.
  const [leaving, setLeaving] = useState<ReadonlySet<string>>(new Set());
  const leave = (id: string, on: boolean) => {
    setLeaving((current) => withTicks(current, [id], on));
  };
  // Once the reads no longer hold a draft, its row is no longer hidden, so it shows again if it
  // comes back, as when its discard is undone.
  const listedKey = listed?.join("\n");
  const [readKey, setReadKey] = useState(listedKey);
  if (listedKey !== readKey) {
    setReadKey(listedKey);
    const read = new Set(listed);
    setLeaving((current) =>
      withTicks(
        current,
        [...current].filter((id) => !read.has(id)),
        false,
      ),
    );
  }
  return {
    // The rows shown, without those of drafts being discarded.
    shown: (rows: readonly DraftRow[]) =>
      rows.filter(({ id }) => !leaving.has(id)),
    discard: (row: DraftRow) => {
      leave(row.id, true);
      save({
        next: unchanged,
        save: () => discardTarget(row.entry.target),
        failure: `Fathom could not discard the draft of ${row.record}.`,
        onFailed: () => {
          leave(row.id, false);
        },
        onSaved: (changeSetId, before) => {
          done(
            `Discarded the draft of ${row.record}.`,
            changeSetId,
            before,
            undefined,
            () => {
              leave(row.id, false);
            },
          );
        },
      });
    },
    resubmit: (row: DraftRow) => {
      save({
        next: unchanged,
        save: () => resubmitTarget(row.entry.target),
        failure: `Fathom could not send the draft of ${row.record} for approval again.`,
        onSaved: (changeSetId, before) => {
          done(`Resubmitted the draft of ${row.record}.`, changeSetId, before);
        },
      });
    },
  };
}
