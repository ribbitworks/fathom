// SPDX-License-Identifier: Apache-2.0

// Tests for Activities' table: its columns in its details' order, what an activity belongs to, and
// moving one to another release or project.

import { MantineProvider } from "@mantine/core";
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import {
  activityColumnGroups,
  activityColumns,
  activityProblem,
  activityTable,
} from "./activity-table.tsx";
import { planDraftFields } from "./project-grids.tsx";
import { movedActivity, planAddress } from "./projects.ts";
import { project as fictionalProject } from "./test-projects-page.tsx";
import { choices, testTheme } from "./test-support.tsx";

const release = "release-1";
const project = "project-1";

describe("Activities' columns", () => {
  it("start in the order its details show them, Release and Project after Notes", () => {
    expect(activityColumns(choices()).map(({ key }) => key)).toEqual(
      activityColumnGroups.flatMap(({ keys }) => keys),
    );
    expect(activityColumnGroups.map(({ title }) => title)).toEqual([
      "Details",
      "Planning",
    ]);
  });

  it("group by Needed by and each column of choices", () => {
    const keys = (activityTable(choices()).groupings ?? []).map(
      ({ key }) => key,
    );
    expect(keys).toEqual(
      expect.arrayContaining([
        "neededBy",
        "statusId",
        "releaseId",
        "projectId",
        "featureTeamId",
        "priorityId",
        "sizeId",
        "riskId",
      ]),
    );
  });
});

describe("Activities' table", () => {
  const score = {
    id: "score",
    keyNumber: 1,
    name: "Fictional Score",
    type: "number" as const,
    listId: null,
    visibility: "general" as const,
    multiple: false,
    required: false,
    onPlannedHires: false,
  };
  const crane = fictionalProject({ id: project, name: "Crane Control" });
  const table = activityTable(
    choices({
      projects: [crane],
      activityColumns: { fields: [score], order: ["score"], lists: [] },
    }),
  );
  const columns = table.columnsFor([score], [], ["score"], []);

  it("puts the columns added to Activities after its own", () => {
    expect(columns.at(-1)?.key).toBe("score");
  });

  it("names an activity's project, and nothing for one of a release", () => {
    const projectColumn = columns.find(({ key }) => key === "projectId");
    expect(projectColumn?.content?.({ projectId: null } as never)).toBeNull();
    render(
      <MantineProvider theme={testTheme}>
        {projectColumn?.content?.({ projectId: project } as never)}
      </MantineProvider>,
    );
    expect(screen.getByText("Crane Control")).toBeDefined();
  });

  it("makes one request from the values of a new row", () => {
    expect(
      table.request([{ name: "Fictional" }, { projectId: project }], ""),
    ).toEqual({ name: "Fictional", projectId: project, values: {}, links: {} });
  });

  it("refuses a new row that belongs to neither", () => {
    expect(
      table.recordProblem({ releaseId: [], projectId: [] }, () => []),
    ).toEqual({
      message: "Choose a release or a project",
      column: "releaseId",
    });
  });
});

describe("what an activity belongs to", () => {
  it("refuses an activity added with neither, under Release", () => {
    expect(activityProblem({ releaseId: [], projectId: [] })).toEqual({
      message: "Choose a release or a project",
      column: "releaseId",
    });
  });

  it("refuses an activity added with both", () => {
    expect(
      activityProblem({ releaseId: [release], projectId: [project] }),
    ).toEqual({
      message: "Choose a release or a project, not both",
      column: "releaseId",
    });
  });

  it("reads a value never entered as none", () => {
    expect(activityProblem({})).toEqual({
      message: "Choose a release or a project",
      column: "releaseId",
    });
  });

  it("takes one added with either", () => {
    expect(
      activityProblem({ releaseId: [release], projectId: [] }),
    ).toBeUndefined();
  });

  it("refuses clearing the one it has, under that one", () => {
    expect(
      activityProblem({ releaseId: [], projectId: [] }, "projectId"),
    ).toEqual({
      message: "Choose a release or a project",
      column: "projectId",
    });
  });

  it("takes choosing the other, which moves it", () => {
    expect(
      activityProblem(
        { releaseId: [release], projectId: [project] },
        "releaseId",
      ),
    ).toBeUndefined();
  });

  it("asks nothing when another value changes", () => {
    expect(
      activityProblem({ releaseId: [], projectId: [] }, "name"),
    ).toBeUndefined();
  });
});

describe("an activity's draft", () => {
  it("names each value it changes as the table names its column", () => {
    const drafted = {
      id: "activity-1",
      keyNumber: 1,
      name: "Fictional Testing",
      statusId: "",
      priorityId: null,
      sizeId: null,
      riskId: null,
      neededBy: "2027-04",
      estimateHours: null,
      featureTeamId: null,
      description: null,
      note: null,
      values: {},
      links: {},
      staffed: false,
      staffedLive: false,
      releaseId: null,
      projectId: project,
      draft: {
        state: "waiting" as const,
        madeBy: null,
        madeAt: null,
        action: "changed" as const,
        changed: ["neededBy"],
        changedBy: {},
        editors: [],
        live: { neededBy: "2027-03" },
      },
    };
    expect(
      planDraftFields("activity", drafted as never, choices()).map(
        ({ key }) => key,
      ),
    ).toEqual(["neededBy"]);
    expect(planAddress("activities", "activity-1")).toEqual({
      to: "/activities",
      search: { open: "activity-1" },
    });
  });
});

describe("moving an activity", () => {
  const activity = {
    name: "Fictional Testing",
    statusId: "possible",
    priorityId: null,
    sizeId: null,
    riskId: null,
    neededBy: null,
    estimateHours: null,
    featureTeamId: null,
    description: null,
    note: null,
    releaseId: null,
    projectId: project,
  };

  it("to a release clears its project", () => {
    expect(movedActivity(activity, { releaseId: release })).toMatchObject({
      releaseId: release,
      projectId: null,
    });
  });

  it("to another project clears its release", () => {
    expect(
      movedActivity(
        { ...activity, releaseId: release, projectId: null },
        { projectId: project },
      ),
    ).toMatchObject({ releaseId: null, projectId: project });
  });

  it("keeps what it belongs to when another value changes", () => {
    expect(movedActivity(activity, { name: "Renamed" })).toMatchObject({
      name: "Renamed",
      releaseId: null,
      projectId: project,
    });
  });
});
