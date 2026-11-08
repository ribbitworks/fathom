// SPDX-License-Identifier: Apache-2.0

// Adding a customer, proposal, project, or milestone in the panel beside its table: a field for each
// column a new record has, its value checked as a new row's is, with any problem named under its
// field, and Add and Cancel at the foot. The page holds what has been entered, so it can ask before
// discarding it.

import {
  Button,
  Checkbox,
  Group,
  MultiSelect,
  Select,
  Stack,
} from "@mantine/core";
import { isLink, linkProblems } from "@fathom/shared";
import {
  type ReactElement,
  type SubmitEvent,
  useEffect,
  useState,
} from "react";
import { cellKinds, toggledFlag } from "./cell-kinds.tsx";
import { ClearableInput } from "./clearable-input.tsx";
import { DayInput } from "./day-input.tsx";
import { focusSoon } from "./focus.ts";
import type { PlanChange } from "./project-grids.tsx";
import {
  type Column,
  columnsOn,
  type GridRecord,
  newRecordProblems,
  readOnlyFor,
  type RecordTable,
} from "./record-grid.tsx";
import { SidePanelFrame, sidePanelScroll } from "./side-panel.tsx";
import type { CellValue } from "./table-view.ts";

export type FormValues = Readonly<Record<string, CellValue>>;

type FieldColumn = Pick<
  Column<GridRecord, PlanChange>,
  "key" | "label" | "kind" | "required" | "multiple" | "choices"
>;

const titleId = "new-plan-record-title";
const fieldId = (column: Pick<FieldColumn, "key">) =>
  `new-plan-record-${column.key}`;

function Field({
  column,
  value,
  problem,
  onChange,
}: {
  column: FieldColumn;
  value: CellValue;
  problem: string | undefined;
  onChange: (value: CellValue) => void;
}): ReactElement | null {
  const id = fieldId(column);
  const common = { id, label: column.label, required: column.required };
  const offered = column.choices
    .filter(({ retired }) => !retired)
    .map((choice) => ({ value: choice.id, label: choice.label }));
  switch (column.kind) {
    case "text":
      return (
        <ClearableInput
          {...common}
          clearLabel={`Clear ${column.label}`}
          onClear={() => {
            onChange("");
          }}
          autoComplete="off"
          value={value as string}
          error={problem}
          onChange={(event) => {
            onChange(event.currentTarget.value);
          }}
        />
      );
    case "date":
      return (
        <DayInput
          id={id}
          label={column.label}
          required={column.required}
          value={value === "" ? undefined : (value as string)}
          problem={problem}
          shown={problem !== undefined}
          onChange={(day) => {
            onChange(day ?? "");
          }}
        />
      );
    case "choice":
      return column.multiple ? (
        <MultiSelect
          {...common}
          searchable
          data={offered}
          value={value as string[]}
          error={problem}
          onChange={onChange}
        />
      ) : (
        <Select
          {...common}
          searchable
          clearable={!column.required}
          data={offered}
          value={(value as string[]).at(0) ?? null}
          error={problem}
          onChange={(chosen) => {
            onChange(chosen === null ? [] : [chosen]);
          }}
        />
      );
    case "link":
      return (
        <ClearableInput
          {...common}
          clearLabel={`Clear ${column.label}`}
          onClear={() => {
            onChange(null);
          }}
          autoComplete="off"
          value={isLink(value) ? value.address : ""}
          error={problem}
          onChange={(event) => {
            const address = event.currentTarget.value;
            onChange(address === "" ? null : { address, text: "" });
          }}
        />
      );
    case "flag":
      return (
        <Checkbox
          id={id}
          label={column.label}
          checked={(value as string[]).length > 0}
          onChange={() => {
            onChange(toggledFlag(value));
          }}
        />
      );
    case "note":
      return null;
  }
}

export function NewPlanRecordPanel<Rec extends GridRecord, Request>({
  title,
  table,
  records,
  values,
  saving,
  narrow,
  panelId,
  onValues,
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
  onValues: (values: FormValues) => void;
  onAdd: (request: Request) => void;
  onCancel: () => void;
}) {
  const kind = table.kinds?.[0] ?? "";
  // A new record's values follow from nothing else, so it has no columns that only show them.
  const columns = columnsOn(table.columnsFor([], [], [], records), kind).filter(
    (column) => !readOnlyFor(column, kind),
  );
  const [problems, setProblems] = useState<ReadonlyMap<string, string>>(
    new Map(),
  );
  const valueOf = (column: Column<Rec, PlanChange>): CellValue =>
    values[column.key] ??
    column.newRowValue?.(kind) ??
    cellKinds[column.kind].empty;
  useEffect(() => {
    focusSoon(titleId);
  }, []);
  const add = (event: SubmitEvent) => {
    event.preventDefault();
    const found = [
      ...newRecordProblems(
        columns,
        kind,
        Object.fromEntries(
          columns.map((column) => [column.key, valueOf(column)]),
        ),
        table.recordProblem,
        () => [],
      ),
      ...columns.flatMap((column) => {
        const value = valueOf(column);
        const message = isLink(value) ? linkProblems(value).address : undefined;
        return message === undefined ? [] : [{ column: column.key, message }];
      }),
    ];
    setProblems(new Map(found.map(({ column, message }) => [column, message])));
    const first = columns.find(({ key }) =>
      found.some(({ column }) => column === key),
    );
    if (first !== undefined) {
      focusSoon(fieldId(first));
      return;
    }
    onAdd(
      table.request(
        columns.map((column) => column.change(valueOf(column))),
        kind,
      ),
    );
  };
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
      <form
        className={sidePanelScroll}
        inert={saving}
        noValidate
        onSubmit={add}
      >
        <Stack gap="md">
          {columns.map((column) => (
            <Field
              key={column.key}
              column={column}
              value={valueOf(column)}
              problem={problems.get(column.key)}
              onChange={(value) => {
                setProblems(
                  new Map([...problems].filter(([key]) => key !== column.key)),
                );
                onValues({ ...values, [column.key]: value });
              }}
            />
          ))}
          <Group justify="flex-end" gap="xs">
            <Button variant="default" onClick={onCancel} disabled={saving}>
              Cancel
            </Button>
            <Button type="submit" loading={saving}>
              Add
            </Button>
          </Group>
        </Stack>
      </form>
    </SidePanelFrame>
  );
}
