// SPDX-License-Identifier: Apache-2.0

// Adding a person or a planned hire in the details panel beside People: its rows as empty fields,
// State first, which decides the kind, with Add and Cancel at its foot. Each value is checked as a
// new row's cell checks it, and Add checks the whole as adding a new row does, naming any problem
// under its field. Changing State to another kind's keeps the values both kinds have and clears the
// rest, naming them. The page holds what has been entered, so it can ask before discarding it.

import { hireCalled, type List, type Person } from "@fathom/shared";
import { Button, Group, Stack, Text } from "@mantine/core";
import { useEffect } from "react";
import { cellKinds } from "./cell-kinds.tsx";
import { focusSoon } from "./focus.ts";
import {
  type Column,
  columnsFor,
  hireKind,
  kindOfState,
  newRecordRequest,
  personKind,
  recordProblem,
} from "./people-grid.tsx";
import { positionLabel, type RowRequest } from "./people-rows.ts";
import {
  changeId,
  editorId,
  type EditingContext,
  personPanelId,
  type NoteEditing,
  usePersonEditing,
} from "./person-editing.tsx";
import { detailKeys, reportingKeys, Row } from "./person-panel.tsx";
import classes from "./person-panel.module.css";
import {
  columnsOn,
  keptForKind,
  newRecordProblems,
  onRow,
  readOnlyFor,
} from "./record-grid.tsx";
import { SidePanelFrame, sidePanelScroll } from "./side-panel.tsx";
import type { CellValue } from "./table-view.ts";

const titleId = "new-record-title";
// What the record being added is known by, until it is added and has an ID of its own.
export const newRecordId = "new-record";
const formId = newRecordId;

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

// Whether anything has been entered, so discarding it asks first.
export const entered = ({ values }: NewRecord) =>
  Object.values(values).some(
    (value) =>
      value !== null &&
      value !== "" &&
      !(Array.isArray(value) && value.length === 0),
  );

export const recordQuestion = (kind: string) => ({
  title:
    kind === hireKind
      ? "Discard the planned hire you're adding?"
      : "Discard the person you're adding?",
  keep: "Keep adding",
});

const listFormat = new Intl.ListFormat("en", { type: "conjunction" });

export function NewRecordPanel({
  record,
  onRecord,
  people,
  fields,
  lists,
  order,
  showDates,
  showHireDates,
  showPosition,
  canAddHires,
  narrow,
  notes,
  onAdd,
  onCancel,
}: {
  record: NewRecord;
  onRecord: (record: NewRecord) => void;
  // Everyone and every planned hire People shows, whose IDs a new one may not share and whom it may
  // report to.
  people: readonly Person[];
  fields: Parameters<typeof columnsFor>[0];
  lists: readonly List[];
  order: readonly string[];
  showDates: boolean;
  showHireDates: boolean;
  showPosition: boolean;
  canAddHires: boolean;
  narrow: boolean;
  notes: Pick<NoteEditing, "start">;
  onAdd: (request: RowRequest) => void;
  onCancel: () => void;
}) {
  const { editingOf, refuse } = usePersonEditing(notes);
  const { kind } = record;
  const adding = record.saving === true;
  const all = columnsFor(
    fields,
    lists,
    order,
    showDates,
    people,
    showPosition,
    showHireDates,
    canAddHires,
  );
  // A new record's values follow from nothing else, so it has no columns that only show them.
  const columns = columnsOn(all, kind)
    .filter((column) => !readOnlyFor(column, kind))
    .map((column) => onRow<Person, Column>(column, undefined, kind));
  const byKey = new Map(columns.map((column) => [column.key, column]));
  const valueOf = (column: Column): CellValue =>
    record.values[column.key] ??
    column.newRowValue?.(kind) ??
    cellKinds[column.kind].empty;
  const values = Object.fromEntries(
    columns.map((column) => [column.key, valueOf(column)]),
  );
  const others = () =>
    people.map((one) =>
      Object.fromEntries(all.map((column) => [column.key, column.value(one)])),
    );
  const title = kind === hireKind ? "New planned hire" : "New person";
  const context: EditingContext = {
    id: formId,
    kind,
    name: title,
    values,
    adding: true,
    others,
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
      const next = { ...record.values, [column.key]: value };
      const nextKind =
        column.key === "stateId"
          ? // A new record is offered only states that make a person or a planned hire.
            (kindOfState(lists, (value as string[])[0]) as string)
          : kind;
      if (nextKind === kind) {
        onRecord({ ...record, values: next, cleared: [] });
        return;
      }
      const kept = keptForKind(all, next, nextKind);
      onRecord({
        kind: nextKind,
        values: kept.values,
        cleared: kept.lost.map(({ label }) => label),
      });
    },
  };
  const editing = editingOf(context);
  useEffect(() => {
    focusSoon(titleId);
  }, []);
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
  const add = () => {
    const found = newRecordProblems(
      columns,
      kind,
      values,
      recordProblem,
      others,
    );
    if (found.length > 0) {
      refuse(
        formId,
        found.map(({ column, message }) => ({ key: column, message })),
      );
      const keys = new Set(found.map(({ column }) => column));
      // Every column a new record has is shown, so each problem is in one of them.
      const first = shownColumns.find(({ key }) => keys.has(key)) as Column;
      // A text or date is a field always open; any other value opens from its change button.
      focusSoon(
        cellKinds[first.kind].Editor === undefined
          ? editorId(first)
          : changeId(first),
      );
      return;
    }
    onAdd(newRecordRequest(columns, kind, values));
  };
  return (
    <SidePanelFrame
      id={personPanelId}
      titleId={titleId}
      title={title}
      narrow={narrow}
      close={{
        label: `Close ${title}`,
        onClose: () => {
          if (!adding) onCancel();
        },
      }}
    >
      <div className={sidePanelScroll} inert={adding}>
        <Stack gap="lg">
          <div>
            {state !== undefined && (
              <dl className={classes.list}>{rowOf(state)}</dl>
            )}
            <Text size="sm" c="dimmed" role="status" mt={4}>
              {record.cleared.length > 0 &&
                `${listFormat.format(record.cleared)} ${record.cleared.length === 1 ? "was" : "were"} cleared, since a ${kind === hireKind ? "planned hire" : "person"} doesn't have ${record.cleared.length === 1 ? "it" : "them"}.`}
            </Text>
          </div>
          <section aria-labelledby="new-record-details">
            <h3 className={classes.heading} id="new-record-details">
              Details
            </h3>
            <dl className={classes.list}>{details.map(rowOf)}</dl>
          </section>
          <section aria-labelledby="new-record-reporting">
            <h3 className={classes.heading} id="new-record-reporting">
              Reporting
            </h3>
            <dl className={classes.list}>{reporting.map(rowOf)}</dl>
          </section>
          {added.length > 0 && (
            <section aria-labelledby="new-record-columns">
              <h3 className={classes.heading} id="new-record-columns">
                Columns
              </h3>
              <dl className={classes.list}>{added.map(rowOf)}</dl>
            </section>
          )}
          <Group justify="flex-end" gap="xs">
            <Button variant="default" onClick={onCancel} disabled={adding}>
              Cancel
            </Button>
            <Button onClick={add} loading={adding}>
              Add
            </Button>
          </Group>
        </Stack>
      </div>
    </SidePanelFrame>
  );
}
