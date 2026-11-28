// SPDX-License-Identifier: Apache-2.0

// The records link columns link to: refusing a record asked for that its table doesn't hold, and the
// removal of a record a value still links to. Part of the data access layer.

import { features, fields, fieldValues, people, type Reader } from "@fathom/db";
import { type LinkedTable, linkedTableSchema } from "@fathom/shared";
import { and, eq, inArray, isNull, notInArray, or } from "drizzle-orm";
import { BadRequestError, ConflictError } from "../errors.ts";
import { linkedValueColumns } from "./column-types.ts";
import type { ColumnInfo } from "./values.ts";

// Each table a column links to, with the values table's column its records hold values in.
const linkedTables = {
  people: { table: people, id: people.id, owns: fieldValues.personId },
  features: { table: features, id: features.id, owns: fieldValues.featureId },
} as const satisfies Record<LinkedTable, object>;

// Refuses records asked for in link columns that their tables don't hold, such as one removed since
// the page was read, reading each table once.
export async function refuseUnknownRecords(
  reader: Reader,
  columns: readonly ColumnInfo[],
  requested: Readonly<Record<string, readonly string[] | null>> | undefined,
): Promise<void> {
  const asked = Object.entries(requested ?? {}).flatMap(([columnId, ids]) => {
    const column = columns.find(({ id }) => id === columnId);
    const table = linkedTableSchema.safeParse(column?.linkedTable);
    return column === undefined || !table.success || ids === null
      ? []
      : [{ column, table: table.data, ids }];
  });
  for (const tableName of linkedTableSchema.options) {
    const ids = asked
      .filter(({ table }) => table === tableName)
      .flatMap((one) => one.ids);
    if (ids.length === 0) continue;
    // The table is one of the fixed linked tables.
    // eslint-disable-next-line security/detect-object-injection
    const { table, id } = linkedTables[tableName];
    const held = new Set(
      (
        await reader
          .select({ id })
          .from(table)
          .where(inArray(id, [...new Set(ids)]))
      ).map((row) => row.id),
    );
    const unknown = asked.find(
      (one) =>
        one.table === tableName && one.ids.some((linked) => !held.has(linked)),
    );
    if (unknown !== undefined) {
      throw new BadRequestError(
        `${unknown.column.name} links to a record that no longer exists`,
      );
    }
  }
}

// Refuses removing records of a table while a value links to one, as a choice in use can't be
// removed, unless the record holding the value is removed with them.
export async function refuseLinkedRemovals(
  reader: Reader,
  tableName: LinkedTable,
  removed: readonly string[],
): Promise<void> {
  if (removed.length === 0) return;
  // The table is one of the fixed linked tables.
  // eslint-disable-next-line security/detect-object-injection
  const { owns } = linkedTables[tableName];
  // eslint-disable-next-line security/detect-object-injection
  const linked = fieldValues[linkedValueColumns[tableName]];
  const [inUse] = await reader
    .select({ column: fields.name })
    .from(fieldValues)
    .innerJoin(fields, eq(fields.id, fieldValues.fieldId))
    .where(
      and(
        inArray(linked, [...removed]),
        or(isNull(owns), notInArray(owns, [...removed])),
      ),
    )
    .limit(1);
  if (inUse !== undefined) {
    throw new ConflictError(
      `This is linked from ${inUse.column}; remove that link first`,
    );
  }
}
