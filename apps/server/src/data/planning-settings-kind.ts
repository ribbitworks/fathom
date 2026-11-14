// SPDX-License-Identifier: Apache-2.0

// The planning settings as a kind of record with drafts: one record, which Fathom adds and nobody
// removes, changed through drafts approved with Approve Configuration, as the Decisions Log sets
// out. It links to nothing, so its drafts use none. Part of the data access layer; records.ts
// applies the rules every kind shares.

import { planningSettings } from "@fathom/db";
import { planningSettingFields } from "@fathom/shared";
import type { RecordKind } from "./record-state.ts";

export const planningSettingsKind: RecordKind = {
  type: "planning-settings",
  table: planningSettings,
  fields: planningSettingFields,
  links: {},
  readWith: ["configuration:view"],
  unseenSubject: "the planning settings",
  subject: () => "the planning settings",
};
