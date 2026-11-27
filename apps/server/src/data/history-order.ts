// SPDX-License-Identifier: Apache-2.0

// The order the change history's changes were made in, which every reader that takes a latest
// change or orders changes for their meaning uses. Part of the data access layer.

import { changes, changeSets } from "@fathom/db";
import { asc, desc, type SQL, sql } from "drizzle-orm";

// By their change set's time, then as saved. A record gone parts a private change set into copies
// recorded later, which keep its time, so they stand where it stood rather than where they were
// saved.
export const madeInOrder = [asc(changeSets.madeAt), asc(changes.id)] as const;

export const latestFirst = [desc(changeSets.madeAt), desc(changes.id)] as const;

// Whether a change was made after the last change of the change set named.
export const madeAfter = (changeSetId: string, lastChangeId: number): SQL =>
  sql`(${changeSets.madeAt}, ${changes.id}) > ((SELECT made_at FROM fathom.change_sets WHERE id = ${changeSetId}), ${lastChangeId})`;
