// SPDX-License-Identifier: Apache-2.0

// Recording an export in the access history.

import type { Database } from "@fathom/db";
import {
  type ClassifiedColumns,
  classifiedData,
  classifiedFieldNames,
  classNames,
  columnTablePolicies,
  type ExportRecorded,
  type ExportRequest,
  type FixedClassTable,
  fixedClassTables,
  heldTiers,
  isFixedClassTable,
  seesEmployment,
} from "@fathom/shared";
import { type Actor, requirePermission, seesSensitivity } from "../access.ts";
import { BadRequestError, ConflictError, ForbiddenError } from "../errors.ts";
import { columnsWithAdded } from "./added-columns.ts";
import { recordEvent } from "./history.ts";
import { columnClasses } from "./values.ts";

// Said when an export names the hiring plan to a role it isn't sent to.
const unseenPlan = "This file holds the hiring plan, which this role can't see";

// Said when the page names a column the server no longer has, such as one removed since it opened,
// whose class can't be checked.
const changedColumns =
  "The table's columns have changed since the page opened. Reload the page and export again.";

// Said when an export of a table whose rows hold nothing apart from their columns names details.
const noDetails = "This table's rows hold no details apart from their columns";

// An export of a table whose columns' classes are fixed. Everyone the table is shown to sees all its
// columns, so it is recorded but never refused for their classes.
async function recordFixedExport(
  database: Database,
  actor: Actor,
  table: (typeof fixedClassTables)[FixedClassTable],
  { columns, details }: ExportRequest,
): Promise<ExportRecorded> {
  requirePermission(actor, table.viewNeeds);
  if (details.length > 0) throw new BadRequestError(noDetails);
  const held = classifiedData(
    columns.map((key) => {
      const column = table.columns.get(key);
      if (column === undefined) throw new ConflictError(changedColumns);
      return column;
    }),
  );
  return recordHeld(database, actor, table.name, held);
}

// Records an export holding Personal or Confidential data, naming the table and those columns.
async function recordHeld(
  database: Database,
  actor: Actor,
  exported: string,
  held: ClassifiedColumns,
): Promise<ExportRecorded> {
  if (heldTiers(held).length === 0) return { recorded: false };
  const { personal = [], confidential = [] } = held;
  await recordEvent(database, {
    actorId: actor.user.id,
    action: "data-exported",
    subjectId: null,
    details: {
      exported,
      ...(personal.length > 0 ? { personalColumns: [...personal] } : {}),
      ...(confidential.length > 0
        ? { confidentialColumns: [...confidential] }
        : {}),
    },
  });
  return { recorded: true };
}

export async function recordExport(
  database: Database,
  actor: Actor,
  { table, columns, details }: ExportRequest,
): Promise<ExportRecorded> {
  if (isFixedClassTable(table)) {
    // The table is one of the fixed tables, each a key of the policies.
    // eslint-disable-next-line security/detect-object-injection
    const fixed = fixedClassTables[table];
    return recordFixedExport(database, actor, fixed, {
      table,
      columns,
      details,
    });
  }
  // The table is one of the typed tables, each a key of the policies.
  // eslint-disable-next-line security/detect-object-injection
  const policy = columnTablePolicies[table];
  requirePermission(actor, policy.viewNeeds);
  // A table whose data is all General holds nothing to record.
  if (policy.generalOnly) return { recorded: false };
  // The columns drafted to be added that the actor sees are exported too, and every class is read
  // in one snapshot, so the classes checked are the ones the page was sent.
  const shown = await database.transaction(
    async (transaction) => columnsWithAdded(transaction, actor.user.id),
    { isolationLevel: "repeatable read", accessMode: "read only" },
  );
  const byKey = columnClasses(shown);
  // A role sent the hiring plan but not people's dates is sent a Start column holding only planned
  // hires' target dates, which are the plan.
  const startIsPlan =
    table === "people" &&
    !seesEmployment(actor) &&
    seesSensitivity(actor, "hiring-plan");
  if (
    details.includes("hiringPlan") &&
    !seesSensitivity(actor, "hiring-plan")
  ) {
    throw new ForbiddenError(unseenPlan);
  }
  const held = classifiedData([
    ...details.map((field) => ({
      // The field is always one of the fixed fields.
      // eslint-disable-next-line security/detect-object-injection
      name: classifiedFieldNames[field],
      // eslint-disable-next-line security/detect-object-injection
      dataClass: shown.dataClasses[field],
    })),
    ...columns.map((key) => {
      const column = byKey.get(key);
      if (column === undefined) throw new ConflictError(changedColumns);
      if (startIsPlan && key === "startDate") {
        return { name: column.name, dataClass: shown.dataClasses.hiringPlan };
      }
      return { name: column.name, dataClass: column.tier };
    }),
  ]);
  const unseen = heldTiers(held).find((tier) => !seesSensitivity(actor, tier));
  if (unseen !== undefined) {
    throw new ForbiddenError(
      // eslint-disable-next-line security/detect-object-injection
      `This file holds ${classNames[unseen]} data, which this role can't see`,
    );
  }
  return recordHeld(database, actor, policy.name, held);
}
