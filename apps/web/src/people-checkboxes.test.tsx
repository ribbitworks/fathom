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
import {
  bodyOf,
  detailRow,
  chooseIn,
  fictionalUser,
  optionsIn,
  positions,
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
const personWith = (id: string, name: string, flags: object) => ({
  id,
  keyNumber: 1,
  preferredName: name,
  employeeId: id,
  positionId: "position-1",
  values: {},
  links: {},
  flags,
});
const avery = personWith("p1", "Avery Fictional", { f1: true });
const blake = personWith("p2", "Blake Fictional", {});
const casey = personWith("p3", "Casey Fictional", { f1: true });
const peopleAnswer =
  (people: object[] = [blake, avery, casey]) =>
  () =>
    Response.json({
      people,
      fields: [firstAider],
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
    "PATCH /api/people/p2": () => Response.json({ changeSetId: s1 }),
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

async function choose(item: string) {
  await userEvent.click(
    screen.getByRole("button", {
      name: (name) => name.startsWith("First aider column"),
    }),
  );
  await userEvent.click(await screen.findByRole("menuitem", { name: item }));
}

describe("a checkbox column", () => {
  it("shows each box ticked or not, as Manager? does", async () => {
    await openPeople();
    expect(cell("p1").textContent).toBe("Yes");
    expect(cell("p2").textContent).toBe("No");
  });

  it("ticks a box with a click, and unticks one with Space or Enter", async () => {
    const fetch = await openPeople();
    await userEvent.click(cell("p2"));
    act(() => {
      cell("p1").focus();
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
    await openPeople({
      "GET /api/people": peopleAnswer([
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
    expect(cell("p2").textContent).toContain("Yes");
    expect(cell("p2").textContent).toContain("live No");
    // The Live row draws the box unticked, since a box is never empty.
    const liveBox = cell("p2")
      .closest("tr")
      ?.nextElementSibling?.querySelector<HTMLInputElement>(
        `td:nth-child(${String(
          [...(cell("p2").closest("tr")?.children ?? [])].indexOf(
            cell("p2").closest("td") as Element,
          ) + 1,
        )}) input[type="checkbox"]`,
      );
    expect(liveBox?.checked).toBe(false);
  });

  it("shows a box a draft unticks as ticked when only live records show", async () => {
    await openPeople(
      {
        "GET /api/people": peopleAnswer([
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
    expect(cell("p2").textContent).toContain("Yes");
  });

  it("sorts ticked boxes first or last", async () => {
    await openPeople();
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
    await openPeople();
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
    await openPeople({}, "/people?open=p1");
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
  async function openDialog(answers: Answers = {}) {
    const fetch = await openPeople(answers);
    await userEvent.click(screen.getByRole("button", { name: "New column" }));
    return {
      fetch,
      dialog: await screen.findByRole("dialog", { name: "New column" }),
    };
  }

  it("lists the types Fathom offers, in order", async () => {
    const { dialog } = await openDialog();
    expect(await optionsIn(dialog, "Type")).toEqual([
      "Number",
      "Checkbox",
      "Choice from a list",
      "Web link",
      "Note",
    ]);
  });

  it("adds a checkbox column, never asking whether it must be filled in", async () => {
    const { fetch, dialog } = await openDialog({
      "POST /api/people/columns": () =>
        Response.json(
          { field: { ...firstAider, id: "f2", name: "Fire warden" } },
          { status: 201 },
        ),
    });
    await userEvent.type(within(dialog).getByLabelText("Name"), "Fire warden");
    await chooseIn(dialog, "Type", "Number");
    await userEvent.click(within(dialog).getByLabelText("Must be filled in"));
    await chooseIn(dialog, "Type", "Checkbox");
    expect(within(dialog).queryByLabelText("Must be filled in")).toBeNull();
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
          onPlannedHires: true,
        },
      ]);
    });
  });
});
