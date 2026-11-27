// SPDX-License-Identifier: Apache-2.0

// The change history's record of the fictional organization's records added or removed, with the
// fields of a person as the server records them, for the seed data generator.

import { valueField } from "@fathom/db";
import type { FictionalOrganization } from "@fathom/fixtures";
import {
  filledIn,
  recorded as recordedFields,
  type SeededChange,
} from "./recorded.ts";

// The changes that record a record's fields being created or deleted.
export function recorded(
  recordType: string,
  recordId: string,
  action: SeededChange["action"],
  values: Record<string, unknown>,
  personalFieldNames: readonly string[] = [],
  tiers: ReadonlyMap<string, string> = new Map(),
): SeededChange[] {
  return recordedFields(
    recordType,
    recordId,
    action,
    filledIn(values),
    (field) =>
      personalFieldNames.includes(field)
        ? "personal"
        : (tiers.get(field) ?? "general"),
  );
}

// The fields of a person that are Personal: their dates, and their manager, as the server records
// them.
export const personalDetailFields = [
  "startDate",
  "endDate",
  "managerId",
  "managerFrom",
];

// A person's current line and their team's name, as the server records them.
export interface Reporting {
  managerId?: string | null;
  managerFrom?: string;
  teamName?: string;
}

export function reportingOf(
  line: { managerId: string | null; fromDate: string } | undefined,
  teamName: string | undefined,
): Reporting {
  return {
    ...(line === undefined
      ? {}
      : { managerId: line.managerId, managerFrom: line.fromDate }),
    ...(teamName === undefined ? {} : { teamName }),
  };
}

export function personFields(
  person: FictionalOrganization["people"][number],
  reporting: Reporting = {},
) {
  return {
    preferredName: person.preferredName,
    employeeId: person.employeeId,
    positionId: person.positionId,
    startDate: person.startDate,
    endDate: person.endDate,
    isManager: person.isManager,
    ...reporting,
    ...Object.fromEntries(
      Object.entries(person.values).map(([columnId, chosen]) => [
        valueField(columnId),
        chosen,
      ]),
    ),
    ...Object.fromEntries(
      Object.entries(person.notes).map(([columnId, note]) => [
        valueField(columnId),
        note,
      ]),
    ),
  };
}
