// SPDX-License-Identifier: Apache-2.0

// What the feature team modules of the data access layer share: the record kind feature teams are
// drafted and recorded as, and a reader of the database.

import type { Database } from "@fathom/db";

export type Reader = Pick<Database, "select">;

export const recordType = "feature-team";
