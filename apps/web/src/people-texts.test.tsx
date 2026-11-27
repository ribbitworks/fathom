// SPDX-License-Identifier: Apache-2.0

// Tests for text columns on the People page, with the server's responses simulated: a text shown in
// its cell, typed and pasted, a column of several lines shown whole and edited in its details,
// sorting, filtering and exporting by it, and adding the column with Several lines.

import { act, screen, waitFor, within } from "@testing-library/react";
import { userEvent } from "@testing-library/user-event";
import type { Field, Person } from "@fathom/shared";
import { afterEach, describe, expect, it, vi } from "vitest";
import { addedColumn } from "./added-columns.ts";
import { cellKinds } from "./cell-kinds.tsx";
import { exportValue } from "./exports.ts";
import { bodyOf, chooseIn, detailRow } from "./test-support.tsx";
import {
  openNewColumn,
  openPeopleWith,
  peopleHolding,
  personWith,
} from "./test-people-columns.tsx";
import {
  type Answers,
  cell,
  choose as choosing,
  s1,
  shownNames,
} from "./test-people-page.tsx";

const desk = {
  id: "f1",
  keyNumber: 1,
  name: "Desk",
  type: "text",
  listId: null,
  visibility: "general",
  multiple: false,
  required: false,
};
const directions = { ...desk, id: "f2", name: "Directions", multiline: true };
const avery = personWith("p1", "Avery Fictional", "texts", {
  f1: "North 4-12",
  f2: "Take the east stairs.\nSecond door on the left.",
});
const blake = personWith("p2", "Blake Fictional", "texts", {});
const casey = personWith("p3", "Casey Fictional", "texts", {
  f1: "South 2-07",
});
const peopleOf = () => peopleHolding([blake, avery, casey], [desk, directions]);
const open = (answers: Answers = {}, at = "/people") =>
  openPeopleWith(peopleOf(), answers, at);
const textOf = (row: string, column = "f1") => cell(row, column);
const choose = (item: string) => choosing("Desk", item);

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("a text column", () => {
  it("shows each text in its cell, a text of several lines on one line", async () => {
    await open();
    expect(textOf("p1").textContent).toBe("North 4-12");
    expect(textOf("p2").textContent).toBe("");
    expect(textOf("p1", "f2").textContent).toContain("Take the east stairs.");
  });

  it("saves a text typed in its cell, trimmed, and empties it with Delete", async () => {
    const fetch = await open();
    act(() => {
      textOf("p2").focus();
    });
    await userEvent.keyboard("North 4-15 {Enter}");
    act(() => {
      textOf("p1").focus();
    });
    await userEvent.keyboard("{Delete}");
    await waitFor(() => {
      expect(bodyOf(fetch, "PATCH", "/api/people/p2")).toEqual([
        { texts: { f1: "North 4-15" } },
      ]);
      expect(bodyOf(fetch, "PATCH", "/api/people/p1")).toEqual([
        { texts: { f1: null } },
      ]);
    });
  });

  it("refuses a text past its column's 200 characters, under the row", async () => {
    const fetch = await open();
    act(() => {
      textOf("p2").focus();
    });
    await userEvent.keyboard("{Enter}");
    await userEvent.paste("x".repeat(201));
    await userEvent.keyboard("{Enter}");
    expect(await screen.findByText("Desk too long")).toBeDefined();
    expect(bodyOf(fetch, "PATCH", "/api/people/p2")).toEqual([]);
  });

  it("keeps a new line typed with Shift+Enter in a column of several lines", async () => {
    const fetch = await open();
    act(() => {
      textOf("p2", "f2").focus();
    });
    await userEvent.keyboard("Lift{Shift>}{Enter}{/Shift}Room 4{Enter}");
    await waitFor(() => {
      expect(bodyOf(fetch, "PATCH", "/api/people/p2")).toEqual([
        { texts: { f2: "Lift\nRoom 4" } },
      ]);
    });
  });

  it("sorts A to Z, or Z to A", async () => {
    await open();
    await choose("Sort Z to A");
    await waitFor(() => {
      expect(shownNames().slice(0, 2)).toEqual([
        "Casey Fictional",
        "Avery Fictional",
      ]);
    });
    await choose("Sort A to Z");
    await waitFor(() => {
      expect(shownNames().slice(0, 2)).toEqual([
        "Avery Fictional",
        "Casey Fictional",
      ]);
    });
  });

  it("filters by the words it contains, named in its pill", async () => {
    await open();
    await choose("Filter…");
    const filter = await screen.findByRole("dialog", { name: "Filter Desk" });
    await userEvent.type(within(filter).getByLabelText("Contains"), "north");
    await waitFor(() => {
      expect(shownNames()).toEqual(["Avery Fictional"]);
    });
    expect(screen.getByText("Desk: contains “north”")).toBeDefined();
  });

  it("shows a text of several lines whole in a person's details, its lines kept", async () => {
    await open({}, "/people?open=p1");
    const details = await screen.findByRole("region", {
      name: "Avery Fictional",
    });
    const shown = within(detailRow("Directions", details)).getByText(
      /Take the east stairs/,
    );
    expect(shown.textContent).toBe(
      "Take the east stairs.\nSecond door on the left.",
    );
  });

  it("shows a drafted text in a person's details in the weight of a changed value", async () => {
    await open(
      {
        "GET /api/people": peopleHolding(
          [
            {
              ...avery,
              draft: {
                action: "changed",
                changed: ["f1"],
                live: { values: {}, links: {}, texts: {} },
                state: "waiting",
                madeBy: "Fictional Editor",
                madeAt: "2026-11-06T09:00:00.000Z",
              },
            },
          ],
          [desk, directions],
        ),
      },
      "/people?open=p1",
    );
    const details = await screen.findByRole("region", {
      name: "Avery Fictional",
    });
    // Mantine's text sets its own weight unless it inherits the changed value's.
    const drafted = within(detailRow("Desk", details)).getByText("North 4-12");
    expect(drafted.hasAttribute("data-inherit")).toBe(true);
    expect(drafted.closest('[class*="changedValue"]')).not.toBeNull();
  });

  it("shows a text a draft empties in a person's details in the weight of a changed value", async () => {
    await open(
      {
        "GET /api/people": peopleHolding(
          [
            {
              ...blake,
              draft: {
                action: "changed",
                changed: ["f1"],
                live: { values: {}, links: {}, texts: { f1: "West 1-01" } },
                state: "waiting",
                madeBy: "Fictional Editor",
                madeAt: "2026-11-06T09:00:00.000Z",
              },
            },
          ],
          [desk, directions],
        ),
      },
      "/people?open=p2",
    );
    const details = await screen.findByRole("region", {
      name: "Blake Fictional",
    });
    const emptied = within(detailRow("Desk", details)).getByText(/^No desk$/iu);
    expect(emptied.hasAttribute("data-inherit")).toBe(true);
    expect(emptied.closest('[class*="changedValue"]')).not.toBeNull();
  });

  it("edits a text of several lines in its details in a box that keeps new lines", async () => {
    const fetch = await open({}, "/people?open=p2");
    await screen.findByRole("region", { name: "Blake Fictional" });
    await userEvent.click(
      screen.getByRole("button", { name: "Change Directions" }),
    );
    const box = await screen.findByRole("textbox", { name: "Directions" });
    expect(box.tagName).toBe("TEXTAREA");
    await userEvent.type(box, "Lift{Shift>}{Enter}{/Shift}Room 4{Enter}");
    await waitFor(() => {
      expect(bodyOf(fetch, "PATCH", "/api/people/p2")).toEqual([
        { texts: { f2: "Lift\nRoom 4" } },
      ]);
    });
  });

  it("refuses text of several lines in a column of one line, and keeps it in one of several", () => {
    const oneLine = addedColumn<Person, never>(desk as Field, []);
    const severalLines = addedColumn<Person, never>(directions as Field, []);
    expect(cellKinds.text.problem(oneLine, "North\nwing")).toBe(
      "Desk: use one line",
    );
    expect(cellKinds.text.problem(severalLines, "North\nwing")).toBeUndefined();
  });

  it("empties a text of several lines in its details with the ×, keeping focus in the box", async () => {
    const fetch = await open({}, "/people?open=p1");
    await screen.findByRole("region", { name: "Avery Fictional" });
    await userEvent.click(
      screen.getByRole("button", { name: "Change Directions" }),
    );
    const box = await screen.findByRole("textbox", { name: "Directions" });
    await userEvent.click(
      screen.getByRole("button", { name: "Clear Directions" }),
    );
    expect(document.activeElement).toBe(box);
    await userEvent.keyboard("{Enter}");
    await waitFor(() => {
      expect(bodyOf(fetch, "PATCH", "/api/people/p1")).toEqual([
        { texts: { f2: null } },
      ]);
    });
  });

  it("is exported as written, its lines kept", () => {
    const column = addedColumn<Person, never>(directions as Field, []);
    expect(exportValue(column, avery as Person)).toBe(
      "Take the east stairs.\nSecond door on the left.",
    );
  });

  it("adds a text pasted into a new row as typed", async () => {
    const fetch = await open({
      "POST /api/people": () =>
        Response.json({ ids: ["p9"], changeSetId: s1 }, { status: 201 }),
    });
    const name = document.querySelector(
      '[id^="cell-new-"][id$="-preferredName"]',
    ) as HTMLElement;
    act(() => {
      name.focus();
    });
    await userEvent.paste(
      "Drew Fictional\tE9\tEast 1-01\tUse the lift\tFictional Engineer\n",
    );
    expect(bodyOf(fetch, "POST", "/api/people")).toEqual([
      {
        people: [
          {
            preferredName: "Drew Fictional",
            employeeId: "E9",
            positionId: "position-1",
            values: {},
            links: {},
            texts: { f1: "East 1-01", f2: "Use the lift" },
          },
        ],
      },
    ]);
  });
});

describe("pasting texts of several lines", () => {
  it("keeps a quoted cell's lines in one cell, as spreadsheets and Fathom's export write it", async () => {
    const fetch = await open({
      "POST /api/people": () =>
        Response.json({ ids: ["p9"], changeSetId: s1 }, { status: 201 }),
    });
    const name = document.querySelector(
      '[id^="cell-new-"][id$="-preferredName"]',
    ) as HTMLElement;
    act(() => {
      name.focus();
    });
    await userEvent.paste(
      'Drew Fictional\tE9\tEast 1-01\t"Use the lift\nThen ""Room 4"""\tFictional Engineer\n',
    );
    expect(bodyOf(fetch, "POST", "/api/people")).toEqual([
      {
        people: [
          {
            preferredName: "Drew Fictional",
            employeeId: "E9",
            positionId: "position-1",
            values: {},
            links: {},
            texts: { f1: "East 1-01", f2: 'Use the lift\nThen "Room 4"' },
          },
        ],
      },
    ]);
  });
});

describe("the New column dialog", () => {
  it("adds a text column of several lines that must be filled in, offering Several lines only for text", async () => {
    const { fetch, dialog } = await openNewColumn({
      "GET /api/people": peopleOf(),
      "POST /api/people/columns": () =>
        Response.json(
          { field: { ...directions, id: "f3", name: "Parking" } },
          { status: 201 },
        ),
    });
    await userEvent.type(within(dialog).getByLabelText("Name"), "Parking");
    await chooseIn(dialog, "Type", "Number");
    expect(within(dialog).queryByLabelText("Several lines")).toBeNull();
    await chooseIn(dialog, "Type", "Text");
    await userEvent.click(within(dialog).getByLabelText("Several lines"));
    await userEvent.click(within(dialog).getByLabelText("Must be filled in"));
    await userEvent.click(
      within(dialog).getByRole("button", { name: "Add column" }),
    );
    await waitFor(() => {
      expect(bodyOf(fetch, "POST", "/api/people/columns")).toEqual([
        {
          name: "Parking",
          type: "text",
          visibility: "general",
          multiple: false,
          required: true,
          onPlannedHires: true,
          multiline: true,
        },
      ]);
    });
  });

  it("keeps Several lines as it is once the column is added", async () => {
    await open();
    await userEvent.click(
      screen.getByRole("button", {
        name: (name) => name.startsWith("Directions column"),
      }),
    );
    await userEvent.click(
      await screen.findByRole("menuitem", { name: "Edit column…" }),
    );
    const dialog = await screen.findByRole("dialog", { name: "Edit column" });
    const lines =
      within(dialog).getByLabelText<HTMLInputElement>("Several lines");
    expect(lines.checked).toBe(true);
    expect(lines.disabled).toBe(true);
    expect(dialog.textContent).toContain(
      "Can't change once the column is added",
    );
  });
});
