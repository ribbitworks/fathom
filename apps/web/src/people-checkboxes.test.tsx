// SPDX-License-Identifier: Apache-2.0

// Tests for checkbox columns on the People page, with the server's responses simulated: a box shown
// ticked or not, ticking and unticking it from the mouse and the keyboard, pasting one, a drafted
// box's live value, sorting, filtering and exporting by it, and adding the column.

import { act, screen, waitFor, within } from "@testing-library/react";
import { userEvent } from "@testing-library/user-event";
import type { Field, Person } from "@fathom/shared";
import { afterEach, describe, expect, it, vi } from "vitest";
import { addedColumn } from "./added-columns.ts";
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

const firstAider = {
  id: "f1",
  keyNumber: 1,
  name: "First aider",
  type: "flag",
  listId: null,
  visibility: "general",
  multiple: false,
  required: false,
};
const avery = personWith("p1", "Avery Fictional", "flags", { f1: true });
const blake = personWith("p2", "Blake Fictional", "flags", {});
const casey = personWith("p3", "Casey Fictional", "flags", { f1: true });
const peopleOf = (people: object[] = [blake, avery, casey]) =>
  peopleHolding(people, [firstAider]);
const open = (answers: Answers = {}, at = "/people") =>
  openPeopleWith(peopleOf(), answers, at);
const boxOf = (row: string) => cell(row, "f1");
const choose = (item: string) => choosing("First aider", item);

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("a checkbox column", () => {
  it("shows each box ticked or not, as Manager? does", async () => {
    await open();
    expect(boxOf("p1").textContent).toBe("Yes");
    expect(boxOf("p2").textContent).toBe("No");
  });

  it("ticks a box with a click, and unticks one with Space or Enter", async () => {
    const fetch = await open();
    await userEvent.click(boxOf("p2"));
    act(() => {
      boxOf("p1").focus();
    });
    await userEvent.keyboard(" ");
    await waitFor(() => {
      expect(bodyOf(fetch, "PATCH", "/api/people/p2")).toEqual([
        { flags: { f1: true } },
      ]);
      expect(bodyOf(fetch, "PATCH", "/api/people/p1")).toEqual([
        { flags: { f1: null } },
      ]);
    });
    await userEvent.keyboard("{Enter}");
    await waitFor(() => {
      expect(bodyOf(fetch, "PATCH", "/api/people/p1")).toHaveLength(2);
    });
  });

  it("shows a drafted box's live value in the Live row", async () => {
    await open({
      "GET /api/people": peopleOf([
        {
          ...blake,
          flags: { f1: true },
          draft: {
            action: "changed",
            changed: ["f1"],
            live: { values: {}, links: {}, flags: {} },
            state: "waiting",
            madeBy: "Fictional Editor",
            madeAt: "2026-11-06T09:00:00.000Z",
          },
        },
      ]),
    });
    expect(boxOf("p2").textContent).toContain("Yes");
    expect(boxOf("p2").textContent).toContain("live No");
    // The Live row draws the box unticked, since a box is never empty.
    const liveBox = boxOf("p2")
      .closest("tr")
      ?.nextElementSibling?.querySelector<HTMLInputElement>(
        `td:nth-child(${String(
          [...(boxOf("p2").closest("tr")?.children ?? [])].indexOf(
            boxOf("p2").closest("td") as Element,
          ) + 1,
        )}) input[type="checkbox"]`,
      );
    expect(liveBox?.checked).toBe(false);
  });

  it("shows a box a draft unticks as an empty box after its dot, with no words for none", async () => {
    // Given a person whose draft unticks their box
    await open({
      "GET /api/people": peopleOf([
        {
          ...blake,
          draft: {
            action: "changed",
            changed: ["f1"],
            live: { values: {}, links: {}, flags: { f1: true } },
            state: "waiting",
            madeBy: "Fictional Editor",
            madeAt: "2026-11-06T09:00:00.000Z",
          },
        },
      ]),
    });
    // Then their cell draws the box unticked, as any other box, and says nothing more
    const box = boxOf("p2").querySelector<HTMLInputElement>(
      'input[type="checkbox"]',
    );
    expect(box?.checked).toBe(false);
    expect(boxOf("p2").textContent).not.toMatch(/No first aider/iu);
  });

  it("shows a box a draft unticks as ticked when only live records show", async () => {
    await open(
      {
        "GET /api/people": peopleOf([
          {
            ...blake,
            draft: {
              action: "changed",
              changed: ["f1"],
              live: { values: {}, links: {}, flags: { f1: true } },
              state: "waiting",
              madeBy: "Fictional Editor",
              madeAt: "2026-11-06T09:00:00.000Z",
            },
          },
        ]),
      },
      "/people?show=live",
    );
    expect(boxOf("p2").textContent).toContain("Yes");
  });

  it("sorts ticked boxes first or last", async () => {
    await open();
    await choose("Unchecked first");
    await waitFor(() => {
      expect(shownNames()[0]).toBe("Blake Fictional");
    });
    await choose("Checked first");
    await waitFor(() => {
      expect(shownNames().at(-1)).toBe("Blake Fictional");
    });
  });

  it("filters to ticked boxes, named Yes in its pill", async () => {
    await open();
    await choose("Filter…");
    const filter = await screen.findByRole("dialog", {
      name: "Filter First aider",
    });
    await userEvent.click(
      within(filter).getByRole("checkbox", { name: "Yes" }),
    );
    expect(screen.getByText("First aider: Yes")).toBeDefined();
    expect(shownNames()).toEqual(["Avery Fictional", "Casey Fictional"]);
  });

  it("shows a person's box in their details", async () => {
    await open({}, "/people?open=p1");
    const details = await screen.findByRole("region", {
      name: "Avery Fictional",
    });
    expect(detailRow("First aider", details).textContent).toContain("Yes");
  });

  it("is exported as Yes or No", () => {
    const column = addedColumn<Person, never>(firstAider as Field, []);
    expect(
      [avery, blake].map((person) => exportValue(column, person as Person)),
    ).toEqual(["Yes", "No"]);
  });

  it("adds a ticked box from Yes pasted into a new row", async () => {
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
    await userEvent.paste("Drew Fictional\tE9\tYes\tFictional Engineer\n");
    expect(bodyOf(fetch, "POST", "/api/people")).toEqual([
      {
        people: [
          {
            preferredName: "Drew Fictional",
            employeeId: "E9",
            positionId: "position-1",
            values: {},
            links: {},
            flags: { f1: true },
          },
        ],
      },
    ]);
  });
});

describe("the New column dialog", () => {
  it("adds a checkbox column, never asking whether it must be filled in", async () => {
    const { fetch, dialog } = await openNewColumn({
      "GET /api/people": peopleOf(),
      "POST /api/people/columns": () =>
        Response.json(
          { field: { ...firstAider, id: "f2", name: "Fire warden" } },
          { status: 201 },
        ),
    });
    await userEvent.type(within(dialog).getByLabelText("Name"), "Fire warden");
    await chooseIn(dialog, "Type", "Number");
    await userEvent.click(within(dialog).getByLabelText("Required"));
    await chooseIn(dialog, "Type", "Checkbox");
    expect(within(dialog).queryByLabelText("Required")).toBeNull();
    await userEvent.click(
      within(dialog).getByRole("button", { name: "Add column" }),
    );
    await waitFor(() => {
      expect(bodyOf(fetch, "POST", "/api/people/columns")).toEqual([
        {
          name: "Fire warden",
          type: "flag",
          visibility: "general",
          multiple: false,
          required: false,
        },
      ]);
    });
  });
});
