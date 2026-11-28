// SPDX-License-Identifier: Apache-2.0

// Tests for what a request to add or change a feature may hold, and how drafts name a feature.

import { describe, expect, it } from "vitest";
import type { Meaning } from "./lists.ts";
import {
  featureLengths,
  featureRequestSchema,
  featuresByMeaning,
  isCommitted,
  largestEstimateHours,
  needsFeatureTeam,
  needsStaffing,
} from "./features.ts";
import { projectSubjects } from "./projects.ts";

const parse = (body: object) =>
  featureRequestSchema.safeParse({ name: "Fictional Feature", ...body });

describe("a feature request", () => {
  it("leaves out everything but a name, as Later with no estimate, team, priority, size or risk", () => {
    expect(parse({}).data).toEqual({
      name: "Fictional Feature",
      priorityId: null,
      sizeId: null,
      riskId: null,
      neededBy: null,
      customerIds: [],
      target: null,
      estimateHours: null,
      featureTeamId: null,
      description: null,
      note: null,
      values: {},
      links: {},
      notes: {},
      numbers: {},
      flags: {},
      texts: {},
      days: {},
      durations: {},
    });
  });

  it("takes a month it is needed by that exists", () => {
    expect(parse({ neededBy: "2027-03" }).data?.neededBy).toBe("2027-03");
  });

  it.each(["2027-13", "2027-00", "2027-3", "March"])(
    "refuses %s as the month it is needed by",
    (neededBy) => {
      expect(parse({ neededBy }).success).toBe(false);
    },
  );

  it("keeps each customer once, in a stable order", () => {
    const [first, second] = [
      "018f3a10-0000-4000-8000-000000000001",
      "018f3a10-0000-4000-8000-000000000002",
    ];
    expect(
      parse({ customerIds: [second, first, second] }).data?.customerIds,
    ).toEqual([first, second]);
  });

  it("limits a description to 200 characters", () => {
    expect(parse({ description: "a".repeat(200) }).success).toBe(true);
    expect(parse({ description: "a".repeat(201) }).success).toBe(false);
  });

  it("needs a name", () => {
    expect(featureRequestSchema.safeParse({ name: " " }).success).toBe(false);
  });

  it("rounds an estimate to hundredths of an hour", () => {
    expect(parse({ estimateHours: 1.005 }).data?.estimateHours).toBe(1);
    expect(parse({ estimateHours: 2.346 }).data?.estimateHours).toBe(2.35);
  });

  it("takes the largest estimate and refuses one beyond it", () => {
    expect(parse({ estimateHours: largestEstimateHours }).success).toBe(true);
    expect(parse({ estimateHours: largestEstimateHours + 1 }).success).toBe(
      false,
    );
  });

  it("refuses a negative estimate", () => {
    expect(parse({ estimateHours: -0.01 }).success).toBe(false);
  });

  it("holds a target as a stream and a day together", () => {
    const streamId = "00000000-0000-4000-8000-000000000001";
    expect(
      parse({ target: { streamId, cycle: "2027-01-01" } }).data?.target,
    ).toEqual({ streamId, cycle: "2027-01-01" });
    expect(parse({ target: { streamId } }).success).toBe(false);
  });

  it("treats an empty description as none", () => {
    expect(parse({ description: "  " }).data?.description).toBeNull();
  });

  it("refuses a description beyond the longest", () => {
    expect(
      parse({ description: "a".repeat(featureLengths.description + 1) })
        .success,
    ).toBe(false);
  });
});

describe("which features are committed to", () => {
  it.each([
    ["planned", true],
    ["in-progress", true],
    ["possible", false],
    ["done", false],
    ["cancelled", false],
    [null, false],
  ] as const)("a status meaning %s is committed: %s", (meaning, committed) => {
    expect(isCommitted(meaning)).toBe(committed);
  });
});

describe("which features need staffing", () => {
  it.each(["planned", "in-progress"] as const)(
    "needs it for a %s feature with no month allocated",
    (meaning) => {
      expect(needsStaffing(meaning, false)).toBe(true);
    },
  );

  it.each(["possible", "done", "cancelled", null] as const)(
    "does not need it for a %s feature",
    (meaning) => {
      expect(needsStaffing(meaning, false)).toBe(false);
    },
  );

  it("does not need it for a planned feature that is staffed", () => {
    expect(needsStaffing("planned", true)).toBe(false);
  });
});

describe("a cycle's features by what their status means", () => {
  const meanings = new Map<string, Meaning>([
    ["done-status", "done"],
    ["building-status", "in-progress"],
    ["planned-status", "planned"],
    ["idea-status", "possible"],
    ["dropped-status", "cancelled"],
  ]);
  const meaningOf = (statusId: string) => meanings.get(statusId);
  const cycle = { streamId: "platform", startsOn: "2026-12-01" };
  const feature = (
    name: string,
    statusId: string,
    target: { targetStreamId: string | null; targetCycle: string | null } = {
      targetStreamId: cycle.streamId,
      targetCycle: cycle.startsOn,
    },
  ) => ({ name, statusId, ...target });

  it("groups the cycle's features by meaning, in the order given", () => {
    const features = [
      feature("Fictional Sync", "planned-status"),
      feature("Fictional Export", "done-status"),
      feature("Fictional Maps", "planned-status"),
      feature("Fictional Search", "building-status"),
      feature("Fictional Voice", "idea-status"),
    ];

    const byMeaning = featuresByMeaning(features, cycle, meaningOf);

    expect(
      Object.fromEntries(
        Object.entries(byMeaning).map(([meaning, shown]) => [
          meaning,
          shown.map(({ name }) => name),
        ]),
      ),
    ).toEqual({
      done: ["Fictional Export"],
      "in-progress": ["Fictional Search"],
      planned: ["Fictional Sync", "Fictional Maps"],
      possible: ["Fictional Voice"],
    });
  });

  it("leaves out features of other cycles, other streams and Later", () => {
    const byMeaning = featuresByMeaning(
      [
        feature("Next Cycle", "planned-status", {
          targetStreamId: cycle.streamId,
          targetCycle: "2027-01-01",
        }),
        feature("Other Stream", "planned-status", {
          targetStreamId: "patches",
          targetCycle: cycle.startsOn,
        }),
        feature("In Later", "planned-status", {
          targetStreamId: null,
          targetCycle: null,
        }),
      ],
      cycle,
      meaningOf,
    );

    expect(byMeaning.planned).toEqual([]);
  });

  it.each(["dropped-status", "unknown-status"])(
    "leaves out a feature whose status is %s",
    (statusId) => {
      const byMeaning = featuresByMeaning(
        [feature("Fictional Dropped", statusId)],
        cycle,
        meaningOf,
      );

      expect(Object.values(byMeaning).flat()).toEqual([]);
    },
  );
});

describe("which features need a feature team", () => {
  it.each(["planned", "in-progress"] as const)(
    "needs one for a %s feature with none",
    (meaning) => {
      expect(needsFeatureTeam(meaning, null)).toBe(true);
    },
  );

  it.each(["possible", "done", "cancelled"] as const)(
    "does not need one for a %s feature",
    (meaning) => {
      expect(needsFeatureTeam(meaning, null)).toBe(false);
    },
  );

  it("does not need one for a planned feature that has one", () => {
    expect(needsFeatureTeam("planned", "t1")).toBe(false);
  });

  it("does not need one for a status whose meaning is not known", () => {
    expect(needsFeatureTeam(undefined, null)).toBe(false);
  });
});

describe("naming a feature", () => {
  it("says what it is", () => {
    expect(projectSubjects.feature("Fictional")).toBe("the feature Fictional");
  });
});
