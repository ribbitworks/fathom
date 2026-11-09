// SPDX-License-Identifier: Apache-2.0

// Adding, changing, and deleting a table's added columns, as any page with such a table does: the
// column dialog in its modal, each change shown at once and saved as a draft, and discarding or
// sending again a column's draft. The modal cannot be closed while a change is being saved.

import type { ColumnTable, FeatureColumns, Field, List } from "@fathom/shared";
import { Modal } from "@mantine/core";
import { useState } from "react";
import { ColumnDialog } from "./column-dialog.tsx";
import {
  deleteField,
  discardColumnDraft,
  resubmitColumnDraft,
} from "./column-requests.ts";
import type { Change } from "./saving.ts";

type Dialog = { kind: "new" } | { kind: "edit"; field: Field };

type TableColumns = Pick<FeatureColumns, "fields" | "order">;

// What a page's saving gives the columns' changes.
interface ColumnSaving<Data> {
  save: (change: Change<Data>) => void;
  undoable: (
    changeSetId: string | null,
    before: Data,
    focusAfter?: string,
  ) => void;
  done: (message: string, changeSetId: string | null, before: Data) => void;
}

// The dialog stays set while it closes, so its content does not vanish mid-animation.
export function useColumnDialog() {
  const [dialog, setDialog] = useState<Dialog>();
  const [opened, setOpened] = useState(false);
  return {
    dialog,
    opened,
    open: (next: Dialog) => {
      setDialog(next);
      setOpened(true);
    },
    close: () => {
      setOpened(false);
    },
  };
}

export function columnDraftActions<Data>(
  table: ColumnTable,
  { save, undoable, done }: ColumnSaving<Data>,
) {
  return {
    discardColumn: (id: string, name: string) => {
      save({
        next: (data) => data,
        save: () => discardColumnDraft(id, table),
        failure: `Fathom could not discard the draft of ${name}.`,
        onSaved: (changeSetId, before) => {
          done(`Discarded the draft of ${name}.`, changeSetId, before);
        },
      });
    },
    resubmitColumn: (id: string) => {
      save({
        next: (data) => data,
        save: () => resubmitColumnDraft(id, table),
        failure: "Fathom could not send the draft for approval again.",
        onSaved: (changeSetId, before) => {
          undoable(changeSetId, before);
        },
      });
    },
  };
}

export function ColumnModal<Data>({
  state,
  table,
  fields,
  lists,
  canDelete = true,
  saving: { save, undoable, done },
  withColumns,
  newColumnButton,
}: {
  state: ReturnType<typeof useColumnDialog>;
  table: ColumnTable;
  fields: Field[];
  lists: List[];
  canDelete?: boolean;
  saving: ColumnSaving<Data>;
  // The page's data with its table's columns changed.
  withColumns: (
    data: Data,
    change: (columns: TableColumns) => Partial<TableColumns>,
  ) => Data;
  // The button focus returns to once a new column is saved.
  newColumnButton: string;
}) {
  const [busy, setBusy] = useState(false);
  const { dialog, opened, close } = state;
  // The dialog saved the column itself, so the page shows it at once, then reloads once no other
  // change is saving.
  const saved = (field: Field, changeSetId: string | null) => {
    close();
    save({
      next: (data) =>
        withColumns(data, ({ fields: shown, order }) => ({
          fields: shown.some((other) => other.id === field.id)
            ? shown.map((other) => (other.id === field.id ? field : other))
            : [...shown, field],
          order: order.includes(field.id) ? order : [...order, field.id],
        })),
      save: () => Promise.resolve(changeSetId),
      failure: "",
      onSaved: (_saved, before) => {
        undoable(changeSetId, before, newColumnButton);
      },
    });
  };
  const remove = (field: Field) => {
    close();
    save({
      next: (data) =>
        withColumns(data, ({ fields: shown }) => ({
          fields: shown.filter((other) => other.id !== field.id),
        })),
      save: () => deleteField(field.id, table),
      failure: `Fathom could not delete ${field.name}.`,
      onSaved: (changeSetId, before) => {
        done(`Deleted the ${field.name} column.`, changeSetId, before);
      },
    });
  };
  return (
    <Modal
      opened={opened}
      onClose={close}
      closeOnEscape={!busy}
      closeOnClickOutside={!busy}
      withCloseButton={!busy}
      title={dialog?.kind === "edit" ? "Edit column" : "New column"}
    >
      {dialog && (
        <ColumnDialog
          table={table}
          {...(dialog.kind === "edit" ? { field: dialog.field } : {})}
          fields={fields}
          lists={lists}
          onSaved={saved}
          onDelete={canDelete ? remove : undefined}
          onCancel={close}
          onBusy={setBusy}
        />
      )}
    </Modal>
  );
}
