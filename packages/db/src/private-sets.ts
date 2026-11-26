// SPDX-License-Identifier: Apache-2.0

// Each user's set of private changes, made with their first one.

import { randomUUID } from "node:crypto";
import { eq, sql } from "drizzle-orm";
import type { Database } from "./client.ts";
import { privateSets } from "./schema.ts";

// The user's set of private changes, made if they have none. It waits for the user's other changes,
// so two can't each make one.
export async function privateSetOf(
  transaction: Pick<Database, "execute" | "select" | "insert">,
  userId: string,
): Promise<string> {
  await transaction.execute(
    sql`SELECT pg_advisory_xact_lock(hashtextextended(${`fathom.private_sets:${userId}`}, 0))`,
  );
  const [kept] = await transaction
    .select({ id: privateSets.id })
    .from(privateSets)
    .where(eq(privateSets.userId, userId))
    .orderBy(privateSets.madeAt)
    .limit(1);
  if (kept !== undefined) return kept.id;
  const id = randomUUID();
  await transaction.insert(privateSets).values({ id, userId });
  return id;
}
