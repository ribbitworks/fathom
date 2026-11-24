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
    const planEditor = [...featureEditor, "plan:edit"];
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

    describe("a proposal's and a project's scope history", () => {
      const at = "2030-01-02T10:00:00.000Z";
      const day = (when: string) =>
        new Intl.DateTimeFormat(undefined, { dateStyle: "medium" }).format(
          new Date(when),
        );
      const historyPath = (path: string, id: string) =>
        `GET /api/${path}/${id}/scope-history`;
      const removing = () =>
        featurePlan({
          canEdit: true,
          proposals: [
            proposal({
              featureIds: [],
              removalReasons: { [first.id]: "Too costly" },
              draft: recordDraft({
                changed: ["featureIds", "removalReasons"],
                live: { featureIds: [first.id], removalReasons: {} },
              }),
            }),
          ],
        });
      const history = (
        changes: object[] = [
          {
            featureId: first.id,
            name: "Fictional First",
            added: true,
            at,
            reason: null,
          },
        ],
      ) => ({
        [historyPath("proposals", proposalId)]: () =>
          Response.json({ changes }),
      });
      const rows = () =>
        within(
          screen
            .getByRole("heading", { name: "Scope history" })
            .closest("section") as HTMLElement,
        );

      it("lists a draft's removal first, dated when drafted, with its reason", async () => {
        await openPage(
          `/projects?tab=proposals&open=${proposalId}`,
          removing(),
          { ...answers, ...history() },
          planEditor,
        );
        await screen.findByText(`Added ${day(at)}`);
        expect(
          rows().getByText(`Removed ${day("2026-10-30T15:00:00.000Z")}`),
        ).toBeTruthy();
        expect(rows().getByText("Reason: Too costly")).toBeTruthy();
        expect(
          rows().getAllByRole("button", { name: "Fictional First" }),
        ).toHaveLength(2);
      });

      const reasonPath = `/api/features/${first.id}/proposals/${proposalId}/removal-reason`;
      const pencil = "Change reason for removing Fictional First";
      const reasonBox = () =>
        rows().getByRole<HTMLInputElement>("textbox", {
          name: "Reason for removing Fictional First",
        });
      const withReason = (reason: string) => {
        const changed = removing();
        return {
          ...changed,
          proposals: changed.proposals.map((one) => ({
            ...one,
            removalReasons: { [first.id]: reason },
          })),
        };
      };

      it("changes the reason of a draft's removal from its pencil, saved with Enter", async () => {
        // Given a feature a draft removes from a proposal, with a reason
        const { fetch, held } = await openPage(
          `/projects?tab=proposals&open=${proposalId}`,
          removing(),
          {
            ...answers,
            ...history(),
            [`PUT ${reasonPath}`]: saved(() => withReason("Later")),
          },
          planEditor,
        );
        held.plan = withReason("Later");
        // When its pencil opens the reason, which is changed and saved with Enter
        await userEvent.click(
          await rows().findByRole("button", { name: pencil }),
        );
        expect(reasonBox().value).toBe("Too costly");
        await userEvent.clear(reasonBox());
        await userEvent.type(reasonBox(), "Later{Enter}");
        // Then the new reason is sent, and shown at once, with focus back on the pencil
        await waitFor(() => {
          expect(sent(fetch, `PUT ${reasonPath}`)).toEqual([
            { removalReason: "Later" },
          ]);
        });
        expect(await rows().findByText("Reason: Later")).toBeTruthy();
        await waitFor(() => {
          expect(document.activeElement).toBe(
            rows().getByRole("button", { name: pencil }),
          );
        });
      });

      it("gives a reason to a removal with none, undated when its draft has no date, saved when the box is left", async () => {
        // Given a removal with no reason, its draft undated
        const { fetch } = await openPage(
          `/projects?tab=proposals&open=${proposalId}`,
          featurePlan({
            canEdit: true,
            proposals: [
              proposal({
                featureIds: [],
                draft: recordDraft({
                  changed: ["featureIds"],
                  live: { featureIds: [first.id] },
                  madeAt: null,
                }),
              }),
            ],
          }),
          {
            ...answers,
            ...history(),
            [`PUT ${reasonPath}`]: saved(() => withReason("Too costly")),
          },
          planEditor,
        );
        expect(await rows().findByText("Removed")).toBeTruthy();
        expect(rows().queryByText(/^Reason:/)).toBeNull();
        // When a reason is typed in the empty box and the box is left
        await userEvent.click(rows().getByRole("button", { name: pencil }));
        expect(reasonBox().value).toBe("");
        await userEvent.type(reasonBox(), " Too costly ");
        await userEvent.click(
          screen.getByRole("heading", { name: "Scope history" }),
        );
        // Then it is saved, trimmed
        await waitFor(() => {
          expect(sent(fetch, `PUT ${reasonPath}`)).toEqual([
            { removalReason: "Too costly" },
          ]);
        });
      });

      it("opens the reason from a click anywhere on its removal's row", async () => {
        await openPage(
          `/projects?tab=proposals&open=${proposalId}`,
          removing(),
          { ...answers, ...history() },
          planEditor,
        );

        await userEvent.click(
          await rows().findByText(`Removed ${day("2026-10-30T15:00:00.000Z")}`),
        );

        expect(reasonBox().value).toBe("Too costly");
      });

      it("opens the reason from a click on it, and Esc leaves it as it was", async () => {
        const { fetch } = await openPage(
          `/projects?tab=proposals&open=${proposalId}`,
          removing(),
          { ...answers, ...history() },
          planEditor,
        );
        await userEvent.click(await rows().findByText("Reason: Too costly"));
        await userEvent.type(reasonBox(), " and late{Escape}");
        expect(await rows().findByText("Reason: Too costly")).toBeTruthy();
        expect(sentTo(fetch)).not.toContain(`PUT ${reasonPath}`);
        await waitFor(() => {
          expect(document.activeElement).toBe(
            rows().getByRole("button", { name: pencil }),
          );
        });
      });

      it("clears the reason with the ×, saving it as none", async () => {
        const { fetch } = await openPage(
          `/projects?tab=proposals&open=${proposalId}`,
          removing(),
          {
            ...answers,
            ...history(),
            [`PUT ${reasonPath}`]: saved(removing),
          },
          planEditor,
        );
        await userEvent.click(
          await rows().findByRole("button", { name: pencil }),
        );
        await userEvent.click(
          rows().getByRole("button", { name: "Clear the reason" }),
        );
        expect(reasonBox().value).toBe("");
        await userEvent.type(reasonBox(), "{Enter}");
        await waitFor(() => {
          expect(sent(fetch, `PUT ${reasonPath}`)).toEqual([
            { removalReason: null },
          ]);
        });
      });

      it("saves nothing when the reason is left as it was", async () => {
        const { fetch } = await openPage(
          `/projects?tab=proposals&open=${proposalId}`,
          removing(),
          { ...answers, ...history() },
          planEditor,
        );
        await userEvent.click(
          await rows().findByRole("button", { name: pencil }),
        );
        await userEvent.type(reasonBox(), "{Enter}");
        expect(await rows().findByText("Reason: Too costly")).toBeTruthy();
        expect(sentTo(fetch)).not.toContain(`PUT ${reasonPath}`);
      });

      it("names a feature gone from the plan as removed on its pencil", async () => {
        const gone = crypto.randomUUID();
        await openPage(
          `/projects?tab=proposals&open=${proposalId}`,
          featurePlan({
            canEdit: true,
            proposals: [
              proposal({
                featureIds: [],
                draft: recordDraft({
                  changed: ["featureIds"],
                  live: { featureIds: [gone] },
                }),
              }),
            ],
          }),
          { ...answers, ...history() },
          planEditor,
        );
        expect(
          await rows().findByRole("button", {
            name: "Change reason for removing a removed feature",
          }),
        ).toBeTruthy();
      });

      it("offers no pencil to those who don't edit the plan", async () => {
        await openPage(
          `/projects?tab=proposals&open=${proposalId}`,
          { ...removing(), canEdit: false },
          { ...answers, ...history() },
          featureEditor,
        );
        await screen.findByText(`Added ${day(at)}`);
        expect(
          rows().queryByRole("button", { name: /^Change reason/ }),
        ).toBeNull();
        await userEvent.click(rows().getByText("Reason: Too costly"));
        expect(rows().queryByRole("textbox")).toBeNull();
      });

      it("leaves out drafts beside Live only", async () => {
        await openPage(
          `/projects?tab=proposals&open=${proposalId}&show=live`,
          removing(),
          { ...answers, ...history() },
          planEditor,
        );
        await screen.findByText(`Added ${day(at)}`);
        expect(rows().queryByText(/^Removed/)).toBeNull();
      });

      it("names a feature no longer on the roadmap as the history last named it, or as removed", async () => {
        await openPage(
          `/projects?tab=proposals&open=${proposalId}`,
          featurePlan({ canEdit: true }),
          {
            ...answers,
            ...history([
              {
                featureId: crypto.randomUUID(),
                name: "Fictional Gone",
                added: false,
                at,
                reason: "Out of scope",
              },
              {
                featureId: crypto.randomUUID(),
                name: null,
                added: true,
                at,
                reason: null,
              },
            ]),
          },
          planEditor,
        );
        expect(await rows().findByText("Fictional Gone")).toBeTruthy();
        expect(rows().getByText("A removed feature")).toBeTruthy();
        expect(rows().getByText("Reason: Out of scope")).toBeTruthy();
      });

      it("lists a project's drafted changes, with no reason to give, and opens a feature from them", async () => {
        // Given a project whose draft adds one feature and removes another
        const start = featurePlan({
          canEdit: true,
          projects: [
            project({
              featureIds: [second.id],
              draft: recordDraft({
                changed: ["featureIds"],
                live: { featureIds: [first.id] },
              }),
            }),
          ],
        });
        const { history: address } = await openPage(
          `/features?open=${projectId}`,
          start,
          {
            ...answers,
            [historyPath("projects", projectId)]: () =>
              Response.json({ changes: [] }),
          },
          planEditor,
        );
        // Then both show as drafts, the removal with no reason to change
        const drafted = day("2026-10-30T15:00:00.000Z");
        expect(await rows().findByText(`Added ${drafted}`)).toBeTruthy();
        expect(rows().getByText(`Removed ${drafted}`)).toBeTruthy();
        expect(
          rows().queryByRole("button", { name: /^Change reason/ }),
        ).toBeNull();
        // And a feature named there opens beside Features
        await userEvent.click(
          rows().getByRole("button", { name: "Fictional Second" }),
        );
        await screen.findByRole("heading", { name: "Fictional Second" });
        expect(address.location.search).toContain(`open=${second.id}`);
      });

      it("reads None when a project has no features", async () => {
        await openPage(
          `/projects?open=${projectId}`,
          featurePlan({ canEdit: true }),
          {
            ...answers,
            [historyPath("projects", projectId)]: () =>
              Response.json({ changes: [] }),
          },
          planEditor,
        );
        expect(await rows().findByText("None")).toBeTruthy();
      });

      it("says when the history can't be loaded, and tries again", async () => {
        const path = historyPath("proposals", proposalId);
        const { fetch } = await openPage(
          `/projects?tab=proposals&open=${proposalId}`,
          featurePlan({ canEdit: true }),
          { ...answers, [path]: () => new Response(null, { status: 500 }) },
          planEditor,
        );
        expect(
          await rows().findByText("Fathom could not load the scope history."),
        ).toBeTruthy();
        const tries = () =>
          sentTo(fetch).filter((sent) => sent === path).length;
        const before = tries();
        await userEvent.click(
          rows().getByRole("button", { name: "Try again" }),
        );
        await waitFor(() => {
          expect(tries()).toBeGreaterThan(before);
        });
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
