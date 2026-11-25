// SPDX-License-Identifier: Apache-2.0

// Tests for schedules' drafts: the Draft menu's views, and deciding a schedule's draft from its
// row's menu.

import { screen, waitFor, within } from "@testing-library/react";
import { userEvent } from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import {
  fictionalPattern,
  fictionalRelease,
  fictionalStream,
  streamId,
  streamsAnswer,
} from "./test-releases.ts";
import {
  bodyOf,
  featureDraft,
  noFeatureColumns,
  recordDraft,
  renderApp,
  serverAnswers,
  signedIn,
} from "./test-support.tsx";
import {
  setUpEachTest,
  editsAll,
  approver,
  changeSetId,
  pattern,
  openStream,
  openIn,
  openRowMenu,
  chooseRowAction,
  cellOf,
  detailsOf,
  calls,
} from "./test-releases-page.tsx";

setUpEachTest();

const savedAs = () => Response.json({ changeSetId });

describe("the Draft menu", () => {
  const drafted = [
    fictionalStream({
      name: "Fictional Majors",
      draft: recordDraft({
        changed: ["name"],
        live: { name: "Fictional Earlier" },
      }),
    }),
    fictionalStream({
      id: "10000000-0000-4000-8000-000000000002",
      name: "Fictional Added",
      draft: recordDraft({ action: "created" }),
    }),
    fictionalStream({
      id: "10000000-0000-4000-8000-000000000003",
      name: "Fictional Back",
      retired: true,
      draft: recordDraft({ changed: ["retired"] }),
    }),
  ];
  const names = () =>
    within(screen.getByRole("grid", { name: "Schedules" }))
      .getAllByRole("button", { name: /^Show details of / })
      .map((button) =>
        button.getAttribute("aria-label")?.replace("Show details of ", ""),
      );
  const choose = async (name: string) => {
    await userEvent.click(
      screen.getByRole("button", { name: /^Draft(?!s of)/ }),
    );
    await userEvent.click(
      await screen.findByRole("menuitem", {
        name: (shown) => shown.startsWith(name),
      }),
    );
    await userEvent.keyboard("{Escape}");
  };

  it("shows the streams live alone, as their drafts make them, or beside live, keeping the choice in the address", async () => {
    serverAnswers({
      "GET /api/session": signedIn,
      "GET /api/release-streams": streamsAnswer(drafted),
    });
    const history = renderApp("/releases?tab=schedules&show=live&retired=true");
    await detailsOf("Fictional Earlier");
    expect(names()).toEqual(["Fictional Earlier", "Fictional Back"]);
    expect(cellOf("Fictional Back", 0).textContent).not.toContain("Retired,");
    await choose("Drafts applied");
    await waitFor(() => {
      expect(history.location.search).toContain("show=drafts");
    });
    await detailsOf("Fictional Added");
    expect(names()).toEqual([
      "Fictional Majors",
      "Fictional Added",
      "Fictional Back",
    ]);
    expect(cellOf("Fictional Back", 0).textContent).toContain("Retired");
    await choose("Drafts & Live");
    await waitFor(() => {
      expect(history.location.search).not.toContain("show");
    });
  });

  it("keeps the choice in the address as a stream is opened", async () => {
    serverAnswers({
      "GET /api/session": signedIn,
      "GET /api/release-streams": streamsAnswer(drafted),
    });
    const history = renderApp("/releases?tab=schedules&show=drafts");
    await userEvent.click(await detailsOf("Fictional Majors"));
    await waitFor(() => {
      expect(openIn(history)).toBe(streamId);
    });
    expect(history.location.search).toContain("show=drafts");
  });
});

describe("a schedule's draft in its row's menu", () => {
  const draftPath = `/api/records/release-stream/${streamId}/draft`;

  it("shows who made a draft, and closes the menu on a click beside its items", async () => {
    await openStream([fictionalStream({ draft: recordDraft() })]);
    const menu = await openRowMenu();
    await userEvent.click(within(menu).getByText(/by Fictional Editor$/));
    await waitFor(() => {
      expect(screen.queryByRole("menu")).toBeNull();
    });
  });

  it("discards a draft", async () => {
    const { fetch } = await openStream(
      [fictionalStream({ draft: recordDraft() })],
      { can: editsAll, answers: { [`DELETE ${draftPath}`]: savedAs } },
    );
    await chooseRowAction("Discard draft");
    expect(await screen.findByText("Discarded the draft.")).toBeDefined();
    expect(calls(fetch, "DELETE")).toEqual([draftPath]);
  });

  it("resubmits a rejected draft", async () => {
    const { fetch } = await openStream(
      [
        fictionalStream({
          draft: recordDraft({ state: "rejected", reason: "Fictional reason" }),
        }),
      ],
      {
        can: editsAll,
        answers: { [`DELETE ${draftPath}/rejection`]: savedAs },
      },
    );
    await chooseRowAction("Resubmit");
    expect(await screen.findByText("Resubmitted the draft.")).toBeDefined();
    expect(calls(fetch, "DELETE")).toEqual([`${draftPath}/rejection`]);
  });

  it("offers no discarding on a schedule whose only draft is a release's", async () => {
    // Given a schedule with no draft of its own, whose next release is drafted to be renamed
    await openStream(
      [
        fictionalStream({
          releases: [
            fictionalRelease({
              draft: recordDraft({
                changed: ["name"],
                live: { name: "Fictional Before" },
              }),
            }),
          ],
        }),
      ],
      { can: editsAll },
    );

    // Then its row's menu offers neither Discard draft nor Resubmit
    const menu = await openRowMenu();
    expect([
      within(menu).queryByRole("menuitem", { name: "Discard draft" }),
      within(menu).queryByRole("menuitem", { name: "Resubmit" }),
    ]).toEqual([null, null]);
  });

  it("offers no discarding of a draft someone else is changing, and says who", async () => {
    await openStream(
      [
        fictionalStream({
          draft: recordDraft(),
          heldBy: "Fictional Colleague",
        }),
      ],
      { can: editsAll },
    );
    const menu = await openRowMenu();
    expect([
      within(menu).queryByRole("menuitem", { name: "Discard draft" }),
      within(menu).getByText(/^Being changed by Fictional Colleague\./),
    ]).toEqual([null, expect.anything()]);
  });

  it("says only the user sees their unpublished draft", async () => {
    await openStream([
      fictionalStream({
        draft: recordDraft({ unpublished: true }),
      }),
    ]);
    await openRowMenu();
    expect(
      await screen.findByText(
        "Nobody else sees these changes until they're published.",
      ),
    ).toBeDefined();
  });

  it("names a feature's draft that approving includes", async () => {
    const featureId = "00000000-0000-4000-8000-0000000000f1";
    const stream = fictionalStream({
      draft: recordDraft({
        action: "changed",
        uses: [{ type: "feature", id: featureId }],
      }),
    });
    const { fetch } = await openStream([stream], {
      answers: {
        "GET /api/session": approver,
        "GET /api/projects": () =>
          Response.json({
            customers: [],
            projects: [],
            proposals: [],
            features: [
              {
                id: featureId,
                keyNumber: 1,
                name: "Fictional Moving",
                statusId: "s1",
                priorityId: null,
                sizeId: null,
                riskId: null,
                neededBy: null,
                staffed: false,
                staffedLive: false,
                customerIds: [],
                note: null,
                values: {},
                links: {},
                targetStreamId: streamId,
                targetCycle: "2027-07-01",
                estimateHours: null,
                featureTeamId: null,
                description: null,
                draft: featureDraft({ action: "changed" }),
              },
            ],
            canEdit: false,
            canEditFeatures: false,
            featureColumns: noFeatureColumns,
          }),
      },
    });
    await waitFor(() => {
      expect(fetch.mock.calls.map(([url]) => url)).toContain("/api/projects");
    });
    await chooseRowAction("Approve draft…");
    const dialog = await screen.findByRole("dialog", {
      name: "Approve 2 drafts?",
    });
    expect(
      within(dialog).getByText("the feature Fictional Moving"),
    ).toBeDefined();
  });

  it("approves a draft with the drafts it uses", async () => {
    // Given a schedule's change that uses a change of its cycles only drafted to be added
    const stream = fictionalStream({
      draft: recordDraft({
        uses: [{ type: "cycle-pattern", id: pattern.id }],
      }),
      patterns: [
        fictionalPattern({ draft: recordDraft({ action: "created" }) }),
      ],
    });
    const { fetch } = await openStream([stream], {
      answers: {
        "GET /api/session": approver,
        "POST /api/drafts/approval": savedAs,
      },
    });
    await chooseRowAction("Approve draft…");
    const dialog = await screen.findByRole("dialog", {
      name: "Approve 2 drafts?",
    });
    await userEvent.click(
      within(dialog).getByRole("button", { name: "Approve" }),
    );
    await waitFor(() => {
      expect(screen.queryByRole("dialog")).toBeNull();
    });
    expect(
      JSON.parse(
        fetch.mock.calls.find(([url]) => url === "/api/drafts/approval")?.[1]
          ?.body as string,
      ),
    ).toEqual(
      expect.objectContaining({
        records: [
          { type: "release-stream", id: streamId },
          { type: "cycle-pattern", id: pattern.id },
        ],
      }),
    );
  });

  it("approves only the schedule's own draft from its row, leaving its parts' drafts", async () => {
    // Given a renamed schedule whose cycles and release also have drafts
    const stream = fictionalStream({
      draft: recordDraft(),
      patterns: [fictionalPattern({ draft: recordDraft() })],
      releases: [fictionalRelease({ draft: recordDraft() })],
    });
    const { fetch } = await openStream([stream], {
      answers: {
        "GET /api/session": approver,
        "POST /api/drafts/approval": savedAs,
      },
    });

    // When Approve draft… is chosen from its row's menu
    await chooseRowAction("Approve draft…");
    const dialog = await screen.findByRole("dialog", {
      name: "Approve 1 draft?",
    });
    await userEvent.click(
      within(dialog).getByRole("button", { name: "Approve" }),
    );
    await waitFor(() => {
      expect(screen.queryByRole("dialog")).toBeNull();
    });

    // Then only the schedule's own draft is approved
    expect(bodyOf(fetch, "POST", "/api/drafts/approval")).toEqual([
      expect.objectContaining({
        records: [{ type: "release-stream", id: streamId }],
      }),
    ]);
  });

  it("offers no approval on a schedule's row whose only drafts are its parts'", async () => {
    await openStream(
      [
        fictionalStream({
          patterns: [fictionalPattern({ draft: recordDraft() })],
          releases: [fictionalRelease({ draft: recordDraft() })],
        }),
      ],
      { answers: { "GET /api/session": approver } },
    );
    const menu = await openRowMenu();
    expect([
      within(menu).queryByRole("menuitem", { name: "Approve draft…" }),
      within(menu).queryByRole("menuitem", { name: "Reject draft…" }),
    ]).toEqual([null, null]);
  });

  it("asks before rejecting a draft, and closes when cancelled", async () => {
    await openStream([fictionalStream({ draft: recordDraft() })], {
      answers: { "GET /api/session": approver },
    });
    await chooseRowAction("Reject draft…");
    const dialog = await screen.findByRole("dialog", {
      name: "Reject 1 draft?",
    });
    await userEvent.click(
      within(dialog).getByRole("button", { name: "Cancel" }),
    );
    await waitFor(() => {
      expect(screen.queryByRole("dialog")).toBeNull();
    });
  });

  it("approves no draft that uses a rejected one, saying it waits for that one", async () => {
    // Given a schedule's change that uses a rejected change of its cycles
    const stream = fictionalStream({
      draft: recordDraft({
        uses: [{ type: "cycle-pattern", id: pattern.id }],
      }),
      patterns: [
        fictionalPattern({
          draft: recordDraft({ action: "created", state: "rejected" }),
        }),
      ],
    });
    const { fetch } = await openStream([stream], {
      answers: { "GET /api/session": approver },
    });

    // When approving it is chosen from its row's menu
    await chooseRowAction("Approve draft…");

    // Then Fathom says it waits for the rejected one, and approves nothing
    expect(
      await screen.findByText(
        "This draft can't be decided until the rejected draft it waits on is resubmitted.",
      ),
    ).toBeDefined();
    expect(calls(fetch, "POST")).toEqual([]);
  });

  it("offers no approval of a draft this account changed, but still rejecting it", async () => {
    const stream = fictionalStream({
      draft: recordDraft({ needsOtherApprover: true }),
    });
    await openStream([stream], { answers: { "GET /api/session": approver } });
    const menu = await openRowMenu();
    const approve = within(menu).getByRole("menuitem", {
      name: "Approve draft…",
    });
    expect(
      approve.hasAttribute("disabled") ||
        approve.getAttribute("data-disabled") === "true",
    ).toBe(true);
    expect(within(menu).getByText("Needs another approver")).toBeDefined();
    expect(
      within(menu)
        .getByRole("menuitem", { name: "Reject draft…" })
        .hasAttribute("data-disabled"),
    ).toBe(false);
  });

  it("closes only the row's menu with Escape, keeping the panel open", async () => {
    const { history } = await openStream([
      fictionalStream({ draft: recordDraft() }),
    ]);
    await openRowMenu();
    await userEvent.keyboard("{Escape}");
    await waitFor(() => {
      expect(screen.queryByRole("menu")).toBeNull();
    });
    expect(openIn(history)).toBe(streamId);
  });

  it("moves through the row menu's items with the arrow keys, keeping the panel open", async () => {
    const { history } = await openStream(
      [fictionalStream({ draft: recordDraft() })],
      { can: editsAll },
    );
    await openRowMenu();
    await userEvent.keyboard("{ArrowDown}{ArrowDown}");
    expect([
      document.activeElement?.getAttribute("role"),
      openIn(history),
    ]).toEqual(["menuitem", streamId]);
  });
});
