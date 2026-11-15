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
      "Capacity",
      "Accounts",
      "Roles",
      "Settings",
      "Lists",
      "Data classes",
      "Drafts",
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
      "Accounts",
      "Roles",
      "Settings",
      "Drafts",
      "Change history",
      "Access history",
    ]);
    expect(doesNotSee).toContain("Feature assignments");
    expect(doesNotSee).not.toContain("People");
    expect(
      allowed(["people:view", "feature-teams:view", "personal:view"]).sees,
    ).toEqual([
      "People",
      "People on other dates",
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
      "People on other dates",
      "Org chart",
      "Org chart on other dates",
      "Feature assignments",
      "Capacity",
      "Allocations",
      "Drafts",
      "Change history",
    ]);
    expect(engineeringManager.doesNotSee).toEqual([
      "Overview",
      "Projects",
      "Features",
      "Releases",
      "People on future dates: needs Confidential",
      "Org chart on future dates: needs Confidential",
      "Feature assignments grouped by manager: needs Confidential",
      "Allocations grouped by manager: needs Confidential",
      "Accounts",
      "Roles",
      "Settings",
      "Lists",
      "Data classes",
      "Access history",
    ]);
    const withoutPersonal = allowed(["feature-teams:view"]);
    // A page missed whole opens only to its line saying why.
    expect(withoutPersonal.sees).not.toContain("Feature assignments");
    expect(withoutPersonal.doesNotSee).toEqual(
      expect.arrayContaining([
        "Feature assignments: needs Personal",
        "Feature assignments grouped by manager: needs Personal and Confidential",
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
      "Feature assignments grouped by manager: needs Confidential",
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

  it("gives the hiring plan only to a role that sees and changes its class", () => {
    const hiringPlan: Permission[] = [
      "people:edit",
      "hiring-plan:edit",
      "hiring-plan:approve",
    ];
    const { can, cannot, doesNotSee } = allowed(hiringPlan);
    expect(can).not.toContain(allows("hiring-plan:view"));
    expect(can).not.toContain(allows("hiring-plan:edit"));
    expect(can).not.toContain(allows("hiring-plan:approve"));
    expect(cannot).toContain(without("hiring-plan:view"));
    expect(cannot).not.toContain(without("hiring-plan:approve"));
    const whys = [
      "Hiring plan: needs Confidential",
      "Changing the hiring plan: needs Edit Confidential data",
      "Approving drafts of planned hires: needs Confidential",
    ];
    expect(doesNotSee).toEqual(expect.arrayContaining(whys));
    const withClass = allowed([...hiringPlan, "confidential:edit"]);
    expect(withClass.can).toContain(allows("hiring-plan:edit"));
    expect(withClass.can).toContain(allows("hiring-plan:approve"));
    expect(withClass.doesNotSee.filter((line) => whys.includes(line))).toEqual(
      [],
    );
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
        defaultClasses,
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
    expect(difference(["people:view"], [], defaultClasses)).toEqual({
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
    expect(difference(["people:view"], ["plan:view"], defaultClasses)).toEqual({
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

  it("counts a page gained only once its data is seen too", () => {
    const reaching: Permission[] = [
      "allocations:view",
      "feature-teams:view",
      "people:view",
    ];
    expect(
      difference(reaching, [...reaching, "personal:view"], defaultClasses)
        .gains,
    ).toContain("Sees the Capacity page.");
  });

  it("says which permissions a page reached needs to open, beside the classes", () => {
    const { sees, doesNotSee } = allowed(["allocations:view", "personal:view"]);
    expect(sees).not.toContain("Capacity");
    expect(doesNotSee).toEqual(
      expect.arrayContaining([
        "Capacity",
        "Allocations: needs View Feature teams and View People",
      ]),
    );
  });

  it("names a page reached without the data to open it, with why", () => {
    const { sees, doesNotSee } = allowed([
      "allocations:view",
      "feature-teams:view",
      "people:view",
    ]);
    expect(sees).not.toContain("Capacity");
    expect(doesNotSee).toEqual(
      expect.arrayContaining(["Capacity", "Allocations: needs Personal"]),
    );
  });

  it("finds nothing when nothing changes", () => {
    expect(difference(["plan:view"], ["plan:view"], defaultClasses)).toEqual({
      gains: [],
      losses: [],
    });
  });
});
