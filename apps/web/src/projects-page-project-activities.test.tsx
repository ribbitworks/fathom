// SPDX-License-Identifier: Apache-2.0

// Tests for a project's activities on Projects: its details' Activities row, showing them on
// Activities, adding one in a form stacked under the details with the project set, and the table's
// Activities column.

import { screen, waitFor, within } from "@testing-library/react";
import { userEvent } from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { fictionalRelease } from "./test-releases.ts";
import {
  featureDraft,
  queryDetailRow,
  recordCell,
  recordDraft,
} from "./test-support.tsx";
import {
  activity,
  answers,
  openPage,
  plan,
  project,
  projectId,
  saved,
  sent,
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
  queryDetailRow("Activities", panel);

// The Activities row's name, a link showing the project's activities on Activities.
const showOnActivities = "Activities, show on Activities";

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

  it("marks an activity a waiting draft adds with the draft's dot", async () => {
    await openProject(
      projectPlan({
        activities: [
          activity({
            id: "50000000-0000-4000-8000-0000000000aa",
            name: "Fictional Rehearsal",
            draft: featureDraft({ action: "created" }),
          }),
        ],
      }),
    );

    const added = within(activitiesRow(sidePanel()) as HTMLElement).getByText(
      ", added",
    ).parentElement as HTMLElement;
    expect(added.textContent).toContain("Fictional Rehearsal");
    expect(added.querySelector("[class*=draftMark]")).not.toBeNull();
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

  it("shows the project's activities on Activities, filtered to it, from the row's name", async () => {
    const { history } = await openProject();
    await userEvent.click(
      within(sidePanel()).getByRole("button", { name: showOnActivities }),
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

  it("adds an activity in a form stacked under the project's details, with the project set", async () => {
    const withAdded = projectPlan({
      activities: [
        ...projectPlan().activities,
        activity({
          id: "50000000-0000-4000-8000-0000000000aa",
          keyNumber: 99,
          name: "Fictional Rehearsal",
          projectId,
        }),
      ],
    });
    const holding: { plan?: { plan: ReturnType<typeof projectPlan> } } = {};
    const { fetch, history, held } = await openPage(
      `/projects?open=${projectId}`,
      projectPlan(),
      {
        ...answers,
        ...withRelease,
        "POST /api/activities": () => {
          if (holding.plan !== undefined) holding.plan.plan = withAdded;
          return saved(() => withAdded)();
        },
      },
      featuresEditor,
    );
    holding.plan = held;
    await userEvent.click(
      within(sidePanel()).getByRole("button", { name: "Add activity" }),
    );

    // New activity opens under the details, on Projects, with the project set
    const form = await screen.findByRole("region", { name: "New activity" });
    expect(history.location.pathname).toBe("/projects");
    expect(sidePanel()).toBeDefined();
    expect(form.textContent).toContain("Crane Control");

    // Adding sends it with the project, closes the form and puts focus back on Add activity
    await userEvent.type(
      within(form).getByRole("textbox", { name: "Name" }),
      "Fictional Rehearsal",
    );
    await userEvent.click(within(form).getByRole("button", { name: "Add" }));
    await waitFor(() => {
      expect(screen.queryByRole("region", { name: "New activity" })).toBeNull();
    });
    expect(sent(fetch, "POST /api/activities")).toEqual([
      expect.objectContaining({ name: "Fictional Rehearsal", projectId }),
    ]);
    await waitFor(() => {
      expect(document.activeElement?.textContent).toBe("Add activity");
    });
    const row = activitiesRow(sidePanel()) as HTMLElement;
    await userEvent.click(
      within(row).getByRole("button", { name: /Show all/ }),
    );
    expect(
      await within(row).findByRole("button", { name: "Fictional Rehearsal" }),
    ).toBeDefined();
  });

  it("asks before leaving the stacked form with a name typed", async () => {
    await openProject();
    await userEvent.click(
      within(sidePanel()).getByRole("button", { name: "Add activity" }),
    );
    const form = await screen.findByRole("region", { name: "New activity" });
    await userEvent.type(
      within(form).getByRole("textbox", { name: "Name" }),
      "Fictional Rehearsal",
    );
    await userEvent.click(
      within(sidePanel()).getByRole("button", { name: "Close details" }),
    );
    expect(
      await screen.findByRole("dialog", { name: "Discard the new activity?" }),
    ).toBeDefined();
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

  it("offers Show on Activities in the project's menu, filtered to it", async () => {
    const { history } = await openProject();
    await userEvent.click(
      within(sidePanel()).getByRole("button", { name: /^Actions for/ }),
    );
    await userEvent.click(
      await screen.findByRole("menuitem", { name: "Show on Activities" }),
    );
    await waitFor(() => {
      expect(history.location.pathname).toBe("/activities");
    });
    expect(decodeURIComponent(history.location.search)).toContain(projectId);
  });

  it("offers no Show on Activities in the menu of a project with none", async () => {
    await openProject(projectPlan({ activities: [] }));
    await userEvent.click(
      within(sidePanel()).getByRole("button", { name: /^Actions for/ }),
    );
    await screen.findByRole("menuitem", { name: "Show on Milestones" });
    expect(
      screen.queryByRole("menuitem", { name: "Show on Activities" }),
    ).toBeNull();
  });

  it("says None for a project with no activities, still offering Add activity", async () => {
    await openProject(projectPlan({ activities: [] }));
    const panel = sidePanel();
    expect(
      within(activitiesRow(panel) as HTMLElement).getByText("None"),
    ).toBeDefined();
    expect(
      within(panel).queryByRole("button", { name: showOnActivities }),
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
      within(panel).getByRole("button", { name: showOnActivities }),
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
      within(sidePanel()).getByRole("button", { name: showOnActivities }),
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

describe("New activity on Activities filtered to one project or release", () => {
  it("starts with that project, which isn't anything entered", async () => {
    await openPage(
      `/activities?filters=${encodeURIComponent(
        JSON.stringify({ projectId: { any: [projectId] } }),
      )}`,
      projectPlan(),
      { ...answers, ...withRelease },
      featuresEditor,
    );
    await userEvent.click(
      await screen.findByRole("button", { name: "New activity" }),
    );
    const form = await screen.findByRole("region", { name: "New activity" });
    expect(form.textContent).toContain("Crane Control");

    await userEvent.click(within(form).getByRole("button", { name: "Cancel" }));
    await waitFor(() => {
      expect(screen.queryByRole("region", { name: "New activity" })).toBeNull();
    });
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("starts with that release", async () => {
    await openPage(
      `/activities?filters=${encodeURIComponent(
        JSON.stringify({ releaseId: { any: [fictionalRelease().id] } }),
      )}`,
      projectPlan(),
      { ...answers, ...withRelease },
      featuresEditor,
    );
    await userEvent.click(
      await screen.findByRole("button", { name: "New activity" }),
    );
    const form = await screen.findByRole("region", { name: "New activity" });
    expect(form.textContent).toContain("Fictional Release");
  });
});
