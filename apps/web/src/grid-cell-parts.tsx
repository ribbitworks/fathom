// SPDX-License-Identifier: Apache-2.0

// The parts of the shared table's cells its rows are drawn with: a cell reached by Tab, a new row's
// mark and problem, and a first value cut short under a refusal.

import { Table, type TableTdProps } from "@mantine/core";
import { type ReactNode, useSyncExternalStore } from "react";
import type { Place, PlaceStore } from "./grid-places.ts";
import classes from "./pages.module.css";

// An empty value's stand-in, unless a warning in its place says the same, so the words show once.
export const unlessWarned = (
  standIn: string | undefined,
  warning: { words: string } | undefined,
) => (standIn === warning?.words ? undefined : standIn);
// A record's cell, reached by Tab while it is the one selected.
export function SelectableCell({
  activeAt,
  isSelectedAt,
  ...cell
}: TableTdProps & {
  activeAt: PlaceStore;
  isSelectedAt: (place: Place | undefined) => boolean;
}) {
  const selected = useSyncExternalStore(activeAt.subscribe, () =>
    isSelectedAt(activeAt.get()),
  );
  return <Table.Td {...cell} tabIndex={selected ? 0 : -1} />;
}

// What the mark of a new row being filled in says, until its record is added: that it is new, and
// what is wrong with it so far, or otherwise the required columns still empty.
export function newRowWords(
  missing: readonly string[],
  wrong: string | undefined,
) {
  const status = "New, not saved yet";
  const detail =
    wrong ?? (missing.length > 0 ? `${missing.join(", ")} needed` : undefined);
  return detail === undefined ? status : `${status}: ${detail}`;
}

// What is wrong with a new row so far, in red after its value, announced as it is found, since it
// is a problem to fix rather than a mark's words.
export function NewRowWrong({
  wrong,
  id,
}: {
  wrong: string | undefined;
  id: string;
}) {
  return (
    <span aria-live="polite">
      {wrong !== undefined && (
        <span id={id} className={classes.newMarkWrong}>
          {wrong}
        </span>
      )}
    </span>
  );
}

// A row's first value, cut short in its cell as every value is while a refusal under it runs on past
// the cell. It is always wrapped, so its editor isn't drawn afresh when a refusal comes or goes.
export function FirstValue({
  first,
  clipped,
  children,
}: {
  first: boolean;
  clipped: boolean;
  children: ReactNode;
}) {
  return first ? (
    <span className={clipped ? classes.recordClippedValue : undefined}>
      {children}
    </span>
  ) : (
    children
  );
}
