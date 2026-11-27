// SPDX-License-Identifier: Apache-2.0

// Who changed each of the plan's records' drafts, as the viewer may see it, and which of them the
// viewer may discard whoever changed them. Part of the data access layer.

import type { Reader } from "@fathom/db";
import type { RecordType } from "@fathom/shared";
import type { Actor } from "../access.ts";
import { discardedByAnyEditor } from "./bound-drafts.ts";
import { draftMakers, everything, type Maker } from "./draft-makers.ts";
import { type RecordsState, stateOf } from "./record-state.ts";
import { type Makers, recordKinds } from "./records.ts";

export async function readRecordMakers(
  reader: Reader,
  state: RecordsState,
  viewer: Actor,
): Promise<Makers> {
  const byKind = new Map<RecordType, Map<string, Maker>>();
  for (const kind of recordKinds) {
    byKind.set(
      kind.type,
      await draftMakers(
        reader,
        kind.type,
        [...stateOf(state, kind.type).drafts.keys()],
        everything,
        viewer,
      ),
    );
  }
  return { byKind, discardedByAny: discardedByAnyEditor(state, viewer) };
}
