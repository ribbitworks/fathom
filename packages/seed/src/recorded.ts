// SPDX-License-Identifier: Apache-2.0

// The change history's record of fields seeded or removed, each at its tier, as the server records
// them, for the seed data generator.

import type { ChangeRecord } from "@fathom/db";

export type SeededChange = ChangeRecord & { action: "created" | "deleted" };

export const recorded = (
  recordType: string,
  recordId: string,
  action: SeededChange["action"],
  values: Readonly<Record<string, unknown>>,
  tierOf: (field: string) => string = () => "general",
): SeededChange[] =>
  Object.entries(values).map(([field, value]) => ({
    recordType,
    recordId,
    action,
    field,
    tier: tierOf(field),
    oldValue: action === "deleted" ? value : null,
    newValue: action === "created" ? value : null,
  }));

// The values that are filled in, for records whose empty fields are not recorded.
export const filledIn = (
  values: Readonly<Record<string, unknown>>,
): Record<string, unknown> =>
  Object.fromEntries(
    Object.entries(values).filter(([, value]) => value !== null),
  );
