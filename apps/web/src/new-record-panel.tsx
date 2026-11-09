// SPDX-License-Identifier: Apache-2.0

// Adding a record in the panel beside its table, driven by the table's columns: the columns a new
// record has and their starting values, the panel's frame with Add and Cancel at its foot, and the
// checks Add makes, as adding a new row does. Each page draws its fields inside it, as rows in
// sections, and names the problems Add finds. The page holds what has been entered, so it can ask
// before discarding it.

import { Button, Group, Stack } from "@mantine/core";
import { type ReactNode, useEffect } from "react";
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

// What the record being added is known by, until it is added and has an ID of its own.
export const newRecordId = "new-record";

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
  table,
  columns,
  kind,
  values,
  others,
  unfinished,
  withRefused,
  onRefused,
  onAdd,
  onCancel,
  children,
}: {
  panelId: string;
  title: string;
  narrow: boolean;
  saving: boolean;
  table: Pick<RecordTable<Rec, Change, Request>, "recordProblem" | "request">;
  columns: readonly Column<Rec, Change>[];
  kind: string;
  values: FormValues;
  others: () => Record<string, CellValue>[];
  // Whether an editor stays open, holding a value it will not give up, which says why itself.
  unfinished: boolean;
  withRefused: (
    found: readonly { column: string; message: string }[],
  ) => readonly { column: string; message: string }[];
  onRefused: (found: readonly { column: string; message: string }[]) => void;
  onAdd: (request: Request) => void;
  onCancel: () => void;
  children: ReactNode;
}) {
  useEffect(() => {
    focusSoon(titleId);
  }, []);
  const add = () => {
    if (unfinished) return;
    const found = withRefused(
      newRecordProblems(columns, kind, values, table.recordProblem, others),
    );
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
    <Stack gap="lg">
      {children}
      <Group justify="flex-end" gap="xs">
        <Button variant="default" onClick={onCancel} disabled={saving}>
          Cancel
        </Button>
        <Button onClick={add} loading={saving}>
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
      <div className={sidePanelScroll} inert={saving}>
        {body}
      </div>
    </SidePanelFrame>
  );
}
