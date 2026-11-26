// SPDX-License-Identifier: Apache-2.0

// Tests for the People page, with the server's responses simulated.

import {
  act,
  fireEvent,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import { userEvent } from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { bodyOf, greeting, renderApp, serverAnswers } from "./test-support.tsx";
import {
  s1,
  session,
  viewer,
  editor,
  listsAnswer,
  site,
  role,
  avery,
  blake,
  order,
  peopleAnswer,
  savedAs,
  refused,
  openPeople,
  cell,
  focusCell,
  undone,
  settle,
  offeredOptions,
  pick,
} from "./test-people-page.tsx";

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("who sees the People page", () => {
  it("hides the Position column, and adding people, from those who cannot see positions", async () => {
    serverAnswers({
      "GET /api/session": editor,
      "GET /api/greeting": greeting,
      "GET /api/people": () =>
        Response.json({
          people: [
            {
              ...avery,
              positionId: undefined,
              startDate: undefined,
              endDate: undefined,
            },
          ],
          fields: [site],
          order: ["employeeId", "preferredName", "f1"],
          positionHidden: true,
        }),
      "GET /api/lists": listsAnswer,
    });
    renderApp("/people");
    const grid = await screen.findByRole("grid", { name: "People" });
    expect(
      within(grid)
        .getAllByRole("columnheader")
        .map((header) => header.textContent),
    ).not.toContain("Position");
    const newPerson = screen.getByRole<HTMLButtonElement>("button", {
      name: "New person",
    });
    expect(newPerson.disabled).toBe(true);
    expect(newPerson.getAttribute("aria-describedby")).toBe(
      "people-cannot-add",
    );
    expect(
      screen.getByText(
        "This role can't add people, since it can't see positions.",
      ),
    ).toBeTruthy();
    expect(screen.queryByRole("row", { name: "New person" })).toBeNull();
  });

  it("links to it for users who may see people, read only for viewers", async () => {
    serverAnswers({
      "GET /api/session": viewer,
      "GET /api/greeting": greeting,
      "GET /api/people": () =>
        Response.json({
          people: [{ ...avery, startDate: undefined, endDate: undefined }],
          fields: [site],
          order: ["employeeId", "preferredName", "f1"],
        }),
      "GET /api/lists": listsAnswer,
    });
    renderApp("/");
    await userEvent.click(await screen.findByRole("link", { name: "People" }));
    const grid = await screen.findByRole("grid", { name: "People" });
    expect(
      within(grid)
        .getAllByRole("columnheader")
        .map((header) => header.textContent),
    ).toEqual([
      "ID",
      "Name",
      "Site",
      "Position",
      "Manager",
      "Manager?",
      "Team",
      "Team name",
      "Expected",
      "Actions",
    ]);
    expect(screen.queryByRole("button", { name: "New column" })).toBeNull();
    expect(screen.queryByRole("button", { name: "New person" })).toBeNull();
    expect(screen.queryByRole("row", { name: "New person" })).toBeNull();
    focusCell("p1", "preferredName");
    await userEvent.keyboard("{Enter}x");
    await userEvent.dblClick(cell("p1", "preferredName"));
    expect(within(screen.getByRole("grid")).queryByRole("textbox")).toBeNull();
    await userEvent.keyboard("{Shift>}{F10}{/Shift}");
    await screen.findByRole("menuitem", { name: "Show details" });
    expect(
      screen.getAllByRole("menuitem").map(({ textContent }) => textContent),
    ).toEqual(["Show details", "Copy link"]);
  });

  it("offers a new column beside a new person to a role that edits people, without configuration", async () => {
    serverAnswers({
      "GET /api/session": session(["people:view", "people:edit"]),
      "GET /api/people": peopleAnswer,
      "GET /api/lists": listsAnswer,
    });
    renderApp("/people");
    await screen.findByRole("grid", { name: "People" });
    expect(screen.getByRole("button", { name: "New person" })).toBeDefined();
    expect(
      screen
        .getByRole("button", { name: "New column" })
        .getAttribute("data-variant"),
    ).toBe("default");
  });

  it("offers no new column to a role that changes configuration but not people", async () => {
    serverAnswers({
      "GET /api/session": session([
        "people:view",
        "configuration:view",
        "configuration:edit",
      ]),
      "GET /api/people": peopleAnswer,
      "GET /api/lists": listsAnswer,
    });
    renderApp("/people");
    await screen.findByRole("grid", { name: "People" });
    expect(screen.queryByRole("button", { name: "New person" })).toBeNull();
    expect(screen.queryByRole("button", { name: "New column" })).toBeNull();
  });

  it("is not linked or shown for anyone else", async () => {
    serverAnswers({
      "GET /api/session": session(["plan:view", "features:view"]),
      "GET /api/greeting": greeting,
    });
    const history = renderApp("/");
    expect(await screen.findByText("Hello, Fathom")).toBeDefined();
    expect(screen.queryByRole("link", { name: "People" })).toBeNull();
    history.push("/people");
    expect(
      await screen.findByText("There is no page at this address."),
    ).toBeDefined();
  });

  it("says when there is no one yet, and when the people cannot be loaded", async () => {
    let answer = refused(500);
    serverAnswers({
      "GET /api/session": viewer,
      "GET /api/people": () => answer(),
      "GET /api/lists": listsAnswer,
    });
    renderApp("/people");
    expect(
      await screen.findByText("Fathom could not load the people."),
    ).toBeDefined();
    answer = () => Response.json({ people: [], fields: [], order: [] });
    await userEvent.click(screen.getByRole("button", { name: "Try again" }));
    expect(await screen.findByText("No people yet")).toBeDefined();
  });
});

describe("the table", () => {
  it("shows each person's details, choices by name, and dates with their year", async () => {
    await openPeople();
    expect(cell("p1", "f1").textContent).toBe("Harbour");
    expect(cell("p1", "f2").textContent).toBe("Team Lead, Design Authority");
    expect(cell("p1", "startDate").textContent).toBe("Mar 1, 2024");
    expect(cell("p2", "f1").textContent).toBe("Old Mill");
    expect(cell("p2", "startDate").textContent).toBe("");
  });

  it("moves between cells with the arrow keys, Home, and End", async () => {
    await openPeople();
    focusCell("p1", "preferredName");
    await userEvent.keyboard("{ArrowRight}");
    expect(document.activeElement).toBe(cell("p1", "employeeId"));
    await userEvent.keyboard("{ArrowDown}");
    expect(document.activeElement).toBe(cell("p2", "employeeId"));
    await userEvent.keyboard("{End}");
    expect(document.activeElement).toBe(cell("p2", "expected"));
    await userEvent.keyboard("{Home}{ArrowUp}{ArrowUp}{ArrowLeft}");
    expect(document.activeElement).toBe(cell("p1", "preferredName"));
    await userEvent.keyboard("{Control>}{ArrowDown}{/Control}");
    expect(document.activeElement).toBe(cell("p1", "preferredName"));
    // Ctrl+End and Ctrl+Home go to the table's last and first cells.
    await userEvent.keyboard("{Control>}{End}{/Control}");
    expect(document.activeElement).toBe(cell("new-0", "expected"));
    await userEvent.keyboard("{Meta>}{Home}{/Meta}");
    expect(document.activeElement).toBe(cell("p1", "preferredName"));
    // Tab moves across, on to the next row at the end of one, and back with Shift+Tab.
    await userEvent.keyboard("{Tab}");
    expect(document.activeElement).toBe(cell("p1", "employeeId"));
    focusCell("p1", "expected");
    await userEvent.keyboard("{Tab}");
    expect(document.activeElement).toBe(cell("p2", "preferredName"));
    await userEvent.keyboard("{Shift>}{Tab}{/Shift}");
    expect(document.activeElement).toBe(cell("p1", "expected"));
    // From the first cell, Shift+Tab leaves the table, and so does Tab from the last.
    focusCell("p1", "preferredName");
    await userEvent.keyboard("{Shift>}{Tab}{/Shift}");
    expect(document.activeElement).not.toBe(cell("p1", "preferredName"));
    focusCell("new-0", "isManager");
    await userEvent.keyboard("{Tab}");
    expect(document.activeElement).not.toBe(cell("new-0", "isManager"));
  });
});

describe("editing people", () => {
  it("edits a name with Enter, saves it with Enter, moving down, and undoes it", async () => {
    const fetch = await openPeople({ "PATCH /api/people/p1": savedAs() });
    focusCell("p1", "preferredName");
    await userEvent.keyboard("{Enter}");
    const input = await screen.findByRole("textbox", { name: "Name" });
    await waitFor(() => {
      expect(document.activeElement).toBe(input);
    });
    await userEvent.type(input, " Jr{Enter}");
    expect(bodyOf(fetch, "PATCH", "/api/people/p1")).toEqual([
      { preferredName: "Avery Fictional Jr" },
    ]);
    await waitFor(() => {
      expect(document.activeElement).toBe(cell("p2", "preferredName"));
    });
    await settle();
    await userEvent.keyboard("{Meta>}z{/Meta}");
    await waitFor(() => {
      expect(undone(fetch)).toEqual([s1]);
    });
    expect(cell("p1", "preferredName").textContent).toBe("Avery Fictional");
  });

  it("starts editing by typing, saves with Tab moving across, and cancels with Esc", async () => {
    const fetch = await openPeople({ "PATCH /api/people/p2": savedAs() });
    focusCell("p2", "employeeId");
    await userEvent.keyboard("Z");
    const input = await screen.findByRole("textbox", { name: "ID" });
    await userEvent.type(input, "9{Tab}");
    expect(bodyOf(fetch, "PATCH", "/api/people/p2")).toEqual([
      { employeeId: "Z9" },
    ]);
    await waitFor(() => {
      expect(document.activeElement).toBe(cell("p2", "positionId"));
    });
    focusCell("p2", "preferredName");
    await userEvent.keyboard("{F2}");
    const name = await screen.findByRole("textbox", { name: "Name" });
    await userEvent.type(name, "changed{Shift>}{Tab}{/Shift}");
    focusCell("p2", "preferredName");
    await userEvent.keyboard("{Enter}");
    await userEvent.type(
      await screen.findByRole("textbox", { name: "Name" }),
      "x{Escape}",
    );
    expect(bodyOf(fetch, "PATCH", "/api/people/p2")).toEqual([
      { employeeId: "Z9" },
      { preferredName: "Blake Fictionalchanged" },
    ]);
  });

  it("saves nothing when nothing changed", async () => {
    const fetch = await openPeople();
    focusCell("p1", "preferredName");
    await userEvent.keyboard("{Enter}");
    await userEvent.type(
      await screen.findByRole("textbox", { name: "Name" }),
      "{Enter}",
    );
    expect(bodyOf(fetch, "PATCH", "/api/people/p1")).toEqual([]);
  });

  it.each([
    ["preferredName", "{Control>}a{/Control}{Backspace}", "Name needed"],
    [
      "employeeId",
      "{Control>}a{/Control}{Backspace}E2",
      "Someone already has that ID",
    ],
    ["preferredName", "x".repeat(101), "Name too long"],
  ])(
    "shows what is wrong with %s and keeps editing",
    async (key, keys, problem) => {
      const fetch = await openPeople();
      focusCell("p1", key);
      await userEvent.keyboard("{Enter}");
      const input = await within(screen.getByRole("grid")).findByRole(
        "textbox",
      );
      await userEvent.click(input);
      await userEvent.keyboard(keys);
      await userEvent.keyboard("{Enter}");
      expect(await screen.findByRole("alert")).toHaveProperty(
        "textContent",
        problem,
      );
      expect(
        within(screen.getByRole("grid")).getByRole("textbox"),
      ).toBeDefined();
      expect(bodyOf(fetch, "PATCH", "/api/people/p1")).toEqual([]);
      await userEvent.keyboard("{Escape}");
      expect(screen.queryByRole("alert")).toBeNull();
    },
  );

  it("finishes an edit when the cell is left, putting back a value that will not do", async () => {
    const fetch = await openPeople({ "PATCH /api/people/p1": savedAs() });
    focusCell("p1", "employeeId");
    await userEvent.keyboard("{Enter}");
    await userEvent.type(
      await screen.findByRole("textbox", { name: "ID" }),
      "0",
    );
    await userEvent.click(document.body);
    expect(bodyOf(fetch, "PATCH", "/api/people/p1")).toEqual([
      { employeeId: "E10" },
    ]);
    expect(within(screen.getByRole("grid")).queryByRole("textbox")).toBeNull();
    focusCell("p1", "preferredName");
    await userEvent.keyboard("{Enter}{Control>}a{/Control}{Backspace}");
    await userEvent.click(document.body);
    expect(within(screen.getByRole("grid")).queryByRole("textbox")).toBeNull();
    // The row is as it was, so nothing is left under it.
    expect(screen.queryByRole("alert")).toBeNull();
    expect(bodyOf(fetch, "PATCH", "/api/people/p1")).toHaveLength(1);
  });

  it("keeps the selected cell with its person when a save puts the rows in a new order", async () => {
    let answer = peopleAnswer;
    await openPeople({
      "GET /api/people": () => answer(),
      "PATCH /api/people/p1": () => {
        answer = () =>
          Response.json({
            people: [blake, { ...avery, preferredName: "Zed Fictional" }],
            fields: [site, role],
            order,
          });
        return savedAs()();
      },
    });
    focusCell("p1", "preferredName");
    await userEvent.keyboard("{Enter}{Control>}a{/Control}Zed Fictional{Tab}");
    await waitFor(() => {
      expect(cell("p1", "preferredName").textContent).toBe("Zed Fictional");
    });
    expect(cell("p1", "employeeId").tabIndex).toBe(0);
  });

  it("starts a date with the digit typed", async () => {
    const fetch = await openPeople({ "PATCH /api/people/p2": savedAs() });
    focusCell("p2", "startDate");
    await userEvent.keyboard("2026-05-04{Enter}");
    expect(bodyOf(fetch, "PATCH", "/api/people/p2")).toEqual([
      { startDate: "2026-05-04" },
    ]);
  });

  it("edits and clears dates, refusing an end before the start", async () => {
    const fetch = await openPeople({ "PATCH /api/people/p1": savedAs() });
    focusCell("p1", "endDate");
    await userEvent.keyboard("{Enter}");
    const end = await screen.findByLabelText("End", { selector: "input" });
    fireEvent.change(end, { target: { value: "2020-01-01" } });
    await userEvent.type(end, "{Enter}");
    expect(await screen.findByRole("alert")).toHaveProperty(
      "textContent",
      "The end date cannot be before the start date",
    );
    fireEvent.change(end, { target: { value: "2027-01-01" } });
    await userEvent.type(end, "{Enter}");
    focusCell("p1", "startDate");
    await userEvent.keyboard("{Delete}");
    expect(bodyOf(fetch, "PATCH", "/api/people/p1")).toEqual([
      { endDate: "2027-01-01" },
      { startDate: null },
    ]);
  });

  it("picks one choice for a column that takes one, offering a retired choice only where it is held", async () => {
    const fetch = await openPeople({ "PATCH /api/people/p2": savedAs() });
    focusCell("p2", "f1");
    await userEvent.keyboard("{Enter}");
    expect(await offeredOptions()).toEqual([
      "Harbour",
      "Northmere",
      "Old Mill",
    ]);
    await pick("Northmere");
    expect(bodyOf(fetch, "PATCH", "/api/people/p2")).toEqual([
      { values: { f1: ["c2"] } },
    ]);
    // Enter picks and moves down, as it saves other cells.
    await waitFor(() => {
      expect(document.activeElement).toBe(cell("new-0", "f1"));
    });
    focusCell("p1", "f1");
    await userEvent.keyboard(" ");
    expect(await offeredOptions()).toEqual(["Harbour", "Northmere"]);
    await userEvent.keyboard("{Escape}");
    expect(screen.queryByRole("option")).toBeNull();
  });

  it("refuses to clear a required column, and clears others with Delete", async () => {
    const fetch = await openPeople({ "PATCH /api/people/p1": savedAs() });
    focusCell("p1", "f1");
    await userEvent.keyboard("{Delete}");
    expect(screen.queryByRole("alert")).toBeNull();
    expect(cell("p1", "f1").textContent).not.toBe("");
    focusCell("p1", "f2");
    await userEvent.keyboard("{Backspace}");
    expect(bodyOf(fetch, "PATCH", "/api/people/p1")).toEqual([
      { values: { f2: [] } },
    ]);
  });

  it("picks several choices for a column that takes several, saving them on Tab or leaving", async () => {
    const fetch = await openPeople({ "PATCH /api/people/p2": savedAs() });
    focusCell("p2", "f2");
    await userEvent.keyboard("t");
    await pick("Team Lead");
    await userEvent.keyboard("{Tab}");
    expect(bodyOf(fetch, "PATCH", "/api/people/p2")).toEqual([
      { values: { f2: ["r1"] } },
    ]);
    focusCell("p2", "f2");
    await userEvent.dblClick(cell("p2", "f2"));
    await pick("Design Authority");
    await userEvent.keyboard("{Shift>}{Tab}{/Shift}");
    expect(bodyOf(fetch, "PATCH", "/api/people/p2")).toHaveLength(2);
    focusCell("p2", "f2");
    await userEvent.keyboard("{Enter}");
    await offeredOptions();
    act(() => {
      cell("p1", "preferredName").focus();
    });
    expect(bodyOf(fetch, "PATCH", "/api/people/p2")).toHaveLength(2);
  });

  it("says when a change cannot be saved", async () => {
    await openPeople({
      "PATCH /api/people/p1": refused(409, "Someone already has that ID"),
    });
    focusCell("p1", "employeeId");
    await userEvent.keyboard("{Enter}");
    await userEvent.type(
      await screen.findByRole("textbox", { name: "ID" }),
      "0{Enter}",
    );
    expect(
      await screen.findByText("Someone already has that ID"),
    ).toBeDefined();
  });
});

describe("only the latest change", () => {
  it("is not undone behind an open dialog, and a change that saved nothing offers no undo", async () => {
    const fetch = await openPeople({ "PATCH /api/people/p1": savedAs(null) });
    focusCell("p1", "f2");
    await userEvent.keyboard("{Delete}");
    await settle();
    await userEvent.keyboard("{Meta>}z{/Meta}");
    await userEvent.click(screen.getByRole("button", { name: "New column" }));
    await screen.findByRole("dialog");
    await userEvent.keyboard("{Meta>}z{/Meta}");
    expect(undone(fetch)).toEqual([]);
  });
});

describe("on another date", () => {
  const onDay = "2025-03-01";
  const managingAvery = { ...avery, isManager: true };
  const peopleOnDay = {
    [`GET /api/people?on=${onDay}`]: () =>
      Response.json({
        people: [managingAvery, blake],
        fields: [site, role],
        order,
      }),
  };
  const reader = session([
    "people:view",
    "configuration:view",
    "plan:view",
    "features:view",
    "personal:view",
  ]);

  async function openOn(
    signedInAs: () => Response,
    path = `/people?day=${onDay}`,
  ) {
    const fetch = serverAnswers({
      "GET /api/session": signedInAs,
      "GET /api/people": peopleAnswer,
      "GET /api/lists": listsAnswer,
      ...peopleOnDay,
      "PATCH /api/people/p2": savedAs(),
    });
    const history = renderApp(path);
    await screen.findByRole("grid", { name: "People" });
    return { fetch, history };
  }

  it("lists People as on that date, read only, for those who may not change it then", async () => {
    const { fetch } = await openOn(reader);
    await waitFor(() => {
      expect(fetch.mock.calls.map(([url]) => url)).toContain(
        `/api/people?on=${onDay}`,
      );
    });
    focusCell("p2", "managerId");
    await userEvent.keyboard("{Enter}");
    expect(screen.queryByRole("listbox")).toBeNull();
    expect(screen.queryByRole("button", { name: /^Draft/ })).toBeNull();
  });

  it("changes only managers from an earlier date, dated from it", async () => {
    const { fetch } = await openOn(editor);
    expect(await screen.findByRole("button", { name: /^Draft/ })).toBeDefined();
    expect(screen.queryByRole("button", { name: "New person" })).toBeNull();
    expect(cell("p2", "preferredName").getAttribute("aria-readonly")).toBe(
      "true",
    );
    focusCell("p2", "managerId");
    await userEvent.keyboard("{Enter}");
    await pick(/^Avery Fictional\b/);
    await waitFor(() => {
      expect(bodyOf(fetch, "PATCH", "/api/people/p2")).toEqual([
        { managerId: "p1", managerFrom: onDay },
      ]);
    });
  });

  it("keeps a manager whose line today started after that date", async () => {
    const lineToday = {
      ...blake,
      manager: { id: "p1", preferredName: "Avery Fictional" },
      managerFrom: "2025-06-01",
    };
    serverAnswers({
      "GET /api/session": editor,
      "GET /api/people": () =>
        Response.json({
          people: [managingAvery, lineToday],
          fields: [site, role],
          order,
        }),
      "GET /api/lists": listsAnswer,
      ...peopleOnDay,
    });
    renderApp(`/people?day=${onDay}`);
    await screen.findByRole("grid", { name: "People" });
    await waitFor(() => {
      expect(cell("p2", "managerId").getAttribute("aria-readonly")).toBe(
        "true",
      );
    });
  });

  it("goes back to the earlier date with the browser's Back after Today", async () => {
    const { history } = await openOn(editor);
    await userEvent.click(await screen.findByRole("button", { name: "Today" }));
    await waitFor(() => {
      expect(history.location.search).not.toContain("day=");
    });
    history.back();
    await waitFor(() => {
      expect(history.location.search).toContain(`day=${onDay}`);
    });
  });

  it("offers no date to those who may not see other dates", async () => {
    await openOn(viewer, "/people");
    expect(screen.queryByRole("button", { name: "Today" })).toBeNull();
  });
});

describe("a link to a column", () => {
  it("opens the column's menu, offering its link, and takes the column out of the address", async () => {
    // Given a column whose id a link can name
    const user = userEvent.setup();
    const linked = {
      ...site,
      id: "f0000000-0000-4000-8000-0000000000f1",
      keyNumber: 5,
    };
    serverAnswers({
      "GET /api/session": editor,
      "GET /api/people": () =>
        Response.json({
          people: [{ ...avery, values: { [linked.id]: ["c1"] } }],
          fields: [linked],
          order: order.map((key) => (key === "f1" ? linked.id : key)),
        }),
      "GET /api/lists": listsAnswer,
    });
    // When
    const history = renderApp(`/people?column=${linked.id}`);
    // Then
    const menu = await screen.findByRole("menu");
    expect(menu.textContent).toContain("Site");
    await waitFor(() => {
      expect(history.location.search).not.toContain("column=");
    });
    await user.click(within(menu).getByRole("menuitem", { name: "Copy link" }));
    expect(await navigator.clipboard.readText()).toBe(
      `${window.location.origin}/go/column/5`,
    );
  });
});
