// SPDX-License-Identifier: Apache-2.0

// Ticks for choosing a table's rows together, for a table that acts on several at once, such as
// Drafts: a tick before each row's slot, one in the first header cell for every row shown that can
// be ticked, and the bar above the table that says how many are ticked and offers what can be done
// with them, its actions turned off while none is.

import { Button, Checkbox, Group, Text } from "@mantine/core";
import type { ReactNode } from "react";
import classes from "./pages.module.css";

// Which rows are ticked, by record, which may be, what each tick is called, and what the bar above
// the table offers for those ticked among the rows shown.
export interface RowTicks<Rec> {
  ticked: ReadonlySet<string>;
  onTick: (ids: readonly string[], on: boolean) => void;
  tickable: (record: Rec) => boolean;
  // Such as "Select the draft of Vianney Rousseau".
  label: (record: Rec) => string;
  // Such as "Select all drafts this role can decide".
  allLabel: string;
  actions: (ticked: readonly Rec[]) => ReactNode;
}

// The ticked rows with some ticked or unticked.
export function withTicks(
  ticked: ReadonlySet<string>,
  ids: readonly string[],
  on: boolean,
): ReadonlySet<string> {
  const next = new Set(ticked);
  for (const id of ids) {
    if (on) next.add(id);
    else next.delete(id);
  }
  return next;
}

// The rows shown that are ticked, and that may be, in the order shown, each once.
export function tickedOf<Rec extends { id: string }>(
  ticks: Pick<RowTicks<Rec>, "ticked" | "tickable">,
  shown: readonly Rec[],
): { ticked: Rec[]; tickable: Rec[] } {
  const tickable = [
    ...new Map(
      shown
        .filter((record) => ticks.tickable(record))
        .map((record) => [record.id, record]),
    ).values(),
  ];
  return {
    ticked: tickable.filter(({ id }) => ticks.ticked.has(id)),
    tickable,
  };
}

export function RowTick({
  label,
  checked,
  disabled,
  onChange,
}: {
  label: string;
  checked: boolean;
  disabled: boolean;
  onChange: (on: boolean) => void;
}) {
  return (
    <span className={classes.rowTick}>
      <Checkbox
        size="xs"
        aria-label={label}
        checked={checked}
        disabled={disabled}
        // The cell holding it takes focus, and Space there ticks it, as the grid's keys go.
        tabIndex={-1}
        onChange={(event) => {
          onChange(event.currentTarget.checked);
        }}
      />
    </span>
  );
}

export function AllTick({
  label,
  ticked,
  tickable,
  onChange,
}: {
  label: string;
  ticked: number;
  tickable: number;
  onChange: (on: boolean) => void;
}) {
  return (
    <span className={classes.rowTick}>
      <Checkbox
        size="xs"
        aria-label={label}
        checked={tickable > 0 && ticked === tickable}
        indeterminate={ticked > 0 && ticked < tickable}
        disabled={tickable === 0}
        onChange={(event) => {
          onChange(event.currentTarget.checked);
        }}
      />
    </span>
  );
}

// Kept in place while nothing is ticked, so the table doesn't move as rows are ticked.
export function SelectionBar({
  count,
  onClear,
  children,
}: {
  count: number;
  onClear: () => void;
  children: ReactNode;
}) {
  return (
    <Group
      gap="xs"
      className={classes.selectionBar}
      data-ticked={count > 0 || undefined}
      role="group"
      aria-label="Selected rows"
    >
      <Text fz="sm" fw={600} aria-live="polite">
        {count === 0 ? "None selected" : `${String(count)} selected`}
      </Text>
      <Group gap="xs" ml="auto">
        {children}
        <Button
          variant="subtle"
          size="compact-sm"
          disabled={count === 0}
          onClick={onClear}
        >
          Clear selection
        </Button>
      </Group>
    </Group>
  );
}
