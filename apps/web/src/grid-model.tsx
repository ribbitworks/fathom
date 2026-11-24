// SPDX-License-Identifier: Apache-2.0

// The shared table's columns and records as the view and the Draft menu show them, and what the
// user's role may do with each record.

import { type Field, draftFilterKey } from "@fathom/shared";
import { Menu } from "@mantine/core";
import { type ReactNode, useMemo } from "react";
import {
  type DraftSelection,
  decidable,
  mayDecide,
  noDrafts,
} from "./drafts.ts";
import {
  afterName,
  breaksDown,
  inOrder,
  inViewUnits,
  keyColumn,
  keyColumnKey,
  shown,
} from "./grid-columns.tsx";
import {
  changedIn,
  draftColumn,
  headingOnly,
  heldBack,
  isPending,
  liveName,
} from "./grid-drafts.ts";
import type { Row } from "./grid-places.ts";
import { liveLists } from "./lists.ts";
import { liveFields, recordsAsShown, shownSchema } from "./live-records.ts";
import classes from "./pages.module.css";
import { CopyLinkItem } from "./record-key.tsx";
import { type MenuPlace, menuPlace } from "./menu-offer.ts";
import type {
  Column,
  DraftOf,
  GridDraft,
  GridRecord,
  RecordGridProps,
} from "./record-table.ts";
import { besideLive } from "./status-mark.tsx";
import { recordMark } from "./draft-marks.ts";
import {
  type View,
  alwaysShowing,
  filtersBesideColumns,
  knownView,
  shownColumnsOf,
  withoutFilters,
} from "./table-view.ts";

const withoutDraftFilter = (view: View): View =>
  withoutFilters(view, (key) => key !== draftFilterKey);

export function gridProps<Rec extends GridRecord, Change, Request>({
  records: everyone,
  table,
  fields: draftedFields,
  order: tableOrder,
  lists,
  canEdit: mayEdit,
  canAdd = true,
  rowActions = true,
  canEditDrafts: mayEditDrafts = false,
  approves: mayApprove = [],
  saving = false,
  canEditColumns,
  actions,
  view: given,
  onView,
  saved,
  opensAtColumn,
  linkedColumn,
  withDrafts = true,
  columnBorders = false,
  panels = [],
  viewChoices,
  count,
  pageParts,
  above,
  body,
  ticks,
}: RecordGridProps<Rec, Change, Request>) {
  return {
    everyone,
    table,
    draftedFields,
    tableOrder,
    lists,
    mayEdit,
    canAdd,
    rowActions,
    mayEditDrafts,
    mayApprove,
    saving,
    canEditColumns,
    actions,
    given,
    onView,
    saved,
    opensAtColumn,
    linkedColumn,
    withDrafts,
    columnBorders,
    panels,
    viewChoices,
    count,
    pageParts,
    above,
    body,
    ticks,
  };
}

export type GridProps<Rec extends GridRecord, Change, Request> = ReturnType<
  typeof gridProps<Rec, Change, Request>
>;

export function useGridModel<Rec extends GridRecord, Change, Request>(
  grid: Pick<
    GridProps<Rec, Change, Request>,
    | "everyone"
    | "table"
    | "draftedFields"
    | "tableOrder"
    | "lists"
    | "mayEdit"
    | "rowActions"
    | "mayEditDrafts"
    | "mayApprove"
    | "given"
    | "withDrafts"
  >,
) {
  const {
    everyone,
    table,
    draftedFields,
    tableOrder,
    lists,
    mayEdit,
    rowActions,
    mayEditDrafts,
    mayApprove,
    given,
    withDrafts,
  } = grid;
  // An address may ask for drafts of a table that has none.
  const asked = withDrafts
    ? given
    : { ...withoutDraftFilter(given), show: "both" as const };
  const applied = asked.show === "drafts";
  const { fields, lists: listsShown } = shownSchema(
    asked.show,
    draftedFields,
    lists,
  );
  const order = asked.order ?? tableOrder;
  // A table whose records have keys gets the Key column, made again only when they change.
  const { keyOf } = table;
  const madeKeyColumn = useMemo(
    () => keyOf && keyColumn<Rec, Change>(keyOf, everyone),
    [keyOf, everyone],
  );
  const withKey = (made: Column<Rec, Change>[]) =>
    madeKeyColumn === undefined
      ? made
      : afterName(made, ({ key }) => key === table.nameColumn, madeKeyColumn);
  // A view's order made before the Key column existed puts it after the name column too.
  const viewOrder = (named: readonly string[]) =>
    madeKeyColumn === undefined || named.includes(keyColumnKey)
      ? named
      : afterName(named, (key) => key === table.nameColumn, keyColumnKey);
  // Not every table starts its columns in the order it is given.
  const inViewOrder = (made: Column<Rec, Change>[]) =>
    asked.order === undefined ? made : inOrder(made, viewOrder(asked.order));
  // The columns with their lists as they are live, for the live records and each live row, so a
  // choice's drafted name is not shown as live.
  const listsLive = liveLists(lists);
  const liveColumns = inViewOrder(
    withKey(
      table.columnsFor(fields, listsLive, order, table.liveRecords(everyone)),
    ),
  ).map((column) => inViewUnits(column, asked));
  // Both are made from the same fields, so every column has its live one.
  const liveColumn = (column: Column<Rec, Change>) =>
    liveColumns.find(({ key }) => key === column.key) as Column<Rec, Change>;
  const allColumns =
    asked.show === "live"
      ? liveColumns
      : inViewOrder(
          withKey(table.columnsFor(fields, listsShown, order, everyone)),
        ).map((column) => inViewUnits(column, asked));
  const knownAsked = knownView(
    asked,
    allColumns,
    filtersBesideColumns(draftColumn, table.barFilters),
    allColumns.filter(breaksDown),
  );
  // The name column, holding each row's controls, is never hidden.
  const known = alwaysShowing(knownAsked, table.nameColumn);
  // A hidden column still filters, sorts and breaks down the rows.
  const columns = shownColumnsOf(known, allColumns);
  // The live records alone are read only, since every change makes a draft they do not show, and
  // have no drafts to filter by.
  const liveOnly = known.show === "live";
  // Nor are rejected drafts shown with the drafts applied, so they are not filtered by either.
  const draftFilter = new Map(Object.entries(known.filters)).get(
    draftFilterKey,
  );
  let view = known;
  if (liveOnly) {
    view = withoutDraftFilter(known);
  } else if (applied && draftFilter?.any !== undefined) {
    view = {
      ...known,
      filters: {
        ...known.filters,
        [draftFilterKey]: {
          ...draftFilter,
          any: draftFilter.any.filter((state) => state !== "rejected"),
        },
      },
    };
  }
  const records = recordsAsShown(known.show, everyone, table.liveRecords);
  // A record's own mark, in its row's slot, unless its draft only changes values the row shows,
  // each marked by its own dot, so the slot would only repeat them.
  const shownKeys = new Set(
    columns.flatMap((column) =>
      column.changesWith === undefined
        ? [column.key]
        : [column.key, column.changesWith],
    ),
  );
  const recordDraft = (draft: GridDraft | undefined) =>
    recordMark(draft, shownKeys);
  // Whether a draft marks its row and cells too, beyond the dot in its slot.
  const marksRows = table.slotMarksOnly !== true;
  // Each record as it is live, made from everyone, since a record's live form can depend on others,
  // such as its live manager's end date.
  const liveById = new Map(
    table.liveRecords(everyone).map((record) => [record.id, record]),
  );
  // Each record's draft, whatever the view, which its marks are worked out from, so the Draft view
  // decides how they show.
  const draftById = new Map(
    everyone.flatMap((record) =>
      record.draft === undefined ? [] : [[record.id, record.draft]],
    ),
  );
  const cellDraftsById = new Map(
    everyone.flatMap((record) =>
      record.cellDrafts === undefined ? [] : [[record.id, record.cellDrafts]],
    ),
  );
  const canEdit = mayEdit && !liveOnly;
  const canEditDrafts = mayEditDrafts !== false && !liveOnly;
  const editsDraftOf = (record: Rec) =>
    canEditDrafts &&
    (typeof mayEditDrafts === "function" ? mayEditDrafts(record) : true);
  const approves = liveOnly ? [] : mayApprove;
  // Whether the user's role approves a record's draft, and those it decides with it.
  const approvesRecord = (record: Rec) =>
    mayDecide(approves, table.drafts([record.id]));
  const decidableRow = (record: Rec) =>
    table.decidable?.(record) ?? decidable(record);
  // The drafts that make a record's own draft, as approving or publishing it names them: on a table
  // whose rows stand for their parts' drafts too, the record's own alone.
  const ownSelectionOf = (record: Rec): DraftSelection => {
    const drafts = table.drafts([record.id]);
    return table.ownDraft === undefined
      ? drafts
      : {
          ...noDrafts(),
          records: drafts.records.filter(({ id }) => id === record.id),
        };
  };
  // The draft a record's menu discards, resubmits, approves or rejects, the drafts approving or
  // rejecting it decides, none on a row standing only for its parts' drafts, and whether it can be
  // decided now. On a table whose rows stand for their parts' drafts too, that is the record's own
  // draft alone, since its parts' drafts are decided where the parts are shown.
  const menuDraftOf = (
    record: Rec,
  ): {
    draft: DraftOf<Rec> | undefined;
    selection: DraftSelection | undefined;
    decidable: boolean;
  } => {
    if (table.ownDraft === undefined) {
      return {
        draft: record.draft,
        selection: ownSelectionOf(record),
        decidable: decidableRow(record),
      };
    }
    const draft = table.ownDraft(record);
    return {
      draft,
      selection: draft === undefined ? undefined : ownSelectionOf(record),
      decidable: decidable({ draft, heldBy: record.heldBy }),
    };
  };
  const ownDraftOf = (record: Rec) => menuDraftOf(record).draft;
  // Whether the user's role approves the drafts a record's menu decides.
  const approvesInMenu = (record: Rec) => {
    const { selection } = menuDraftOf(record);
    return selection !== undefined && mayDecide(approves, selection);
  };
  // What a record's menu offers the user's role to approve or reject, if anything.
  const decidedInMenu = (record: Rec): DraftSelection | undefined => {
    const { selection, decidable: now } = menuDraftOf(record);
    return now && selection !== undefined && mayDecide(approves, selection)
      ? selection
      : undefined;
  };
  // Beside a column whose draft changes what its cells show, the column as it is live, to compare,
  // as a record's live row is shown under their draft. A draft that changes only the column's
  // heading, such as its name, shows the live name under the drafted one instead, since the cells
  // would be the same.
  const fieldsLive = new Map(
    liveFields(draftedFields).map((field) => [field.id, field]),
  );
  const liveCopies = new Map(
    columns.flatMap((column): [string, Column<Rec, Change>][] => {
      const draft = column.field?.draft;
      if (
        view.show !== "both" ||
        draft?.action !== "changed" ||
        draft.changed.every((key) => headingOnly.has(key))
      ) {
        return [];
      }
      // A column only changed by its draft is live.
      const live = fieldsLive.get(column.key) as Field;
      return [
        [
          column.key,
          {
            ...column,
            label: live.name,
            required: live.required,
            multiple: live.multiple,
            // The lists load apart from the records, so may not have caught up yet.
            choices:
              listsLive.find(({ id }) => id === live.listId)?.choices ?? [],
          },
        ],
      ];
    }),
  );
  const liveBeside = (column: Column<Rec, Change>) =>
    liveCopies.get(column.key);
  const renamedFrom = (column: Column<Rec, Change>) =>
    liveName(column, view.show);
  const besides = columns.filter((column) => liveCopies.has(column.key));
  // A record's value in a column as it is live, for the column's live copy: none for one only
  // drafted to be added, or for a new row.
  const liveCell = (record: Rec | undefined, column: Column<Rec, Change>) => {
    const draft = record?.draft as DraftOf<Rec> | undefined;
    if (record === undefined || draft?.action === "created") return "";
    return shown(
      // Only changed columns have a live copy beside them.
      liveBeside(column) as Column<Rec, Change>,
      draft?.action === "changed" && changedIn(draft, column)
        ? column.live(draft)
        : column.value(record),
    );
  };
  // A column with a draft is tinted, as a row with one is, while drafts are shown beside live, and
  // one a draft removes is struck through.
  const columnTint = (column: Column<Rec, Change>) => {
    const draft = column.field?.draft;
    if (draft === undefined) return "";
    const tinted = besideLive(view.show);
    return [
      tinted ? classes.draftColumn : "",
      tinted && draft.state === "rejected" ? classes.rejectedColumn : "",
      draft.action === "deleted" ? classes.removedColumn : "",
    ].join(" ");
  };
  // The actions column, for those who may edit records or approve drafts.
  const withActions =
    (canEdit && rowActions) ||
    canEditDrafts ||
    approves.length > 0 ||
    table.menuItems !== undefined ||
    table.showDetails !== undefined;
  // Whether the user may change a record, as they may the table's others, unless it is one they
  // may only view.
  const mayChange = (record: Rec) =>
    canEdit && table.readOnlyRecord?.(record) !== true;
  // A record's menu: approving or rejecting its draft, for Approvers, discarding it or removing the
  // record, for those who may change it, and whatever else the table offers, such as its details.
  const hasMenu = (record: Rec) =>
    !isPending(record) &&
    ((rowActions && mayChange(record)) ||
      (record.draft !== undefined && approvesInMenu(record)) ||
      decidesOwnDraft(record) ||
      ownItemsOf(record).length > 0);
  // On a table whose records are changed elsewhere, whether the user may discard or resubmit a
  // record's own draft from its menu.
  const decidesOwnDraft = (record: Rec) =>
    editsDraftOf(record) &&
    record.heldBy === undefined &&
    ownDraftOf(record) !== undefined;
  // What a record's menu offers of the table's own: its details, from its row, then whatever else
  // the table offers.
  const ownItemsOf = (record: Rec, place: MenuPlace = "row"): ReactNode[] =>
    [
      menuPlace(place).showsDetails &&
        table.showDetails !== undefined &&
        !isPending(record) &&
        table.hasDetails?.(record) !== false && (
          <Menu.Item
            key="details"
            onClick={() => {
              table.showDetails?.(record);
            }}
          >
            Show details
          </Menu.Item>
        ),
      table.keyOf !== undefined && (
        <CopyLinkItem key="copy-link" record={table.keyOf(record)} />
      ),
      table.menuItems?.(record),
    ].filter(Boolean);
  // Whether a record's cells cannot be changed: by those who may only view it, while it is drafted
  // to be removed, until the draft is discarded, or while it is being added.
  const locked = (record: Rec) => !mayChange(record) || heldBack(record);
  const defaultKind = table.kinds?.[0] ?? "";
  // The kind of record a row is, or adds.
  const rowKind = (row: Row<Rec>) =>
    row.newRow
      ? (row.newRow.kind ?? defaultKind)
      : (table.kindOf?.(row.record) ?? defaultKind);
  return {
    fields,
    liveColumn,
    allColumns,
    known,
    columns,
    liveOnly,
    view,
    records,
    recordDraft,
    marksRows,
    liveById,
    draftById,
    cellDraftsById,
    canEdit,
    approves,
    approvesRecord,
    decidableRow,
    ownDraftOf,
    ownSelectionOf,
    approvesInMenu,
    decidedInMenu,
    fieldsLive,
    liveBeside,
    renamedFrom,
    besides,
    liveCell,
    columnTint,
    withActions,
    mayChange,
    hasMenu,
    decidesOwnDraft,
    ownItemsOf,
    locked,
    defaultKind,
    rowKind,
  };
}

export type ModelGrid<Rec extends GridRecord, Change, Request> = GridProps<
  Rec,
  Change,
  Request
> &
  ReturnType<typeof useGridModel<Rec, Change, Request>>;
