// SPDX-License-Identifier: Apache-2.0

// Tests for permissions as roles are set: their plain-English descriptions, the grid that places
// them, their short names, what editing implies, and the roles Fathom starts with.

import { describe, expect, it } from "vitest";
import {
  permissionDescriptions,
  permissionGrid,
  permissionLabel,
  permissionSchema,
  startingRoles,
  withImplied,
} from "./access.ts";

describe("permissionDescriptions", () => {
  it.each(permissionSchema.options)(
    "says in a sentence what %s allows, and what a user without it cannot do",
    (permission) => {
      // The permission is always one of the shared list.
      // eslint-disable-next-line security/detect-object-injection
      const { allows, without, needs } = permissionDescriptions[permission];
      for (const sentence of [allows, without]) {
        expect(sentence).toMatch(/^[A-Z].*\.$/u);
      }
      expect(allows).not.toBe(without);
      expect(needs ?? []).not.toContain(permission);
    },
  );

  it("lets an approver approve their own drafts with any area's Approve", () => {
    const approving = permissionGrid.flatMap(({ actions }) =>
      actions.approve === undefined || actions.approve === "drafts:approve-own"
        ? []
        : [actions.approve],
    );
    expect(
      [...(permissionDescriptions["drafts:approve-own"].needs ?? [])].sort(),
    ).toEqual(approving.sort());
  });
});

describe("permissionGrid", () => {
  it("places every permission exactly once", () => {
    const placed = permissionGrid.flatMap(({ actions }) =>
      Object.values(actions),
    );
    expect([...placed].sort()).toEqual([...permissionSchema.options].sort());
  });
});

describe("permissionLabel", () => {
  it("names a permission by its action and area", () => {
    expect(permissionLabel("people:edit")).toBe("Edit People");
    expect(permissionLabel("feature-teams:propose")).toBe(
      "Draft Feature teams",
    );
    expect(permissionLabel("accounts:manage")).toBe("Edit Accounts");
  });

  it("shows a permission it does not know as stored", () => {
    expect(permissionLabel("retired:permission")).toBe("retired:permission");
  });
});

describe("withImplied", () => {
  it("adds viewing what may be edited, in the shared list's order, and drops what it does not know", () => {
    expect(
      withImplied(["people:edit", "retired:permission", "plan:view"]),
    ).toEqual(["plan:view", "people:view", "people:edit"]);
  });
});

describe("startingRoles", () => {
  it("name every starting role once, each granting known permissions", () => {
    const names = Object.values(startingRoles).map(({ name }) => name);
    expect(new Set(names).size).toBe(names.length);
    for (const { permissions } of Object.values(startingRoles)) {
      expect(withImplied(permissions)).toEqual(
        expect.arrayContaining([...permissions]),
      );
    }
  });
});
