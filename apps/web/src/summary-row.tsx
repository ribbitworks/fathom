// SPDX-License-Identifier: Apache-2.0

// A cell naming a record's parts, such as a list's choices: how many, then their names, after the
// mark of their drafts, and the same as they are live.

import { Fragment } from "react";
import type { DraftLike } from "./draft-marks.ts";
import classes from "./pages.module.css";
import { DraftedItem, MarkedItem } from "./status-mark.tsx";

// A part of a record, as its cell names it, and whether a draft takes it away.
export interface SummaryPart {
  id: string;
  name: string;
  removed: boolean;
}

// A record's parts: how many, leaving out those a draft takes away, then their names, those struck
// through, after the mark of the parts' drafts; for a record with none, no count, as an empty cell
// is blank but for its mark.
export function Parts({
  mark,
  parts,
}: {
  mark: DraftLike | undefined;
  parts: readonly SummaryPart[];
}) {
  return (
    <DraftedItem draft={mark}>
      {parts.length > 0 && (
        <>
          <span className={classes.listCount}>
            ({parts.filter(({ removed }) => !removed).length})
          </span>{" "}
          {parts.map(({ id, name, removed }, index) => (
            <Fragment key={id}>
              {index > 0 && ", "}
              {removed ? <span className={classes.struck}>{name}</span> : name}
            </Fragment>
          ))}
        </>
      )}
    </DraftedItem>
  );
}

// A record's parts as they are live, after Live's dot where drafts change them.
export function LiveParts({
  marked,
  names,
}: {
  marked: boolean;
  names: readonly string[];
}) {
  return (
    <MarkedItem tone={marked ? "live" : undefined}>
      {names.length > 0 && (
        <>
          <span className={classes.listCount}>({names.length})</span>{" "}
          {names.join(", ")}
        </>
      )}
    </MarkedItem>
  );
}
