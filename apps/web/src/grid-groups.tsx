// SPDX-License-Identifier: Apache-2.0

// The shared table's rows in the view's order, under their headings, kept steady while they are
// edited.

import { VisuallyHidden } from "@mantine/core";
import { type ReactNode, useEffect, useState } from "react";
import { draftColumn } from "./grid-drafts.ts";
import type { ModelGrid } from "./grid-model.tsx";
import classes from "./pages.module.css";
import type { GridRecord, RowGrouping } from "./record-table.ts";
import { tickedOf } from "./row-ticks.tsx";
import { Tipped } from "./table-tips.tsx";
import {
  type View,
  activeGrouping,
  activeThenBy,
  filtersBesideColumns,
} from "./table-view.ts";
import {
  type OtherPlace,
  type PlacedRow,
  type RowGroup,
  type RowGroups,
  groupedRowId,
  placedRows,
  recordsOf,
  rowsInOrder,
} from "./row-groups.ts";
import { applyView, useSteadyOrder } from "./table-rows.ts";

// Each record's groups as the view last placed them, so its rows keep their headings while it is
// edited, as they keep their places; a record shown since is placed by what it held when first
// shown, so its rows keep their keys too.
function useSteadyGroups<Rec>(
  records: readonly Rec[],
  view: View,
  grouping: RowGrouping<Rec> | undefined,
  idOf: (record: Rec) => string,
): ((record: Rec) => RowGroups) | undefined {
  const viewKey = JSON.stringify(view);
  const take = () => ({
    view: viewKey,
    groups: new Map(
      grouping === undefined
        ? []
        : records.map((record) => [idOf(record), grouping.of(record)]),
    ),
  });
  const [snapshot, setSnapshot] = useState(take);
  let current = snapshot;
  if (snapshot.view !== viewKey) {
    current = take();
    setSnapshot(current);
  }
  const { groups } = current;
  return grouping === undefined
    ? undefined
    : (record) => {
        const id = idOf(record);
        const placed = groups.get(id) ?? grouping.of(record);
        // Kept on first sight only, from the same records, so a render React discards pins
        // nothing another wouldn't.
        groups.set(id, placed);
        return placed;
      };
}

// A run of rows of one group, headed by its label, with the records it holds, each once.
interface GroupRun<Rec> {
  key: string;
  first: string;
  last: string;
  label: string;
  colour: string | null;
  nested: boolean;
  records: Rec[];
}

// The runs of rows of one group, by the group each row's place gives it, at the first level or
// nested under it. Rows added since the view last changed stay at the end, so may start a run of
// their own.
function runsOf<Rec>(
  rows: readonly PlacedRow<Rec>[],
  nested: boolean,
  placeOf: (row: PlacedRow<Rec>) => RowGroup | undefined,
): GroupRun<Rec>[] {
  const runs: GroupRun<Rec>[] = [];
  for (const row of rows) {
    const group = placeOf(row);
    if (group === undefined) continue;
    const run = runs.at(-1);
    if (run?.key === group.key) {
      if (!run.records.includes(row.record)) run.records.push(row.record);
      run.last = row.key;
    } else {
      runs.push({
        key: group.key,
        first: row.key,
        last: row.key,
        label: group.label,
        colour: group.colour ?? null,
        nested,
        records: [row.record],
      });
    }
  }
  return runs;
}

// After the name of a record shown under several headings: how many others, and in its tip, which,
// so whoever edits one row knows another shows the same record.
export function AlsoUnder({ others }: { others: readonly OtherPlace[] }) {
  if (others.length === 0) return null;
  const names = others
    .map(({ group, subgroup }) =>
      [group, subgroup]
        .flatMap((one) => (one === undefined ? [] : [one.label]))
        .join(": "),
    )
    .join(", ");
  const tip = `Also under ${names}`;
  return (
    <Tipped tip={tip} className={classes.alsoUnder}>
      <span aria-hidden="true">+{others.length}</span>
      <VisuallyHidden>{`, also under ${names}.`}</VisuallyHidden>
    </Tipped>
  );
}

// A Name cell's content with its +1 and any mark of its column after it, such as a fact's box, the
// name cut short first, so they stay in view while the row's controls take room from the cell.
export function NamedWithOthers({
  others,
  after,
  children,
}: {
  others: readonly OtherPlace[];
  after?: ReactNode;
  children: ReactNode;
}) {
  if (
    others.length === 0 &&
    (after === undefined || after === null || after === false)
  ) {
    return children;
  }
  return (
    <span className={classes.namedWithOthers}>
      <span className={classes.namedWithOthersName}>{children}</span>
      <span>
        <AlsoUnder others={others} />
        {after}
      </span>
    </span>
  );
}

export function useShownRows<Rec extends GridRecord, Change, Request>(
  grid: Pick<
    ModelGrid<Rec, Change, Request>,
    | "table"
    | "body"
    | "ticks"
    | "allColumns"
    | "view"
    | "records"
    | "pageFilter"
  >,
) {
  const { table, body, ticks, allColumns, view, records, pageFilter } = grid;
  const keptByPage = (shown: readonly Rec[]) =>
    pageFilter === undefined ? shown : shown.filter(pageFilter.keeps);
  // The records the page and the view's search and filters keep.
  const viewed = (shown: readonly Rec[]) =>
    applyView(
      keptByPage(shown),
      allColumns,
      view,
      filtersBesideColumns(draftColumn, table.barFilters),
      table.keyOf,
    );
  // The records this user has added since the page opened, which stay shown whatever the view.
  const [added, setAdded] = useState<ReadonlySet<string>>(new Set());
  // The identifier each record added since the page opened was shown under before it was saved, by
  // its own, which names its row from then on.
  const [shownAs, setShownAs] = useState<ReadonlyMap<string, string>>(
    new Map(),
  );
  const stableId = (record: Rec) => shownAs.get(record.id) ?? record.id;
  // Freezing, moving, hiding, and setting the widths of columns move no rows.
  const rowView = {
    ...view,
    frozen: undefined,
    order: undefined,
    hidden: undefined,
    widths: undefined,
  };
  const groupOf = useSteadyGroups(
    records,
    rowView,
    activeGrouping(view, table.groupings),
    stableId,
  );
  // A page drawing the rows its own way, such as a board, shows the first grouping alone.
  const nests = table.oneLevel !== true && body === undefined;
  // A page drawing the rows its own way has no columns laid out, to freeze, move, hide or widen.
  const laysOutColumns = body === undefined;
  const subgroupOf = useSteadyGroups(
    records,
    rowView,
    nests ? activeThenBy(view, table.groupings) : undefined,
    stableId,
  );
  const countedAs = table.countedAs ?? ((record: Rec) => record.id);
  const countedOnce = (rows: readonly Rec[]): readonly Rec[] => [
    ...new Map(rows.map((row) => [countedAs(row), row])).values(),
  ];
  const everyRow = placedRows(records, groupOf, stableId, subgroupOf);
  // The rows of the records this user has added, in the order they added them.
  const addedRows = new Set(
    [...added].flatMap((id) =>
      everyRow.flatMap((row) => (stableId(row.record) === id ? [row.key] : [])),
    ),
  );
  const shownRows = useSteadyOrder(
    everyRow,
    rowView,
    (rows) =>
      rowsInOrder(rows, viewed(recordsOf(rows)), view.groupsReversed === true),
    ({ key }) => key,
    addedRows,
  );
  const shownRecords = recordsOf(shownRows);
  const tickedShown =
    ticks === undefined ? undefined : tickedOf(ticks, shownRecords);
  const shownIds = new Set(shownRecords.map(({ id }) => id));
  // A row the view hides is unticked, so what the page does with the rows ticked is only ever to
  // rows in sight. Checked after every render, since the view and the ticks both change it.
  useEffect(() => {
    const hidden = [...(ticks?.ticked ?? [])].filter((id) => !shownIds.has(id));
    if (hidden.length > 0) ticks?.onTick(hidden, false);
  });
  const groupRuns = runsOf(shownRows, false, ({ group }) => group);
  const subgroupRuns = runsOf(shownRows, true, ({ group, subgroup }) =>
    group === undefined || subgroup === undefined
      ? undefined
      : { ...subgroup, key: groupedRowId(group.key, subgroup.key) },
  );
  // The headings above a row: its group's, where it starts one, then its second group's.
  const headings = new Map<string, GroupRun<Rec>[]>();
  for (const run of [...groupRuns, ...subgroupRuns]) {
    headings.set(run.first, [...(headings.get(run.first) ?? []), run]);
  }
  const runEnds = new Map(groupRuns.map((run) => [run.last, run.records]));
  return {
    setAdded,
    setShownAs,
    stableId,
    groupOf,
    nests,
    laysOutColumns,
    countedOnce,
    viewed,
    shownRows,
    shownRecords,
    tickedShown,
    shownIds,
    headings,
    runEnds,
  };
}

export type ShownGrid<Rec extends GridRecord, Change, Request> = ModelGrid<
  Rec,
  Change,
  Request
> &
  ReturnType<typeof useShownRows<Rec, Change, Request>>;
