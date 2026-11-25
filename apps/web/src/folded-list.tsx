// SPDX-License-Identifier: Apache-2.0

// A long list as a panel shows it, its first few from a starting item, the rest folded above and
// below it.

import { capitalized } from "@fathom/shared";
import { Anchor } from "@mantine/core";
import { type ReactNode, useState } from "react";
import { foldControl } from "./folded-note.tsx";

// A fold's control, on a line of its own, drawn as a note's Show more is: its words as a link, in
// the folds' one style, with nothing around them.
function FoldControl({
  open,
  onFlip,
  children,
}: {
  open: boolean;
  onFlip: () => void;
  children: ReactNode;
}) {
  return (
    <div>
      <Anchor
        component="button"
        type="button"
        className={foldControl}
        aria-expanded={open}
        onClick={onFlip}
      >
        {children}
      </Anchor>
    </div>
  );
}

export function FoldedList<Item>({
  items,
  start = 0,
  first,
  noun,
  newestFirst = false,
  keepShown,
  children,
}: {
  items: readonly Item[];
  // Where the list first starts; those before it are folded above.
  start?: number;
  // How many it first shows from the start.
  first: number;
  // What the items are, such as "cycles", for the words of the controls.
  noun: string;
  // Items newest first, as a timeline lists days, so those folded above are later and those below
  // earlier.
  newestFirst?: boolean;
  // An item that starts shown, such as the day the page shows, opening the fold that holds it.
  keepShown?: number | undefined;
  // Draws the items shown, such as the rows of a small table.
  children: (shown: readonly Item[]) => ReactNode;
}) {
  const [all, setAll] = useState(
    keepShown !== undefined && keepShown >= start + first,
  );
  const [showsEarlier, setShowsEarlier] = useState(
    keepShown !== undefined && keepShown < start,
  );
  // A later item to keep shown, such as another day chosen, opens its fold too.
  const [keptBefore, setKeptBefore] = useState(keepShown);
  if (keptBefore !== keepShown) {
    setKeptBefore(keepShown);
    if (keepShown !== undefined && keepShown < start) setShowsEarlier(true);
    if (keepShown !== undefined && keepShown >= start + first) setAll(true);
  }
  const [above, below] = newestFirst
    ? ["later", "earlier"]
    : ["earlier", "later"];
  const before = items.slice(0, start);
  const after = items.slice(start);
  const shown = [
    ...(showsEarlier ? before : []),
    ...(all ? after : after.slice(0, first)),
  ];
  return (
    <>
      {before.length > 0 && (
        <FoldControl
          open={showsEarlier}
          onFlip={() => {
            setShowsEarlier((open) => !open);
          }}
        >
          {showsEarlier
            ? `Hide ${above} ${noun}`
            : `${capitalized(above)} ${noun} (${String(before.length)})`}
        </FoldControl>
      )}
      {children(shown)}
      {after.length > first && (
        <FoldControl
          open={all}
          onFlip={() => {
            setAll((open) => !open);
          }}
        >
          {before.length > 0 || newestFirst
            ? all
              ? `Hide ${below} ${noun}`
              : `${capitalized(below)} ${noun} (${String(after.length - first)})`
            : all
              ? "Show less"
              : `Show all (${String(after.length)})`}
        </FoldControl>
      )}
    </>
  );
}
