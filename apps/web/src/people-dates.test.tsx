// SPDX-License-Identifier: Apache-2.0

// Tests for date columns on the People page, with the server's responses simulated: a day shown in
// its cell and a person's details, typed and pasted, refused when it doesn't exist, sorted oldest or
// newest first, filtered from and until a day or by No date, exported as typed, and adding the
// column through New column.

import { act, screen, waitFor, within } from "@testing-library/react";
import { userEvent } from "@testing-library/user-event";
import type { Field, Person } from "@fathom/shared";
import { afterEach, describe, expect, it, vi } from "vitest";
import { addedColumn } from "./added-columns.ts";
import { formatDay } from "./day-formats.ts";
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

const lastReview = {
  id: "f1",
  keyNumber: 1,
  name: "Last review",
  type: "date",
  listId: null,
  visibility: "general",
  multiple: false,
  required: false,
};
const avery = personWith("p1", "Avery Fictional", "days", {
  f1: "2026-03-14",
});
const blake = personWith("p2", "Blake Fictional", "days", {});
const casey = personWith("p3", "Casey Fictional", "days", {
  f1: "2025-11-02",
});
const peopleOf = () => peopleHolding([blake, avery, casey], [lastReview]);
const open = (answers: Answers = {}, at = "/people") =>
  openPeopleWith(peopleOf(), answers, at);
const dayOf = (row: string) => cell(row, "f1");
const choose = (item: string) => choosing("Last review", item);

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("a date column", () => {
  it("shows each day in its cell as the app's other days are", async () => {
    await open();
    expect(dayOf("p1").textContent).toBe(formatDay("2026-03-14"));
    expect(dayOf("p2").textContent).toBe("");
  });

  it("saves a day typed in its cell as digits, and empties it with Delete", async () => {
    const fetch = await open();
    act(() => {
      dayOf("p2").focus();
    });
    await userEvent.keyboard("20260401{Enter}");
    act(() => {
      dayOf("p1").focus();
    });
    await userEvent.keyboard("{Delete}");
    await waitFor(() => {
      expect(bodyOf(fetch, "PATCH", "/api/people/p2")).toEqual([
        { days: { f1: "2026-04-01" } },
      ]);
      expect(bodyOf(fetch, "PATCH", "/api/people/p1")).toEqual([
        { days: { f1: null } },
      ]);
    });
  });

  it("refuses a day that doesn't exist, under the row", async () => {
    const fetch = await open();
    act(() => {
      dayOf("p2").focus();
    });
    await userEvent.keyboard("20260230{Enter}");
    expect(
      await screen.findByText(
        "Type a date for Last review, such as 2026-10-31",
      ),
    ).toBeDefined();
    expect(bodyOf(fetch, "PATCH", "/api/people/p2")).toEqual([]);
  });

  it("sorts oldest first, or newest first", async () => {
    await open();
    await choose("Newest first");
    await waitFor(() => {
      expect(shownNames().slice(0, 2)).toEqual([
        "Avery Fictional",
        "Casey Fictional",
      ]);
    });
    await choose("Oldest first");
    await waitFor(() => {
      expect(shownNames().slice(0, 2)).toEqual([
        "Casey Fictional",
        "Avery Fictional",
      ]);
    });
  });

  it("filters from a day or with no date, named in its pill", async () => {
    await open();
    await choose("Filter…");
    const filter = await screen.findByRole("dialog", {
      name: "Filter Last review",
    });
    await userEvent.type(
      within(filter).getByRole("textbox", { name: "From" }),
      "2026-03-01",
    );
    await waitFor(() => {
      expect(shownNames()).toEqual(["Avery Fictional"]);
    });
    await userEvent.click(
      within(filter).getByRole("checkbox", { name: "No date" }),
    );
    expect(
      screen.getByText(
        `Last review: from ${formatDay("2026-03-01")} or No date`,
      ),
    ).toBeDefined();
    expect(shownNames()).toEqual(["Blake Fictional", "Avery Fictional"]);
  });

  it("shows a day in a person's details", async () => {
    await open({}, "/people?open=p1");
    const details = await screen.findByRole("region", {
      name: "Avery Fictional",
    });
    expect(detailRow("Last review", details).textContent).toContain(
      formatDay("2026-03-14"),
    );
  });

  it("shows None in a person's details for no day", async () => {
    await open({}, "/people?open=p2");
    const details = await screen.findByRole("region", {
      name: "Blake Fictional",
    });
    expect(detailRow("Last review", details).textContent).toContain("None");
  });

  it("changes a day in a person's details, typed as digits", async () => {
    const fetch = await open({}, "/people?open=p2");
    await screen.findByRole("region", { name: "Blake Fictional" });
    await userEvent.click(
      screen.getByRole("button", { name: "Change Last review" }),
    );
    const box = await screen.findByRole("textbox", { name: "Last review" });
    await userEvent.type(box, "20260401{Enter}");
    await waitFor(() => {
      expect(bodyOf(fetch, "PATCH", "/api/people/p2")).toEqual([
        { days: { f1: "2026-04-01" } },
      ]);
    });
  });

  it("is exported as typed", () => {
    const column = addedColumn<Person, never>(lastReview as Field, []);
    expect(exportValue(column, avery as Person)).toBe("2026-03-14");
    expect(exportValue(column, blake as Person)).toBe("");
  });

  it("adds a day pasted into a new row as typed", async () => {
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
      "Drew Fictional\tE9\t2026-03-14\tFictional Engineer\n",
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
            days: { f1: "2026-03-14" },
          },
        ],
      },
    ]);
  });
});

describe("the New column dialog", () => {
  it("adds a required date column, with no settings of its own", async () => {
    const { fetch, dialog } = await openNewColumn({
      "GET /api/people": peopleOf(),
      "POST /api/people/columns": () =>
        Response.json(
          { field: { ...lastReview, id: "f3", name: "Next review" } },
          { status: 201 },
        ),
    });
    await userEvent.type(within(dialog).getByLabelText("Name"), "Next review");
    await chooseIn(dialog, "Type", "Date");
    await userEvent.click(within(dialog).getByLabelText("Required"));
    await userEvent.click(
      within(dialog).getByRole("button", { name: "Add column" }),
    );
    await waitFor(() => {
      expect(bodyOf(fetch, "POST", "/api/people/columns")).toEqual([
        {
          name: "Next review",
          type: "date",
          visibility: "general",
          multiple: false,
          required: true,
          onPlannedHires: true,
        },
      ]);
    });
  });
});
