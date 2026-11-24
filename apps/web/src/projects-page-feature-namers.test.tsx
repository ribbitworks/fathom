// SPDX-License-Identifier: Apache-2.0

// Tests for the projects and proposals that name a feature on the Features page.

import { screen, waitFor, within } from "@testing-library/react";
import { userEvent } from "@testing-library/user-event";
import { act } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { featureDraft, recordCell, recordDraft } from "./test-support.tsx";
import {
  proposalId,
  projectId,
  project,
  proposal,
  saved,
  openPage,
  sent,
  sentTo,
  sidePanel,
  rowMenu,
  chooseFrom,
  second,
  first,
  featurePlan,
  answers,
  featureEditor,
  open,
  rowNames,
  planEditor,
} from "./test-projects-page.tsx";

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("the Features page", () => {
  describe("the projects and proposals that name a feature", () => {
    const named = () =>
      featurePlan({
        canEdit: true,
        projects: [project({ featureIds: [first.id] })],
        proposals: [proposal({ featureIds: [first.id] })],
      });
    const openNamed = (path = "/features", more: object = {}) =>
      openPage(path, named(), { ...answers, ...more }, planEditor);
    const cell = (feature: { id: string }, key: string) =>
      recordCell(feature.id, key);

    it("names each by its ID, dimmed, then its name", async () => {
      await openNamed();
      const projects = cell(first, "projectIds");
      expect(projects?.textContent).toBe("FP-1 Fictional Project");
      expect(within(projects as HTMLElement).getByText("FP-1")).toBeTruthy();
      expect(cell(first, "proposalIds")?.textContent).toBe(
        "Fictional Proposal",
      );
      expect(cell(second, "projectIds")?.textContent).toBe("");
    });

    it.each([
      [
        "marks a project a draft adds the feature to",
        {
          featureIds: [first.id],
          draft: recordDraft({
            action: "changed",
            changed: ["featureIds"],
            live: { featureIds: [] },
          }),
        },
        ", added",
      ],
      [
        "marks a project only drafted to be added",
        { featureIds: [first.id], draft: recordDraft({ action: "created" }) },
        ", added",
      ],
      [
        "marks and strikes through a project a draft takes the feature from",
        {
          featureIds: [],
          draft: recordDraft({
            action: "changed",
            changed: ["featureIds"],
            live: { featureIds: [first.id] },
          }),
        },
        ", removed",
      ],
    ])("%s", async (_, more, words) => {
      await openPage(
        "/features",
        featurePlan({ canEdit: true, projects: [project(more)] }),
        answers,
        planEditor,
      );
      const projects = cell(first, "projectIds") as HTMLElement;
      expect([
        within(projects).getByText(words),
        within(projects)
          .getByText("Fictional Project")
          .closest("span")
          ?.className.includes("struck"),
      ]).toEqual([expect.anything(), words === ", removed"]);
    });

    const takenAway = () =>
      recordDraft({
        action: "changed",
        changed: ["featureIds"],
        live: { featureIds: [first.id] },
      });

    it("marks and strikes through a project drafted to be removed", async () => {
      await openPage(
        "/features",
        featurePlan({
          canEdit: true,
          projects: [
            project({
              featureIds: [first.id],
              draft: recordDraft({ action: "deleted" }),
            }),
          ],
        }),
        answers,
        planEditor,
      );
      expect(
        within(cell(first, "projectIds") as HTMLElement).getByText(", removed"),
      ).toBeTruthy();
    });

    it("shows a project as it is live under Live only, with Live's dot for its waiting removal", async () => {
      await openPage(
        "/features?show=live",
        featurePlan({
          canEdit: true,
          projects: [
            project({ featureIds: [], draft: takenAway() }),
            project({
              id: crypto.randomUUID(),
              name: "Fictional Added",
              externalId: null,
              featureIds: [first.id],
              draft: recordDraft({ action: "created" }),
            }),
          ],
        }),
        answers,
        planEditor,
      );
      const projects = cell(first, "projectIds") as HTMLElement;
      expect([
        projects.textContent.includes("Fictional Added"),
        projects.querySelector(
          '[data-tip="Live. Its removal is waiting for approval."]',
        ),
      ]).toEqual([false, expect.anything()]);
    });

    it("shows the projects naming a feature as they are live in its Live row", async () => {
      const renamed = {
        ...first,
        name: "Fictional Renamed",
        draft: featureDraft({
          changed: ["name"],
          live: { name: first.name },
        }),
      };
      await openPage(
        "/features",
        featurePlan({
          canEdit: true,
          features: [renamed],
          projects: [project({ featureIds: [], draft: takenAway() })],
        }),
        answers,
        planEditor,
      );
      // The drafted row strikes it through; the Live row under it names it as it is live.
      const names = within(
        screen.getByRole("grid", { name: "Features" }),
      ).getAllByText("Fictional Project");
      expect(
        names.map(
          (name) =>
            name
              .closest("span")
              ?.parentElement?.className.includes("struck") === true ||
            name.closest("span")?.className.includes("struck") === true,
        ),
      ).toEqual([true, false]);
    });

    const addedTo = (state: "waiting" | "rejected" = "waiting") =>
      recordDraft({
        action: "changed",
        state,
        changed: ["featureIds"],
        live: { featureIds: [] },
      });
    // Opens a feature's details, its one project given, in a Draft view.
    const openDetails = async (more: object, view = "") => {
      await openPage(
        `/features?open=${first.id}${view}`,
        featurePlan({ canEdit: true, projects: [project(more)] }),
        answers,
        planEditor,
      );
      await screen.findByRole("heading", { name: /Fictional First/ });
    };
    const projectLink = () =>
      within(sidePanel()).queryByRole("button", { name: /Fictional Project/ });

    it("marks a project a draft adds in a feature's details", async () => {
      await openDetails({
        featureIds: [first.id],
        draft: addedTo(),
      });
      expect(within(sidePanel()).getByText(", added")).toBeTruthy();
    });

    it("strikes through a project a draft takes away in a feature's details", async () => {
      await openDetails({ featureIds: [], draft: takenAway() });
      expect(projectLink()?.closest('[class*="struck"]')).not.toBeNull();
    });

    it("strikes through a waiting removal in a feature's details with drafts applied", async () => {
      await openDetails({ featureIds: [], draft: takenAway() }, "&show=drafts");
      expect(projectLink()?.closest('[class*="struck"]')).not.toBeNull();
    });

    it("leaves out a rejected addition in a feature's details with drafts applied", async () => {
      await openDetails(
        { featureIds: [first.id], draft: addedTo("rejected") },
        "&show=drafts",
      );
      expect(projectLink()).toBeNull();
    });

    it("leaves out a rejected addition in the cell with drafts applied", async () => {
      await openPage(
        "/features?show=drafts",
        featurePlan({
          canEdit: true,
          projects: [
            project({ featureIds: [first.id], draft: addedTo("rejected") }),
          ],
        }),
        answers,
        planEditor,
      );
      expect(cell(first, "projectIds")?.textContent).toBe("");
    });

    it("gives a waiting removal Live's dot in a feature's details under Live only", async () => {
      await openDetails({ featureIds: [], draft: takenAway() }, "&show=live");
      expect(
        projectLink()
          ?.closest("span")
          ?.parentElement?.querySelector(
            '[data-tip="Live. Its removal is waiting for approval."]',
          ),
      ).not.toBeNull();
    });

    it("leaves out a project a draft adds in a feature's details under Live only", async () => {
      await openDetails(
        { featureIds: [first.id], draft: addedTo() },
        "&show=live",
      );
      expect(projectLink()).toBeNull();
    });

    it("leaves unmarked a project whose draft changes something else", async () => {
      await openPage(
        "/features",
        featurePlan({
          canEdit: true,
          projects: [
            project({
              featureIds: [first.id],
              draft: recordDraft({
                action: "changed",
                changed: ["name"],
                live: { name: "Old" },
              }),
            }),
          ],
        }),
        answers,
        planEditor,
      );
      const projects = cell(first, "projectIds") as HTMLElement;
      expect([
        projects.textContent,
        within(projects).queryByText(/^, (added|removed)$/u),
      ]).toEqual(["FP-1 Fictional Project", null]);
    });

    it("shows a project's details beside Features, and its features there too", async () => {
      // Given a feature's details on Features
      const { history } = await openNamed(`/features?open=${first.id}`);
      // When its project is chosen
      await userEvent.click(
        await within(sidePanel()).findByRole("button", {
          name: "FP-1 Fictional Project",
        }),
      );
      // Then the project's details show, on Features still
      await screen.findByRole("heading", { name: "Fictional Project" });
      expect(history.location.pathname).toBe("/features");
      expect(history.location.search).toContain(`open=${projectId}`);
      expect(
        within(sidePanel()).getByRole("heading", { name: "Milestones" }),
      ).toBeTruthy();
      // And the feature it names opens in place
      await userEvent.click(
        within(sidePanel()).getByRole("button", { name: "Fictional First" }),
      );
      await screen.findByRole("heading", { name: "Fictional First" });
      expect(history.location.pathname).toBe("/features");
    });

    it("shows a proposal's details beside Features", async () => {
      await openNamed(`/features?open=${proposalId}`);
      await screen.findByRole("heading", { name: "Fictional Proposal" });
      expect(within(sidePanel()).getByText("Proposal ID")).toBeTruthy();
    });

    it("drafts the project a feature is added to, not the feature", async () => {
      const path = `/api/features/${second.id}/projects-and-proposals`;
      const after = () =>
        featurePlan({
          canEdit: true,
          projects: [project({ featureIds: [first.id, second.id] })],
          proposals: [proposal({ featureIds: [first.id] })],
        });
      const { fetch, held } = await openNamed("/features", {
        [`PUT ${path}`]: saved(after),
      });
      held.plan = after();
      act(() => {
        cell(second, "projectIds")?.focus();
      });
      await userEvent.keyboard("{Enter}");
      await userEvent.click(
        await screen.findByRole("option", { name: "FP-1 Fictional Project" }),
      );
      await userEvent.keyboard("{Enter}");
      await waitFor(() => {
        expect(sent(fetch, `PUT ${path}`)).toEqual([
          { projectIds: [projectId] },
        ]);
      });
      await waitFor(() => {
        expect(cell(second, "projectIds")?.textContent).toBe(
          "FP-1 Fictional Project",
        );
      });
      expect(sentTo(fetch)).not.toContain(`PUT /api/features/${second.id}`);
    });

    it.each(["customerIds", "projectIds", "proposalIds"])(
      "keeps %s read only for those who edit features but not the plan",
      async (key) => {
        await open({ ...named(), canEdit: false });
        expect(cell(first, key)?.getAttribute("aria-readonly")).toBe("true");
      },
    );

    it("lets those who edit the plan change a feature's customers", async () => {
      await openNamed();
      expect(cell(first, "customerIds")?.hasAttribute("aria-readonly")).toBe(
        false,
      );
    });

    it.each([
      ["those who edit the plan", true],
      ["those who edit features but not the plan", false],
    ] as const)(
      "offers a pencil on a feature's Customers in its details to %s",
      async (_who, edits) => {
        await openPage(
          `/features?open=${first.id}`,
          { ...named(), canEdit: edits },
          answers,
          edits ? planEditor : featureEditor,
        );
        await screen.findByRole("heading", { name: first.name });
        expect(
          within(sidePanel()).queryByRole("button", {
            name: "Change Customers",
          }) !== null,
        ).toBe(edits);
      },
    );

    it("leaves Customers out of New feature for those who edit features but not the plan", async () => {
      await open({ ...named(), canEdit: false });
      await userEvent.click(
        await screen.findByRole("button", { name: "New feature" }),
      );
      await screen.findByRole("heading", { name: "New feature" });
      expect(within(sidePanel()).queryByText("Customers")).toBeNull();
    });

    it("leaves them out of New feature", async () => {
      await openNamed();
      await userEvent.click(
        await screen.findByRole("button", { name: "New feature" }),
      );
      await screen.findByRole("heading", { name: "New feature" });
      expect(within(sidePanel()).getByText("Customers")).toBeTruthy();
      expect(within(sidePanel()).queryByText("Projects")).toBeNull();
      expect(within(sidePanel()).queryByText("Proposals")).toBeNull();
    });

    describe("removing a feature from a proposal", () => {
      it("saves it at once, with no reason asked for", async () => {
        // Given a feature in a proposal
        const featurePath = `/api/features/${first.id}/projects-and-proposals`;
        const { fetch } = await openNamed("/features", {
          [`PUT ${featurePath}`]: saved(named),
        });
        // When it is removed from the proposal
        act(() => {
          cell(first, "proposalIds")?.focus();
        });
        await userEvent.keyboard("{Enter}");
        await userEvent.click(
          await screen.findByRole("option", { name: "Fictional Proposal" }),
        );
        await userEvent.keyboard("{Enter}");
        // Then the change is saved as it is, and nothing asks for a reason
        await waitFor(() => {
          expect(sent(fetch, `PUT ${featurePath}`)).toEqual([
            { proposalIds: [] },
          ]);
        });
        expect(screen.queryByRole("dialog")).toBeNull();
      });

      it("saves it at once from the proposal's side too", async () => {
        // Given a proposal with two features, on the Proposals tab
        const proposalPath = `/api/proposals/${proposalId}`;
        const start = featurePlan({
          canEdit: true,
          proposals: [proposal({ featureIds: [first.id, second.id] })],
        });
        const { fetch } = await openPage(
          "/projects?tab=proposals",
          start,
          { ...answers, [`PUT ${proposalPath}`]: saved(() => start) },
          planEditor,
        );
        // When both are removed
        act(() => {
          recordCell(proposalId, "featureIds")?.focus();
        });
        await userEvent.keyboard("{Enter}");
        for (const name of ["Fictional First", "Fictional Second"]) {
          await userEvent.click(await screen.findByRole("option", { name }));
        }
        await userEvent.keyboard("{Enter}");
        // Then the proposal is saved without them, and nothing asks for a reason
        await waitFor(() => {
          expect(sent(fetch, `PUT ${proposalPath}`)).toMatchObject([
            { featureIds: [] },
          ]);
        });
        expect(sent(fetch, `PUT ${proposalPath}`)[0]).not.toHaveProperty(
          "removalReason",
        );
        expect(screen.queryByRole("dialog")).toBeNull();
      });
    });

    it("groups a feature's details under headings, in the table's order", async () => {
      await openNamed(`/features?open=${first.id}`);
      await screen.findByRole("heading", { name: "Fictional First" });
      expect(
        within(sidePanel())
          .getAllByRole("heading", { level: 3 })
          .map(({ textContent }) => textContent),
      ).toEqual(["Details", "Customers and commitments", "Planning"]);
    });

    it("opens a feature's note from its details", async () => {
      await openNamed(`/features?open=${first.id}`);
      await userEvent.click(
        await within(sidePanel()).findByRole("button", {
          name: "Open Notes",
        }),
      );
      expect(
        await screen.findByRole("heading", {
          name: "Notes for Fictional First",
        }),
      ).toBeTruthy();
    });

    it("shows them as they are live beside Live only", async () => {
      await openPage(
        "/features?show=live",
        featurePlan({
          projects: [
            project({
              featureIds: [first.id],
              draft: recordDraft({
                changed: ["featureIds"],
                live: { featureIds: [] },
              }),
            }),
          ],
        }),
        answers,
        featureEditor,
      );
      expect(cell(first, "projectIds")?.textContent).toBe("");
    });

    it.each([
      ["project", "/projects", "Fictional Project"],
      ["proposal", "/projects?tab=proposals", "Fictional Proposal"],
    ])(
      "opens Features filtered to a %s's features from its menu",
      async (_kind, path, name) => {
        const { history } = await openNamed(path);
        await chooseFrom(await rowMenu(name), "Show features");
        await waitFor(() => {
          expect(history.location.pathname).toBe("/features");
        });
        await waitFor(() => {
          expect(rowNames()).toEqual(["Fictional First"]);
        });
      },
    );
  });
});
