// SPDX-License-Identifier: Apache-2.0

// Adding a record in the panel beside its table, driven by the table's columns: the columns a new
// record has and their starting values, the panel's frame with Add and Cancel at its foot, and the
// checks Add makes, as adding a new row does. Each page draws its own fields inside it and names the
// problems Add finds. The page holds what has been entered, so it can ask before discarding it.

import { isLink, linkProblems } from "@fathom/shared";
import { Button, Group, Stack } from "@mantine/core";
import { type ReactNode, type SubmitEvent, useEffect } from "react";
import { cellKinds } from "./cell-kinds.tsx";
import { focusSoon } from "./focus.ts";
import {
  type Column,
  columnsOn,
  type GridRecord,
  newRecordProblems,
  onRow,
  readOnlyFor,
  type RecordTable,
} from "./record-grid.tsx";
import { SidePanelFrame, sidePanelScroll } from "./side-panel.tsx";
import type { CellValue } from "./table-view.ts";

export type FormValues = Readonly<Record<string, CellValue>>;

const titleId = "new-record-title";

// Whether anything has been entered, so discarding it asks first.
export const entered = ({ values }: { values: FormValues }) =>
  Object.values(values).some(
    (value) =>
      value !== null &&
      value !== "" &&
      !(Array.isArray(value) && value.length === 0),
  );

// The columns a new record of a kind is given values in, and each one's value so far.
export function newRecordFields<Rec extends GridRecord, Change>(
  all: readonly Column<Rec, Change>[],
  kind: string,
  given: FormValues,
) {
  // A new record's values follow from nothing else, so it has no columns that only show them.
  const columns = columnsOn(all, kind)
    .filter((column) => !readOnlyFor(column, kind))
    .map((column) => onRow<Rec, Column<Rec, Change>>(column, undefined, kind));
  const valueOf = (column: Column<Rec, Change>): CellValue =>
    given[column.key] ??
    column.newRowValue?.(kind) ??
    cellKinds[column.kind].empty;
  const values: Record<string, CellValue> = Object.fromEntries(
    columns.map((column) => [column.key, valueOf(column)]),
  );
  return { columns, valueOf, values };
}

export function NewRecordPanel<Rec extends GridRecord, Change, Request>({
  panelId,
  title,
  narrow,
  saving,
  gap,
  enterAdds,
  table,
  columns,
  kind,
  values,
  others,
  onRefused,
  onAdd,
  onCancel,
  children,
}: {
  panelId: string;
  title: string;
  narrow: boolean;
  saving: boolean;
  gap: "md" | "lg";
  // Whether Enter in a field adds the record, rather than finishing that field.
  enterAdds: boolean;
  table: Pick<RecordTable<Rec, Change, Request>, "recordProblem" | "request">;
  columns: readonly Column<Rec, Change>[];
  kind: string;
  values: FormValues;
  others: () => Record<string, CellValue>[];
  onRefused: (found: readonly { column: string; message: string }[]) => void;
  onAdd: (request: Request) => void;
  onCancel: () => void;
  children: ReactNode;
}) {
  useEffect(() => {
    focusSoon(titleId);
  }, []);
  const add = () => {
    const found = [
      ...newRecordProblems(columns, kind, values, table.recordProblem, others),
      ...columns.flatMap((column) => {
        const value = values[column.key];
        const message = isLink(value) ? linkProblems(value).address : undefined;
        return message === undefined ? [] : [{ column: column.key, message }];
      }),
    ];
    if (found.length > 0) {
      onRefused(found);
      return;
    }
    onAdd(
      table.request(
        columns.map((column) => column.change(values[column.key] as CellValue)),
        kind,
      ),
    );
  };
  const body = (
    <Stack gap={gap}>
      {children}
      <Group justify="flex-end" gap="xs">
        <Button variant="default" onClick={onCancel} disabled={saving}>
          Cancel
        </Button>
        <Button
          {...(enterAdds ? { type: "submit" } : { onClick: add })}
          loading={saving}
        >
          Add
        </Button>
      </Group>
    </Stack>
  );
  return (
    <SidePanelFrame
      id={panelId}
      titleId={titleId}
      title={title}
      narrow={narrow}
      close={{
        label: `Close ${title}`,
        onClose: () => {
          if (!saving) onCancel();
        },
      }}
    >
      {enterAdds ? (
        <form
          className={sidePanelScroll}
          inert={saving}
          noValidate
          onSubmit={(event: SubmitEvent) => {
            event.preventDefault();
            add();
          }}
        >
          {body}
        </form>
      ) : (
        <div className={sidePanelScroll} inert={saving}>
          {body}
        </div>
      )}
    </SidePanelFrame>
  );
}
