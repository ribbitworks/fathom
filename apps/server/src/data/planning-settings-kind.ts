// SPDX-License-Identifier: Apache-2.0

// The planning settings as a kind of the plan's records, checked by the rules records.ts applies to
// every kind.

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
