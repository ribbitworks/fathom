// SPDX-License-Identifier: Apache-2.0

// A column's header in the shared table: its name and marks, its menu, and moving, freezing and
// sizing the column.

import { Menu, Table } from "@mantine/core";
import type { DragEvent } from "react";
import { AppMenu } from "./app-menu.tsx";
import {
  approveTurnedOff,
  HeldNote,
  MenuDraftLines,
  MenuTitle,
  ReasonedItem,
  UnpublishedNote,
} from "./draft-details.tsx";
import {
  type DraftSelection,
  decidable,
  mayDecide,
  noDrafts,
} from "./drafts.ts";
import { focusSoon } from "./focus.ts";
import { frozenAfterMove } from "./frozen-columns.ts";
import { breaksDown } from "./grid-columns.tsx";
import { fieldDraftLines } from "./grid-drafts.ts";
import type { EditingGrid } from "./grid-editing.tsx";
import { Icon } from "./icons.tsx";
import { draftOffer, offersDraft } from "./menu-offer.ts";
import { shortcutsFor } from "./menu-shortcuts.ts";
import classes from "./pages.module.css";
import { CopyLinkItem } from "./record-key.tsx";
import type { Column, GridRecord } from "./record-table.ts";
import { ResizeEdge } from "./resize-edge.tsx";
import { AllTick } from "./row-ticks.tsx";
import { DraftedItem, LiveLine } from "./status-mark.tsx";
import {
  ColumnViewItems,
  FilterPopover,
  HeaderMarks,
  headerState,
} from "./table-controls.tsx";
import { type View, orderAfterMove, withHidden } from "./table-view.ts";

const headerId = (column: { key: string }) => `${column.key}-heading`;
// The line saying who holds a column, which describes the items it turns off.
const heldNoteId = (fieldId: string) => `${fieldId}-held`;

const shortcuts = shortcutsFor(navigator.userAgent);

// How Shift, Alt and an arrow key change a column's width from its header: a step wider or
// narrower.
const widthSteps: Readonly<Record<string, number>> = {
  ArrowRight: 1,
  ArrowLeft: -1,
};

// How a column is sorted, as assistive technology reads it.
// Only the first level of a sort is marked, as a table has one sorted column for assistive technology;
// the header's name gives every level.
function ariaSort(view: View, key: string) {
  const [first] = view.sort;
  if (first?.key !== key) return undefined;
  return first.descending ? "descending" : "ascending";
}

// Where a dragged column should go, by key: just after another, or at the start. Undefined when it
// stays where it is.
export function droppedAfter(
  keys: readonly string[],
  moved: string,
  onto: string,
): string | null | undefined {
  const from = keys.indexOf(moved);
  const to = keys.indexOf(onto);
  if (from === -1 || to === -1 || from === to) return undefined;
  const others = keys.filter((key) => key !== moved);
  const at = others.indexOf(onto) + (to > from ? 1 : 0);
  return others[at - 1] ?? null;
}

export function columnHeaders<Rec extends GridRecord, Change, Request>(
  grid: Pick<
    EditingGrid<Rec, Change, Request>,
    | "everyone"
    | "table"
    | "draftedFields"
    | "tableOrder"
    | "lists"
    | "canEditColumns"
    | "actions"
    | "onView"
    | "ticks"
    | "allColumns"
    | "columns"
    | "liveOnly"
    | "view"
    | "approves"
    | "decidedBy"
    | "renamedFrom"
    | "columnTint"
    | "tickedShown"
    | "dragging"
    | "setDragging"
    | "filtering"
    | "setFiltering"
    | "keys"
    | "frozenAsked"
    | "frozen"
    | "linkedAtFirst"
    | "frozenCell"
    | "frozenView"
    | "freeze"
    | "widths"
  >,
) {
  const {
    everyone,
    table,
    draftedFields,
    tableOrder,
    lists,
    canEditColumns,
    actions,
    onView,
    ticks,
    allColumns,
    columns,
    liveOnly,
    view,
    approves,
    decidedBy,
    renamedFrom,
    columnTint,
    tickedShown,
    dragging,
    setDragging,
    filtering,
    setFiltering,
    keys,
    frozenAsked,
    frozen,
    linkedAtFirst,
    frozenCell,
    frozenView,
    freeze,
    widths,
  } = grid;
  const moveColumn = (from: number, to: number) => {
    // From every column, those drafted to be removed included, so a column not shown keeps its
    // place.
    const startKeys = table
      .columnsFor(draftedFields, lists, tableOrder, everyone)
      .map(({ key }) => key);
    const ownOrder = [
      ...startKeys,
      ...tableOrder.filter((key) => !startKeys.includes(key)),
    ];
    onView({
      ...view,
      order: orderAfterMove(keys, from, to, ownOrder, view.order),
      frozen: frozenView(frozenAfterMove(frozenAsked, from, to)),
    });
  };

  // A column's heading goes, so the one taking its place, or else the one before, takes the focus.
  const focusBeside = (index: number) => {
    focusSoon(
      ...[
        ...columns.slice(index + 1, index + 2),
        ...columns.slice(index - 1, index),
      ].map(headerId),
    );
  };

  const moveColumnBy = (column: Column<Rec, Change>, step: -1 | 1) => {
    const index = keys.indexOf(column.key);
    const to = index + step;
    if (to < 0 || to >= keys.length) return;
    moveColumn(index, to);
    focusSoon(headerId(column));
  };

  const onDrop = (event: DragEvent, onto: Column<Rec, Change>) => {
    event.preventDefault();
    const moved = columns.find(({ key }) => key === dragging);
    setDragging(undefined);
    if (moved === undefined) return;
    const after = droppedAfter(keys, moved.key, onto.key);
    if (after === undefined) return;
    const others = keys.filter((key) => key !== moved.key);
    moveColumn(
      keys.indexOf(moved.key),
      after === null ? 0 : others.indexOf(after) + 1,
    );
  };
  const header = (column: Column<Rec, Change>, index: number) => {
    const { field } = column;
    const ownClass = field?.visibility ?? null;
    const ownWaiting = field !== undefined && decidable(field);
    // Someone else's unpublished changes to the column hold it.
    const changesColumn = canEditColumns && field?.heldBy === undefined;
    const deciding: DraftSelection = {
      ...noDrafts(),
      columns: ownWaiting ? [field.id] : [],
    };
    // A rejected draft is back with its makers until they send it again, so it isn't decided.
    const columnOffer = draftOffer({
      hasDraft: field?.draft !== undefined,
      rejected: field?.draft?.state === "rejected",
      unpublished: field?.draft?.unpublished === true,
      editsDraft: changesColumn,
      discardable: field?.draft?.discardable === true,
      decides: ownWaiting && mayDecide(approves, deciding, decidedBy),
      publishes: false,
    });
    const dragProps = {
      draggable: true,
      // A press on the column's edge resizes it, which the browser would otherwise take as
      // dragging the whole header.
      onDragStart: (event: DragEvent) => {
        if (widths.resizing()) {
          event.preventDefault();
          return;
        }
        setDragging(column.key);
      },
      onDragOver: (event: DragEvent) => {
        event.preventDefault();
      },
      onDrop: (event: DragEvent) => {
        onDrop(event, column);
      },
    };
    const headerMenu = (
      <FilterPopover
        // A column is never empty only where every kind of record needs a value in it.
        column={{
          ...column,
          required:
            column.required &&
            column.requiredOn === undefined &&
            column.offeredOn === undefined,
        }}
        view={view}
        onView={onView}
        opened={filtering === column.key}
        onClose={() => {
          // Focus goes back to the column's header, not to the menu the filter was opened from.
          setFiltering(undefined);
          focusSoon(headerId(column));
        }}
      >
        <AppMenu
          // The menu sets its button's id from its own, overriding one given to the button.
          id={headerId(column)}
          position="bottom-start"
          withinPortal
          hideDetached={false}
          defaultOpened={column.key === linkedAtFirst}
        >
          <AppMenu.Target>
            <button
              type="button"
              className={classes.recordHeadButton}
              aria-label={`${column.label} column${headerState(column, view)}`}
              onKeyDown={(event) => {
                const step = widthSteps[event.key];
                if (event.altKey && event.shiftKey && step !== undefined) {
                  event.preventDefault();
                  widths.step(column.key, index, step);
                  return;
                }
                if (!event.altKey) return;
                if (event.key === "ArrowLeft") {
                  event.preventDefault();
                  moveColumnBy(column, -1);
                } else if (event.key === "ArrowRight") {
                  event.preventDefault();
                  moveColumnBy(column, 1);
                }
              }}
            >
              <span className={classes.headerNames}>
                <span className={classes.headerName}>
                  <DraftedItem
                    slot={index === 0}
                    draft={
                      draftedFields.find(({ id }) => id === field?.id)?.draft
                    }
                    heldBy={field?.heldBy}
                    dataClass={column.dataClass}
                  >
                    <span className={classes.headerLabel}>{column.label}</span>
                  </DraftedItem>
                </span>
                {renamedFrom(column) !== undefined && (
                  <LiveLine>{renamedFrom(column)}</LiveLine>
                )}
              </span>
              <HeaderMarks column={column} view={view} />
            </button>
          </AppMenu.Target>
          <AppMenu.Dropdown>
            <MenuTitle>{column.label}</MenuTitle>
            {field !== undefined && (
              <>
                <CopyLinkItem
                  record={{ kind: "column", keyNumber: field.keyNumber }}
                />
                <Menu.Divider />
              </>
            )}
            {field?.heldBy !== undefined && !liveOnly && (
              <HeldNote by={field.heldBy} id={heldNoteId(field.id)} />
            )}
            {field?.draft?.unpublished === true && !liveOnly && (
              <UnpublishedNote />
            )}
            {field?.draft && !liveOnly && (
              <>
                <MenuDraftLines
                  draft={field.draft}
                  lines={fieldDraftLines(field, lists)}
                  divider={offersDraft(columnOffer)}
                />
                {columnOffer.decide && (
                  <>
                    <ReasonedItem
                      reason={approveTurnedOff({
                        othersApprove: field.draft.needsOtherApprover === true,
                      })}
                      onClick={() => {
                        actions.decide("approve", deciding);
                      }}
                    >
                      Approve…
                    </ReasonedItem>
                    <Menu.Item
                      onClick={() => {
                        actions.decide("reject", deciding);
                      }}
                    >
                      Reject…
                    </Menu.Item>
                  </>
                )}
                {columnOffer.resubmit && (
                  <Menu.Item
                    onClick={() => {
                      actions.resubmitColumn(field.id);
                    }}
                  >
                    Resubmit
                  </Menu.Item>
                )}
                {columnOffer.discard && (
                  <Menu.Item
                    onClick={() => {
                      actions.discardColumn(field.id, field.name);
                    }}
                  >
                    Discard draft
                  </Menu.Item>
                )}
                <Menu.Divider />
              </>
            )}
            <ColumnViewItems
              column={column}
              view={view}
              onView={onView}
              onFilter={() => {
                setFiltering(column.key);
              }}
              breaksDown={breaksDown(column)}
              units={column.units}
            />
            <Menu.Divider />
            {index + 1 !== frozenAsked && (
              <Menu.Item
                leftSection={<Icon name="freeze" />}
                disabled={frozen.fits.at(index) !== true}
                onClick={() => {
                  freeze(index + 1);
                }}
              >
                Freeze up to this column
              </Menu.Item>
            )}
            {frozenAsked > 0 && (
              <Menu.Item
                onClick={() => {
                  freeze(0);
                }}
              >
                Unfreeze columns
              </Menu.Item>
            )}
            <Menu.Item
              rightSection={<kbd>{shortcuts.wider}</kbd>}
              disabled={!widths.canWiden(column.key, index)}
              onClick={() => {
                widths.step(column.key, index, 1);
              }}
            >
              Wider
            </Menu.Item>
            <Menu.Item
              rightSection={<kbd>{shortcuts.narrower}</kbd>}
              disabled={!widths.canNarrow(column.key, index)}
              onClick={() => {
                widths.step(column.key, index, -1);
              }}
            >
              Narrower
            </Menu.Item>
            {widths.setWidthOf(column.key) !== undefined && (
              <Menu.Item
                onClick={() => {
                  widths.reset(column.key);
                }}
              >
                Reset width
              </Menu.Item>
            )}
            <Menu.Item
              rightSection={<kbd>{shortcuts.left}</kbd>}
              onClick={() => {
                moveColumnBy(column, -1);
              }}
            >
              Move left
            </Menu.Item>
            <Menu.Item
              rightSection={<kbd>{shortcuts.right}</kbd>}
              onClick={() => {
                moveColumnBy(column, 1);
              }}
            >
              Move right
            </Menu.Item>
            {column.key !== table.nameColumn && (
              <Menu.Item
                onClick={() => {
                  onView(withHidden(view, allColumns, [column.key], true));
                  focusBeside(index);
                }}
              >
                Hide column
              </Menu.Item>
            )}
            {changesColumn && field && field.draft?.action !== "deleted" && (
              <>
                <Menu.Divider />
                <Menu.Item
                  onClick={() => {
                    actions.editColumn(field);
                  }}
                >
                  Edit column…
                </Menu.Item>
                {actions.removeColumn && (
                  <Menu.Item
                    color="red"
                    onClick={() => {
                      actions.removeColumn?.(field);
                      focusBeside(index);
                    }}
                  >
                    Remove column
                  </Menu.Item>
                )}
              </>
            )}
            {field &&
              actions.moveColumnClass &&
              (changesColumn || field.draft?.action !== "created") &&
              field.draft?.action !== "deleted" && (
                <>
                  <Menu.Divider />
                  {ownClass === null ? (
                    <ReasonedItem reason="This column takes its list's class">
                      Change class…
                    </ReasonedItem>
                  ) : (
                    <ReasonedItem
                      describedBy={
                        field.heldBy === undefined
                          ? undefined
                          : heldNoteId(field.id)
                      }
                      onClick={() => {
                        actions.moveColumnClass?.(field, ownClass);
                      }}
                    >
                      Change class…
                    </ReasonedItem>
                  )}
                </>
              )}
          </AppMenu.Dropdown>
        </AppMenu>
      </FilterPopover>
    );
    const frozenAt = frozenCell(index);
    return (
      <Table.Th
        key={column.key}
        scope="col"
        aria-sort={ariaSort(view, column.key)}
        className={[columnTint(column), frozenAt.className].join(" ")}
        style={frozenAt.style}
        data-column={column.key}
        aria-current={column.current === true ? "date" : undefined}
        data-centred={column.headingCentred === true ? "" : undefined}
        {...dragProps}
      >
        {index === 0 && ticks !== undefined && tickedShown !== undefined ? (
          <span className={classes.tickedHead}>
            <AllTick
              label={ticks.allLabel}
              ticked={tickedShown.ticked.length}
              tickable={tickedShown.tickable.length}
              onChange={(on) => {
                ticks.onTick(
                  tickedShown.tickable.map(({ id }) => id),
                  on,
                );
              }}
            />
            {headerMenu}
          </span>
        ) : (
          headerMenu
        )}
        <ResizeEdge
          className={classes.columnEdge}
          {...widths.edge(column.key, index)}
        />
      </Table.Th>
    );
  };
  return {
    header,
  };
}

export type HeaderGrid<Rec extends GridRecord, Change, Request> = EditingGrid<
  Rec,
  Change,
  Request
> &
  ReturnType<typeof columnHeaders<Rec, Change, Request>>;
