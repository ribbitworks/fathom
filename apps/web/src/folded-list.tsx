// SPDX-License-Identifier: Apache-2.0

// A long list as a panel shows it, folded as a long note is, by one control in one place that
// flips: from a starting item, such as the current cycle, its first few, with Show all under them,
// which then reads Show less, or, where items before the start are folded above, Later and how many,
// then Hide later; and the items before the start folded above, behind a control naming
// how many there are, which then reads Hide. Each says whether it is open, and keeps focus, so
// nothing moves under it.

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
  children,
}: {
  items: readonly Item[];
  // Where the list first starts; those before it are folded above.
  start?: number;
  // How many it first shows from the start.
  first: number;
  // What the items are, such as "cycles", for the words of the controls.
  noun: string;
  // Draws the items shown, such as the rows of a small table.
  children: (shown: readonly Item[]) => ReactNode;
}) {
  const [all, setAll] = useState(false);
  const [showsEarlier, setShowsEarlier] = useState(false);
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
            ? `Hide earlier ${noun}`
            : `Earlier ${noun} (${String(before.length)})`}
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
          {before.length > 0
            ? all
              ? `Hide later ${noun}`
              : `Later ${noun} (${String(after.length - first)})`
            : all
              ? "Show less"
              : `Show all (${String(after.length)})`}
        </FoldControl>
      )}
    </>
  );
}
