// SPDX-License-Identifier: Apache-2.0

// The shared table's rows: each record's, with its Live row under it, the new rows, the group
// headings and the totals.

import { Table, type TableTdProps, Text, VisuallyHidden } from "@mantine/core";
import { useSyncExternalStore } from "react";
import { ColouredName } from "./colour-swatch.tsx";
import { focusFoundSoon } from "./focus.ts";
import {
  cellContent,
  columnsOn,
  isEmpty,
  kindOf,
  liveContent,
  offered,
  onRow,
  readOnlyFor,
  shown,
} from "./grid-columns.tsx";
import {
  cellDraftOf,
  changedBy,
  changedIn,
  draftChanges,
  isPending,
  wholeCellDraft,
} from "./grid-drafts.ts";
import { NamedWithOthers } from "./grid-groups.tsx";
import type { Place, PlaceStore } from "./grid-places.ts";
import type { PanelGrid } from "./grid-panels.tsx";
import classes from "./pages.module.css";
import type { Column, DraftOf, GridRecord, RowTotals } from "./record-table.ts";
import { RowTick } from "./row-ticks.tsx";
import { DraftedItem, MarkedItem, besideLive } from "./status-mark.tsx";
import { wasWords } from "./draft-marks.ts";

const recordCellAttribute = "data-record-cell";
const recordCellOf = (id: string, columnKey: string) => `${id} ${columnKey}`;

// Every cell of a record in a column, one in each of its rows.

// An empty value's stand-in, unless a warning in its place says the same, so the words show once.
const unlessWarned = (
  standIn: string | undefined,
  warning: { words: string } | undefined,
) => (standIn === warning?.words ? undefined : standIn);
export const recordCellSelector = (id: string, columnKey: string) =>
  `[${recordCellAttribute}="${CSS.escape(recordCellOf(id, columnKey))}"]`;

// Puts focus on a record's cell in a column, such as once its details close: in the row with the
// table's active cell, where the record has a row under each of several groups, or else its first.
export function focusRecordCell(id: string, columnKey: string): void {
  focusFoundSoon(() => {
    const cells = [
      ...document.querySelectorAll<HTMLElement>(
        recordCellSelector(id, columnKey),
      ),
    ];
    return (
      cells.find(
        (cell) =>
          cell
            .closest("tr")
            ?.querySelector('[role="gridcell"][tabindex="0"]') != null,
      ) ?? cells[0]
    );
  });
}

// A record's cell, reached by Tab while it is the one selected.
function SelectableCell({
  activeAt,
  isSelectedAt,
  ...cell
}: TableTdProps & {
  activeAt: PlaceStore;
  isSelectedAt: (place: Place | undefined) => boolean;
}) {
  const selected = useSyncExternalStore(activeAt.subscribe, () =>
    isSelectedAt(activeAt.get()),
  );
  return <Table.Td {...cell} tabIndex={selected ? 0 : -1} />;
}

// What the mark of a new row being filled in says, until its record is added: that it is new, and
// what is wrong with it so far, or otherwise the required columns still empty.
function newRowWords(missing: readonly string[], wrong: string | undefined) {
  const status = "New, not saved yet";
  const detail =
    wrong ?? (missing.length > 0 ? `${missing.join(", ")} needed` : undefined);
  return detail === undefined ? status : `${status}: ${detail}`;
}

// What is wrong with a new row so far, in red after its value, announced as it is found, since it
// is a problem to fix rather than a mark's words.
function NewRowWrong({ wrong, id }: { wrong: string | undefined; id: string }) {
  return (
    <span aria-live="polite">
      {wrong !== undefined && (
        <span id={id} className={classes.newMarkWrong}>
          {wrong}
        </span>
      )}
    </span>
  );
}

export function gridRows<Rec extends GridRecord, Change, Request>(
  grid: Pick<
    PanelGrid<Rec, Change, Request>,
    | "table"
    | "ticks"
    | "liveColumn"
    | "allColumns"
    | "columns"
    | "view"
    | "recordDraft"
    | "marksRows"
    | "liveById"
    | "draftById"
    | "cellDraftsById"
    | "liveBeside"
    | "besides"
    | "liveCell"
    | "columnTint"
    | "withActions"
    | "rowKind"
    | "shownIds"
    | "headings"
    | "runEnds"
    | "problem"
    | "menuFor"
    | "rows"
    | "rowKey"
    | "cellId"
    | "activeAt"
    | "activeOf"
    | "editing"
    | "inPanel"
    | "setActive"
    | "frozenCell"
    | "newValue"
    | "valueAt"
    | "shownAt"
    | "standInAt"
    | "liveStandIn"
    | "emptyNewRow"
    | "onPaste"
    | "hasRowMenu"
    | "rowMenuItems"
    | "rowMenu"
    | "rowMoreButton"
    | "nameCellControls"
    | "onRowContextMenu"
    | "startEdit"
    | "onCellKey"
    | "problemIn"
    | "editor"
  >,
) {
  const {
    table,
    ticks,
    liveColumn,
    allColumns,
    columns,
    view,
    recordDraft,
    marksRows,
    liveById,
    draftById,
    cellDraftsById,
    liveBeside,
    besides,
    liveCell,
    columnTint,
    withActions,
    rowKind,
    shownIds,
    headings,
    runEnds,
    problem,
    menuFor,
    rows,
    rowKey,
    cellId,
    activeAt,
    activeOf,
    editing,
    inPanel,
    setActive,
    frozenCell,
    newValue,
    valueAt,
    shownAt,
    standInAt,
    liveStandIn,
    emptyNewRow,
    onPaste,
    hasRowMenu,
    rowMenuItems,
    rowMenu,
    rowMoreButton,
    nameCellControls,
    onRowContextMenu,
    startEdit,
    onCellKey,
    problemIn,
    editor,
  } = grid;
  const liveCellBeside = (
    record: Rec | undefined,
    column: Column<Rec, Change>,
    index: number,
  ) => {
    const at = frozenCell(index, 1);
    return (
      liveBeside(column) && (
        <Table.Td
          key={`${column.key}-live`}
          aria-hidden="true"
          className={[
            classes.recordCell,
            classes.liveColumn,
            at.className,
          ].join(" ")}
          style={at.style}
        >
          {liveCell(record, column)}
        </Table.Td>
      )
    );
  };
  // Total rows are not among the rows, so keyboard moves pass over them.
  const totalRow = (
    key: string,
    totals: RowTotals<Rec>,
    label: string,
    summed: readonly Rec[],
  ) => (
    <Table.Tr key={key} className={classes.recordTotalRow}>
      {columns.flatMap((column, columnIndex) => {
        const frozenAt = frozenCell(columnIndex);
        const className = [classes.recordCell, frozenAt.className].join(" ");
        return [
          columnIndex === 0 ? (
            <Table.Th
              key={column.key}
              scope="row"
              className={className}
              style={frozenAt.style}
            >
              {label}
            </Table.Th>
          ) : (
            <Table.Td
              key={column.key}
              className={className}
              style={frozenAt.style}
            >
              {totals.cell(summed, column.key)}
            </Table.Td>
          ),
          liveCellBeside(undefined, column, columnIndex),
        ];
      })}
      {withActions && <Table.Td className={classes.recordCell} />}
    </Table.Tr>
  );
  const bodyRows = rows.map((row, rowIndex) => {
    const key = rowKey(row);
    const rowProblem =
      problem?.row === key ? problem.message : row.newRow?.problem;
    const record = row.record;
    const draft = record?.draft as DraftOf<Rec> | undefined;
    // The record's draft whatever the view, for its marks.
    const marked =
      record === undefined
        ? draft
        : (draftById.get(record.id) as DraftOf<Rec> | undefined);
    const liveRecord =
      record && draft?.action === "changed"
        ? liveById.get(record.id)
        : undefined;
    // A warning about a live value, such as a manager who has left, shown in the Live
    // row as in any other.
    // Asked only in the Live row, which a record has only when the table gives a live
    // record for it.
    const liveWarning = (column: Column<Rec, Change>) =>
      column.status?.(liveRecord as Rec);
    // A row with a draft is tinted, and one a draft removes is struck through too.
    let rowClass: string | undefined;
    const filling = row.newRow && !emptyNewRow(row.newRow);
    if (row.newRow) {
      rowClass = filling ? classes.recordFillingRow : undefined;
    } else if (draft && marksRows) {
      rowClass = [
        besideLive(view.show) ? classes.draftRow : "",
        besideLive(view.show) && draft.state === "rejected"
          ? classes.rejectedRow
          : "",
        draft.action === "deleted" ? classes.recordRemovedRow : "",
      ].join(" ");
    }
    const runEnded = runEnds.get(key);
    return [
      ...(headings.get(key) ?? []).map((heading) => (
        <Table.Tr key={`group-${heading.nested ? "nested-" : ""}${key}`}>
          <Table.Th
            scope="row"
            colSpan={columns.length + besides.length + Number(withActions)}
            className={
              heading.nested ? classes.recordSubgroup : classes.recordGroup
            }
          >
            <span className={classes.recordGroupLabel}>
              {heading.label}
              <Text component="span" fz="sm" c="dimmed" ml="xs">
                {heading.records.length}
                <VisuallyHidden>
                  {` ${heading.records.length === 1 ? table.one : table.noun}`}
                </VisuallyHidden>
              </Text>
            </span>
          </Table.Th>
        </Table.Tr>
      )),
      <Table.Tr
        key={key}
        className={rowClass}
        // A menu opened by a right-click hangs from no control in the row, so the row
        // says it has one open, keeping its controls shown and others' hidden.
        data-menu-open={menuFor?.key === key || undefined}
        aria-label={row.newRow ? table.newRowLabel(rowKind(row)) : undefined}
        onContextMenu={(event) => {
          onRowContextMenu(event, row);
        }}
      >
        {columns.flatMap((column, columnIndex) => {
          const cell = { row: rowIndex, column: columnIndex };
          const has = offered(column, rowKind(row));
          const editingHere =
            editing?.row === rowIndex &&
            editing.column === columnIndex &&
            inPanel === undefined;
          // A value another record's draft changes is marked by that draft, not the row's.
          // Only while the row shows a draft, so a row shown live, as under Live only, has none.
          const cellDraft =
            (draft === undefined
              ? undefined
              : cellDraftOf(record?.cellDrafts, column)) ?? draft;
          const cellMarked =
            (record === undefined
              ? undefined
              : cellDraftOf(cellDraftsById.get(record.id), column)) ?? marked;
          // A new row being filled in is marked in its first cell's slot until added.
          const newRowMarked =
            columnIndex === 0 &&
            filling === true &&
            rowProblem === undefined &&
            !editingHere;
          const warning =
            record === undefined || editingHere
              ? undefined
              : column.status?.(record);
          const standIn = unlessWarned(standInAt(row, column), warning);
          // A list of records marks each record a change adds or takes away, so its cell is not
          // marked as changed as a whole; a new record's cells all are.
          const changes =
            draftChanges(cellDraft, column) &&
            !(column.parts !== undefined && cellDraft?.action === "changed");
          const mark = row.record && !editingHere && column.mark?.(row.record);
          const namedMark = column.key === table.nameColumn ? mark : undefined;
          const frozenAt = frozenCell(columnIndex);
          const value = shownAt(row, column);
          const live =
            changes && cellDraft?.action === "changed"
              ? shown(liveColumn(column), column.live(cellDraft)) || "empty"
              : undefined;
          return [
            <SelectableCell
              key={column.key}
              id={cellId(rowIndex, columnIndex)}
              {...(record === undefined
                ? {}
                : {
                    [recordCellAttribute]: recordCellOf(record.id, column.key),
                  })}
              role="gridcell"
              activeAt={activeAt}
              isSelectedAt={(place) => {
                const selected = activeOf(place);
                return (
                  selected.row === rowIndex && selected.column === columnIndex
                );
              }}
              aria-invalid={
                (columnIndex === 0 && rowProblem !== undefined) ||
                problemIn(cell) !== undefined
                  ? true
                  : undefined
              }
              className={[
                classes.recordCell,
                columnTint(column),
                changes && besideLive(view.show) && marksRows
                  ? cellDraft?.state === "rejected"
                    ? classes.rejectedCell
                    : classes.draftCell
                  : "",
                // While edited, the editor is marked instead.
                problemIn(cell) === undefined || editingHere
                  ? ""
                  : classes.recordProblemCell,
                frozenAt.className,
              ].join(" ")}
              style={frozenAt.style}
              data-shaded={
                (row.record && column.shaded?.(row.record)) || undefined
              }
              aria-readonly={
                readOnlyFor(column, rowKind(row)) ||
                (row.record && table.readOnlyRecord?.(row.record)) ||
                draft?.action === "deleted" ||
                row.record?.heldBy !== undefined ||
                (row.record && isPending(row.record))
                  ? true
                  : undefined
              }
              onKeyDown={(event) => {
                onCellKey(event, cell);
              }}
              onPaste={(event) => {
                onPaste(event, cell);
              }}
              onFocus={(event) => {
                if (event.target === event.currentTarget) {
                  setActive(cell);
                }
              }}
              onClick={() => {
                const kind = kindOf(column);
                if (kind.toggled !== undefined || kind.inPanel === true) {
                  startEdit(cell);
                }
              }}
              onDoubleClick={() => {
                if (kindOf(column).toggled === undefined) {
                  startEdit(cell);
                }
              }}
            >
              {columnIndex === 0 &&
                ticks !== undefined &&
                record !== undefined && (
                  <RowTick
                    label={ticks.label(record)}
                    tip={ticks.tip?.(record, shownIds)}
                    checked={ticks.ticked.has(record.id)}
                    disabled={!ticks.tickable(record, shownIds)}
                    onChange={(on) => {
                      ticks.onTick([record.id], on);
                    }}
                  />
                )}
              <NamedWithOthers
                others={
                  column.key === table.nameColumn && !editingHere
                    ? (row.others ?? [])
                    : []
                }
                after={namedMark}
              >
                <DraftedItem
                  slot={columnIndex === 0 && !editingHere}
                  draft={
                    columnIndex === 0 && !editingHere
                      ? recordDraft(marked)
                      : undefined
                  }
                  heldBy={
                    columnIndex === 0 && !editingHere
                      ? row.record?.heldBy
                      : undefined
                  }
                  unpublished={
                    newRowMarked &&
                    newRowWords(
                      columnsOn(allColumns, rowKind(row))
                        .filter(
                          (other) =>
                            other.required &&
                            isEmpty(newValue(row.newRow, other)),
                        )
                        .map(({ label }) => label),
                      row.newRow.soFar?.message,
                    )
                  }
                >
                  <DraftedItem
                    draft={
                      editingHere
                        ? undefined
                        : wholeCellDraft(cellMarked, column)
                    }
                    by={editingHere ? undefined : changedBy(cellDraft, column)}
                    was={
                      !editingHere &&
                      cellDraft !== undefined &&
                      wholeCellDraft(cellDraft, column) !== undefined
                        ? wasWords(
                            shown(liveColumn(column), column.live(cellDraft)),
                            column.label,
                            column.emptyLabel,
                          )
                        : undefined
                    }
                  >
                    <MarkedItem
                      tone={warning === undefined ? undefined : "warning"}
                      words={warning?.words}
                      spoken={warning?.spoken}
                      empty={standIn === undefined && isEmpty(value)}
                    >
                      {editingHere
                        ? editor(
                            cell,
                            onRow(column, row.record, rowKind(row)),
                            valueAt(row, column),
                          )
                        : has &&
                          (standIn === undefined ? (
                            <ColouredName
                              colour={
                                row.record === undefined || isEmpty(value)
                                  ? null
                                  : (column.colour?.(row.record) ?? null)
                              }
                            >
                              {row.record && column.content
                                ? column.content(row.record)
                                : cellContent(column, value)}
                            </ColouredName>
                          ) : (
                            <Text
                              component="span"
                              inherit
                              c="dimmed"
                              fs="italic"
                            >
                              {standIn}
                            </Text>
                          ))}
                    </MarkedItem>
                  </DraftedItem>
                </DraftedItem>
              </NamedWithOthers>
              {column.key === table.nameColumn &&
                !editingHere &&
                nameCellControls(row)}
              {column.key !== table.nameColumn && mark}
              {changes && !editingHere && marksRows && (
                <VisuallyHidden>
                  {live === undefined ? ", draft" : `, draft, live ${live}`}
                </VisuallyHidden>
              )}
              {newRowMarked && (
                <NewRowWrong
                  wrong={row.newRow.soFar?.message}
                  id={`${cellId(rowIndex, 0)}-problem`}
                />
              )}
              {columnIndex === 0 && rowProblem !== undefined && (
                <span
                  id={`${cellId(rowIndex, 0)}-problem`}
                  className={classes.recordProblem}
                  role="alert"
                >
                  {rowProblem}
                </span>
              )}
            </SelectableCell>,
            liveCellBeside(row.record, column, columnIndex),
          ];
        })}
        {withActions && (
          <Table.Td
            className={[classes.recordCell, classes.recordActionsCell].join(
              " ",
            )}
          >
            {hasRowMenu(row) &&
              rowMenu(
                rowKey(row),
                "end",
                rowMoreButton(row),
                rowMenuItems(row),
              )}
          </Table.Td>
        )}
      </Table.Tr>,
      // Under a record whose draft changes it, the record as it is live, to compare.
      // Assistive technology hears each changed cell's live value instead.
      record !== undefined &&
        draft?.action === "changed" &&
        liveRecord !== undefined &&
        besideLive(view.show) && (
          <Table.Tr
            key={`${key}-live`}
            className={classes.recordLiveRow}
            aria-hidden="true"
          >
            {columns.flatMap((column, columnIndex) => {
              const standIn = unlessWarned(
                liveStandIn(record, column),
                liveWarning(column),
              );
              const liveShown = changedIn(draft, column)
                ? column.live(draft)
                : column.value(record);
              const frozenAt = frozenCell(columnIndex);
              return [
                <Table.Td
                  key={column.key}
                  className={[classes.recordCell, frozenAt.className].join(" ")}
                  style={frozenAt.style}
                >
                  <MarkedItem
                    slot={columnIndex === 0}
                    tone={
                      columnIndex === 0 && recordDraft(draft) !== undefined
                        ? "live"
                        : undefined
                    }
                  >
                    <MarkedItem
                      tone={
                        wholeCellDraft(draft, column) === undefined
                          ? undefined
                          : "live"
                      }
                    >
                      <MarkedItem
                        tone={
                          liveWarning(column) === undefined
                            ? undefined
                            : "warning"
                        }
                        words={liveWarning(column)?.words}
                        spoken={liveWarning(column)?.spoken}
                        empty={
                          standIn === undefined &&
                          isEmpty(column.value(liveRecord))
                        }
                      >
                        {standIn === undefined ? (
                          // Drawn only under a record whose draft changes it, which the
                          // table gives a live record for.
                          <ColouredName
                            colour={
                              isEmpty(liveShown)
                                ? null
                                : (liveColumn(column).colour?.(liveRecord) ??
                                  null)
                            }
                          >
                            {(
                              liveColumn(column).liveContent ??
                              liveColumn(column).content
                            )?.(liveRecord) ??
                              liveContent(liveColumn(column), liveShown)}
                          </ColouredName>
                        ) : (
                          <Text component="span" inherit c="dimmed" fs="italic">
                            {standIn}
                          </Text>
                        )}
                      </MarkedItem>
                    </MarkedItem>
                  </MarkedItem>
                </Table.Td>,
                liveCellBeside(row.record, column, columnIndex),
              ];
            })}
            {withActions && <Table.Td className={classes.recordCell} />}
          </Table.Tr>
        ),
      table.totals !== undefined &&
        runEnded !== undefined &&
        totalRow(`total-${key}`, table.totals, table.totals.label, runEnded),
    ];
  });
  return {
    totalRow,
    bodyRows,
  };
}
