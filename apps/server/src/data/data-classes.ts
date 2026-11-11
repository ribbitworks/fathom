// SPDX-License-Identifier: Apache-2.0

// The classes the organization keeps its data in, and moving data between them with Classify data:
// built-in details, lists, and columns with a class of their own. Part of the data access layer.
// A move takes effect at once, as a change to a role does, rather than as a draft, and is recorded
// in the access history, where it is worth checking, and lists' and columns' moves in the change
// history too. A draft of a live list or column never holds its class, so approving one never
// moves it back.

import { dataClasses as classesTable, type Database } from "@fathom/db";
import {
  type ClassifiedField,
  classifiedFieldNames,
  classifiedFieldSchema,
  type DataClasses,
  defaultClasses,
  type Tier,
  needsClassify,
  whyNoMove,
} from "@fathom/shared";
import { sql } from "drizzle-orm";
import { type Actor, storedTier } from "../access.ts";
import { BadRequestError, ForbiddenError } from "../errors.ts";
import type { Transaction } from "./changes.ts";
import { recordEvent } from "./history.ts";

type Reader = Pick<Database, "select">;

// The class of each built-in detail: as stored once moved, or else its default. A class the server
// no longer knows is treated as the most sensitive, rather than trusted.
export async function readDataClasses(reader: Reader): Promise<DataClasses> {
  const rows = await reader.select().from(classesTable);
  const stored = new Map(rows.map((row) => [row.field, row.dataClass]));
  const classes = { ...defaultClasses };
  for (const field of classifiedFieldSchema.options) {
    if (stored.has(field)) {
      // The field is always one of the fixed fields.
      // eslint-disable-next-line security/detect-object-injection
      classes[field] = storedTier(stored.get(field));
    }
  }
  return classes;
}

// Refuses a role without Classify data, before what it would move is read.
export function requireClassify(actor: Actor): void {
  if (!actor.permissions.includes("data:classify")) {
    throw new ForbiddenError(needsClassify);
  }
}

export function requireMove(actor: Actor, from: Tier, to: Tier): void {
  const why = whyNoMove(actor.permissions, from, to);
  if (why !== undefined) throw new ForbiddenError(why);
}

// Records a move in the access history, naming what moved as it is named now.
export async function recordMove(
  transaction: Transaction,
  actor: Actor,
  moved: string,
  from: Tier,
  to: Tier,
): Promise<void> {
  await recordEvent(transaction, {
    actorId: actor.user.id,
    action: "data-class-moved",
    subjectId: null,
    details: { moved, dataClass: to, previousDataClass: from },
  });
}

export async function moveFieldClass(
  database: Database,
  actor: Actor,
  field: ClassifiedField,
  to: Tier,
): Promise<DataClasses> {
  requireClassify(actor);
  return database.transaction(async (transaction) => {
    // Two moves at once take turns, so each records the class it really moved from.
    await transaction.execute(
      sql`SELECT pg_advisory_xact_lock(hashtextextended('fathom.data-classes', 0))`,
    );
    const classes = await readDataClasses(transaction);
    // The field is always one of the fixed fields.
    // eslint-disable-next-line security/detect-object-injection
    const from = classes[field];
    requireMove(actor, from, to);
    if (from === to) return classes;
    await transaction
      .insert(classesTable)
      .values({ field, dataClass: to })
      .onConflictDoUpdate({
        target: classesTable.field,
        set: { dataClass: to },
      });
    // The field is always one of the fixed fields.
    // eslint-disable-next-line security/detect-object-injection
    await recordMove(transaction, actor, classifiedFieldNames[field], from, to);
    return { ...classes, [field]: to };
  });
}

// A list or column drafted with a class: a new one starts General, and takes another class only
// with Classify data, recorded as a move; one already approved keeps its class in drafts, since it
// is moved on its own.
export async function classifyDraft(
  transaction: Transaction,
  actor: Actor,
  draft: { live: boolean; name: string; moved: string; from: Tier; to: Tier },
): Promise<void> {
  const { live, name, moved, from, to } = draft;
  if (from === to) return;
  if (live) {
    throw new BadRequestError(
      `${name} is already approved, so it changes class only by a move, not in a draft`,
    );
  }
  requireMove(actor, from, to);
  await recordMove(transaction, actor, moved, from, to);
}
