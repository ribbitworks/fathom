// SPDX-License-Identifier: Apache-2.0

// The change history's record of fields seeded or removed, each at its tier, as the server records
// them, for the seed data generator.

import { type ChangeRecord, valueField } from "@fathom/db";
import type { FictionalOrganization } from "@fathom/fixtures";

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

// The class each of the organization's columns records its values at, by the field it is recorded
// under: its own class, or its list's, as the server takes it.
export function valueTiers(
  organization: Pick<FictionalOrganization, "lists" | "columns">,
): ReadonlyMap<string, string> {
  const listClass = new Map(
    organization.lists.map(({ id, visibility }) => [id, visibility]),
  );
  return new Map(
    organization.columns.map(({ id, visibility, listId }) => [
      valueField(id),
      // A column with no class of its own draws on a list, which has one.
      visibility ?? String(listClass.get(listId)),
    ]),
  );
}
