// SPDX-License-Identifier: Apache-2.0

// The bar above the shared table, with what Approvers decide at once, and the side panels beside it:
// a cell's editor and Metrics.

import type { Field } from "@fathom/shared";
import type { ReactNode } from "react";
import type { EditorProps } from "./cell-kinds.tsx";
import type { HeaderGrid } from "./column-header.tsx";
import { focusSoon } from "./focus.ts";
import { breaksDown, kindOf } from "./grid-columns.tsx";
import { draftTotal, mayDecide, noDrafts } from "./drafts.ts";
import { draftColumn, waitingDrafts } from "./grid-drafts.ts";
import { TableScrolling } from "./grid-layout.ts";
import {
  countedRecords,
  removedWhenApplied,
  withoutRemovals,
} from "./live-records.ts";
import { MetricsPanel } from "./metrics-panel.tsx";
import { chosenSum, sumAtFirst } from "./table-view.ts";
import { metricsButtonId, metricsPanelId } from "./metrics.ts";
import type { Column, GridRecord } from "./record-table.ts";
import type { SidePanel } from "./side-panel.tsx";
import { DecideAllItems, ViewBar } from "./table-controls.tsx";
import { useTableExport } from "./table-export.tsx";

export function useGridPanels<Rec extends GridRecord, Change, Request>(
  grid: Pick<
    HeaderGrid<Rec, Change, Request>,
    | "everyone"
    | "table"
    | "draftedFields"
    | "saving"
    | "actions"
    | "onView"
    | "saved"
    | "withDrafts"
    | "panels"
    | "viewChoices"
    | "count"
    | "countNarrowed"
    | "pageParts"
    | "pageFilter"
    | "above"
    | "fields"
    | "liveColumn"
    | "allColumns"
    | "known"
    | "columns"
    | "view"
    | "records"
    | "approves"
    | "decidedBy"
    | "approvesRecord"
    | "decidableRow"
    | "fieldsLive"
    | "liveBeside"
    | "nests"
    | "laysOutColumns"
    | "countedOnce"
    | "viewed"
    | "shownRecords"
    | "setPanelWriting"
    | "problem"
    | "setProblem"
    | "rowKey"
    | "at"
    | "activeNow"
    | "editing"
    | "inPanel"
    | "setEditing"
    | "moveTo"
    | "tableScroll"
    | "valueAt"
    | "saveTo"
  >,
) {
  const {
    everyone,
    table,
    draftedFields,
    saving,
    actions,
    onView,
    saved,
    withDrafts,
    panels,
    viewChoices,
    count,
    countNarrowed,
    pageParts,
    pageFilter,
    above,
    fields,
    liveColumn,
    allColumns,
    known,
    columns,
    view,
    records,
    approves,
    decidedBy,
    approvesRecord,
    decidableRow,
    fieldsLive,
    liveBeside,
    nests,
    laysOutColumns,
    countedOnce,
    viewed,
    shownRecords,
    setPanelWriting,
    problem,
    setProblem,
    rowKey,
    at,
    activeNow,
    editing,
    inPanel,
    setEditing,
    moveTo,
    tableScroll,
    valueAt,
    saveTo,
  } = grid;
  // The drafts waiting among the records and columns shown, which Approvers approve or reject all at
  // once, and among all the table could show, so the menu says how many the view hides.
  const deciding = {
    decidableRow,
    approvesRecord,
    approvesColumn: (field: Field) =>
      mayDecide(approves, { ...noDrafts(), columns: [field.id] }, decidedBy),
    draftsOf: table.drafts,
  };
  const waitingShown = waitingDrafts(
    shownRecords,
    fields.filter((field) => columns.some(({ key }) => key === field.id)),
    deciding,
  );
  const waitingTotal = draftTotal(waitingShown);
  const waitingEverywhere = draftTotal(
    waitingDrafts(everyone, draftedFields, deciding),
  );

  // A column only drafted to be added, or to draw on another list, has no live figures to compare.
  const liveForMetrics = (column: Column<Rec, Change>) => {
    const draft = column.field?.draft;
    if (draft?.action === "created") return undefined;
    if (fieldsLive.get(column.key)?.listId !== column.field?.listId) {
      return undefined;
    }
    return liveBeside(column) ?? liveColumn(column);
  };
  // Drafts applied leaves out the records drafted to be removed, which count as published and live;
  // Live only counts the records as drafted, to mark what the drafts will move. Worked out only
  // while the metrics show.
  const besides = () => {
    if (!withDrafts) return undefined;
    if (view.show === "drafts") {
      return viewed(everyone.filter(removedWhenApplied));
    }
    return view.show === "live" ? viewed(everyone) : [];
  };
  const metrics = view.breakdown !== undefined && (
    <MetricsPanel
      one={table.one}
      noun={table.noun}
      kinds={table.counted}
      {...countedRecords(
        withDrafts ? view.show : "live",
        countedOnce(shownRecords),
        ((shown) => shown && countedOnce(shown))(besides()),
        allColumns,
        liveForMetrics,
        table.liveRecords,
      )}
      offered={allColumns.filter(breaksDown)}
      breakdown={view.breakdown}
      onBreakdown={(breakdown) => {
        onView({ ...view, breakdown });
      }}
      summable={allColumns.filter((column) => column.sum !== undefined)}
      sum={view.sum ?? sumAtFirst(allColumns)}
      onSum={(sum) => {
        onView({ ...view, sum: chosenSum(sum, allColumns) });
      }}
      onClose={() => {
        onView({ ...view, breakdown: undefined });
        focusSoon(metricsButtonId);
      }}
    />
  );

  const cellPanel = ((): SidePanel[] => {
    if (inPanel === undefined) return [];
    const { column, readOnly } = inPanel;
    // A kind edited in the side panel has an editor.
    const Editor = kindOf(column).Editor as (props: EditorProps) => ReactNode;
    // The record as it is now while its row is shown, or as it was when the panel opened.
    const row = editing === undefined ? inPanel.row : at(editing).row;
    const key = rowKey(row);
    const id = `cell-${key}-${column.key}-editor`;
    const refused =
      problem?.row === key && problem.column === column.key
        ? problem.message
        : undefined;
    // The panel closes, and the cell it opened from, if shown, has focus again.
    const close = () => {
      setEditing(undefined);
      if (editing !== undefined) moveTo(editing.row, editing.column);
    };
    return [
      {
        key: "cell",
        id: `${id}-panel`,
        name: column.label,
        node: (
          <Editor
            key={id}
            id={id}
            column={column}
            value={valueAt(row, column)}
            typed=""
            invalid={refused !== undefined}
            problem={refused}
            readOnly={readOnly}
            onWriting={setPanelWriting}
            onDone={(edited) => {
              // A refused value keeps the panel open, with what was written and why.
              if (saveTo(row, column, edited)) close();
            }}
            onCancel={() => {
              setProblem(undefined);
              close();
            }}
          />
        ),
      },
    ];
  })();
  const sidePanels: SidePanel[] = [
    ...panels,
    ...cellPanel,
    ...(metrics === false
      ? []
      : [
          {
            key: "metrics",
            id: metricsPanelId,
            name: "metrics",
            node: metrics,
          },
        ]),
  ];

  // Counted as the metrics count them: each record once, leaving out those drafted to be removed.
  const stayingOnce = (rows: readonly Rec[]) =>
    withoutRemovals(countedOnce(rows));
  const staying = stayingOnce(records);

  const exportQuestion = useTableExport({
    table,
    show: known.show,
    shown: shownRecords,
    everyone,
    columns,
    liveColumn,
    saved,
  });
  const viewBar = (
    <ViewBar
      one={table.one}
      noun={table.noun}
      columns={allColumns}
      draftFilter={draftColumn}
      barFilters={table.barFilters}
      view={view}
      onView={onView}
      shown={stayingOnce(shownRecords).length}
      total={staying.length}
      counted={count?.(staying) ?? table.counted?.counted(staying)}
      countedNarrowed={countNarrowed?.(staying, stayingOnce(shownRecords))}
      groupings={table.groupings}
      nests={nests}
      laysOutColumns={laysOutColumns}
      withDrafts={withDrafts}
      onLeave={() => {
        const active = activeNow();
        moveTo(active.row, active.column);
      }}
      saved={saved}
      choices={viewChoices}
      pageParts={pageParts}
      pageFilter={pageFilter}
      draftItems={
        <>
          {waitingTotal > 0 && (
            <DecideAllItems
              total={waitingTotal}
              everywhere={waitingEverywhere}
              disabled={saving}
              onDecide={(asking) => {
                actions.decide(asking, waitingShown, true);
              }}
            />
          )}
        </>
      }
    />
  );
  const bar =
    above === undefined ? (
      viewBar
    ) : (
      <div>
        {viewBar}
        <TableScrolling.Provider value={tableScroll}>
          {above(shownRecords)}
        </TableScrolling.Provider>
      </div>
    );
  return {
    sidePanels,
    exportQuestion,
    bar,
  };
}

export type PanelGrid<Rec extends GridRecord, Change, Request> = HeaderGrid<
  Rec,
  Change,
  Request
> &
  ReturnType<typeof useGridPanels<Rec, Change, Request>>;
