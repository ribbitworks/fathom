// SPDX-License-Identifier: Apache-2.0

// Tests for who decides a draft: by its kind's area, or by its column's table.

import { describe, expect, it } from "vitest";
import { permissionGrid, startingRoles } from "./access.ts";
import { columnTables } from "./column-tables.ts";
import {
  approvableKinds,
  areaWords,
  decidedKindOf,
  decidersOf,
  decides,
  takenAlongRefusal,
} from "./draft-deciders.ts";

describe("decidersOf", () => {
  it("decides a column by its table's Approve", () => {
    expect(decidersOf({ kind: "field", table: "people" })).toEqual([
      "people:approve",
    ]);
    expect(decidersOf({ kind: "field", table: "features" })).toEqual([
      "features:approve",
    ]);
    expect(decidersOf({ kind: "field", table: "activities" })).toEqual([
      "features:approve",
    ]);
  });

  it("decides a column recorded before columns had tables as one on People", () => {
    expect(decidersOf({ kind: "field" })).toEqual(["people:approve"]);
  });

  it("decides a list or choice made with a column as the column is decided", () => {
    for (const kind of ["list", "list-item"] as const) {
      expect(decidersOf({ kind, table: "features" })).toEqual([
        "features:approve",
      ]);
    }
  });

  it("decides a list or choice made on Lists with Approve Configuration", () => {
    for (const kind of ["list", "list-item", "choice-order"] as const) {
      expect(decidersOf({ kind })).toEqual(["configuration:approve"]);
    }
  });

  it("ignores a table for kinds no column decides", () => {
    expect(decidersOf({ kind: "choice-order", table: "features" })).toEqual([
      "configuration:approve",
    ]);
    expect(decidersOf({ kind: "person", table: "features" })).toEqual([
      "people:approve",
    ]);
  });

  it("decides every table's columns with an Approve permission on the Roles grid", () => {
    const approving = new Set(
      permissionGrid.flatMap(({ actions }) =>
        actions.approve === undefined ? [] : [actions.approve],
      ),
    );
    for (const table of columnTables) {
      for (const permission of decidersOf({ kind: "field", table })) {
        expect(approving).toContain(permission);
      }
    }
  });
});

describe("decides", () => {
  it("lets Approve Features decide Features' columns, and not Approve Configuration", () => {
    const column = { kind: "field", table: "features" } as const;
    expect(decides(["features:approve", "people:view"], column)).toBe(true);
    expect(decides(["configuration:approve", "people:view"], column)).toBe(
      false,
    );
  });

  it.each([
    ["a column", { kind: "field", table: "features" }, "features:approve"],
    [
      "a list made with a column",
      { kind: "list", table: "features" },
      "features:approve",
    ],
    [
      "a choice made with a column",
      { kind: "list-item", table: "features" },
      "features:approve",
    ],
    ["a list made on Lists", { kind: "list" }, "configuration:approve"],
  ] as const)(
    "needs View People, whose sight General values take, to decide %s",
    (_case, decided, approve) => {
      expect(decides([approve], decided)).toBe(false);
      expect(decides([approve, "people:view"], decided)).toBe(true);
    },
  );

  it("needs no View People to decide a feature", () => {
    expect(decides(["features:approve"], { kind: "feature" })).toBe(true);
  });

  it("lets Approve People decide People's columns, and not Approve Features", () => {
    const column = { kind: "field", table: "people" } as const;
    expect(decides(["people:approve", "people:view"], column)).toBe(true);
    expect(
      decides(
        ["features:approve", "configuration:approve", "people:view"],
        column,
      ),
    ).toBe(false);
  });

  it("lets either Approve Plan or Approve Configuration decide a schedule", () => {
    expect(decides(["plan:approve"], { kind: "release-stream" })).toBe(true);
    expect(decides(["configuration:approve"], { kind: "release-stream" })).toBe(
      true,
    );
    expect(decides([], { kind: "release-stream" })).toBe(false);
  });
});

describe("areaWords", () => {
  it("names the areas whose Approvers decide a draft", () => {
    expect(areaWords({ kind: "field", table: "features" })).toBe(
      "features and releases",
    );
    expect(areaWords({ kind: "list" })).toBe("configuration");
    expect(areaWords({ kind: "cycle-pattern" })).toBe(
      "the plan or configuration",
    );
  });
});

describe("takenAlongRefusal", () => {
  it("refuses taking along a draft the role does not decide, naming it and the permission it needs", () => {
    expect(
      takenAlongRefusal(
        ["features:approve"],
        { kind: "list" },
        "the new list Fictional Sizes",
      ),
    ).toBe(
      "Approving this also approves the new list Fictional Sizes, which needs Approve Configuration.",
    );
  });

  it("names each permission that would do, when any of several decides it", () => {
    expect(
      takenAlongRefusal(
        [],
        { kind: "release-stream" },
        "the schedule Fictional",
      ),
    ).toBe(
      "Approving this also approves the schedule Fictional, which needs Approve Plan or Approve Configuration.",
    );
  });

  it("names View People when the role holds the Approve but not the sight", () => {
    expect(
      takenAlongRefusal(
        ["features:approve"],
        { kind: "field", table: "features" },
        "the new column Fictional Score",
      ),
    ).toBe(
      "Approving this also approves the new column Fictional Score, which needs View People.",
    );
  });

  it("lets a role that decides it take it along", () => {
    expect(
      takenAlongRefusal(
        ["features:approve", "people:view"],
        { kind: "field", table: "features" },
        "the new column Fictional Score",
      ),
    ).toBeUndefined();
  });
});

describe("decidedKindOf", () => {
  it("names a column's kind by its table", () => {
    expect(decidedKindOf({ kind: "field", table: "features" })).toBe(
      "field on features",
    );
    expect(decidedKindOf({ kind: "field" })).toBe("field on people");
  });

  it("names a list or choice made with a column by the column's table", () => {
    expect(decidedKindOf({ kind: "list-item", table: "activities" })).toBe(
      "list-item on activities",
    );
    expect(decidedKindOf({ kind: "list" })).toBe("list");
  });
});

describe("approvableKinds", () => {
  it("names the kinds some permissions decide", () => {
    expect(
      approvableKinds(["people:approve", "features:approve", "people:view"]),
    ).toEqual([
      "person",
      "release",
      "feature",
      "activity",
      "field on people",
      "field on features",
      "list on features",
      "list-item on features",
      "field on activities",
      "list on activities",
      "list-item on activities",
    ]);
    expect(approvableKinds(["features:approve"])).toEqual([
      "release",
      "feature",
      "activity",
    ]);
    expect(approvableKinds(["configuration:approve", "people:view"])).toEqual([
      "list",
      "list-item",
      "choice-order",
      "release-stream",
      "cycle-pattern",
      "planning-settings",
    ]);
    expect(approvableKinds(["features:edit", "people:view"])).toEqual([]);
  });

  // Each starting role, and which tables' columns it decides.
  const columnDeciders = [
    ["team-member", []],
    ["product-manager", ["features", "activities"]],
    ["feature-lead", []],
    ["project-manager", ["people", "features", "activities"]],
    ["engineering-manager", []],
    ["engineering-director", ["people", "features", "activities"]],
    ["workforce-administrator", []],
    ["executive", []],
    ["administrator", []],
  ] as const;

  it.each(columnDeciders)(
    "lets the starting role %s decide the columns of %j",
    (role, tables) => {
      // The role is always one of the fixed starting roles.
      // eslint-disable-next-line security/detect-object-injection
      const { permissions } = startingRoles[role];
      expect(
        columnTables.filter((table) =>
          decides(permissions, { kind: "field", table }),
        ),
      ).toEqual(tables);
    },
  );
});
