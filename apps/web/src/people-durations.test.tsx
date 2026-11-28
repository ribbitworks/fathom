// SPDX-License-Identifier: Apache-2.0

// Tests for Duration columns on the People page, with the server's responses simulated: a length
// shown as typed or in the unit Show in chooses, typed with a unit or as a bare number, refused in
// the column's words, sorted by its size, filtered by its amount in the unit shown, exported and
// added up as shown, and adding the column with its unit through New column.

import { act, screen, waitFor, within } from "@testing-library/react";
import { userEvent } from "@testing-library/user-event";
import type { Field, Person } from "@fathom/shared";
import { afterEach, describe, expect, it, vi } from "vitest";
import { addedColumn } from "./added-columns.ts";
import { exportValue } from "./exports.ts";
import { shownInView } from "./grid-columns.tsx";
import { bodyOf, chooseIn } from "./test-support.tsx";
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
  shownNames,
} from "./test-people-page.tsx";

const noticeGiven = {
  id: "f1",
  keyNumber: 1,
  name: "Notice given",
  type: "duration",
  listId: null,
  visibility: "general",
  multiple: false,
  required: false,
  unit: "d",
};
const avery = personWith("p1", "Avery Fictional", "durations", {
  f1: { amount: 3, unit: "wk" },
});
const blake = personWith("p2", "Blake Fictional", "durations", {});
const casey = personWith("p3", "Casey Fictional", "durations", {
  f1: { amount: 1, unit: "mo" },
});
const devon = personWith("p4", "Devon Fictional", "durations", {
  f1: { amount: -10, unit: "d" },
});
const peopleOf = () =>
  peopleHolding([blake, avery, casey, devon], [noticeGiven]);
const open = (answers: Answers = {}, at = "/people") =>
  openPeopleWith(peopleOf(), answers, at);
const lengthOf = (row: string) => cell(row, "f1");
const choose = (item: string) => choosing("Notice given", item);

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("a Duration column", () => {
  it("shows each length as typed, counting back with a minus sign", async () => {
    await open();
    expect(lengthOf("p1").textContent).toBe("3 wk");
    expect(lengthOf("p4").textContent).toBe("−10 d");
    expect(lengthOf("p2").textContent).toBe("");
  });

  it("saves a length typed with a unit, a bare number in the column's unit, and empties it with Delete", async () => {
    const fetch = await open();
    act(() => {
      lengthOf("p2").focus();
    });
    await userEvent.keyboard("2 weeks{Enter}");
    act(() => {
      lengthOf("p3").focus();
    });
    await userEvent.keyboard("10{Enter}");
    act(() => {
      lengthOf("p1").focus();
    });
    await userEvent.keyboard("{Delete}");
    await waitFor(() => {
      expect(bodyOf(fetch, "PATCH", "/api/people/p2")).toEqual([
        { durations: { f1: { amount: 2, unit: "wk" } } },
      ]);
      expect(bodyOf(fetch, "PATCH", "/api/people/p3")).toEqual([
        { durations: { f1: { amount: 10, unit: "d" } } },
      ]);
      expect(bodyOf(fetch, "PATCH", "/api/people/p1")).toEqual([
        { durations: { f1: null } },
      ]);
    });
  });

  it("refuses part of a unit in the column's words, sending nothing", async () => {
    const fetch = await open();
    act(() => {
      lengthOf("p2").focus();
    });
    await userEvent.keyboard("1.5 mo{Enter}");
    expect(
      await screen.findByText(
        "Type a whole number for Notice given, such as 2 wk",
      ),
    ).toBeDefined();
    expect(bodyOf(fetch, "PATCH", "/api/people/p2")).toEqual([]);
  });

  it("finds a length by what was typed", async () => {
    await open();
    await userEvent.type(
      screen.getByRole("textbox", { name: "Search people" }),
      "3 wk",
    );
    await waitFor(() => {
      expect(shownNames()).toEqual(["Avery Fictional"]);
    });
  });

  it("sorts by each length's size, whatever its unit", async () => {
    await open();
    await choose("Lowest first");
    await waitFor(() => {
      expect(shownNames().slice(0, 3)).toEqual([
        "Devon Fictional",
        "Avery Fictional",
        "Casey Fictional",
      ]);
    });
    await choose("Highest first");
    await waitFor(() => {
      expect(shownNames().slice(0, 3)).toEqual([
        "Casey Fictional",
        "Avery Fictional",
        "Devon Fictional",
      ]);
    });
  });

  it("shows every length in the unit Show in chooses, where a bare number is then typed", async () => {
    const fetch = await open();
    await choose("Weeks");
    await waitFor(() => {
      expect(lengthOf("p3").textContent).toBe("4.3 wk");
    });
    expect(lengthOf("p1").textContent).toBe("3 wk");
    expect(lengthOf("p4").textContent).toBe("−1.4 wk");
    act(() => {
      lengthOf("p2").focus();
    });
    await userEvent.keyboard("2{Enter}");
    await waitFor(() => {
      expect(bodyOf(fetch, "PATCH", "/api/people/p2")).toEqual([
        { durations: { f1: { amount: 2, unit: "wk" } } },
      ]);
    });
  });

  it("starts Show in on As typed, ticked", async () => {
    await open();
    await userEvent.click(
      screen.getByRole("button", { name: /^Notice given column/u }),
    );
    expect(
      await screen.findByRole("menuitem", { name: /^As typed.*chosen/u }),
    ).toBeDefined();
  });

  it("changes a length in a person's details, typed with its unit and no menu of units", async () => {
    const fetch = await open({}, "/people?open=p2");
    await screen.findByRole("region", { name: "Blake Fictional" });
    await userEvent.click(
      screen.getByRole("button", { name: "Change Notice given" }),
    );
    const box = await screen.findByRole("textbox", { name: "Notice given" });
    expect(screen.queryByRole("textbox", { name: /unit/iu })).toBeNull();
    await userEvent.type(box, "3 mo{Enter}");
    await waitFor(() => {
      expect(bodyOf(fetch, "PATCH", "/api/people/p2")).toEqual([
        { durations: { f1: { amount: 3, unit: "mo" } } },
      ]);
    });
  });

  it("filters by an amount in the unit shown, or by No duration, named in its pill", async () => {
    await open();
    await choose("Filter…");
    const filter = await screen.findByRole("dialog", {
      name: "Filter Notice given",
    });
    await userEvent.type(
      within(filter).getByRole("textbox", {
        name: "At least in calendar days",
      }),
      "20",
    );
    await waitFor(() => {
      expect(shownNames()).toEqual(["Avery Fictional", "Casey Fictional"]);
    });
    await userEvent.click(
      within(filter).getByRole("checkbox", { name: "No duration" }),
    );
    expect(
      screen.getByText("Notice given: at least 20 d or No duration"),
    ).toBeDefined();
  });

  it("filters by a length typed with its unit, refusing what a cell would in the bound's words", async () => {
    await open();
    await choose("Filter…");
    const filter = await screen.findByRole("dialog", {
      name: "Filter Notice given",
    });
    const least = within(filter).getByRole("textbox", {
      name: "At least in calendar days",
    });
    await userEvent.type(least, "1.5 mo");
    expect(
      within(filter).getByText(
        "Type a whole number for At least, such as 2 wk",
      ),
    ).toBeDefined();
    await userEvent.clear(least);
    await userEvent.type(least, "4 wk");
    await waitFor(() => {
      expect(shownNames()).toEqual(["Casey Fictional"]);
    });
    expect(screen.getByText("Notice given: at least 28 d")).toBeDefined();
    const most = within(filter).getByRole("textbox", {
      name: "At most in calendar days",
    });
    await userEvent.type(most, "1 wk");
    expect(within(filter).getByText("Type 28 d or more")).toBeDefined();
  });

  it("keeps a bound exactly, naming it in the unit shown to its decimal places", async () => {
    await open();
    await choose("Weeks");
    await choose("Filter…");
    const filter = await screen.findByRole("dialog", {
      name: "Filter Notice given",
    });
    await userEvent.type(
      within(filter).getByRole("textbox", { name: "At least in weeks" }),
      "1 mo",
    );
    expect(
      await screen.findByText("Notice given: at least 4.3 wk"),
    ).toBeDefined();
  });

  it("applies nothing of a range whose At most comes before its At least", async () => {
    await open();
    await choose("Filter…");
    const filter = await screen.findByRole("dialog", {
      name: "Filter Notice given",
    });
    await userEvent.type(
      within(filter).getByRole("textbox", { name: "At most in calendar days" }),
      "1 wk",
    );
    expect(screen.getByText("Notice given: at most 7 d")).toBeDefined();
    await userEvent.type(
      within(filter).getByRole("textbox", {
        name: "At least in calendar days",
      }),
      "2 wk",
    );
    expect(within(filter).getByText("Type 14 d or more")).toBeDefined();
    await waitFor(() => {
      expect(screen.queryByText(/^Notice given: /u)).toBeNull();
    });
  });

  it("includes a cell of exactly the length typed, in whatever unit is shown", async () => {
    await open();
    await choose("Weeks");
    await choose("Filter…");
    const filter = await screen.findByRole("dialog", {
      name: "Filter Notice given",
    });
    await userEvent.type(
      within(filter).getByRole("textbox", { name: "At least in weeks" }),
      "1 mo",
    );
    await waitFor(() => {
      expect(shownNames()).toEqual(["Casey Fictional"]);
    });
  });

  it("reopens a bound set before as its amount, unrefused, and clears it", async () => {
    await open({}, '/people?filters={"f1":{"atLeast":4.5}}');
    await choose("Filter…");
    const filter = await screen.findByRole("dialog", {
      name: "Filter Notice given",
    });
    const least = within(filter).getByRole("textbox", {
      name: "At least in calendar days",
    });
    expect(least).toHaveProperty("value", "4.5 d");
    expect(within(filter).queryByText(/^Type /u)).toBeNull();
    await userEvent.click(
      within(filter).getByRole("button", { name: "Clear At least" }),
    );
    await waitFor(() => {
      expect(shownNames()).toHaveLength(4);
    });
  });

  it("filters by an upper bound alone, counting back below nothing", async () => {
    await open();
    await choose("Filter…");
    const filter = await screen.findByRole("dialog", {
      name: "Filter Notice given",
    });
    await userEvent.type(
      within(filter).getByRole("textbox", { name: "At most in calendar days" }),
      "-1",
    );
    await waitFor(() => {
      expect(shownNames()).toEqual(["Devon Fictional"]);
    });
    expect(screen.getByText("Notice given: at most −1 d")).toBeDefined();
  });

  it("is exported as typed, or as an amount of the unit shown", () => {
    const column = addedColumn<Person, never>(noticeGiven as Field, []);
    expect(exportValue(column, avery as Person)).toBe("3 wk");
    expect(exportValue(column, blake as Person)).toBe("");
    const { column: inWeeks } = shownInView(
      column,
      column.units as NonNullable<typeof column.units>,
      { units: { f1: "wk" }, places: { f1: 2 } },
    );
    expect(exportValue(inWeeks, casey as Person)).toBe("4.35");
    expect(exportValue(inWeeks, blake as Person)).toBe("");
  });

  it("adds lengths up in the unit shown, or its own while shown as typed", () => {
    const column = addedColumn<Person, never>(noticeGiven as Field, []);
    expect(column.sum?.amount(avery as Person)).toBe(21);
    expect(column.sum?.amount(blake as Person)).toBeNull();
    expect(column.sum?.shown?.(21)).toBe("21 d");
    const { column: inWeeks } = shownInView(
      column,
      column.units as NonNullable<typeof column.units>,
      { units: { f1: "wk" } },
    );
    expect(inWeeks.sum?.shown?.(21)).toBe("3 wk");
  });
});

describe("the New column dialog", () => {
  it("adds a Duration column with the unit a bare number takes", async () => {
    const { fetch, dialog } = await openNewColumn({
      "GET /api/people": peopleOf(),
      "POST /api/people/columns": () =>
        Response.json(
          { field: { ...noticeGiven, id: "f3", name: "Ramp-up" } },
          { status: 201 },
        ),
    });
    await userEvent.type(within(dialog).getByLabelText("Name"), "Ramp-up");
    await chooseIn(dialog, "Type", "Duration");
    await chooseIn(dialog, "Unit", "Working days");
    await userEvent.click(
      within(dialog).getByRole("button", { name: "Add column" }),
    );
    await waitFor(() => {
      expect(bodyOf(fetch, "POST", "/api/people/columns")).toEqual([
        {
          name: "Ramp-up",
          type: "duration",
          visibility: "general",
          multiple: false,
          required: false,
          unit: "wd",
        },
      ]);
    });
  });
});
