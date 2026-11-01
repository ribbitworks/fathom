// SPDX-License-Identifier: Apache-2.0

// Tests for the People page, with the server's responses simulated: who sees it and what they see;
// moving around the table and editing people's details from the keyboard; adding people in the new
// rows and by pasting; deleting people; adding, changing, moving, and deleting columns; and Undo and
// the server's refusals throughout. Helpers that need no page are tested in people-grid.test.ts.

import { act, fireEvent, screen, within } from "@testing-library/react";
import { userEvent } from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  fictionalUser,
  greeting,
  renderApp,
  serverAnswers,
} from "./test-support.tsx";

const s1 = "00000000-0000-4000-8000-000000000001";
const u1 = "00000000-0000-4000-8000-000000000002";

const session = (permissions: string[]) => () =>
  Response.json({ ...fictionalUser, permissions });
const viewer = session(["people:view", "configuration:view", "plan:view"]);
const editor = session([
  "configuration:edit",
  "configuration:view",
  "people:edit",
  "people:view",
  "plan:view",
  "restricted:edit",
  "restricted:view",
]);

const choice = (id: string, label: string, retired = false) => ({
  id,
  label,
  description: "",
  retired,
});
const list = (
  id: string,
  name: string,
  choices: object[],
  retired = false,
) => ({
  id,
  name,
  description: "",
  visibility: "general",
  retired,
  choices,
});
const sites = list("l1", "Sites", [
  choice("c1", "Harbour"),
  choice("c2", "Northmere"),
  choice("c3", "Old Mill", true),
]);
const roles = {
  ...list("l2", "Roles on the team", [
    choice("r1", "Team Lead"),
    choice("r2", "Design Authority"),
  ]),
  visibility: "restricted",
};
const old = list("l3", "Old List", [], true);
const listsAnswer = () => Response.json({ lists: [sites, roles, old] });

const site = {
  id: "f1",
  name: "Site",
  listId: "l1",
  multiple: false,
  required: true,
};
const role = {
  id: "f2",
  name: "Role on team",
  listId: "l2",
  multiple: true,
  required: false,
};
const avery = {
  id: "p1",
  preferredName: "Avery Fictional",
  employeeId: "E1",
  startDate: "2024-03-01",
  endDate: null,
  values: { f1: ["c1"], f2: ["r1", "r2"] },
};
const blake = {
  id: "p2",
  preferredName: "Blake Fictional",
  employeeId: "E2",
  startDate: null,
  endDate: null,
  values: { f1: ["c3"] },
};
const order = [
  "preferredName",
  "employeeId",
  "f1",
  "f2",
  "startDate",
  "endDate",
];
const peopleAnswer = () =>
  Response.json({ people: [avery, blake], fields: [site, role], order });
const savedAs =
  (changeSetId: string | null = s1) =>
  () =>
    Response.json({ changeSetId });
const refused =
  (status: number, error = "Refused") =>
  () =>
    Response.json({ error }, { status });

afterEach(() => {
  vi.unstubAllGlobals();
});

type Answers = Parameters<typeof serverAnswers>[0];

async function openPeople(answers: Answers = {}) {
  const fetch = serverAnswers({
    "GET /api/session": editor,
    "GET /api/people": peopleAnswer,
    "GET /api/lists": listsAnswer,
    [`POST /api/undo/${s1}`]: savedAs(u1),
    ...answers,
  });
  renderApp("/people");
  await screen.findByRole("grid", { name: "People" });
  return fetch;
}

function cell(row: string, key: string): HTMLElement {
  return document.getElementById(`cell-${row}-${key}`) as HTMLElement;
}

// The keys of the columns, by the name each column's header shows.
const columnKeys = new Map([
  ["Name", "preferredName"],
  ["Employee ID", "employeeId"],
  ["Site", "f1"],
  ["Role on team", "f2"],
  ["Start", "startDate"],
  ["End", "endDate"],
]);

// A row's cell in the column with the given header.
function inRow(row: HTMLElement, label: string): HTMLElement {
  return row.querySelector(
    `[id$="-${String(columnKeys.get(label))}"]`,
  ) as HTMLElement;
}

function focusCell(row: string, key: string) {
  act(() => {
    cell(row, key).focus();
  });
}

function bodyOf(
  fetch: ReturnType<typeof serverAnswers>,
  method: string,
  url: string,
): unknown[] {
  return fetch.mock.calls
    .filter(([called, init]) => called === url && init?.method === method)
    .map(([, init]) => JSON.parse(init?.body as string) as unknown);
}

function undone(fetch: ReturnType<typeof serverAnswers>): string[] {
  return fetch.mock.calls
    .filter(
      ([url, init]) => url.startsWith("/api/undo/") && init?.method === "POST",
    )
    .map(([url]) => url.slice("/api/undo/".length));
}

async function settle() {
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 20));
  });
}

// The choices the open picker offers.
async function offeredOptions(): Promise<string[]> {
  const options = await screen.findAllByRole("option");
  return options.map((option) => option.textContent);
}

async function pick(name: string) {
  await userEvent.click(await screen.findByRole("option", { name }));
}

// Pastes text into a cell, as from a spreadsheet.
async function paste(target: HTMLElement, text: string) {
  act(() => {
    target.focus();
  });
  await userEvent.paste(text);
}

describe("who sees the People page", () => {
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
    ).toEqual(["Employee ID", "Name", "Site"]);
    expect(screen.queryByRole("button", { name: "New column" })).toBeNull();
    expect(screen.queryByRole("row", { name: "New person" })).toBeNull();
    focusCell("p1", "preferredName");
    await userEvent.keyboard("{Enter}x");
    await userEvent.dblClick(cell("p1", "preferredName"));
    expect(within(screen.getByRole("grid")).queryByRole("textbox")).toBeNull();
    await userEvent.keyboard("{Shift>}{F10}{/Shift}");
    expect(screen.queryByRole("menu")).toBeNull();
  });

  it("is not linked or shown for anyone else", async () => {
    serverAnswers({
      "GET /api/session": session(["plan:view"]),
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
    expect(document.activeElement).toBe(cell("p2", "endDate"));
    await userEvent.keyboard("{Home}{ArrowUp}{ArrowUp}{ArrowLeft}");
    expect(document.activeElement).toBe(cell("p1", "preferredName"));
    await userEvent.keyboard("{Control>}{ArrowDown}{/Control}");
    expect(document.activeElement).toBe(cell("p1", "preferredName"));
    // Ctrl+End and Ctrl+Home go to the table's last and first cells.
    await userEvent.keyboard("{Control>}{End}{/Control}");
    expect(document.activeElement).toBe(cell("new-0", "endDate"));
    await userEvent.keyboard("{Meta>}{Home}{/Meta}");
    expect(document.activeElement).toBe(cell("p1", "preferredName"));
    // Tab moves across, on to the next row at the end of one, and back with Shift+Tab.
    await userEvent.keyboard("{Tab}");
    expect(document.activeElement).toBe(cell("p1", "employeeId"));
    focusCell("p1", "endDate");
    await userEvent.keyboard("{Tab}");
    expect(document.activeElement).toBe(cell("p2", "preferredName"));
    await userEvent.keyboard("{Shift>}{Tab}{/Shift}");
    expect(document.activeElement).toBe(cell("p1", "endDate"));
    // From the first cell, Shift+Tab leaves the table, and so does Tab from the last.
    focusCell("p1", "preferredName");
    await userEvent.keyboard("{Shift>}{Tab}{/Shift}");
    expect(document.activeElement).not.toBe(cell("p1", "preferredName"));
    focusCell("new-0", "endDate");
    await userEvent.keyboard("{Tab}");
    expect(document.activeElement).not.toBe(cell("new-0", "endDate"));
  });
});

describe("editing people", () => {
  it("edits a name with Enter, saves it with Enter, moving down, and undoes it", async () => {
    const fetch = await openPeople({ "PATCH /api/people/p1": savedAs() });
    focusCell("p1", "preferredName");
    await userEvent.keyboard("{Enter}");
    const input = await screen.findByRole("textbox", { name: "Name" });
    await vi.waitFor(() => {
      expect(document.activeElement).toBe(input);
    });
    await userEvent.type(input, " Jr{Enter}");
    expect(bodyOf(fetch, "PATCH", "/api/people/p1")).toEqual([
      { preferredName: "Avery Fictional Jr" },
    ]);
    await vi.waitFor(() => {
      expect(document.activeElement).toBe(cell("p2", "preferredName"));
    });
    await settle();
    await userEvent.keyboard("{Meta>}z{/Meta}");
    await vi.waitFor(() => {
      expect(undone(fetch)).toEqual([s1]);
    });
    expect(cell("p1", "preferredName").textContent).toBe("Avery Fictional");
  });

  it("starts editing by typing, saves with Tab moving across, and cancels with Esc", async () => {
    const fetch = await openPeople({ "PATCH /api/people/p2": savedAs() });
    focusCell("p2", "employeeId");
    await userEvent.keyboard("Z");
    const input = await screen.findByRole("textbox", { name: "Employee ID" });
    await userEvent.type(input, "9{Tab}");
    expect(bodyOf(fetch, "PATCH", "/api/people/p2")).toEqual([
      { employeeId: "Z9" },
    ]);
    await vi.waitFor(() => {
      expect(document.activeElement).toBe(cell("p2", "f1"));
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
      "Someone already has that Employee ID",
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
      await screen.findByRole("textbox", { name: "Employee ID" }),
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
    expect(screen.getByRole("alert").textContent).toBe("Name needed");
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
    await vi.waitFor(() => {
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
    await vi.waitFor(() => {
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
    expect(await screen.findByRole("alert")).toHaveProperty(
      "textContent",
      "Site needed",
    );
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
      "PATCH /api/people/p1": refused(
        409,
        "Someone already has that Employee ID",
      ),
    });
    focusCell("p1", "employeeId");
    await userEvent.keyboard("{Enter}");
    await userEvent.type(
      await screen.findByRole("textbox", { name: "Employee ID" }),
      "0{Enter}",
    );
    expect(
      await screen.findByText("Someone already has that Employee ID"),
    ).toBeDefined();
  });
});

describe("adding people", () => {
  // The first new row; a new row with a problem keeps an empty one below it.
  const newRow = () =>
    screen.getAllByRole("row", { name: "New person" })[0] as HTMLElement;
  const newCell = (label: string) => inRow(newRow(), label);

  it("adds a person from the new row, starting the next, and undoes it", async () => {
    const fetch = await openPeople({
      "POST /api/people": () =>
        Response.json({ ids: ["p9"], changeSetId: s1 }, { status: 201 }),
    });
    act(() => {
      newCell("Name").focus();
    });
    // Typing starts the row, and Tab goes straight on to typing in the next cell.
    await userEvent.keyboard("Casey{Tab}E9{Tab}har{Tab}{Tab}");
    const start = await screen.findByLabelText("Start", { selector: "input" });
    fireEvent.change(start, { target: { value: "2026-11-02" } });
    await userEvent.type(start, "{Enter}");
    expect(bodyOf(fetch, "POST", "/api/people")).toEqual([
      {
        people: [
          {
            preferredName: "Casey",
            employeeId: "E9",
            startDate: "2026-11-02",
            endDate: null,
            values: { f1: ["c1"], f2: [] },
          },
        ],
      },
    ]);
    await vi.waitFor(() => {
      expect(newCell("Name").textContent).toBe("");
    });
    await settle();
    await userEvent.keyboard("{Meta>}z{/Meta}");
    await vi.waitFor(() => {
      expect(undone(fetch)).toEqual([s1]);
    });
  });

  it("shows what a new row is missing, and adds it with Enter once complete", async () => {
    const fetch = await openPeople({
      "POST /api/people": () =>
        Response.json({ ids: ["p9"], changeSetId: s1 }, { status: 201 }),
    });
    act(() => {
      newCell("Name").focus();
    });
    await userEvent.keyboard("C{Enter}");
    expect(await screen.findByRole("alert")).toHaveProperty(
      "textContent",
      "Employee ID needed",
    );
    act(() => {
      newCell("Employee ID").focus();
    });
    await userEvent.keyboard("E2{Enter}");
    expect(await screen.findByRole("alert")).toHaveProperty(
      "textContent",
      "Site needed",
    );
    act(() => {
      newCell("Site").focus();
    });
    await userEvent.keyboard("nor{Enter}");
    expect(await screen.findByRole("alert")).toHaveProperty(
      "textContent",
      "Someone already has that Employee ID",
    );
    expect(bodyOf(fetch, "POST", "/api/people")).toEqual([]);
    act(() => {
      newCell("Employee ID").focus();
    });
    await userEvent.keyboard("{Delete}E7{Enter}");
    expect(bodyOf(fetch, "POST", "/api/people")).toHaveLength(1);
  });

  it("does nothing with Enter on an empty new row, and Esc keeps what was typed out", async () => {
    const fetch = await openPeople();
    const rows = screen.getAllByRole("row", { name: "New person" });
    expect(rows).toHaveLength(1);
    act(() => {
      newCell("Employee ID").focus();
    });
    await userEvent.keyboard("{F2}");
    await userEvent.type(
      screen.getByRole("textbox", { name: "Employee ID" }),
      "E5{Escape}",
    );
    expect(newCell("Employee ID").textContent).toBe("");
    await userEvent.keyboard("{F2}{Enter}{Enter}");
    await userEvent.keyboard("{Escape}");
    expect(bodyOf(fetch, "POST", "/api/people")).toEqual([]);
  });

  it("adds a person for each pasted row, matching choices by name", async () => {
    const fetch = await openPeople({
      "POST /api/people": () =>
        Response.json({ ids: ["p8", "p9"], changeSetId: s1 }, { status: 201 }),
    });
    await paste(
      newCell("Name"),
      "Dana Fictional\tE10\tharbour\tTeam Lead\n\nEli Fictional\tE11\tNorthmere\t\t2025-02-01\n",
    );
    expect(bodyOf(fetch, "POST", "/api/people")).toEqual([
      {
        people: [
          {
            preferredName: "Dana Fictional",
            employeeId: "E10",
            startDate: null,
            endDate: null,
            values: { f1: ["c1"], f2: ["r1"] },
          },
          {
            preferredName: "Eli Fictional",
            employeeId: "E11",
            startDate: "2025-02-01",
            endDate: null,
            values: { f1: ["c2"], f2: [] },
          },
        ],
      },
    ]);
  });

  it("keeps pasted rows that will not do as new rows, with their problems, and ignores pastes elsewhere", async () => {
    const fetch = await openPeople();
    await paste(cell("p1", "preferredName"), "Somebody\tE20");
    await paste(newCell("Name"), "   ");
    await paste(
      newCell("Employee ID"),
      "E21\tOld Mill\nE22\tAtlantis\tTeam Lead\textra\textra\textra\textra",
    );
    const rows = screen.getAllByRole("row", { name: "New person" });
    expect(rows).toHaveLength(3);
    expect(within(rows[0] as HTMLElement).getByRole("alert").textContent).toBe(
      "No Site called Old Mill",
    );
    expect(within(rows[1] as HTMLElement).getByRole("alert").textContent).toBe(
      "No Site called Atlantis",
    );
    expect(bodyOf(fetch, "POST", "/api/people")).toEqual([]);
    await vi.waitFor(() => {
      expect(document.activeElement).toBe(rows[0]?.querySelector("td"));
    });
    // Pasting again keeps the rows that would not do.
    const last = screen.getAllByRole("row", { name: "New person" }).at(-1);
    await paste(
      inRow(last as HTMLElement, "Name"),
      "Iris Fictional\tE23\tHarbour",
    );
    expect(screen.getAllByRole("row", { name: "New person" })).toHaveLength(4);
  });

  it("refuses more rows than can be added at once", async () => {
    await openPeople();
    await paste(
      newCell("Name"),
      Array.from({ length: 1001 }, () => "A\tB").join("\n"),
    );
    expect(await screen.findByRole("alert")).toHaveProperty(
      "textContent",
      "Up to 1000 rows at once",
    );
  });

  it("gives back the new rows when they cannot be added", async () => {
    await openPeople({ "POST /api/people": refused(500) });
    await paste(newCell("Name"), "Fay Fictional\tE30\tHarbour");
    expect(
      await screen.findByText(
        "Fathom could not add the people. Try again in a moment.",
      ),
    ).toBeDefined();
    await vi.waitFor(() => {
      expect(
        screen.getAllByRole("row", { name: "New person" })[0]?.textContent,
      ).toContain("Fay Fictional");
    });
  });
});

describe("the choice picker", () => {
  it("adds and removes several choices with Enter, says when nothing matches, and finishes with Enter", async () => {
    const fetch = await openPeople({ "PATCH /api/people/p1": savedAs() });
    focusCell("p1", "f2");
    await userEvent.keyboard("{F2}");
    expect(await offeredOptions()).toEqual(["Team Lead", "Design Authority"]);
    // Team Lead is chosen already, so Enter on it takes it out.
    await userEvent.keyboard("team{Enter}");
    await userEvent.keyboard("zzz");
    expect(await screen.findByText("No matches")).toBeDefined();
    await userEvent.keyboard("{Enter}");
    expect(bodyOf(fetch, "PATCH", "/api/people/p1")).toEqual([
      { values: { f2: ["r2"] } },
    ]);
  });

  it("adds what was typed with Tab in a column that takes several", async () => {
    const fetch = await openPeople({ "PATCH /api/people/p2": savedAs() });
    focusCell("p2", "f2");
    await userEvent.keyboard("des");
    await offeredOptions();
    await userEvent.keyboard("{Tab}");
    expect(bodyOf(fetch, "PATCH", "/api/people/p2")).toEqual([
      { values: { f2: ["r2"] } },
    ]);
  });

  it("gives up a single choice when the cell is left", async () => {
    const fetch = await openPeople();
    focusCell("p1", "f1");
    await userEvent.keyboard("n");
    await offeredOptions();
    act(() => {
      cell("p1", "preferredName").focus();
    });
    expect(bodyOf(fetch, "PATCH", "/api/people/p1")).toEqual([]);
  });
});

describe("new rows that will not do", () => {
  it("shows a date that is not a date, and checks again with Enter on the row", async () => {
    const fetch = await openPeople();
    const first = () =>
      screen.getAllByRole("row", { name: "New person" })[0] as HTMLElement;
    await paste(
      inRow(first(), "Name"),
      "Gale Fictional\tE40\tHarbour\t\t31/10/2026",
    );
    expect(await within(first()).findByRole("alert")).toHaveProperty(
      "textContent",
      "Start: use a date such as 2026-10-31",
    );
    act(() => {
      inRow(first(), "Site").focus();
    });
    await userEvent.keyboard("{Enter}");
    expect(within(first()).getByRole("alert")).toBeDefined();
    expect(bodyOf(fetch, "POST", "/api/people")).toEqual([]);
  });
});

describe("deleting people", () => {
  it("deletes a person from their menu, and undoes it from the notification", async () => {
    const fetch = await openPeople({ "DELETE /api/people/p2": savedAs() });
    focusCell("p2", "employeeId");
    await userEvent.keyboard("{Shift>}{F10}{/Shift}");
    await userEvent.click(
      await screen.findByRole("menuitem", { name: "Delete person" }),
    );
    expect(await screen.findByText("Deleted Blake Fictional.")).toBeDefined();
    expect(
      fetch.mock.calls.map(([url, init]) => [url, init?.method]),
    ).toContainEqual(["/api/people/p2", "DELETE"]);
    await userEvent.click(screen.getByRole("button", { name: "Undo" }));
    await vi.waitFor(() => {
      expect(undone(fetch)).toEqual([s1]);
    });
  });

  it("opens a person's menu from its button and with the menu key", async () => {
    await openPeople();
    await userEvent.click(
      screen.getByRole("button", { name: "Actions for Avery Fictional" }),
    );
    expect(await screen.findByRole("menu")).toBeDefined();
    await userEvent.keyboard("{Escape}");
    focusCell("p1", "f1");
    await userEvent.keyboard("{ContextMenu}");
    expect(await screen.findByRole("menu")).toBeDefined();
  });
});

describe("columns", () => {
  async function newColumnDialog() {
    await userEvent.click(screen.getByRole("button", { name: "New column" }));
    return screen.findByRole("dialog", { name: "New column" });
  }

  it("adds a column drawing on a list, and undoes it", async () => {
    const fetch = await openPeople({
      "POST /api/people/columns": () =>
        Response.json(
          {
            field: { ...role, id: "f3", name: "Office", listId: "l1" },
            changeSetId: s1,
          },
          { status: 201 },
        ),
    });
    const dialog = await newColumnDialog();
    await userEvent.type(within(dialog).getByLabelText("Name"), "Office");
    const listSelect = within(dialog).getByRole("combobox", { name: "List" });
    expect(
      within(listSelect)
        .getAllByRole("option")
        .map((option) => option.textContent),
    ).toEqual(["", "Sites", "Roles on the team (Restricted)"]);
    await userEvent.selectOptions(listSelect, "Sites");
    await userEvent.click(within(dialog).getByLabelText("Several choices"));
    await userEvent.click(within(dialog).getByLabelText("Must be filled in"));
    await userEvent.click(within(dialog).getByLabelText("Must be filled in"));
    await userEvent.click(
      within(dialog).getByRole("button", { name: "Add column" }),
    );
    expect(bodyOf(fetch, "POST", "/api/people/columns")).toEqual([
      { name: "Office", listId: "l1", multiple: true, required: false },
    ]);
    await settle();
    await userEvent.keyboard("{Meta>}z{/Meta}");
    await vi.waitFor(() => {
      expect(undone(fetch)).toEqual([s1]);
    });
  });

  it("says what is wrong with a new column, and shows the server's refusals", async () => {
    let answer = refused(409, "There is already a column with that name");
    const fetch = await openPeople({
      "POST /api/people/columns": () => answer(),
    });
    const dialog = await newColumnDialog();
    await userEvent.click(
      within(dialog).getByRole("button", { name: "Add column" }),
    );
    expect(within(dialog).getByText("Name needed")).toBeDefined();
    expect(within(dialog).getByText("List needed")).toBeDefined();
    await userEvent.type(within(dialog).getByLabelText("Name"), "site");
    expect(within(dialog).getByText("Already a column")).toBeDefined();
    await userEvent.clear(within(dialog).getByLabelText("Name"));
    await userEvent.type(within(dialog).getByLabelText("Name"), "Desk");
    await userEvent.selectOptions(
      within(dialog).getByRole("combobox", { name: "List" }),
      "Sites",
    );
    await userEvent.click(
      within(dialog).getByRole("button", { name: "Add column" }),
    );
    expect(await within(dialog).findByText("Already a column")).toBeDefined();
    // A name the server says is taken must change before trying again.
    await userEvent.type(within(dialog).getByLabelText("Name"), "s");
    answer = refused(
      409,
      "1 person has no Desks, so it cannot be required yet",
    );
    await userEvent.click(
      within(dialog).getByRole("button", { name: "Add column" }),
    );
    expect(
      await within(dialog).findByText(
        "1 person has no Desks, so it cannot be required yet",
      ),
    ).toBeDefined();
    expect(bodyOf(fetch, "POST", "/api/people/columns")).toHaveLength(2);
    await userEvent.selectOptions(
      within(dialog).getByRole("combobox", { name: "List" }),
      "",
    );
    await userEvent.click(
      within(dialog).getByRole("button", { name: "Add column" }),
    );
    expect(within(dialog).getByText("List needed")).toBeDefined();
    await userEvent.click(
      within(dialog).getByRole("button", { name: "Cancel" }),
    );
  });

  it("closes the column dialog with Esc", async () => {
    await openPeople();
    await userEvent.click(screen.getByRole("button", { name: "New column" }));
    await screen.findByRole("dialog", { name: "New column" });
    await userEvent.keyboard("{Escape}");
    await vi.waitFor(() => {
      expect(screen.queryByRole("dialog")).toBeNull();
    });
  });

  it("changes a column from its header's menu, and deletes it with Undo", async () => {
    const fetch = await openPeople({
      "PUT /api/people/columns/f2": () =>
        Response.json({ field: { ...role, name: "Roles" }, changeSetId: s1 }),
      "DELETE /api/people/columns/f2": savedAs(),
    });
    await userEvent.click(
      screen.getByRole("button", { name: "Role on team column" }),
    );
    await userEvent.click(
      await screen.findByRole("menuitem", { name: "Edit column" }),
    );
    let dialog = await screen.findByRole("dialog", { name: "Edit column" });
    const name = within(dialog).getByLabelText("Name");
    await userEvent.clear(name);
    await userEvent.type(name, "Roles");
    await userEvent.click(within(dialog).getByRole("button", { name: "Save" }));
    expect(bodyOf(fetch, "PUT", "/api/people/columns/f2")).toEqual([
      { name: "Roles", listId: "l2", multiple: true, required: false },
    ]);
    // The simulated server still answers with the old name once the change has saved.
    await userEvent.click(
      await screen.findByRole("button", { name: "Role on team column" }),
    );
    await userEvent.click(
      await screen.findByRole("menuitem", { name: "Edit column" }),
    );
    dialog = await screen.findByRole("dialog", { name: "Edit column" });
    await userEvent.click(
      within(dialog).getByRole("button", { name: "Delete column" }),
    );
    expect(
      await screen.findByText("Deleted the Role on team column."),
    ).toBeDefined();
    await userEvent.click(screen.getByRole("button", { name: "Undo" }));
    await vi.waitFor(() => {
      expect(undone(fetch)).toEqual([s1]);
    });
  });

  it("moves any column from its menu, with Alt and the arrow keys, and by dragging, but not past either end", async () => {
    const fetch = await openPeople({
      "PUT /api/people/columns/f1/position": savedAs(),
      "PUT /api/people/columns/f2/position": savedAs(),
      "PUT /api/people/columns/preferredName/position": savedAs(),
      "PUT /api/people/columns/endDate/position": savedAs(),
      "PUT /api/people/columns/employeeId/position": savedAs(),
    });
    const header = (label: string) =>
      screen.getByRole("button", { name: `${label} column` });
    const moves = (key: string) =>
      bodyOf(fetch, "PUT", `/api/people/columns/${key}/position`);

    await userEvent.click(header("Role on team"));
    await userEvent.click(
      await screen.findByRole("menuitem", { name: /^Move left/ }),
    );
    await vi.waitFor(() => {
      expect(moves("f2")).toEqual([{ after: "employeeId" }]);
    });

    // Built-in columns move too, to the very start.
    act(() => {
      header("Employee ID").focus();
    });
    await userEvent.keyboard("{Alt>}{ArrowLeft}{/Alt}");
    await vi.waitFor(() => {
      expect(moves("employeeId")).toEqual([{ after: null }]);
    });
    act(() => {
      header("Name").focus();
    });
    await userEvent.keyboard("{Alt>}{ArrowRight}{/Alt}");
    await userEvent.keyboard("{Alt>}{ArrowLeft}{/Alt}{ArrowLeft}");
    await vi.waitFor(() => {
      expect(moves("preferredName")).toHaveLength(1);
    });
    await settle();
    act(() => {
      header("Name").focus();
    });
    await userEvent.keyboard("{Alt>}{ArrowLeft}{/Alt}");
    await userEvent.click(header("End"));
    await userEvent.click(
      await screen.findByRole("menuitem", { name: /^Move right/ }),
    );
    expect(moves("endDate")).toEqual([]);

    const th = (label: string) => header(label).closest("th") as HTMLElement;
    fireEvent.drop(th("Role on team"));
    fireEvent.dragStart(th("Site"));
    fireEvent.dragOver(th("Role on team"));
    fireEvent.drop(th("Role on team"));
    fireEvent.dragStart(th("Site"));
    fireEvent.drop(th("Site"));
    await vi.waitFor(() => {
      expect(moves("f1")).toHaveLength(1);
    });
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

describe("searching, sorting, and filtering", () => {
  const manySites = list(
    "l1",
    "Sites",
    [
      "Harbour",
      "Northmere",
      "Ashby",
      "Bramble",
      "Coldwater",
      "Dunmore",
      "Eastvale",
      "Fernhill",
      "Glenrock",
    ].map((label, index) =>
      choice(
        index === 0 ? "c1" : index === 1 ? "c2" : `s${String(index)}`,
        label,
      ),
    ),
  );

  async function openAt(path: string, answers: Answers = {}) {
    const fetch = serverAnswers({
      "GET /api/session": editor,
      "GET /api/people": peopleAnswer,
      "GET /api/lists": listsAnswer,
      ...answers,
    });
    const history = renderApp(path);
    await screen.findByRole("grid", { name: "People" });
    return { fetch, history };
  }

  // The names of the people shown, in order.
  const shownNames = () =>
    screen
      .getAllByRole("row")
      .filter(
        (row) =>
          row.querySelector('[id$="-preferredName"]') &&
          !row.getAttribute("aria-label"),
      )
      .map((row) => inRow(row, "Name").textContent);

  // A column's header, whatever its sort and filter.
  const header = (label: string) =>
    screen.getByRole("button", {
      name: (name) => name.startsWith(`${label} column`),
    });

  // Chooses an item from a column's menu, then waits for the menu to finish closing.
  async function choose(label: string, item: string | RegExp) {
    await userEvent.click(header(label));
    await userEvent.click(await screen.findByRole("menuitem", { name: item }));
    await vi.waitFor(() => {
      expect(screen.queryByRole("menu")).toBeNull();
    });
  }

  const address = (history: ReturnType<typeof renderApp>) =>
    decodeURIComponent(history.location.search);

  it("searches every column from the search field, which Cmd+F focuses and Esc clears", async () => {
    const { history } = await openAt("/people");
    focusCell("p1", "employeeId");
    await userEvent.keyboard("{Control>}f{/Control}");
    const search = screen.getByRole("textbox", { name: "Search people" });
    expect(document.activeElement).toBe(search);
    await userEvent.keyboard("northmere");
    expect(shownNames()).toEqual([]);
    expect(screen.getByText("No matching people")).toBeDefined();
    await userEvent.clear(search);
    await userEvent.type(search, "team lead");
    expect(shownNames()).toEqual(["Avery Fictional"]);
    expect(screen.getByText("1 of 2")).toBeDefined();
    expect(history.location.search).toBe("?search=team+lead");
    await userEvent.keyboard("{Escape}");
    expect(shownNames()).toEqual(["Avery Fictional", "Blake Fictional"]);
    expect(history.location.search).toBe("");
    await userEvent.keyboard("{Escape}");
    expect(document.activeElement).toBe(cell("p1", "employeeId"));
    await userEvent.keyboard("{Control>}{Alt>}f{/Alt}{/Control}");
    await userEvent.keyboard("{Meta>}f{/Meta}");
    expect(document.activeElement).toBe(cell("p1", "employeeId"));
  });

  it("takes Cmd+F on a Mac, and leaves it alone in a dialog", async () => {
    const agent = vi
      .spyOn(navigator, "userAgent", "get")
      .mockReturnValue("Mozilla/5.0 (Macintosh)");
    await openAt("/people");
    const search = screen.getByRole("textbox", { name: "Search people" });
    focusCell("p1", "employeeId");
    await userEvent.keyboard("{Control>}f{/Control}");
    expect(document.activeElement).toBe(cell("p1", "employeeId"));
    await userEvent.click(screen.getByRole("button", { name: "New column" }));
    const dialog = await screen.findByRole("dialog");
    await userEvent.keyboard("{Meta>}f{/Meta}");
    expect(dialog.contains(document.activeElement)).toBe(true);
    await userEvent.keyboard("{Escape}");
    await vi.waitFor(() => {
      expect(screen.queryByRole("dialog")).toBeNull();
    });
    await userEvent.keyboard("{Meta>}f{/Meta}");
    expect(document.activeElement).toBe(search);
    agent.mockRestore();
  });

  it("keeps every character typed quickly, and Back undoes a whole search", async () => {
    const { history } = await openAt('/people?sort=["f1"]');
    const search = screen.getByRole("textbox", { name: "Search people" });
    act(() => {
      search.focus();
    });
    fireEvent.change(search, { target: { value: "a" } });
    fireEvent.change(search, { target: { value: "av" } });
    fireEvent.change(search, { target: { value: "ave" } });
    await vi.waitFor(() => {
      expect(history.location.search).toContain("search=ave");
    });
    expect(search).toHaveProperty("value", "ave");
    await vi.waitFor(() => {
      expect(shownNames()).toEqual(["Avery Fictional"]);
    });
    history.back();
    await vi.waitFor(() => {
      expect(search).toHaveProperty("value", "");
    });
    expect(history.location.search).toContain("sort=");
    // Typing again after Back adds to history rather than replacing where Back went.
    await userEvent.type(search, "b");
    history.back();
    await vi.waitFor(() => {
      expect(search).toHaveProperty("value", "");
    });
    expect(history.location.search).toContain("sort=");
  });

  it("keeps people the user adds, even when they do not match", async () => {
    let answer = peopleAnswer;
    await openAt('/people?filters={"f1":{"any":["c1"]}}', {
      "GET /api/people": () => answer(),
      "POST /api/people": () => {
        answer = () =>
          Response.json({
            people: [
              avery,
              blake,
              {
                ...blake,
                id: "p9",
                preferredName: "Casey Fictional",
                employeeId: "E9",
                values: { f1: ["c2"] },
              },
            ],
            fields: [site, role],
            order,
          });
        return Response.json({ ids: ["p9"], changeSetId: s1 }, { status: 201 });
      },
    });
    act(() => {
      cell("new-0", "preferredName").focus();
    });
    await userEvent.keyboard("Casey{Tab}E9{Tab}north{Tab}");
    await userEvent.keyboard("{Escape}{Enter}");
    await vi.waitFor(() => {
      expect(shownNames()).toEqual(["Avery Fictional", "Casey Fictional"]);
    });
  });

  it("sorts by each column chosen in turn, naming each level above the table", async () => {
    const { history } = await openAt("/people");
    await choose("Site", "List order");
    expect(shownNames()).toEqual(["Avery Fictional", "Blake Fictional"]);
    await choose("Name", "Sort Z to A");
    expect(shownNames()).toEqual(["Avery Fictional", "Blake Fictional"]);
    expect(
      screen.getByRole("button", {
        name: "Name column, sorted descending, level 2",
      }),
    ).toBeDefined();
    expect(header("Site").closest("th")?.getAttribute("aria-sort")).toBe(
      "ascending",
    );
    expect(header("Name").closest("th")?.getAttribute("aria-sort")).toBeNull();

    // Choosing a sort on a sorted column changes its direction in place.
    await choose("Site", "Reverse list order");
    expect(shownNames()).toEqual(["Blake Fictional", "Avery Fictional"]);
    expect(address(history)).toContain('sort=["-f1","-preferredName"]');
    expect(screen.getByText("Site ↓")).toBeDefined();
    expect(screen.getByText("Name ↓")).toBeDefined();

    await userEvent.click(
      screen.getByRole("button", { name: "Remove sort on Site" }),
    );
    expect(address(history)).toContain('sort=["-preferredName"]');
    expect(
      screen.getByRole("button", { name: "Name column, sorted descending" }),
    ).toBeDefined();

    await choose("Start", "Oldest first");
    await choose("Start", "Clear sort");
    expect(address(history)).not.toContain("startDate");
    history.back();
    await vi.waitFor(() => {
      expect(address(history)).toContain("startDate");
    });
    await userEvent.click(screen.getByRole("button", { name: "Clear all" }));
    expect(history.location.search).toBe("");
  });

  it("filters a choice column, naming the filter above the table until it is removed", async () => {
    const { history } = await openAt("/people");
    await choose("Site", "Filter…");
    const dialog = await screen.findByRole("dialog", { name: "Filter Site" });
    expect(
      within(dialog)
        .getAllByRole("checkbox")
        .map((box) => (box as HTMLInputElement).labels?.[0]?.textContent),
    ).toEqual(["Harbour", "Northmere", "Empty", "Old Mill"]);
    await userEvent.click(
      within(dialog).getByRole("checkbox", { name: "Northmere" }),
    );
    await userEvent.click(
      within(dialog).getByRole("checkbox", { name: "Harbour" }),
    );
    expect(shownNames()).toEqual(["Avery Fictional"]);
    await userEvent.click(
      within(dialog).getByRole("checkbox", { name: "Northmere" }),
    );
    await userEvent.keyboard("{Escape}");
    expect(screen.getByText("Site: Harbour")).toBeDefined();
    await choose("Site", "Clear filter");
    expect(shownNames()).toEqual(["Avery Fictional", "Blake Fictional"]);
    history.back();
    await vi.waitFor(() => {
      expect(screen.getByText("Site: Harbour")).toBeDefined();
    });
    expect(
      screen.getByRole("button", { name: "Site column, filtered" }),
    ).toBeDefined();
    expect(address(history)).toContain('filters={"f1":{"any":["c1"]}}');
    history.back();
    await vi.waitFor(() => {
      expect(shownNames()).toEqual(["Avery Fictional", "Blake Fictional"]);
    });
    history.forward();
    await vi.waitFor(() => {
      expect(shownNames()).toEqual(["Avery Fictional"]);
    });
    await choose("Site", "Filter…");
    const again = await screen.findByRole("dialog", { name: "Filter Site" });
    await userEvent.click(
      within(again).getByRole("checkbox", { name: "Empty" }),
    );
    expect(screen.getByText("Site: Harbour, Empty")).toBeDefined();
    await userEvent.click(
      within(again).getByRole("checkbox", { name: "Empty" }),
    );
    await userEvent.click(
      within(again).getByRole("checkbox", { name: "Harbour" }),
    );
    expect(shownNames()).toEqual(["Avery Fictional", "Blake Fictional"]);
    await userEvent.click(
      within(again).getByRole("checkbox", { name: "Old Mill" }),
    );
    await userEvent.keyboard("{Escape}");
    await userEvent.click(
      screen.getByRole("button", { name: "Remove filter on Site" }),
    );
    expect(shownNames()).toEqual(["Avery Fictional", "Blake Fictional"]);
    expect(screen.queryByText("Clear all")).toBeNull();
  });

  it("narrows a long list of choices by typing", async () => {
    await openAt("/people", {
      "GET /api/lists": () => Response.json({ lists: [manySites, roles] }),
    });
    await choose("Site", "Filter…");
    const dialog = await screen.findByRole("dialog", { name: "Filter Site" });
    const narrow = within(dialog).getByRole("textbox", {
      name: "Narrow Site choices",
    });
    await userEvent.type(narrow, "dun");
    expect(within(dialog).getAllByRole("checkbox")).toHaveLength(2);
    await userEvent.click(
      within(dialog).getByRole("button", { name: "Clear" }),
    );
    expect(within(dialog).getAllByRole("checkbox")).toHaveLength(10);
  });

  it("filters text", async () => {
    const { history } = await openAt("/people");
    await choose("Name", "Filter…");
    const name = await screen.findByRole("dialog", { name: "Filter Name" });
    await userEvent.type(
      within(name).getByRole("textbox", { name: "Contains" }),
      "blake",
    );
    await userEvent.click(
      within(name).getByRole("checkbox", { name: "Empty" }),
    );
    expect(screen.getByText("Name contains “blake” or empty")).toBeDefined();
    await userEvent.click(
      within(name).getByRole("checkbox", { name: "Empty" }),
    );
    await userEvent.clear(
      within(name).getByRole("textbox", { name: "Contains" }),
    );
    expect(history.location.search).toBe("");
    await userEvent.type(
      within(name).getByRole("textbox", { name: "Contains" }),
      "blake",
    );
    await userEvent.keyboard("{Escape}");
    expect(shownNames()).toEqual(["Blake Fictional"]);
  });

  it("filters dates, and clears everything at once", async () => {
    await openAt('/people?filters={"preferredName":{"contains":"blake"}}');
    await choose("Start", "Filter…");
    const start = await screen.findByRole("dialog", { name: "Filter Start" });
    const from = within(start).getByRole("textbox", { name: "From" });
    const to = within(start).getByRole("textbox", { name: "To" });
    await userEvent.type(from, "2024-01");
    expect(
      within(start).getByText("Use a date such as 2026-10-31"),
    ).toBeDefined();
    await userEvent.type(from, "-01");
    expect(screen.getByText(/^Start: from /)).toBeDefined();
    await userEvent.type(to, "2024-12-31");
    expect(screen.getByText(/^Start: .+ to .+2024$/)).toBeDefined();
    await userEvent.clear(to);
    await userEvent.type(to, "2023-12-31");
    expect(within(start).getByText("Before From")).toBeDefined();
    await userEvent.clear(from);
    expect(screen.getByText(/^Start: until /)).toBeDefined();
    await userEvent.clear(to);
    await userEvent.click(
      within(start).getByRole("checkbox", { name: "No date" }),
    );
    expect(screen.getByText("Start: no date")).toBeDefined();
    expect(shownNames()).toEqual(["Blake Fictional"]);
    await userEvent.keyboard("{Escape}");

    await userEvent.click(screen.getByRole("button", { name: "Clear all" }));
    expect(shownNames()).toEqual(["Avery Fictional", "Blake Fictional"]);
  });

  it("keeps an edited row in place until the view changes", async () => {
    let answer = peopleAnswer;
    await openAt('/people?filters={"f1":{"any":["c1"]}}', {
      "GET /api/people": () => answer(),
      "PATCH /api/people/p1": () => {
        answer = () =>
          Response.json({
            people: [{ ...avery, values: { f1: ["c2"] } }, blake],
            fields: [site, role],
            order,
          });
        return savedAs()();
      },
    });
    expect(shownNames()).toEqual(["Avery Fictional"]);
    focusCell("p1", "f1");
    await userEvent.keyboard("{Enter}");
    await pick("Northmere");
    expect(shownNames()).toEqual(["Avery Fictional"]);
    await choose("Name", "Sort A to Z");
    expect(shownNames()).toEqual([]);
    await userEvent.click(screen.getByRole("button", { name: "Clear all" }));
    expect(shownNames()).toEqual(["Avery Fictional", "Blake Fictional"]);
  });

  it("lets viewers sort and filter, ignoring columns they may not see", async () => {
    serverAnswers({
      "GET /api/session": viewer,
      "GET /api/people": () =>
        Response.json({
          people: [
            {
              ...avery,
              startDate: undefined,
              endDate: undefined,
              values: { f1: ["c1"] },
            },
            { ...blake, startDate: undefined, endDate: undefined },
          ],
          fields: [site],
          order,
        }),
      "GET /api/lists": listsAnswer,
    });
    const history = renderApp(
      '/people?filters={"f2":{"any":["r1"]},"startDate":{"empty":true}}&sort=["-startDate"]',
    );
    await screen.findByRole("grid", { name: "People" });
    expect(shownNames()).toEqual(["Avery Fictional", "Blake Fictional"]);
    expect(screen.queryByText("Clear all")).toBeNull();
    await userEvent.click(header("Name"));
    const sort = await screen.findByRole("menuitem", { name: "Sort Z to A" });
    expect(screen.queryByRole("menuitem", { name: "Edit column" })).toBeNull();
    expect(screen.queryByRole("menuitem", { name: /^Move left/ })).toBeNull();
    await userEvent.click(sort);
    expect(shownNames()).toEqual(["Blake Fictional", "Avery Fictional"]);
    // Changing the view leaves out what the viewer may not see.
    expect(decodeURIComponent(history.location.search)).toBe(
      '?sort=["-preferredName"]',
    );
    act(() => {
      header("Name").focus();
    });
    await userEvent.keyboard("{Alt>}{ArrowRight}{/Alt}");
    await userEvent.type(
      screen.getByRole("textbox", { name: "Search people" }),
      "nobody",
    );
    expect(screen.getByText("No matching people").closest("td")?.colSpan).toBe(
      3,
    );
    expect(
      within(screen.getByRole("grid"))
        .getAllByRole("columnheader")
        .map((th) => th.textContent),
    ).toEqual(["Name", "Employee ID", "Site"]);
  });
});
