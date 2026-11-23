// SPDX-License-Identifier: Apache-2.0

// Tests for deciding drafts on the Lists page: who may decide which, drafts that wait on a
// rejected one, deciding every draft shown, and the Draft views.

import { screen, waitFor, within } from "@testing-library/react";
import { userEvent } from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { bodyOf, renderApp, serverAnswers } from "./test-support.tsx";
import {
  editor,
  choice,
  locations,
  skills,
  empty,
  removal,
  s1,
  u1,
  savedAs,
  panel,
  row,
  focusRow,
  undoLast,
  approverOnly,
  approver,
  waiting,
  added,
  draftedAnswer,
  listMenu,
  chooseInListMenu,
  sent,
  openDraftMenu,
  noPeople,
} from "./test-lists-page.tsx";

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("drafts on the Lists page", () => {
  it("gives an Approver who may not edit lists what to decide, in a list's and a choice's menus", async () => {
    serverAnswers({
      "GET /api/session": approverOnly,
      "GET /api/people": noPeople,
      "GET /api/lists": draftedAnswer,
    });
    renderApp("/lists/l5");
    await screen.findByRole("heading", { name: "Teams", level: 2 });
    expect(
      within(await listMenu("Teams")).getByRole("menuitem", {
        name: "Approve…",
      }),
    ).toBeDefined();
    // Other keys move within the menu; Esc closes it, leaving the panel open.
    await userEvent.keyboard("{ArrowDown}{Escape}");
    await waitFor(() => {
      expect(screen.queryByRole("menu")).toBeNull();
    });
    expect(
      screen.getByRole("heading", { name: "Teams", level: 2 }),
    ).toBeDefined();
    await userEvent.click(
      screen.getByRole("button", { name: "Actions for Platform" }),
    );
    expect(
      within(await screen.findByRole("menu")).getByRole("menuitem", {
        name: "Approve…",
      }),
    ).toBeDefined();
  });

  it("offers no approval of drafts this account changed, from a choice's menu or the Draft menu", async () => {
    const fetch = serverAnswers({
      "GET /api/session": approverOnly,
      "GET /api/people": noPeople,
      "GET /api/lists": () =>
        Response.json({
          lists: [
            {
              ...added,
              draft: { ...added.draft, needsOtherApprover: true },
              choices: added.choices.map((one) => ({
                ...one,
                draft: { ...one.draft, needsOtherApprover: true },
              })),
            },
          ],
        }),
    });
    renderApp("/lists/l5");
    await screen.findByRole("heading", { name: "Teams", level: 2 });
    await userEvent.click(
      screen.getByRole("button", { name: "Drafts of Teams" }),
    );
    const own = await screen.findByRole("menu");
    expect(
      within(own)
        .getByRole("menuitem", { name: "Approve…" })
        .hasAttribute("data-disabled"),
    ).toBe(true);
    await userEvent.keyboard("{Escape}");
    await waitFor(() => {
      expect(screen.queryByRole("menu")).toBeNull();
    });
    await userEvent.click(
      screen.getByRole("button", { name: "Actions for Platform" }),
    );
    const menu = await screen.findByRole("menu");
    expect(
      within(menu)
        .getByRole("menuitem", { name: "Approve…" })
        .hasAttribute("data-disabled"),
    ).toBe(true);
    expect(within(menu).getByText("Needs another approver")).toBeDefined();
    await userEvent.keyboard("{Escape}");
    await waitFor(() => {
      expect(screen.queryByRole("menu")).toBeNull();
    });
    await userEvent.click(
      within(await openDraftMenu()).getByRole("menuitem", {
        name: "Approve 2 drafts…",
      }),
    );
    const dialog = await screen.findByRole("dialog", {
      name: "Another approver needed",
    });
    expect(
      within(dialog)
        .getAllByRole("listitem")
        .map((item) => item.textContent),
    ).toEqual(["the list Teams", "the choice Platform in Teams"]);
    await userEvent.click(
      within(dialog).getByRole("button", { name: "Close" }),
    );
    await waitFor(() => {
      expect(screen.queryByRole("dialog")).toBeNull();
    });
    expect(sent(fetch, "POST", "/api/drafts/approval")).toBe(false);
  });

  it("disables approving a choice added to a list whose own addition was rejected", async () => {
    const fetch = serverAnswers({
      "GET /api/session": approverOnly,
      "GET /api/people": noPeople,
      "GET /api/lists": () =>
        Response.json({
          lists: [
            {
              ...added,
              draft: { ...added.draft, state: "rejected", reason: "Not yet" },
            },
          ],
        }),
    });
    renderApp("/lists/l5");
    await screen.findByRole("heading", { name: "Teams", level: 2 });
    await userEvent.click(
      screen.getByRole("button", { name: "Actions for Platform" }),
    );
    const menu = await screen.findByRole("menu");
    const approve = within(menu).getByRole("menuitem", { name: "Approve…" });
    expect(approve.hasAttribute("data-disabled")).toBe(true);
    expect(
      within(menu).getByText("Waiting for a rejected draft to be resubmitted"),
    ).toBeDefined();
    await userEvent.click(approve);
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(sent(fetch, "POST", "/api/drafts/approval")).toBe(false);
  });

  it("disables approving a new order that places a choice whose addition was rejected, and says none can be approved when all shown wait", async () => {
    serverAnswers({
      "GET /api/session": approverOnly,
      "GET /api/people": noPeople,
      "GET /api/lists": () =>
        Response.json({
          lists: [
            {
              ...locations,
              choices: [
                {
                  ...choice("c9", "Fenwick Down"),
                  draft: {
                    ...waiting,
                    state: "rejected",
                    reason: "Not yet",
                    action: "created",
                    changed: ["label", "description", "retired"],
                    live: {},
                  },
                },
                ...locations.choices,
              ],
              orderDraft: {
                ...waiting,
                live: locations.choices.map(({ id }) => id),
                uses: ["c9"],
              },
            },
          ],
        }),
    });
    renderApp("/lists/l1");
    await screen.findByRole("heading", { name: "Locations", level: 2 });
    const menu = await listMenu("Locations");
    expect(
      within(menu)
        .getAllByRole("menuitem", { name: "Approve…" })
        .map((item) => item.hasAttribute("data-disabled")),
    ).toEqual([true]);
    expect(
      within(menu).getByText("Waiting for a rejected draft to be resubmitted"),
    ).toBeDefined();
    await userEvent.keyboard("{Escape}");
    await waitFor(() => {
      expect(screen.queryByRole("menu")).toBeNull();
    });
    // Approving all shown, when every draft shown waits, says none can be approved yet.
    await userEvent.click(
      within(await openDraftMenu()).getByRole("menuitem", {
        name: "Approve 1 draft…",
      }),
    );
    const dialog = await screen.findByRole("dialog", {
      name: "Can't approve yet",
    });
    expect(
      within(dialog).getByText(
        "Waiting for a rejected draft to be resubmitted.",
      ),
    ).toBeDefined();
    await userEvent.click(
      within(dialog).getByRole("button", { name: "Close" }),
    );
    await waitFor(() => {
      expect(screen.queryByRole("dialog")).toBeNull();
    });
  });

  it("skips, when approving all shown, a new order that waits on a rejected choice", async () => {
    const fetch = serverAnswers({
      "GET /api/session": approverOnly,
      "GET /api/people": noPeople,
      "GET /api/lists": () =>
        Response.json({
          lists: [
            {
              ...locations,
              choices: [
                {
                  ...choice("c9", "Fenwick Down"),
                  draft: {
                    ...waiting,
                    state: "rejected",
                    reason: "Not yet",
                    action: "created",
                    changed: ["label", "description", "retired"],
                    live: {},
                  },
                },
                ...locations.choices,
              ],
              orderDraft: {
                ...waiting,
                live: locations.choices.map(({ id }) => id),
                uses: ["c9"],
              },
            },
            added,
          ],
        }),
      "POST /api/drafts/approval": savedAs(),
    });
    renderApp("/lists");
    await userEvent.click(
      within(await openDraftMenu()).getByRole("menuitem", {
        name: /^Approve \d+ drafts?…$/,
      }),
    );
    const dialog = await screen.findByRole("dialog", {
      name: "Approve 2 drafts?",
    });
    expect(
      within(dialog).getByText(
        "1 draft is skipped because it depends on a rejected draft.",
      ),
    ).toBeDefined();
    await userEvent.click(
      within(dialog).getByRole("button", { name: "Approve" }),
    );
    await waitFor(() => {
      expect(bodyOf(fetch, "POST", "/api/drafts/approval")).toEqual([
        {
          people: [],
          plannedHires: [],
          featureTeams: [],
          lists: ["l5"],
          choices: ["c8"],
          orders: [],
          columns: [],
          records: [],
        },
      ]);
    });
  });

  it("still waits, with drafts applied, for the rejected choice a new order places, and skips it when approving all", async () => {
    const fetch = serverAnswers({
      "GET /api/session": approverOnly,
      "GET /api/people": noPeople,
      "GET /api/lists": () =>
        Response.json({
          lists: [
            {
              ...locations,
              choices: [
                {
                  ...choice("c9", "Fenwick Down"),
                  draft: {
                    ...waiting,
                    state: "rejected",
                    reason: "Not yet",
                    action: "created",
                    changed: ["label", "description", "retired"],
                    live: {},
                  },
                },
                ...locations.choices,
              ],
              orderDraft: {
                ...waiting,
                live: locations.choices.map(({ id }) => id),
                uses: ["c9"],
              },
            },
            added,
          ],
        }),
      "POST /api/drafts/approval": savedAs(),
    });
    // Drafts applied takes the rejected choice back, but the order still depends on it.
    renderApp("/lists/l1?show=drafts");
    await screen.findByRole("heading", { name: "Locations", level: 2 });
    const menu = await listMenu("Locations");
    expect(
      within(menu)
        .getByRole("menuitem", { name: "Approve…" })
        .hasAttribute("data-disabled"),
    ).toBe(true);
    expect(
      within(menu).getByText("Waiting for a rejected draft to be resubmitted"),
    ).toBeDefined();
    await userEvent.keyboard("{Escape}");
    await waitFor(() => {
      expect(screen.queryByRole("menu")).toBeNull();
    });
    await userEvent.click(
      within(await openDraftMenu()).getByRole("menuitem", {
        name: /^Approve \d+ drafts?…$/,
      }),
    );
    const dialog = await screen.findByRole("dialog", {
      name: "Approve 2 drafts?",
    });
    expect(
      within(dialog).getByText(
        "1 draft is skipped because it depends on a rejected draft.",
      ),
    ).toBeDefined();
    await userEvent.click(
      within(dialog).getByRole("button", { name: "Approve" }),
    );
    await waitFor(() => {
      expect(bodyOf(fetch, "POST", "/api/drafts/approval")).toEqual([
        {
          people: [],
          plannedHires: [],
          featureTeams: [],
          lists: ["l5"],
          choices: ["c8"],
          orders: [],
          columns: [],
          records: [],
        },
      ]);
    });
  });

  it("skips, when approving all, a choice added to a list whose addition was rejected", async () => {
    const fetch = serverAnswers({
      "GET /api/session": approverOnly,
      "GET /api/people": noPeople,
      "GET /api/lists": () =>
        Response.json({
          lists: [
            locations,
            {
              ...added,
              draft: { ...added.draft, state: "rejected", reason: "Not yet" },
            },
            { ...skills, draft: { ...removal } },
          ],
        }),
      "POST /api/drafts/approval": savedAs(),
    });
    renderApp("/lists");
    await userEvent.click(
      within(await openDraftMenu()).getByRole("menuitem", {
        name: "Approve 2 drafts…",
      }),
    );
    const dialog = await screen.findByRole("dialog", {
      name: "Approve 1 draft?",
    });
    expect(
      within(dialog).getByText(
        "1 draft is skipped because it depends on a rejected draft.",
      ),
    ).toBeDefined();
    await userEvent.click(
      within(dialog).getByRole("button", { name: "Approve" }),
    );
    await waitFor(() => {
      expect(bodyOf(fetch, "POST", "/api/drafts/approval")).toEqual([
        {
          people: [],
          plannedHires: [],
          featureTeams: [],
          lists: ["l2"],
          choices: [],
          orders: [],
          columns: [],
          records: [],
        },
      ]);
    });
  });

  it("says how many waiting drafts a search hides, and decides only those shown", async () => {
    serverAnswers({
      "GET /api/session": approverOnly,
      "GET /api/people": noPeople,
      "GET /api/lists": () =>
        Response.json({
          lists: [
            {
              ...locations,
              orderDraft: {
                ...waiting,
                live: locations.choices.map(({ id }) => id),
              },
            },
            added,
          ],
        }),
    });
    renderApp("/lists?search=Teams");
    const menu = await openDraftMenu();
    expect(within(menu).getByText("2 of 3 waiting drafts shown")).toBeDefined();
    expect(
      within(menu).getByRole("menuitem", { name: "Approve 2 drafts…" }),
    ).toBeDefined();
  });

  it("offers Approvers nothing to decide on a rejected choice", async () => {
    const [platform] = added.choices;
    serverAnswers({
      "GET /api/session": approverOnly,
      "GET /api/people": noPeople,
      "GET /api/lists": () =>
        Response.json({
          lists: [
            {
              ...added,
              choices: [
                {
                  ...platform,
                  draft: {
                    ...platform?.draft,
                    state: "rejected",
                    reason: "Not yet",
                  },
                },
              ],
            },
          ],
        }),
    });
    renderApp("/lists/l5");
    await screen.findByRole("heading", { name: "Teams", level: 2 });
    await userEvent.click(
      screen.getByRole("button", { name: "Actions for Platform" }),
    );
    const menu = await screen.findByRole("menu");
    expect(within(menu).getByText("Reason: Not yet")).toBeDefined();
    expect(within(menu).queryAllByRole("menuitem")).toEqual([]);
  });

  it("rejects every draft waiting with those that use them, counting them first", async () => {
    const [platform] = added.choices;
    serverAnswers({
      "GET /api/session": approver,
      "GET /api/people": noPeople,
      "GET /api/lists": () =>
        Response.json({
          lists: [
            {
              ...added,
              choices: [
                {
                  ...platform,
                  draft: {
                    ...platform?.draft,
                    state: "rejected",
                    reason: "Not yet",
                  },
                },
              ],
            },
          ],
        }),
    });
    renderApp("/lists");
    await userEvent.click(
      within(await openDraftMenu()).getByRole("menuitem", {
        name: /^Reject \d+ drafts?…$/,
      }),
    );
    const dialog = await screen.findByRole("dialog", {
      name: "Reject 2 drafts?",
    });
    expect(
      within(dialog).getByText("Also rejects the drafts that use these:"),
    ).toBeDefined();
  });

  it("leaves out live rows and places when showing the drafts applied", async () => {
    serverAnswers({
      "GET /api/session": editor,
      "GET /api/lists": draftedAnswer,
    });
    renderApp("/lists/l1?show=drafts");
    await screen.findByRole("heading", { name: "Locations", level: 2 });
    expect(within(panel()).queryByText(", live")).toBeNull();
    expect(within(row("c1")).getByText(/Draft: moved/)).toBeDefined();
  });

  it("leaves out lists and choices drafted to be removed when showing the drafts applied", async () => {
    serverAnswers({
      "GET /api/session": editor,
      "GET /api/lists": () =>
        Response.json({
          lists: [
            {
              ...locations,
              choices: [
                { ...locations.choices[0], draft: removal },
                ...locations.choices.slice(1),
              ],
            },
            { ...skills, draft: removal },
            empty,
          ],
        }),
    });
    renderApp("/lists/l1?show=drafts");
    await screen.findByRole("heading", { name: "Locations", level: 2 });
    expect(screen.queryByText("Skills")).toBeNull();
    expect(
      within(panel()).queryByText(locations.choices[0]?.label as string),
    ).toBeNull();
  });

  it("discards drafts of choices from their menus, and of a list only drafted to be added from its menu", async () => {
    const fetch = serverAnswers({
      "GET /api/session": editor,
      "GET /api/lists": draftedAnswer,
      "DELETE /api/lists/l1/choices/c1/draft": savedAs(),
      "DELETE /api/lists/l5/choices/c8/draft": savedAs(),
      "DELETE /api/lists/l5/draft": savedAs(),
      [`POST /api/undo/${s1}`]: savedAs(u1),
    });
    const history = renderApp("/lists/l1");
    await screen.findByRole("heading", { name: "Locations", level: 2 });
    focusRow("c1");
    await userEvent.keyboard("{ContextMenu}");
    await userEvent.click(
      await screen.findByRole("menuitem", { name: "Discard draft" }),
    );
    expect(
      await screen.findByText("Discarded the draft of Kestrel Harbour."),
    ).toBeDefined();
    history.push("/lists/l5");
    await screen.findByRole("heading", { name: "Teams", level: 2 });
    focusRow("c8");
    await userEvent.keyboard("{ContextMenu}");
    await userEvent.click(
      await screen.findByRole("menuitem", { name: "Discard draft" }),
    );
    expect(
      await screen.findByText("Discarded the draft of Platform."),
    ).toBeDefined();
    await chooseInListMenu("Teams", "Discard draft");
    await waitFor(() => {
      expect(history.location.pathname).toBe("/lists");
    });
    await undoLast();
    await waitFor(() => {
      expect(history.location.pathname).toBe("/lists/l5");
    });
    expect(sent(fetch, "DELETE", "/api/lists/l5/draft")).toBe(true);
  });

  it("discards a choice only drafted to be added when it is removed", async () => {
    serverAnswers({
      "GET /api/session": editor,
      "GET /api/lists": draftedAnswer,
      "DELETE /api/lists/l5/choices/c8": savedAs(),
    });
    renderApp("/lists/l5");
    await screen.findByRole("heading", { name: "Teams", level: 2 });
    focusRow("c8");
    await userEvent.keyboard("{Delete}");
    expect(await screen.findByText("Discarded Platform.")).toBeDefined();
  });

  it("shows the live lists alone, read only, from the Draft menu, keeping the choice in the address", async () => {
    serverAnswers({
      "GET /api/session": editor,
      "GET /api/lists": draftedAnswer,
    });
    const history = renderApp("/lists?show=live");
    const table = await screen.findByRole("table", { name: "Lists" });
    expect(within(table).queryByText("Teams")).toBeNull();
    expect(screen.queryByRole("button", { name: "New list" })).toBeNull();
    const choose = async (name: string) => {
      await userEvent.click(screen.getByRole("button", { name: /^Draft/ }));
      await userEvent.click(
        await screen.findByRole("menuitem", {
          name: (shown) => shown.startsWith(name),
        }),
      );
      await userEvent.keyboard("{Escape}");
    };
    await choose("Drafts & Live");
    await waitFor(() => {
      expect(history.location.search).not.toContain("show");
    });
    expect(await within(table).findByText("Teams")).toBeDefined();
    await choose("Drafts applied");
    await waitFor(() => {
      expect(history.location.search).toContain("show=drafts");
    });
  });
});
