// SPDX-License-Identifier: Apache-2.0

// Records an export of a table holding Personal or Confidential data in the access history. The
// browser makes the file from what it was sent, so the server only records it, finding each
// column's class and name itself, so an entry says only what the server holds.

import type { Database } from "@fathom/db";
import {
  classifiedData,
  classifiedFieldNames,
  classNames,
  columnTablePolicies,
  type ExportRecorded,
  type ExportRequest,
  heldTiers,
} from "@fathom/shared";
import { type Actor, requirePermission, seesSensitivity } from "../access.ts";
import { ConflictError, ForbiddenError } from "../errors.ts";
import { columnsWithAdded } from "./added-columns.ts";
import { recordEvent } from "./history.ts";
import { columnClasses } from "./values.ts";

// Said when the page names a column the server no longer has, such as one removed since it opened,
// whose class can't be checked.
const changedColumns =
  "The table's columns have changed since the page opened. Reload the page and export again.";

export async function recordExport(
  database: Database,
  actor: Actor,
  { table, columns, details }: ExportRequest,
): Promise<ExportRecorded> {
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
      return { name: column.name, dataClass: column.tier };
    }),
  ]);
  const tiers = heldTiers(held);
  const unseen = tiers.find((tier) => !seesSensitivity(actor, tier));
  if (unseen !== undefined) {
    throw new ForbiddenError(
      // eslint-disable-next-line security/detect-object-injection
      `This file holds ${classNames[unseen]} data, which this role can't see`,
    );
  }
  if (tiers.length === 0) return { recorded: false };
  const { personal = [], confidential = [] } = held;
  await recordEvent(database, {
    actorId: actor.user.id,
    action: "data-exported",
    subjectId: null,
    details: {
      exported: policy.name,
      ...(personal.length > 0 ? { personalColumns: [...personal] } : {}),
      ...(confidential.length > 0
        ? { confidentialColumns: [...confidential] }
        : {}),
    },
  });
  return { recorded: true };
}
