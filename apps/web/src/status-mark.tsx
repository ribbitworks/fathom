// SPDX-License-Identifier: Apache-2.0

// The mark beside a record with a draft, in words after a dot: yellow for a draft, red once
// rejected, and green for the live row under a draft. The People table, the Lists page, the Drafts
// page, and Help's Drafts page all draw it here, so they show the same mark.

import type { DraftState } from "@fathom/shared";
import { VisuallyHidden } from "@mantine/core";
import type { ReactNode } from "react";
import classes from "./pages.module.css";

// What a draft is: of a record it adds, changes, or removes, or of an order.
export interface DraftLike {
  action?: "created" | "changed" | "deleted";
  state: DraftState;
  reason?: string | undefined;
  // Whether a change retires the record, or restores it, when it does either.
  retiring?: boolean;
}

// What a draft is, in words.
export function draftWords(draft: DraftLike): string {
  if (draft.state === "rejected") {
    return draft.reason === undefined
      ? "Rejected"
      : `Rejected: ${draft.reason}`;
  }
  if (draft.action === "created") return "Draft: added";
  if (draft.action === "deleted") return "Draft: removed";
  if (draft.action === undefined) return "Draft: reordered";
  if (draft.retiring !== undefined) {
    return draft.retiring ? "Draft: retired" : "Draft: restored";
  }
  return "Draft";
}

// The mark beside a record with a draft, in words after a dot, yellow, or red once rejected. A
// rejection's reason is in the record's menu, not in the table, and is read aloud with the mark.
export function DraftMark({ draft }: { draft: DraftLike }) {
  const rejected = draft.state === "rejected";
  return (
    <StatusMark tone={rejected ? "rejected" : "draft"} spaced>
      {rejected ? "Rejected" : draftWords(draft)}
      {rejected && draft.reason !== undefined && (
        <VisuallyHidden>: {draft.reason}</VisuallyHidden>
      )}
    </StatusMark>
  );
}

const toneClass = new Map([
  ["draft", classes.draftMark],
  ["rejected", classes.draftRejected],
  ["live", classes.liveMark],
  ["unpublished", classes.unpublishedMark],
  ["held", classes.heldMark],
]);

// Beside a record's draft mark: Unpublished when the draft holds the user's own changes, which only
// they see, or Being changed when someone else has unpublished changes to it, read aloud with who.
export function HoldMarks({
  unpublished,
  heldBy,
}: {
  unpublished: boolean | undefined;
  heldBy: string | undefined;
}) {
  return (
    <>
      {unpublished === true && (
        <StatusMark tone="unpublished" spaced>
          Unpublished
        </StatusMark>
      )}
      {heldBy !== undefined && (
        <StatusMark tone="held" spaced>
          Being changed<VisuallyHidden> by {heldBy}</VisuallyHidden>
        </StatusMark>
      )}
    </>
  );
}

export function StatusMark({
  tone,
  spaced = false,
  children,
}: {
  tone: "draft" | "rejected" | "live" | "unpublished" | "held";
  // Set apart from what it follows, such as a person's name.
  spaced?: boolean;
  children: ReactNode;
}) {
  return (
    <span
      className={[
        classes.mark,
        toneClass.get(tone),
        spaced ? classes.markGap : "",
      ].join(" ")}
    >
      <span className={classes.statusDot} aria-hidden="true" /> {children}
    </span>
  );
}
