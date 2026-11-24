// SPDX-License-Identifier: Apache-2.0

// Tests for a project's activities on Projects: listed in its details and the table, added from its
// details, each with details of its own at its own address, changed and removed as drafts.

import type { Activity } from "@fathom/shared";
import { screen, waitFor, within } from "@testing-library/react";
import { userEvent } from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { recordDraft } from "./test-support.tsx";
import {
  approver,
  deleted,
  newId,
  openPage,
  plan,
  projectId,
  saved,
  sent,
  sentTo,
  sidePanel,
} from "./test-projects-page.tsx";

afterEach(() => {
  vi.unstubAllGlobals();
});

const activityId = "70000000-0000-4000-8000-000000000001";
const activitiesPath = `/api/projects/${projectId}/activities`;
const atProject = `/projects?open=${projectId}`;
const atActivity = `${atProject}&activity=${activityId}`;

const activity = (more: Partial<Activity> = {}): Activity => ({
  id: activityId,
  keyNumber: 14,
  projectId,
  releaseId: null,
  name: "Data migration",
  description: "Move the old bookings",
  note: null,
  estimateHours: 40,
  ...more,
});

const withActivity = (more: Partial<Activity> = {}) =>
  plan({ activities: [activity(more)] });

const activitiesSection = () =>
  within(
    screen
      .getByRole("heading", { name: "Activities" })
      .closest("section") as HTMLElement,
  );

const activityPanel = () => {
  const found = document.getElementById("activity-panel");
  if (found === null) throw new Error("No activity panel");
  return within(found);
};

describe("a project's activities", () => {
  it("are listed in its details, with their total effort", async () => {
    await openPage(atProject, withActivity());
    await screen.findByRole("heading", { name: "Activities" });
    expect(
      activitiesSection().getByRole("button", { name: "Data migration" }),
    ).toBeTruthy();
    expect(
      activitiesSection().getByText("Total effort: 40 hours"),
    ).toBeTruthy();
  });

  it("show once in its details, after its milestones, not again among its values", async () => {
    await openPage(atProject, withActivity());
    await screen.findByRole("heading", { name: "Activities" });
    const panel = within(sidePanel());
    expect(panel.getAllByText("Activities")).toHaveLength(1);
    expect(panel.getAllByText("Data migration")).toHaveLength(1);
  });

  it("read None in its details when it has none", async () => {
    await openPage(atProject, plan());
    await screen.findByRole("heading", { name: "Activities" });
    expect(activitiesSection().getByText("None")).toBeTruthy();
  });

  it("are named in the table's Activities column", async () => {
    await openPage("/projects", withActivity());
    const header = await screen.findByRole("columnheader", {
      name: /Activities/,
    });
    const column = Array.from(header.parentElement?.children ?? []).indexOf(
      header,
    );
    const row = screen.getByRole("row", { name: /Fictional Project/ });
    expect(row.children.item(column)?.textContent).toContain("Data migration");
  });

  it("open an activity's details under its project's, at its own address", async () => {
    const { history } = await openPage(atProject, withActivity());
    await userEvent.click(
      await screen.findByRole("button", { name: "Data migration" }),
    );
    await waitFor(() => {
      expect(history.location.search).toContain(`activity=${activityId}`);
    });
    expect(
      await activityPanel().findByRole("heading", { name: "Data migration" }),
    ).toBeTruthy();
    expect(activityPanel().getByText("Move the old bookings")).toBeTruthy();
    expect(activityPanel().getByText("#ACTIVITY-14")).toBeTruthy();
  });

  it("put focus back on the activity's link once its details close", async () => {
    await openPage(atActivity, withActivity());
    await activityPanel().findByRole("heading", { name: "Data migration" });
    await userEvent.click(
      activityPanel().getByRole("button", { name: /^Close/ }),
    );
    await waitFor(() => {
      expect(document.activeElement).toBe(
        screen.getByRole("button", { name: "Data migration" }),
      );
    });
  });

  it("offer no Add activity and no pencils under Live only", async () => {
    await openPage(`${atActivity}&show=live`, withActivity());
    await activityPanel().findByRole("heading", { name: "Data migration" });
    expect(screen.queryByRole("button", { name: "Add activity" })).toBeNull();
    expect(
      activityPanel().queryByRole("button", { name: "Change Name" }),
    ).toBeNull();
  });
});

describe("adding an activity", () => {
  const startAdding = async (answers = {}) => {
    const opened = await openPage(atProject, plan(), answers);
    await userEvent.click(
      await screen.findByRole("button", { name: "Add activity" }),
    );
    await activityPanel().findByRole("heading", { name: "New activity" });
    return opened;
  };

  it("starts a form under the project's details, for that project", async () => {
    await startAdding();
    expect(document.getElementById("activity-panel")?.textContent).toContain(
      "Fictional Project",
    );
  });

  it("closes without asking when nothing was entered, putting focus on Add activity", async () => {
    await startAdding();
    await userEvent.click(
      activityPanel().getByRole("button", { name: "Cancel" }),
    );
    expect(document.getElementById("activity-panel")).toBeNull();
    await waitFor(() => {
      expect(document.activeElement).toBe(
        screen.getByRole("button", { name: "Add activity" }),
      );
    });
  });

  it("sends the total effort typed, in hours", async () => {
    const { fetch } = await startAdding({
      [`POST ${activitiesPath}`]: saved(() => plan()),
    });
    await userEvent.type(
      activityPanel().getByRole("textbox", { name: "Name" }),
      "Operator training",
    );
    await userEvent.type(
      activityPanel().getByRole("textbox", { name: /^Total effort/ }),
      "24",
    );
    await userEvent.click(activityPanel().getByRole("button", { name: "Add" }));
    await waitFor(() => {
      expect(sent(fetch, `POST ${activitiesPath}`)).toMatchObject([
        { estimateHours: 24 },
      ]);
    });
  });

  it("adds it to the project, then shows its details", async () => {
    const after = plan({
      activities: [activity({ id: newId, name: "Operator training" })],
    });
    const { fetch, held, history } = await startAdding({
      [`POST ${activitiesPath}`]: saved(() => after),
    });
    await userEvent.type(
      activityPanel().getByRole("textbox", { name: "Name" }),
      "Operator training",
    );
    held.plan = after;
    await userEvent.click(activityPanel().getByRole("button", { name: "Add" }));
    await waitFor(() => {
      expect(sent(fetch, `POST ${activitiesPath}`)).toEqual([
        {
          name: "Operator training",
          description: "",
          note: null,
          estimateHours: null,
        },
      ]);
    });
    await waitFor(() => {
      expect(history.location.search).toContain(`activity=${newId}`);
    });
  });

  it("refuses an empty name under its field, saving nothing", async () => {
    const { fetch } = await startAdding();
    await userEvent.click(activityPanel().getByRole("button", { name: "Add" }));
    expect(await activityPanel().findByText("Name needed")).toBeTruthy();
    expect(sentTo(fetch)).not.toContain(`POST ${activitiesPath}`);
  });

  // The plan's New forms show the server's refusal in a notification, as every page's do.
  it("keeps what was entered, with the reason, when the server refuses a name taken", async () => {
    await startAdding({
      [`POST ${activitiesPath}`]: () =>
        Response.json(
          { error: "This project already has an activity with that name" },
          { status: 409 },
        ),
    });
    const name = activityPanel().getByRole<HTMLInputElement>("textbox", {
      name: "Name",
    });
    await userEvent.type(name, "General");
    await userEvent.click(activityPanel().getByRole("button", { name: "Add" }));
    expect(
      await screen.findByText(
        "This project already has an activity with that name",
      ),
    ).toBeTruthy();
    expect(name.value).toBe("General");
  });

  it("asks before discarding what was entered", async () => {
    await startAdding();
    await userEvent.type(
      activityPanel().getByRole("textbox", { name: "Name" }),
      "Unsure",
    );
    await userEvent.click(
      activityPanel().getByRole("button", { name: "Cancel" }),
    );
    expect(
      await screen.findByRole("dialog", { name: "Discard the new activity?" }),
    ).toBeTruthy();
    await userEvent.click(screen.getByRole("button", { name: "Keep adding" }));
    expect(
      activityPanel().getByRole<HTMLInputElement>("textbox", { name: "Name" })
        .value,
    ).toBe("Unsure");
  });

  it("isn't offered to those who may not change the plan", async () => {
    await openPage(atProject, plan({ canEdit: false }), {}, [
      "plan:view",
      "features:view",
    ]);
    await screen.findByRole("heading", { name: "Activities" });
    expect(screen.queryByRole("button", { name: "Add activity" })).toBeNull();
  });
});

describe("changing and removing an activity", () => {
  it("changes its name from its details, as a draft", async () => {
    const { fetch } = await openPage(atActivity, withActivity(), {
      [`PUT ${activitiesPath}/${activityId}`]: saved(() =>
        withActivity({ name: "Data move" }),
      ),
    });
    await activityPanel().findByRole("heading", { name: "Data migration" });
    await userEvent.click(
      activityPanel().getByRole("button", { name: "Change Name" }),
    );
    const name = activityPanel().getByRole("textbox", { name: "Name" });
    await userEvent.clear(name);
    await userEvent.type(name, "Data move{Enter}");
    await waitFor(() => {
      expect(sent(fetch, `PUT ${activitiesPath}/${activityId}`)).toEqual([
        {
          name: "Data move",
          description: "Move the old bookings",
          note: null,
          estimateHours: 40,
        },
      ]);
    });
  });

  it("removes it from its menu in the project's details", async () => {
    const { fetch } = await openPage(atProject, withActivity(), {
      [`DELETE ${activitiesPath}/${activityId}`]: deleted,
    });
    await screen.findByRole("heading", { name: "Activities" });
    await userEvent.click(
      activitiesSection().getByRole("button", {
        name: "Actions for Data migration",
      }),
    );
    await userEvent.click(
      await screen.findByRole("menuitem", { name: "Remove activity" }),
    );
    await waitFor(() => {
      expect(sentTo(fetch)).toContain(`DELETE ${activitiesPath}/${activityId}`);
    });
  });

  const menuOf = async () => {
    await userEvent.click(
      await screen.findByRole("button", {
        name: "Actions for Data migration",
      }),
    );
    return screen.findByRole("menu");
  };

  it("opens its details from its menu", async () => {
    const { history } = await openPage(atProject, withActivity());
    await userEvent.click(
      within(await menuOf()).getByRole("menuitem", { name: "Show details" }),
    );
    await waitFor(() => {
      expect(history.location.search).toContain(`activity=${activityId}`);
    });
  });

  it("discards its draft from its menu", async () => {
    const { fetch } = await openPage(
      atProject,
      withActivity({ draft: recordDraft() }),
      {
        [`DELETE /api/records/project-activity/${activityId}/draft`]: deleted,
      },
    );
    await userEvent.click(
      within(await menuOf()).getByRole("menuitem", { name: /Discard/ }),
    );
    await waitFor(() => {
      expect(sentTo(fetch)).toContain(
        `DELETE /api/records/project-activity/${activityId}/draft`,
      );
    });
  });

  it("sends a rejected draft for approval again from its menu", async () => {
    const { fetch } = await openPage(
      atProject,
      withActivity({
        draft: recordDraft({ state: "rejected", reason: "Too vague" }),
      }),
      {
        [`DELETE /api/records/project-activity/${activityId}/draft/rejection`]:
          deleted,
      },
    );
    await userEvent.click(
      within(await menuOf()).getByRole("menuitem", { name: /Resubmit/ }),
    );
    await waitFor(() => {
      expect(sentTo(fetch)).toContain(
        `DELETE /api/records/project-activity/${activityId}/draft/rejection`,
      );
    });
  });

  it("asks before approving its draft from its menu", async () => {
    await openPage(
      atProject,
      withActivity({ draft: recordDraft() }),
      {},
      approver,
    );
    await userEvent.click(
      within(await menuOf()).getByRole("menuitem", { name: "Approve…" }),
    );
    expect(await screen.findByRole("dialog")).toBeTruthy();
  });
});

describe("an activity's address", () => {
  it("shows no details for an activity of another project", async () => {
    await openPage(
      atActivity,
      withActivity({ projectId: "a0000000-0000-4000-8000-0000000000ee" }),
    );
    await screen.findByRole("heading", { name: "Activities" });
    expect(document.getElementById("activity-panel")).toBeNull();
  });
});
