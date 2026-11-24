// SPDX-License-Identifier: Apache-2.0

// Adding, changing, and deleting a table's added columns, as any page with such a table does: the
// column dialog in its modal, each change shown at once and saved as a draft, and discarding or
// sending again a column's draft. The modal cannot be closed while a change is being saved. Moving
// a column to another class takes effect at once, never as a draft.

import type {
  ColumnTable,
  FeatureColumns,
  Field,
  List,
  Permission,
  Tier,
} from "@fathom/shared";
import { Modal } from "@mantine/core";
import { useState } from "react";
import { ColumnDialog } from "./column-dialog.tsx";
import {
  changesQuestion,
  newRecordQuestion,
  useDiscardQuestion,
} from "./discard-question.tsx";
import { moveColumnClass } from "./data-classes.ts";
import { useDialogState } from "./dialog-actions.tsx";
import { MoveClassModal, showMoved } from "./move-class-dialog.tsx";
import {
  deleteField,
  discardColumnDraft,
  resubmitColumnDraft,
} from "./column-requests.ts";
import type { useSaving } from "./saving.ts";

type Dialog =
  | { kind: "new" }
  | { kind: "edit"; field: Field }
  | { kind: "move"; field: Field; from: Tier };

type TableColumns = Pick<FeatureColumns, "fields" | "order">;

// What a page's saving gives the columns' changes.
type ColumnSaving<Data> = Pick<
  ReturnType<typeof useSaving<Data>>,
  "save" | "shown" | "undoable" | "done"
>;

export const useColumnDialog = () => useDialogState<Dialog>();

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

type WithColumns<Data> = (
  data: Data,
  change: (columns: TableColumns) => Partial<TableColumns>,
) => Data;

// Removing a column is a draft that may be undone.
export function columnRemover<Data>(
  table: ColumnTable,
  { save, done }: Pick<ColumnSaving<Data>, "save" | "done">,
  withColumns: WithColumns<Data>,
) {
  return (field: Field) => {
    save({
      next: (data) =>
        withColumns(data, ({ fields: shown }) => ({
          fields: shown.filter((other) => other.id !== field.id),
        })),
      save: () => deleteField(field.id, table),
      failure: `Fathom could not remove ${field.name}.`,
      onSaved: (changeSetId, before) => {
        done(`Removed the ${field.name} column.`, changeSetId, before);
      },
    });
  };
}

export function ColumnModal<Data>({
  state,
  table,
  fields,
  lists,
  permissions = [],
  saving: { save, shown, undoable, done },
  withColumns,
  newColumnButton,
}: {
  state: ReturnType<typeof useColumnDialog>;
  table: ColumnTable;
  fields: Field[];
  lists: List[];
  // The role's permissions, which decide the classes a column may be moved to.
  permissions?: readonly Permission[];
  saving: ColumnSaving<Data>;
  withColumns: WithColumns<Data>;
  // The button focus returns to once a new column is saved.
  newColumnButton: string;
}) {
  const [busy, setBusy] = useState(false);
  const { dialog, opened, close } = state;
  // Leaving the dialog with anything changed asks first.
  const [changed, setChanged] = useState(false);
  const question = useDiscardQuestion();
  const asked =
    dialog?.kind === "new"
      ? newRecordQuestion("column")
      : changesQuestion("column");
  const leave = () => {
    question.ask(changed ? asked : undefined, () => {
      setChanged(false);
      close();
    });
  };
  // The dialog saved the column itself, so the page shows it at once, then reloads once no other
  // change is saving.
  const saved = (field: Field, changeSetId: string | null) => {
    close();
    shown(
      (data) =>
        withColumns(data, ({ fields: listed, order }) => ({
          fields: listed.some((other) => other.id === field.id)
            ? listed.map((other) => (other.id === field.id ? field : other))
            : [...listed, field],
          order: order.includes(field.id) ? order : [...order, field.id],
        })),
      changeSetId,
      (_saved, before) => {
        undoable(changeSetId, before, newColumnButton);
      },
    );
  };
  const moved = (
    field: Field,
    visibility: Field["visibility"],
    changeSetId: string | null,
  ) => {
    showMoved(
      { shown, undoable },
      field,
      (data) =>
        withColumns(data, ({ fields: listed }) => ({
          fields: listed.map((other) =>
            other.id === field.id ? { ...other, visibility } : other,
          ),
        })),
      changeSetId,
    );
  };
  const removeColumn = columnRemover(table, { save, done }, withColumns);
  const remove = (field: Field) => {
    close();
    removeColumn(field);
  };
  const moving = dialog?.kind === "move" ? dialog : undefined;
  return (
    <>
      <MoveClassModal
        moving={
          moving && {
            name: moving.field.name,
            from: moving.from,
            move: (to) => moveColumnClass(moving.field.id, to),
            moved: (to, changeSetId) => {
              moved(moving.field, to, changeSetId);
            },
          }
        }
        opened={opened && moving !== undefined}
        permissions={permissions}
        onClose={close}
      />
      <Modal
        opened={opened && moving === undefined}
        onClose={leave}
        // Esc is handled here, so the question it may open doesn't take the same Esc as its own.
        closeOnEscape={false}
        onKeyDown={(event) => {
          // Esc in an open drop-down list closes the list alone.
          const inOpenList =
            event.target instanceof HTMLElement &&
            event.target.getAttribute("aria-expanded") === "true";
          if (event.key !== "Escape" || busy || inOpenList) return;
          event.stopPropagation();
          leave();
        }}
        closeOnClickOutside={!busy}
        withCloseButton={!busy}
        title={dialog?.kind === "new" ? "New column" : "Edit column"}
      >
        {dialog && dialog.kind !== "move" && (
          <ColumnDialog
            table={table}
            {...(dialog.kind === "edit" ? { field: dialog.field } : {})}
            fields={fields}
            lists={lists}
            onSaved={saved}
            onDelete={remove}
            onCancel={leave}
            onBusy={setBusy}
            onChanged={setChanged}
            permissions={permissions}
          />
        )}
      </Modal>
      {question.dialog}
    </>
  );
}
