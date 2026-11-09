// SPDX-License-Identifier: Apache-2.0

// The mark beside a record with a draft, in words after a dot: yellow for a draft, red once
// rejected, and green for the live row under a draft, with red too for a warning about a value. The
// People table, the Lists page, the Drafts page, Help's Drafts page, and the org chart all draw it
// here, so they show the same mark.

import type { DraftState } from "@fathom/shared";
import { Group, Text, VisuallyHidden } from "@mantine/core";
import type { ReactNode } from "react";
import classes from "./pages.module.css";

// What a draft is: of a record it adds, changes, or removes, or of an order.
export interface DraftLike {
  action?: "created" | "changed" | "deleted";
  state: DraftState;
  reason?: string | undefined;
  // Whether a change retires the record, or restores it, when it does either.
  retiring?: boolean;
  // Whether it holds the user's own changes, which only they see until they publish them.
  unpublished?: boolean | undefined;
}

const rejectedWord = "Rejected";

// What a draft is, in words.
export function draftWords(draft: DraftLike): string {
  if (draft.state === "rejected") {
    return draft.reason === undefined
      ? rejectedWord
      : `${rejectedWord}: ${draft.reason}`;
  }
  if (draft.action === "created") return "Draft: added";
  if (draft.action === "deleted") return "Draft: removed";
  if (draft.action === undefined) return "Draft: reordered";
  if (draft.retiring !== undefined) {
    return draft.retiring ? "Draft: retired" : "Draft: restored";
  }
  return "Draft";
}

const dotChars = 2;

// How many characters a draft's mark takes in a table, with its dot.
export const draftMarkChars = (draft: DraftLike): number =>
  (draft.state === "rejected" ? rejectedWord : draftWords(draft)).length +
  dotChars;

// The mark beside a record with a draft, in words after a dot: yellow, hollow while the draft is
// the user's own and unpublished, or red once rejected. A rejection's reason is in the record's
// menu, not in the table, and is read aloud with the mark.
export function DraftMark({ draft }: { draft: DraftLike }) {
  const rejected = draft.state === "rejected";
  const unpublished = draft.unpublished === true;
  if (!rejected) {
    return (
      <StatusMark tone={unpublished ? "unpublished" : "draft"} spaced>
        {draftWords(draft)}
        {unpublished && <VisuallyHidden>, unpublished</VisuallyHidden>}
      </StatusMark>
    );
  }
  return (
    <>
      <StatusMark tone="rejected" spaced>
        {rejectedWord}
        {draft.reason !== undefined && (
          <VisuallyHidden>: {draft.reason}</VisuallyHidden>
        )}
      </StatusMark>
      {unpublished && <UnpublishedMark />}
    </>
  );
}

const toneClass = new Map([
  ["draft", classes.draftMark],
  ["rejected", classes.draftRejected],
  ["live", classes.liveMark],
  ["unpublished", classes.unpublishedMark],
  ["held", classes.heldMark],
  ["warning", classes.draftRejected],
  ["planned", classes.plannedMark],
]);

// A rejected draft's dot cannot also be hollow, so its unpublished changes have a mark of their own.
function UnpublishedMark() {
  return (
    <StatusMark tone="unpublished" spaced>
      Unpublished
    </StatusMark>
  );
}

// Beside a record's draft mark: Being changed when someone else has unpublished changes to it, read
// aloud with who, or Unpublished where no draft mark already says the changes are the user's own.
export function HoldMarks({
  unpublished,
  heldBy,
}: {
  unpublished?: boolean | undefined;
  heldBy: string | undefined;
}) {
  return (
    <>
      {unpublished === true && <UnpublishedMark />}
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
  tone:
    | "draft"
    | "rejected"
    | "live"
    | "unpublished"
    | "held"
    | "warning"
    | "planned";
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

// A live value on a line of its own under its draft, small, dimmed and marked Live.
export function LiveLine({
  className,
  children,
}: {
  className?: string | undefined;
  children: ReactNode;
}) {
  return (
    <Group gap={6} wrap="nowrap" className={className}>
      <Text size="xs" c="dimmed" truncate>
        {children}
      </Text>
      <StatusMark tone="live">Live</StatusMark>
    </Group>
  );
}
