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
  if (draft.action === undefined) return "Draft: order";
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

export function StatusMark({
  tone,
  spaced = false,
  children,
}: {
  tone: "draft" | "rejected" | "live";
  // Set apart from what it follows, such as a person's name.
  spaced?: boolean;
  children: ReactNode;
}) {
  return (
    <span
      className={[
        classes.mark,
        tone === "draft"
          ? classes.draftMark
          : tone === "rejected"
            ? classes.draftRejected
            : classes.liveMark,
        spaced ? classes.markGap : "",
      ].join(" ")}
    >
      <span className={classes.statusDot} aria-hidden="true" /> {children}
    </span>
  );
}
