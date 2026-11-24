// SPDX-License-Identifier: Apache-2.0

// Tests for drafts on the Lists page: their marks, menus and live rows, discarding and
// resubmitting them, and unpublished changes and those someone else holds.

import {
  act,
  fireEvent,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import { userEvent } from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  bodyOf,
  fictionalUser,
  renderApp,
  serverAnswers,
} from "./test-support.tsx";
import {
  viewer,
  editor,
  choice,
  locations,
  skills,
  empty,
  regions,
  removal,
  savedAs,
  panel,
  row,
  focusRow,
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
  listsGrid,
  cellText,
} from "./test-lists-page.tsx";

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("drafts on the Lists page", () => {
  it("marks a list one's own unpublished draft adds with one mark in the table", async () => {
    serverAnswers({
      "GET /api/session": viewer,
      "GET /api/lists": () =>
        Response.json({
          lists: [{ ...added, draft: { ...added.draft, unpublished: true } }],
        }),
    });
    renderApp("/lists");
    const table = await listsGrid();
    expect(within(table).getByText(/Draft: added, unpublished/)).toBeDefined();
    expect(within(table).queryByText("Unpublished")).toBeNull();
  });

  it("marks lists and choices with drafts in the table and the panel", async () => {
    serverAnswers({
      "GET /api/session": viewer,
      "GET /api/lists": draftedAnswer,
    });
    renderApp("/lists/l5");
    const table = await listsGrid();
    expect(within(table).getByText(/Draft: added/)).toBeDefined();
    const opened = await screen.findByRole("heading", {
      name: "Teams",
      level: 2,
    });
    expect(opened).toBeDefined();
    expect(within(row("c8")).getByText(/Draft: added/)).toBeDefined();
    // Viewers see the drafts, but nothing to do with them.
    expect(screen.queryByRole("button", { name: "Discard draft" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Approve" })).toBeNull();
  });

  it("approves a choice with the list it was added to, naming the list first", async () => {
    const fetch = serverAnswers({
      "GET /api/session": approver,
      "GET /api/people": noPeople,
      "GET /api/lists": draftedAnswer,
      "POST /api/drafts/approval": savedAs(),
    });
    renderApp("/lists/l5");
    await screen.findByRole("heading", { name: "Teams", level: 2 });
    await waitFor(() => {
      expect(panel().contains(document.activeElement)).toBe(true);
    });
    await userEvent.click(
      within(row("c8")).getByRole("button", {
        name: "Actions for Platform",
      }),
    );
    await userEvent.click(
      await screen.findByRole("menuitem", { name: "Approve…" }),
    );
    const dialog = await screen.findByRole("dialog", {
      name: "Approve 2 drafts?",
    });
    expect(
      within(dialog).getByText("Also approves the drafts these depend on:"),
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

  it("discards a draft of the order from the list's menu", async () => {
    const fetch = serverAnswers({
      "GET /api/session": editor,
      "GET /api/lists": draftedAnswer,
      "DELETE /api/lists/l1/order/draft": savedAs(),
    });
    renderApp("/lists/l1");
    await screen.findByRole("heading", { name: "Locations", level: 2 });
    expect(within(row("c1")).getByText(/Draft: moved/)).toBeDefined();
    // A click on a draft's details closes the menu.
    await userEvent.click(
      within(await listMenu("Locations")).getByText(
        "Reordered by Fictional Editor",
      ),
    );
    const menu = await listMenu("Locations");
    await userEvent.click(
      within(menu).getByRole("menuitem", { name: "Discard new order" }),
    );
    expect(
      await screen.findByText("Discarded the draft of the order of Locations."),
    ).toBeDefined();
    expect(
      fetch.mock.calls.some(([url]) =>
        url.endsWith("/api/lists/l1/order/draft"),
      ),
    ).toBe(true);
  });

  // A request sent, by method and the end of its address.
  // A live list renamed in a rejected draft, and a live list whose rejected order moves a choice
  // with no draft of its own, with a choice drafted to be removed.
  const renamed = {
    ...skills,
    name: "Talents",
    draft: {
      ...waiting,
      state: "rejected",
      reason: "Keep Skills",
      action: "changed",
      changed: ["name"],
      live: { name: "Skills" },
    },
  };
  const reordered = {
    ...locations,
    choices: [
      locations.choices[0],
      locations.choices[2],
      locations.choices[1],
      {
        ...locations.choices[3],
        draft: { ...waiting, action: "deleted", changed: [], live: {} },
      },
    ],
    orderDraft: {
      ...waiting,
      state: "rejected",
      reason: "Keep the old order",
      live: ["c1", "c2", "c3", "c4"],
    },
  };
  const otherAnswer = () =>
    Response.json({ lists: [reordered, renamed, empty, regions, added] });

  it("holds a list's own draft and its new order of choices in its menu, and asks before rejecting the order", async () => {
    serverAnswers({
      "GET /api/session": approverOnly,
      "GET /api/people": noPeople,
      "GET /api/lists": () =>
        Response.json({
          lists: [
            {
              ...reordered,
              draft: renamed.draft,
              orderDraft: { ...reordered.orderDraft, state: "waiting" },
            },
          ],
        }),
    });
    renderApp("/lists/l1");
    await screen.findByRole("heading", { name: "Locations", level: 2 });
    const menu = await listMenu("Locations");
    expect(within(menu).getByText("Reason: Keep Skills")).toBeDefined();
    expect(within(menu).getByText("Changed by Fictional Editor")).toBeDefined();
    expect(
      within(menu).getByText("Reordered by Fictional Editor"),
    ).toBeDefined();
    // The list's own draft was rejected, so it is back with its makers, with nothing to decide:
    // only the new order offers Reject.
    const rejects = within(menu).getAllByRole("menuitem", { name: "Reject…" });
    expect(rejects).toHaveLength(1);
    await userEvent.click(rejects[0] as HTMLElement);
    expect(
      await screen.findByRole("dialog", { name: "Reject 1 draft?" }),
    ).toBeDefined();
  });

  it("takes back rejected drafts when showing the drafts applied", async () => {
    serverAnswers({
      "GET /api/session": editor,
      "GET /api/lists": otherAnswer,
    });
    renderApp("/lists/l1?show=drafts");
    await screen.findByRole("heading", { name: "Locations", level: 2 });
    const table = await listsGrid();
    expect(within(table).getByText("Skills")).toBeDefined();
    expect(within(table).queryByText("Talents")).toBeNull();
    expect(within(panel()).queryByText(/moved/)).toBeNull();
    expect(
      screen.queryByRole("button", { name: "Drafts of Locations" }),
    ).toBeNull();
  });

  it("marks a moved choice in a rejected order, and leaves a choice drafted to be removed alone", async () => {
    const fetch = serverAnswers({
      "GET /api/session": editor,
      "GET /api/lists": otherAnswer,
      "DELETE /api/lists/l1/order/draft/rejection": savedAs(),
    });
    renderApp("/lists/l1");
    await screen.findByRole("heading", { name: "Locations", level: 2 });
    await userEvent.click(
      within(panel()).getByRole("button", { name: "Show retired (1)" }),
    );
    expect(within(row("c2")).getByText(/Rejected, moved/)).toBeDefined();
    focusRow("c4");
    await userEvent.keyboard("{Enter}r{Delete}{Alt>}{ArrowUp}{/Alt}");
    expect(screen.queryByLabelText("name")).toBeNull();
    const menu = await listMenu("Locations");
    expect(within(menu).getByText("Reason: Keep the old order")).toBeDefined();
    await userEvent.click(
      within(menu).getByRole("menuitem", { name: "Resubmit" }),
    );
    await waitFor(() => {
      expect(sent(fetch, "DELETE", "/api/lists/l1/order/draft/rejection")).toBe(
        true,
      );
    });
    expect(sent(fetch, "DELETE", "/api/lists/l1/choices/c4")).toBe(false);
    expect(sent(fetch, "PUT", "/api/lists/l1/choices/c4/retired")).toBe(false);
  });

  it("shows a renamed list's live name in its row, resubmits its rejected draft, and discards it", async () => {
    const fetch = serverAnswers({
      "GET /api/session": editor,
      "GET /api/lists": otherAnswer,
      "DELETE /api/lists/l2/draft/rejection": savedAs(),
      "DELETE /api/lists/l2/draft": savedAs(),
    });
    renderApp("/lists/l2");
    const table = await listsGrid();
    expect(cellText("l2", "name")).toMatch(/^Talents.*, draft, live Skills$/);
    // Live rows only under the renamed list and the list whose choices have drafts: a list with no
    // draft has none, not even an empty one.
    expect(
      within(table).getAllByRole("row", { hidden: true }).length -
        within(table).getAllByRole("row").length,
    ).toBe(2);
    const menu = await listMenu("Talents");
    expect(within(menu).getByText("Reason: Keep Skills")).toBeDefined();
    await userEvent.click(
      within(menu).getByRole("menuitem", { name: "Resubmit" }),
    );
    await waitFor(() => {
      expect(sent(fetch, "DELETE", "/api/lists/l2/draft/rejection")).toBe(true);
    });
    await chooseInListMenu("Talents", "Discard draft");
    expect(
      await screen.findByText("Discarded the draft of Talents."),
    ).toBeDefined();
  });

  it("names the drafts a rejection or approval includes, from the list's and a choice's menu", async () => {
    serverAnswers({
      "GET /api/session": approver,
      "GET /api/people": noPeople,
      "GET /api/lists": draftedAnswer,
    });
    const history = renderApp("/lists/l5");
    await chooseInListMenu("Teams", "Reject…");
    const rejecting = await screen.findByRole("dialog", {
      name: "Reject 2 drafts?",
    });
    expect(
      within(rejecting).getByText("Also rejects the drafts that use these:"),
    ).toBeDefined();
    await userEvent.click(
      within(rejecting).getByRole("button", { name: "Cancel" }),
    );
    await chooseInListMenu("Teams", "Approve…");
    await userEvent.click(
      within(
        await screen.findByRole("dialog", { name: "Approve 1 draft?" }),
      ).getByRole("button", { name: "Cancel" }),
    );
    await waitFor(() => {
      expect(screen.queryByRole("dialog")).toBeNull();
    });
    focusRow("c8");
    await userEvent.keyboard("{ContextMenu}");
    await userEvent.click(
      await screen.findByRole("menuitem", { name: "Reject…" }),
    );
    expect(
      await screen.findByRole("dialog", { name: "Reject 1 draft?" }),
    ).toBeDefined();
    await userEvent.click(
      within(
        await screen.findByRole("dialog", { name: "Reject 1 draft?" }),
      ).getByRole("button", { name: "Cancel" }),
    );
    history.push("/lists/l1");
    await screen.findByRole("heading", { name: "Locations", level: 2 });
    await chooseInListMenu("Locations", "Approve…");
    expect(
      await screen.findByRole("dialog", { name: "Approve 1 draft?" }),
    ).toBeDefined();
  });

  // The Draft menu above the lists, opened.

  it("approves or rejects every draft waiting among the lists from the Draft menu", async () => {
    serverAnswers({
      "GET /api/session": approver,
      "GET /api/people": noPeople,
      "GET /api/lists": draftedAnswer,
    });
    renderApp("/lists");
    const menu = await openDraftMenu();
    expect(within(menu).getByText("Waiting drafts")).toBeDefined();
    await userEvent.click(
      within(menu).getByRole("menuitem", { name: "Reject 3 drafts…" }),
    );
    await userEvent.click(
      within(await screen.findByRole("dialog")).getByRole("button", {
        name: "Cancel",
      }),
    );
    await waitFor(() => {
      expect(screen.queryByRole("dialog")).toBeNull();
    });
    await userEvent.click(
      within(await openDraftMenu()).getByRole("menuitem", {
        name: /^Approve \d+ drafts?…$/,
      }),
    );
    expect(
      await screen.findByRole("dialog", { name: "Approve 3 drafts?" }),
    ).toBeDefined();
  });

  it("names the related drafts a rejection includes, and counts the drafts approving all skips", async () => {
    const [platform] = added.choices;
    const twoChoices = {
      ...added,
      choices: [
        ...added.choices,
        { ...platform, ...choice("c9", "Payments"), draft: platform?.draft },
      ],
    };
    serverAnswers({
      "GET /api/session": approverOnly,
      "GET /api/people": noPeople,
      "GET /api/lists": () =>
        Response.json({
          lists: [
            { ...skills, draft: { ...removal } },
            {
              ...twoChoices,
              draft: { ...added.draft, state: "rejected", reason: "Not yet" },
            },
          ],
        }),
    });
    renderApp("/lists");
    await userEvent.click(
      within(await openDraftMenu()).getByRole("menuitem", {
        name: "Approve 3 drafts…",
      }),
    );
    const approving = await screen.findByRole("dialog", {
      name: "Approve 1 draft?",
    });
    expect(
      within(approving).getByText(
        "2 drafts are skipped because they depend on rejected drafts.",
      ),
    ).toBeDefined();
    await userEvent.click(
      within(approving).getByRole("button", { name: "Cancel" }),
    );
    await waitFor(() => {
      expect(screen.queryByRole("dialog")).toBeNull();
    });
  });

  it("names the related drafts rejecting a list includes", async () => {
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
                ...added.choices,
                {
                  ...platform,
                  ...choice("c9", "Payments"),
                  draft: platform?.draft,
                },
              ],
            },
          ],
        }),
    });
    renderApp("/lists/l5");
    await screen.findByRole("heading", { name: "Teams", level: 2 });
    await chooseInListMenu("Teams", "Reject…");
    const rejecting = await screen.findByRole("dialog", {
      name: "Reject 3 drafts?",
    });
    expect(
      within(rejecting).getByText("Also rejects the drafts that use these:"),
    ).toBeDefined();
  });

  it("decides a list only once the people are read, naming those whose drafts use it", async () => {
    let answerPeople: (people: Response) => void = () => undefined;
    const draft = {
      ...waiting,
      action: "created",
      changed: [],
      live: {},
    };
    serverAnswers({
      "GET /api/session": () =>
        Response.json({
          ...fictionalUser,
          permissions: [
            "configuration:view",
            "plan:approve",
            "features:approve",
            "people:approve",
            "hiring-plan:approve",
            "configuration:approve",
            "people:view",
            "plan:view",
            "features:view",
          ],
        }),
      "GET /api/lists": () => Response.json({ lists: [added] }),
      "GET /api/people": () =>
        new Promise<Response>((resolve) => {
          answerPeople = resolve;
        }),
    });
    renderApp("/lists/l5");
    await screen.findByRole("heading", { name: "Teams", level: 2 });
    expect(
      within(await listMenu("Teams")).queryByRole("menuitem", {
        name: "Reject…",
      }),
    ).toBeNull();
    await userEvent.keyboard("{Escape}");
    answerPeople(
      Response.json({
        people: [
          {
            id: "p9",
            keyNumber: 1,
            preferredName: "Casey Fictional",
            employeeId: "E9",
            positionId: "position-1",
            startDate: null,
            endDate: null,
            values: { f9: ["c8"] },
            draft: {
              ...draft,
              action: "changed",
              changed: ["f9"],
              live: { values: {} },
            },
          },
        ],
        fields: [
          {
            id: "f9",
            keyNumber: 1,
            name: "Team",
            listId: "l5",
            multiple: false,
            required: false,
            draft,
          },
        ],
        order: ["preferredName", "employeeId", "f9"],
      }),
    );
    await waitFor(async () => {
      await chooseInListMenu("Teams", "Reject…");
    });
    const rejecting = await screen.findByRole("dialog", {
      name: "Reject 4 drafts?",
    });
    for (const name of [
      "Casey Fictional",
      "the column Team",
      "the choice Platform in Teams",
    ]) {
      expect(within(rejecting).getByText(name)).toBeDefined();
    }
  });

  it("names everyone who changed a list's draft, or Fathom when no one is recorded", async () => {
    serverAnswers({
      "GET /api/session": viewer,
      "GET /api/lists": () =>
        Response.json({
          lists: [
            {
              ...locations,
              draft: {
                ...waiting,
                action: "changed",
                changed: ["description"],
                live: { description: "" },
                editors: ["Fictional Editor", "Second Fictional Editor"],
              },
              orderDraft: {
                ...waiting,
                madeBy: null,
                live: locations.choices.map(({ id }) => id),
              },
            },
          ],
        }),
    });
    renderApp("/lists/l1");
    await screen.findByRole("heading", { name: "Locations", level: 2 });
    const menu = await listMenu("Locations");
    expect(
      within(menu).getByText(
        "Changed by Fictional Editor and Second Fictional Editor",
      ),
    ).toBeDefined();
    expect(within(menu).getByText("Reordered by Fathom")).toBeDefined();
  });

  it("shows those who may only view a list's drafts, with nothing to do with them", async () => {
    serverAnswers({
      "GET /api/session": viewer,
      "GET /api/lists": draftedAnswer,
    });
    renderApp("/lists/l5");
    await screen.findByRole("heading", { name: "Teams", level: 2 });
    const menu = await listMenu("Teams");
    expect(within(menu).getByText("Draft: added")).toBeDefined();
    expect(within(menu).getByText("Added by Fictional Editor")).toBeDefined();
    expect(within(menu).queryAllByRole("menuitem")).toEqual([]);
    // Only the divider under the list's name: no actions follow the draft's section.
    expect(menu.querySelectorAll(".mantine-Menu-divider")).toHaveLength(1);
    expect(
      screen.queryByRole("button", { name: "Actions for Platform" }),
    ).toBeNull();
  });
});

describe("unpublished and held changes on the Lists page", () => {
  const holder = "Second Fictional Editor";
  const held = `Being changed by ${holder}. It can be changed once they publish or discard their changes.`;
  const mine = "Nobody else sees these changes until they're published.";
  const draftOf = (more: object = {}) => ({
    action: "changed",
    changed: ["description"],
    live: { description: "" },
    state: "waiting",
    madeBy: "Fictional Editor",
    madeAt: "2026-11-01T10:00:00.000Z",
    ...more,
  });
  const orderOf = (more: object = {}) => ({
    live: ["c2", "c1", "c3", "c4"],
    state: "waiting",
    madeBy: "Fictional Editor",
    madeAt: "2026-11-01T10:00:00.000Z",
    ...more,
  });
  const menuOf = async (name: string) => {
    await waitFor(() => {
      expect(screen.queryByRole("menu")).toBeNull();
    });
    await userEvent.click(await screen.findByRole("button", { name }));
    return screen.findByRole("menu");
  };
  const open = async (lists: object[]) => {
    serverAnswers({
      "GET /api/session": approver,
      "GET /api/people": noPeople,
      "GET /api/lists": () => Response.json({ lists }),
    });
    renderApp("/lists/l1");
    await screen.findByRole("heading", { name: "Locations", level: 2 });
  };

  it("holds a list someone else is changing, with its choices and order", async () => {
    await open([
      {
        ...locations,
        heldBy: holder,
        draft: draftOf(),
        orderDraft: orderOf(),
        orderHeldBy: holder,
        choices: locations.choices.map((one) =>
          one.id === "c2" ? { ...one, heldBy: holder, draft: draftOf() } : one,
        ),
      },
    ]);
    const table = await listsGrid();
    expect(within(table).getByText(/being changed by/)).toBeDefined();
    expect(
      within(panel()).getAllByText(/being changed by/).length,
    ).toBeGreaterThan(1);
    expect(screen.queryByRole("button", { name: "Edit list…" })).toBeNull();
    let menu = await menuOf("Drafts of Locations");
    expect(within(menu).getAllByText(held)).toHaveLength(2);
    for (const item of [
      "Approve…",
      "Reject…",
      "Discard draft",
      "Discard new order",
    ]) {
      expect(within(menu).queryByRole("menuitem", { name: item })).toBeNull();
    }
    await userEvent.keyboard("{Escape}");
    menu = await menuOf("Actions for Northmere");
    expect(within(menu).getByText(held)).toBeDefined();
    for (const item of [/^Edit/, /^Move up/, /^Discard draft/, /^Approve…/]) {
      expect(within(menu).queryByRole("menuitem", { name: item })).toBeNull();
    }
  });

  it("stops choices moving while someone else is changing the order", async () => {
    await open([{ ...locations, orderDraft: orderOf(), orderHeldBy: holder }]);
    const menu = await menuOf("Actions for Northmere");
    expect(within(menu).getByRole("menuitem", { name: /^Edit/ })).toBeDefined();
    expect(
      within(menu).queryByRole("menuitem", { name: /^Move up/ }),
    ).toBeNull();
    await userEvent.keyboard("{Escape}");
    act(() => {
      row("c2").focus();
    });
    fireEvent.keyDown(row("c2"), { key: "ArrowUp", altKey: true });
    expect(
      within(await menuOf("Drafts of Locations")).getByText(held),
    ).toBeDefined();
  });

  it("keeps one's own unpublished drafts of a list, a choice, and an order from Approvers", async () => {
    await open([
      {
        ...locations,
        draft: draftOf({ unpublished: true }),
        orderDraft: orderOf({ unpublished: true }),
        choices: locations.choices.map((one) =>
          one.id === "c2"
            ? { ...one, draft: draftOf({ unpublished: true }) }
            : one,
        ),
      },
    ]);
    // Each draft's own mark says it is unpublished, with no second mark beside it.
    expect(
      within(panel()).getAllByText(/, unpublished/).length,
    ).toBeGreaterThan(1);
    expect(within(panel()).queryByText("Unpublished")).toBeNull();
    let menu = await menuOf("Drafts of Locations");
    expect(within(menu).getAllByText(mine)).toHaveLength(2);
    // The menu's headings mark the drafts as the table does.
    expect(menu.querySelectorAll('[class*="unpublishedMark"]')).toHaveLength(2);
    expect(
      within(menu).queryByRole("menuitem", { name: "Approve…" }),
    ).toBeNull();
    expect(
      within(menu).getByRole("menuitem", { name: "Discard new order" }),
    ).toBeDefined();
    await userEvent.keyboard("{Escape}");
    menu = await menuOf("Actions for Northmere");
    expect(within(menu).getByText(mine)).toBeDefined();
    expect(
      within(menu).queryByRole("menuitem", { name: "Approve…" }),
    ).toBeNull();
    await userEvent.keyboard("{Escape}");
    await waitFor(() => {
      expect(screen.queryByRole("menu")).toBeNull();
    });
    await userEvent.click(
      screen.getByRole("button", { name: /^Draft(?!s of)/ }),
    );
    expect(
      within(await screen.findByRole("menu")).queryByText("Waiting drafts"),
    ).toBeNull();
  });

  it("marks a rejected draft holding one's own unpublished changes with a red dot and a hollow one in its menu", async () => {
    await open([
      {
        ...locations,
        draft: draftOf({
          state: "rejected",
          reason: "Not yet",
          unpublished: true,
        }),
      },
    ]);
    const menu = await menuOf("Drafts of Locations");
    const heading = within(menu).getByText("Rejected").closest("div");
    expect(heading?.querySelectorAll('[class*="draftRejected"]')).toHaveLength(
      1,
    );
    expect(
      heading?.querySelectorAll('[class*="unpublishedMark"]'),
    ).toHaveLength(1);
  });
});
