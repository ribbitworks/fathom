// SPDX-License-Identifier: Apache-2.0

// Which changes to private pages, their columns and rows, the change history shows: only those to
// records on the reader's own pages, while their role may make pages, and in classes they see. A
// record's page and its maker are read from the history itself, so a removed page's changes stay
// its maker's. Part of the data access layer.

import { changes } from "@fathom/db";
import { makesPrivatePages, seesClass, tierSchema } from "@fathom/shared";
import { and, inArray, sql, type SQL } from "drizzle-orm";
import type { Actor } from "../access.ts";
import { privateRecordTypes } from "./changes.ts";

// A recorded value as text, whether the change set it or took it away.
const recorded = (table: string) =>
  sql.raw(`coalesce("${table}"."new_value", "${table}"."old_value") #>> '{}'`);

// The pages the user made, as the history recorded each page's maker.
const ownPages = (userId: string) =>
  sql`SELECT "page"."record_id" FROM ${changes} AS "page"
    WHERE "page"."record_type" = 'private-page' AND "page"."field" = 'userId'
    AND ${recorded("page")} = ${userId}`;

// The columns and rows on those pages, as the history recorded each one's page.
const onOwnPages = (userId: string) =>
  sql`SELECT "part"."record_id" FROM ${changes} AS "part"
    WHERE "part"."record_type" IN ('private-column', 'private-row')
    AND "part"."field" = 'pageId' AND ${recorded("part")} IN (${ownPages(userId)})`;

// The changes to the actor's own pages and what is on them, or none for a role that may not make
// pages.
export function ownPrivateChanges(actor: Actor): SQL | undefined {
  if (!actor.permissions.includes(makesPrivatePages)) return undefined;
  const userId = actor.user.id;
  return and(
    inArray(changes.recordType, [...privateRecordTypes]),
    inArray(
      changes.tier,
      tierSchema.options.filter((tier) => seesClass(actor.permissions, tier)),
    ),
    sql`(${changes.recordId} IN (${ownPages(userId)}) OR ${changes.recordId} IN (${onOwnPages(userId)}))`,
  );
}
