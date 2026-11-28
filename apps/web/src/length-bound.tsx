// SPDX-License-Identifier: Apache-2.0

// A bound of a Duration column's filter, such as At least: a length typed as a cell takes it, such
// as 3 mo, or a bare number in the unit the column is shown in, which the field names, kept as an
// amount of that unit.

import {
  durationIn,
  durationRefusalWords,
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
  problem,
  autoFocus = false,
  onChange,
}: {
  column: Pick<TableColumn<never>, "lengths">;
  label: string;
  initial: number | undefined;
  problem?: string | undefined;
  autoFocus?: boolean;
  onChange: (value: number | undefined) => void;
}) {
  const unit = lengthUnit(column);
  // A bound set earlier, perhaps from another unit, opens as its amount, which is never refused.
  const opened = initial === undefined ? "" : `${decimal(initial)} ${unit}`;
  const [typed, setTyped] = useState(opened);
  const read = parseDuration(typed, unit);
  const typedProblem =
    typed !== opened && "refused" in read
      ? durationRefusalWords(read.refused, label)
      : undefined;
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
      error={typedProblem ?? problem}
      onChange={(event) => {
        const next = event.currentTarget.value;
        setTyped(next);
        const length = parseDuration(next, unit);
        onChange(
          "duration" in length ? durationIn(length.duration, unit) : undefined,
        );
      }}
    />
  );
}
