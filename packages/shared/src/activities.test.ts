// SPDX-License-Identifier: Apache-2.0

// Tests for activities' rules: what an activity belongs to.

import { describe, expect, it } from "vitest";
import {
  activityOwnerProblem,
  activityRequestSchema,
  ownersAfter,
} from "./activities.ts";

const releaseId = "00000000-0000-4000-8000-000000000001";
const projectId = "00000000-0000-4000-8000-000000000002";

describe("moving an activity", () => {
  it("to a release clears its project", () => {
    expect(ownersAfter({ releaseId: null, projectId }, { releaseId })).toEqual({
      releaseId,
      projectId: null,
    });
  });

  it("to a project clears its release", () => {
    expect(ownersAfter({ releaseId, projectId: null }, { projectId })).toEqual({
      releaseId: null,
      projectId,
    });
  });

  it("leaves both as they were when a change chooses neither", () => {
    expect(
      ownersAfter({ releaseId: null, projectId }, { releaseId: null }),
    ).toEqual({ releaseId: null, projectId });
  });
});

describe("what an activity belongs to", () => {
  it("takes a release alone or a project alone", () => {
    expect(
      activityOwnerProblem({ releaseId, projectId: null }),
    ).toBeUndefined();
    expect(
      activityOwnerProblem({ releaseId: null, projectId }),
    ).toBeUndefined();
  });

  it("refuses neither", () => {
    expect(activityOwnerProblem({ releaseId: null, projectId: null })).toBe(
      "Choose a release or a project",
    );
  });

  it("refuses both", () => {
    expect(activityOwnerProblem({ releaseId, projectId })).toBe(
      "Choose a release or a project, not both",
    );
  });

  it("reads a request naming neither as neither", () => {
    const request = activityRequestSchema.parse({ name: "Fictional Testing" });
    expect(request).toMatchObject({ releaseId: null, projectId: null });
  });
});
