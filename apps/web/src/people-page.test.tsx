// SPDX-License-Identifier: Apache-2.0

// Tests for the People page, with the server's responses simulated: who sees it and what they see;
// moving around the table and editing people's details from the keyboard; adding people in the new
// rows and by pasting; deleting people; adding, changing, moving, and deleting columns; and Undo
// and the server's refusals throughout. Helpers that need no page are tested in
// people-grid.test.ts.

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
  greeting,
  renderApp,
  serverAnswers,
  wholeText,
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
const hiringEditor = session([
  "configuration:view",
  "hiring-plan:edit",
  "hiring-plan:view",
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
// The built-in Positions list.
const positions = {
  ...list("positions", "Positions", [
    choice("position-1", "Engineer"),
    choice("position-2", "Tester"),
    // Drafted to be added, so not yet offered as a position.
    {
      ...choice("position-3", "Technician"),
      draft: {
        action: "created",
        changed: ["label"],
        live: {},
        state: "waiting",
        madeBy: null,
        madeAt: null,
      },
    },
  ]),
  builtIn: "positions",
};
const listsAnswer = () =>
  Response.json({ lists: [sites, roles, old, positions] });
// The built-in hiring states list, with a state of each meaning.
const states = {
  ...list("states", "Hiring states", [
    { ...choice("s-proposed", "Request to hire"), meaning: "proposed" },
    { ...choice("s-open", "Approved to hire"), meaning: "open" },
    { ...choice("s-hired", "Hired"), meaning: "hired" },
    { ...choice("s-left", "Fictional Resigned"), meaning: "left" },
  ]),
  builtIn: "hiring-states",
};

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
  positionId: "position-1",
  startDate: "2024-03-01",
  endDate: null,
  values: { f1: ["c1"], f2: ["r1", "r2"] },
};
const blake = {
  id: "p2",
  preferredName: "Blake Fictional",
  employeeId: "E2",
  positionId: "position-1",
  startDate: null,
  endDate: null,
  values: { f1: ["c3"] },
};
const order = [
  "preferredName",
  "employeeId",
  "positionId",
  "f1",
  "f2",
  "startDate",
  "endDate",
  "managerId",
  "managerFrom",
  "team",
  "teamName",
];
const peopleAnswer = () =>
  Response.json({
    people: [avery, blake],
    fields: [site, role],
    order,
    views: [],
  });
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
  ["ID", "employeeId"],
  ["Position", "positionId"],
  ["State", "stateId"],
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
          views: [],
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
      name: "New",
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
          views: [],
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
    expect(screen.queryByRole("button", { name: "New" })).toBeNull();
    expect(screen.queryByRole("row", { name: "New person" })).toBeNull();
    focusCell("p1", "preferredName");
    await userEvent.keyboard("{Enter}x");
    await userEvent.dblClick(cell("p1", "preferredName"));
    expect(within(screen.getByRole("grid")).queryByRole("textbox")).toBeNull();
    await userEvent.keyboard("{Shift>}{F10}{/Shift}");
    await screen.findByRole("menuitem", { name: "Show details" });
    expect(
      screen.getAllByRole("menuitem").map(({ textContent }) => textContent),
    ).toEqual(["Show details"]);
  });

  it("makes adding a person the main action for those who may, and otherwise adding a column", async () => {
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
    expect(screen.queryByRole("button", { name: "New" })).toBeNull();
    expect(
      screen
        .getByRole("button", { name: "New column" })
        .getAttribute("data-variant"),
    ).toBe("filled");
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
    answer = () =>
      Response.json({ people: [], fields: [], order: [], views: [] });
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
            views: [],
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
    await userEvent.keyboard("Casey{Tab}E9{Tab}eng{Tab}har{Tab}{Tab}");
    const start = await screen.findByLabelText("Start", { selector: "input" });
    fireEvent.change(start, { target: { value: "2026-11-02" } });
    await userEvent.type(start, "{Enter}");
    expect(bodyOf(fetch, "POST", "/api/people")).toEqual([
      {
        people: [
          {
            preferredName: "Casey",
            employeeId: "E9",
            positionId: "position-1",
            startDate: "2026-11-02",
            endDate: null,
            values: { f1: ["c1"], f2: [] },
            links: {},
          },
        ],
      },
    ]);
    await waitFor(() => {
      expect(newCell("Name").textContent).toBe("");
    });
    await settle();
    await userEvent.keyboard("{Meta>}z{/Meta}");
    await waitFor(() => {
      expect(undone(fetch)).toEqual([s1]);
    });
  });

  it("adds from the new row, marks it until saved, and shows who was added at once", async () => {
    // The server answers adding only when the test lets it, so what shows before is seen.
    let answer: (response: Response) => void = () => undefined;
    let saved = false;
    const casey = {
      ...avery,
      id: "p9",
      preferredName: "Casey",
      employeeId: "E9",
      positionId: "position-1",
      values: { f1: ["c1"] },
      draft: draftOf({ action: "created" }),
    };
    const fetch = await openPeople({
      "POST /api/people": () =>
        new Promise<Response>((resolve) => {
          answer = resolve;
        }),
      "GET /api/people": () =>
        Response.json({
          people: saved ? [avery, blake, casey] : [avery, blake],
          fields: [site, role],
          order,
          views: [],
        }),
    });
    // Adding is the page's main action, beside adding a column.
    expect(
      screen.getByRole("button", { name: "New" }).getAttribute("data-variant"),
    ).toBe("filled");
    expect(
      screen
        .getByRole("button", { name: "New column" })
        .getAttribute("data-variant"),
    ).toBe("default");
    act(() => {
      newCell("Name").focus();
    });
    expect(newRow().textContent).not.toContain("not saved yet");
    await userEvent.keyboard("Casey{Tab}E9{Tab}");
    await waitFor(() => {
      expect(newCell("Name").textContent).toBe(
        "Casey New, not saved yet: Position, Site needed",
      );
    });
    await userEvent.keyboard("eng{Tab}har{Tab}");
    await waitFor(() => {
      expect(newCell("Name").textContent).toBe("Casey New, not saved yet");
    });
    await userEvent.keyboard("{Escape}{Enter}");
    // Shown at once, as a draft adding them, which cannot be changed until saved.
    const added = await screen.findByText("Draft: added");
    const row = added.closest("tr") as HTMLElement;
    expect(inRow(row, "Name").textContent).toContain("Casey");
    expect(inRow(row, "ID").getAttribute("aria-readonly")).toBe("true");
    expect(newCell("Name").textContent).toBe("");
    // Their Employee ID is taken already.
    await userEvent.keyboard("Dee{Tab}E9{Tab}eng{Tab}har{Tab}");
    await userEvent.keyboard("{Escape}{Enter}");
    expect(await screen.findByRole("alert")).toHaveProperty(
      "textContent",
      "Someone already has that ID",
    );
    // Nothing changes them, from typing, Delete, or a menu.
    act(() => {
      inRow(row, "Name").focus();
    });
    await userEvent.keyboard("x{Delete}");
    expect(within(row).queryByRole("textbox")).toBeNull();
    // A menu shows a frame after it opens, too late to check it stays shut, so look for its button.
    expect(
      within(row).queryByRole("button", { name: /^Actions for/ }),
    ).toBeNull();
    expect(inRow(row, "Name").textContent).toContain("Casey");
    // Once saved, they keep their place and focus, under their own identifier, and can be changed.
    saved = true;
    answer(Response.json({ ids: ["p9"], changeSetId: s1 }, { status: 201 }));
    await waitFor(() => {
      expect(
        fetch.mock.calls.filter(([url]) => url === "/api/people"),
      ).toHaveLength(2);
    });
    await waitFor(() => {
      expect(inRow(row, "ID").getAttribute("aria-readonly")).toBeNull();
    });
    expect(document.activeElement).toBe(inRow(row, "Name"));
    expect(row.isConnected).toBe(true);
  });

  it("gives back who could not be added, keeping what was typed since", async () => {
    let answer: (response: Response) => void = () => undefined;
    await openPeople({
      "POST /api/people": () =>
        new Promise<Response>((resolve) => {
          answer = resolve;
        }),
    });
    act(() => {
      newCell("Name").focus();
    });
    await userEvent.keyboard("Casey{Tab}E9{Tab}eng{Tab}har{Tab}");
    await userEvent.keyboard("{Escape}{Enter}");
    expect(await screen.findByText("Draft: added")).toBeDefined();
    await userEvent.keyboard("Dee{Tab}{Escape}");
    answer(Response.json({ error: "Fictional failure" }, { status: 500 }));
    expect(
      await screen.findByText(
        "Fathom could not add the person. Try again in a moment.",
      ),
    ).toBeDefined();
    expect(screen.queryByText("Draft: added")).toBeNull();
    const rows = screen.getAllByRole("row", { name: "New person" });
    expect(rows.map((row) => inRow(row, "Name").textContent)).toEqual([
      "Casey New, not saved yet",
      "Dee New, not saved yet: ID, Position, Site needed",
    ]);
  });

  it("offers New only once the people and lists have loaded", async () => {
    serverAnswers({
      "GET /api/session": editor,
      "GET /api/people": peopleAnswer,
      "GET /api/lists": () => new Promise<Response>(() => undefined),
    });
    renderApp("/people");
    const button = await screen.findByRole("button", { name: "New" });
    expect(button).toHaveProperty("disabled", true);
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
      "ID needed",
    );
    act(() => {
      newCell("ID").focus();
    });
    await userEvent.keyboard("E2{Enter}");
    // An Employee ID someone already has is named before what is still needed.
    expect(await screen.findByRole("alert")).toHaveProperty(
      "textContent",
      "Someone already has that ID",
    );
    act(() => {
      newCell("ID").focus();
    });
    await userEvent.keyboard("{Delete}E7{Enter}");
    expect(await screen.findByRole("alert")).toHaveProperty(
      "textContent",
      "Position needed",
    );
    act(() => {
      newCell("Position").focus();
    });
    await userEvent.keyboard("eng{Enter}");
    expect(await screen.findByRole("alert")).toHaveProperty(
      "textContent",
      "Site needed",
    );
    expect(bodyOf(fetch, "POST", "/api/people")).toEqual([]);
    act(() => {
      newCell("Site").focus();
    });
    await userEvent.keyboard("nor{Enter}");
    expect(bodyOf(fetch, "POST", "/api/people")).toHaveLength(1);
  });

  it("does nothing with Enter on an empty new row, and Esc keeps what was typed out", async () => {
    const fetch = await openPeople();
    const rows = screen.getAllByRole("row", { name: "New person" });
    expect(rows).toHaveLength(1);
    act(() => {
      newCell("ID").focus();
    });
    await userEvent.keyboard("{F2}");
    await userEvent.type(
      screen.getByRole("textbox", { name: "ID" }),
      "E5{Escape}",
    );
    expect(newCell("ID").textContent).toBe("");
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
      "Dana Fictional\tE10\tengineer\tharbour\tTeam Lead\n\nEli Fictional\tE11\tEngineer\tNorthmere\t\t2025-02-01\n",
    );
    expect(bodyOf(fetch, "POST", "/api/people")).toEqual([
      {
        people: [
          {
            preferredName: "Dana Fictional",
            employeeId: "E10",
            positionId: "position-1",
            startDate: null,
            endDate: null,
            values: { f1: ["c1"], f2: ["r1"] },
            links: {},
          },
          {
            preferredName: "Eli Fictional",
            employeeId: "E11",
            positionId: "position-1",
            startDate: "2025-02-01",
            endDate: null,
            values: { f1: ["c2"], f2: [] },
            links: {},
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
      newCell("ID"),
      "E21\tEngineer\tOld Mill\nE22\tEngineer\tAtlantis\tTeam Lead\textra\textra\textra\textra",
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
    await waitFor(() => {
      expect(document.activeElement).toBe(rows[0]?.querySelector("td"));
    });
    // Pasting again keeps the rows that would not do.
    const last = screen.getAllByRole("row", { name: "New person" }).at(-1);
    await paste(
      inRow(last as HTMLElement, "Name"),
      "Iris Fictional\tE23\tEngineer\tHarbour",
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
    await paste(newCell("Name"), "Fay Fictional\tE30\tEngineer\tHarbour");
    expect(
      await screen.findByText(
        "Fathom could not add the person. Try again in a moment.",
      ),
    ).toBeDefined();
    await waitFor(() => {
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

  it("changes a person's position, picked from the Positions list", async () => {
    const fetch = await openPeople({ "PATCH /api/people/p2": savedAs() });
    focusCell("p2", "positionId");
    await userEvent.keyboard("te");
    expect(await offeredOptions()).toEqual(["Tester"]);
    await userEvent.keyboard("s");
    await userEvent.keyboard("{Enter}");
    expect(bodyOf(fetch, "PATCH", "/api/people/p2")).toEqual([
      { positionId: "position-2" },
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
      "Gale Fictional\tE40\tEngineer\tHarbour\t\t31/10/2026",
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

// A draft made by a fictional editor.
// The Draft menu above the table, opened once no other menu is.
async function openDraftMenu() {
  await waitFor(() => {
    expect(screen.queryByRole("menu")).toBeNull();
  });
  await userEvent.click(screen.getByRole("button", { name: /^Draft/ }));
  return screen.findByRole("menu");
}

async function chooseInDraftMenu(item: string | RegExp) {
  await userEvent.click(
    within(await openDraftMenu()).getByRole("menuitem", { name: item }),
  );
}

const draftOf = (draft: object) => ({
  changed: [],
  live: { values: {} },
  state: "waiting",
  madeBy: "Fictional Editor",
  madeAt: "2026-10-30T15:00:00.000Z",
  ...draft,
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
          views: [],
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
              preferredName: "Casey Fictional",
              employeeId: "E3",
              positionId: "position-1",
              draft: draftOf({ action: "deleted", state: "rejected" }),
            },
          ],
          fields: [site, role],
          order,
          views: [],
        }),
    });
    expect(cell("p1", "f1").textContent).toBe("Harbour, draft, live Northmere");
    expect(cell("p1", "positionId").textContent).toBe(
      "Engineer, draft, live Tester",
    );
    expect(cell("p1", "startDate").textContent).toBe(
      "Mar 1, 2024, draft, live empty",
    );
    expect(cell("p1", "f2").textContent).toContain(", draft, live empty");
    expect(cell("p1", "employeeId").textContent).toBe("E1");
    // Under the draft row, the person as they are live, which only sighted users need.
    const liveRow = cell("p1", "f1").closest("tr")?.nextElementSibling;
    expect(liveRow?.getAttribute("aria-hidden")).toBe("true");
    expect(
      [...(liveRow?.querySelectorAll("td") ?? [])].map(
        ({ textContent }) => textContent,
      ),
    ).toEqual([
      "Avery Fictional Live",
      "E1",
      "Tester",
      "Northmere",
      "",
      "",
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
    expect(cell("p1", "preferredName").textContent).toContain("Draft");
    expect(cell("p2", "f1").textContent).toBe("Old Mill, draft");
    expect(cell("p2", "preferredName").textContent).toContain(
      "Rejected: Fictional reason",
    );
    expect(cell("p3", "preferredName").textContent).toContain("Rejected");
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
    ).toEqual(["Show details", "Resubmit", "Discard draft"]);
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
        "releases:approve",
        "people:approve",
        "hiring-plan:approve",
        "configuration:approve",
        "people:view",
        "restricted:view",
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
          views: [],
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
    await userEvent.click(
      screen.getByRole("button", { name: "Actions for Casey Fictional" }),
    );
    expect(await screen.findByText("Reason: Fictional reason")).toBeDefined();
    expect(
      screen.queryAllByRole("menuitem").map(({ textContent }) => textContent),
    ).toEqual(["Show details"]);
    await userEvent.keyboard("{Escape}");
    await waitFor(() => {
      expect(screen.queryByRole("menu")).toBeNull();
    });
    await userEvent.click(
      screen.getByRole("button", { name: "Actions for Avery Fictional" }),
    );
    expect(
      (await screen.findAllByRole("menuitem")).map(
        ({ textContent }) => textContent,
      ),
    ).toEqual(["Show details", "Approve draft", "Reject draft…"]);
    await userEvent.click(
      screen.getByRole("menuitem", { name: "Approve draft" }),
    );
    const one = await screen.findByRole("dialog", { name: "Approve 1 draft?" });
    await userEvent.click(within(one).getByRole("button", { name: "Approve" }));
    expect(await screen.findByText("Approved 1 draft.")).toBeDefined();
    // Rejecting one asks for a reason too, and can be cancelled.
    await userEvent.click(
      screen.getByRole("button", { name: "Actions for Avery Fictional" }),
    );
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
        "releases:approve",
        "people:approve",
        "hiring-plan:approve",
        "configuration:approve",
        "people:edit",
        "people:view",
        "restricted:edit",
        "restricted:view",
      ]),
      "GET /api/people": () =>
        Response.json({
          people: [avery, { ...blake, draft: draftOf({ action: "created" }) }],
          fields: [site, role],
          order,
          views: [],
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
          views: [],
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
          views: [],
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
          views: [],
        }),
      "DELETE /api/people/p2/draft": savedAs(),
    });
    focusCell("p2", "employeeId");
    await userEvent.keyboard("{Shift>}{F10}{/Shift}");
    expect(
      (await screen.findAllByRole("menuitem")).map(
        ({ textContent }) => textContent,
      ),
    ).toEqual(["Show details", "Discard draft"]);
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
    ).toEqual(["", "Sites", "Roles on the team (Restricted)", "Positions"]);
    await userEvent.selectOptions(listSelect, "Sites");
    await userEvent.click(within(dialog).getByLabelText("Several choices"));
    await userEvent.click(within(dialog).getByLabelText("Must be filled in"));
    await userEvent.click(within(dialog).getByLabelText("Must be filled in"));
    expect(
      within(dialog).getByText("Planned hires can leave it empty"),
    ).toBeDefined();
    const onHires = within(dialog).getByLabelText("Offered on planned hires");
    expect((onHires as HTMLInputElement).checked).toBe(true);
    await userEvent.click(onHires);
    expect(within(dialog).queryByText("Planned hires can leave it empty")).toBe(
      null,
    );
    await userEvent.click(
      within(dialog).getByRole("button", { name: "Add column" }),
    );
    expect(bodyOf(fetch, "POST", "/api/people/columns")).toEqual([
      {
        name: "Office",
        type: "choice",
        listId: "l1",
        multiple: true,
        required: false,
        onPlannedHires: false,
      },
    ]);
    await settle();
    await userEvent.keyboard("{Meta>}z{/Meta}");
    await waitFor(() => {
      expect(undone(fetch)).toEqual([s1]);
    });
  });

  it("offers lists drafted to be added, marked new, and not those drafted to be removed", async () => {
    const draft = (action: string) => ({
      state: "waiting",
      madeBy: "Fictional Editor",
      madeAt: "2026-10-30T15:00:00.000Z",
      action,
      changed: [],
      live: {},
    });
    await openPeople({
      "GET /api/lists": () =>
        Response.json({
          lists: [
            { ...sites, draft: draft("changed") },
            { ...list("l4", "Guilds", []), draft: draft("created") },
            {
              ...list("l5", "Chapters", []),
              visibility: "confidential",
              draft: draft("created"),
            },
            { ...list("l6", "Gone", []), draft: draft("deleted") },
          ],
        }),
    });
    const dialog = await newColumnDialog();
    expect(
      within(within(dialog).getByRole("combobox", { name: "List" }))
        .getAllByRole("option")
        .map((option) => option.textContent),
    ).toEqual(["", "Sites", "Guilds (new)", "Chapters (new, Confidential)"]);
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
    await waitFor(() => {
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
      {
        name: "Roles",
        type: "choice",
        listId: "l2",
        multiple: true,
        required: false,
        onPlannedHires: true,
      },
    ]);
    // The simulated server still answers with the old name once the change has saved.
    await userEvent.click(
      await screen.findByRole("button", { name: "Role on team column" }),
    );
    await userEvent.click(
      within(
        await screen.findByRole("menu", { name: /^Role on team column/ }),
      ).getByRole("menuitem", { name: "Edit column" }),
    );
    dialog = await screen.findByRole("dialog", { name: "Edit column" });
    await userEvent.click(
      within(dialog).getByRole("button", { name: "Delete column" }),
    );
    expect(
      await screen.findByText("Deleted the Role on team column."),
    ).toBeDefined();
    await userEvent.click(screen.getByRole("button", { name: "Undo" }));
    await waitFor(() => {
      expect(undone(fetch)).toEqual([s1]);
    });
  });

  it("moves any column from its menu, with Alt and the arrow keys, and by dragging, but not past either end", async () => {
    await openPeople();
    const header = (label: string) =>
      screen.getByRole("button", { name: `${label} column` });
    const labels = () =>
      screen
        .getAllByRole("button", { name: / column$/ })
        .map((button) => button.getAttribute("aria-label"));
    const place = (label: string) => labels().indexOf(`${label} column`);

    // Given the Role on team column somewhere after the first
    const rolePlace = place("Role on team");
    await userEvent.click(header("Role on team"));
    await userEvent.click(
      await screen.findByRole("menuitem", { name: /^Move left/ }),
    );
    await waitFor(() => {
      expect(place("Role on team")).toBe(rolePlace - 1);
      expect(screen.queryByRole("menu")).toBeNull();
    });

    // Built-in columns move too, to the very start, and no further.
    const start = place("Name");
    await settle();
    act(() => {
      header("ID").focus();
    });
    await userEvent.keyboard("{Alt>}{ArrowLeft}{/Alt}");
    await waitFor(() => {
      expect(place("ID")).toBe(start);
    });
    await settle();
    act(() => {
      header("ID").focus();
    });
    await userEvent.keyboard("{Alt>}{ArrowLeft}{/Alt}");
    expect(place("ID")).toBe(start);

    // A column at the end stays there.
    const last = String(labels().at(-1)).replace(/ column$/, "");
    const before = labels();
    await userEvent.click(header(last));
    await userEvent.click(
      within(await screen.findByRole("menu")).getByRole("menuitem", {
        name: /^Move right/,
      }),
    );
    expect(labels()).toEqual(before);

    // Dragging onto itself or without starting moves nothing, and onto another moves it.
    const th = (label: string) => header(label).closest("th") as HTMLElement;
    fireEvent.drop(th("Role on team"));
    fireEvent.dragStart(th("Site"));
    fireEvent.drop(th("Site"));
    expect(labels()).toEqual(before);
    fireEvent.dragStart(th("Site"));
    fireEvent.dragOver(th("Role on team"));
    fireEvent.drop(th("Role on team"));
    await waitFor(() => {
      expect(labels()).not.toEqual(before);
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
    await waitFor(() => {
      expect(screen.queryByRole("menu")).toBeNull();
    });
  }

  const viewsButton = () =>
    screen.getByRole("button", { name: (name) => name.startsWith("Views") });

  // Found by name, since a column's menu just used may still be closing.
  async function viewsMenu() {
    await userEvent.click(viewsButton());
    return screen.findByRole("menu", { name: /^Views/ });
  }

  async function viewsMenuItems() {
    return within(await viewsMenu())
      .getAllByRole("menuitem")
      .map((item) => item.textContent);
  }

  // The Views menu's items, headings, and dividers, each divider as "—", to check how it is laid
  // out.
  async function viewsMenuLayout() {
    const menu = await viewsMenu();
    return [
      ...menu.querySelectorAll(
        ".mantine-Menu-item, .mantine-Menu-label, .mantine-Menu-divider",
      ),
    ].map((part) =>
      part.classList.contains("mantine-Menu-divider") ? "—" : part.textContent,
    );
  }

  async function chooseView(item: string | RegExp) {
    await userEvent.click(
      within(await viewsMenu()).getByRole("menuitem", { name: item }),
    );
    await waitFor(() => {
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

  it("clears the search with its clear button, which Back undoes, leaving the field focused", async () => {
    const { history } = await openAt("/people");
    const search = screen.getByRole("textbox", { name: "Search people" });
    expect(screen.queryByRole("button", { name: "Clear search" })).toBeNull();
    await userEvent.type(search, "team lead");
    expect(shownNames()).toEqual(["Avery Fictional"]);
    await userEvent.click(screen.getByRole("button", { name: "Clear search" }));
    expect(shownNames()).toEqual(["Avery Fictional", "Blake Fictional"]);
    expect(history.location.search).toBe("");
    expect(document.activeElement).toBe(search);
    expect(screen.queryByRole("button", { name: "Clear search" })).toBeNull();
    history.back();
    await waitFor(() => {
      expect(history.location.search).toBe("?search=team+lead");
    });
    expect((search as HTMLInputElement).value).toBe("team lead");
    await userEvent.click(search);
    await userEvent.tab();
    expect(document.activeElement).toBe(
      screen.getByRole("button", { name: "Clear search" }),
    );
    await userEvent.keyboard("{Enter}");
    expect((search as HTMLInputElement).value).toBe("");
    expect(document.activeElement).toBe(search);
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
    await waitFor(() => {
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
    await waitFor(() => {
      expect(history.location.search).toContain("search=ave");
    });
    expect(search).toHaveProperty("value", "ave");
    await waitFor(() => {
      expect(shownNames()).toEqual(["Avery Fictional"]);
    });
    history.back();
    await waitFor(() => {
      expect(search).toHaveProperty("value", "");
    });
    expect(history.location.search).toContain("sort=");
    // Typing again after Back adds to history rather than replacing where Back went.
    await userEvent.type(search, "b");
    history.back();
    await waitFor(() => {
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
                positionId: "position-1",
                values: { f1: ["c2"] },
              },
            ],
            fields: [site, role],
            order,
            views: [],
          });
        return Response.json({ ids: ["p9"], changeSetId: s1 }, { status: 201 });
      },
    });
    act(() => {
      cell("new-0", "preferredName").focus();
    });
    await userEvent.keyboard("Casey{Tab}E9{Tab}eng{Tab}north{Tab}");
    await userEvent.keyboard("{Escape}{Enter}");
    await waitFor(() => {
      expect(shownNames()).toEqual(["Avery Fictional", "Casey Fictional"]);
    });
  });

  it("freezes the columns up to one chosen, naming them in the Views menu until reset", async () => {
    const { history } = await openAt("/people");
    const frozen = (label: string) =>
      header(label).closest("th")?.style.left !== "";
    const [first] = screen
      .getAllByRole("columnheader")
      .map((cell) => cell.textContent);
    expect(frozen(String(first))).toBe(true);
    expect(frozen("Site")).toBe(false);

    await choose("Site", "Freeze up to this column");
    expect(frozen("Site")).toBe(true);
    expect(address(history)).toMatch(/frozen=\d/);
    expect(screen.queryByText("Frozen to Site")).toBeNull();
    expect(await viewsMenuLayout()).toEqual([
      "Frozen to Site, reset",
      "—",
      "Clear view",
      "Save view…",
    ]);
    await userEvent.keyboard("{Escape}");
    await userEvent.click(header("Site"));
    const unfreeze = await screen.findByRole("menuitem", {
      name: "Unfreeze columns",
    });
    expect(
      screen.queryByRole("menuitem", { name: "Freeze up to this column" }),
    ).toBeNull();
    await userEvent.click(unfreeze);
    expect(address(history)).toContain("frozen=0");
    expect(frozen(String(first))).toBe(false);
    expect(await viewsMenuItems()).toContain("Unfrozen, reset");
    await userEvent.keyboard("{Escape}");

    await chooseView("Unfrozen, reset");
    expect(history.location.search).toBe("");
    expect(frozen(String(first))).toBe(true);

    await choose("Site", "Freeze up to this column");
    await userEvent.click(screen.getByRole("button", { name: "Clear all" }));
    expect(history.location.search).toBe("");
  });

  it("sorts by each column chosen in turn, naming each level in the Views menu", async () => {
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
    expect(screen.queryByText(/Site ↓/)).toBeNull();
    await choose("Site", "Freeze up to this column");
    expect(await viewsMenuLayout()).toEqual([
      "Sort",
      "Site ↓descending, remove sort",
      "Name ↓descending, remove sort",
      "—",
      "Frozen to Site, reset",
      "—",
      "Clear view",
      "Save view…",
    ]);
    await userEvent.keyboard("{Escape}");

    // From the keyboard too.
    viewsButton().focus();
    await userEvent.keyboard("{Enter}");
    const menu = await screen.findByRole("menu", { name: /^Views/ });
    await userEvent.keyboard("{ArrowDown}");
    await waitFor(() => {
      expect(
        within(menu).getByRole("menuitem", {
          name: "Site descending, remove sort",
        }),
      ).toBe(document.activeElement);
    });
    await userEvent.keyboard("{Enter}");
    expect(address(history)).toContain('sort=["-preferredName"]');
    expect(
      screen.getByRole("button", { name: "Name column, sorted descending" }),
    ).toBeDefined();

    await choose("Start", "Oldest first");
    await choose("Start", "Clear sort");
    expect(address(history)).not.toContain("startDate");
    history.back();
    await waitFor(() => {
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
    await waitFor(() => {
      expect(screen.getByText("Site: Harbour")).toBeDefined();
    });
    expect(
      screen.getByRole("button", { name: "Site column, filtered" }),
    ).toBeDefined();
    expect(address(history)).toContain('filters={"f1":{"any":["c1"]}}');
    history.back();
    await waitFor(() => {
      expect(shownNames()).toEqual(["Avery Fictional", "Blake Fictional"]);
    });
    history.forward();
    await waitFor(() => {
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

  it("filters by draft from the bar above the table, keeping the filter in the address", async () => {
    const { history } = await openAt("/people", {
      "GET /api/people": () =>
        Response.json({
          people: [
            {
              ...avery,
              draft: draftOf({ action: "changed", changed: ["f1"] }),
            },
            blake,
            {
              ...blake,
              id: "p3",
              preferredName: "Casey Fictional",
              employeeId: "E3",
              positionId: "position-1",
              draft: draftOf({ action: "deleted", state: "rejected" }),
            },
          ],
          fields: [site, role],
          order,
          views: [],
        }),
    });
    const names = () =>
      shownNames().map((name) => name.replace(/\s*(Draft|Rejected).*/, ""));
    const button = screen.getByRole("button", { name: "Draft" });
    await userEvent.click(button);
    const item = async (name: string) =>
      screen.findByRole("menuitem", {
        name: (shown) => shown.startsWith(name),
      });
    expect(
      (await screen.findAllByRole("menuitem")).map((one) =>
        one.textContent.replace("✓", ""),
      ),
    ).toEqual([
      "Drafts beside live, on",
      "Drafts applied",
      "Live only",
      "Waiting",
      "Rejected",
      "No draft",
    ]);
    await userEvent.click(await item("Waiting"));
    expect(names()).toEqual(["Avery Fictional"]);
    await userEvent.click(await item("No draft"));
    expect(names()).toEqual(["Avery Fictional", "Blake Fictional"]);
    await userEvent.keyboard("{Escape}");
    await waitFor(() => {
      expect(document.activeElement).toBe(button);
    });
    expect(screen.getByText("Draft: Waiting, No draft")).toBeDefined();
    expect(address(history)).toContain(
      'filters={"draft":{"any":["waiting"],"empty":true}}',
    );
    await userEvent.click(
      screen.getByRole("button", { name: "Remove filter on Draft" }),
    );
    expect(names()).toEqual([
      "Avery Fictional",
      "Blake Fictional",
      "Casey Fictional",
    ]);
    history.push('/people?filters={"draft":{"any":["rejected"]}}');
    await waitFor(() => {
      expect(names()).toEqual(["Casey Fictional"]);
    });
    expect(
      screen.getByRole("button", { name: "Draft, changed" }),
    ).toBeDefined();
    // Drafts are filtered on, but neither searched, since their states are not shown in words, nor
    // sorted on, even from a hand-made address.
    history.push('/people?search=waiting&sort=["draft"]');
    await waitFor(() => {
      expect(screen.getByRole("status").textContent).toBe("0 of 3");
    });
    expect(screen.queryByText("Draft ↑")).toBeNull();
    expect(screen.getByRole("button", { name: "Draft" })).toBeDefined();
  });

  it("shows choices by their live names in live rows and the live people alone", async () => {
    const renamed = {
      ...sites,
      choices: sites.choices.map((one) =>
        (one as { id: string }).id === "c1"
          ? {
              ...one,
              label: "Harbour Drafted",
              draft: {
                action: "changed",
                changed: ["label"],
                live: { label: "Harbour" },
                state: "waiting",
                madeBy: "Fictional Editor",
                madeAt: "2026-10-30T15:00:00.000Z",
              },
            }
          : one,
      ),
    };
    const { history } = await openAt("/people", {
      "GET /api/lists": () => Response.json({ lists: [renamed, roles, old] }),
    });
    expect(screen.getAllByText("Harbour Drafted").length).toBeGreaterThan(0);
    history.push("/people?show=live");
    await waitFor(() => {
      expect(screen.queryByText("Harbour Drafted")).toBeNull();
    });
    expect(screen.getAllByText("Harbour").length).toBeGreaterThan(0);
  });

  it("shows drafts beside live rows, drafts applied, or the live people alone, read only", async () => {
    const { history } = await openAt("/people", {
      "GET /api/people": () =>
        Response.json({
          people: [
            {
              ...avery,
              preferredName: "Avery Drafted",
              draft: draftOf({
                action: "changed",
                changed: ["preferredName"],
                live: { preferredName: "Avery Fictional", values: {} },
              }),
            },
            {
              ...blake,
              id: "p3",
              preferredName: "Casey Fictional",
              employeeId: "E3",
              positionId: "position-1",
              draft: draftOf({ action: "created" }),
            },
          ],
          fields: [site, role],
          order,
          views: [],
        }),
    });
    const liveRows = () => screen.queryAllByText("Live").length;
    await screen.findByText("Avery Drafted");
    expect(liveRows()).toBe(1);
    const choose = async (name: string) => {
      await userEvent.click(screen.getByRole("button", { name: /^Draft/ }));
      await userEvent.click(
        within(await screen.findByRole("menu", { name: /^Draft/ })).getByRole(
          "menuitem",
          { name: (shown) => shown.startsWith(name) },
        ),
      );
      await userEvent.keyboard("{Escape}");
    };
    await choose("Drafts applied");
    await waitFor(() => {
      expect(liveRows()).toBe(0);
    });
    expect(screen.getByText("Avery Drafted")).toBeDefined();
    expect(address(history)).toContain("show=drafts");
    await choose("Live only");
    await waitFor(() => {
      expect(screen.queryByText("Avery Drafted")).toBeNull();
    });
    expect(screen.getByText("Avery Fictional")).toBeDefined();
    expect(screen.queryByText("Casey Fictional")).toBeNull();
    expect(screen.queryByRole("button", { name: "New" })).toBeNull();
    // The live people have no drafts, so a filter on drafts in the address is set aside.
    history.push('/people?show=live&filters={"draft":{"any":["waiting"]}}');
    await waitFor(() => {
      expect(screen.getByText("Avery Fictional")).toBeDefined();
    });
  });

  it("says in a draft's menu what it changes and who changed each field, and closes when its details are clicked", async () => {
    await openAt("/people", {
      "GET /api/people": () =>
        Response.json({
          people: [
            {
              ...avery,
              preferredName: "Avery Drafted",
              employeeId: "E9",
              positionId: "position-1",
              draft: draftOf({
                action: "changed",
                changed: ["preferredName", "employeeId", "f1"],
                live: {
                  preferredName: "Avery Fictional",
                  employeeId: "E1",
                  positionId: "position-1",
                  values: {},
                },
                changedBy: { preferredName: "Ann Fictional", employeeId: null },
              }),
            },
          ],
          fields: [site, role],
          order,
          views: [],
        }),
    });
    await userEvent.click(
      await screen.findByRole("button", { name: "Actions for Avery Drafted" }),
    );
    const line = await screen.findByText(
      wholeText("Name from Avery Fictional to Avery Drafted, by Ann Fictional"),
    );
    expect(
      screen.getByText(wholeText("ID from E1 to E9, by Fathom")),
    ).toBeDefined();
    await userEvent.click(line);
    await waitFor(() => {
      expect(screen.queryByRole("menu")).toBeNull();
    });
  });

  it("turns draft filters off again from the Draft menu", async () => {
    const { history } = await openAt("/people");
    await userEvent.click(screen.getByRole("button", { name: "Draft" }));
    const item = async (name: string) =>
      screen.findByRole("menuitem", {
        name: (shown) => shown.startsWith(name),
      });
    await userEvent.click(await item("No draft"));
    await userEvent.click(await item("Waiting"));
    await userEvent.click(await item("Waiting"));
    await userEvent.click(await item("No draft"));
    await waitFor(() => {
      expect(address(history)).not.toContain("filters");
    });
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
    // A date still being typed is not yet wrong, and filters nothing.
    await userEvent.type(from, "2024-01");
    expect(within(start).queryByText("Invalid YYYY-MM-DD date")).toBeNull();
    expect(screen.queryByText(/^Start: from /)).toBeNull();
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
            views: [],
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
          views: [],
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
    expect(screen.getByRole("menuitem", { name: /^Move left/ })).toBeDefined();
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
      10,
    );
    expect(
      within(screen.getByRole("grid"))
        .getAllByRole("columnheader")
        .map((th) => th.textContent),
    ).toEqual([
      "ID",
      "Name",
      "Position",
      "Site",
      "Manager",
      "Team",
      "Team name",
      "Manager?",
      "Expected",
      "Actions",
    ]);
  });

  describe("saved views", () => {
    const v1 = "00000000-0000-4000-8000-0000000000a1";
    const v2 = "00000000-0000-4000-8000-0000000000a2";
    const harbour = {
      id: v1,
      name: "Harbour",
      scope: "shared",
      definition: { filters: { f1: { any: ["c1"] } } },
      canChange: true,
      canShare: false,
    };
    const theirs = {
      id: v2,
      name: "Theirs",
      scope: "shared",
      definition: { sort: ["-preferredName"] },
      canChange: false,
      canShare: false,
    };
    const withViews = (views: object[]) => () =>
      Response.json({
        people: [avery, blake],
        fields: [site, role],
        order,
        views,
      });

    it("offers nothing to save or apply until there is a view or a saved one", async () => {
      await openAt("/people");
      expect(
        screen.queryByRole("button", {
          name: (name) => name.startsWith("Views"),
        }),
      ).toBeNull();
    });

    it("saves the view under a name, applies it, and goes back with Back", async () => {
      let views: object[] = [];
      const { fetch, history } = await openAt(
        '/people?filters={"f1":{"any":["c1"]}}',
        {
          "GET /api/people": () => withViews(views)(),
          "POST /api/people/views": () => {
            views = [harbour];
            return Response.json(
              { view: harbour, changeSetId: s1 },
              { status: 201 },
            );
          },
        },
      );
      // Changed from the table's default view, with nothing saved yet.
      expect(viewsButton().getAttribute("aria-label")).toBe("Views, changed");
      await chooseView("Save view…");
      const dialog = await screen.findByRole("dialog", { name: "Save view" });
      await userEvent.keyboard("{Enter}");
      expect(within(dialog).getByText("Name needed")).toBeDefined();
      expect(within(dialog).getByText("Includes")).toBeDefined();
      await userEvent.keyboard("Harbour{Enter}");
      await waitFor(() => {
        expect(address(history)).toContain(`view=${v1}`);
      });
      expect(bodyOf(fetch, "POST", "/api/people/views")).toEqual([
        {
          name: "Harbour",
          scope: "personal",
          definition: { filters: { f1: { any: ["c1"] } } },
        },
      ]);
      expect(viewsButton().getAttribute("aria-label")).toBe("Views: Harbour");

      await userEvent.click(screen.getByRole("button", { name: "Clear all" }));
      expect(address(history)).not.toContain("view=");
      expect(shownNames()).toEqual(["Avery Fictional", "Blake Fictional"]);
      await chooseView("Harbour");
      expect(shownNames()).toEqual(["Avery Fictional"]);
      expect(address(history)).toContain(`view=${v1}`);
      act(() => {
        history.back();
      });
      await waitFor(() => {
        expect(shownNames()).toEqual(["Avery Fictional", "Blake Fictional"]);
      });
    });

    it("sets what may be done with the user's own view apart from the views, even with nothing in it", async () => {
      await openAt(`/people?view=${v1}`, {
        "GET /api/people": withViews([{ ...harbour, definition: {} }, theirs]),
      });
      expect(await viewsMenuLayout()).toEqual([
        "Shared views",
        "✓Harbour, applied",
        "Theirs",
        "—",
        "Rename…",
        "Delete view",
      ]);
    });

    it("marks a changed view, updates, renames, and deletes the user's own, with Undo", async () => {
      // The server keeps what each change sent.
      let mine = harbour;
      const { fetch, history } = await openAt(
        `/people?filters={"f1":{"any":["c1"]}}&view=${v1}`,
        {
          "GET /api/people": () => withViews([mine, theirs])(),
          [`PUT /api/people/views/${v1}`]: () => {
            const [change] = bodyOf(
              fetch,
              "PUT",
              `/api/people/views/${v1}`,
            ).slice(-1) as object[];
            mine = { ...mine, ...change };
            return Response.json({ view: mine, changeSetId: s1 });
          },
          [`DELETE /api/people/views/${v1}`]: savedAs(),
        },
      );
      expect(viewsButton().getAttribute("aria-label")).toBe("Views: Harbour");
      await choose("Name", "Sort A to Z");
      expect(viewsButton().getAttribute("aria-label")).toBe(
        "Views: Harbour, changed",
      );
      expect(address(history)).toContain(`view=${v1}`);
      await chooseView("Update Harbour");
      expect(bodyOf(fetch, "PUT", `/api/people/views/${v1}`)).toEqual([
        {
          definition: {
            filters: { f1: { any: ["c1"] } },
            sort: ["preferredName"],
          },
        },
      ]);
      expect(viewsButton().getAttribute("aria-label")).toBe("Views: Harbour");

      await chooseView("Rename…");
      const dialog = await screen.findByRole("dialog", { name: "Rename view" });
      const name = within(dialog).getByRole("textbox", { name: "Name" });
      await userEvent.clear(name);
      await userEvent.type(name, "theirs");
      expect(within(dialog).getByText("Already a view")).toBeDefined();
      await userEvent.clear(name);
      await userEvent.type(name, "Home{Enter}");
      await waitFor(() => {
        expect(screen.queryByRole("dialog")).toBeNull();
      });
      expect(bodyOf(fetch, "PUT", `/api/people/views/${v1}`)).toContainEqual({
        name: "Home",
      });

      await chooseView("Delete view");
      expect(fetch).toHaveBeenCalledWith(
        `/api/people/views/${v1}`,
        expect.objectContaining({ method: "DELETE" }),
      );
      await screen.findByText("Deleted the Home view.");
      await userEvent.click(screen.getByRole("button", { name: "Undo" }));
      await waitFor(() => {
        expect(undone(fetch)).toEqual([s1]);
      });
    });

    it("lists views under My views and Shared views", async () => {
      await openAt("/people", {
        "GET /api/people": withViews([
          { ...harbour, scope: "personal" },
          theirs,
        ]),
      });
      expect(await viewsMenuLayout()).toEqual([
        "My views",
        "Harbour",
        "Shared views",
        "Theirs",
      ]);
    });

    it("leaves out a group with no views", async () => {
      await openAt("/people", { "GET /api/people": withViews([theirs]) });
      expect(await viewsMenuLayout()).toEqual(["Shared views", "Theirs"]);
    });

    it("shares the applied view, offering Undo", async () => {
      const mine = {
        ...harbour,
        scope: "personal",
        canShare: true,
        definition: {},
      };
      const url = `/api/people/views/${v1}`;
      const { fetch } = await openAt(`/people?view=${v1}`, {
        "GET /api/people": withViews([mine]),
        [`PUT ${url}`]: () =>
          Response.json({
            view: { ...mine, scope: "shared" },
            changeSetId: s1,
          }),
      });
      await chooseView("Share current view");
      await screen.findByText("Shared the Harbour view.");
      expect(bodyOf(fetch, "PUT", url)).toEqual([{ scope: "shared" }]);
      await userEvent.click(screen.getByRole("button", { name: "Undo" }));
      await waitFor(() => {
        expect(undone(fetch)).toEqual([s1]);
      });
    });

    it("takes back the applied view, offering Undo", async () => {
      const shared = { ...harbour, canShare: true, definition: {} };
      const url = `/api/people/views/${v1}`;
      const { fetch } = await openAt(`/people?view=${v1}`, {
        "GET /api/people": withViews([shared]),
        [`PUT ${url}`]: () =>
          Response.json({
            view: { ...shared, scope: "personal" },
            changeSetId: s1,
          }),
      });
      await chooseView("Take back current view");
      await screen.findByText("Took back the Harbour view.");
      expect(bodyOf(fetch, "PUT", url)).toEqual([{ scope: "personal" }]);
      await userEvent.click(screen.getByRole("button", { name: "Undo" }));
      await waitFor(() => {
        expect(undone(fetch)).toEqual([s1]);
      });
    });

    it("says why a view could not be shared", async () => {
      const mine = {
        ...harbour,
        scope: "personal",
        canShare: true,
        definition: {},
      };
      await openAt(`/people?view=${v1}`, {
        "GET /api/people": withViews([mine]),
        [`PUT /api/people/views/${v1}`]: () =>
          Response.json(
            { error: "There is already a shared view named Harbour" },
            { status: 409 },
          ),
      });
      await chooseView("Share current view");
      await screen.findByText("There is already a shared view named Harbour");
      expect(await viewsMenuLayout()).toContain("My views");
    });

    it("offers no sharing of a view the user may not share", async () => {
      await openAt(`/people?view=${v1}`, {
        "GET /api/people": withViews([{ ...harbour, definition: {} }]),
      });
      const items = await viewsMenuItems();
      expect(items).toContain("Rename…");
      expect(items).not.toContain("Take back current view");
    });

    it("saves a view as shared when the box is ticked", async () => {
      const { fetch } = await openAt("/people?search=avery", {
        "GET /api/people": withViews([]),
        "POST /api/people/views": () =>
          Response.json({ view: harbour, changeSetId: s1 }, { status: 201 }),
      });
      await chooseView("Save view…");
      const dialog = await screen.findByRole("dialog", { name: "Save view" });
      await userEvent.click(
        within(dialog).getByRole("checkbox", {
          name: "Share with everyone who sees this table",
        }),
      );
      await userEvent.type(
        within(dialog).getByRole("textbox", { name: "Name" }),
        "Harbour{Enter}",
      );
      await waitFor(() => {
        expect(bodyOf(fetch, "POST", "/api/people/views")).toEqual([
          { name: "Harbour", scope: "shared", definition: { search: "avery" } },
        ]);
      });
    });

    it("offers no choice of sharing to those who may not save shared views", async () => {
      await openAt("/people?search=avery", {
        "GET /api/session": viewer,
        "GET /api/people": withViews([]),
      });
      await chooseView("Save view…");
      const dialog = await screen.findByRole("dialog", { name: "Save view" });
      expect(within(dialog).getByText("Includes")).toBeDefined();
      expect(within(dialog).queryByRole("checkbox")).toBeNull();
    });

    it("checks a name only against views kept the same way", async () => {
      await openAt("/people?search=avery", {
        "GET /api/people": withViews([theirs]),
      });
      await chooseView("Save view…");
      const dialog = await screen.findByRole("dialog", { name: "Save view" });
      await userEvent.keyboard("theirs");
      expect(within(dialog).queryByText("Already a view")).toBeNull();
      await userEvent.click(within(dialog).getByRole("checkbox"));
      expect(within(dialog).getByText("Already a view")).toBeDefined();
      await userEvent.click(within(dialog).getByRole("checkbox"));
      expect(within(dialog).queryByText("Already a view")).toBeNull();
    });

    it("stops showing a name as taken once the view would be kept the other way", async () => {
      await openAt("/people?search=avery", {
        "GET /api/people": withViews([]),
        "POST /api/people/views": () =>
          Response.json(
            { error: "There is already a view with that name" },
            { status: 409 },
          ),
      });
      await chooseView("Save view…");
      const dialog = await screen.findByRole("dialog", { name: "Save view" });
      await userEvent.keyboard("Taken{Enter}");
      expect(await within(dialog).findByText("Already a view")).toBeDefined();
      await userEvent.click(within(dialog).getByRole("checkbox"));
      expect(within(dialog).queryByText("Already a view")).toBeNull();
    });

    it("saves a moved column in the view", async () => {
      const { fetch } = await openAt("/people", {
        "GET /api/people": withViews([]),
        "POST /api/people/views": () =>
          Response.json({ view: harbour, changeSetId: s1 }, { status: 201 }),
      });
      await userEvent.click(
        screen.getByRole("button", { name: /^Preferred name|^Name/ }),
      );
      await userEvent.click(
        await screen.findByRole("menuitem", { name: /Move right/ }),
      );
      await chooseView("Save view…");
      const dialog = await screen.findByRole("dialog", { name: "Save view" });
      await userEvent.type(
        within(dialog).getByRole("textbox", { name: "Name" }),
        "Moved",
      );
      await userEvent.click(
        within(dialog).getByRole("button", { name: "Save view" }),
      );
      await waitFor(() => {
        expect(bodyOf(fetch, "POST", "/api/people/views")).toEqual([
          {
            name: "Moved",
            scope: "personal",
            definition: expect.objectContaining({
              order: expect.arrayContaining([
                "preferredName",
              ]) as unknown as string[],
            }) as unknown,
          },
        ]);
      });
    });

    it("clears moved columns with Clear all", async () => {
      const { history } = await openAt(
        '/people?order=["employeeId","preferredName"]',
      );
      await userEvent.click(screen.getByRole("button", { name: "Clear all" }));
      await waitFor(() => {
        expect(address(history)).not.toContain("order=");
      });
    });

    it("names moved columns in the menu, and puts them back from it", async () => {
      const { history } = await openAt(
        '/people?order=["employeeId","preferredName"]',
        { "GET /api/people": withViews([]) },
      );
      await chooseView(/^Columns moved/);
      await waitFor(() => {
        expect(address(history)).not.toContain("order=");
      });
    });

    it("lets a new view, which is personal, take the name of a shared one", async () => {
      await openAt("/people?search=avery", {
        "GET /api/people": withViews([harbour]),
      });
      await chooseView("Save view…");
      const dialog = await screen.findByRole("dialog", { name: "Save view" });
      await userEvent.keyboard("harbour");
      expect(within(dialog).queryByText("Already a view")).toBeNull();
    });

    it("starts the menu with clearing the view when there are no saved views", async () => {
      await openAt("/people?show=drafts", {
        "GET /api/people": withViews([]),
      });
      await userEvent.click(viewsButton());
      const menu = await screen.findByRole("menu");
      expect(menu.querySelector(".mantine-Menu-divider")).toBeNull();
    });

    it("lets others apply a view without changing it, save it as their own, and clear it", async () => {
      await openAt(`/people?sort=["-preferredName"]&view=${v2}`, {
        "GET /api/people": withViews([harbour, theirs]),
      });
      await userEvent.click(viewsButton());
      const offered = await screen.findAllByRole("menuitem");
      expect(offered.map((item) => item.textContent)).toEqual([
        "Harbour",
        "✓Theirs, applied",
        "Name ↓descending, remove sort",
        "Clear view",
        "Save view…",
      ]);
      // While a view is applied, every saved view keeps room for the check mark, so names line up.
      expect(
        offered
          .slice(0, 2)
          .map((item) => item.querySelector("[data-position='left']") !== null),
      ).toEqual([true, true]);
      await userEvent.click(
        screen.getByRole("menuitem", { name: "Save view…" }),
      );
      await screen.findByRole("dialog", { name: "Save view" });
      await userEvent.keyboard("{Escape}");
      await waitFor(() => {
        expect(screen.queryByRole("dialog")).toBeNull();
      });
      await chooseView("Clear view");
      expect(viewsButton().getAttribute("aria-label")).toBe("Views");
      // With no view applied, no room is kept for a check mark, so names sit where other items do.
      await userEvent.click(viewsButton());
      const items = await screen.findAllByRole("menuitem");
      expect(items.map((item) => item.textContent)).toEqual([
        "Harbour",
        "Theirs",
      ]);
      expect(
        items.filter((item) => item.querySelector("[data-position='left']")),
      ).toEqual([]);
    });

    it("refuses a name someone has just taken, and says when a view cannot be saved", async () => {
      let status = 409;
      await openAt("/people?search=avery", {
        "GET /api/people": withViews([]),
        "POST /api/people/views": () =>
          Response.json(
            { error: "There is already a view with that name" },
            { status },
          ),
      });
      await chooseView("Save view…");
      const dialog = await screen.findByRole("dialog", { name: "Save view" });
      await userEvent.keyboard("Taken{Enter}");
      expect(await within(dialog).findByText("Already a view")).toBeDefined();
      status = 500;
      await userEvent.keyboard("!{Enter}");
      expect(await within(dialog).findByRole("alert")).toBeDefined();
      await userEvent.click(
        within(dialog).getByRole("button", { name: "Cancel" }),
      );
      await waitFor(() => {
        expect(screen.queryByRole("dialog")).toBeNull();
      });
      await chooseView("Save view…");
      await screen.findByRole("dialog", { name: "Save view" });
      await userEvent.keyboard("{Escape}");
      await waitFor(() => {
        expect(screen.queryByRole("dialog")).toBeNull();
      });
    });
  });
});

describe("drafts of columns", () => {
  const approverEditor = session([
    "configuration:edit",
    "configuration:view",
    "plan:approve",
    "releases:approve",
    "people:approve",
    "hiring-plan:approve",
    "configuration:approve",
    "people:edit",
    "people:view",
    "plan:view",
    "restricted:view",
  ]);
  const waiting = {
    state: "waiting",
    madeBy: "Fictional Editor",
    madeAt: "2026-10-30T15:00:00.000Z",
    editors: ["Fictional Editor", "Second Fictional Editor"],
  };
  const added = {
    id: "f3",
    name: "Previous site",
    listId: "l1",
    multiple: false,
    required: false,
    draft: {
      ...waiting,
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
      views: [],
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
    const header = (name: string) =>
      screen.getByRole("button", {
        name: (shown) => shown.startsWith(`${name} column`),
      });
    expect(
      within(header("Previous site")).getByText("Draft: added"),
    ).toBeDefined();
    expect(within(header("Team roles")).getByText("Rejected")).toBeDefined();
    // The renamed column is tinted, with the column as it is live beside it, hidden from assistive
    // technology as a live row is.
    expect(header("Team roles").closest("th")?.className).toMatch(
      /draftColumn/,
    );
    const liveCopy = screen.getByText("Role on team").closest("th");
    expect(liveCopy?.getAttribute("aria-hidden")).toBe("true");
    expect(within(liveCopy as HTMLElement).getByText("Live")).toBeDefined();
    expect(
      screen.queryByRole("columnheader", { name: /Role on team/ }),
    ).toBeNull();
    await userEvent.click(header("Team roles"));
    const menu = await screen.findByRole("menu");
    expect(within(menu).getByText("Reason: Keep the name")).toBeDefined();
    // The draft's section is headed by its own mark, red once rejected.
    expect(
      within(menu).getByText("Rejected").closest("[class*=draftRejected]"),
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
          views: [],
        }),
    });
    const header = (name: string) =>
      screen.getByRole("button", {
        name: (shown) => shown.startsWith(`${name} column`),
      });
    expect(within(header("Site")).getByText("Draft: removed")).toBeDefined();
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
          fields: [site, renamed],
          order,
          views: [],
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
    const note = "Changed by this account, so another approver must approve it";
    const disabled = (menu: HTMLElement, name: string) =>
      within(menu)
        .getByRole("menuitem", { name })
        .hasAttribute("data-disabled");
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
          views: [],
        }),
    });
    await userEvent.click(
      await screen.findByRole("button", {
        name: "Actions for Avery Fictional",
      }),
    );
    const row = await screen.findByRole("menu");
    expect(disabled(row, "Approve draft")).toBe(true);
    expect(within(row).getByText(note)).toBeDefined();
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
    expect(disabled(column, "Approve…")).toBe(true);
    expect(within(column).getAllByText(note).length).toBeGreaterThan(0);
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
          views: [],
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
      "GET /api/people": peopleWithDrafts,
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
          views: [],
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
          views: [],
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

describe("unpublished and held changes", () => {
  const approverEditor = session([
    "configuration:edit",
    "configuration:view",
    "plan:approve",
    "releases:approve",
    "people:approve",
    "hiring-plan:approve",
    "configuration:approve",
    "people:edit",
    "people:view",
    "plan:view",
    "restricted:view",
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
  const header = (name: string) =>
    screen.getByRole("button", {
      name: (shown) => shown.startsWith(`${name} column`),
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
          views: [],
        }),
    });
    expect(
      within(cell("p1", "preferredName")).getByText(
        wholeText(new RegExp(`Being changed by ${holder}$`)),
      ),
    ).toBeDefined();
    expect(cell("p1", "preferredName").getAttribute("aria-readonly")).toBe(
      "true",
    );
    expect(
      within(cell("p2", "preferredName")).getByText(", unpublished"),
    ).toBeDefined();
    expect(
      within(cell("p2", "preferredName")).queryByText("Unpublished"),
    ).toBeNull();
    let menu = await menuOf(
      screen.getByRole("button", { name: "Actions for Avery Fictional" }),
    );
    expect(within(menu).getByText(held)).toBeDefined();
    for (const item of ["Approve draft", "Discard draft", "Remove person"]) {
      expect(within(menu).queryByRole("menuitem", { name: item })).toBeNull();
    }
    // Nothing follows the draft's lines, so no divider ends the menu.
    expect(menu.lastElementChild?.className).not.toMatch(/divider/);
    await userEvent.keyboard("{Escape}");
    menu = await menuOf(
      screen.getByRole("button", { name: "Actions for Blake Fictional" }),
    );
    expect(within(menu).getByText(mine)).toBeDefined();
    expect(
      within(menu).queryByRole("menuitem", { name: "Approve draft" }),
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
          views: [],
        }),
    });
    expect(within(header("Site")).getByText("Being changed")).toBeDefined();
    expect(
      within(header("Role on team")).getByText(", unpublished"),
    ).toBeDefined();
    let menu = await menuOf(header("Site"));
    expect(within(menu).getAllByText(held)).toHaveLength(1);
    for (const item of ["Approve…", "Edit column", "Discard draft"]) {
      expect(within(menu).queryByRole("menuitem", { name: item })).toBeNull();
    }
    await userEvent.keyboard("{Escape}");
    menu = await menuOf(header("Role on team"));
    expect(within(menu).getByText(mine)).toBeDefined();
    expect(
      within(menu).queryByRole("menuitem", { name: "Approve…" }),
    ).toBeNull();
    expect(
      within(menu).getByRole("menuitem", { name: "Edit column" }),
    ).toBeDefined();
  });
});

describe("planned hires", () => {
  const rejected = {
    action: "changed",
    changed: ["stateId"],
    live: { stateId: "s-proposed", values: {}, links: {} },
    state: "rejected",
    reason: "Not this quarter",
    madeBy: null,
    madeAt: null,
  };
  const opening = {
    id: "h1",
    kind: "planned-hire",
    preferredName: "",
    employeeId: "REQ-1",
    positionId: "position-2",
    stateId: "s-open",
    expected: "2027-01",
    startDate: null,
    values: {},
    links: {},
    draft: rejected,
  };
  const drafted = {
    id: "h2",
    kind: "planned-hire",
    preferredName: "Fictional hire",
    employeeId: "TBD-2",
    positionId: "position-1",
    stateId: "s-proposed",
    expected: "2026-12",
    startDate: null,
    values: {},
    links: {},
    draft: {
      ...rejected,
      action: "created",
      changed: [],
      live: { values: {}, links: {} },
      state: "waiting",
    },
  };

  async function openHires(answers: Answers = {}) {
    const fetch = serverAnswers({
      "GET /api/session": hiringEditor,
      "GET /api/people": () =>
        Response.json({
          people: [{ ...avery, stateId: "s-hired" }, opening, drafted],
          fields: [],
          order: [
            "preferredName",
            "employeeId",
            "positionId",
            "stateId",
            "startDate",
            "expected",
          ],
          views: [],
        }),
      "GET /api/lists": () =>
        Response.json({ lists: [sites, roles, positions, states] }),
      "PATCH /api/planned-hires/h1": savedAs(),
      "DELETE /api/planned-hires/h1": savedAs(),
      "DELETE /api/planned-hires/h1/draft": savedAs(),
      "DELETE /api/planned-hires/h1/draft/rejection": savedAs(),
      "DELETE /api/planned-hires/h2/draft": savedAs(),
      "POST /api/planned-hires": () =>
        Response.json({ ids: ["h3"], changeSetId: s1 }, { status: 201 }),
      [`POST /api/undo/${s1}`]: savedAs(u1),
      ...answers,
    });
    renderApp("/people");
    await screen.findByRole("grid", { name: "People" });
    return fetch;
  }

  async function fromMenu(row: string, item: string) {
    focusCell(row, "employeeId");
    await userEvent.keyboard("{Shift>}{F10}{/Shift}");
    await userEvent.click(await screen.findByRole("menuitem", { name: item }));
  }

  it("offers a person the states of their meaning, and a hire only Proposed or Open", async () => {
    await openHires();
    focusCell("p1", "stateId");
    await userEvent.keyboard("{Enter}");
    expect(await offeredOptions()).toEqual(["Hired"]);
    await userEvent.keyboard("{Escape}");
    focusCell("h1", "stateId");
    await userEvent.keyboard("{Enter}");
    expect(await offeredOptions()).toEqual([
      "Request to hire",
      "Approved to hire",
    ]);
  });

  it("names an unnamed hire by its position and ID, and changes it through the planned hires' routes", async () => {
    const fetch = await openHires();
    expect(cell("h1", "preferredName").textContent).toContain("Tester, REQ-1");
    await fromMenu("h2", "Discard draft");
    expect(
      await screen.findByText(
        "Discarded the draft adding the planned hire Fictional hire.",
        {
          exact: false,
        },
      ),
    ).toBeDefined();
    expect(cell("p1", "stateId").getAttribute("aria-readonly")).toBeNull();
    focusCell("h1", "preferredName");
    await userEvent.keyboard("Fictional opening{Enter}");
    await waitFor(() => {
      expect(bodyOf(fetch, "PATCH", "/api/planned-hires/h1")).toEqual([
        { name: "Fictional opening" },
      ]);
    });
    focusCell("h1", "employeeId");
    await userEvent.keyboard("{Delete}");
    await waitFor(() => {
      expect(bodyOf(fetch, "PATCH", "/api/planned-hires/h1")).toContainEqual({
        requisition: null,
      });
    });
    await fromMenu("h1", "Resubmit");
    await fromMenu("h1", "Discard draft");
    await fromMenu("h1", "Remove planned hire");
    await waitFor(() => {
      expect(
        fetch.mock.calls
          .filter(([url]) => url.startsWith("/api/planned-hires/h1"))
          .map(([url, init]) => `${String(init?.method)} ${url}`),
      ).toEqual(
        expect.arrayContaining([
          "DELETE /api/planned-hires/h1/draft/rejection",
          "DELETE /api/planned-hires/h1/draft",
          "DELETE /api/planned-hires/h1",
        ]) as string[],
      );
    });
  });

  it("names the new row for the kind its state makes it", async () => {
    await openHires();
    const newRow = () => screen.getAllByRole("row", { name: /^New / })[0];
    const focusNew = (label: string) => {
      act(() => {
        inRow(newRow() as HTMLElement, label).focus();
      });
    };
    focusNew("State");
    await userEvent.keyboard("Request{Tab}{Escape}");
    await waitFor(() => {
      expect(newRow()?.getAttribute("aria-label")).toBe("New planned hire");
    });
    focusNew("State");
    await userEvent.keyboard("Hired{Tab}{Escape}");
    await waitFor(() => {
      expect(newRow()?.getAttribute("aria-label")).toBe("New person");
    });
  });

  it("adds a planned hire when a hiring state is the last value picked in the new row", async () => {
    // Given a new row with a name, ID, and position
    const fetch = await openHires();
    const newRow = screen.getByRole("row", { name: "New person" });
    act(() => {
      inRow(newRow, "Name").focus();
    });
    await userEvent.keyboard("Fictional opening{Tab}REQ-11{Tab}tes{Tab}");
    // When Request to hire is picked for its state
    await pick("Request to hire");
    // Then it is added as a planned hire, not a person
    await waitFor(() => {
      expect(bodyOf(fetch, "POST", "/api/planned-hires")).toHaveLength(1);
    });
    expect(bodyOf(fetch, "POST", "/api/people")).toEqual([]);
  });

  it("adds planned hires from the new row once a hiring state is chosen", async () => {
    const fetch = await openHires({
      "POST /api/planned-hires": () =>
        Response.json({ ids: ["h3", "h4"], changeSetId: s1 }, { status: 201 }),
    });
    const newRow = screen.getByRole("row", { name: "New person" });
    expect(inRow(newRow, "State").textContent).toBe("");
    await paste(
      inRow(newRow, "Name"),
      "\tREQ-9\tEngineer\tRequest to hire\nFictional opening\tREQ-10\tTester\tRequest to hire",
    );
    await waitFor(() => {
      expect(bodyOf(fetch, "POST", "/api/planned-hires")).toEqual([
        {
          hires: [
            {
              name: null,
              requisition: "REQ-9",
              positionId: "position-1",
              targetDate: null,
              managerId: null,
              isManager: false,
              stateId: "s-proposed",
              values: {},
              links: {},
            },
            {
              name: "Fictional opening",
              requisition: "REQ-10",
              positionId: "position-2",
              targetDate: null,
              managerId: null,
              isManager: false,
              stateId: "s-proposed",
              values: {},
              links: {},
            },
          ],
        },
      ]);
    });
  });
});

describe("adding from New", () => {
  const casey = {
    ...avery,
    id: "p9",
    preferredName: "Casey Fictional",
    employeeId: "E9",
    stateId: "s-hired",
    values: { f1: ["c1"] },
  };

  async function openNew(
    who: () => Response = hiringEditor,
    answers: Answers = {},
  ) {
    const fetch = await openPeople({
      "GET /api/session": who,
      "GET /api/lists": () =>
        Response.json({ lists: [sites, roles, positions, states] }),
      ...answers,
    });
    const button = screen.getByRole<HTMLButtonElement>("button", {
      name: "New",
    });
    await waitFor(() => {
      expect(button.disabled).toBe(false);
    });
    await userEvent.click(button);
    await form("New person");
    return fetch;
  }

  const form = (title: string) => screen.findByRole("region", { name: title });

  const row = (label: string) =>
    screen.getByText(label, { selector: "dt" }).parentElement as HTMLElement;

  const field = (label: string) =>
    screen.getByRole<HTMLInputElement>("textbox", { name: label });

  async function typeInto(label: string, text: string) {
    await userEvent.type(field(label), `${text}{Tab}`);
  }

  async function choose(label: string, option: string) {
    await userEvent.click(
      screen.getByRole("button", { name: `Change ${label}` }),
    );
    await pick(option);
  }

  async function answerQuestion(title: string, answer: string) {
    await userEvent.click(
      within(await screen.findByRole("dialog", { name: title })).getByRole(
        "button",
        { name: answer },
      ),
    );
    await waitFor(() => {
      expect(screen.queryByRole("dialog", { name: title })).toBeNull();
    });
  }

  it("starts a new person, with State first and Hired", async () => {
    await openNew();
    const panel = await form("New person");
    expect(
      within(panel)
        .getAllByRole("heading")
        .map(({ textContent }) => textContent)[0],
    ).toBe("New person");
    expect(panel.querySelector("dt")?.textContent).toBe("State");
    expect(within(row("State")).getByText("Hired")).toBeDefined();
  });

  it("names every problem on Add, with focus on the first the panel shows", async () => {
    // Given a new person with a name and ID, but no position or site
    const fetch = await openNew();
    await typeInto("Name", "Casey Fictional");
    await typeInto("ID", "E9");
    // When Add is pressed
    await userEvent.click(screen.getByRole("button", { name: "Add" }));
    // Then each missing value is named under its row, focus goes to Position, and nothing is sent
    expect(within(row("Position")).getByText("Position needed")).toBeDefined();
    expect(within(row("Site")).getByText("Site needed")).toBeDefined();
    await waitFor(() => {
      expect(document.activeElement).toBe(
        screen.getByRole("button", { name: "Change Position" }),
      );
    });
    expect(bodyOf(fetch, "POST", "/api/people")).toEqual([]);
  });

  it("finishes the field when Enter is pressed, adding nothing", async () => {
    // Given a new person with a required value still empty
    const fetch = await openNew();
    // When Enter is pressed in Name
    await userEvent.type(field("Name"), "Casey Fictional{Enter}");
    // Then the value is kept, nothing is checked as Add would, and nothing is sent
    expect(field("Name").value).toBe("Casey Fictional");
    expect(within(row("Position")).queryByText("Position needed")).toBeNull();
    expect(bodyOf(fetch, "POST", "/api/people")).toEqual([]);
  });

  it("adds the person with Add, then shows them in the panel", async () => {
    // Given a new person with every value needed
    let added = false;
    const fetch = await openNew(hiringEditor, {
      "POST /api/people": () => {
        added = true;
        return Response.json({ ids: ["p9"], changeSetId: s1 }, { status: 201 });
      },
      "GET /api/people": () =>
        Response.json({
          people: added ? [avery, blake, casey] : [avery, blake],
          fields: [site, role],
          order,
          views: [],
        }),
    });
    await typeInto("Name", "Casey Fictional");
    await typeInto("ID", "E9");
    await choose("Position", "Engineer");
    await choose("Site", "Harbour");
    // When Add is pressed
    await userEvent.click(screen.getByRole("button", { name: "Add" }));
    // Then they are sent, as Hired, and their details show in place of the form
    await waitFor(() => {
      expect(bodyOf(fetch, "POST", "/api/people")).toEqual([
        {
          people: [
            expect.objectContaining({
              preferredName: "Casey Fictional",
              employeeId: "E9",
              positionId: "position-1",
              stateId: "s-hired",
              values: expect.objectContaining({ f1: ["c1"] }) as unknown,
            }),
          ],
        },
      ]);
    });
    expect(await form("Casey Fictional")).toBeDefined();
    expect(screen.queryByRole("region", { name: "New person" })).toBeNull();
  });

  it("puts focus on its title when it opens", async () => {
    await openNew();
    await waitFor(() => {
      expect(document.activeElement).toBe(
        screen.getByRole("heading", { name: "New person" }),
      );
    });
  });

  it("keeps the form while an add is saved, and leaves a newer one as it is when the add fails", async () => {
    // Given an add still being saved
    let answer: (response: Response) => void = () => undefined;
    const fetch = await openNew(hiringEditor, {
      "POST /api/people": () =>
        new Promise<Response>((resolve) => {
          answer = resolve;
        }),
    });
    await typeInto("Name", "Casey Fictional");
    await typeInto("ID", "E9");
    await choose("Position", "Engineer");
    await choose("Site", "Harbour");
    await userEvent.click(screen.getByRole("button", { name: "Add" }));
    // When the panel's close button is pressed
    await userEvent.click(
      screen.getByRole("button", { name: "Close New person" }),
    );
    // Then the form stays
    expect(await form("New person")).toBeDefined();
    // When New is pressed, the add discarded, and the add then fails
    await userEvent.click(screen.getByRole("button", { name: "New" }));
    await answerQuestion("Discard the new person?", "Discard");
    await typeInto("Name", "Dee Fictional");
    act(() => {
      answer(new Response(null, { status: 500 }));
    });
    await waitFor(() => {
      expect(bodyOf(fetch, "POST", "/api/people")).toHaveLength(1);
    });
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 50));
    });
    // Then the newer form stays as it is
    expect(field("Name").value).toBe("Dee Fictional");
  });

  it("leaves a form opened while an add is saved as it is", async () => {
    // Given an add still being saved
    let answer: (response: Response) => void = () => undefined;
    const fetch = await openNew(hiringEditor, {
      "POST /api/people": () =>
        new Promise<Response>((resolve) => {
          answer = resolve;
        }),
    });
    await typeInto("Name", "Casey Fictional");
    await typeInto("ID", "E9");
    await choose("Position", "Engineer");
    await choose("Site", "Harbour");
    await userEvent.click(screen.getByRole("button", { name: "Add" }));
    // When New is pressed, the add asked about, and the add then saved
    await userEvent.click(screen.getByRole("button", { name: "New" }));
    await answerQuestion("Discard the new person?", "Discard");
    await typeInto("Name", "Dee Fictional");
    act(() => {
      answer(Response.json({ ids: ["p9"], changeSetId: s1 }, { status: 201 }));
    });
    // Then, once it is saved, the new form stays, with what was typed in it
    await waitFor(() => {
      expect(bodyOf(fetch, "POST", "/api/people")).toHaveLength(1);
    });
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 50));
    });
    expect(await form("New person")).toBeDefined();
    expect(field("Name").value).toBe("Dee Fictional");
  });

  it("closes with Cancel, putting focus back on New", async () => {
    await openNew();
    await userEvent.click(screen.getByRole("button", { name: "Cancel" }));
    await waitFor(() => {
      expect(screen.queryByRole("region", { name: "New person" })).toBeNull();
    });
    await waitFor(() => {
      expect(document.activeElement).toBe(
        screen.getByRole("button", { name: "New" }),
      );
    });
  });

  it("offers every state to those who may change people and the hiring plan", async () => {
    await openNew();
    await userEvent.click(screen.getByRole("button", { name: "Change State" }));
    expect(await offeredOptions()).toEqual([
      "Request to hire",
      "Approved to hire",
      "Hired",
      "Fictional Resigned",
    ]);
  });

  it("offers only a person's states to those who may change people alone", async () => {
    await openNew(editor);
    await userEvent.click(screen.getByRole("button", { name: "Change State" }));
    expect(await offeredOptions()).toEqual(["Hired", "Fictional Resigned"]);
  });

  it("becomes a planned hire with a hiring state, keeping the values both have and naming those cleared", async () => {
    // Given a new person with a name and an end date
    await openNew();
    await typeInto("Name", "Casey Fictional");
    await typeInto("End", "2027-01-31");
    // When their state is changed to Request to hire
    await choose("State", "Request to hire");
    // Then it is a planned hire, keeping the name, with the end date cleared and said to be
    expect(await form("New planned hire")).toBeDefined();
    expect(field("Name").value).toBe("Casey Fictional");
    expect(screen.queryByRole("textbox", { name: "End" })).toBeNull();
    expect(
      screen.getByText(
        "End was cleared, since a planned hire doesn't have it.",
      ),
    ).toBeDefined();
    // When it is changed back to Hired
    await choose("State", "Hired");
    // Then it is a person again, keeping the name, with nothing more cleared
    expect(await form("New person")).toBeDefined();
    expect(field("Name").value).toBe("Casey Fictional");
    expect(screen.queryByText(/was cleared/)).toBeNull();
  });

  it("names a new planned hire in grey by its position, then its position and ID", async () => {
    await openNew();
    await choose("State", "Request to hire");
    await form("New planned hire");
    expect(field("Name").placeholder).toBe("");
    await choose("Position", "Tester");
    await waitFor(() => {
      expect(field("Name").placeholder).toBe("Tester");
    });
    await typeInto("ID", "REQ-4100");
    await waitFor(() => {
      expect(field("Name").placeholder).toBe("Tester, REQ-4100");
    });
  });

  it("names no new person in grey", async () => {
    await openNew();
    await choose("Position", "Tester");
    await waitFor(() => {
      expect(within(row("Position")).getByText("Tester")).toBeDefined();
    });
    expect(field("Name").placeholder).toBe("");
  });

  it("closes an untouched form without asking", async () => {
    await openNew();
    await userEvent.click(
      screen.getByRole("button", { name: "Close New person" }),
    );
    await waitFor(() => {
      expect(screen.queryByRole("region", { name: "New person" })).toBeNull();
    });
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("asks before discarding a person being added, keeping them until Discard", async () => {
    // Given a new person with a name
    await openNew();
    await typeInto("Name", "Casey Fictional");
    const close = screen.getByRole("button", { name: "Close New person" });
    // When the form is closed, and adding kept
    await userEvent.click(close);
    await answerQuestion("Discard the new person?", "Keep adding");
    // Then the form stays, as it was
    expect(field("Name").value).toBe("Casey Fictional");
    // When it is closed again, and discarded
    await userEvent.click(close);
    await answerQuestion("Discard the new person?", "Discard");
    // Then it closes
    await waitFor(() => {
      expect(screen.queryByRole("region", { name: "New person" })).toBeNull();
    });
  });

  it("asks before discarding a planned hire being added", async () => {
    await openNew();
    await choose("State", "Approved to hire");
    await form("New planned hire");
    await userEvent.click(
      screen.getByRole("button", { name: "Close New planned hire" }),
    );
    await answerQuestion("Discard the new planned hire?", "Discard");
    await waitFor(() => {
      expect(
        screen.queryByRole("region", { name: "New planned hire" }),
      ).toBeNull();
    });
  });

  it("has no State for those not sent the hiring states", async () => {
    await openNew(editor, { "GET /api/lists": listsAnswer });
    const panel = await form("New person");
    expect(panel.querySelector("dt")?.textContent).toBe("Name");
    expect(screen.queryByText("State", { selector: "dt" })).toBeNull();
  });

  it("empties a field with its ×, keeping focus in it", async () => {
    await openNew();
    await userEvent.type(field("Name"), "Casey Fictional");
    await userEvent.click(screen.getByRole("button", { name: "Clear Name" }));
    expect(field("Name").value).toBe("");
    expect(document.activeElement).toBe(field("Name"));
  });

  it("keeps the form, with what was entered, when adding fails", async () => {
    // Given a new person with every value needed, whom the server will not add
    await openNew(hiringEditor, {
      "POST /api/people": refused(500, "Fictional failure"),
    });
    await typeInto("Name", "Casey Fictional");
    await typeInto("ID", "E9");
    await choose("Position", "Engineer");
    await choose("Site", "Harbour");
    // When Add is pressed
    await userEvent.click(screen.getByRole("button", { name: "Add" }));
    // Then the form stays, as it was, to be added again
    expect(
      await screen.findByText(
        "Fathom could not add the person. Try again in a moment.",
      ),
    ).toBeDefined();
    expect(field("Name").value).toBe("Casey Fictional");
    await waitFor(() => {
      expect(
        screen.getByRole<HTMLButtonElement>("button", { name: "Add" }).disabled,
      ).toBe(false);
    });
  });

  it("names every value cleared when it becomes a planned hire", async () => {
    await openNew(hiringEditor, {
      "GET /api/people": () =>
        Response.json({
          people: [{ ...avery, isManager: true }, blake],
          fields: [site, role],
          order,
          views: [],
        }),
    });
    await typeInto("End", "2027-01-31");
    await choose("Manager", "Avery Fictional");
    await typeInto("Manager assigned", "2026-12-01");
    await choose("State", "Request to hire");
    expect(
      await screen.findByText(
        "End and Manager assigned were cleared, since a planned hire doesn't have them.",
      ),
    ).toBeDefined();
  });

  it("adds a planned hire through the planned hires' route", async () => {
    const fetch = await openNew(hiringEditor, {
      "POST /api/planned-hires": () =>
        Response.json({ ids: ["h9"], changeSetId: s1 }, { status: 201 }),
    });
    await choose("State", "Approved to hire");
    await choose("Position", "Tester");
    await userEvent.click(screen.getByRole("button", { name: "Add" }));
    await waitFor(() => {
      expect(bodyOf(fetch, "POST", "/api/planned-hires")).toEqual([
        {
          hires: [
            expect.objectContaining({
              name: null,
              requisition: null,
              positionId: "position-2",
              stateId: "s-open",
            }),
          ],
        },
      ]);
    });
    expect(bodyOf(fetch, "POST", "/api/people")).toEqual([]);
  });

  it("puts focus in the first box to type in when its value is the first problem", async () => {
    await openNew();
    await userEvent.click(screen.getByRole("button", { name: "Add" }));
    expect(within(row("Name")).getByText("Name needed")).toBeDefined();
    await waitFor(() => {
      expect(document.activeElement).toBe(field("Name"));
    });
  });

  it("names a value cleared when a planned hire becomes a person", async () => {
    // Given a reader who sees planned hires' dates but not people's
    await openNew(
      session([
        "configuration:view",
        "hiring-plan:edit",
        "hiring-plan:view",
        "people:edit",
        "people:view",
        "plan:view",
      ]),
    );
    await choose("State", "Request to hire");
    await typeInto("Start", "2027-03-01");
    // When the planned hire becomes a person
    await choose("State", "Hired");
    // Then the date is cleared, and named
    expect(
      await screen.findByText(
        "Start was cleared, since a person doesn't have it.",
      ),
    ).toBeDefined();
  });
});
