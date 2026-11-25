// SPDX-License-Identifier: Apache-2.0

// Tests for the Activities page: its table and details, adding an activity, moving one to a
// release in its cell, removing one, and who may change them.

import { screen, waitFor, within } from "@testing-library/react";
import { userEvent } from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { recordCell } from "./test-support.tsx";
import {
  activity,
  answers,
  chooseFrom,
  deleted,
  newButton,
  openPage,
  plan,
  project,
  projectId,
  projectStreamId,
  rowMenu,
  saved,
  sent,
  sidePanel,
  withRelease,
} from "./test-projects-page.tsx";

afterEach(() => {
  vi.unstubAllGlobals();
});

const releaseId = "30000000-0000-4000-8000-000000000001";
const releaseActivityId = "50000000-0000-4000-8000-000000000002";

const activityPlan = (more: Partial<ReturnType<typeof plan>> = {}) =>
  plan({
    projects: [project({ name: "Crane Control" })],
    activities: [
      activity(),
      activity({
        id: releaseActivityId,
        keyNumber: 8,
        name: "Fictional Testing",
        releaseId,
        projectId: null,
      }),
    ],
    canEdit: false,
    canEditFeatures: true,
    ...more,
  });

const featuresEditor = ["plan:view", "features:view", "features:edit"];

const open = (
  start = activityPlan(),
  more: object = {},
  path = "/activities",
) =>
  openPage(
    path,
    start,
    { ...answers, ...withRelease, ...more },
    featuresEditor,
  );

describe("the Activities page", () => {
  it("lists each activity with its release, named with its schedule, or its project", async () => {
    await open();
    expect(screen.getByRole("heading", { name: "Activities" })).toBeDefined();
    expect(
      await screen.findByText("Fictional Stream: Fictional Release"),
    ).toBeDefined();
    expect(
      within(recordCell(activity().id, "projectId") as HTMLElement).getByText(
        "Crane Control",
      ),
    ).toBeDefined();
  });

  it("opens an activity's details, grouped as the table orders its columns", async () => {
    await open(activityPlan(), {}, `/activities?open=${activity().id}`);
    const panel = sidePanel();
    expect(within(panel).getByText("#ACTIVITY-7")).toBeDefined();
    expect(
      within(panel)
        .getAllByRole("heading", { level: 3 })
        .map((heading) => heading.textContent),
    ).toEqual(["Details", "Planning"]);
  });

  it("links an activity's project to its details on Projects, its pencil kept", async () => {
    const { history } = await open(
      activityPlan(),
      {},
      `/activities?open=${activity().id}`,
    );
    const panel = sidePanel();
    expect(
      within(panel).getByRole("button", { name: "Change Project" }),
    ).toBeDefined();
    const link = within(panel).getByRole("button", {
      name: "FP-1 Crane Control",
    });
    expect(within(link).getByText("FP-1")).toBeDefined();
    await userEvent.click(link);
    await waitFor(() => {
      expect(history.location.pathname).toBe("/projects");
    });
    expect(new URLSearchParams(history.location.search).get("open")).toBe(
      projectId,
    );
  });

  it("links an activity's release to its schedule on Releases, its pencil kept", async () => {
    const { history } = await open(
      activityPlan(),
      {},
      `/activities?open=${releaseActivityId}`,
    );
    const panel = sidePanel();
    expect(
      within(panel).getByRole("button", { name: "Change Release" }),
    ).toBeDefined();
    await userEvent.click(
      within(panel).getByRole("button", {
        name: "Fictional Stream: Fictional Release",
      }),
    );
    await waitFor(() => {
      expect(history.location.pathname).toBe("/releases");
    });
    const search = new URLSearchParams(history.location.search);
    expect(search.get("open")).toBe(projectStreamId);
    expect(search.get("tab")).toBe("schedules");
  });

  it("adds an activity of a project, sending what it belongs to", async () => {
    const { fetch, held } = await open(activityPlan(), {
      "POST /api/activities": saved(() => held.plan),
    });
    await userEvent.click(await newButton("activity"));
    const form = screen.getByRole("region", { name: "New activity" });
    await userEvent.type(
      within(form).getByRole("textbox", { name: "Name" }),
      "Fictional Rehearsal",
    );
    await userEvent.click(
      within(form).getByRole("button", { name: "Change Project" }),
    );
    await userEvent.keyboard("Crane{ArrowDown}{Enter}");
    await userEvent.click(within(form).getByRole("button", { name: "Add" }));
    await waitFor(() => {
      expect(sent(fetch, "POST /api/activities")).toEqual([
        expect.objectContaining({
          name: "Fictional Rehearsal",
          projectId,
          releaseId: null,
        }),
      ]);
    });
  });

  it("moves an activity to a release chosen in its cell, clearing its project", async () => {
    const { fetch, held } = await open(activityPlan(), {
      [`PUT /api/activities/${activity().id}`]: saved(() => held.plan),
    });
    await userEvent.click(
      recordCell(activity().id, "releaseId") as HTMLElement,
    );
    await userEvent.keyboard("{Enter}");
    await userEvent.keyboard("{ArrowDown}{Enter}");
    await waitFor(() => {
      expect(sent(fetch, `PUT /api/activities/${activity().id}`)).toEqual([
        expect.objectContaining({ releaseId, projectId: null }),
      ]);
    });
  });

  it("removes an activity from its row's menu", async () => {
    const { fetch } = await open(activityPlan(), {
      [`DELETE /api/activities/${activity().id}`]: deleted,
    });
    await chooseFrom(await rowMenu("Fictional Migration"), "Remove activity");
    await waitFor(() => {
      expect(
        fetch.mock.calls.some(([url]) =>
          url.includes(`/api/activities/${activity().id}`),
        ),
      ).toBe(true);
    });
  });

  it("keeps a search typed in its address", async () => {
    const { history } = await open();
    await userEvent.type(
      screen.getByRole("textbox", { name: "Search activities" }),
      "Migration",
    );
    await waitFor(() => {
      expect(history.location.search).toContain("Migration");
    });
  });

  it("opens a linked column's menu and takes the column out of the address", async () => {
    const runbook = {
      id: "10000000-0000-4000-8000-0000000000c2",
      keyNumber: 3,
      name: "Fictional Runbook",
      type: "link" as const,
      listId: null,
      visibility: "general" as const,
      multiple: false,
      required: false,
      onPlannedHires: false,
    };
    const { history } = await openPage(
      `/activities?column=${runbook.id}`,
      activityPlan({
        activityColumns: {
          fields: [runbook],
          order: ["name", runbook.id],
          lists: [],
        },
      }),
      {
        ...answers,
        ...withRelease,
        "GET /api/lists": () => Response.json({ lists: [] }),
      },
      [...featuresEditor, "people:view"],
    );
    const menu = await screen.findByRole("menu");
    expect(menu.textContent).toContain("Fictional Runbook");
    await waitFor(() => {
      expect(history.location.search).not.toContain("column=");
    });
  });

  it("offers a reader who may not change activities no New activity", async () => {
    await openPage(
      "/activities",
      activityPlan({ canEditFeatures: false }),
      { ...answers, ...withRelease },
      ["plan:view", "features:view"],
    );
    expect(screen.queryByRole("button", { name: "New activity" })).toBeNull();
  });
});
