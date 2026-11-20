// SPDX-License-Identifier: Apache-2.0

// The bar above the shared table, with what Approvers decide at once, and the side panels beside it:
// a cell's editor and Metrics.

import type { ReactNode } from "react";
import type { EditorProps } from "./cell-kinds.tsx";
import type { HeaderGrid } from "./column-header.tsx";
import { focusSoon } from "./focus.ts";
import { breaksDown, kindOf } from "./grid-columns.tsx";
import { draftTotal } from "./drafts.ts";
import { draftColumn, waitingDrafts } from "./grid-drafts.ts";
import { TableScrolling } from "./grid-layout.ts";
import { countedRecords } from "./live-records.ts";
import { MetricsPanel } from "./metrics-panel.tsx";
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
    | "pageParts"
    | "above"
    | "fields"
    | "liveColumn"
    | "allColumns"
    | "known"
    | "columns"
    | "view"
    | "records"
    | "approves"
    | "approvesRecord"
    | "decidableRow"
    | "fieldsLive"
    | "liveBeside"
    | "nests"
    | "countedOnce"
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
    pageParts,
    above,
    fields,
    liveColumn,
    allColumns,
    known,
    columns,
    view,
    records,
    approves,
    approvesRecord,
    decidableRow,
    fieldsLive,
    liveBeside,
    nests,
    countedOnce,
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
    approvesColumns: approves.includes("field"),
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
  const metrics = view.breakdown !== undefined && (
    <MetricsPanel
      one={table.one}
      noun={table.noun}
      kinds={table.counted}
      {...countedRecords(
        withDrafts ? view.show : "live",
        countedOnce(shownRecords),
        allColumns,
        liveForMetrics,
        table.liveRecords,
      )}
      offered={allColumns.filter(breaksDown)}
      breakdown={view.breakdown}
      onBreakdown={(breakdown) => {
        onView({ ...view, breakdown });
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
      view={view}
      onView={onView}
      shown={countedOnce(shownRecords).length}
      total={countedOnce(records).length}
      counted={table.counted?.counted(countedOnce(records))}
      groupings={table.groupings}
      nests={nests}
      withDrafts={withDrafts}
      onLeave={() => {
        const active = activeNow();
        moveTo(active.row, active.column);
      }}
      saved={saved}
      choices={viewChoices}
      pageParts={pageParts}
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
