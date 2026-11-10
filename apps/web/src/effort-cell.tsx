// SPDX-License-Identifier: Apache-2.0

// An estimate's cell: its amount in the unit the table shows, with the unit's code, offering the
// hours the estimate is kept in, and whether the amount was rounded up from them, as the tip the
// table's one tooltip shows on hover or keyboard focus, and in words for assistive technology.

import { VisuallyHidden } from "@mantine/core";
import { tipAttribute } from "./table-tips.tsx";
import { type ColumnUnit, unitAmountWords } from "./table-view.ts";

export function EffortCell({
  shown,
  amount,
  unit,
  hours,
}: {
  // The amount as the cell shows it, such as 0.5, and the number it is.
  shown: string;
  amount: number;
  unit: ColumnUnit;
  // The hours behind it, in words, such as 1 hour, rounded up.
  hours: string;
}) {
  return (
    <span {...{ [tipAttribute]: hours }}>
      <span aria-hidden>{`${shown} ${unit.code}`}</span>
      <VisuallyHidden>{`${unitAmountWords(shown, amount, unit)}, ${hours}`}</VisuallyHidden>
    </span>
  );
}
