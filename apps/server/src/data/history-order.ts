// SPDX-License-Identifier: Apache-2.0

// The orders the change history's changes are read in. Part of the data access layer.

import { changes, changeSets } from "@fathom/db";
import { asc, desc, type SQL, sql } from "drizzle-orm";

// By their change set's time, then as saved, for every reader that takes a latest change or
// compares when changes were made, such as the history's names, undo and the unpublished list. A
// record gone parts a private change set into copies recorded later, which keep its time, so they
// stand where it stood rather than where they were saved.
export const madeInOrder = [asc(changeSets.madeAt), asc(changes.id)] as const;

export const latestFirst = [desc(changeSets.madeAt), desc(changes.id)] as const;

// When others could first see a change: when its change set was published, or saved when not
// private.
export const whenPublished =
  sql<Date>`coalesce(${changeSets.publishedAt}, ${changeSets.madeAt})`.mapWith(
    changeSets.madeAt,
  );

// By when others could first see them, then as made: the drafts each reader has seen, in turn, such
// as the scope history dates its changes by.
export const publishedInOrder = [asc(whenPublished), ...madeInOrder] as const;

// When a change set was made, and when others could first see it, in microseconds, for ordering
// changes as they count for who changed a draft.
export const timesOf = {
  madeAtMicros:
    sql<number>`(extract(epoch from ${changeSets.madeAt}) * 1000000)::bigint`.mapWith(
      Number,
    ),
  publishedAtMicros: sql<
    number | null
  >`(extract(epoch from ${changeSets.publishedAt}) * 1000000)::bigint`.mapWith(
    Number,
  ),
};

// Whether a change was made after the last change of the change set named.
export const madeAfter = (changeSetId: string, lastChangeId: number): SQL =>
  sql`(${changeSets.madeAt}, ${changes.id}) > ((SELECT made_at FROM fathom.change_sets WHERE id = ${changeSetId}), ${lastChangeId})`;
