// SPDX-License-Identifier: Apache-2.0

// A row's menu in the shared table, from its ⋯ buttons or a right-click, the controls over its Name
// cell, and the same menu's items for the ⋯ in the record's details panel.

import { Menu } from "@mantine/core";
import type { MouseEvent, ReactNode } from "react";
import {
  MenuAtPoint,
  clickedPoint,
  closesOnBlankClick,
  noPoint,
} from "./app-menu.tsx";
import {
  approveTurnedOff,
  draftLines,
  HeldNote,
  MenuDraftLines,
  MenuTitle,
  ReasonedItem,
  UnpublishedNote,
} from "./draft-details.tsx";
import { type DraftSelection, draftTotal, noDrafts } from "./drafts.ts";
import { kindOf } from "./grid-columns.tsx";
import { isPending } from "./grid-drafts.ts";
import type { SavingGrid } from "./grid-saving.ts";
import type { MoreButtonPlace, NewRow, Row } from "./grid-places.ts";
import type { PublishDraft } from "./publish-draft.tsx";
import {
  type MenuPlace,
  menuPlace,
  offersAny,
  offersOwn,
  recordMenuOffer,
} from "./menu-offer.ts";
import type { DraftOf, GridRecord } from "./record-table.ts";
import { MoreButton, RowControls, actionsFor } from "./row-controls.tsx";

const draftItemLabel = (verb: string, of: string | undefined) => {
  const draft = of === undefined ? "draft" : `${of}'s draft`;
  return `${verb} ${draft}…`;
};

export function rowMenus<Rec extends GridRecord, Change, Request>(
  grid: Pick<
    SavingGrid<Rec, Change, Request>,
    | "table"
    | "lists"
    | "rowActions"
    | "actions"
    | "fields"
    | "columns"
    | "ownDraftOf"
    | "ownSelectionOf"
    | "approvesInMenu"
    | "decidedInMenu"
    | "mayChange"
    | "hasMenu"
    | "decidesOwnDraft"
    | "ownItemsOf"
    | "rowKind"
    | "menuFor"
    | "setMenuFor"
    | "pointedAt"
    | "setPointedAt"
    | "records"
    | "rows"
    | "rowKey"
    | "activeNow"
    | "moveTo"
    | "clearable"
    | "clearNewRow"
    | "selected"
    | "closeSelected"
  > & {
    // How the user publishes their own draft, where they can.
    publishDraft: PublishDraft | undefined;
  },
) {
  const {
    table,
    lists,
    rowActions,
    actions,
    fields,
    columns,
    ownDraftOf,
    ownSelectionOf,
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
    records,
    rows,
    rowKey,
    activeNow,
    moveTo,
    clearable,
    clearNewRow,
    selected,
    closeSelected,
    publishDraft,
  } = grid;
  // Whether a row has a menu: a record with anything in it to offer, or a new row with something in
  // it to clear.
  const hasRowMenu = (row: Row<Rec>) =>
    row.newRow ? clearable(row.newRow) : hasMenu(row.record);

  // Which draft items a record's menu offers, and whether it offers removing the record.
  const offerOf = (record: Rec) =>
    recordMenuOffer({
      ownDraft: ownDraftOf(record),
      shownAction: record.draft?.action,
      changes: rowActions && mayChange(record) && record.heldBy === undefined,
      removable: table.removable?.(record) ?? true,
      editsOwnDraft: decidesOwnDraft(record),
      decides: decidedInMenu(record) !== undefined,
      publishes: publishDraft !== undefined,
    });

  // The user's own draft of a record, as publishing names it: by the record it is of, where the
  // page says, or else as the table names the record's own draft.
  const publishedOf = (record: Rec, draft: DraftOf<Rec>): DraftSelection =>
    actions.draftRef === undefined
      ? ownSelectionOf(record)
      : { ...noDrafts(), records: [actions.draftRef(record, draft)] };

  // What a record's menu offers to do with it, the same from its row and from its details panel:
  // following its links, the table's own items, deciding its draft, then the user's own draft and
  // removing the record. From its row, focus goes back to the table once an item changes it, as it
  // does from the panel once the record is gone, its draft having added it.
  const recordActionItems = (record: Rec, place: MenuPlace) => {
    const ownDraft = ownDraftOf(record);
    const ownItems = ownItemsOf(record, place);
    const deciding = decidedInMenu(record);
    const decides = table.menuDecides?.(record);
    // A draft keeps needing another approver once rejected, when it is no longer what Approve sends.
    const othersApprove =
      decides === undefined
        ? ownDraft?.state === "waiting" && ownDraft.needsOtherApprover === true
        : draftTotal(decides.approved) === 0;
    const offer = offerOf(record);
    const removeTurnedOff = offer.remove
      ? table.removeTurnedOff?.(record)
      : undefined;
    // Back to the row whose menu it was, in the active column, or, where that row is gone or the
    // menu was the panel's, to the active cell.
    const backToTable = (recordLeaves = false) => {
      if (!menuPlace(place).backToTable && !recordLeaves) return;
      const active = activeNow();
      const ownRow = rows.findIndex((row) =>
        menuFor === undefined
          ? row.record?.id === record.id
          : rowKey(row) === menuFor.key,
      );
      moveTo(ownRow < 0 || recordLeaves ? active.row : ownRow, active.column);
    };
    return (
      <>
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
            <ReasonedItem
              reason={approveTurnedOff({ othersApprove })}
              onClick={() => {
                actions.decide("approve", decides?.approved ?? deciding);
              }}
            >
              {draftItemLabel("Approve", decides?.approvedOf)}
            </ReasonedItem>
            <Menu.Item
              onClick={() => {
                actions.decide("reject", deciding);
              }}
            >
              {draftItemLabel("Reject", decides?.rejectedOf)}
            </Menu.Item>
          </>
        )}
        {offersOwn(offer) && (
          <>
            {(deciding !== undefined || ownItems.length > 0) && (
              <Menu.Divider />
            )}
            {ownDraft !== undefined &&
              publishDraft !== undefined &&
              offer.publish && (
                <Menu.Item
                  onClick={() => {
                    publishDraft(
                      publishedOf(record, ownDraft),
                      menuPlace(place).backToTable ? backToTable : undefined,
                    );
                    backToTable();
                  }}
                >
                  Publish draft…
                </Menu.Item>
              )}
            {ownDraft !== undefined && offer.resubmit && (
              <Menu.Item
                onClick={() => {
                  actions.resubmit(record, ownDraft);
                }}
              >
                Resubmit
              </Menu.Item>
            )}
            {ownDraft !== undefined && offer.discard && (
              <Menu.Item
                onClick={() => {
                  actions.discard(record, ownDraft);
                  backToTable(ownDraft.action === "created");
                }}
              >
                Discard draft
              </Menu.Item>
            )}
            {offer.remove && (
              <>
                <ReasonedItem
                  color="red"
                  reason={removeTurnedOff}
                  onClick={() => {
                    actions.remove(record);
                    backToTable();
                  }}
                >
                  {table.removeLabel(record)}
                </ReasonedItem>
              </>
            )}
          </>
        )}
      </>
    );
  };

  // A record's row menu: whose it is, who holds it, and its draft in words, then what it offers.
  const recordMenuItems = (record: Rec) => {
    const draft = record.draft as DraftOf<Rec> | undefined;
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
              decidedInMenu(record) !== undefined ||
              ownItemsOf(record).length > 0
            }
          />
        )}
        {recordActionItems(record, "row")}
      </>
    );
  };

  // What a record's details panel offers in its menu, or none when it offers nothing.
  const panelMenuItems = (id: string) => {
    const record = records.find((one) => one.id === id);
    return record !== undefined &&
      !isPending(record) &&
      (ownItemsOf(record, "panel").length > 0 || offersAny(offerOf(record)))
      ? recordActionItems(record, "panel")
      : undefined;
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

  // The controls over a row's Name cell: its details' button, which closes the details when they
  // are open, and its menu's ⋯, where it has them.
  const nameCellControls = (row: Row<Rec>) => {
    const { record } = row;
    const { showDetails } = table;
    const open = record?.id === selected;
    const details =
      record && showDetails !== undefined && !isPending(record)
        ? {
            name: table.nameOf(record),
            open,
            onShow: () => {
              if (open && closeSelected !== undefined) closeSelected(record.id);
              else showDetails(record);
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
    panelMenuItems,
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
