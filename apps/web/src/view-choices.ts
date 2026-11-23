// SPDX-License-Identifier: Apache-2.0

// A table's own choices of which records it shows, beyond its filters, kept in its view and offered
// at the top of the Views menu: some show records it otherwise leaves out, others keep only some.

import { shownChoiceSchema } from "@fathom/shared";
import type { ViewChoice } from "./table-controls.tsx";
import { type View, withChoice } from "./table-view.ts";

// What a view's choice holds while it shows the records it names.
const shownValue = shownChoiceSchema.value;

// How a view keeps one of its table's own choices: whether it is on, and the view with it turned on
// or off.
export interface ShowingChoice {
  on: (view: View) => boolean;
  turned: (view: View, on: boolean) => View;
}

// A choice kept among the view's page choices under its name, such as shipped releases or Over.
export const namedChoice = (name: string): ShowingChoice => ({
  on: (view) =>
    new Map(Object.entries(view.choices ?? {})).get(name) === shownValue,
  turned: (view, on) => withChoice(view, name, on ? shownValue : undefined),
});

// The Views menu's item for a choice, offered while it would change the rows or while it is on, so
// it can be turned off, and named in the Save view dialog by its part.
function offered(
  { on, turned }: ShowingChoice,
  label: string,
  count: number,
  part: ViewChoice["part"],
  view: View,
): ViewChoice[] {
  return count > 0 || on(view) ? [{ label, count, on, turned, part }] : [];
}

// The rows a tab shows, leaving out those it hides, such as shipped releases, unless the view's
// choice shows them, and the Views menu's item for it, offered while there are any or while it is
// on, which the Save view dialog names Show and the records it adds.
export function hiddenUnlessShown<Row>({
  rows,
  hidden,
  choice,
  label,
  records,
  view,
}: {
  rows: readonly Row[];
  hidden: (row: Row) => boolean;
  choice: ShowingChoice;
  label: string;
  records: string;
  view: View;
}): { rows: Row[]; choices: ViewChoice[] } {
  return {
    rows: choice.on(view) ? [...rows] : rows.filter((row) => !hidden(row)),
    choices: offered(
      choice,
      label,
      rows.filter(hidden).length,
      { name: "Show", value: records },
      view,
    ),
  };
}

// The rows a table keeps while any of its narrowing choices is on, such as Over on Allocations:
// those matching any choice on, every row while none is. Each choice counts the rows it keeps, and
// the Save view dialog names it Only.
export function keptByChoices<Row>({
  rows,
  choices,
  view,
}: {
  rows: readonly Row[];
  choices: readonly {
    choice: ShowingChoice;
    label: string;
    matches: (row: Row) => boolean;
  }[];
  view: View;
}): { rows: Row[]; choices: ViewChoice[] } {
  const on = choices.filter(({ choice }) => choice.on(view));
  return {
    rows:
      on.length === 0
        ? [...rows]
        : rows.filter((row) => on.some(({ matches }) => matches(row))),
    choices: choices.flatMap(({ choice, label, matches }) =>
      offered(
        choice,
        label,
        rows.filter(matches).length,
        { name: "Only", value: label },
        view,
      ),
    ),
  };
}
