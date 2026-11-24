// SPDX-License-Identifier: Apache-2.0

// Unit tests for activities: the kinds of record they are, a request's fields, and how they're named.

import { describe, expect, it } from "vitest";
import { largestEstimateHours } from "./features.ts";
import {
  activityLengths,
  activityRequestSchema,
  activitySubject,
  isActivityType,
} from "./activities.ts";

describe("activities' kinds", () => {
  it.each(["project-activity", "release-activity"] as const)(
    "counts a %s as an activity",
    (type) => {
      expect(isActivityType(type)).toBe(true);
    },
  );

  it("counts no other kind as one", () => {
    expect(isActivityType("feature")).toBe(false);
  });
});

describe("an activity as a request gives it", () => {
  it("trims its name and description, and leaves the rest empty", () => {
    expect(
      activityRequestSchema.parse({
        name: "  Data migration ",
        description: "  ",
      }),
    ).toEqual({
      name: "Data migration",
      description: null,
      note: null,
      estimateHours: null,
    });
  });

  it("rounds an estimate to hundredths of an hour", () => {
    expect(
      activityRequestSchema.parse({ name: "Training", estimateHours: 1.006 })
        .estimateHours,
    ).toBe(1.01);
  });

  it.each([
    ["an empty name", { name: " " }],
    [
      "a long description",
      {
        name: "Training",
        description: "a".repeat(activityLengths.description + 1),
      },
    ],
    ["a negative estimate", { name: "Training", estimateHours: -1 }],
    [
      "an estimate above the largest",
      { name: "Training", estimateHours: largestEstimateHours + 1 },
    ],
  ])("refuses %s", (_case, request) => {
    expect(activityRequestSchema.safeParse(request).success).toBe(false);
  });
});

describe("an activity's name", () => {
  it("says what it belongs to", () => {
    expect(activitySubject("Data migration", "Crane Control")).toBe(
      "the activity Data migration of Crane Control",
    );
  });
});
