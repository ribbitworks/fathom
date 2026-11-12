// SPDX-License-Identifier: Apache-2.0

// Tests for Note columns on the People page, with the server's responses simulated: a note's
// preview in its cell, opening its side panel with a click or Enter, saving it as a change, reading it
// without being able to change it, clearing and pasting, a drafted note beside its live one,
// searching by its words, and adding a Note column with its visibility. The note panel and format
// alone are tested in note-editor.test.tsx and the shared package's notes.test.ts.

import { colourTag } from "@fathom/shared";
import {
  act,
  fireEvent,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import { userEvent } from "@testing-library/user-event";
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import {
  bodyOf,
  fictionalUser,
  renderApp,
  serverAnswers,
} from "./test-support.tsx";

const s1 = "00000000-0000-4000-8000-000000000001";

const session = (permissions: string[]) => () =>
  Response.json({ ...fictionalUser, permissions });
const editor = session([
  "configuration:edit",
  "configuration:view",
  "people:edit",
  "people:view",
  "plan:view",
  "features:view",
]);
const viewer = session(["people:view", "plan:view", "features:view"]);

const background = {
  id: "f1",
  name: "Background",
  type: "note",
  listId: null,
  visibility: "general",
  multiple: false,
  required: false,
};
const averyNote = `**Joined** from the ${colourTag("teal")}platform</span> team`;
const avery = {
  id: "p1",
  preferredName: "Avery Fictional",
  employeeId: "E1",
  positionId: "position-1",
  values: {},
  links: {},
  notes: { f1: averyNote },
};
const blake = {
  id: "p2",
  preferredName: "Blake Fictional",
  employeeId: "E2",
  positionId: "position-1",
  values: {},
  links: {},
};
const peopleAnswer =
  (people: object[] = [avery, blake]) =>
  () =>
    Response.json({
      people,
      fields: [background],
      order: ["preferredName", "employeeId", "f1"],
      views: [],
    });
const saved = () => Response.json({ changeSetId: s1 });
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

// The test browser lays nothing out, so the editor's measurements of where text is find nothing.
beforeAll(() => {
  Range.prototype.getClientRects = () => [] as unknown as DOMRectList;
  Range.prototype.getBoundingClientRect = () => new DOMRect();
});

afterEach(() => {
  vi.unstubAllGlobals();
});

type Answers = Parameters<typeof serverAnswers>[0];

async function openPeople(answers: Answers = {}, session = editor) {
  const fetch = serverAnswers({
    "GET /api/session": session,
    "GET /api/people": peopleAnswer(),
    "GET /api/lists": () => Response.json({ lists: [positions] }),
    ...answers,
  });
  renderApp("/people");
  await screen.findByRole("grid", { name: "People" });
  return fetch;
}

const cell = (row: string) =>
  document.getElementById(`cell-${row}-f1`) as HTMLElement;

const panel = () => screen.findByRole("region", { name: "Background" });

describe("a Note column", () => {
  it("asks before Add discards a new person's note being changed", async () => {
    await openPeople();
    await userEvent.click(screen.getByRole("button", { name: "New" }));
    await userEvent.type(
      await screen.findByRole("textbox", { name: "Name" }),
      "Fictional Starter",
    );
    await userEvent.type(screen.getByRole("textbox", { name: "ID" }), "E9");
    await userEvent.click(
      screen.getByRole("button", { name: "Change Position" }),
    );
    await userEvent.click(
      await screen.findByRole("option", { name: "Fictional Engineer" }),
    );
    await userEvent.click(
      screen.getByRole("button", { name: "Change Background" }),
    );
    const opened = await screen.findByRole("region", {
      name: "Background for New person",
    });
    await userEvent.click(within(opened).getByText("Markdown"));
    await userEvent.type(
      within(opened).getByRole("textbox", { name: "Markdown" }),
      "Words",
    );
    await userEvent.click(
      within(screen.getByRole("region", { name: "New person" })).getByRole(
        "button",
        { name: "Add" },
      ),
    );
    expect(
      await screen.findByText("Discard changes to the note?"),
    ).toBeTruthy();
    await userEvent.click(screen.getByRole("button", { name: "Keep writing" }));
    expect(
      screen.getByRole("region", { name: "Background for New person" }),
    ).toBeTruthy();
  });

  it("keeps what is entered in a new person's form while its note is written", async () => {
    await openPeople();
    await userEvent.click(screen.getByRole("button", { name: "New" }));
    await userEvent.click(
      await screen.findByRole("button", { name: "Change Background" }),
    );
    const opened = await screen.findByRole("region", {
      name: "Background for New person",
    });
    await userEvent.click(within(opened).getByText("Markdown"));
    await userEvent.type(
      within(opened).getByRole("textbox", { name: "Markdown" }),
      "Words",
    );
    await userEvent.click(
      screen.getByRole("button", { name: "Change Position" }),
    );
    await userEvent.click(
      await screen.findByRole("option", { name: "Fictional Engineer" }),
    );
    await userEvent.click(within(opened).getByRole("button", { name: "Save" }));
    await waitFor(() => {
      expect(
        screen.queryByRole("region", { name: "Background for New person" }),
      ).toBeNull();
    });
    const details = screen.getByRole("region", { name: "New person" });
    expect(within(details).getByText("Words")).toBeTruthy();
    expect(within(details).getByText("Fictional Engineer")).toBeTruthy();
  });

  it("previews each note's words in its cell", () => {
    return openPeople().then(() => {
      expect(cell("p1").textContent).toBe("Joined from the platform team");
      expect(cell("p2").textContent).toBe("");
    });
  });

  it("opens the note's panel with a click, and saves the note written there", async () => {
    const fetch = await openPeople({ "PATCH /api/people/p1": saved });
    fireEvent.click(cell("p1"));
    const opened = await panel();
    await userEvent.click(within(opened).getByText("Markdown"));
    const markdown = within(opened).getByRole("textbox", { name: "Markdown" });
    expect((markdown as HTMLTextAreaElement).value).toBe(averyNote);
    await userEvent.type(markdown, " in 2026");
    await userEvent.click(within(opened).getByRole("button", { name: "Save" }));
    await waitFor(() => {
      expect(bodyOf(fetch, "PATCH", "/api/people/p1")).toEqual([
        { notes: { f1: `${averyNote} in 2026` } },
      ]);
    });
  });

  it("opens the note's panel with Enter, and closes it with Cancel, saving nothing", async () => {
    const fetch = await openPeople();
    act(() => {
      cell("p2").focus();
    });
    await userEvent.keyboard("{Enter}");
    const opened = await panel();
    await userEvent.click(
      within(opened).getByRole("button", { name: "Cancel" }),
    );
    await waitFor(() => {
      expect(screen.queryByRole("region", { name: "Background" })).toBeNull();
    });
    expect(bodyOf(fetch, "PATCH", "/api/people/p2")).toEqual([]);
  });

  it("keeps keys and pasting in the panel from reaching the table", async () => {
    const fetch = await openPeople({ "PATCH /api/people/p1": saved });
    fireEvent.click(cell("p1"));
    const opened = await panel();
    await userEvent.click(within(opened).getByText("Markdown"));
    const markdown = within(opened).getByRole("textbox", { name: "Markdown" });
    await userEvent.click(markdown);
    await userEvent.keyboard("{Delete}{ArrowDown}");
    await userEvent.paste("Pasted\tcells\nhere");
    expect(bodyOf(fetch, "PATCH", "/api/people/p1")).toEqual([]);
    expect(screen.getByRole("region", { name: "Background" })).toBe(opened);
  });

  it("shows the note, read only, to those who may not change it", async () => {
    await openPeople({}, viewer);
    fireEvent.click(cell("p1"));
    const opened = await panel();
    expect(within(opened).getByText("Joined").tagName).toBe("STRONG");
    expect(within(opened).queryByRole("button", { name: "Save" })).toBeNull();
  });

  it("opens read only with Enter where the note may not change", async () => {
    await openPeople({}, viewer);
    act(() => {
      cell("p1").focus();
    });
    await userEvent.keyboard("{Enter}");
    const opened = await panel();
    await userEvent.click(
      within(opened).getByRole("button", { name: "Close note" }),
    );
    await waitFor(() => {
      expect(document.activeElement).toBe(cell("p1"));
    });
  });

  it("is resized by its edge, and puts focus back on its cell once saved", async () => {
    await openPeople({ "PATCH /api/people/p1": saved });
    fireEvent.click(cell("p1"));
    const opened = await panel();
    expect(
      screen.getByRole("separator", { name: "Resize Background" }),
    ).toBeDefined();
    await userEvent.click(within(opened).getByText("Editor"));
    await userEvent.click(within(opened).getByRole("button", { name: "Save" }));
    await waitFor(() => {
      expect(document.activeElement).toBe(cell("p1"));
    });
  });

  it("keeps other notes from opening until it is saved or cancelled", async () => {
    await openPeople();
    fireEvent.click(cell("p1"));
    const opened = await panel();
    await userEvent.click(within(opened).getByText("Editor"));
    fireEvent.click(cell("p2"));
    act(() => {
      cell("p2").focus();
    });
    await userEvent.keyboard("x");
    expect(screen.getByRole("region", { name: "Background" })).toBe(opened);
    expect(opened.textContent).toContain("Joined from the platform team");
  });

  it("opens a note as it reads, and an empty one ready to write", async () => {
    await openPeople();
    fireEvent.click(cell("p1"));
    const opened = await panel();
    expect(within(opened).queryByRole("textbox", { name: "Note" })).toBeNull();
    await userEvent.click(
      within(opened).getByRole("button", { name: "Close note" }),
    );
    fireEvent.click(cell("p2"));
    expect(
      await within(await panel()).findByRole("textbox", { name: "Note" }),
    ).toBeDefined();
  });

  it("shows above the Metrics panel while both are open, and lets the table be used while the note is only read", async () => {
    await openPeople();
    await userEvent.click(screen.getByRole("button", { name: "Metrics" }));
    await screen.findByRole("region", { name: "Metrics" });
    fireEvent.click(cell("p1"));
    const opened = await panel();
    const metrics = screen.getByRole("region", { name: "Metrics" });
    expect(
      opened.compareDocumentPosition(metrics) &
        Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
    expect(
      screen
        .getByRole("separator", { name: "Resize Background and metrics" })
        .getAttribute("aria-controls"),
    ).toBe(`${opened.id} ${metrics.id}`);
    expect(
      screen.getByRole("separator", {
        name: "Resize heights of Background and metrics",
      }),
    ).toBeDefined();
    fireEvent.click(cell("p2"));
    expect(
      await within(await panel()).findByRole("textbox", { name: "Note" }),
    ).toBeDefined();
    await userEvent.click(screen.getByRole("button", { name: "Metrics" }));
    expect(screen.queryByRole("region", { name: "Metrics" })).toBeNull();
    expect(await panel()).toBeDefined();
  });

  it("stays open, and saves to its person, while their row is searched away", async () => {
    const fetch = await openPeople({ "PATCH /api/people/p1": saved });
    fireEvent.click(cell("p1"));
    const opened = await panel();
    await userEvent.type(
      screen.getByRole("textbox", { name: "Search people" }),
      "Blake",
    );
    await waitFor(() => {
      expect(cell("p1")).toBeNull();
    });
    await userEvent.click(within(opened).getByText("Markdown"));
    await userEvent.type(
      within(opened).getByRole("textbox", { name: "Markdown" }),
      " still",
    );
    await userEvent.click(within(opened).getByRole("button", { name: "Save" }));
    await waitFor(() => {
      expect(bodyOf(fetch, "PATCH", "/api/people/p1")).toEqual([
        { notes: { f1: `${averyNote} still` } },
      ]);
    });
    expect(screen.queryByRole("region", { name: "Background" })).toBeNull();
  });

  it("closes a note only shown once its row is searched away", async () => {
    await openPeople({}, viewer);
    fireEvent.click(cell("p1"));
    await panel();
    await userEvent.type(
      screen.getByRole("textbox", { name: "Search people" }),
      "Blake",
    );
    await waitFor(() => {
      expect(screen.queryByRole("region", { name: "Background" })).toBeNull();
    });
  });

  it("keeps Delete, typing and pasting in the table from changing anything while a note is written", async () => {
    const fetch = await openPeople({
      "PATCH /api/people/p1": saved,
      "PATCH /api/people/p2": saved,
      "POST /api/people": saved,
    });
    fireEvent.click(cell("p1"));
    await userEvent.click(within(await panel()).getByText("Editor"));
    act(() => {
      cell("p1").focus();
    });
    await userEvent.keyboard("{Delete}");
    const name = document.querySelector(
      '[id^="cell-new-"][id$="-preferredName"]',
    ) as HTMLElement;
    act(() => {
      name.focus();
    });
    await userEvent.paste("Casey Fictional\tE3\n");
    expect(
      fetch.mock.calls.filter(
        ([, init]) => init?.method !== undefined && init.method !== "GET",
      ),
    ).toEqual([]);
  });

  it("stays open with what was written, saying why, when the note is refused", async () => {
    await openPeople({
      "GET /api/people": () =>
        Response.json({
          people: [avery, blake],
          fields: [{ ...background, required: true }],
          order: ["preferredName", "employeeId", "f1"],
          views: [],
        }),
    });
    fireEvent.click(cell("p1"));
    const opened = await panel();
    await userEvent.click(within(opened).getByText("Editor"));
    await userEvent.click(
      within(opened).getByRole("button", { name: "Clear" }),
    );
    await userEvent.click(within(opened).getByRole("button", { name: "Save" }));
    expect((await within(opened).findByRole("alert")).textContent).not.toBe("");
    expect(screen.getByRole("region", { name: "Background" })).toBe(opened);
  });

  it("opens read only with F2", async () => {
    await openPeople({}, viewer);
    act(() => {
      cell("p1").focus();
    });
    await userEvent.keyboard("{F2}");
    expect(await panel()).toBeDefined();
  });

  it("does nothing with typing", async () => {
    await openPeople();
    act(() => {
      cell("p1").focus();
    });
    await userEvent.keyboard("x");
    expect(screen.queryByRole("region", { name: "Background" })).toBeNull();
    expect(cell("p1").textContent).toBe("Joined from the platform team");
  });

  it("clears a note with Delete", async () => {
    const fetch = await openPeople({ "PATCH /api/people/p1": saved });
    act(() => {
      cell("p1").focus();
    });
    await userEvent.keyboard("{Delete}");
    expect(bodyOf(fetch, "PATCH", "/api/people/p1")).toEqual([
      { notes: { f1: null } },
    ]);
  });

  it("keeps only what notes allow from text pasted into new rows", async () => {
    const fetch = await openPeople({
      "POST /api/people": () =>
        Response.json({ ids: ["p3"], changeSetId: s1 }, { status: 201 }),
    });
    const name = document.querySelector(
      '[id^="cell-new-"][id$="-preferredName"]',
    ) as HTMLElement;
    act(() => {
      name.focus();
    });
    await userEvent.paste(
      "Casey Fictional\tE3\t# Moved <mark>teams</mark>\tFictional Engineer\n",
    );
    expect(bodyOf(fetch, "POST", "/api/people")).toEqual([
      {
        people: [
          {
            preferredName: "Casey Fictional",
            employeeId: "E3",
            positionId: "position-1",
            values: {},
            links: {},
            notes: { f1: "# Moved teams" },
          },
        ],
      },
    ]);
  });

  it("names a drafted note's live words to assistive technology", async () => {
    await openPeople({
      "GET /api/people": peopleAnswer([
        {
          ...avery,
          notes: { f1: "Changed **note**" },
          draft: {
            action: "changed",
            changed: ["f1"],
            live: { values: {}, links: {}, notes: { f1: averyNote } },
            state: "waiting",
            madeBy: "Fictional Editor",
            madeAt: "2026-11-06T09:00:00.000Z",
          },
        },
        blake,
      ]),
    });
    expect(cell("p1").textContent).toContain(
      "draft, live Joined from the platform team",
    );
  });

  it("shows the live note again once its draft is discarded", async () => {
    let discarded = false;
    const drafted = {
      ...avery,
      notes: { f1: "Changed **note**" },
      draft: {
        action: "changed",
        changed: ["f1"],
        live: { values: {}, links: {}, notes: { f1: averyNote } },
        state: "waiting",
        madeBy: null,
        madeAt: null,
      },
    };
    await openPeople({
      "GET /api/people": () =>
        peopleAnswer([discarded ? avery : drafted, blake])(),
      "DELETE /api/people/p1/draft": () => {
        discarded = true;
        return saved();
      },
    });
    act(() => {
      cell("p1").focus();
    });
    await userEvent.keyboard("{Shift>}{F10}{/Shift}");
    await userEvent.click(
      await screen.findByRole("menuitem", { name: "Discard draft" }),
    );
    await waitFor(() => {
      expect(cell("p1").textContent).toBe("Joined from the platform team");
    });
  });

  it("is found by searching its words", async () => {
    await openPeople();
    await userEvent.type(
      screen.getByRole("textbox", { name: "Search people" }),
      "platform",
    );
    await waitFor(() => {
      expect(cell("p2")).toBeNull();
    });
    expect(cell("p1")).not.toBeNull();
  });

  it("is added from the column dialog with its own visibility, and no list", async () => {
    const fetch = await openPeople(
      {
        "POST /api/people/columns": () =>
          Response.json(
            {
              field: { ...background, id: "f2", name: "Reviews" },
              changeSetId: s1,
            },
            { status: 201 },
          ),
      },
      session([
        "configuration:edit",
        "configuration:view",
        "people:edit",
        "people:view",
        "plan:view",
        "features:view",
        "personal:view",
        "data:classify",
      ]),
    );
    await userEvent.click(screen.getByRole("button", { name: "New column" }));
    const dialog = await screen.findByRole("dialog", { name: "New column" });
    await userEvent.type(within(dialog).getByLabelText("Name"), "Reviews");
    await userEvent.selectOptions(
      within(dialog).getByRole("combobox", { name: "Type" }),
      "Note",
    );
    expect(within(dialog).queryByRole("combobox", { name: "List" })).toBeNull();
    fireEvent.click(within(dialog).getByRole("radio", { name: /^Personal/ }));
    await userEvent.click(
      within(dialog).getByRole("button", { name: "Add column" }),
    );
    await waitFor(() => {
      expect(bodyOf(fetch, "POST", "/api/people/columns")).toEqual([
        {
          name: "Reviews",
          type: "note",
          visibility: "personal",
          multiple: false,
          required: false,
          onPlannedHires: true,
        },
      ]);
    });
  });
});
