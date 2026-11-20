// SPDX-License-Identifier: Apache-2.0

// Tests for a note's panel kept in the People page's address, opened from a person's details or from
// a table's cell, with the server's responses simulated.

import {
  act,
  fireEvent,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import { userEvent } from "@testing-library/user-event";
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { cellOfNote } from "./grid-note-address.ts";
import {
  avery,
  averyNote,
  background,
  blake,
  editor,
  peopleAnswer,
  positions,
  viewer,
} from "./people-note-fixtures.ts";
import { renderApp, serverAnswers } from "./test-support.tsx";

type Answers = Parameters<typeof serverAnswers>[0];

// The test browser lays nothing out, so the editor's measurements of where text is find nothing.
beforeAll(() => {
  Range.prototype.getClientRects = () => [] as unknown as DOMRectList;
  Range.prototype.getBoundingClientRect = () => new DOMRect();
});

afterEach(() => {
  vi.unstubAllGlobals();
});

async function openAt(
  path: string,
  session = editor,
  people: Answers[string] = peopleAnswer(),
) {
  serverAnswers({
    "GET /api/session": session,
    "GET /api/people": people,
    "GET /api/lists": () => Response.json({ lists: [positions] }),
  });
  const history = renderApp(path);
  await screen.findByRole("grid", { name: "People" });
  return history;
}

const searchOf = (history: { location: { search: string } }) =>
  new URLSearchParams(history.location.search);

describe("a note opened from the details, kept in the address", () => {
  const detailsNote = (person: string) =>
    screen.findByRole("region", { name: `Background for ${person}` });
  const noDetailsNote = () => {
    expect(
      screen.queryByRole("region", { name: /^Background for / }),
    ).toBeNull();
  };
  const noteIn = (history: { location: { search: string } }) =>
    searchOf(history).get("note");

  it("keeps a note opened from the details, and Back closes it", async () => {
    const history = await openAt("/people?open=E1");
    await userEvent.click(
      await screen.findByRole("button", { name: "Open Background" }),
    );
    await detailsNote("Avery Fictional");
    await waitFor(() => {
      expect(noteIn(history)).toBe("f1.p1");
    });
    act(() => {
      history.back();
    });
    await waitFor(() => {
      noDetailsNote();
    });
    expect(noteIn(history)).toBeNull();
  });

  it("takes the note out once closed", async () => {
    const history = await openAt("/people?open=E1&note=f1.p1");
    const opened = await detailsNote("Avery Fictional");
    await userEvent.click(
      within(opened).getByRole("button", { name: "Close note" }),
    );
    await waitFor(() => {
      expect(noteIn(history)).toBeNull();
    });
    noDetailsNote();
  });

  it("opens the note it names, to be written by those who may", async () => {
    await openAt("/people?open=E1&note=f1.p1");
    const opened = await detailsNote("Avery Fictional");
    expect(within(opened).getByText("Markdown")).toBeTruthy();
  });

  it("opens the note it names read only to those who may not change it", async () => {
    await openAt("/people?open=E1&note=f1.p1", viewer);
    const opened = await detailsNote("Avery Fictional");
    expect(within(opened).getByText("Joined").tagName).toBe("STRONG");
    expect(within(opened).queryByText("Markdown")).toBeNull();
  });

  it("opens nothing for another person's note, and takes it out", async () => {
    const history = await openAt("/people?open=E2&note=f1.p1");
    await screen.findByRole("button", { name: "Open Background" });
    await waitFor(() => {
      expect(noteIn(history)).toBeNull();
    });
    noDetailsNote();
  });

  it("stays open while the table's view changes", async () => {
    const history = await openAt("/people?open=E1&note=f1.p1");
    await detailsNote("Avery Fictional");
    await userEvent.type(
      screen.getByRole("textbox", { name: "Search people" }),
      "Avery",
    );
    await waitFor(() => {
      expect(new URLSearchParams(history.location.search).get("search")).toBe(
        "Avery",
      );
    });
    expect(noteIn(history)).toBe("f1.p1");
    await detailsNote("Avery Fictional");
  });

  it("opens the note again with Forward", async () => {
    const history = await openAt("/people?open=E1");
    await userEvent.click(
      await screen.findByRole("button", { name: "Open Background" }),
    );
    await detailsNote("Avery Fictional");
    act(() => {
      history.back();
    });
    await waitFor(() => {
      noDetailsNote();
    });
    act(() => {
      history.forward();
    });
    await detailsNote("Avery Fictional");
  });

  it("keeps a changed note open through Back", async () => {
    const history = await openAt("/people?open=E1");
    await userEvent.click(
      await screen.findByRole("button", { name: "Open Background" }),
    );
    const opened = await detailsNote("Avery Fictional");
    await userEvent.click(within(opened).getByText("Markdown"));
    await userEvent.type(
      within(opened).getByRole("textbox", { name: "Markdown" }),
      " again",
    );
    act(() => {
      history.back();
    });
    await waitFor(() => {
      expect(noteIn(history)).toBeNull();
    });
    expect(
      within(await detailsNote("Avery Fictional")).getByRole("textbox", {
        name: "Markdown",
      }),
    ).toHaveProperty("value", `${averyNote} again`);
  });

  it("closes the note, and takes it out, once no person is shown", async () => {
    const history = await openAt("/people?open=E1&note=f1.p1");
    await detailsNote("Avery Fictional");
    act(() => {
      history.push("/people?note=f1.p1");
    });
    await waitFor(() => {
      noDetailsNote();
    });
    await waitFor(() => {
      expect(noteIn(history)).toBeNull();
    });
  });

  it("opens the note the address names once another being changed closes", async () => {
    const handover = {
      ...background,
      id: "f2",
      keyNumber: 2,
      name: "Handover",
    };
    const history = await openAt("/people?open=E1", editor, () =>
      Response.json({
        people: [avery, blake],
        fields: [background, handover],
        order: ["preferredName", "employeeId", "f1", "f2"],
      }),
    );
    await userEvent.click(
      await screen.findByRole("button", { name: "Open Background" }),
    );
    await detailsNote("Avery Fictional");
    await userEvent.click(
      screen.getByRole("button", { name: "Open Handover" }),
    );
    const handoverNote = await screen.findByRole("region", {
      name: "Handover for Avery Fictional",
    });
    await userEvent.click(within(handoverNote).getByText("Markdown"));
    await userEvent.type(
      within(handoverNote).getByRole("textbox", { name: "Markdown" }),
      "Hand over the keys",
    );
    act(() => {
      history.back();
    });
    await waitFor(() => {
      expect(noteIn(history)).toBe("f1.p1");
    });
    await userEvent.click(
      within(handoverNote).getByRole("button", { name: "Cancel" }),
    );
    await detailsNote("Avery Fictional");
    expect(noteIn(history)).toBe("f1.p1");
  });

  it("closes the note, and takes it out, when the details close", async () => {
    const history = await openAt("/people?open=E1&note=f1.p1");
    await detailsNote("Avery Fictional");
    await userEvent.click(
      screen.getByRole("button", { name: "Close details" }),
    );
    await waitFor(() => {
      expect(noteIn(history)).toBeNull();
    });
    noDetailsNote();
  });

  it("closes the note, and takes it out, when another person is shown", async () => {
    const history = await openAt("/people?open=E1&note=f1.p1");
    await detailsNote("Avery Fictional");
    fireEvent.click(
      screen.getByRole("button", { name: "Show details of Blake Fictional" }),
    );
    await screen.findByRole("heading", { name: "Blake Fictional" });
    await waitFor(() => {
      expect(noteIn(history)).toBeNull();
    });
    noDetailsNote();
  });
});

describe("the cell of the note an address names", () => {
  const ids = ["p1", "p2", undefined];
  const noteKeys = [undefined, "f1"];

  it("is the record's row and the column's place", () => {
    expect(cellOfNote("f1.p2", ids, noteKeys)).toEqual({ row: 1, column: 1 });
  });

  it.each([
    ["no note named", undefined],
    ["a record not shown", "f1.p9"],
    ["a column not shown", "f2.p1"],
    ["a column that isn't a note", "preferredName.p1"],
  ])("is none for %s", (_case, address) => {
    expect(cellOfNote(address, ids, noteKeys)).toBeUndefined();
  });
});

describe("a note opened from a table's cell, kept in the address", () => {
  const cell = (row: string) =>
    document.getElementById(`cell-${row}-f1`) as HTMLElement;
  const cellNote = () => screen.findByRole("region", { name: "Background" });
  const noCellNote = () => {
    expect(screen.queryByRole("region", { name: "Background" })).toBeNull();
  };
  const tableNoteIn = (history: { location: { search: string } }) =>
    searchOf(history).get("tableNote");

  it("is kept once opened, and Back closes it", async () => {
    const history = await openAt("/people");
    fireEvent.click(cell("p1"));
    await cellNote();
    await waitFor(() => {
      expect(tableNoteIn(history)).toBe("f1.p1");
    });
    act(() => {
      history.back();
    });
    await waitFor(() => {
      noCellNote();
    });
  });

  it("opens again on Forward", async () => {
    const history = await openAt("/people");
    fireEvent.click(cell("p1"));
    await cellNote();
    act(() => {
      history.back();
    });
    await waitFor(() => {
      noCellNote();
    });
    act(() => {
      history.forward();
    });
    await cellNote();
  });

  it("is taken out once closed", async () => {
    const history = await openAt("/people?tableNote=f1.p1");
    const opened = await cellNote();
    await userEvent.click(
      within(opened).getByRole("button", { name: "Close note" }),
    );
    await waitFor(() => {
      expect(tableNoteIn(history)).toBeNull();
    });
    noCellNote();
  });

  it("opens the note it names, to be written by those who may", async () => {
    await openAt("/people?tableNote=f1.p1");
    const opened = await cellNote();
    expect(within(opened).getByText("Markdown")).toBeTruthy();
  });

  it("opens the note it names read only to those who may not change it", async () => {
    await openAt("/people?tableNote=f1.p1", viewer);
    const opened = await cellNote();
    expect(within(opened).queryByText("Markdown")).toBeNull();
  });

  it("opens no editor for a column that isn't a note", async () => {
    await openAt("/people?tableNote=preferredName.p1");
    await screen.findByText("Avery Fictional");
    expect(document.getElementById("cell-p1-preferredName-editor")).toBeNull();
    noCellNote();
  });

  it("opens nothing for a person not in the table", async () => {
    const history = await openAt("/people?tableNote=f1.p9");
    expect(tableNoteIn(history)).toBe("f1.p9");
    noCellNote();
  });

  it("keeps a note being written open through Back", async () => {
    const history = await openAt("/people");
    fireEvent.click(cell("p1"));
    const opened = await cellNote();
    await userEvent.click(within(opened).getByText("Markdown"));
    await userEvent.type(
      within(opened).getByRole("textbox", { name: "Markdown" }),
      " again",
    );
    act(() => {
      history.back();
    });
    await waitFor(() => {
      expect(tableNoteIn(history)).toBeNull();
    });
    expect(
      within(await cellNote()).getByRole("textbox", { name: "Markdown" }),
    ).toHaveProperty("value", `${averyNote} again`);
  });

  it("stays open while the table's view changes", async () => {
    const history = await openAt("/people?tableNote=f1.p1");
    await cellNote();
    await userEvent.type(
      screen.getByRole("textbox", { name: "Search people" }),
      "Avery",
    );
    await waitFor(() => {
      expect(searchOf(history).get("search")).toBe("Avery");
    });
    expect(tableNoteIn(history)).toBe("f1.p1");
    await cellNote();
  });
});
