// SPDX-License-Identifier: Apache-2.0

// Grouping a table's rows by the choices a column holds.

import type { Column, GridRecord, RowGrouping } from "./record-table.ts";
import { type GroupsHold, rankOfNone, type RowGroup } from "./row-groups.ts";
import { emptiedWords } from "./draft-marks.ts";
import type { Choice } from "@fathom/shared";

export const holdsChoices = <Rec extends GridRecord, Change>(
  column: Column<Rec, Change>,
) => column.kind === "choice";

export function byChoice<Rec extends GridRecord, Change>(
  column: Column<Rec, Change>,
  {
    headingOf = ({ label }) => label,
    holds = "list",
  }: { headingOf?: (choice: Choice) => string; holds?: GroupsHold } = {},
): RowGrouping<Rec> {
  const none: RowGroup = {
    key: "no-choice",
    label: emptiedWords(column.label, column.emptyLabel),
    rank: rankOfNone,
  };
  return {
    key: column.key,
    label: column.label,
    holds,
    of: (record) => {
      const chosen = new Set(column.value(record) as string[]);
      const [first = none, ...rest] = column.choices.flatMap((choice, rank) =>
        chosen.has(choice.id)
          ? [
              {
                key: choice.id,
                label: headingOf(choice),
                rank,
                ...(column.choiceColour === undefined
                  ? {}
                  : { colour: column.choiceColour(choice.id) }),
              },
            ]
          : [],
      );
      return [first, ...rest];
    },
  };
}
