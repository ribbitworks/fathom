// SPDX-License-Identifier: Apache-2.0

// Tests for which fields of a person's draft an actor sees.

import { valueField } from "@fathom/db";
import { defaultClasses, type Permission } from "@fathom/shared";
import { describe, expect, it } from "vitest";
import type { Actor } from "../access.ts";
import { seesPersonField } from "./person-fields.ts";
import type { ColumnInfo, PeopleColumns } from "./values.ts";

const actor = (permissions: Permission[]): Actor => ({
  user: { id: "fictional-user", name: "Fictional User", email: "" },
  roleId: null,
  dataClasses: defaultClasses,
  permissions,
});

// A General column and a Personal one, with dates in their starting classes.
const columns = Object.assign(
  [
    { id: "general-column", tier: "general" },
    { id: "personal-column", tier: "personal" },
  ] as unknown as ColumnInfo[],
  {
    positionTier: "general" as const,
    stateTier: "general" as const,
    dataClasses: defaultClasses,
  },
) as PeopleColumns;

describe("seesPersonField", () => {
  const general = seesPersonField(actor(["people:view"]), columns);
  const personal = seesPersonField(
    actor(["people:view", "personal:view"]),
    columns,
  );

  it.each([
    ["a General detail", "preferredName", true, true],
    ["a Personal detail", "endDate", false, true],
    ["a General column's value", valueField("general-column"), true, true],
    ["a Personal column's value", valueField("personal-column"), false, true],
    ["a value in a column not given", valueField("gone"), false, false],
  ])(
    "judges %s by its class",
    (_what, field, seenByGeneral, seenByPersonal) => {
      expect(general(field)).toBe(seenByGeneral);
      expect(personal(field)).toBe(seenByPersonal);
    },
  );
});
