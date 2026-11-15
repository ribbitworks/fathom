// SPDX-License-Identifier: Apache-2.0

// Grouping a table's rows by the choices a column holds: a group for each choice, in its list's
// order, a row under each of its choices, then the rows with none, under the column's words for none.

import type { Column, GridRecord, RowGrouping } from "./record-grid.tsx";
import type { RowGroup } from "./table-view.ts";
import { emptiedWords } from "./status-mark.tsx";
import type { Choice } from "@fathom/shared";

export const holdsChoices = <Rec extends GridRecord, Change>(
  column: Column<Rec, Change>,
) => column.kind === "choice";

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
      const chosen = new Set(column.value(record) as string[]);
      const [first = none, ...rest] = column.choices.flatMap((choice, rank) =>
        chosen.has(choice.id)
          ? [{ key: choice.id, label: headingOf(choice), rank }]
          : [],
      );
      return [first, ...rest];
    },
  };
}
