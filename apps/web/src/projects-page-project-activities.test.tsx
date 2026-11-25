// SPDX-License-Identifier: Apache-2.0

// Tests for a project's activities on Projects: its details' Activities row, showing them on
// Activities, adding one there with the project set, and the table's Activities column.

import { screen, waitFor, within } from "@testing-library/react";
import { userEvent } from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { recordCell, recordDraft } from "./test-support.tsx";
import {
  activity,
  answers,
  openPage,
  plan,
  project,
  projectId,
  sidePanel,
  withRelease,
} from "./test-projects-page.tsx";

afterEach(() => {
  vi.unstubAllGlobals();
});

const otherProjectId = "a0000000-0000-4000-8000-000000000002";

const activityNames = [
  "Fictional Migration",
  "Fictional Rollout",
  "Fictional Training",
  "Fictional Support",
  "Fictional Audit",
  "Fictional Cutover",
];

const projectPlan = (more: Partial<ReturnType<typeof plan>> = {}) =>
  plan({
    projects: [
      project({ name: "Crane Control" }),
      project({ id: otherProjectId, name: "Depot Operations" }),
    ],
    activities: [
      ...activityNames.map((name, index) =>
        activity({
          id: `50000000-0000-4000-8000-00000000000${String(index + 1)}`,
          keyNumber: index + 1,
          name,
        }),
      ),
      activity({
        id: "50000000-0000-4000-8000-000000000009",
        keyNumber: 9,
        name: "Fictional Elsewhere",
        projectId: otherProjectId,
      }),
    ],
    canEditFeatures: true,
    ...more,
  });

const featuresEditor = [
  "plan:view",
  "plan:edit",
  "features:view",
  "features:edit",
];

const openProject = (
  start = projectPlan(),
  permissions = featuresEditor,
  id = projectId,
) =>
  openPage(
    `/projects?open=${id}`,
    start,
    { ...answers, ...withRelease },
    permissions,
  );

const activitiesRow = (panel: HTMLElement) =>
  within(panel).queryByText("Activities", { selector: "dt" });

describe("a project's activities on Projects", () => {
  it("lists the project's own activities in its details, folded past the first five", async () => {
    await openProject();
    const panel = sidePanel();
    expect(activitiesRow(panel)).not.toBeNull();
    for (const name of activityNames.slice(0, 5)) {
      expect(within(panel).getByRole("button", { name })).toBeDefined();
    }
    expect(
      within(panel).queryByRole("button", { name: "Fictional Cutover" }),
    ).toBeNull();
    expect(
      within(panel).queryByRole("button", { name: "Fictional Elsewhere" }),
    ).toBeNull();
    await userEvent.click(
      within(panel).getByRole("button", { name: /Show all/ }),
    );
    expect(
      within(panel).getByRole("button", { name: "Fictional Cutover" }),
    ).toBeDefined();
  });

  it("opens an activity's details on Activities", async () => {
    const { history } = await openProject();
    await userEvent.click(
      within(sidePanel()).getByRole("button", { name: "Fictional Migration" }),
    );
    await waitFor(() => {
      expect(history.location.pathname).toBe("/activities");
    });
    expect(history.location.search).toContain(activity().id);
  });

  it("shows the project's activities on Activities, filtered to it", async () => {
    const { history } = await openProject();
    await userEvent.click(
      within(sidePanel()).getByRole("button", { name: "Show on Activities" }),
    );
    await waitFor(() => {
      expect(history.location.pathname).toBe("/activities");
    });
    expect(decodeURIComponent(history.location.search)).toContain(projectId);
    await waitFor(() => {
      expect(recordCell(activity().id, "name")).toBeDefined();
    });
    expect(
      recordCell("50000000-0000-4000-8000-000000000009", "name"),
    ).toBeUndefined();
  });

  it("adds an activity on Activities filtered to the project, with the project set", async () => {
    const { history } = await openProject();
    await userEvent.click(
      within(sidePanel()).getByRole("button", { name: "Add activity" }),
    );
    const form = await screen.findByRole("region", { name: "New activity" });
    expect(form.textContent).toContain("Crane Control");
    expect(decodeURIComponent(history.location.search)).toContain(projectId);
    await waitFor(() => {
      expect(history.location.search).not.toContain("adding");
    });
  });

  it("closes the form Add activity opened on Cancel without asking, the project not being anything entered", async () => {
    await openProject();
    await userEvent.click(
      within(sidePanel()).getByRole("button", { name: "Add activity" }),
    );
    const form = await screen.findByRole("region", { name: "New activity" });
    await userEvent.click(within(form).getByRole("button", { name: "Cancel" }));

    await waitFor(() => {
      expect(screen.queryByRole("region", { name: "New activity" })).toBeNull();
    });
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("says None for a project with no activities, still offering Add activity", async () => {
    await openProject(projectPlan({ activities: [] }));
    const panel = sidePanel();
    expect(
      within(activitiesRow(panel)?.parentElement as HTMLElement).getByText(
        "None",
      ),
    ).toBeDefined();
    expect(
      within(panel).queryByRole("button", { name: "Show on Activities" }),
    ).toBeNull();
    expect(
      within(panel).getByRole("button", { name: "Add activity" }),
    ).toBeDefined();
  });

  it("offers a reader who may not change activities no Add activity", async () => {
    await openProject(projectPlan({ canEditFeatures: false }), [
      "plan:view",
      "features:view",
    ]);
    const panel = sidePanel();
    expect(
      within(panel).getByRole("button", { name: "Show on Activities" }),
    ).toBeDefined();
    expect(
      within(panel).queryByRole("button", { name: "Add activity" }),
    ).toBeNull();
  });

  it("names each project's activities in the table's Activities column", async () => {
    await openPage(
      "/projects",
      projectPlan(),
      { ...answers, ...withRelease },
      featuresEditor,
    );
    const cell = (await waitFor(() =>
      recordCell(otherProjectId, "activityIds"),
    )) as HTMLElement;
    expect(cell.textContent).toContain("Fictional Elsewhere");
    expect(cell.textContent).not.toContain("Fictional Migration");
  });

  it("offers no Add activity on a project being removed", async () => {
    await openProject(
      projectPlan({
        projects: [
          project({
            name: "Crane Control",
            draft: recordDraft({ action: "deleted" }),
          }),
        ],
      }),
    );
    expect(
      within(sidePanel()).getByRole("button", { name: "Show on Activities" }),
    ).toBeDefined();
    expect(
      within(sidePanel()).queryByRole("button", { name: "Add activity" }),
    ).toBeNull();
  });

  it("shows a role that doesn't see features no activities", async () => {
    await openProject(projectPlan({ activities: [] }), ["plan:view"]);
    expect(activitiesRow(sidePanel())).toBeNull();
    expect(recordCell(projectId, "activityIds")).toBeUndefined();
  });
});

describe("a New activity a link asks for", () => {
  const asking = `adding=${encodeURIComponent(JSON.stringify({ projectId }))}`;

  it.each([
    [
      "in the Live view",
      `/activities?show=live&${asking}`,
      projectPlan(),
      featuresEditor,
    ],
    [
      "to a role that may not change activities",
      `/activities?${asking}`,
      projectPlan({ canEditFeatures: false }),
      ["plan:view", "features:view"],
    ],
  ])(
    "doesn't open %s, and leaves the address",
    async (_, path, start, permissions) => {
      const { history } = await openPage(
        path,
        start,
        { ...answers, ...withRelease },
        permissions,
      );
      await waitFor(() => {
        expect(history.location.search).not.toContain("adding");
      });
      expect(screen.queryByRole("region", { name: "New activity" })).toBeNull();
    },
  );
});
