// SPDX-License-Identifier: Apache-2.0

// A bound of a Duration column's filter, such as At least: a length typed as a cell takes it, such
// as 3 mo, or a bare number in the unit the column is shown in, which the field names, kept as an
// amount of that unit.

import {
  durationIn,
  durationRefusalWords,
  numberDigits,
  parseDuration,
} from "@fathom/shared";
import { useState } from "react";
import { ClearableInput } from "./clearable-input.tsx";
import { lengthUnit, unitName } from "./duration-cells.ts";
import { decimal } from "./numbers.ts";
import type { TableColumn } from "./table-view.ts";

export function LengthBound({
  column,
  label,
  initial,
  within,
  autoFocus = false,
  onChange,
}: {
  column: Pick<TableColumn<never>, "lengths">;
  label: string;
  initial: number | undefined;
  // The other bound, which this one may not pass: at least for At most, at most for At least.
  within: { least?: number | undefined; most?: number | undefined };
  autoFocus?: boolean;
  onChange: (value: number | undefined) => void;
}) {
  const unit = lengthUnit(column);
  // A bound set earlier, perhaps from another unit, opens as its amount, which is never refused.
  const opened = initial === undefined ? "" : `${decimal(initial)} ${unit}`;
  const [typed, setTyped] = useState(opened);
  // A length typed as a cell takes it, as an amount of the unit, rounded to the places a filter
  // keeps; what a cell would refuse, or what passes the other bound, says why and applies nothing.
  const amountOf = (text: string) => {
    const read = parseDuration(text, unit);
    if ("refused" in read) {
      return { problem: durationRefusalWords(read.refused, label) };
    }
    if (!("duration" in read)) return { amount: undefined };
    const amount = Number(
      durationIn(read.duration, unit).toFixed(numberDigits.afterPoint),
    );
    if (within.least !== undefined && amount < within.least) {
      return { problem: `Type ${decimal(within.least)} ${unit} or more` };
    }
    if (within.most !== undefined && amount > within.most) {
      return { problem: `Type ${decimal(within.most)} ${unit} or less` };
    }
    return { amount };
  };
  const typedProblem = typed === opened ? undefined : amountOf(typed).problem;
  return (
    <ClearableInput
      label={`${label} in ${unitName(unit)}`}
      size="sm"
      autoComplete="off"
      {...(autoFocus ? { "data-autofocus": true } : {})}
      clearLabel={`Clear ${label}`}
      onClear={() => {
        setTyped("");
        onChange(undefined);
      }}
      value={typed}
      error={typedProblem}
      onChange={(event) => {
        const next = event.currentTarget.value;
        setTyped(next);
        onChange(amountOf(next).amount);
      }}
    />
  );
}
