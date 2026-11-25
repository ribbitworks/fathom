// SPDX-License-Identifier: Apache-2.0

// What is wrong with a People row's details, and the request a new or changed row sends.

import { dayNeeded } from "./day-input.tsx";
import type { List } from "@fathom/shared";
import { sameName, temporaryIdPrefix } from "@fathom/shared";
import { cellRequest } from "./added-columns.ts";
import { columnsOn } from "./grid-columns.tsx";
import type { RowProblem } from "./record-table.ts";
import {
  type RowChange,
  type RowRequest,
  stateMeaning,
  personKind,
  hireKind,
} from "./people-rows.ts";
import type { CellValue } from "./table-view.ts";
import type { Column } from "./people-grid.tsx";

// What is wrong with a person's details taken together, if anything, and in which column: an
// Employee ID someone else has, an end date before the start date, marked in the date changed, or
// in the end date, or a manager without the date they are the person's manager from, or that date
// given to someone with no manager and no line to move, such as someone added. The Employee ID is
// checked when it is what changed, or when a person is added.
export function recordProblem(
  values: Record<string, CellValue>,
  others: () => Record<string, CellValue>[],
  changed?: string,
  before?: Record<string, CellValue>,
): RowProblem | undefined {
  const employeeId = values.employeeId;
  const checksId = changed === undefined || changed === "employeeId";
  if (
    checksId &&
    typeof employeeId === "string" &&
    employeeId.trim().toLowerCase().startsWith(temporaryIdPrefix.toLowerCase())
  ) {
    return {
      message: `An ID cannot start with ${temporaryIdPrefix}, which temporary IDs use`,
      column: "employeeId",
    };
  }
  if (
    checksId &&
    typeof employeeId === "string" &&
    employeeId.trim() !== "" &&
    others().some(
      (other) =>
        typeof other.employeeId === "string" &&
        sameName(other.employeeId, employeeId),
    )
  ) {
    return {
      message: "Someone already has that ID",
      column: "employeeId",
    };
  }
  const { startDate, endDate } = values;
  if (
    typeof startDate === "string" &&
    typeof endDate === "string" &&
    startDate !== "" &&
    endDate !== "" &&
    endDate < startDate
  ) {
    return {
      message: "The end date cannot be before the start date",
      column: changed === "startDate" ? "startDate" : "endDate",
    };
  }
  const manager = values.managerId;
  const from = values.managerFrom;
  const managed = Array.isArray(manager) && manager.length > 0;
  if (changed === "managerFrom" && managed && from === "") {
    return { message: dayNeeded, column: "managerFrom" };
  }
  // A line with no manager may move, but someone with no line has none to move.
  const noLine = changed === undefined || before?.managerFrom === "";
  if (noLine && !managed && typeof from === "string" && from !== "") {
    return {
      message: "Choose a manager, or leave Manager assigned empty",
      column: "managerFrom",
    };
  }
  return undefined;
}

// The kind of record a state makes a new row: a planned hire for a state meaning Proposed or Open,
// and a person for one meaning Hired or Left.
export function kindOfState(
  lists: readonly List[],
  stateId: string | undefined,
): string | undefined {
  return kindOfMeaning(stateMeaning(lists, stateId));
}

// The kind of record a state's meaning is for: a planned hire is Proposed or Open, and a person
// Hired or Left.
export function kindOfMeaning(
  meaning: string | null | undefined,
): string | undefined {
  if (meaning === "proposed" || meaning === "open") return hireKind;
  if (meaning === "hired" || meaning === "left") return personKind;
  return undefined;
}

// The request that adds a record of a kind, from its value in each column the kind has.
export function newRecordRequest(
  columns: readonly Column[],
  kind: string,
  values: Readonly<Record<string, CellValue>>,
): RowRequest {
  return requestFromChanges(
    columnsOn(columns, kind).map((column) =>
      column.change(values[column.key] as CellValue),
    ),
    kind,
  );
}

// The request that adds a record of a kind, from each column's change.
export const requestFromChanges = (
  changes: readonly RowChange[],
  kind: string,
): RowRequest => ({
  ...requestFor(changes),
  ...(kind === hireKind ? { kind } : {}),
});

// The request that adds a person or planned hire, from each column's value as its kind would save
// it, with every choice column named and no link left empty.
function requestFor(parts: readonly RowChange[]): RowRequest {
  // Every table that adds people has its name, Employee ID, Position and Manager columns, since
  // those who cannot see positions add none, and its dates together or not at all.
  const {
    preferredName,
    employeeId,
    positionId,
    startDate,
    endDate,
    managerId,
    managerFrom,
    teamName,
    isManager,
    stateId,
  } = Object.assign({}, ...parts) as RowRequest;
  return {
    preferredName,
    employeeId,
    positionId,
    ...(stateId === undefined ? {} : { stateId }),
    ...(startDate === undefined ? {} : { startDate, endDate }),
    ...(managerId == null
      ? {}
      : { managerId, ...(managerFrom === undefined ? {} : { managerFrom }) }),
    ...(teamName == null || teamName === "" ? {} : { teamName }),
    ...(isManager === true ? { isManager } : {}),
    ...cellRequest(parts),
  };
}
