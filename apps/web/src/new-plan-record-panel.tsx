// SPDX-License-Identifier: Apache-2.0

// Adding a customer, proposal, project, milestone, or feature in the panel beside its table, as a
// person is added: a row for each column a new record has, each entered as its table's cell is, and
// any problem Add finds named under its row.

import {
  type FormValues,
  newRecordFields,
  newRecordId,
  NewRecordPanel,
} from "./new-record-panel.tsx";
import type { NoteContext, NoteOpening } from "./note-editing.tsx";
import type { AddedColumns } from "./added-columns.ts";
import type { PlanChange } from "./plan-table.tsx";
import classes from "./record-details.module.css";
import { RecordSection, Row } from "./record-details.tsx";
import {
  type SaveChange,
  useChosenUnits,
  useRecordEditing,
} from "./record-editing.tsx";
import { inViewUnits } from "./grid-columns.tsx";
import type { GridRecord, RecordTable } from "./record-table.ts";
import type { CellValue, View } from "./table-view.ts";

// The plan's records are checked on their own, not beside each other.
export const noOthers = () => [];

export function NewPlanRecordPanel<Rec extends GridRecord, Request>({
  title,
  table,
  records,
  values,
  saving,
  narrow,
  panelId,
  added = { fields: [], lists: [], order: [] },
  notes,
  units: tableUnits,
  onValue,
  onAdd,
  onCancel,
}: {
  title: string;
  table: RecordTable<Rec, PlanChange, Request>;
  records: readonly Rec[];
  values: FormValues;
  saving: boolean;
  narrow: boolean;
  panelId: string;
  // The columns added to the table, for a table that has them.
  added?: AddedColumns;
  notes: NoteOpening;
  // The units the table shows its columns in, which a column that offers units is entered in at
  // first; the form may change them without changing the table.
  units?: View["units"];
  // Takes one value, on top of whatever else has been entered, since a note's panel saves long after
  // the form was drawn.
  onValue: (key: string, value: CellValue) => void;
  onAdd: (request: Request) => void;
  onCancel: () => void;
}) {
  const kind = table.kinds?.[0] ?? "";
  const units = useChosenUnits(tableUnits);
  const {
    columns,
    valueOf,
    values: shown,
  } = newRecordFields(
    table
      .columnsFor(added.fields, added.lists, added.order, records)
      .map((column) => inViewUnits(column, { units: units.units })),
    kind,
    values,
  );
  const { editingOf, refuseEntered, withRefused, unfinished } =
    useRecordEditing<Rec, PlanChange, NoteContext<Rec, PlanChange>>(notes);
  const save: SaveChange<Rec, PlanChange> = (_change, column, value) => {
    onValue(column.key, value);
  };
  const editing = editingOf({
    id: newRecordId,
    kind,
    name: title,
    values: shown,
    adding: true,
    others: noOthers,
    recordProblem: table.recordProblem,
    save,
    onUnit: (column, unit) => {
      units.choose(column.key, unit);
    },
  });
  const rowOf = (column: (typeof columns)[number]) => (
    <Row
      key={column.key}
      column={column}
      value={valueOf(column)}
      editing={editing(column)}
    />
  );
  const details = columns.filter((column) => column.field === undefined);
  const addedColumns = columns.filter((column) => column.field !== undefined);
  return (
    <NewRecordPanel
      panelId={panelId}
      title={title}
      narrow={narrow}
      saving={saving}
      table={table}
      columns={columns}
      kind={kind}
      values={shown}
      others={noOthers}
      unfinished={unfinished(newRecordId)}
      withRefused={(found) => withRefused(newRecordId, columns, found)}
      onRefused={(found) => {
        refuseEntered(newRecordId, found, [...details, ...addedColumns]);
      }}
      onAdd={onAdd}
      onCancel={onCancel}
    >
      {addedColumns.length > 0 ? (
        <>
          <RecordSection id="new-record-details" title="Details">
            {details.map(rowOf)}
          </RecordSection>
          <RecordSection id="new-record-columns" title="Columns">
            {addedColumns.map(rowOf)}
          </RecordSection>
        </>
      ) : (
        <dl className={classes.list}>{details.map(rowOf)}</dl>
      )}
    </NewRecordPanel>
  );
}
