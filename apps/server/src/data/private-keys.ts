// SPDX-License-Identifier: Apache-2.0

// The random keys of private pages and rows: making one with its record, and finding what a key
// names for a link. Part of the data access layer.

import {
  type Database,
  privatePages,
  privateRows,
  randomKeys,
} from "@fathom/db";
import type {
  CodedRecordKey,
  RandomKeyKind,
  RecordLookup,
} from "@fathom/shared";
import { and, eq, sql } from "drizzle-orm";
import type { Actor } from "../access.ts";
import type { Transaction } from "./changes.ts";
import { mayRead } from "./private-page-reads.ts";

// Gives a new page or row its key, which only the database makes.
export async function makeRandomKey(
  transaction: Transaction,
  kind: RandomKeyKind,
  recordId: string,
): Promise<void> {
  await transaction.execute(
    sql`SELECT "fathom"."random_key"(${kind}, ${recordId}::uuid)`,
  );
}

const nothing: RecordLookup = { result: "nothing" };

// What a page's or row's key opens, read in one query whatever the key names, so the answer and its
// time are the same for a key nobody made, a record removed, and one the reader may not read: the
// page check alone decides, and anything it refuses is nothing.
export async function findPrivateRecord(
  database: Database,
  actor: Actor,
  { kind, code }: CodedRecordKey,
): Promise<RecordLookup> {
  const [found] = await database
    .select({
      recordId: randomKeys.recordId,
      pageId: privatePages.id,
      userId: privatePages.userId,
    })
    .from(randomKeys)
    .leftJoin(
      privateRows,
      and(eq(randomKeys.kind, "row"), eq(privateRows.id, randomKeys.recordId)),
    )
    .leftJoin(
      privatePages,
      eq(
        privatePages.id,
        sql`coalesce(${privateRows.pageId}, ${randomKeys.recordId})`,
      ),
    )
    .where(and(eq(randomKeys.kind, kind), eq(randomKeys.code, code)));
  const pageId = found?.pageId ?? null;
  if (
    found === undefined ||
    pageId === null ||
    !mayRead(actor, { userId: String(found.userId) })
  ) {
    return nothing;
  }
  return { result: "found", kind, id: found.recordId, pageId };
}
