// SPDX-License-Identifier: Apache-2.0

// Unit tests for activities as records of the plan: how each is named, the names each owner keeps
// unique, and removing a project's activities with it.

import { describe, expect, it } from "vitest";
import {
  activitiesOf,
  projectActivityKind,
  releaseActivityKind,
} from "./activity-kinds.ts";
import { belongingTo } from "./project-kinds.ts";
import { valueTaken } from "./record-state.ts";
import {
  draft,
  kindState,
  recordsState,
  release,
  schedule,
  stream,
} from "./test-records-state.ts";

const state = (projectRemoved = false, activityRemoved = false) =>
  recordsState({
    project: kindState(
      [["project-1", { name: "Crane Control" }]],
      projectRemoved ? [["project-1", draft("deleted")]] : [],
    ),
    "release-stream": kindState([[stream, schedule({ name: "Platform" })]]),
    release: kindState([["release-1", release("2027.1", "2027-01-01")]]),
    "project-activity": kindState(
      [
        ["activity-1", { projectId: "project-1", name: "Data migration" }],
        ["activity-2", { projectId: "project-2", name: "Training" }],
      ],
      activityRemoved ? [["activity-1", draft("deleted")]] : [],
    ),
    "release-activity": kindState([
      ["activity-3", { releaseId: "release-1", name: "Release testing" }],
    ]),
  });

describe("an activity's name", () => {
  it("names a project's activity with its project", () => {
    expect(projectActivityKind.subject(state(), "activity-1")).toBe(
      "the activity Data migration of Crane Control",
    );
  });

  it("names a release's activity with its release and schedule", () => {
    expect(releaseActivityKind.subject(state(), "activity-3")).toBe(
      "the activity Release testing of 2027.1 in Platform",
    );
  });
});

describe("a project's activities", () => {
  it("are those that name it", () => {
    expect(activitiesOf(state(), "project", "project-1")).toEqual([
      "activity-1",
    ]);
  });

  it("use the project's removal when both are drafted to be removed", () => {
    expect(
      projectActivityKind.alsoUses?.(state(true, true), "activity-1"),
    ).toEqual([{ type: "project", id: "project-1" }]);
  });

  it.each([
    ["only the activity is", false, true],
    ["only the project is", true, false],
  ])(
    "use nothing else when %s drafted to be removed",
    (_case, project, activity) => {
      expect(
        projectActivityKind.alsoUses?.(state(project, activity), "activity-1"),
      ).toEqual([]);
    },
  );
});

describe("an activity's name within its owner", () => {
  const named = (name: string, projectId = "project-1") => ({
    projectId,
    name,
  });

  it("is taken by another of its project's activities, ignoring letter case", () => {
    expect(
      valueTaken(projectActivityKind, state(), named("DATA MIGRATION"), "new"),
    ).toBe(true);
  });

  it("is free in another project", () => {
    expect(
      valueTaken(
        projectActivityKind,
        state(),
        named("Data migration", "project-3"),
        "new",
      ),
    ).toBe(false);
  });

  it("is never taken by the activity itself", () => {
    expect(
      valueTaken(
        projectActivityKind,
        state(),
        named("Data migration"),
        "activity-1",
      ),
    ).toBe(false);
  });
});

describe("what belongs to a project", () => {
  it("is its milestones and its activities", () => {
    const withMilestone = {
      ...state(),
      milestone: kindState([
        ["milestone-1", { projectId: "project-1", name: "Kickoff" }],
        ["milestone-2", { projectId: "project-2", name: "Kickoff" }],
      ]),
    };
    expect(belongingTo(withMilestone, "project-1")).toEqual([
      { type: "milestone", id: "milestone-1" },
      { type: "project-activity", id: "activity-1" },
    ]);
  });
});
