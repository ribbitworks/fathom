// SPDX-License-Identifier: Apache-2.0

// The bounds of a Duration column's filter, At least and At most: each a length typed as a cell
// takes it, such as 3 mo, or a bare number in the unit the column is shown in, which each field
// names. A bound is kept in calendar days, in which every unit's size has at most four decimal
// places, so it holds the length typed exactly, and a cell of that length falls within it.

import { durationRefusalWords, parseDuration, unitDays } from "@fathom/shared";
import { useState } from "react";
import { ClearableInput } from "./clearable-input.tsx";
import { lengthUnit, shownBound, unitName } from "./duration-cells.ts";
import type { TableColumn } from "./table-view.ts";

type Bounds = { atLeast: number | undefined; atMost: number | undefined };

export function LengthRange({
  column,
  bounds,
  onBounds,
}: {
  column: Pick<TableColumn<never>, "lengths" | "places">;
  bounds: Bounds;
  onBounds: (bounds: Bounds) => void;
}) {
  const unit = lengthUnit(column);
  // A bound set earlier opens as its amount of the unit shown, which is never refused.
  const opened = (days: number | undefined) =>
    days === undefined ? "" : shownBound(column, days);
  const [least, setLeast] = useState(opened(bounds.atLeast));
  const [most, setMost] = useState(opened(bounds.atMost));
  // A bound's days, none for an empty field, or why it is refused, in a cell's words naming it.
  const read = (label: string, text: string) => {
    const length = parseDuration(text, unit);
    if ("refused" in length) {
      return { problem: durationRefusalWords(length.refused, label) };
    }
    return "duration" in length
      ? { days: length.duration.amount * unitDays(length.duration.unit) }
      : { days: undefined };
  };
  const range = (leastText: string, mostText: string) => {
    const from = read("At least", leastText);
    const to = read("At most", mostText);
    const reversed =
      from.days !== undefined && to.days !== undefined && to.days < from.days;
    return { from, to, reversed };
  };
  // A range refused, by either bound or by At most coming before At least, applies nothing.
  const apply = (leastText: string, mostText: string) => {
    const { from, to, reversed } = range(leastText, mostText);
    const refused =
      reversed || from.problem !== undefined || to.problem !== undefined;
    onBounds(
      refused
        ? { atLeast: undefined, atMost: undefined }
        : { atLeast: from.days, atMost: to.days },
    );
  };
  const shown = range(least, most);
  const leastProblem =
    least === opened(bounds.atLeast) ? undefined : shown.from.problem;
  const mostProblem =
    most === opened(bounds.atMost)
      ? undefined
      : (shown.to.problem ??
        (shown.reversed && shown.from.days !== undefined
          ? `Type ${shownBound(column, shown.from.days)} or more`
          : undefined));
  const field = (
    label: string,
    value: string,
    problem: string | undefined,
    change: (text: string) => void,
    autoFocus: boolean,
  ) => (
    <ClearableInput
      label={`${label} in ${unitName(unit)}`}
      size="sm"
      autoComplete="off"
      {...(autoFocus ? { "data-autofocus": true } : {})}
      clearLabel={`Clear ${label}`}
      onClear={() => {
        change("");
      }}
      value={value}
      error={problem}
      onChange={(event) => {
        change(event.currentTarget.value);
      }}
    />
  );
  return (
    <>
      {field(
        "At least",
        least,
        leastProblem,
        (text) => {
          setLeast(text);
          apply(text, most);
        },
        true,
      )}
      {field(
        "At most",
        most,
        mostProblem,
        (text) => {
          setMost(text);
          apply(least, text);
        },
        false,
      )}
    </>
  );
}
