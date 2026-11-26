// SPDX-License-Identifier: Apache-2.0

// Tests for picking a record's own activities, by its project or by its release, and what New
// activity starts with on Activities filtered to one.

import { describe, expect, it } from "vitest";
import { activitiesIn, filteredOwner } from "./activity-list.tsx";
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

describe("what New activity starts with on a filtered Activities", () => {
  const takes = () => true;

  it.each([
    ["one project", { projectId: { any: ["p1"] } }, { projectId: ["p1"] }],
    ["one release", { releaseId: { any: ["r1"] } }, { releaseId: ["r1"] }],
    ["no filter", {}, {}],
    ["two projects", { projectId: { any: ["p1", "p2"] } }, {}],
    [
      "a project and empty ones",
      { projectId: { any: ["p1"], empty: true } },
      {},
    ],
    [
      "a project and a release",
      { projectId: { any: ["p1"] }, releaseId: { any: ["r1"] } },
      {},
    ],
  ])("starts with %s as it should", (_, filters, starting) => {
    expect(filteredOwner(filters, takes)).toEqual(starting);
  });

  it("starts with nothing for a record that takes no activity", () => {
    expect(filteredOwner({ projectId: { any: ["p1"] } }, () => false)).toEqual(
      {},
    );
    expect(filteredOwner({ releaseId: { any: ["r1"] } }, () => false)).toEqual(
      {},
    );
  });
});
