// SPDX-License-Identifier: Apache-2.0

// Tests for the data classes: which classes a role sees and changes, the classes built-in details
// are kept in, who may move data between classes, what each view is missing for a role, and the
// line saying why.

import { describe, expect, it } from "vitest";
import type { Permission } from "./access.ts";
import {
  builtInColumnTiers,
  changesHiringPlan,
  changesField,
  type ClassAccess,
  type DataClasses,
  defaultClasses,
  editsClass,
  editsField,
  hiringPlanWithoutClass,
  seesClass,
  seesEmployment,
  seesField,
  seesHiringPlan,
  seesView,
  shownIn,
  viewsOfRole,
  whyMissing,
  whyNoMove,
} from "./data-classes.ts";

const personal: Permission[] = ["people:view", "personal:view"];
const everything: Permission[] = [...personal, "confidential:view"];

const access = (
  permissions: readonly Permission[],
  moved: Partial<DataClasses> = {},
): ClassAccess => ({
  permissions,
  dataClasses: { ...defaultClasses, ...moved },
});

describe("seesClass", () => {
  it.each([
    ["General, with no permissions", [], "general", true],
    ["Personal, with people", personal, "personal", true],
    ["Personal, without people", ["personal:view"], "personal", true],
    ["Personal, without it", ["people:view"], "personal", false],
    ["Confidential, with it", ["confidential:view"], "confidential", true],
    ["Confidential, without it", personal, "confidential", false],
  ] as const)("%s", (_, permissions, dataClass, expected) => {
    expect(seesClass(permissions, dataClass)).toBe(expected);
  });
});

describe("editsClass", () => {
  it.each([
    ["General, with no permissions", [], "general", true],
    ["Personal, with it", ["personal:edit"], "personal", true],
    ["Personal, with only viewing it", personal, "personal", false],
    ["Confidential, with it", ["confidential:edit"], "confidential", true],
    ["Confidential, without it", ["personal:edit"], "confidential", false],
  ] as const)("%s", (_, permissions, dataClass, expected) => {
    expect(editsClass(permissions, dataClass)).toBe(expected);
  });
});

describe("a built-in detail's class", () => {
  it("is its default until moved", () => {
    expect(seesField(access(personal), "startDate")).toBe(true);
    expect(seesField(access(personal), "futureReorganizations")).toBe(false);
  });

  it("is where the organization moved it", () => {
    const moved = access(["people:view"], { startDate: "general" });
    expect(seesField(moved, "startDate")).toBe(true);
    expect(editsField(moved, "startDate")).toBe(true);
    expect(
      seesField(access(personal, { endDate: "confidential" }), "endDate"),
    ).toBe(false);
  });
});

describe("the classes of People's built-in columns", () => {
  it("follow their lists and the classes the organization keeps details in", () => {
    const tiers = builtInColumnTiers({
      positionTier: "personal",
      stateTier: "confidential",
      dataClasses: { ...defaultClasses, managerHistory: "general" },
    });
    expect(tiers.get("preferredName")).toBe("general");
    expect(tiers.get("positionId")).toBe("personal");
    expect(tiers.get("stateId")).toBe("confidential");
    expect(tiers.get("startDate")).toBe("personal");
    expect(tiers.get("managerFrom")).toBe("general");
  });
});

describe("what shows a built-in detail", () => {
  it("names the views needing it and People's columns holding it", () => {
    expect(shownIn("futureReorganizations")).toEqual([
      "Org chart on future dates",
      "Feature assignments grouped by manager",
      "Allocations grouped by manager",
    ]);
    expect(shownIn("managerHistory")).toContain("People's Manager assigned");
  });

  it("names nothing for a detail no view needs yet", () => {
    expect(shownIn("hiringPlan")).toEqual([]);
  });
});

describe("changing a built-in detail", () => {
  it("needs seeing and editing its class", () => {
    expect(
      changesField(access(["people:view", "personal:view"]), "managerHistory"),
    ).toBe(false);
    expect(
      changesField(
        access(["people:view", "personal:view", "personal:edit"]),
        "managerHistory",
      ),
    ).toBe(true);
    expect(
      changesField(access([], { managerHistory: "general" }), "managerHistory"),
    ).toBe(true);
  });
});

describe("seesEmployment", () => {
  it("needs both start and end dates' classes", () => {
    expect(seesEmployment(access(personal))).toBe(true);
    expect(seesEmployment(access(personal, { endDate: "confidential" }))).toBe(
      false,
    );
    expect(seesEmployment(access([], { startDate: "general" }))).toBe(false);
  });
});

describe("the hiring plan", () => {
  it("is seen with View Hiring plan and its class", () => {
    expect(seesHiringPlan(access(["hiring-plan:view", ...everything]))).toBe(
      true,
    );
    expect(seesHiringPlan(access(["hiring-plan:view", ...personal]))).toBe(
      false,
    );
    expect(seesHiringPlan(access(everything))).toBe(false);
    expect(
      seesHiringPlan(access(["hiring-plan:view"], { hiringPlan: "general" })),
    ).toBe(true);
  });

  it("is changed with Edit Hiring plan and Edit on its class", () => {
    const editor: Permission[] = ["hiring-plan:edit", "confidential:view"];
    expect(changesHiringPlan(access(editor))).toBe(false);
    expect(changesHiringPlan(access([...editor, "confidential:edit"]))).toBe(
      true,
    );
    expect(
      changesHiringPlan(access(["confidential:edit", "confidential:view"])),
    ).toBe(false);
    expect(
      changesHiringPlan(
        access(["hiring-plan:edit"], { hiringPlan: "general" }),
      ),
    ).toBe(true);
  });
});

describe("the hiring plan's permissions without its class", () => {
  it("say why each does nothing", () => {
    const missed = hiringPlanWithoutClass(
      access([
        "hiring-plan:view",
        "hiring-plan:edit",
        "hiring-plan:approve",
        ...personal,
      ]),
    );
    expect([...missed]).toEqual([
      [
        "hiring-plan:view",
        {
          name: "Hiring plan",
          page: "People",
          why: "Hiring plan: needs Confidential",
        },
      ],
      [
        "hiring-plan:edit",
        {
          name: "Changing the hiring plan",
          page: "People",
          why: "Changing the hiring plan: needs Edit Confidential data",
        },
      ],
      [
        "hiring-plan:approve",
        {
          name: "Approving drafts of planned hires",
          page: "People",
          why: "Approving drafts of planned hires: needs Confidential",
        },
      ],
    ]);
  });

  it("are none for a role holding the class, or with the hiring plan in General", () => {
    expect(
      hiringPlanWithoutClass(
        access(["hiring-plan:edit", "confidential:edit", ...everything]),
      ).size,
    ).toBe(0);
    expect(
      hiringPlanWithoutClass(
        access(["hiring-plan:edit"], { hiringPlan: "general" }),
      ).size,
    ).toBe(0);
  });
});

describe("why a role may not move data", () => {
  const classifier: Permission[] = [...personal, "data:classify"];

  it("allows moving between classes the role sees, with Classify data", () => {
    expect(whyNoMove(classifier, "personal", "general")).toBeUndefined();
  });

  it("needs Classify data", () => {
    expect(whyNoMove(everything, "general", "personal")).toBe(
      "Moving data to another class needs Classify data",
    );
  });

  it.each([
    ["the class data leaves", "confidential", "personal"],
    ["the class data enters", "general", "confidential"],
  ] as const)("needs sight of %s", (_, from, to) => {
    expect(whyNoMove(classifier, from, to)).toBe(
      "This role can't see Confidential data",
    );
  });
});

describe("whether a role sees a view", () => {
  it("does for a role that sees every class the view needs", () => {
    expect(seesView("orgChartFutureDates", access(everything))).toBe(true);
  });

  it("does not for a role missing any of them", () => {
    expect(seesView("allocations", access(["people:view"]))).toBe(false);
    expect(seesView("groupingByManager", access(personal))).toBe(false);
  });

  it("follows the classes the organization moved the view's details to", () => {
    const general = {
      startDate: "general",
      endDate: "general",
      managerHistory: "general",
      featureTeamDates: "general",
    } as const;
    expect(seesView("allocations", access([], general))).toBe(true);
    expect(
      seesView("allocations", access(personal, { endDate: "confidential" })),
    ).toBe(false);
  });
});

describe("why a view is missing", () => {
  it.each([
    ["allocations", [], "Allocations needs Personal access."],
    ["featureAssignments", [], "Feature assignments needs Personal access."],
    ["orgChartOtherDates", [], "Other dates need Personal access."],
    [
      "groupingByManager",
      personal,
      "Grouping by manager needs Confidential access.",
    ],
    ["orgChartFutureDates", personal, "Future dates need Confidential access."],
    [
      "orgChartFutureDates",
      [],
      "Future dates need Personal and Confidential access.",
    ],
  ] as const)("says it of %s", (view, permissions, expected) => {
    expect(whyMissing(view, access(permissions))).toBe(expected);
  });

  it("names the class a detail was moved to", () => {
    expect(
      whyMissing("allocations", access(personal, { endDate: "confidential" })),
    ).toBe("Allocations needs Confidential access.");
  });

  it("says nothing when the role sees the view", () => {
    expect(whyMissing("allocations", access(personal))).toBeUndefined();
  });
});

describe("the views on the pages a role reaches", () => {
  const orgChart = ["People", "Org chart"];
  const whys = (permissions: readonly Permission[], moved = {}) =>
    viewsOfRole(access(permissions, moved), orgChart).map(({ why }) => why);

  it("names each view with its page, and why the role misses it", () => {
    expect(viewsOfRole(access(personal), orgChart)).toEqual([
      { name: "Org chart on other dates", page: "Org chart" },
      {
        name: "Org chart on future dates",
        page: "Org chart",
        why: "Org chart on future dates: needs Confidential",
      },
    ]);
  });

  it("names every class a view needs, never the details kept in each", () => {
    expect(whys(["people:view"])).toEqual([
      "Org chart on other dates: needs Personal",
      "Org chart on future dates: needs Personal and Confidential",
    ]);
  });

  it("follows the classes the organization moved details to", () => {
    expect(
      whys(["people:view"], {
        startDate: "general",
        endDate: "general",
        featureTeamDates: "confidential",
      })[0],
    ).toBe("Org chart on other dates: needs Personal and Confidential");
  });

  it("leaves out views on pages the role does not reach", () => {
    expect(whys(everything)).toEqual([undefined, undefined]);
    expect(viewsOfRole(access(everything), [])).toEqual([]);
  });

  it("needs View Allocations as well as Capacity for Allocations", () => {
    const names = (permissions: readonly Permission[]) =>
      viewsOfRole(access(permissions), ["Capacity"]).map(({ name }) => name);
    expect(names(everything)).toEqual([]);
    expect(
      names([
        ...everything,
        "allocations:view",
        "feature-teams:view",
        "people:view",
      ]),
    ).toEqual(["Allocations grouped by manager", "Allocations"]);
  });

  it("names the permissions a view needs beyond the one opening its page, with the classes", () => {
    expect(
      viewsOfRole(access(["allocations:view"]), ["Capacity"]).find(
        ({ name }) => name === "Allocations",
      )?.why,
    ).toBe("Allocations: needs View Feature teams, View People, and Personal");
  });

  it("names grouping by manager on each page it is on, with why the role misses it there", () => {
    const pages = ["Feature assignments", "Capacity"];
    expect(
      viewsOfRole(
        access([...personal, "allocations:view", "feature-teams:view"]),
        pages,
      )
        .filter(({ name }) => name.endsWith("grouped by manager"))
        .map(({ page, why }) => [page, why]),
    ).toEqual([
      [
        "Feature assignments",
        "Feature assignments grouped by manager: needs Confidential",
      ],
      ["Capacity", "Allocations grouped by manager: needs Confidential"],
    ]);
  });
});
