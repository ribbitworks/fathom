// SPDX-License-Identifier: Apache-2.0

// Fictional records and private changes for the unit tests of the check on publishing private
// changes: Kai, whose Site was Leeds, and Ben's private change to it.

import { type Draft, type Recorded } from "./draft-records.ts";
import { type Row } from "./private-versions.ts";

export const kai = "person-kai";
export const lisbon = "site-lisbon";
export const porto = "site-porto";
export const leeds = "site-leeds";

export const live: Recorded = { preferredName: "Kai Lindqvist", site: leeds };

export const published = (
  fields: Recorded,
  state: Draft["state"] = "waiting",
) =>
  ({
    action: "changed",
    fields,
    state,
    reason: null,
    sequence: 1,
  }) satisfies Draft;

export const removal = { ...published({}), action: "deleted" } satisfies Draft;

// A private change as publishing reads it: its own fields over the published draft.
export const privateChange = (
  fields: Recorded,
  startedFrom: Recorded,
  action = "changed",
): Row => ({
  recordType: "person",
  recordId: kai,
  userId: "user-ben",
  setId: "set-ben",
  action,
  fields,
  startedFrom,
  since: new Date(0),
  sequence: 2,
});
