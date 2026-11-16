// SPDX-License-Identifier: Apache-2.0

// What the Releases page's tabs share apart from drawing: each row's Schedule column and the rows
// grouped by it, a Views choice showing the records a tab otherwise leaves out, such as shipped
// releases, a record's rows for its details, and a row's menu discarding or resubmitting the draft
// it shows.

import {
  type RecordRef,
  type ReleaseStream,
  type Show,
  shownChoiceSchema,
} from "@fathom/shared";
import { byChoice } from "./choice-grouping.ts";
import { choice } from "./lists.ts";
import {
  type Column,
  fieldColumn,
  type GridRecord,
  type RowGrouping,
} from "./record-grid.tsx";
import { discardRecordDraft, resubmitRecordDraft } from "./releases.ts";
import type { ViewChoice } from "./table-controls.tsx";
import { type View, withChoice } from "./table-view.ts";

// Each row's schedule, a choice of every schedule, by its ID in the row's schedule field, which
// every row has, read only, as on the Releases and Cycles tabs.
export const scheduleColumn = <
  Rec extends GridRecord & {
    schedule: string;
    draft?: { live: object } | undefined;
  },
>(
  streams: readonly ReleaseStream[],
): Column<Rec, never> =>
  fieldColumn<Rec, never>("schedule", "choice", {
    label: "Schedule",
    required: true,
    multiple: false,
    choices: streams.map(({ id, name }) => choice(id, name, false)),
    readOnly: true,
  });

// The rows grouped by their schedule, as the Releases and Cycles tabs start.
export const bySchedule = <
  Rec extends GridRecord & {
    schedule: string;
    draft?: { live: object } | undefined;
  },
>(
  streams: readonly ReleaseStream[],
): RowGrouping<Rec>[] => [byChoice(scheduleColumn<Rec>(streams))];

// A row's menu's discarding and resubmitting of the draft it shows, given the record each draft is
// of, as decisions name it.
export const draftActions = <Row, Draft>(
  refOf: (row: Row, draft: Draft) => RecordRef,
  run: (work: () => Promise<unknown>, done: string) => void,
) => ({
  discard: (row: Row, draft: Draft) => {
    run(() => discardRecordDraft(refOf(row, draft)), "Discarded the draft.");
  },
  resubmit: (row: Row, draft: Draft) => {
    run(() => resubmitRecordDraft(refOf(row, draft)), "Resubmitted the draft.");
  },
});

// A row's menu's discarding and resubmitting of the record's own draft, never its parts'.
export const ownDraftActions = (
  type: RecordRef["type"],
  run: (work: () => Promise<unknown>, done: string) => void,
) => draftActions((row: { id: string }) => ({ type, id: row.id }), run);

// What a view's choice holds while it shows the records it names.
const shownValue = shownChoiceSchema.value;

// How a view keeps a choice that shows records otherwise left out: whether it is on, and the view
// with it turned on or off.
export interface ShowingChoice {
  on: (view: View) => boolean;
  turned: (view: View, on: boolean) => View;
}

// A choice kept among the view's page choices under its name, such as shipped releases.
export const namedChoice = (name: string): ShowingChoice => ({
  on: (view) =>
    new Map(Object.entries(view.choices ?? {})).get(name) === shownValue,
  turned: (view, on) => withChoice(view, name, on ? shownValue : undefined),
});

// The rows a tab shows, leaving out those it hides, such as shipped releases, unless the view's
// choice shows them, and the Views menu's item for it, offered while there are any or while it is
// on, which the Save view dialog names Show and the records it adds.
export function hiddenUnlessShown<Row>({
  rows,
  hidden,
  choice: { on, turned },
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
  const count = rows.filter(hidden).length;
  return {
    rows: on(view) ? [...rows] : rows.filter((row) => !hidden(row)),
    choices:
      count > 0 || on(view)
        ? [{ label, count, on, turned, part: { name: "Show", value: records } }]
        : [],
  };
}

// A record's rows for its details, by its ID, if its rows hold it: as the Draft view shows it, with
// its draft whatever the view, which its marks are worked out from, and as it is live, or, while it
// is only drafted to be added, as drafted.
export interface DetailRows<Row> {
  shown: Row;
  drafted: Row;
  live: Row;
}

export function detailRows<Row extends { id: string }>(
  // The record's rows as each Draft view shows them, and a row as it is live, if it is.
  rowsAs: (show: Show) => readonly Row[],
  liveOf: (row: Row) => Row | undefined,
  id: string | undefined,
  show: Show,
): DetailRows<Row> | undefined {
  const drafted = rowsAs("both").find((row) => row.id === id);
  if (drafted === undefined) return undefined;
  const live = liveOf(drafted) ?? drafted;
  const applied = rowsAs("drafts").find((row) => row.id === id);
  const shownBy: Record<Show, Row> = {
    both: drafted,
    drafts: applied ?? drafted,
    live,
  };
  // The view is always one of the fixed views.
  // eslint-disable-next-line security/detect-object-injection
  return { shown: shownBy[show], drafted, live };
}
