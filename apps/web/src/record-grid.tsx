// SPDX-License-Identifier: Apache-2.0

// The shared table of records, edited like a spreadsheet.

import { Paper, Table, Text, VisuallyHidden } from "@mantine/core";
import { columnHeaders } from "./column-header.tsx";
import { frozenVariables, keptEdges, scrollEdges } from "./frozen-columns.ts";
import { gridEditing } from "./grid-editing.tsx";
import { useShownRows } from "./grid-groups.tsx";
import { columnWidth, useGridLayout, widthStyle } from "./grid-layout.ts";
import { gridProps, useGridModel } from "./grid-model.tsx";
import { useGridPanels } from "./grid-panels.tsx";
import { gridRows } from "./grid-row.tsx";
import { gridSaving } from "./grid-saving.ts";
import { gridSelection, useGridState } from "./grid-selection.ts";
import classes from "./pages.module.css";
import type { GridRecord, RecordGridProps } from "./record-table.ts";
import { rowMenus } from "./row-menus.tsx";
import { WithSidePanel } from "./side-panel.tsx";
import { DraftView, MarkedItem } from "./status-mark.tsx";
import { narrows } from "./table-view.ts";

// A line of a column's header, its name or a mark under it, and the room above and below them, for
// how tall a header with marks grows.
const headerLineHeight = "1.125rem";
const headerPadding = "0.5rem";

export function RecordGrid<Rec extends GridRecord, Change, Request>(
  props: RecordGridProps<Rec, Change, Request>,
) {
  // Each part takes what the parts before it give. Those named use… call hooks, so all run before
  // the board's early return; gridRows, after it, calls none.
  const withProps = gridProps(props);
  const withModel = { ...withProps, ...useGridModel(withProps) };
  const withRows = { ...withModel, ...useShownRows(withModel) };
  const withState = { ...withRows, ...useGridState<Rec, Change>() };
  const withSelection = { ...withState, ...gridSelection(withState) };
  const withLayout = { ...withSelection, ...useGridLayout(withSelection) };
  const withSaving = { ...withLayout, ...gridSaving(withLayout) };
  const withMenus = { ...withSaving, ...rowMenus(withSaving) };
  const withEditing = { ...withMenus, ...gridEditing(withMenus) };
  const withHeaders = { ...withEditing, ...columnHeaders(withEditing) };
  const grid = { ...withHeaders, ...useGridPanels(withHeaders) };
  const {
    table,
    columnBorders,
    body,
    ticks,
    known,
    columns,
    view,
    liveById,
    draftById,
    liveBeside,
    renamedFrom,
    besides,
    withActions,
    groupOf,
    shownRecords,
    rows,
    longestText,
    edges,
    setEdges,
    scrollRef,
    measured,
    frozen,
    frozenCell,
    panelRef,
    widths,
    pointerMenu,
    header,
    sidePanels,
    exportQuestion,
    bar,
  } = grid;
  if (body !== undefined) {
    return (
      <DraftView show={known.show}>
        <WithSidePanel
          panels={sidePanels}
          storageKey="fathom-table-panel-width"
        >
          {bar}
          {body({
            records: shownRecords,
            panelOpen: sidePanels.length > 0,
            groupOf,
            groupsReversed: view.groupsReversed === true,
            draftOf: (record) => draftById.get(record.id),
            liveOf: (record) => liveById.get(record.id),
          })}
        </WithSidePanel>
        {exportQuestion}
      </DraftView>
    );
  }
  const { bodyRows, totalRow } = gridRows(grid);
  // Menus and choices stay shown beside their cell however the table scrolls, so they are not hidden
  // when the cell is partly out of view.
  return (
    <DraftView show={known.show}>
      <WithSidePanel panels={sidePanels} storageKey="fathom-table-panel-width">
        {bar}
        <Paper
          ref={panelRef}
          withBorder
          className={classes.tableScrollPanel}
          style={frozenVariables(frozen)}
        >
          <div
            ref={scrollRef}
            className={[classes.tableScroll, classes.scrollBars].join(" ")}
            // Cells reached from the keyboard scroll clear of the header, with its second line when a
            // column's draft renames it, and of the frozen columns.
            style={{
              scrollPaddingTop: `max(var(--fathom-table-head-height), ${String(
                columns.some((column) => renamedFrom(column) !== undefined)
                  ? 2
                  : 1,
              )} * ${headerLineHeight} + ${headerPadding})`,
            }}
            onScroll={(event) => {
              const next = scrollEdges(event.currentTarget);
              setEdges((before) => keptEdges(before, next));
            }}
          >
            <Table
              role="grid"
              aria-label={table.label}
              className={[
                classes.recordTable,
                ticks === undefined ? "" : classes.tickingTable,
              ].join(" ")}
              layout="fixed"
              withColumnBorders={columnBorders}
              tabularNums
            >
              <colgroup>
                {columns.flatMap((column, columnIndex) => {
                  const live = liveBeside(column);
                  return [
                    <col
                      key={column.key}
                      data-column={column.key}
                      className={
                        columnIndex === 0
                          ? classes.recordColFirst
                          : classes.recordCol
                      }
                      style={widthStyle(
                        columnWidth(column, longestText, table.nameColumn),
                        widths.setWidthOf(column.key),
                      )}
                    />,
                    live && (
                      <col
                        key={`${column.key}-live`}
                        data-column={column.key}
                        className={classes.recordCol}
                        style={widthStyle(
                          columnWidth(live, longestText),
                          widths.setWidthOf(column.key),
                        )}
                      />
                    ),
                  ];
                })}
                {withActions && <col className={classes.recordColActions} />}
              </colgroup>
              <Table.Thead>
                <Table.Tr>
                  {columns.flatMap((column, columnIndex) => {
                    const live = liveBeside(column);
                    const liveAt = frozenCell(columnIndex, 1);
                    return [
                      header(column, columnIndex),
                      live && (
                        <Table.Th
                          key={`${column.key}-live`}
                          scope="col"
                          aria-hidden="true"
                          className={[
                            classes.liveColumn,
                            liveAt.className,
                          ].join(" ")}
                          style={liveAt.style}
                        >
                          <span className={classes.recordHeadButton}>
                            <span className={classes.headerName}>
                              <MarkedItem tone="live">
                                <span className={classes.headerLabel}>
                                  {live.label}
                                </span>
                              </MarkedItem>
                            </span>
                          </span>
                        </Table.Th>
                      ),
                    ];
                  })}
                  {withActions && (
                    <Table.Th scope="col">
                      <VisuallyHidden>Actions</VisuallyHidden>
                    </Table.Th>
                  )}
                </Table.Tr>
              </Table.Thead>
              <Table.Tbody>
                {shownRecords.length === 0 &&
                  (narrows(view) || rows.length === 0) && (
                    <Table.Tr>
                      <Table.Td
                        colSpan={
                          columns.length + besides.length + Number(withActions)
                        }
                        className={classes.recordNone}
                      >
                        <Text component="span" fz="sm" c="dimmed">
                          {narrows(view)
                            ? `No matching ${table.noun}`
                            : `No ${table.noun}`}
                        </Text>
                      </Table.Td>
                    </Table.Tr>
                  )}
                {bodyRows}
              </Table.Tbody>
              {table.totals !== undefined && (
                <Table.Tfoot className={classes.recordTotalFoot}>
                  {totalRow(
                    "total",
                    table.totals,
                    table.totals.overall,
                    shownRecords,
                  )}
                </Table.Tfoot>
              )}
            </Table>
          </div>
          {frozen.frozen > 0 && (
            <div
              aria-hidden="true"
              className={classes.frozenEdge}
              data-scrolled={edges.before || undefined}
              style={{ height: measured.height }}
            />
          )}
          {frozen.frozen === 0 && edges.before && (
            <div
              aria-hidden="true"
              className={classes.scrollFade}
              data-side="before"
              style={{ height: measured.height }}
            />
          )}
          {edges.after && (
            <div
              aria-hidden="true"
              className={classes.scrollFade}
              data-side="after"
              style={{ height: measured.height }}
            />
          )}
          {pointerMenu()}
        </Paper>
      </WithSidePanel>
      {exportQuestion}
    </DraftView>
  );
}
