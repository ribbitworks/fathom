// SPDX-License-Identifier: Apache-2.0

// Tests for dating a change of manager made from an earlier day of the org chart.

import type { Person } from "@fathom/shared";
import { describe, expect, it } from "vitest";
import { datedChange } from "./person-change.ts";

const day = "2025-01-01";

const live = (details: Partial<Person> = {}): Person => ({
  id: "3",
  keyNumber: 1,
  preferredName: "Uma Fictional",
  employeeId: "E3",
  values: {},
  links: {},
  ...details,
});

describe("a change of manager from an earlier day", () => {
  it("takes effect from that day", () => {
    expect(datedChange({ managerId: "1" }, live(), day)).toEqual({
      managerId: "1",
      managerFrom: day,
    });
  });

  it("keeps the live line's date when the live manager is chosen again", () => {
    expect(
      datedChange(
        { managerId: "2" },
        live({
          manager: { id: "2", preferredName: "Sasha Fictional" },
          managerFrom: "2024-05-01",
        }),
        day,
      ),
    ).toEqual({ managerId: "2", managerFrom: "2024-05-01" });
  });

  it("gives no date when no manager is chosen for someone with no live line", () => {
    expect(
      datedChange({ managerId: null }, live({ manager: null }), day),
    ).toEqual({ managerId: null });
  });
});
