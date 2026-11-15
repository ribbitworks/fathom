// SPDX-License-Identifier: Apache-2.0

// Grouping a table's rows by the one choice a column holds: a group for each choice, in its list's
// order, then the rows with none, under the column's words for none.

import type { Column, GridRecord, RowGrouping } from "./record-grid.tsx";
import type { RowGroup } from "./table-view.ts";
import { emptiedWords } from "./status-mark.tsx";
import type { Choice } from "@fathom/shared";

// A row of a column holding several choices would need a place in several groups.
export const holdsOneChoice = <Rec extends GridRecord, Change>(
  column: Column<Rec, Change>,
) => column.kind === "choice" && !column.multiple;

export function byChoice<Rec extends GridRecord, Change>(
  column: Column<Rec, Change>,
  headingOf: (choice: Choice) => string = ({ label }) => label,
): RowGrouping<Rec> {
  const none: RowGroup = {
    key: "no-choice",
    label: emptiedWords(column.label, column.emptyLabel),
    rank: Number.MAX_SAFE_INTEGER,
  };
  return {
    key: column.key,
    label: column.label,
    of: (record) => {
      const [chosen] = column.value(record) as string[];
      const choice = column.choices.find(({ id }) => id === chosen);
      return [
        choice === undefined
          ? none
          : {
              key: choice.id,
              label: headingOf(choice),
              rank: column.choices.indexOf(choice),
            },
      ];
    },
  };
}
