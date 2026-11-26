// SPDX-License-Identifier: Apache-2.0

// Unit tests for the last month of a feature or activity, which its allocations' hours are counted
// to: approved, and as drafts make the records it is read from.

import { describe, expect, it } from "vitest";
import type { Recorded } from "./draft-records.ts";
import { type RecordsState, withVersion } from "./record-state.ts";
import {
  feature,
  kindState,
  recordsState,
  release,
  schedule,
  stream,
  twoStreams,
} from "./test-records-state.ts";
import {
  activityLastMonth,
  effortSides,
  featureLastMonth,
} from "./work-months.ts";

const today = "2027-03-10";
const reads = { readsProjects: true, today };

// Streams with cycles in quarters from 2027, with the records given.
const plan = (parts: Partial<RecordsState> = {}): RecordsState =>
  recordsState({ ...twoStreams(), ...parts });

describe("a feature's last month", () => {
  it("is its target cycle's last month, before the month it is needed by", () => {
    const targeting = { ...feature("2027-04-01"), neededBy: "2027-12" };

    expect(featureLastMonth(plan(), targeting, "live")).toBe("2027-06");
  });

  it("is the month it is needed by without a target cycle, and none with neither", () => {
    expect([
      featureLastMonth(
        plan(),
        { ...feature(null), neededBy: "2027-09" },
        "live",
      ),
      featureLastMonth(plan(), feature(null), "live"),
    ]).toEqual(["2027-09", null]);
  });

  it("ends with its schedule's last day, approved or as a draft makes it", () => {
    const ending = withVersion(plan(), "release-stream", stream, {
      ...schedule(),
      endsOn: "2027-05-15",
    });

    expect([
      featureLastMonth(ending, feature("2027-04-01"), "live"),
      featureLastMonth(ending, feature("2027-04-01"), "drafted"),
    ]).toEqual(["2027-06", "2027-05"]);
  });
  it("is none for a cycle of a schedule that has no such cycle, or a feature drafted to be added", () => {
    expect([
      featureLastMonth(plan(), feature("2027-04-01", "stream-9"), "live"),
      featureLastMonth(plan(), undefined, "live"),
    ]).toEqual([null, null]);
  });
});

describe("an activity's last month", () => {
  const ofProject: Recorded = { name: "Fictional Work", projectId: "pr-1" };
  const withMilestones = withVersion(
    plan({
      milestone: kindState([
        ["m-1", { projectId: "pr-1", date: "2027-08-20" }],
        ["m-2", { projectId: "pr-2", date: "2028-01-10" }],
      ]),
    }),
    "milestone",
    "m-3",
    { projectId: "pr-1", date: "2027-11-02" },
  );

  it("is the month it is needed by, before its project's", () => {
    expect(
      activityLastMonth(
        withMilestones,
        { ...ofProject, neededBy: "2027-07" },
        "live",
        reads,
      ),
    ).toBe("2027-07");
  });

  it("is its project's last milestone's month, approved or as drafts make them", () => {
    expect([
      activityLastMonth(withMilestones, ofProject, "live", reads),
      activityLastMonth(withMilestones, ofProject, "drafted", reads),
    ]).toEqual(["2027-08", "2027-11"]);
  });

  it("leaves out a milestone drafted to be removed", () => {
    const removing = withVersion(
      plan({
        milestone: kindState([
          ["m-1", { projectId: "pr-1", date: "2027-08-20" }],
        ]),
      }),
      "milestone",
      "m-1",
      undefined,
    );

    expect([
      activityLastMonth(removing, ofProject, "live", reads),
      activityLastMonth(removing, ofProject, "drafted", reads),
    ]).toEqual(["2027-08", null]);
  });

  it("is none for a project with no milestones, or a reader who can't read its project", () => {
    expect([
      activityLastMonth(plan(), ofProject, "live", reads),
      activityLastMonth(withMilestones, ofProject, "live", {
        readsProjects: false,
        today,
      }),
    ]).toEqual([null, null]);
  });

  it("is its release's last cycle's last month, for a reader who can't read projects too", () => {
    const releases = plan({
      release: kindState([
        ["r-1", release("Fictional Alpha", "2027-01-01", "2027-04-01")],
      ]),
    });

    expect([
      activityLastMonth(releases, { releaseId: "r-1" }, "live", reads),
      activityLastMonth(releases, { releaseId: "r-2" }, "live", reads),
      activityLastMonth(releases, {}, "live", reads),
      activityLastMonth(releases, undefined, "live", reads),
      activityLastMonth(releases, { releaseId: "r-1" }, "live", {
        readsProjects: false,
        today,
      }),
    ]).toEqual(["2027-06", null, null, null, "2027-06"]);
  });
});

describe("a work's effort, approved and as drafts make it", () => {
  const live = { estimate: 40, lastMonth: "2027-08" };

  it("gives the drafted effort for a waiting draft of the work, or where drafts move its last month", () => {
    expect([
      effortSides(live, { estimate: 60, lastMonth: "2027-08" }, true),
      effortSides(live, { ...live, lastMonth: "2027-11" }, false),
      effortSides(live, { ...live }, false),
    ]).toEqual([
      { live, drafted: { estimate: 60, lastMonth: "2027-08" } },
      { live, drafted: { ...live, lastMonth: "2027-11" } },
      { live },
    ]);
  });
});
