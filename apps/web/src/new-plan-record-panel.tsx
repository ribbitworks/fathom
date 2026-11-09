// SPDX-License-Identifier: Apache-2.0

// Adding a customer, proposal, project, or milestone in the panel beside its table: a form field for
// each column a new record has, with any problem Add finds named under its field. The Projects
// page's milestone dialog draws the same fields.

import { Checkbox, MultiSelect, Select } from "@mantine/core";
import { isLink } from "@fathom/shared";
import { type ReactElement, useState } from "react";
import { toggledFlag } from "./cell-kinds.tsx";
import { ClearableInput } from "./clearable-input.tsx";
import { DayInput } from "./day-input.tsx";
import { focusSoon } from "./focus.ts";
import {
  type FormValues,
  newRecordFields,
  NewRecordPanel,
} from "./new-record-panel.tsx";
import type { PlanChange } from "./project-grids.tsx";
import type { Column, GridRecord, RecordTable } from "./record-grid.tsx";
import type { CellValue } from "./table-view.ts";

type FieldColumn = Pick<
  Column<GridRecord, PlanChange>,
  "key" | "label" | "kind" | "required" | "multiple" | "choices" | "maxLength"
>;

const fieldId = (column: Pick<FieldColumn, "key">) =>
  `new-plan-record-${column.key}`;

// The plan's records are checked on their own, not beside each other.
export const noOthers = () => [];

export function PlanField({
  column,
  value,
  problem,
  firstInDialog = false,
  onChange,
}: {
  column: FieldColumn;
  value: CellValue;
  problem: string | undefined;
  // Set for a text field first in a dialog: it takes focus, and stops at its column's length.
  firstInDialog?: boolean | undefined;
  onChange: (value: CellValue) => void;
}): ReactElement | null {
  const id = fieldId(column);
  const common = { id, label: column.label, required: column.required };
  const offered = column.choices
    .filter(({ retired }) => !retired)
    .map((choice) => ({ value: choice.id, label: choice.label }));
  switch (column.kind) {
    case "text":
    case "month":
      return (
        <ClearableInput
          {...common}
          {...(firstInDialog
            ? { "data-autofocus": true, maxLength: column.maxLength }
            : {})}
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
  const {
    columns,
    valueOf,
    values: shown,
  } = newRecordFields(table.columnsFor([], [], [], records), kind, values);
  const [problems, setProblems] = useState<ReadonlyMap<string, string>>(
    new Map(),
  );
  return (
    <NewRecordPanel
      panelId={panelId}
      title={title}
      narrow={narrow}
      saving={saving}
      gap="md"
      enterAdds
      table={table}
      columns={columns}
      kind={kind}
      values={shown}
      others={noOthers}
      onRefused={(found) => {
        setProblems(
          new Map(found.map(({ column, message }) => [column, message])),
        );
        // Every problem is in one of the columns shown.
        const first = columns.find(({ key }) =>
          found.some(({ column }) => column === key),
        ) as (typeof columns)[number];
        focusSoon(fieldId(first));
      }}
      onAdd={(request) => {
        setProblems(new Map());
        onAdd(request);
      }}
      onCancel={onCancel}
    >
      {columns.map((column) => (
        <PlanField
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
    </NewRecordPanel>
  );
}
