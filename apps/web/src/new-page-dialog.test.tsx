// SPDX-License-Identifier: Apache-2.0

// Tests for New page: what is wrong with the columns typed in, the request they make, and the
// dialog's two steps, refusals and the page it makes, with the server's responses simulated.

import { screen, waitFor, within } from "@testing-library/react";
import { userEvent } from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { columnProblems, columnRequests } from "./new-page-dialog.tsx";
import { followUps, pageAnswers } from "./test-private-pages.ts";
import {
  bodyOf,
  positions,
  renderApp,
  teamsList,
  serverAnswers,
} from "./test-support.tsx";

afterEach(() => {
  vi.unstubAllGlobals();
});

const typed = (
  name: string,
  type: "text" | "choice" | "date" = "text",
  listId: string | null = null,
) => ({ key: name, name, type, listId });

describe("the columns typed in", () => {
  it("need a name each, their own, and a list for a choice", () => {
    expect(
      columnProblems([
        typed(""),
        typed("Due", "date"),
        typed("due"),
        typed("Stage", "choice"),
      ]),
    ).toEqual([
      { name: "Name needed" },
      {},
      { name: "Another column has that name" },
      { list: "List needed" },
    ]);
  });

  it("ask for the first column and each named one after it, a choice with its list and the rest General", () => {
    expect(
      columnRequests([
        typed("Name"),
        typed("Stage", "choice", "l1"),
        typed("Phase", "choice"),
        typed(""),
      ]),
    ).toEqual([
      { name: "Name", type: "text", visibility: "general" },
      { name: "Stage", type: "choice", listId: "l1" },
      { name: "Phase", type: "choice" },
    ]);
  });
});

const openNewPage = async () => {
  await userEvent.click(
    await screen.findByRole("button", { name: "New page" }),
  );
  return screen.findByRole("dialog", { name: "New page" });
};

describe("New page", () => {
  it("needs a name of its own before its columns", async () => {
    // Given the maker of Follow-ups, with New page open
    serverAnswers(pageAnswers(followUps([])));
    renderApp("/help");
    const dialog = within(await openNewPage());
    const name = dialog.getByRole("textbox", { name: "Name" });

    // When Next is chosen with no name, then with another page's
    await userEvent.click(dialog.getByRole("button", { name: "Next" }));
    expect(dialog.getByText("Name needed")).toBeDefined();
    expect(document.activeElement).toBe(name);
    await userEvent.type(name, "follow-ups{Enter}");

    // Then each is refused under Name, staying on the first step
    expect(dialog.getByText("Another page has that name")).toBeDefined();
    expect(dialog.queryByRole("textbox", { name: "Column name" })).toBeNull();
  });

  it("makes the page with its columns and opens it", async () => {
    // Given the maker, naming a new page
    const made = followUps([]);
    const fetch = serverAnswers({
      ...pageAnswers(made),
      "POST /api/private-pages": () =>
        Response.json(
          { page: made, changeSetId: "40000000-0000-4000-8000-000000000003" },
          { status: 201 },
        ),
    });
    renderApp("/help");
    const dialog = within(await openNewPage());
    await userEvent.type(
      dialog.getByRole("textbox", { name: "Name" }),
      "Reading list{Enter}",
    );

    // When a second column is typed in the empty row and the page is added
    await userEvent.type(
      await dialog.findByRole("textbox", { name: "New column name" }),
      "Author",
    );
    await userEvent.click(dialog.getByRole("button", { name: "Add page" }));

    // Then the page is asked for with both columns, and opens
    await waitFor(() => {
      expect(bodyOf(fetch, "POST", "/api/private-pages")).toEqual([
        {
          name: "Reading list",
          columns: [
            { name: "Name", type: "text", visibility: "general" },
            { name: "Author", type: "text", visibility: "general" },
          ],
        },
      ]);
    });
    expect(
      await screen.findByRole("grid", { name: "Follow-ups" }),
    ).toBeDefined();
  });

  it("refuses a choice column with no list, naming it under the list", async () => {
    const fetch = serverAnswers(pageAnswers(followUps([])));
    renderApp("/help");
    const dialog = within(await openNewPage());
    await userEvent.type(
      dialog.getByRole("textbox", { name: "Name" }),
      "Reading list{Enter}",
    );
    await userEvent.type(
      await dialog.findByRole("textbox", { name: "New column name" }),
      "Stage",
    );
    const [, type] = dialog.getAllByRole("combobox", { name: "Type" });
    await userEvent.click(type as HTMLElement);
    await userEvent.click(
      await screen.findByRole("option", { name: "Choice from a list" }),
    );
    await userEvent.click(dialog.getByRole("button", { name: "Add page" }));
    expect(dialog.getByText("List needed")).toBeDefined();
    expect(bodyOf(fetch, "POST", "/api/private-pages")).toEqual([]);
  });
});

const toColumns = async (box: HTMLElement, name: string) => {
  const dialog = within(box);
  await userEvent.type(dialog.getByRole("textbox", { name: "Name" }), name);
  await userEvent.click(dialog.getByRole("button", { name: "Next" }));
  return dialog.findByRole("textbox", { name: "New column name" });
};

describe("New page's columns", () => {
  it("go on to the next row on Enter, and keep the page's name on Back", async () => {
    serverAnswers(pageAnswers(followUps([])));
    renderApp("/help");
    const box = await openNewPage();
    const dialog = within(box);
    await userEvent.type(await toColumns(box, "Reading list"), "Author{Enter}");
    await waitFor(() => {
      expect(document.activeElement).toBe(
        dialog.getByRole("textbox", { name: "New column name" }),
      );
    });
    await userEvent.click(dialog.getByRole("button", { name: "Back" }));
    expect(dialog.getByRole("textbox", { name: "Name" })).toHaveProperty(
      "value",
      "Reading list",
    );
  });

  it("leave out a column removed, and ask for a choice column's list", async () => {
    const fetch = serverAnswers({
      ...pageAnswers(followUps([])),
      "GET /api/lists": () =>
        Response.json({
          lists: [
            positions,
            { ...positions, id: "old", name: "Old sites", retired: true },
            { ...teamsList, name: "New teams" },
          ],
        }),
      "POST /api/private-pages": () =>
        Response.json({ error: "Problem" }, { status: 500 }),
    });
    renderApp("/help");
    const box = await openNewPage();
    const dialog = within(box);
    await userEvent.type(await toColumns(box, "Reading list"), "Author{Enter}");
    await userEvent.keyboard("Shelf");
    const [, , shelfType] = dialog.getAllByRole("combobox", { name: "Type" });
    await userEvent.click(shelfType as HTMLElement);
    await userEvent.click(
      await screen.findByRole("option", { name: "Choice from a list" }),
    );
    await userEvent.click(dialog.getByRole("combobox", { name: "List" }));
    // Only a live list is offered, not one retired or only drafted
    expect(
      (await screen.findAllByRole("option")).map(
        (option) => option.textContent,
      ),
    ).toEqual(["Positions"]);
    await userEvent.click(screen.getByRole("option", { name: "Positions" }));
    await userEvent.click(
      dialog.getByRole("button", { name: "Remove Author" }),
    );
    // Focus goes to the column now in its place
    await waitFor(() => {
      expect(document.activeElement).toHaveProperty("value", "Shelf");
    });
    await userEvent.click(dialog.getByRole("button", { name: "Add page" }));
    await waitFor(() => {
      expect(bodyOf(fetch, "POST", "/api/private-pages")).toEqual([
        {
          name: "Reading list",
          columns: [
            { name: "Name", type: "text", visibility: "general" },
            { name: "Shelf", type: "choice", listId: "positions" },
          ],
        },
      ]);
    });
    // And a failure to make it is named in the dialog
    expect(await dialog.findByRole("alert")).toBeDefined();
  });

  it("go back to the name when the server finds another page has it", async () => {
    serverAnswers({
      ...pageAnswers(followUps([])),
      "POST /api/private-pages": () =>
        Response.json({ error: "Another page has that name" }, { status: 409 }),
    });
    renderApp("/help");
    const box = await openNewPage();
    const dialog = within(box);
    await toColumns(box, "Reading list");
    await userEvent.click(dialog.getByRole("button", { name: "Add page" }));
    expect(await dialog.findByText("Another page has that name")).toBeDefined();
    expect(dialog.getByRole("textbox", { name: "Name" })).toBeDefined();
  });
});

describe("a column named twice", () => {
  it("is refused under its second name, with focus there, and nothing sent", async () => {
    const fetch = serverAnswers(pageAnswers(followUps([])));
    renderApp("/help");
    const box = await openNewPage();
    const dialog = within(box);
    await userEvent.type(await toColumns(box, "Reading list"), "name");
    await userEvent.click(dialog.getByRole("button", { name: "Add page" }));
    expect(dialog.getByText("Another column has that name")).toBeDefined();
    await waitFor(() => {
      expect(document.activeElement).toBe(
        dialog.getAllByRole("textbox", { name: "Column name" })[1],
      );
    });
    expect(bodyOf(fetch, "POST", "/api/private-pages")).toEqual([]);
  });
});

describe("leaving New page", () => {
  it("asks before discarding what was typed, and closes on Discard", async () => {
    serverAnswers(pageAnswers(followUps([])));
    renderApp("/help");
    const box = await openNewPage();
    const dialog = within(box);
    await userEvent.type(dialog.getByRole("textbox", { name: "Name" }), "R");
    await userEvent.click(dialog.getByRole("button", { name: "Cancel" }));
    const question = await screen.findByRole("dialog", {
      name: "Discard the new page?",
    });
    await userEvent.click(
      within(question).getByRole("button", { name: "Discard" }),
    );
    await waitFor(() => {
      expect(screen.queryByRole("dialog", { name: "New page" })).toBeNull();
    });
  });

  it("closes at once with nothing typed", async () => {
    serverAnswers(pageAnswers(followUps([])));
    renderApp("/help");
    await openNewPage();
    await userEvent.keyboard("{Escape}");
    await waitFor(() => {
      expect(screen.queryByRole("dialog", { name: "New page" })).toBeNull();
    });
  });
});
