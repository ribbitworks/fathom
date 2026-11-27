// SPDX-License-Identifier: Apache-2.0

// Tests for a project's milestones on the Projects page: adding, changing and removing one from its
// project's panel, each change to its draft there, and its menu.

import { projectLengths } from "@fathom/shared";
import { screen, waitFor, within } from "@testing-library/react";
import { userEvent } from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { recordDraft } from "./test-support.tsx";
import {
  addingAnswer,
  projectId,
  milestoneId,
  type Milestone,
  milestone,
  project,
  plan,
  approver,
  saved,
  deleted,
  openPage,
  sent,
  sentTo,
  chooseFrom,
} from "./test-projects-page.tsx";

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("a project's milestones in its panel", () => {
  const withMilestone = (more: Partial<Milestone> = {}) =>
    plan({ projects: [project({ milestones: [milestone(more)] })] });
  const atProject = `/projects?open=${projectId}`;
  const path = `/api/projects/${projectId}/milestones`;

  it("adds one from a dialog", async () => {
    const { fetch } = await openPage(atProject, plan(), {
      "POST /api/milestones": addingAnswer(() => plan()),
    });
    await userEvent.click(
      await screen.findByRole("button", { name: "Add milestone" }),
    );
    const dialog = await screen.findByRole("dialog", { name: "New milestone" });
    await userEvent.click(
      within(dialog).getByRole("button", { name: "Add milestone" }),
    );
    expect(within(dialog).getByText("Name needed")).toBeTruthy();
    await waitFor(() => {
      expect(document.activeElement).toBe(
        within(dialog).getByRole("textbox", { name: /^Name/ }),
      );
    });
    await userEvent.type(
      within(dialog).getByRole("textbox", { name: /^Name/ }),
      "Pilot",
    );
    await userEvent.type(
      within(dialog).getByRole("textbox", { name: /^Date/ }),
      "20300315",
    );
    await userEvent.click(
      within(dialog).getByRole("checkbox", { name: "Customer delivery" }),
    );
    await userEvent.click(
      within(dialog).getByRole("button", { name: "Add milestone" }),
    );
    await waitFor(() => {
      expect(screen.queryByRole("dialog")).toBeNull();
    });
    expect(sent(fetch, "POST /api/milestones")).toEqual([
      {
        records: [
          {
            name: "Pilot",
            date: "2030-03-15",
            customerDelivery: true,
            projectId,
          },
        ],
      },
    ]);
  });

  describe("the dialog's checks", () => {
    const openDialog = async () => {
      await openPage(atProject, plan());
      await userEvent.click(
        await screen.findByRole("button", { name: "Add milestone" }),
      );
      const dialog = await screen.findByRole("dialog", {
        name: "New milestone",
      });
      return {
        dialog: within(dialog),
        name: within(dialog).getByRole<HTMLInputElement>("textbox", {
          name: /^Name/,
        }),
        date: within(dialog).getByRole<HTMLInputElement>("textbox", {
          name: /^Date/,
        }),
        submit: () =>
          userEvent.click(
            within(dialog).getByRole("button", { name: "Add milestone" }),
          ),
      };
    };

    it("starts in Name, which stops at the longest name", async () => {
      const { name } = await openDialog();
      await waitFor(() => {
        expect(document.activeElement).toBe(name);
      });
      expect(name.maxLength).toBe(projectLengths.name);
    });

    it("says a date is needed, and takes it back once one is given", async () => {
      const { dialog, date, submit } = await openDialog();
      await submit();
      expect(dialog.getByText("Date needed")).toBeTruthy();
      await userEvent.type(date, "20300315");
      expect(dialog.queryByText("Date needed")).toBeNull();
    });

    it("says an unfinished date is not a date", async () => {
      const { dialog, date, submit } = await openDialog();
      await userEvent.type(date, "2030");
      await submit();
      expect(
        dialog.getByText("Type a date for Date, such as 2026-10-31"),
      ).toBeTruthy();
    });

    it("needs more than spaces in a name, and takes that back once given one", async () => {
      const { dialog, name, submit } = await openDialog();
      await userEvent.type(name, "   ");
      await submit();
      expect(dialog.getByText("Name needed")).toBeTruthy();
      await userEvent.type(name, "Pilot");
      expect(dialog.queryByText("Name needed")).toBeNull();
    });
  });

  it("closes the dialog on Cancel", async () => {
    await openPage(atProject, plan());
    await userEvent.click(
      await screen.findByRole("button", { name: "Add milestone" }),
    );
    const dialog = await screen.findByRole("dialog", { name: "New milestone" });
    await userEvent.click(
      within(dialog).getByRole("button", { name: "Cancel" }),
    );
    await waitFor(() => {
      expect(screen.queryByRole("dialog")).toBeNull();
    });
  });

  it("changes one from a dialog", async () => {
    const start = withMilestone();
    const { fetch } = await openPage(atProject, start, {
      [`PUT ${path}/${milestoneId}`]: saved(() => start),
    });
    await userEvent.click(
      await screen.findByRole("button", {
        name: "Actions for Fictional Kickoff",
      }),
    );
    await userEvent.click(
      await screen.findByRole("menuitem", { name: "Edit…" }),
    );
    const dialog = await screen.findByRole("dialog", {
      name: "Edit milestone",
    });
    await userEvent.click(within(dialog).getByRole("button", { name: "Save" }));
    await waitFor(() => {
      expect(screen.queryByRole("dialog")).toBeNull();
    });
    expect(sent(fetch, `PUT ${path}/${milestoneId}`)).toEqual([
      {
        name: "Fictional Kickoff",
        date: "2030-03-15",
        customerDelivery: true,
      },
    ]);
  });

  it("removes one", async () => {
    const start = withMilestone();
    const { fetch } = await openPage(atProject, start, {
      [`DELETE ${path}/${milestoneId}`]: deleted,
    });
    await userEvent.click(
      await screen.findByRole("button", {
        name: "Actions for Fictional Kickoff",
      }),
    );
    await userEvent.click(
      await screen.findByRole("menuitem", { name: "Remove milestone" }),
    );
    await waitFor(() => {
      expect(sentTo(fetch)).toContain(`DELETE ${path}/${milestoneId}`);
    });
  });

  it("offers no menu to those who may not change it, while it has no draft", async () => {
    await openPage(atProject, { ...withMilestone(), canEdit: false }, {}, [
      "plan:view",
      "features:view",
    ]);
    await screen.findByText("Fictional Kickoff");
    expect(
      screen.queryByRole("button", { name: "Actions for Fictional Kickoff" }),
    ).toBeNull();
  });

  it("shows no way to add to a project being removed", async () => {
    await openPage(
      atProject,
      plan({
        projects: [project({ draft: recordDraft({ action: "deleted" }) })],
      }),
    );
    await screen.findByRole("heading", { name: /Fictional Project/ });
    expect(screen.queryByRole("button", { name: "Add milestone" })).toBeNull();
  });

  it("offers only discarding its draft while it is being removed", async () => {
    await openPage(
      atProject,
      withMilestone({ draft: recordDraft({ action: "deleted" }) }),
    );
    await userEvent.click(
      await screen.findByRole("button", {
        name: "Actions for Fictional Kickoff",
      }),
    );
    const menu = await screen.findByRole("menu");
    expect(within(menu).queryByRole("menuitem", { name: "Edit…" })).toBeNull();
    expect(
      within(menu).getByRole("menuitem", { name: /Discard/ }),
    ).toBeTruthy();
  });

  it("offers editing but not removing one only drafted to be added", async () => {
    await openPage(
      atProject,
      withMilestone({ draft: recordDraft({ action: "created" }) }),
    );
    await userEvent.click(
      await screen.findByRole("button", {
        name: "Actions for Fictional Kickoff",
      }),
    );
    const menu = await screen.findByRole("menu");
    expect(within(menu).getByRole("menuitem", { name: "Edit…" })).toBeTruthy();
    expect(
      within(menu).queryByRole("menuitem", { name: "Remove milestone" }),
    ).toBeNull();
  });

  it("discards its draft", async () => {
    const start = withMilestone({ draft: recordDraft() });
    const { fetch } = await openPage(atProject, start, {
      [`DELETE /api/records/milestone/${milestoneId}/draft`]: deleted,
    });
    await userEvent.click(
      await screen.findByRole("button", {
        name: "Actions for Fictional Kickoff",
      }),
    );
    await userEvent.click(
      await screen.findByRole("menuitem", { name: /Discard/ }),
    );
    await waitFor(() => {
      expect(sentTo(fetch)).toContain(
        `DELETE /api/records/milestone/${milestoneId}/draft`,
      );
    });
  });

  it("sends a rejected draft for approval again", async () => {
    const start = withMilestone({
      draft: recordDraft({ state: "rejected", reason: "Too soon" }),
    });
    const { fetch } = await openPage(atProject, start, {
      [`DELETE /api/records/milestone/${milestoneId}/draft/rejection`]: deleted,
    });
    await userEvent.click(
      await screen.findByRole("button", {
        name: "Actions for Fictional Kickoff",
      }),
    );
    await userEvent.click(
      await screen.findByRole("menuitem", { name: /Resubmit/ }),
    );
    await waitFor(() => {
      expect(sentTo(fetch)).toContain(
        `DELETE /api/records/milestone/${milestoneId}/draft/rejection`,
      );
    });
  });

  it("publishes the user's own unpublished draft", async () => {
    const start = withMilestone({ draft: recordDraft({ unpublished: true }) });
    const { fetch } = await openPage(atProject, start, {
      "GET /api/unpublished": () =>
        Response.json({
          changes: [
            {
              subject: "the milestone Fictional Kickoff",
              action: "changed",
              key: `milestone ${milestoneId}`,
              linked: [],
            },
          ],
        }),
      "POST /api/unpublished/publish": () =>
        Response.json({ total: 1, left: 0 }),
    });
    await userEvent.click(
      await screen.findByRole("button", {
        name: "Actions for Fictional Kickoff",
      }),
    );

    await userEvent.click(
      await screen.findByRole("menuitem", { name: "Publish draft…" }),
    );

    expect(await screen.findByText("Published 1 change.")).toBeTruthy();
    expect(
      (
        sent(fetch, "POST /api/unpublished/publish") as {
          drafts: { records: unknown[] };
        }[]
      ).map(({ drafts }) => drafts.records),
    ).toEqual([[{ type: "milestone", id: milestoneId }]]);
  });

  it("asks before approving or rejecting its draft", async () => {
    await openPage(
      atProject,
      withMilestone({ draft: recordDraft() }),
      {},
      approver,
    );
    const open = async () => {
      await userEvent.click(
        await screen.findByRole("button", {
          name: "Actions for Fictional Kickoff",
        }),
      );
      return screen.findByRole("menu");
    };
    await chooseFrom(await open(), "Approve…");
    const approve = await screen.findByRole("dialog");
    await userEvent.click(
      within(approve).getByRole("button", { name: "Cancel" }),
    );
    await waitFor(() => {
      expect(screen.queryByRole("dialog")).toBeNull();
    });
    await chooseFrom(await open(), "Reject…");
    expect(await screen.findByRole("dialog")).toBeTruthy();
  });

  it("names who holds it, and closes on Esc", async () => {
    await openPage(
      atProject,
      withMilestone({
        draft: recordDraft(),
        heldBy: "Someone Else",
      }),
    );
    await userEvent.click(
      await screen.findByRole("button", {
        name: "Actions for Fictional Kickoff",
      }),
    );
    expect(
      within(await screen.findByRole("menu")).getByText(/Someone Else/),
    ).toBeTruthy();
    await userEvent.keyboard("{Escape}");
    await waitFor(() => {
      expect(screen.queryByRole("menu")).toBeNull();
    });
  });
});

describe("a milestone's menu", () => {
  it("closes on a click on nothing in it, ignores other keys, and marks an unpublished draft", async () => {
    await openPage(
      `/projects?open=${projectId}`,
      plan({
        projects: [
          project({
            milestones: [
              milestone({ draft: recordDraft({ unpublished: true }) }),
            ],
          }),
        ],
      }),
    );
    await userEvent.click(
      await screen.findByRole("button", {
        name: "Actions for Fictional Kickoff",
      }),
    );
    const menu = await screen.findByRole("menu");
    expect(
      within(menu).getByText(/Nobody else sees these changes/),
    ).toBeTruthy();
    await userEvent.keyboard("a");
    expect(screen.getByRole("menu")).toBeTruthy();
    await userEvent.click(within(menu).getByText("Fictional Kickoff"));
    await waitFor(() => {
      expect(screen.queryByRole("menu")).toBeNull();
    });
  });
});
