// SPDX-License-Identifier: Apache-2.0

// Reading records' key numbers, which the database gives each record when it's added or drafted to
// be added, as the Decisions Log sets out. Part of the data access layer; a number tells nothing
// about its record, so reading one needs no permission, but the caller checks the actor may see the
// record it sends the number with.

import type { Database } from "@fathom/db";
import { recordKeys } from "@fathom/db";
import type { RecordKeyKind } from "@fathom/shared";
import { and, eq, inArray } from "drizzle-orm";

type Reader = Pick<Database, "select">;

// Each record's key number, by its identifier.
export type KeyNumbers = ReadonlyMap<string, number>;

// The key numbers of a kind's records, of those named or of all of them.
export async function readKeyNumbers(
  reader: Reader,
  kind: RecordKeyKind,
  ids?: readonly string[],
): Promise<Map<string, number>> {
  if (ids?.length === 0) return new Map();
  const rows = await reader
    .select({ recordId: recordKeys.recordId, keyNumber: recordKeys.keyNumber })
    .from(recordKeys)
    .where(
      and(
        eq(recordKeys.kind, kind),
        ids === undefined ? undefined : inArray(recordKeys.recordId, [...ids]),
      ),
    );
  return new Map(rows.map((row) => [row.recordId, row.keyNumber]));
}

// The key numbers of every record of several kinds, by kind.
export async function readKindsKeyNumbers(
  reader: Reader,
  kinds: readonly RecordKeyKind[],
): Promise<ReadonlyMap<string, Map<string, number>>> {
  const byKind = new Map<string, Map<string, number>>(
    kinds.map((kind) => [kind, new Map()]),
  );
  const rows = await reader
    .select()
    .from(recordKeys)
    .where(inArray(recordKeys.kind, [...kinds]));
  for (const row of rows) {
    byKind.get(row.kind)?.set(row.recordId, row.keyNumber);
  }
  return byKind;
}

// One record's key number.
export const readKeyNumber = async (
  reader: Reader,
  kind: RecordKeyKind,
  id: string,
): Promise<number> => keyNumberOf(await readKeyNumbers(reader, kind, [id]), id);

// The record a kind's key number names, whether or not it is still kept, or undefined when no
// record has had it.
export async function readKeyedRecord(
  reader: Reader,
  kind: RecordKeyKind,
  keyNumber: number,
): Promise<string | undefined> {
  const [row] = await reader
    .select({ recordId: recordKeys.recordId })
    .from(recordKeys)
    .where(and(eq(recordKeys.kind, kind), eq(recordKeys.keyNumber, keyNumber)));
  return row?.recordId;
}

// A record's key number. Every record of a kind with keys has one from the moment it's added or
// drafted, so one missing means the database's triggers were bypassed.
export function keyNumberOf(keys: KeyNumbers, id: string): number {
  const keyNumber = keys.get(id);
  if (keyNumber === undefined) {
    throw new Error(`Record ${id} has no key number`);
  }
  return keyNumber;
}
