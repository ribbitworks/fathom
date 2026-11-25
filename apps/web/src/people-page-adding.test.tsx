// SPDX-License-Identifier: Apache-2.0

// Tests of adding people from the People table's new row, typed or pasted, and its choice picker.

import {
  act,
  fireEvent,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import { userEvent } from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { bodyOf, renderApp, serverAnswers } from "./test-support.tsx";
import {
  s1,
  editor,
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
  inRow,
  focusCell,
  undone,
  settle,
  offeredOptions,
  paste,
  draftOf,
} from "./test-people-page.tsx";

afterEach(() => {
  vi.unstubAllGlobals();
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
      keyNumber: 1,
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
        }),
    });
    // Adding is the page's main action, beside adding a column.
    expect(
      screen
        .getByRole("button", { name: "New person" })
        .getAttribute("data-variant"),
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
        "Casey, New, not saved yet: Position, Site needed",
      );
    });
    await userEvent.keyboard("eng{Tab}har{Tab}");
    await waitFor(() => {
      expect(newCell("Name").textContent).toBe("Casey, New, not saved yet");
    });
    await userEvent.keyboard("{Escape}{Enter}");
    // Shown at once, as a draft adding them, which cannot be changed until saved.
    const added = await screen.findByText(/^, Draft: added/);
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
      within(row).queryAllByRole("button", { name: /^Actions for/ }),
    ).toHaveLength(0);
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
    expect(await screen.findByText(/^, Draft: added/)).toBeDefined();
    await userEvent.keyboard("Dee{Tab}{Escape}");
    answer(Response.json({ error: "Fictional failure" }, { status: 500 }));
    expect(
      await screen.findByText(
        "Fathom could not add the person. Try again in a moment.",
      ),
    ).toBeDefined();
    expect(screen.queryByText(/^, Draft: added/)).toBeNull();
    const rows = screen.getAllByRole("row", { name: "New person" });
    expect(rows.map((row) => inRow(row, "Name").textContent)).toEqual([
      "Casey, New, not saved yet",
      "Dee, New, not saved yet: ID, Position, Site needed",
    ]);
  });

  it("offers New only once the people and lists have loaded", async () => {
    serverAnswers({
      "GET /api/session": editor,
      "GET /api/people": peopleAnswer,
      "GET /api/lists": () => new Promise<Response>(() => undefined),
    });
    renderApp("/people");
    const button = await screen.findByRole("button", { name: "New person" });
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
