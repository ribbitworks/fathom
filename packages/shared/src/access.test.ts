// SPDX-License-Identifier: Apache-2.0

// Tests for permissions as roles are set: their plain-English descriptions, the grid that places
// them, their short names, what editing implies, and the roles Fathom starts with.

import { describe, expect, it } from "vitest";
import {
  holdsAny,
  permissionDescriptions,
  permissionGrid,
  permissionLabel,
  permissionSchema,
  sameGrants,
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

describe("schedules in the descriptions", () => {
  it.each(["plan:edit", "plan:approve", "configuration:approve"] as const)(
    "says %s reaches schedules only with sight of them",
    (permission) => {
      // The permission is always one of the fixed list above.
      // eslint-disable-next-line security/detect-object-injection
      expect(permissionDescriptions[permission].allows).toContain(
        `with ${permissionLabel("features:view")} or ${permissionLabel("configuration:view")}, `,
      );
    },
  );
});

describe("holdsAny", () => {
  it("holds when any wanted permission is granted, and not when none is or none is wanted", () => {
    expect(
      holdsAny(["plan:view", "plan:edit"], ["features:edit", "plan:edit"]),
    ).toBe(true);
    expect(holdsAny(["plan:view"], ["features:edit", "plan:edit"])).toBe(false);
    expect(holdsAny(["plan:view"], [])).toBe(false);
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
    expect(permissionLabel("feature-teams:edit")).toBe("Edit Feature teams");
    expect(permissionLabel("administration:edit")).toBe("Edit Administration");
  });

  it("names a permission whose row gives it a name of its own by that name", () => {
    expect(permissionLabel("data:classify")).toBe("Classify data");
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

describe("sameGrants", () => {
  it("holds lists of the same permissions alike, whatever their order", () => {
    expect(
      sameGrants(["plan:view", "plan:edit"], ["plan:edit", "plan:view"]),
    ).toBe(true);
  });

  it("tells apart lists that differ in a permission or in length", () => {
    expect(sameGrants(["plan:view"], ["plan:edit"])).toBe(false);
    expect(sameGrants(["plan:view"], ["plan:view", "plan:edit"])).toBe(false);
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
  it("give the Engineering Director everything but managing accounts, editing roles, and changing settings", () => {
    expect(
      withImplied(startingRoles["engineering-director"].permissions),
    ).toEqual(
      permissionSchema.options.filter(
        (permission) => !["administration:edit"].includes(permission),
      ),
    );
  });

  it("give the Executive every view, and nothing that changes or approves", () => {
    expect(withImplied(startingRoles.executive.permissions)).toEqual(
      permissionSchema.options.filter((permission) =>
        permission.endsWith(":view"),
      ),
    );
  });

  it("let every role that edits the plan edit features too, as editing the plan did before", () => {
    for (const { permissions } of Object.values(startingRoles)) {
      if (permissions.includes("plan:edit")) {
        expect(permissions).toContain("features:edit");
      }
    }
  });
});
