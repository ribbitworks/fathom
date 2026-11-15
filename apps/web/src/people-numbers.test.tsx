// SPDX-License-Identifier: Apache-2.0

// Tests for Number columns on the People page, with the server's responses simulated: a number as
// the reader's language writes it, saving and clearing one by typing, refusing what is not a
// number, a drafted number's live value, sorting and filtering by number, and adding the column.

import { act, screen, waitFor, within } from "@testing-library/react";
import { userEvent } from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { cellKinds } from "./cell-kinds.tsx";
import { decimal } from "./numbers.ts";
import {
  bodyOf,
  chooseIn,
  fictionalUser,
  renderApp,
  serverAnswers,
} from "./test-support.tsx";

const s1 = "00000000-0000-4000-8000-000000000001";

const editor = () =>
  Response.json({
    ...fictionalUser,
    permissions: [
      "configuration:edit",
      "configuration:view",
      "people:edit",
      "people:view",
      "plan:view",
      "features:view",
    ],
  });

const score = {
  id: "f1",
  name: "Score",
  type: "number",
  listId: null,
  visibility: "general",
  multiple: false,
  required: false,
};
const personWith = (id: string, name: string, numbers: object) => ({
  id,
  preferredName: name,
  employeeId: id,
  positionId: "position-1",
  values: {},
  links: {},
  numbers,
});
const avery = personWith("p1", "Avery Fictional", { f1: 1234.5 });
const blake = personWith("p2", "Blake Fictional", { f1: -7 });
const casey = personWith("p3", "Casey Fictional", {});
const positions = {
  id: "positions",
  name: "Positions",
  description: "",
  visibility: "general",
  retired: false,
  builtIn: "positions",
  choices: [
    {
      id: "position-1",
      label: "Fictional Engineer",
      description: "",
      retired: false,
    },
  ],
};
const peopleAnswer =
  (people: object[] = [avery, blake, casey]) =>
  () =>
    Response.json({
      people,
      fields: [score],
      order: ["preferredName", "employeeId", "f1"],
    });

afterEach(() => {
  vi.unstubAllGlobals();
});

type Answers = Parameters<typeof serverAnswers>[0];

async function openPeople(answers: Answers = {}, at = "/people") {
  const fetch = serverAnswers({
    "GET /api/session": editor,
    "GET /api/people": peopleAnswer(),
    "GET /api/lists": () => Response.json({ lists: [positions] }),
    "PATCH /api/people/p1": () => Response.json({ changeSetId: s1 }),
    "PATCH /api/people/p3": () => Response.json({ changeSetId: s1 }),
    ...answers,
  });
  renderApp(at);
  await screen.findByRole("grid", { name: "People" });
  return fetch;
}

const cell = (row: string) =>
  document.getElementById(`cell-${row}-f1`) as HTMLElement;

const shownNames = () =>
  screen
    .getAllByRole("row")
    .map((row) => row.textContent)
    .filter((text) => text.includes("Fictional"))
    .map((text) => /\w+ Fictional/.exec(text)?.[0]);

async function typeInto(row: string, typed: string) {
  cell(row).focus();
  await userEvent.keyboard(typed);
}

async function choose(item: string) {
  await userEvent.click(
    screen.getByRole("button", {
      name: (name) => name.startsWith("Score column"),
    }),
  );
  await userEvent.click(await screen.findByRole("menuitem", { name: item }));
}

describe("a Number column", () => {
  it("shows each number as the reader's language writes it, and nothing for none", async () => {
    await openPeople();
    expect(cell("p1").textContent).toContain(decimal(1234.5));
    expect(cell("p3").textContent).toBe("");
  });

  it("saves a number typed into a cell, 0 included", async () => {
    const fetch = await openPeople();
    await typeInto("p3", "0{Enter}");
    await waitFor(() => {
      expect(bodyOf(fetch, "PATCH", "/api/people/p3")).toEqual([
        { numbers: { f1: 0 } },
      ]);
    });
  });

  it("removes the number when the cell is cleared", async () => {
    const fetch = await openPeople();
    cell("p1").focus();
    await userEvent.keyboard("{Delete}");
    await waitFor(() => {
      expect(bodyOf(fetch, "PATCH", "/api/people/p1")).toEqual([
        { numbers: { f1: null } },
      ]);
    });
  });

  it("refuses what is not a number, saying what to type, and saves nothing", async () => {
    const fetch = await openPeople();
    await typeInto("p3", "1,5{Enter}");
    expect(
      await screen.findByText("Score: use a number such as 1234.5"),
    ).toBeDefined();
    expect(bodyOf(fetch, "PATCH", "/api/people/p3")).toEqual([]);
  });

  it("names a drafted number's live value without failing to show the row", async () => {
    await openPeople({
      "GET /api/people": peopleAnswer([
        {
          ...avery,
          draft: {
            action: "changed",
            changed: ["f1"],
            live: { values: {}, links: {}, numbers: { f1: 5 } },
            state: "waiting",
            madeBy: "Fictional Editor",
            madeAt: "2026-11-06T09:00:00.000Z",
          },
        },
        blake,
      ]),
    });
    expect(cell("p1").textContent).toContain("draft, live 5");
  });

  it("sorts lowest and highest first, with no number last", async () => {
    await openPeople();
    await choose("Highest first");
    await waitFor(() => {
      expect(shownNames()).toEqual([
        "Avery Fictional",
        "Blake Fictional",
        "Casey Fictional",
      ]);
    });
    await choose("Lowest first");
    await waitFor(() => {
      expect(shownNames()).toEqual([
        "Blake Fictional",
        "Avery Fictional",
        "Casey Fictional",
      ]);
    });
  });

  async function openFilter() {
    await choose("Filter…");
    const filter = await screen.findByRole("dialog", { name: "Filter Score" });
    return {
      filter,
      least: within(filter).getByRole("textbox", { name: "At least" }),
      most: within(filter).getByRole("textbox", { name: "At most" }),
    };
  }

  it("filters from a number, up to one, and between two", async () => {
    await openPeople();
    const { least, most } = await openFilter();
    await userEvent.type(least, "0");
    expect(screen.getByText(/^Score: at least 0/)).toBeDefined();
    expect(shownNames()).toEqual(["Avery Fictional"]);
    await userEvent.clear(least);
    await userEvent.type(most, "-1");
    expect(screen.getByText(/^Score: at most -1/)).toBeDefined();
    expect(shownNames()).toEqual(["Blake Fictional"]);
    await userEvent.type(least, "-10");
    expect(screen.getByText(/^Score: -10 to -1/)).toBeDefined();
  });

  it("says when a filter's bounds are the wrong way round", async () => {
    await openPeople();
    const { filter, least, most } = await openFilter();
    await userEvent.type(least, "5");
    await userEvent.type(most, "1");
    expect(within(filter).getByText("Lower than At least")).toBeDefined();
  });

  it("keeps what is being typed in a filter, and says what is wrong with it", async () => {
    await openPeople();
    const { filter, most } = await openFilter();
    await userEvent.type(most, "-");
    expect((most as HTMLInputElement).value).toBe("-");
    expect(
      within(filter).queryByText("Use a number such as 1234.5"),
    ).toBeNull();
    await userEvent.type(most, "x");
    expect(
      within(filter).getByText("Use a number such as 1234.5"),
    ).toBeDefined();
    expect(screen.queryByText(/^Score:/)).toBeNull();
  });

  it("empties a filter's bound with its ×", async () => {
    await openPeople();
    const { filter, least } = await openFilter();
    await userEvent.type(least, "0");
    await userEvent.click(
      within(filter).getByRole("button", { name: "Clear At least" }),
    );
    expect((least as HTMLInputElement).value).toBe("");
    expect(screen.queryByText(/^Score:/)).toBeNull();
  });

  it("filters to those with no number", async () => {
    await openPeople();
    const { filter } = await openFilter();
    await userEvent.click(
      within(filter).getByRole("checkbox", { name: "No number" }),
    );
    expect(screen.getByText("Score: No number")).toBeDefined();
    expect(shownNames()).toEqual(["Casey Fictional"]);
  });

  it("shows a drafted number's live value when only live records show", async () => {
    await openPeople(
      {
        "GET /api/people": peopleAnswer([
          {
            ...avery,
            draft: {
              action: "changed",
              changed: ["f1"],
              live: { values: {}, links: {}, numbers: { f1: 5 } },
              state: "waiting",
              madeBy: "Fictional Editor",
              madeAt: "2026-11-06T09:00:00.000Z",
            },
          },
          blake,
        ]),
      },
      "/people?show=live",
    );
    expect(cell("p1").textContent).toBe(
      "5, Live. A change is waiting for approval.",
    );
  });

  it("names the limit when a number has too many digits", async () => {
    await openPeople();
    await typeInto("p3", "1234567890123456{Enter}");
    expect(
      await screen.findByText(
        "Score: use at most 15 digits, 6 of them after the point",
      ),
    ).toBeDefined();
  });

  it("adds a number from text pasted into a new row, showing it at once", async () => {
    const fetch = await openPeople({
      "POST /api/people": () =>
        Response.json({ ids: ["p9"], changeSetId: s1 }, { status: 201 }),
    });
    const name = document.querySelector(
      '[id^="cell-new-"][id$="-preferredName"]',
    ) as HTMLElement;
    act(() => {
      name.focus();
    });
    await userEvent.paste("Drew Fictional\tE9\t0\tFictional Engineer\n");
    expect(bodyOf(fetch, "POST", "/api/people")).toEqual([
      {
        people: [
          {
            preferredName: "Drew Fictional",
            employeeId: "E9",
            positionId: "position-1",
            values: {},
            links: {},
            numbers: { f1: 0 },
          },
        ],
      },
    ]);
  });

  it("shows the bounds of a filter read from the page's address", async () => {
    await openPeople({}, '/people?filters={"f1":{"atLeast":-10,"atMost":0}}');
    expect(screen.getByText(/^Score: -10 to 0/)).toBeDefined();
    expect(shownNames()).toEqual(["Blake Fictional"]);
    await choose("Filter…");
    const filter = await screen.findByRole("dialog", { name: "Filter Score" });
    const least = within(filter).getByRole("textbox", { name: "At least" });
    expect((least as HTMLInputElement).value).toBe("-10");
  });

  it("is kept as text in a cell, and as a number when it is a record's own field", () => {
    const column = { label: "Score" } as never;
    expect(cellKinds.number.inWords(column, "soon")).toBe("soon");
    expect(cellKinds.number.inDetail?.(column, "1234.5")).toBe("1234.5");
    expect(cellKinds.number.pasted(column, " 7 ")).toEqual({ value: "7" });
    const held = cellKinds.number.ownField;
    expect(held?.read(0)).toBe("0");
    expect(held?.read(null)).toBe("");
    expect(held?.save("1.5", false)).toBe(1.5);
    expect(held?.save("", false)).toBeNull();
  });

  it("is added with a visibility of its own", async () => {
    const fetch = await openPeople({
      "POST /api/people/columns": () =>
        Response.json(
          { field: { ...score, id: "f2", name: "Rank" }, changeSetId: s1 },
          { status: 201 },
        ),
    });
    await userEvent.click(screen.getByRole("button", { name: "New column" }));
    const dialog = await screen.findByRole("dialog", { name: "New column" });
    await userEvent.type(within(dialog).getByLabelText("Name"), "Rank");
    await chooseIn(dialog, "Type", "Number");
    await userEvent.click(
      within(dialog).getByRole("button", { name: "Add column" }),
    );
    await waitFor(() => {
      expect(bodyOf(fetch, "POST", "/api/people/columns")).toEqual([
        {
          name: "Rank",
          type: "number",
          visibility: "general",
          multiple: false,
          required: false,
          onPlannedHires: true,
        },
      ]);
    });
  });
});
