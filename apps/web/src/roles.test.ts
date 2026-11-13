// SPDX-License-Identifier: Apache-2.0

// Tests for what a role's permissions mean in plain English: the pages and views its holders see,
// those they do not and why, what they can and cannot do, permissions that do nothing without
// others, and what an account gains and loses when what it may do changes.

import {
  defaultClasses,
  startingRoles,
  type Permission,
  permissionDescriptions,
} from "@fathom/shared";
import { describe, expect, it } from "vitest";
import {
  consequences,
  difference,
  markedLines,
  needsMet,
  withNeedsMet,
} from "./roles.ts";

// What a role allows with the data in the classes Fathom starts it in.
const allowed = (granted: readonly Permission[]) =>
  consequences(granted, defaultClasses);

const allows = (permission: Permission) =>
  // The permission is always one of the shared list.
  // eslint-disable-next-line security/detect-object-injection
  permissionDescriptions[permission].allows;
const without = (permission: Permission) =>
  // eslint-disable-next-line security/detect-object-injection
  permissionDescriptions[permission].without;

describe("what a role allows", () => {
  it("lists no pages for a role granting nothing, and every page as not seen", () => {
    const { sees, doesNotSee } = allowed([]);
    expect(sees).toEqual([]);
    expect(doesNotSee).toEqual([
      "Overview",
      "Projects",
      "Features",
      "Releases",
      "People",
      "Org chart",
      "Feature assignments",
      "Drafts",
      "Capacity",
      "Lists",
      "Accounts",
      "Roles",
      "Settings",
      "Data classes",
      "Change history",
      "Access history",
    ]);
  });

  it("names the pages a role's permissions open, and only the others as not seen", () => {
    const { sees, doesNotSee } = allowed([
      "people:view",
      "administration:view",
    ]);
    expect(sees).toEqual([
      "People",
      "Org chart",
      "Drafts",
      "Accounts",
      "Roles",
      "Settings",
      "Change history",
      "Access history",
    ]);
    expect(doesNotSee).toContain("Feature assignments");
    expect(doesNotSee).not.toContain("People");
    expect(
      allowed(["people:view", "feature-teams:view", "personal:view"]).sees,
    ).toEqual([
      "People",
      "Org chart",
      "Org chart on other dates",
      "Feature assignments",
      "Drafts",
      "Change history",
    ]);
  });

  it("adds the views a role sees, and says why it misses each other view, in the order of the pages", () => {
    const engineeringManager = allowed([
      "people:view",
      "feature-teams:view",
      "allocations:view",
      "personal:view",
    ]);
    expect(engineeringManager.sees).toEqual([
      "People",
      "Org chart",
      "Org chart on other dates",
      "Feature assignments",
      "Allocations",
      "Drafts",
      "Change history",
    ]);
    expect(engineeringManager.doesNotSee).toEqual([
      "Overview",
      "Projects",
      "Features",
      "Releases",
      "Org chart on future dates: needs Confidential (Future reorganizations)",
      "Feature assignments grouped by manager: needs Confidential (Future reorganizations)",
      "Capacity",
      "Lists",
      "Accounts",
      "Roles",
      "Settings",
      "Data classes",
      "Access history",
    ]);
    const withoutPersonal = allowed(["feature-teams:view"]);
    // A page missed whole opens only to its line saying why.
    expect(withoutPersonal.sees).not.toContain("Feature assignments");
    expect(withoutPersonal.doesNotSee).toEqual(
      expect.arrayContaining([
        "Feature assignments: needs Personal (Start date, End date, Past managers, Feature team dates)",
        "Feature assignments grouped by manager: needs Personal (Start date, End date, Past managers, Feature team dates) and Confidential (Future reorganizations)",
      ]),
    );
  });

  it("follows the classes the organization keeps its data in", () => {
    const general = {
      ...defaultClasses,
      futureReorganizations: "general" as const,
    };
    const { sees, doesNotSee } = consequences(
      ["people:view", "personal:view"],
      general,
    );
    expect(sees).toContain("Org chart on future dates");
    expect(doesNotSee.filter((line) => line.includes("needs"))).toEqual([]);
  });

  it("gives Personal views to a role that sees Personal data without People, on the pages it reaches", () => {
    const { sees, doesNotSee } = allowed([
      "feature-teams:view",
      "personal:view",
    ]);
    expect(sees).toContain("Feature assignments");
    expect(doesNotSee).toContain(
      "Feature assignments grouped by manager: needs Confidential (Future reorganizations)",
    );
  });

  it("says what its holders can do, in the grid's order, including what editing brings", () => {
    expect(allowed(["people:edit", "plan:view"]).can).toEqual([
      allows("plan:view"),
      allows("people:view"),
      allows("people:edit"),
    ]);
  });

  it("says once what an area the role does not reach at all is closed to", () => {
    const { cannot } = allowed([]);
    expect(cannot).toContain(without("plan:view"));
    expect(cannot).not.toContain(without("plan:edit"));
    expect(cannot).toContain(without("feature-teams:view"));
    expect(cannot).not.toContain(without("feature-teams:edit"));
    expect(cannot).not.toContain(without("feature-teams:approve"));
  });

  it("says each action missing on an area the role reaches in part", () => {
    const { can, cannot } = allowed(["feature-teams:edit"]);
    expect(can).toEqual([
      allows("feature-teams:view"),
      allows("feature-teams:edit"),
    ]);
    expect(cannot).toContain(without("feature-teams:approve"));
    expect(cannot).not.toContain(without("feature-teams:view"));
  });

  it("leaves pages out of what its holders cannot do", () => {
    expect(allowed([]).cannot.filter((line) => line.includes("page"))).toEqual(
      [],
    );
  });
});

describe("permissions that do nothing without others", () => {
  it("finds a permission needing none, or holding any of those it needs, does something", () => {
    expect(needsMet("plan:view", [])).toBe(true);
    expect(needsMet("personal:view", ["feature-teams:view"])).toBe(true);
    expect(needsMet("personal:view", ["plan:view"])).toBe(false);
  });

  it("takes away each permission whose needs are no longer granted, and those needing it in turn", () => {
    expect(
      withNeedsMet([
        "feature-teams:view",
        "feature-teams:approve",
        "personal:view",
        "data:classify",
        "plan:view",
      ]),
    ).toEqual(["plan:view"]);
  });

  it("counts what editing brings as granted", () => {
    expect(withNeedsMet(["people:edit", "hiring-plan:view"])).toEqual([
      "people:edit",
      "hiring-plan:view",
    ]);
  });

  it("keeps those it is told to, whatever they need", () => {
    expect(
      withNeedsMet(["hiring-plan:view", "personal:view"], ["hiring-plan:view"]),
    ).toEqual(["hiring-plan:view"]);
  });

  it("leaves every starting role as it is", () => {
    for (const { permissions } of Object.values(startingRoles)) {
      expect(withNeedsMet(permissions)).toEqual(permissions);
    }
  });

  it("keeps a permission while any of those it needs stays", () => {
    expect(
      withNeedsMet(["feature-teams:view", "people:view", "personal:view"]),
    ).toEqual(["feature-teams:view", "people:view", "personal:view"]);
  });
});

describe("a list marked against how it was first", () => {
  it("marks lines added, and keeps each line taken away after the line it followed", () => {
    expect(markedLines(["a", "b", "c"], ["a", "c", "d"])).toEqual([
      { text: "a", change: undefined },
      { text: "b", change: "removed" },
      { text: "c", change: undefined },
      { text: "d", change: "added" },
    ]);
  });

  it("puts lines taken away from the top first, in their order", () => {
    expect(markedLines(["a", "b", "c"], ["c"])).toEqual([
      { text: "a", change: "removed" },
      { text: "b", change: "removed" },
      { text: "c", change: undefined },
    ]);
  });
});

describe("what a change to an account's permissions does", () => {
  it("lists the pages it gains first, then what it gains", () => {
    expect(
      difference(
        ["people:view"],
        ["people:view", "administration:view", "administration:edit"],
      ),
    ).toEqual({
      gains: [
        "Sees the Accounts page.",
        "Sees the Roles page.",
        "Sees the Settings page.",
        "Sees the Access history page.",
        allows("administration:view"),
        allows("administration:edit"),
      ],
      losses: [],
    });
  });

  it("lists the pages it loses first, then what it loses", () => {
    expect(difference(["people:view"], [])).toEqual({
      gains: [],
      losses: [
        "The People page no longer appears.",
        "The Org chart page no longer appears.",
        "The Drafts page no longer appears.",
        "The Change history page no longer appears.",
        without("people:view"),
      ],
    });
  });

  it("lists gains and losses together, without pages that stay", () => {
    expect(difference(["people:view"], ["plan:view"])).toEqual({
      gains: [
        "Sees the Overview page.",
        "Sees the Projects page.",
        allows("plan:view"),
      ],
      losses: [
        "The People page no longer appears.",
        "The Org chart page no longer appears.",
        without("people:view"),
      ],
    });
  });

  it("finds nothing when nothing changes", () => {
    expect(difference(["plan:view"], ["plan:view"])).toEqual({
      gains: [],
      losses: [],
    });
  });
});
