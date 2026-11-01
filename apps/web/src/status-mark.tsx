// SPDX-License-Identifier: Apache-2.0

// The mark beside a person with a draft, in words after a dot: yellow for a draft, red once
// rejected, and green for the live row under a draft. The People table, the Drafts page, and Help's
// Drafts page all draw it here, so they show the same mark.

import type { ReactNode } from "react";
import classes from "./pages.module.css";

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
