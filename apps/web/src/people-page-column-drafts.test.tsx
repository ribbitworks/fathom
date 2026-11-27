// SPDX-License-Identifier: Apache-2.0

// Tests of drafts of the People table's columns.

import { screen, waitFor, within } from "@testing-library/react";
import { userEvent } from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  findRowActions,
  renderApp,
  serverAnswers,
  wholeText,
} from "./test-support.tsx";
import { turnedOffItem } from "./test-menus.tsx";
import {
  session,
  sites,
  roles,
  old,
  listsAnswer,
  site,
  role,
  avery,
  blake,
  order,
  peopleAnswer,
  savedAs,
  openPeople,
  draftOf,
  header,
} from "./test-people-page.tsx";

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("drafts of columns", () => {
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
  const waiting = {
    state: "waiting",
    madeBy: "Fictional Editor",
    madeAt: "2026-10-30T15:00:00.000Z",
    editors: ["Fictional Editor", "Second Fictional Editor"],
  };
  const added = {
    id: "f3",
    keyNumber: 1,
    name: "Previous site",
    listId: "l1",
    multiple: false,
    required: false,
    draft: {
      ...waiting,
      changedByUser: true,
      action: "created",
      changed: ["name", "listId", "multiple", "required"],
      live: {},
    },
  };
  const renamed = {
    ...role,
    name: "Team roles",
    draft: {
      ...waiting,
      state: "rejected",
      reason: "Keep the name",
      action: "changed",
      changed: ["name"],
      live: { name: "Role on team" },
      changedBy: { name: "Second Fictional Editor" },
    },
  };
  // A draft that changes what the column's cells hold, as well as its name, so the column as it is
  // live is shown beside it.
  const remade = {
    ...renamed,
    multiple: false,
    draft: {
      ...renamed.draft,
      changed: ["name", "multiple"],
      live: { name: "Role on team", multiple: true },
    },
  };
  const draftedOrder = [
    "preferredName",
    "f2",
    "employeeId",
    "f1",
    "f3",
    "startDate",
    "endDate",
  ];
  const peopleWithDrafts = () =>
    Response.json({
      people: [avery, blake],
      fields: [site, renamed, added],
      order: draftedOrder,
    });

  // The Draft menu above the table, opened.
  const draftMenu = async () => {
    await waitFor(() => {
      expect(screen.queryByRole("menu")).toBeNull();
    });
    await userEvent.click(screen.getByRole("button", { name: /^Draft/ }));
    return screen.findByRole("menu");
  };

  it("marks drafted columns in their headers, and says in each menu what the draft changes and who changed it", async () => {
    const fetch = await openPeople({
      "GET /api/session": approverEditor,
      "GET /api/people": peopleWithDrafts,
      "DELETE /api/people/columns/f2/draft/rejection": savedAs(),
      "DELETE /api/people/columns/f3/draft": savedAs(),
    });
    expect(
      within(header("Previous site")).getByText(", Draft: added"),
    ).toBeDefined();
    expect(
      within(header("Team roles")).getByText(
        ", Personal, Rejected: Keep the name",
      ),
    ).toBeDefined();
    // The renamed column is tinted, and stays one column, with its live name on a Live line under
    // its name.
    expect(header("Team roles").closest("th")?.className).toMatch(
      /draftColumn/,
    );
    expect(
      screen.getAllByText("Role on team").map((name) => name.closest("th")),
    ).toEqual([header("Team roles").closest("th")]);
    expect(within(header("Team roles")).getByText(", live")).toBeDefined();
    await userEvent.click(header("Team roles"));
    const menu = await screen.findByRole("menu");
    expect(within(menu).getByText("Reason: Keep the name")).toBeDefined();
    // The draft's section is headed by its own mark, red once rejected.
    expect(
      within(menu)
        .getByText("Rejected")
        .querySelector("[class*=draftRejected]"),
    ).not.toBeNull();
    expect(
      within(menu).getByText(
        wholeText(
          "Name from Role on team to Team roles, by Second Fictional Editor",
        ),
      ),
    ).toBeDefined();
    await userEvent.click(
      within(menu).getByRole("menuitem", { name: "Resubmit" }),
    );
    await waitFor(() => {
      expect(
        fetch.mock.calls.some(([url]) =>
          url.endsWith("/api/people/columns/f2/draft/rejection"),
        ),
      ).toBe(true);
    });
    await waitFor(() => {
      expect(screen.queryByRole("menu")).toBeNull();
    });
    await userEvent.click(header("Previous site"));
    await userEvent.click(
      within(await screen.findByRole("menu")).getByRole("menuitem", {
        name: "Discard draft",
      }),
    );
    expect(
      await screen.findByText("Discarded the draft of Previous site."),
    ).toBeDefined();
  });

  it.each([
    ["Approve People", ["people:approve", "people:view"], true],
    [
      "Approve Configuration alone",
      ["configuration:approve", "configuration:view", "people:view"],
      false,
    ],
  ])(
    "offers deciding a column's draft to a role with %s: %s",
    async (_case, permissions, offered) => {
      await openPeople({
        "GET /api/session": session(permissions),
        "GET /api/people": () =>
          Response.json({
            people: [avery, blake],
            fields: [
              site,
              {
                ...role,
                draft: { ...waiting, action: "created", changed: [], live: {} },
              },
            ],
            order,
          }),
      });
      await userEvent.click(header("Role on team"));
      const menu = await screen.findByRole("menu");
      expect(
        within(menu).queryByRole("menuitem", { name: "Approve…" }) !== null,
      ).toBe(offered);
    },
  );

  it("decides a column's draft from its menu", async () => {
    await openPeople({
      "GET /api/session": approverEditor,
      "GET /api/people": () =>
        Response.json({
          people: [avery, blake],
          fields: [
            {
              ...site,
              draft: { ...waiting, action: "deleted", changed: [], live: {} },
            },
            {
              ...role,
              listId: "l1",
              draft: {
                ...waiting,
                action: "changed",
                changed: ["listId"],
                live: { listId: "l2" },
              },
            },
          ],
          order: [
            "f2",
            "f1",
            "preferredName",
            "employeeId",
            "startDate",
            "endDate",
          ],
        }),
    });
    expect(within(header("Site")).getByText(", Draft: removed")).toBeDefined();
    expect(header("Site").closest("th")?.className).toMatch(/removedColumn/);
    await userEvent.click(header("Role on team"));
    const menu = await screen.findByRole("menu");
    expect(
      within(menu).getByText(
        wholeText(
          /^List from Roles on the team to Sites, by Fictional Editor$/,
        ),
      ),
    ).toBeDefined();
    for (const asking of ["Approve…", "Reject…"]) {
      await userEvent.click(header("Role on team"));
      await userEvent.click(
        within(await screen.findByRole("menu")).getByRole("menuitem", {
          name: asking,
        }),
      );
      await userEvent.click(
        within(await screen.findByRole("dialog")).getByRole("button", {
          name: "Cancel",
        }),
      );
    }
  });

  it("shows each person's live value in a changed column's live copy", async () => {
    await openPeople({
      "GET /api/session": approverEditor,
      "GET /api/people": () =>
        Response.json({
          people: [
            {
              ...avery,
              values: { ...avery.values, f2: ["r2"] },
              draft: draftOf({
                action: "changed",
                changed: ["f2"],
                live: { values: { f2: ["r1"] } },
              }),
            },
            { ...blake, id: "p3", draft: draftOf({ action: "created" }) },
            blake,
          ],
          fields: [site, remade],
          order,
        }),
    });
    const liveCells = [
      ...document.querySelectorAll<HTMLElement>("td[aria-hidden='true']"),
    ].filter((cell) => /liveColumn/.test(cell.className));
    // Avery's draft row and live row show the live value; the others, and the new row, have none.
    expect(liveCells.map((cell) => cell.textContent)).toEqual([
      "Team Lead",
      "Team Lead",
      "",
      "",
      "",
    ]);
  });

  it("offers no approval of a person's or a column's draft this account changed", async () => {
    const note = "Needs another approver";
    await openPeople({
      "GET /api/session": approverEditor,
      "GET /api/people": () =>
        Response.json({
          people: [
            {
              ...avery,
              draft: {
                ...waiting,
                action: "changed",
                changed: ["preferredName"],
                live: { preferredName: "Avery Before", values: {} },
                needsOtherApprover: true,
              },
            },
            blake,
          ],
          fields: [
            site,
            {
              ...renamed,
              draft: {
                ...renamed.draft,
                state: "waiting",
                needsOtherApprover: true,
              },
            },
          ],
          order: draftedOrder.filter((key) => key !== "f3"),
        }),
    });
    await userEvent.click(await findRowActions("Avery Fictional"));
    const row = await screen.findByRole("menu");
    expect(turnedOffItem(row, "Approve draft…", note)).toBeDefined();
    await userEvent.keyboard("{Escape}");
    await waitFor(() => {
      expect(screen.queryByRole("menu")).toBeNull();
    });
    await userEvent.click(
      screen.getByRole("button", {
        name: (shown) => shown.startsWith("Team roles column"),
      }),
    );
    const column = await screen.findByRole("menu");
    expect(turnedOffItem(column, "Approve…", note)).toBeDefined();
  });

  it("leaves out people and columns drafted to be removed with Drafts applied", async () => {
    serverAnswers({
      "GET /api/session": approverEditor,
      "GET /api/people": () =>
        Response.json({
          people: [avery, { ...blake, draft: draftOf({ action: "deleted" }) }],
          fields: [
            site,
            {
              ...role,
              draft: { ...waiting, action: "deleted", changed: [], live: {} },
            },
          ],
          order,
        }),
      "GET /api/lists": listsAnswer,
    });
    renderApp("/people?show=drafts");
    await screen.findByRole("grid", { name: "People" });
    expect(screen.getByText("Avery Fictional")).toBeDefined();
    expect(screen.queryByText("Blake Fictional")).toBeNull();
    expect(screen.queryByText("Role on team")).toBeNull();
  });

  it("keeps cells reached from the keyboard clear of a header grown by marks", async () => {
    await openPeople({
      "GET /api/session": approverEditor,
      "GET /api/people": peopleWithDrafts,
    });
    // Team roles has a draft of its own, so a line of marks sits under its name.
    const scroller = screen.getByRole("grid", { name: "People" }).parentElement;
    expect(scroller?.style.scrollPaddingTop).toContain("2 * 1.125rem");
  });

  it("shows a changed column's live copy before its live list has loaded", async () => {
    await openPeople({
      "GET /api/session": approverEditor,
      "GET /api/people": () =>
        Response.json({
          people: [avery, blake],
          fields: [site, remade],
          order,
        }),
      "GET /api/lists": () => Response.json({ lists: [sites] }),
    });
    const liveCopy = screen.getByText("Role on team").closest("th");
    expect(liveCopy?.getAttribute("aria-hidden")).toBe("true");
  });

  it("shows choices as their lists' drafts will make them with Drafts applied", async () => {
    serverAnswers({
      "GET /api/session": approverEditor,
      "GET /api/people": peopleAnswer,
      "GET /api/lists": () =>
        Response.json({
          lists: [
            {
              ...sites,
              choices: [
                {
                  ...sites.choices[0],
                  label: "Harbour Quay",
                  draft: {
                    ...waiting,
                    state: "rejected",
                    reason: "No",
                    action: "changed",
                    changed: ["label"],
                    live: { label: "Harbour" },
                  },
                },
                ...sites.choices.slice(1),
              ],
            },
            roles,
            old,
          ],
        }),
    });
    renderApp("/people?show=drafts");
    await screen.findByRole("grid", { name: "People" });
    // The rename was rejected, so the choice shows as it is live.
    expect(screen.getByText("Harbour")).toBeDefined();
    expect(screen.queryByText("Harbour Quay")).toBeNull();
  });

  it("shows each changed column only as drafted with Drafts applied", async () => {
    serverAnswers({
      "GET /api/session": approverEditor,
      "GET /api/people": () =>
        Response.json({
          people: [avery, blake],
          fields: [
            site,
            { ...renamed, draft: { ...renamed.draft, state: "waiting" } },
          ],
          order,
        }),
      "GET /api/lists": listsAnswer,
    });
    renderApp("/people?show=drafts");
    await screen.findByRole("grid", { name: "People" });
    expect(screen.getByText("Team roles")).toBeDefined();
    expect(screen.queryByText("Role on team")).toBeNull();
  });

  it("takes back rejected drafts with Drafts applied, and does not filter by them", async () => {
    serverAnswers({
      "GET /api/session": approverEditor,
      "GET /api/people": () =>
        Response.json({
          people: [
            {
              ...avery,
              preferredName: "Avery Renamed",
              draft: draftOf({
                state: "rejected",
                reason: "No",
                action: "changed",
                changed: ["preferredName"],
                live: { preferredName: "Avery Fictional", values: {} },
              }),
            },
            blake,
          ],
          fields: [site, renamed],
          order: draftedOrder.filter((key) => key !== "f3"),
        }),
      "GET /api/lists": listsAnswer,
    });
    renderApp(`/people?show=drafts&filters={"draft":{"any":["rejected"]}}`);
    await screen.findByRole("grid", { name: "People" });
    // The filter on rejected drafts is set aside, so everyone shows, as they are live.
    expect(screen.getByText("Avery Fictional")).toBeDefined();
    expect(screen.queryByText("Avery Renamed")).toBeNull();
    expect(screen.getByText("Role on team")).toBeDefined();
    expect(screen.queryByText("Team roles")).toBeNull();
    const menu = await draftMenu();
    expect(
      within(menu)
        .getByRole("menuitem", { name: /Rejected/ })
        .hasAttribute("data-disabled"),
    ).toBe(true);
  });

  it("shows only the live columns, in their live order, with Live only", async () => {
    serverAnswers({
      "GET /api/session": approverEditor,
      "GET /api/people": peopleWithDrafts,
      "GET /api/lists": listsAnswer,
    });
    renderApp("/people?show=live");
    // The renamed column shows its live name, and the moved ones their live places.
    await screen.findByRole("grid", { name: "People" });
    const headers = screen
      .getAllByRole("columnheader")
      .map((header) => header.textContent);
    expect(headers.some((text) => text.includes("Previous site"))).toBe(false);
    expect(headers.some((text) => text.includes("Role on team"))).toBe(true);
  });
});
