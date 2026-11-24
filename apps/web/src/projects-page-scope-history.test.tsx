// SPDX-License-Identifier: Apache-2.0

// Tests for a proposal's and a project's scope history, and the reasons given for removing features.

import { screen, waitFor, within } from "@testing-library/react";
import { userEvent } from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { recordDraft } from "./test-support.tsx";
import {
  proposalId,
  projectId,
  project,
  proposal,
  saved,
  openPage,
  sent,
  sentTo,
  second,
  first,
  featurePlan,
  answers,
  featureEditor,
  planEditor,
} from "./test-projects-page.tsx";

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("the Features page", () => {
  describe("the projects and proposals that name a feature", () => {
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
  });
});
