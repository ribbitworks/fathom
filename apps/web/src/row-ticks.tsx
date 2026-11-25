// SPDX-License-Identifier: Apache-2.0

// Ticks for choosing a table's rows together, for a table that acts on several at once, such as
// Drafts: a tick before each row's slot, with a tip where it is ticked with others, and one in the
// first header cell for every row shown that can be ticked, which also says aloud how many are. The
// page offers what can be done with those ticked among its actions.

import { Checkbox, VisuallyHidden } from "@mantine/core";
import { recordTableClasses } from "./page-styles.ts";
import { Tipped } from "./table-tips.tsx";

// Which rows are ticked, by record, which may be, among the rows in sight, by record, what each
// tick is called, and why a row is ticked with others, where it is.
export interface RowTicks<Rec> {
  ticked: ReadonlySet<string>;
  onTick: (ids: readonly string[], on: boolean) => void;
  tickable: (record: Rec, shown: ReadonlySet<string>) => boolean;
  // Such as "Select the draft of Vianney Rousseau".
  label: (record: Rec) => string;
  // Such as "Select all drafts this role can decide".
  allLabel: string;
  // Such as "Linked to the change to Equipment".
  tip?: (record: Rec, shown: ReadonlySet<string>) => string | undefined;
}

// The ticked rows with some ticked or unticked: the same set when nothing changes, so a page that
// ticks rows as it draws them settles.
export function withTicks(
  ticked: ReadonlySet<string>,
  ids: readonly string[],
  on: boolean,
): ReadonlySet<string> {
  if (ids.every((id) => ticked.has(id) === on)) return ticked;
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
  const shownIds = new Set(shown.map(({ id }) => id));
  const tickable = [
    ...new Map(
      shown
        .filter((record) => ticks.tickable(record, shownIds))
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
  tip,
  checked,
  disabled,
  onChange,
}: {
  label: string;
  tip?: string | undefined;
  checked: boolean;
  disabled: boolean;
  onChange: (on: boolean) => void;
}) {
  const box = (
    <Checkbox
      size="xs"
      aria-label={label}
      aria-description={tip}
      checked={checked}
      disabled={disabled}
      // The cell holding it takes focus, and Space there ticks it, as the grid's keys go.
      tabIndex={-1}
      onChange={(event) => {
        onChange(event.currentTarget.checked);
      }}
    />
  );
  return tip === undefined ? (
    <span className={recordTableClasses.rowTick}>{box}</span>
  ) : (
    <Tipped tip={tip} className={recordTableClasses.rowTick}>
      {box}
    </Tipped>
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
    <span className={recordTableClasses.rowTick}>
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
      {/* Always there, so screen readers hear how many are ticked as it changes. */}
      <VisuallyHidden aria-live="polite">
        {ticked === 0 ? "" : `${String(ticked)} selected`}
      </VisuallyHidden>
    </span>
  );
}
