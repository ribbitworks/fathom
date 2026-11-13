// SPDX-License-Identifier: Apache-2.0

// Tests for what a request to add or change a feature may hold, and how drafts name a feature.

import { describe, expect, it } from "vitest";
import {
  featureLengths,
  featureRequestSchema,
  largestEstimateHours,
  needsFeatureTeam,
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
