// SPDX-License-Identifier: Apache-2.0

// Tests for picking a record's own activities, by its project or by its release.

import { describe, expect, it } from "vitest";
import { activitiesIn } from "./activity-list.tsx";
import { activity } from "./test-projects-page.tsx";

const ofProject = activity({ id: "a1", projectId: "p1", releaseId: null });
const ofRelease = activity({ id: "a2", projectId: null, releaseId: "r1" });

describe("a record's own activities", () => {
  it("picks a project's by its project and a release's by its release", () => {
    expect(
      activitiesIn([ofProject, ofRelease], "projectId", "p1").map(
        ({ id }) => id,
      ),
    ).toEqual(["a1"]);
    expect(
      activitiesIn([ofProject, ofRelease], "releaseId", "r1").map(
        ({ id }) => id,
      ),
    ).toEqual(["a2"]);
  });
});
