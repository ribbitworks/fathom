// SPDX-License-Identifier: Apache-2.0

// A row's menu in the shared table, from its ⋯ buttons or a right-click, and the controls over its
// Name cell.

import { Menu } from "@mantine/core";
import type { MouseEvent, ReactNode } from "react";
import {
  MenuAtPoint,
  clickedPoint,
  closesOnBlankClick,
  noPoint,
} from "./app-menu.tsx";
import {
  HeldNote,
  MenuDraftLines,
  MenuTitle,
  OtherApproverNote,
  UnpublishedNote,
  draftLines,
} from "./draft-details.tsx";
import { draftTotal } from "./drafts.ts";
import { kindOf } from "./grid-columns.tsx";
import { isPending } from "./grid-drafts.ts";
import type { SavingGrid } from "./grid-saving.ts";
import type { MoreButtonPlace, NewRow, Row } from "./grid-places.ts";
import type { DraftOf, GridRecord } from "./record-table.ts";
import { MoreButton, RowControls, actionsFor } from "./row-controls.tsx";

const draftItemLabel = (verb: string, of: string | undefined) => {
  const draft = of === undefined ? "draft" : `${of}'s draft`;
  return `${verb} ${draft}…`;
};

export function rowMenus<Rec extends GridRecord, Change, Request>(
  grid: SavingGrid<Rec, Change, Request>,
) {
  const {
    table,
    lists,
    rowActions,
    actions,
    fields,
    columns,
    ownDraftOf,
    approvesInMenu,
    decidedInMenu,
    mayChange,
    hasMenu,
    decidesOwnDraft,
    ownItemsOf,
    rowKind,
    menuFor,
    setMenuFor,
    pointedAt,
    setPointedAt,
    rows,
    rowKey,
    active,
    moveTo,
    clearable,
    clearNewRow,
  } = grid;
  // Whether a row has a menu: a record with anything in it to offer, or a new row with something in
  // it to clear.
  const hasRowMenu = (row: Row<Rec>) =>
    row.newRow ? clearable(row.newRow) : hasMenu(row.record);

  const recordMenuItems = (record: Rec) => {
    const draft = record.draft as DraftOf<Rec> | undefined;
    const ownDraft = ownDraftOf(record);
    const ownItems = ownItemsOf(record);
    const changes =
      rowActions && mayChange(record) && record.heldBy === undefined;
    const draftItems = changes || decidesOwnDraft(record);
    const deciding = decidedInMenu(record);
    const decides = table.menuDecides?.(record);
    // A draft keeps needing another approver once rejected, when it is no longer what Approve sends.
    const othersApprove =
      decides === undefined
        ? ownDraft?.state === "waiting" && ownDraft.needsOtherApprover === true
        : draftTotal(decides.approved) === 0;
    const removes =
      changes && draft?.action !== "created" && draft?.action !== "deleted";
    return (
      <>
        {/* Names whose menu it is, and gives every menu somewhere to click that closes it. */}
        <MenuTitle>{table.nameOf(record)}</MenuTitle>
        {/* Who holds the record matters only to those who may change or decide it. */}
        {record.heldBy !== undefined &&
          (mayChange(record) || approvesInMenu(record)) && (
            <HeldNote by={record.heldBy} />
          )}
        {draft?.unpublished === true && <UnpublishedNote />}
        {draft && (
          <MenuDraftLines
            draft={draft}
            lines={[
              ...(table.draftSubject === undefined
                ? []
                : [[table.draftSubject(record)]]),
              ...draftLines(
                draft,
                table.draftFields(record, draft, fields, lists),
              ),
            ]}
            // Set apart from the items after it, when any are offered.
            divider={
              (mayChange(record) && record.heldBy === undefined) ||
              decidesOwnDraft(record) ||
              deciding !== undefined ||
              ownItems.length > 0
            }
          />
        )}
        {columns.map((column) => {
          const { MenuItem } = kindOf(column);
          return (
            MenuItem && (
              <MenuItem
                key={column.key}
                name={column.label}
                value={column.value(record)}
              />
            )
          );
        })}
        {ownItems}
        {/* A rejected draft is back with its makers, until they send it again. */}
        {deciding !== undefined && (
          <>
            {ownItems.length > 0 && <Menu.Divider />}
            <Menu.Item
              disabled={othersApprove}
              onClick={() => {
                actions.decide("approve", decides?.approved ?? deciding);
              }}
            >
              {draftItemLabel("Approve", decides?.approvedOf)}
            </Menu.Item>
            {othersApprove && <OtherApproverNote />}
            <Menu.Item
              onClick={() => {
                actions.decide("reject", deciding);
              }}
            >
              {draftItemLabel("Reject", decides?.rejectedOf)}
            </Menu.Item>
          </>
        )}
        {draftItems && (ownDraft !== undefined || removes) && (
          <>
            {(deciding !== undefined || ownItems.length > 0) && (
              <Menu.Divider />
            )}
            {ownDraft?.state === "rejected" && (
              <Menu.Item
                onClick={() => {
                  actions.resubmit(record, ownDraft);
                }}
              >
                Resubmit
              </Menu.Item>
            )}
            {ownDraft && (
              <Menu.Item
                onClick={() => {
                  actions.discard(record, ownDraft);
                  moveTo(active.row, active.column);
                }}
              >
                Discard draft
              </Menu.Item>
            )}
            {removes && (
              <Menu.Item
                color="red"
                onClick={() => {
                  actions.remove(record);
                  moveTo(active.row, active.column);
                }}
              >
                {table.removeLabel(record)}
              </Menu.Item>
            )}
          </>
        )}
      </>
    );
  };

  const newRowMenuItems = (newRow: NewRow) => (
    <>
      <MenuTitle>{table.newRowLabel(rowKind({ newRow }))}</MenuTitle>
      <Menu.Item
        onClick={() => {
          clearNewRow(newRow);
        }}
      >
        Clear row
      </Menu.Item>
    </>
  );

  const rowMenuItems = (row: Row<Rec>) =>
    row.newRow ? newRowMenuItems(row.newRow) : recordMenuItems(row.record);

  // The menu of the row keyed, opened from its ⋯ at the place given.
  const rowMenu = (
    key: string,
    place: MoreButtonPlace,
    target: ReactNode,
    items: ReactNode,
  ) => (
    <Menu
      opened={
        menuFor !== undefined && menuFor.key === key && menuFor.place === place
      }
      onChange={(opened) => {
        setMenuFor(opened ? { key, place } : undefined);
      }}
      position="bottom-end"
      withinPortal
      hideDetached={false}
    >
      <Menu.Target>{target}</Menu.Target>
      <Menu.Dropdown
        onClick={closesOnBlankClick(() => {
          setMenuFor(undefined);
        })}
      >
        {items}
      </Menu.Dropdown>
    </Menu>
  );

  // A row's ⋯, at its end or over its Name cell, both opening its menu.
  const rowMoreButton = (row: Row<Rec>) => (
    <MoreButton
      label={actionsFor(
        row.record
          ? table.nameOf(row.record)
          : table.newRowLabel(rowKind(row)).toLowerCase(),
      )}
      size="sm"
      // Tab moves between cells; the menu also opens with Shift+F10 on any of the row's cells.
      tabIndex={-1}
    />
  );

  // The controls over a row's Name cell: its details' button and its menu's ⋯, where it has them.
  const nameCellControls = (row: Row<Rec>) => {
    const { record } = row;
    const { showDetails } = table;
    const details =
      record && showDetails !== undefined && !isPending(record)
        ? {
            name: table.nameOf(record),
            onShow: () => {
              showDetails(record);
            },
          }
        : undefined;
    const menu =
      hasRowMenu(row) &&
      rowMenu(rowKey(row), "name", rowMoreButton(row), rowMenuItems(row));
    return (
      (details !== undefined || menu !== false) && (
        <RowControls details={details} menu={menu} />
      )
    );
  };

  // The menu of the row last right-clicked, beside the pointer, drawn before any right-click.
  const pointerMenu = () => {
    const { key, place } = pointedAt ?? { key: "", place: noPoint };
    const row = rows.find((one) => rowKey(one) === key);
    return (
      <MenuAtPoint
        at={place}
        opened={menuFor?.key === key && menuFor.place === place}
        onClose={() => {
          setMenuFor(undefined);
        }}
      >
        {row !== undefined && rowMenuItems(row)}
      </MenuAtPoint>
    );
  };

  // A right-click on a row opens its menu beside the pointer, except in a field being typed in,
  // which keeps the browser's own, and in the row's menus, drawn elsewhere, whose clicks still reach
  // the row.
  const onRowContextMenu = (event: MouseEvent, row: Row<Rec>) => {
    const target = event.target as HTMLElement;
    if (
      !hasRowMenu(row) ||
      !event.currentTarget.contains(target) ||
      target.closest("input, textarea") !== null
    ) {
      return;
    }
    event.preventDefault();
    const opened = { key: rowKey(row), place: clickedPoint(event) };
    setPointedAt(opened);
    setMenuFor(opened);
  };
  return {
    hasRowMenu,
    rowMenuItems,
    rowMenu,
    rowMoreButton,
    nameCellControls,
    pointerMenu,
    onRowContextMenu,
  };
}

export type MenuGrid<Rec extends GridRecord, Change, Request> = SavingGrid<
  Rec,
  Change,
  Request
> &
  ReturnType<typeof rowMenus<Rec, Change, Request>>;
