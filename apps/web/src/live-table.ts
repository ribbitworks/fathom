// SPDX-License-Identifier: Apache-2.0

// What a table whose records never have drafts gives the shared table: its records as they are,
// no drafts to decide, and nothing a draft changes.

import { noDrafts } from "./drafts.ts";

export const liveTableParts = {
  liveRecords: <Rec>(records: readonly Rec[]): Rec[] => [...records],
  drafts: noDrafts,
  draftFields: () => [],
};
