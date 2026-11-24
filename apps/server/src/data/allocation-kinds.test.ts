// SPDX-License-Identifier: Apache-2.0

// Unit tests for allocations as records of the plan: what they are named by, and removing what they
// are to while they have any.

import { describe, expect, it } from "vitest";
import { allocationKind, allocationProblem } from "./allocation-kinds.ts";
import type { Draft } from "./draft-records.ts";
import {
  draft,
  kindState,
  recordsState,
  release,
  schedule,
  stream,
} from "./test-records-state.ts";

const readsEverything = [
  "plan:view",
  "features:view",
  "allocations:view",
] as const;

const allocation = (work: { featureId?: string; activityId?: string }) => ({
  personId: "person-1",
  plannedHireId: null,
  featureId: work.featureId ?? null,
  activityId: work.activityId ?? null,
  months: { "2027-01": 50 },
});

// A project with an activity, a feature, and the allocations given, each removed by a draft when
// asked.
function plan(
  allocated: { featureId?: string; activityId?: string }[],
  removed: ("project" | "project-activity" | "feature")[] = [],
) {
  const removal = (type: string, id: string): [string, Draft][] =>
    removed.includes(type as never) ? [[id, draft("deleted")]] : [];
  return recordsState({
    project: kindState(
      [["project-1", { name: "Crane Control" }]],
      [...removal("project", "project-1")],
    ),
    "project-activity": kindState(
      [["activity-1", { projectId: "project-1", name: "Data migration" }]],
      [...removal("project-activity", "activity-1")],
    ),
    feature: kindState(
      [["feature-1", { name: "Offline Sync" }]],
      [...removal("feature", "feature-1")],
    ),
    allocation: kindState(
      allocated.map((work, index) => [
        `allocation-${String(index)}`,
        allocation(work),
      ]),
    ),
  });
}

const touched = (
  type: "project" | "project-activity" | "feature" | "release",
  id: string,
) => [{ type, id, record: {} }];

describe("an allocation's names", () => {
  it("is named by its feature or its activity", () => {
    const state = plan([
      { featureId: "feature-1" },
      { activityId: "activity-1" },
    ]);
    expect(allocationKind.subject(state, "allocation-0")).toBe(
      "an allocation to the feature Offline Sync",
    );
    expect(allocationKind.subject(state, "allocation-1")).toBe(
      "an allocation to the activity Data migration of Crane Control",
    );
  });

  it("is named in the history by who is on which feature or activity", () => {
    const name = allocationKind.historyName?.name;
    expect(name?.({ personId: "Alex Kim", featureId: "Offline Sync" })).toBe(
      "Alex Kim on Offline Sync",
    );
    expect(
      name?.({ plannedHireId: "REQ-1", activityId: "Data migration" }),
    ).toBe("REQ-1 on Data migration");
    expect(name?.({ personId: "Alex Kim" })).toBeUndefined();
    expect(name?.({ activityId: "Data migration" })).toBeUndefined();
  });
});

describe("removing what allocations are to", () => {
  it("refuses a feature with allocations, telling to cancel it", () => {
    const state = plan([{ featureId: "feature-1" }], ["feature"]);
    expect(
      allocationProblem(
        state,
        touched("feature", "feature-1"),
        readsEverything,
      ),
    ).toBe(
      "The feature Offline Sync has allocations, so it can't be removed. Allocations are time spent, so cancel the feature instead.",
    );
  });

  it("refuses an activity with allocations", () => {
    const state = plan([{ activityId: "activity-1" }], ["project-activity"]);
    expect(
      allocationProblem(
        state,
        touched("project-activity", "activity-1"),
        readsEverything,
      ),
    ).toBe(
      "The activity Data migration of Crane Control has allocations, so it can't be removed. Allocations are time spent, so the activity stays.",
    );
  });

  it("refuses a project one of whose activities has allocations", () => {
    const state = plan([{ activityId: "activity-1" }], ["project"]);
    expect(
      allocationProblem(
        state,
        touched("project", "project-1"),
        readsEverything,
      ),
    ).toBe(
      "The project Crane Control has allocations, so it can't be removed. Allocations are time spent, so the project stays.",
    );
  });

  it("refuses a release one of whose activities has allocations", () => {
    const state = recordsState({
      "release-stream": kindState([[stream, schedule({ name: "Platform" })]]),
      release: kindState(
        [["release-1", release("2027.1", "2027-01-01")]],
        [["release-1", draft("deleted")]],
      ),
      "release-activity": kindState([
        ["activity-9", { releaseId: "release-1", name: "Release testing" }],
      ]),
      allocation: kindState([
        ["allocation-9", allocation({ activityId: "activity-9" })],
      ]),
    });
    expect(
      allocationProblem(
        state,
        touched("release", "release-1"),
        readsEverything,
      ),
    ).toBe(
      "The release 2027.1 in Platform has allocations, so it can't be removed. Allocations are time spent, so the release stays.",
    );
  });

  it("names no record to a role that can't read its kind", () => {
    const state = plan([{ activityId: "activity-1" }], ["project-activity"]);
    expect(
      allocationProblem(state, touched("project-activity", "activity-1"), [
        "allocations:view",
      ]),
    ).toBe(
      "An activity has allocations, so it can't be removed. Allocations are time spent, so the activity stays.",
    );
  });

  it.each([
    ["a feature", "feature", "feature-1", { activityId: "activity-1" }],
    [
      "an activity",
      "project-activity",
      "activity-1",
      { featureId: "feature-1" },
    ],
    ["a project", "project", "project-1", { featureId: "feature-1" }],
  ] as const)(
    "lets %s with no allocations of its own be removed",
    (_case, type, id, work) => {
      const state = plan([work], [type]);
      expect(
        allocationProblem(state, touched(type, id), readsEverything),
      ).toBeUndefined();
    },
  );

  it("leaves a record that isn't removed alone", () => {
    const state = plan([{ featureId: "feature-1" }]);
    expect(
      allocationProblem(
        state,
        touched("feature", "feature-1"),
        readsEverything,
      ),
    ).toBeUndefined();
  });
});
