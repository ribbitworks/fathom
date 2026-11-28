// SPDX-License-Identifier: Apache-2.0

// The shared table of records changed only in their dialogs, never in the table, with no drafts, as
// Accounts' and Roles' are, with one record's details beside it.

import { focusRecordCell } from "./grid-row.tsx";
import { RecordGrid } from "./record-grid.tsx";
import {
  type GridRecord,
  noRecordActions,
  type RecordTable,
} from "./record-table.ts";
import type { SidePanel } from "./side-panel.tsx";
import type { SavedViews } from "./table-controls.tsx";
import { TableTips } from "./table-tips.tsx";
import type { View } from "./table-view.ts";

export function LiveRecordGrid<Rec extends GridRecord>({
  records,
  table,
  order,
  view,
  onView,
  saved,
  open,
  onOpen,
  details,
}: {
  records: Rec[];
  table: RecordTable<Rec, never, undefined>;
  order: string[];
  view: View;
  onView: (view: View, replace?: boolean) => void;
  saved: SavedViews | undefined;
  // The record whose details are shown beside the table, by its identifier.
  open: string | undefined;
  onOpen: (id: string | undefined) => void;
  // The details of the record shown, given what closes them.
  details: (record: Rec, onClose: () => void) => SidePanel;
}) {
  const shown = records.find(({ id }) => id === open);
  // Closing a record's details puts focus back on its name.
  const close = (id: string) => {
    focusRecordCell(id, table.nameColumn);
    onOpen(undefined);
  };
  return (
    <TableTips>
      <RecordGrid
        records={records}
        table={table}
        fields={[]}
        order={order}
        lists={[]}
        canEdit={false}
        canAdd={false}
        rowActions={false}
        canEditColumns={false}
        actions={noRecordActions<Rec, never, undefined>()}
        view={view}
        onView={onView}
        saved={saved}
        panels={
          shown === undefined
            ? []
            : [
                details(shown, () => {
                  close(shown.id);
                }),
              ]
        }
        selected={open}
        closeSelected={close}
        withDrafts={false}
      />
    </TableTips>
  );
}
