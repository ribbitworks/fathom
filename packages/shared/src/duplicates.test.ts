// SPDX-License-Identifier: Apache-2.0

// Unit tests for duplicating a feature or an activity: what each copy keeps, its name, and where an
// activity's copy may go.

import { describe, expect, it } from "vitest";
import {
  activityDuplicateRequestSchema,
  activityPlace,
  copyName,
  copyOf,
} from "./duplicates.ts";
import { recordNameLength } from "./record-fields.ts";

describe("a copy's name", () => {
  it("is the original's with (copy) after it", () => {
    expect(copyName("Release testing", () => false)).toBe(
      "Release testing (copy)",
    );
  });

  it("counts on where a copy's name is taken", () => {
    const taken = new Set([
      "Release testing (copy)",
      "Release testing (copy 2)",
    ]);
    expect(copyName("Release testing", (named) => taken.has(named))).toBe(
      "Release testing (copy 3)",
    );
  });

  it("cuts a long name short to fit, never within a character", () => {
    const long = "数".repeat(recordNameLength);
    const copied = copyName(long, () => false);
    expect(Array.from(copied)).toHaveLength(recordNameLength);
    expect(copied.endsWith(" (copy)")).toBe(true);
  });
});

describe("what a copy keeps", () => {
  it("keeps what describes a feature's work, and nothing of where it is committed", () => {
    expect(
      copyOf("feature", {
        name: "Offline Sync",
        statusId: "planned",
        description: "Work offline",
        note: null,
        priorityId: "high",
        sizeId: "m",
        riskId: null,
        neededBy: "2027-03",
        estimateHours: 40,
        featureTeamId: "team",
        targetCycle: "2027-01-01",
        customerIds: ["c"],
      }),
    ).toEqual({
      description: "Work offline",
      note: null,
      priorityId: "high",
      sizeId: "m",
      riskId: null,
      neededBy: "2027-03",
      estimateHours: 40,
      featureTeamId: "team",
    });
  });

  it("keeps an activity's description, note and effort, empty where it has none", () => {
    expect(
      copyOf("activity", { name: "Release testing", releaseId: "r" }),
    ).toEqual({ description: null, note: null, estimateHours: null });
  });
});

describe("where an activity's copy goes", () => {
  it("is a project or a release, never both", () => {
    const id = "a0000000-0000-4000-8000-000000000001";
    expect(
      activityDuplicateRequestSchema.safeParse({ projectId: id }).success,
    ).toBe(true);
    expect(
      activityDuplicateRequestSchema.safeParse({ releaseId: id }).success,
    ).toBe(true);
    expect(
      activityDuplicateRequestSchema.safeParse({ projectId: id, releaseId: id })
        .success,
    ).toBe(false);
  });
});

describe("an activity copy's place", () => {
  it("names the project or the release asked for", () => {
    expect(activityPlace({ projectId: "p" })).toEqual({
      owner: "project",
      ownerId: "p",
    });
    expect(activityPlace({ releaseId: "r" })).toEqual({
      owner: "release",
      ownerId: "r",
    });
  });
});
