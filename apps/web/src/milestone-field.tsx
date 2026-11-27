// SPDX-License-Identifier: Apache-2.0

// A field of the Projects page's milestone dialog: its name, date, and whether it is a delivery to
// customers.

import { Checkbox } from "@mantine/core";
import type { ReactElement } from "react";
import { toggledFlag } from "./cell-kinds.tsx";
import { ClearableInput } from "./clearable-input.tsx";
import { daySample, typeFor } from "@fathom/shared";
import { DayInput } from "./day-input.tsx";
import type { PlanChange } from "./plan-table.tsx";
import type { Column, GridRecord } from "./record-table.ts";
import type { CellValue, Kind } from "./table-view.ts";

type MilestoneFieldKind = Extract<Kind, "text" | "date" | "flag">;

type MilestoneFieldColumn = Pick<
  Column<GridRecord, PlanChange>,
  "key" | "label" | "required" | "maxLength"
> & { kind: MilestoneFieldKind };

export const isMilestoneField = <Field extends { kind: Kind }>(
  column: Field,
): column is Field & { kind: MilestoneFieldKind } =>
  column.kind === "text" || column.kind === "date" || column.kind === "flag";

export function MilestoneField({
  column,
  value,
  problem,
  onChange,
}: {
  column: MilestoneFieldColumn;
  value: CellValue;
  problem: string | undefined;
  onChange: (value: CellValue) => void;
}): ReactElement {
  const id = `milestone-field-${column.key}`;
  switch (column.kind) {
    case "text":
      return (
        <ClearableInput
          id={id}
          label={column.label}
          required={column.required}
          data-autofocus
          maxLength={column.maxLength}
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
          notADay={typeFor("date", column.label, daySample)}
          shown={problem !== undefined}
          onChange={(day) => {
            onChange(day ?? "");
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
  }
}
