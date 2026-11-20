// SPDX-License-Identifier: Apache-2.0

// Adding a person or a planned hire in the panel beside People: its rows as empty fields, State
// first, which decides the kind, then Details, Reporting, and added columns. Changing State to
// another kind's keeps the values both kinds have and clears the rest, naming them. Each value is
// checked as a new row's cell checks it.

import { allOf, hireCalled, type List, type Person } from "@fathom/shared";
import { Text } from "@mantine/core";
import {
  type Column,
  hireKind,
  kindOfState,
  requestFromChanges,
  personKind,
  recordProblem,
} from "./people-grid.tsx";
import { positionLabel, type RowRequest } from "./people-rows.ts";
import {
  type EditingContext,
  personPanelId,
  usePersonEditing,
} from "./person-editing.tsx";
import { newRecordQuestion } from "./discard-question.tsx";
import type { NoteOpening } from "./note-editing.tsx";
import { detailKeys, reportingKeys } from "./person-panel.tsx";
import classes from "./record-details.module.css";
import {
  newRecordFields,
  newRecordId,
  NewRecordPanel,
} from "./new-record-panel.tsx";
import { RecordSection, Row } from "./record-details.tsx";
import { keptForKind } from "./grid-columns.tsx";
import type { CellValue } from "./table-view.ts";

const table = { recordProblem, request: requestFromChanges };

// What has been entered for a record being added: its kind, its values by column, the columns
// cleared when State changed its kind, and whether it is being saved.
export interface NewRecord {
  kind: string;
  values: Record<string, CellValue>;
  cleared: string[];
  saving?: boolean;
}

export const newRecord = (): NewRecord => ({
  kind: personKind,
  values: {},
  cleared: [],
});

export const recordQuestion = (kind: string) =>
  newRecordQuestion(kind === hireKind ? "planned hire" : "person");

export function NewPersonPanel({
  record,
  onRecord,
  people,
  lists,
  allColumns,
  narrow,
  notes,
  onAdd,
  onCancel,
}: {
  record: NewRecord;
  // Changes what has been entered so far, since a note's panel saves long after the form was drawn.
  onRecord: (update: (current: NewRecord) => NewRecord) => void;
  // Everyone and every planned hire People shows, whose IDs a new one may not share and whom it may
  // report to.
  people: readonly Person[];
  lists: readonly List[];
  allColumns: readonly Column[];
  narrow: boolean;
  notes: NoteOpening;
  onAdd: (request: RowRequest) => void;
  onCancel: () => void;
}) {
  const { editingOf, refuseEntered, withRefused, unfinished } =
    usePersonEditing(notes);
  const { kind } = record;
  const { columns, valueOf, values } = newRecordFields(
    allColumns,
    kind,
    record.values,
  );
  const byKey = new Map(columns.map((column) => [column.key, column]));
  const others = () =>
    people.map((one) =>
      Object.fromEntries(
        allColumns.map((column) => [column.key, column.value(one)]),
      ),
    );
  const title = kind === hireKind ? "New planned hire" : "New person";
  const context: EditingContext = {
    id: newRecordId,
    kind,
    name: title,
    values,
    adding: true,
    others,
    recordProblem,
    // A planned hire with no name of its own goes by its position and ID, as People shows it; the
    // ID comes when it is added, if none is typed.
    hint: (column) => {
      if (kind !== hireKind || column.key !== "preferredName") return undefined;
      const position = positionLabel(lists, (values.positionId as string[])[0]);
      const id = values.employeeId as string;
      if (id === "") return position;
      return hireCalled(null, id, position);
    },
    save: (_change, column, value) => {
      onRecord((current) => {
        const next = keptForKind(
          allColumns,
          { ...current.values, [column.key]: value },
          current.kind,
        ).values;
        const nextKind =
          column.key === "stateId"
            ? // A new record is offered only states that make a person or a planned hire.
              (kindOfState(lists, (value as string[])[0]) as string)
            : current.kind;
        if (nextKind === current.kind) {
          return { ...current, values: next, cleared: [] };
        }
        const kept = keptForKind(allColumns, next, nextKind);
        return {
          kind: nextKind,
          values: kept.values,
          cleared: kept.lost.map(({ label }) => label),
        };
      });
    },
  };
  const editing = editingOf(context);
  const rowOf = (column: Column) => (
    <Row
      key={column.key}
      column={column}
      value={valueOf(column)}
      editing={editing(column)}
    />
  );
  const section = (keys: readonly string[]) =>
    keys.flatMap((key) => {
      const column = byKey.get(key);
      return column === undefined ? [] : [column];
    });
  const state = byKey.get("stateId");
  const details = section(detailKeys.filter((key) => key !== "stateId"));
  const reporting = section(reportingKeys);
  const added = columns.filter((column) => column.field !== undefined);
  // In the order the panel shows them, so focus goes to the first problem seen.
  const shownColumns = [
    ...(state === undefined ? [] : [state]),
    ...details,
    ...reporting,
    ...added,
  ];
  return (
    <NewRecordPanel
      panelId={personPanelId}
      title={title}
      narrow={narrow}
      saving={record.saving === true}
      table={table}
      columns={columns}
      kind={kind}
      values={values}
      others={others}
      unfinished={unfinished(newRecordId)}
      withRefused={(found) => withRefused(newRecordId, shownColumns, found)}
      onRefused={(found) => {
        refuseEntered(newRecordId, found, shownColumns);
      }}
      onAdd={onAdd}
      onCancel={onCancel}
    >
      <div>
        {state !== undefined && (
          <dl className={classes.list}>{rowOf(state)}</dl>
        )}
        <Text size="sm" c="dimmed" role="status" mt={4}>
          {record.cleared.length > 0 &&
            `${allOf(record.cleared)} ${record.cleared.length === 1 ? "was" : "were"} cleared, since a ${kind === hireKind ? "planned hire" : "person"} doesn't have ${record.cleared.length === 1 ? "it" : "them"}.`}
        </Text>
      </div>
      <RecordSection id="new-record-details" title="Details">
        {details.map(rowOf)}
      </RecordSection>
      <RecordSection id="new-record-reporting" title="Reporting">
        {reporting.map(rowOf)}
      </RecordSection>
      {added.length > 0 && (
        <RecordSection id="new-record-columns" title="Columns">
          {added.map(rowOf)}
        </RecordSection>
      )}
    </NewRecordPanel>
  );
}
