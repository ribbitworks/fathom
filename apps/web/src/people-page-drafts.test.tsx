// SPDX-License-Identifier: Apache-2.0

// Tests of drafts of people on the People page: making and publishing them, unpublished and held
// changes, and a person's draft from their details and their row.

import { screen, waitFor, within } from "@testing-library/react";
import { userEvent } from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  bodyOf,
  renderApp,
  rowActions,
  serverAnswers,
} from "./test-support.tsx";
import {
  s1,
  session,
  editor,
  listsAnswer,
  site,
  role,
  avery,
  blake,
  order,
  savedAs,
  openPeople,
  cell,
  focusCell,
  undone,
  openDraftMenu,
  chooseInDraftMenu,
  draftOf,
  header,
} from "./test-people-page.tsx";

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("drafts", () => {
  it("drafts removing a person from their menu, marking them, and undoes it", async () => {
    // Once removed, the server holds the draft.
    let removed = false;
    const fetch = await openPeople({
      "GET /api/people": () =>
        Response.json({
          people: [
            avery,
            removed
              ? { ...blake, draft: draftOf({ action: "deleted" }) }
              : blake,
          ],
          fields: [site, role],
          order,
        }),
      "DELETE /api/people/p2": () => {
        removed = true;
        return Response.json({ changeSetId: s1 });
      },
    });
    focusCell("p2", "employeeId");
    await userEvent.keyboard("{Shift>}{F10}{/Shift}");
    await userEvent.click(
      await screen.findByRole("menuitem", { name: "Remove person" }),
    );
    expect(await screen.findByText("Draft: removed")).toBeDefined();
    expect(
      fetch.mock.calls.map(([url, init]) => [url, init?.method]),
    ).toContainEqual(["/api/people/p2", "DELETE"]);
    await waitFor(() => {
      expect(
        fetch.mock.calls.filter(([url]) => url === "/api/people"),
      ).toHaveLength(2);
    });
    await userEvent.keyboard("{Control>}z{/Control}");
    await waitFor(() => {
      expect(undone(fetch)).toEqual([s1]);
    });
  });

  it("marks what drafts change, with live values, and rejected drafts with their reason", async () => {
    const fetch = await openPeople({
      "DELETE /api/people/p3/draft/rejection": savedAs(),
      "GET /api/people": () =>
        Response.json({
          people: [
            {
              ...avery,
              draft: draftOf({
                action: "changed",
                changed: ["positionId", "f1", "f2", "startDate"],
                live: {
                  positionId: "position-2",
                  startDate: null,
                  values: { f1: ["c2"] },
                },
              }),
            },
            {
              ...blake,
              draft: draftOf({
                action: "created",
                changed: ["preferredName"],
                state: "rejected",
                reason: "Fictional reason",
              }),
            },
            {
              ...blake,
              id: "p3",
              keyNumber: 1,
              preferredName: "Casey Fictional",
              employeeId: "E3",
              positionId: "position-1",
              draft: draftOf({ action: "deleted", state: "rejected" }),
            },
          ],
          fields: [site, role],
          order,
        }),
    });
    expect(cell("p1", "f1").textContent).toBe(
      "Harbour, Draft: changed from “Northmere”, draft, live Northmere",
    );
    expect(cell("p1", "positionId").textContent).toBe(
      "Engineer, Draft: changed from “Tester”, draft, live Tester",
    );
    expect(cell("p1", "startDate").textContent).toBe(
      "Mar 1, 2024, Draft: filled in, draft, live empty",
    );
    expect(cell("p1", "f2").textContent).toContain(
      ", Draft: filled in, draft, live empty",
    );
    expect(cell("p1", "employeeId").textContent).toBe("E1");
    // Under the draft row, the person as they are live, which only sighted users need.
    const liveRow = cell("p1", "f1").closest("tr")?.nextElementSibling;
    expect(liveRow?.getAttribute("aria-hidden")).toBe("true");
    expect(
      [...(liveRow?.querySelectorAll("td") ?? [])].map(
        ({ textContent }) => textContent,
      ),
    ).toEqual([
      "Avery Fictional",
      "E1",
      "Tester, live",
      "Northmere, live",
      ", live",
      ", live",
      "",
      "",
      "",
      "",
      "",
      "No",
      "",
      "",
    ]);
    // Moving down from the draft row skips the live row.
    focusCell("p1", "employeeId");
    await userEvent.keyboard("{ArrowDown}");
    expect(document.activeElement).toBe(cell("p2", "employeeId"));
    expect(cell("p1", "preferredName").textContent).toBe("Avery Fictional");
    expect(cell("p2", "f1").textContent).toBe("Old Mill, draft");
    expect(cell("p2", "preferredName").textContent).toContain(
      "Rejected, added: Fictional reason",
    );
    expect(cell("p3", "preferredName").textContent).toContain(
      "Rejected, removed",
    );
    // A rejected draft's changes are marked apart from those waiting, with its reason in the menu.
    expect(cell("p2", "f1").className).not.toBe(cell("p1", "f1").className);
    focusCell("p2", "employeeId");
    await userEvent.keyboard("{Shift>}{F10}{/Shift}");
    expect(await screen.findByText("Reason: Fictional reason")).toBeDefined();
    await userEvent.keyboard("{Escape}");
    await waitFor(() => {
      expect(screen.queryByRole("menu")).toBeNull();
    });
    // A person drafted to be removed cannot be edited.
    focusCell("p3", "employeeId");
    await userEvent.keyboard("{Enter}");
    expect(screen.queryByRole("textbox", { name: "ID" })).toBeNull();
    // Their menu sends the rejected draft for approval again, or discards it.
    await userEvent.keyboard("{Shift>}{F10}{/Shift}");
    expect(
      (await screen.findAllByRole("menuitem")).map(
        ({ textContent }) => textContent,
      ),
    ).toEqual(["Show details", "Copy link", "Resubmit", "Discard draft"]);
    await userEvent.click(screen.getByRole("menuitem", { name: "Resubmit" }));
    await waitFor(() => {
      expect(
        fetch.mock.calls.map(([url, init]) => [url, init?.method]),
      ).toContainEqual(["/api/people/p3/draft/rejection", "DELETE"]);
    });
  });

  it("lets Approvers approve or reject a draft from its person's menu, or all those shown at once", async () => {
    const fetch = await openPeople({
      "GET /api/session": session([
        "plan:approve",
        "features:approve",
        "people:approve",
        "hiring-plan:approve",
        "configuration:approve",
        "people:view",
        "personal:view",
      ]),
      "GET /api/people": () =>
        Response.json({
          people: [
            {
              ...avery,
              draft: draftOf({ action: "changed", changed: ["f1"] }),
            },
            { ...blake, draft: draftOf({ action: "created" }) },
            {
              ...blake,
              id: "p3",
              keyNumber: 1,
              preferredName: "Casey Fictional",
              employeeId: "E3",
              positionId: "position-1",
              draft: draftOf({
                action: "deleted",
                state: "rejected",
                reason: "Fictional reason",
              }),
            },
          ],
          fields: [site, role],
          order,
        }),
      "POST /api/drafts/approval": savedAs(),
      "POST /api/drafts/rejection": savedAs(),
    });
    expect(
      within(await openDraftMenu()).getByRole("menuitem", {
        name: "Approve 2 drafts…",
      }),
    ).toBeDefined();
    await userEvent.keyboard("{Escape}");
    // A rejected draft's menu gives its reason, and nothing to decide: it is back with its makers.
    await waitFor(() => {
      expect(screen.queryByRole("menu")).toBeNull();
    });
    await userEvent.click(rowActions("Casey Fictional"));
    expect(await screen.findByText("Reason: Fictional reason")).toBeDefined();
    expect(
      screen.queryAllByRole("menuitem").map(({ textContent }) => textContent),
    ).toEqual(["Show details", "Copy link"]);
    await userEvent.keyboard("{Escape}");
    await waitFor(() => {
      expect(screen.queryByRole("menu")).toBeNull();
    });
    await userEvent.click(rowActions("Avery Fictional"));
    expect(
      (await screen.findAllByRole("menuitem")).map(
        ({ textContent }) => textContent,
      ),
    ).toEqual(["Show details", "Copy link", "Approve draft…", "Reject draft…"]);
    await userEvent.click(
      screen.getByRole("menuitem", { name: "Approve draft…" }),
    );
    const one = await screen.findByRole("dialog", { name: "Approve 1 draft?" });
    await userEvent.click(within(one).getByRole("button", { name: "Approve" }));
    expect(await screen.findByText("Approved 1 draft.")).toBeDefined();
    // Rejecting one asks for a reason too, and can be cancelled.
    await userEvent.click(rowActions("Avery Fictional"));
    await userEvent.click(
      await screen.findByRole("menuitem", { name: "Reject draft…" }),
    );
    await userEvent.click(
      within(
        await screen.findByRole("dialog", { name: "Reject 1 draft?" }),
      ).getByRole("button", { name: "Cancel" }),
    );
    await waitFor(() => {
      expect(screen.queryByRole("dialog")).toBeNull();
    });
    await chooseInDraftMenu(/^Reject \d+ drafts?…$/);
    const all = await screen.findByRole("dialog", { name: "Reject 2 drafts?" });
    await userEvent.type(
      within(all).getByRole("textbox", { name: "Reason" }),
      "Fictional reason",
    );
    await userEvent.click(within(all).getByRole("button", { name: "Reject" }));
    expect(await screen.findByText("Rejected 2 drafts.")).toBeDefined();
    await chooseInDraftMenu(/^Approve \d+ drafts?…$/);
    await userEvent.click(
      within(
        await screen.findByRole("dialog", { name: "Approve 2 drafts?" }),
      ).getByRole("button", { name: "Cancel" }),
    );
    expect(bodyOf(fetch, "POST", "/api/drafts/approval")).toEqual([
      {
        people: ["p1"],
        plannedHires: [],
        featureTeams: [],
        lists: [],
        choices: [],
        orders: [],
        columns: [],
        records: [],
      },
    ]);
    expect(bodyOf(fetch, "POST", "/api/drafts/rejection")).toEqual([
      {
        people: ["p1", "p2"],
        plannedHires: [],
        featureTeams: [],
        lists: [],
        choices: [],
        orders: [],
        columns: [],
        records: [],
        reason: "Fictional reason",
      },
    ]);
  });

  it("waits for changes being saved before approving all shown", async () => {
    let finish: (response: Response) => void = () => undefined;
    await openPeople({
      "GET /api/session": session([
        "plan:approve",
        "features:approve",
        "people:approve",
        "hiring-plan:approve",
        "configuration:approve",
        "people:edit",
        "people:view",
        "personal:edit",
        "personal:view",
      ]),
      "GET /api/people": () =>
        Response.json({
          people: [avery, { ...blake, draft: draftOf({ action: "created" }) }],
          fields: [site, role],
          order,
        }),
      "PATCH /api/people/p1": () =>
        new Promise<Response>((resolve) => {
          finish = resolve;
        }),
    });
    const approveAll = () =>
      screen.getByRole("menuitem", { name: /^Approve \d+ drafts?…$/ });
    focusCell("p1", "employeeId");
    await userEvent.keyboard("E9{Enter}");
    await openDraftMenu();
    expect(approveAll().hasAttribute("data-disabled")).toBe(true);
    finish(Response.json({ changeSetId: s1 }));
    await waitFor(() => {
      expect(approveAll().hasAttribute("data-disabled")).toBe(false);
    });
  });

  it("keeps a person drafted to be removed from being cleared with Delete", async () => {
    const fetch = await openPeople({
      "GET /api/people": () =>
        Response.json({
          people: [avery, { ...blake, draft: draftOf({ action: "deleted" }) }],
          fields: [site, role],
          order,
        }),
    });
    expect(cell("p2", "employeeId").getAttribute("aria-readonly")).toBe("true");
    focusCell("p2", "employeeId");
    await userEvent.keyboard("{Delete}");
    expect(cell("p2", "employeeId").textContent).toBe("E2");
    expect(
      fetch.mock.calls.filter(([, init]) => init?.method === "PATCH"),
    ).toEqual([]);
  });

  it("discards a draft from the person's menu, showing them as they are, and undoes it", async () => {
    let discarded = false;
    const fetch = await openPeople({
      "GET /api/people": () =>
        Response.json({
          people: [
            discarded
              ? {
                  ...avery,
                  preferredName: "Avery Live",
                  values: { f1: ["c2"], f2: ["r1", "r2"] },
                }
              : {
                  ...avery,
                  draft: draftOf({
                    action: "changed",
                    changed: ["preferredName", "f1"],
                    live: {
                      preferredName: "Avery Live",
                      values: { f1: ["c2"] },
                    },
                  }),
                },
            blake,
          ],
          fields: [site, role],
          order,
        }),
      "DELETE /api/people/p1/draft": () => {
        discarded = true;
        return Response.json({ changeSetId: s1 });
      },
    });
    focusCell("p1", "employeeId");
    await userEvent.keyboard("{Shift>}{F10}{/Shift}");
    await userEvent.click(
      await screen.findByRole("menuitem", { name: "Discard draft" }),
    );
    expect(await screen.findByText("Avery Live")).toBeDefined();
    expect(cell("p1", "f1").textContent).toBe("Northmere");
    await waitFor(() => {
      expect(
        fetch.mock.calls.filter(([url]) => url === "/api/people"),
      ).toHaveLength(2);
    });
    await userEvent.keyboard("{Control>}z{/Control}");
    await waitFor(() => {
      expect(undone(fetch)).toEqual([s1]);
    });
  });

  it("discards the draft of someone only drafted to be added, offering Undo", async () => {
    const fetch = await openPeople({
      "GET /api/people": () =>
        Response.json({
          people: [avery, { ...blake, draft: draftOf({ action: "created" }) }],
          fields: [site, role],
          order,
        }),
      "DELETE /api/people/p2/draft": savedAs(),
    });
    focusCell("p2", "employeeId");
    await userEvent.keyboard("{Shift>}{F10}{/Shift}");
    expect(
      (await screen.findAllByRole("menuitem")).map(
        ({ textContent }) => textContent,
      ),
    ).toEqual(["Show details", "Copy link", "Discard draft"]);
    await userEvent.click(
      screen.getByRole("menuitem", { name: "Discard draft" }),
    );
    expect(
      await screen.findByText("Discarded the draft adding Blake Fictional."),
    ).toBeDefined();
    await userEvent.click(screen.getByRole("button", { name: "Undo" }));
    await waitFor(() => {
      expect(undone(fetch)).toEqual([s1]);
    });
  });

  it("opens a person's menu from its button and with the menu key", async () => {
    await openPeople();
    await userEvent.click(rowActions("Avery Fictional"));
    expect(await screen.findByRole("menu")).toBeDefined();
    await userEvent.keyboard("{Escape}");
    focusCell("p1", "f1");
    await userEvent.keyboard("{ContextMenu}");
    expect(await screen.findByRole("menu")).toBeDefined();
  });
});

describe("unpublished and held changes", () => {
  const approverEditor = session([
    "configuration:edit",
    "configuration:view",
    "plan:approve",
    "features:approve",
    "people:approve",
    "hiring-plan:approve",
    "configuration:approve",
    "people:edit",
    "people:view",
    "plan:view",
    "features:view",
    "personal:view",
  ]);
  const holder = "Second Fictional Editor";
  const held = `Being changed by ${holder}. It can be changed once they publish or discard their changes.`;
  const mine = "Nobody else sees these changes until they're published.";
  const columnDraft = (more: object = {}) => ({
    action: "changed",
    changed: ["required"],
    live: { required: false },
    state: "waiting",
    madeBy: "Fictional Editor",
    madeAt: "2026-10-30T15:00:00.000Z",
    ...more,
  });
  const menuOf = async (target: HTMLElement) => {
    await waitFor(() => {
      expect(screen.queryByRole("menu")).toBeNull();
    });
    await userEvent.click(target);
    return screen.findByRole("menu");
  };

  it("holds a person someone else is changing, and keeps one's own unpublished draft from Approvers", async () => {
    await openPeople({
      "GET /api/session": approverEditor,
      "GET /api/people": () =>
        Response.json({
          people: [
            {
              ...avery,
              heldBy: holder,
              draft: draftOf({
                action: "changed",
                changed: ["preferredName"],
                live: { preferredName: "Avery Before", values: {} },
              }),
            },
            {
              ...blake,
              draft: draftOf({
                action: "changed",
                changed: ["preferredName"],
                live: { preferredName: "Blake Before", values: {} },
                unpublished: true,
              }),
            },
          ],
          fields: [site, role],
          order,
        }),
    });
    expect(cell("p1", "preferredName").textContent).toContain(
      `, being changed by ${holder}`,
    );
    expect(cell("p1", "preferredName").getAttribute("aria-readonly")).toBe(
      "true",
    );
    expect(cell("p2", "preferredName").textContent).toContain(
      "“Blake Before”, unpublished",
    );
    expect(
      within(cell("p2", "preferredName")).queryByText("Unpublished"),
    ).toBeNull();
    let menu = await menuOf(rowActions("Avery Fictional"));
    expect(within(menu).getByText(held)).toBeDefined();
    for (const item of ["Approve draft…", "Discard draft", "Remove person"]) {
      expect(within(menu).queryByRole("menuitem", { name: item })).toBeNull();
    }
    // Nothing follows the draft's lines, so no divider ends the menu.
    expect(menu.lastElementChild?.className).not.toMatch(/divider/);
    await userEvent.keyboard("{Escape}");
    menu = await menuOf(rowActions("Blake Fictional"));
    expect(within(menu).getByText(mine)).toBeDefined();
    expect(
      within(menu).queryByRole("menuitem", { name: "Approve draft…" }),
    ).toBeNull();
    expect(
      within(menu).getByRole("menuitem", { name: "Discard draft" }),
    ).toBeDefined();
    await userEvent.keyboard("{Escape}");
    // Neither is among the drafts to decide all at once.
    expect(within(await openDraftMenu()).queryByText(/drafts/)).toBeNull();
  });

  it("holds columns someone else is changing, and keeps one's own from Approvers", async () => {
    await openPeople({
      "GET /api/session": approverEditor,
      "GET /api/people": () =>
        Response.json({
          people: [avery, blake],
          fields: [
            { ...site, heldBy: holder, draft: columnDraft() },
            { ...role, draft: columnDraft({ unpublished: true }) },
          ],
          order: [
            "preferredName",
            "employeeId",
            "f2",
            "f1",
            "startDate",
            "endDate",
          ],
        }),
    });
    expect(
      within(header("Site")).getByText(`, Draft, being changed by ${holder}`),
    ).toBeDefined();
    expect(
      within(header("Role on team")).getByText(
        ", Personal, Draft, unpublished",
      ),
    ).toBeDefined();
    let menu = await menuOf(header("Site"));
    expect(within(menu).getAllByText(held)).toHaveLength(1);
    for (const item of ["Approve…", "Edit column…", "Discard draft"]) {
      expect(within(menu).queryByRole("menuitem", { name: item })).toBeNull();
    }
    await userEvent.keyboard("{Escape}");
    menu = await menuOf(header("Role on team"));
    expect(within(menu).getByText(mine)).toBeDefined();
    expect(
      within(menu).queryByRole("menuitem", { name: "Approve…" }),
    ).toBeNull();
    expect(
      within(menu).getByRole("menuitem", { name: "Edit column…" }),
    ).toBeDefined();
  });
});

describe("a person's draft from their details and their row", () => {
  const changedName = draftOf({
    action: "changed",
    changed: ["preferredName"],
    live: { preferredName: "Avery Before", values: {} },
  });
  const itemsIn = (menu: HTMLElement) =>
    within(menu)
      .getAllByRole("menuitem")
      .map(({ textContent }) => textContent);

  it("discards a person's draft from the ⋯ in their details, offering what their row does", async () => {
    // Given a person with a draft, their details open beside People
    const fetch = serverAnswers({
      "GET /api/session": editor,
      "GET /api/people": () =>
        Response.json({
          people: [{ ...avery, draft: changedName }, blake],
          fields: [site, role],
          order,
        }),
      "GET /api/lists": listsAnswer,
      "DELETE /api/people/p1/draft": savedAs(),
    });
    renderApp("/people?open=E1");
    const details = await screen.findByRole("region", {
      name: "Avery Fictional",
    });

    // When the ⋯ in their details is opened
    await userEvent.click(
      within(details).getByRole("button", {
        name: "Actions for Avery Fictional",
      }),
    );

    // Then it offers what their row's menu does, but Show details, and discards the draft
    expect(itemsIn(await screen.findByRole("menu"))).toEqual([
      "Copy link",
      "Discard draft",
      "Remove person",
    ]);
    await userEvent.click(
      screen.getByRole("menuitem", { name: "Discard draft" }),
    );
    await waitFor(() => {
      expect(
        fetch.mock.calls
          .filter(([, init]) => init?.method === "DELETE")
          .map(([url]) => url),
      ).toEqual(["/api/people/p1/draft"]);
    });
  });

  it("publishes a person's unpublished draft from their row", async () => {
    // Given the user's own unpublished change to a person, which goes with no other
    const fetch = await openPeople({
      "GET /api/people": () =>
        Response.json({
          people: [
            { ...avery, draft: { ...changedName, unpublished: true } },
            blake,
          ],
          fields: [site, role],
          order,
        }),
      "GET /api/unpublished": () =>
        Response.json({
          changes: [
            {
              subject: "the person Avery Fictional",
              action: "changed",
              key: "person p1",
              linked: [],
            },
          ],
        }),
      "POST /api/unpublished/publish": () =>
        Response.json({ total: 1, left: 0 }),
    });

    // When Publish draft… is chosen in their row's menu
    await userEvent.click(rowActions("Avery Fictional"));
    expect(itemsIn(await screen.findByRole("menu"))).toEqual([
      "Show details",
      "Copy link",
      "Publish draft…",
      "Discard draft",
      "Remove person",
    ]);
    await userEvent.click(
      screen.getByRole("menuitem", { name: "Publish draft…" }),
    );

    // Then the person's draft alone is published, and the notification says so
    expect(await screen.findByText("Published 1 change.")).toBeDefined();
    expect(
      (
        bodyOf(fetch, "POST", "/api/unpublished/publish") as {
          drafts: { people: string[] };
        }[]
      ).map(({ drafts }) => drafts.people),
    ).toEqual([["p1"]]);
  });
});
