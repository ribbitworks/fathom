// SPDX-License-Identifier: Apache-2.0

// Tests for what opens a page: the permissions that reach it, and the other permissions and data a
// role needs with one of them to open it.

import { describe, expect, it } from "vitest";
import { type Permission, withImplied } from "./access.ts";
import { type ClassAccess, defaultClasses } from "./data-classes.ts";
import {
  capacityModeNeeds,
  opensWith,
  pageNeeds,
  reaches,
} from "./page-access.ts";

const access = (permissions: readonly Permission[]): ClassAccess => ({
  permissions,
  dataClasses: defaultClasses,
});

const seesAllocations: Permission[] = [
  "allocations:view",
  "feature-teams:view",
  "people:view",
  "personal:view",
];

describe("the pages a role reaches", () => {
  it("reaches a page with its one permission", () => {
    expect(reaches(pageNeeds.people, ["people:view"])).toBe(true);
  });

  it("reaches a page with any one of its permissions", () => {
    expect(reaches(pageNeeds.releases, ["configuration:view"])).toBe(true);
  });

  it("reaches a page with its permission whatever data the role sees", () => {
    expect(reaches(pageNeeds.capacity, ["feature-teams:view"])).toBe(true);
  });

  it("doesn't reach a page without any of its permissions", () => {
    expect(reaches(pageNeeds.releases, ["people:view"])).toBe(false);
  });
});

describe("the pages a role opens", () => {
  it("opens a page with its one permission", () => {
    expect(opensWith(pageNeeds.people, access(["people:view"]))).toBe(true);
  });

  it("doesn't open a page without its permission", () => {
    expect(opensWith(pageNeeds.people, access(["plan:view"]))).toBe(false);
  });

  it("opens a page that needs data with the data the role sees", () => {
    expect(
      opensWith(
        pageNeeds.capacity,
        access(["feature-teams:view", "personal:view"]),
      ),
    ).toBe(true);
  });

  it("doesn't open a page without the data it needs", () => {
    expect(opensWith(pageNeeds.capacity, access(["feature-teams:view"]))).toBe(
      false,
    );
  });

  it("opens a page with a permission and every other one it reads with it", () => {
    expect(opensWith(pageNeeds.capacity, access(seesAllocations))).toBe(true);
  });

  it.each(seesAllocations.slice(1))(
    "doesn't open a page through a permission without %s, which it reads with it",
    (missing) => {
      expect(
        opensWith(
          [capacityModeNeeds.allocations],
          access(seesAllocations.filter((one) => one !== missing)),
        ),
      ).toBe(false);
    },
  );

  it("opens a page through any one of its permissions", () => {
    expect(opensWith(pageNeeds.drafts, access(["configuration:view"]))).toBe(
      true,
    );
  });
});

describe("the planning settings", () => {
  it.each([
    ["View Configuration", ["configuration:view"]],
    ["Edit Configuration", withImplied(["configuration:edit"])],
  ] as const)("open with %s", (_name, permissions) => {
    expect(opensWith(pageNeeds["planning-settings"], access(permissions))).toBe(
      true,
    );
  });

  it("don't open without seeing configuration", () => {
    expect(
      opensWith(pageNeeds["planning-settings"], access(seesAllocations)),
    ).toBe(false);
  });

  it("no longer open Capacity for a role that sees only configuration", () => {
    expect(opensWith(pageNeeds.capacity, access(["configuration:view"]))).toBe(
      false,
    );
  });
});
