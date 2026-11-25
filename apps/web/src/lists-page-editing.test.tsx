// SPDX-License-Identifier: Apache-2.0

// Tests for creating and editing lists on the Lists page, focus, pasting choices, and Undo and
// the server's refusals.

import { act, screen, waitFor, within } from "@testing-library/react";
import { userEvent } from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  bodyOf,
  renderApp,
  serverAnswers,
  undoWithKeys,
} from "./test-support.tsx";
import {
  viewer,
  editor,
  classifier,
  choice,
  locations,
  skills,
  empty,
  regions,
  removal,
  listsAnswer,
  s1,
  u1,
  savedAs,
  refused,
  openPanel,
  panel,
  row,
  focusRow,
  entryName,
  undone,
  undoLast,
  listsGrid,
} from "./test-lists-page.tsx";

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("creating and editing lists", () => {
  const createdList = {
    ...empty,
    id: "l9",
    name: "Product areas",
    description: "Parts of the product.",
  };

  it("creates a list, opens it ready for choices, and undoes it", async () => {
    let lists = [locations, skills, empty, regions];
    const fetch = serverAnswers({
      "GET /api/session": classifier,
      "GET /api/lists": () => Response.json({ lists }),
      "POST /api/lists": () => {
        lists = [...lists, createdList];
        return Response.json(
          { list: createdList, changeSetId: s1 },
          { status: 201 },
        );
      },
      [`POST /api/undo/${s1}`]: () => {
        lists = lists.filter(({ id }) => id !== "l9");
        return savedAs(u1)();
      },
    });
    const history = renderApp("/lists");
    await userEvent.click(
      await screen.findByRole("button", { name: "New list" }),
    );
    const dialog = await screen.findByRole("dialog", { name: "New list" });
    await userEvent.type(
      within(dialog).getByLabelText("Name"),
      "Product areas",
    );
    await userEvent.type(
      within(dialog).getByLabelText(/^Description/),
      "Parts of the product.",
    );
    expect(
      within(dialog).getByRole<HTMLInputElement>("radio", {
        name: /^Confidential/,
      }).disabled,
    ).toBe(true);
    expect(
      within(dialog).getByText("This role can't see Confidential data"),
    ).toBeTruthy();
    await userEvent.click(
      within(dialog).getByRole("radio", { name: /^Personal/ }),
    );
    await userEvent.click(
      within(dialog).getByRole("button", { name: "Create list" }),
    );
    expect(bodyOf(fetch, "POST", "/api/lists")).toEqual([
      {
        name: "Product areas",
        description: "Parts of the product.",
        visibility: "personal",
      },
    ]);
    await waitFor(() => {
      expect(history.location.pathname).toBe("/lists/l9");
    });
    expect(
      await screen.findByRole("heading", { name: "Product areas", level: 2 }),
    ).toBeDefined();
    expect(within(await listsGrid()).getByText("Product areas")).toBeDefined();
    await undoWithKeys(fetch);
    await waitFor(() => {
      expect(undone(fetch)).toEqual([s1]);
    });
    await waitFor(() => {
      expect(
        within(screen.getByRole("grid", { name: "Lists" })).queryByText(
          "Product areas",
        ),
      ).toBeNull();
    });
  });

  it("says what is wrong with a list's name and description", async () => {
    const fetch = serverAnswers({
      "GET /api/session": editor,
      "GET /api/lists": listsAnswer,
    });
    renderApp("/lists");
    await userEvent.click(
      await screen.findByRole("button", { name: "New list" }),
    );
    const dialog = await screen.findByRole("dialog");
    await userEvent.click(
      within(dialog).getByRole("button", { name: "Create list" }),
    );
    expect(within(dialog).getByText("Name needed")).toBeDefined();
    await userEvent.type(within(dialog).getByLabelText("Name"), "skills");
    expect(
      within(dialog).getByText("Another list has that name"),
    ).toBeDefined();
    await userEvent.clear(within(dialog).getByLabelText("Name"));
    await userEvent.click(within(dialog).getByLabelText("Name"));
    await userEvent.paste("x".repeat(41));
    expect(within(dialog).getByText("Too long")).toBeDefined();
    expect(within(dialog).getByText("41/40")).toBeDefined();
    await userEvent.clear(within(dialog).getByLabelText("Name"));
    await userEvent.type(within(dialog).getByLabelText("Name"), "Fine");
    await userEvent.click(within(dialog).getByLabelText(/^Description/));
    await userEvent.paste("x".repeat(501));
    expect(within(dialog).getByText("Too long")).toBeDefined();
    await userEvent.click(
      within(dialog).getByRole("button", { name: "Create list" }),
    );
    expect(bodyOf(fetch, "POST", "/api/lists")).toEqual([]);
  });

  it.each([
    [409, "Another list has that name"],
    [500, "Fathom could not save the list. Try again in a moment."],
  ])("shows the server's refusal %i", async (status, message) => {
    serverAnswers({
      "GET /api/session": editor,
      "GET /api/lists": listsAnswer,
      "POST /api/lists": refused(status),
    });
    renderApp("/lists");
    await userEvent.click(
      await screen.findByRole("button", { name: "New list" }),
    );
    const dialog = await screen.findByRole("dialog");
    await userEvent.type(within(dialog).getByLabelText("Name"), "Fictional");
    await userEvent.click(
      within(dialog).getByRole("button", { name: "Create list" }),
    );
    expect(await within(dialog).findByText(message)).toBeDefined();
  });

  it("edits a list, and undoes it", async () => {
    const fetch = serverAnswers({
      "GET /api/session": editor,
      "GET /api/lists": listsAnswer,
      "PUT /api/lists/l2": () =>
        Response.json({
          list: { ...skills, name: "Strengths" },
          changeSetId: s1,
        }),
      [`POST /api/undo/${s1}`]: savedAs(u1),
    });
    renderApp("/lists/l2");
    await userEvent.click(
      await screen.findByRole("button", { name: "Edit list…" }),
    );
    const dialog = await screen.findByRole("dialog", { name: "Edit list" });
    const name = within(dialog).getByLabelText("Name");
    await userEvent.clear(name);
    await userEvent.type(name, "Strengths");
    await userEvent.click(within(dialog).getByRole("button", { name: "Save" }));
    await waitFor(() => {
      expect(bodyOf(fetch, "PUT", "/api/lists/l2")).toHaveLength(1);
    });
    await undoWithKeys(fetch);
    await waitFor(() => {
      expect(undone(fetch)).toEqual([s1]);
    });
  });

  it("retires a list, and undoes it", async () => {
    const fetch = serverAnswers({
      "GET /api/session": editor,
      "GET /api/lists": listsAnswer,
      "PUT /api/lists/l2/retired": savedAs(),
      [`POST /api/undo/${s1}`]: savedAs(u1),
    });
    renderApp("/lists/l2");
    await userEvent.click(
      await screen.findByRole("button", { name: "Edit list…" }),
    );
    await userEvent.click(
      await screen.findByRole("button", { name: "Retire list" }),
    );
    expect(await screen.findByText("Drafted retiring Skills.")).toBeDefined();
    await undoLast();
    await waitFor(() => {
      expect(undone(fetch)).toEqual([s1]);
    });
    expect(bodyOf(fetch, "PUT", "/api/lists/l2/retired")).toEqual([
      { retired: true },
    ]);
  });

  it("restores a retired list", async () => {
    serverAnswers({
      "GET /api/session": editor,
      "GET /api/lists": listsAnswer,
      "PUT /api/lists/l4/retired": savedAs(),
    });
    renderApp("/lists/l4");
    await userEvent.click(
      await screen.findByRole("button", { name: "Edit list…" }),
    );
    await userEvent.click(
      await screen.findByRole("button", { name: "Restore list" }),
    );
    expect(await screen.findByText("Drafted restoring Regions.")).toBeDefined();
  });

  it("says when a list cannot be retired", async () => {
    serverAnswers({
      "GET /api/session": editor,
      "GET /api/lists": listsAnswer,
      "PUT /api/lists/l2/retired": refused(500),
    });
    renderApp("/lists/l2");
    await userEvent.click(
      await screen.findByRole("button", { name: "Edit list…" }),
    );
    await userEvent.click(
      await screen.findByRole("button", { name: "Retire list" }),
    );
    expect(
      await screen.findByText("Fathom could not retire Skills."),
    ).toBeDefined();
  });

  it("drafts deleting a list, keeping it struck through in its panel, and undoes it", async () => {
    let shown: object[] = [locations, skills, empty, regions];
    const fetch = serverAnswers({
      "GET /api/session": editor,
      "GET /api/lists": () => Response.json({ lists: shown }),
      "DELETE /api/lists/l4": () => {
        shown = [locations, skills, empty, { ...regions, draft: removal }];
        return savedAs()();
      },
      [`POST /api/undo/${s1}`]: savedAs(u1),
    });
    renderApp("/lists/l4");
    await userEvent.click(
      await screen.findByRole("button", { name: "Edit list…" }),
    );
    await userEvent.click(
      await screen.findByRole("button", { name: "Remove list" }),
    );
    expect(await within(panel()).findByText(/Draft: removed/)).toBeDefined();
    expect(
      within(panel()).queryByRole("button", { name: "Edit list…" }),
    ).toBeNull();
    await waitFor(() => {
      expect(document.activeElement).toBe(
        screen.getByRole("heading", { name: "Regions", level: 2 }),
      );
    });
    await undoWithKeys(fetch);
    await waitFor(() => {
      expect(undone(fetch)).toEqual([s1]);
    });
  });

  it("discards a list only drafted to be added, closing its panel, and undoes it, opening it again", async () => {
    const drafted = {
      ...regions,
      draft: {
        action: "created",
        changed: ["name", "description", "visibility", "retired"],
        live: {},
        state: "waiting",
        madeBy: "Fictional Editor",
        madeAt: "2026-11-01T10:00:00.000Z",
      },
    };
    let lists = [locations, skills, empty, drafted];
    const fetch = serverAnswers({
      "GET /api/session": editor,
      "GET /api/lists": () => Response.json({ lists }),
      "DELETE /api/lists/l4": () => {
        lists = [locations, skills, empty];
        return savedAs()();
      },
      [`POST /api/undo/${s1}`]: () => {
        lists = [locations, skills, empty, drafted];
        return savedAs(u1)();
      },
    });
    const history = renderApp("/lists/l4");
    await userEvent.click(
      await screen.findByRole("button", { name: "Edit list…" }),
    );
    await userEvent.click(
      await screen.findByRole("button", { name: "Remove list" }),
    );
    expect(await screen.findByText("Discarded Regions.")).toBeDefined();
    await waitFor(() => {
      expect(history.location.pathname).toBe("/lists");
    });
    await waitFor(() => {
      expect(document.activeElement?.textContent).toBe("New list");
    });
    await undoLast();
    await waitFor(() => {
      expect(history.location.pathname).toBe("/lists/l4");
    });
    expect(undone(fetch)).toEqual([s1]);
  });

  it("offers no undo when a change saved nothing", async () => {
    const fetch = serverAnswers({
      "GET /api/session": editor,
      "GET /api/lists": listsAnswer,
      "PUT /api/lists/l2/retired": savedAs(null),
    });
    renderApp("/lists/l2");
    await userEvent.click(
      await screen.findByRole("button", { name: "Edit list…" }),
    );
    await userEvent.click(
      await screen.findByRole("button", { name: "Retire list" }),
    );
    await waitFor(() => {
      expect(bodyOf(fetch, "PUT", "/api/lists/l2/retired")).toHaveLength(1);
    });
    await userEvent.keyboard("{Meta>}z{/Meta}");
    expect(screen.queryByText("Retired Skills.")).toBeNull();
    expect(undone(fetch)).toEqual([]);
  });

  it("closes with Escape", async () => {
    serverAnswers({
      "GET /api/session": editor,
      "GET /api/lists": listsAnswer,
    });
    renderApp("/lists");
    await userEvent.click(
      await screen.findByRole("button", { name: "New list" }),
    );
    await screen.findByRole("dialog");
    await userEvent.keyboard("{Escape}");
    await waitFor(() => {
      expect(screen.queryByRole("dialog")).toBeNull();
    });
  });

  it("says when a list cannot be deleted", async () => {
    serverAnswers({
      "GET /api/session": editor,
      "GET /api/lists": listsAnswer,
      "DELETE /api/lists/l2": refused(500),
    });
    renderApp("/lists/l2");
    await userEvent.click(
      await screen.findByRole("button", { name: "Edit list…" }),
    );
    await userEvent.click(
      await screen.findByRole("button", { name: "Remove list" }),
    );
    expect(
      await screen.findByText("Fathom could not remove Skills."),
    ).toBeDefined();
  });

  it("cannot be closed while a list is being saved, and closes with Cancel otherwise", async () => {
    serverAnswers({
      "GET /api/session": editor,
      "GET /api/lists": listsAnswer,
      "POST /api/lists": () => new Promise<Response>(() => undefined),
    });
    renderApp("/lists");
    await userEvent.click(
      await screen.findByRole("button", { name: "New list" }),
    );
    let dialog = await screen.findByRole("dialog");
    await userEvent.click(
      within(dialog).getByRole("button", { name: "Cancel" }),
    );
    await waitFor(() => {
      expect(screen.queryByRole("dialog")).toBeNull();
    });
    await userEvent.click(screen.getByRole("button", { name: "New list" }));
    dialog = await screen.findByRole("dialog");
    await userEvent.type(within(dialog).getByLabelText("Name"), "Fictional");
    await userEvent.click(
      within(dialog).getByRole("button", { name: "Create list" }),
    );
    await userEvent.keyboard("{Escape}");
    expect(screen.getByRole("dialog")).toBeDefined();
  });
});

describe("focus", () => {
  it("goes into the panel when it opens: the first choice for editors", async () => {
    await openPanel();
    await waitFor(() => {
      expect(document.activeElement).toBe(row("c1"));
    });
  });

  it("goes to the empty row when an editor opens a list with no choices", async () => {
    serverAnswers({
      "GET /api/session": editor,
      "GET /api/lists": listsAnswer,
    });
    renderApp("/lists/l3");
    await screen.findByRole("heading", { name: "Empty List", level: 2 });
    await waitFor(() => {
      expect(document.activeElement).toBe(entryName());
    });
  });

  it("goes to the list's name for viewers", async () => {
    serverAnswers({
      "GET /api/session": viewer,
      "GET /api/lists": listsAnswer,
    });
    renderApp("/lists/l1");
    const title = await screen.findByRole("heading", {
      name: "Locations",
      level: 2,
    });
    await waitFor(() => {
      expect(document.activeElement).toBe(title);
    });
  });

  it("goes back to the list's row in the table when the panel closes with Esc from its buttons", async () => {
    const { history } = await openPanel();
    act(() => {
      screen.getByRole("button", { name: "Close" }).focus();
    });
    await userEvent.keyboard("{Escape}");
    await waitFor(() => {
      expect(history.location.pathname).toBe("/lists");
    });
    await waitFor(() => {
      expect(document.activeElement?.textContent).toBe("Locations");
    });
  });

  it("does not close the panel for clicks on the page's buttons", async () => {
    const { history } = await openPanel();
    await userEvent.click(screen.getByRole("button", { name: "Group by" }));
    expect(await screen.findByRole("menu")).toBeDefined();
    expect(history.location.pathname).toBe("/lists/l1");
  });

  it("edits the description when it is clicked", async () => {
    await openPanel();
    await userEvent.click(screen.getByText("Head office."));
    await waitFor(() => {
      expect(document.activeElement).toBe(screen.getByLabelText("description"));
    });
  });
});

describe("adding choices, more", () => {
  it("gives back what was typed when a choice cannot be added", async () => {
    await openPanel({ "POST /api/lists/l1/choices": refused(500) });
    await userEvent.type(entryName(), "Ashgrove{Enter}");
    await waitFor(() => {
      expect(entryName().value).toBe("Ashgrove");
    });
  });

  it("adds a single row copied from a spreadsheet, and says plainly what is wrong with one", async () => {
    const { fetch } = await openPanel({
      "POST /api/lists/l1/choices": () =>
        Response.json({ choices: [choice("c9", "Ashgrove")] }, { status: 201 }),
    });
    await userEvent.click(entryName());
    await userEvent.paste("northmere\tA site");
    expect(screen.getByText("Already in this list")).toBeDefined();
    await userEvent.paste("Ashgrove\tA site");
    await waitFor(() => {
      expect(bodyOf(fetch, "POST", "/api/lists/l1/choices")).toEqual([
        { choices: [{ label: "Ashgrove", description: "A site" }] },
      ]);
    });
  });

  it("adds no more than 1000 pasted lines at once", async () => {
    await openPanel();
    await userEvent.click(entryName());
    await userEvent.paste(
      Array.from({ length: 1001 }, (_, index) => `Line ${String(index)}`).join(
        "\n",
      ),
    );
    expect(screen.getByText("Up to 1000 lines at once")).toBeDefined();
  });
});

describe("saving and undoing", () => {
  it("saves quick changes one at a time, in the order made", async () => {
    const order: string[] = [];
    let release = () => undefined as unknown;
    const first = new Promise<Response>((resolve) => {
      release = () => {
        resolve(savedAs()());
      };
    });
    await openPanel({
      "PUT /api/lists/l1/choices/c1/position": () => {
        order.push("c1");
        return first;
      },
      "PUT /api/lists/l1/choices/c3/position": () => {
        order.push("c3");
        return savedAs()();
      },
    });
    focusRow("c1");
    await userEvent.keyboard("{Alt>}{ArrowDown}{/Alt}");
    focusRow("c3");
    await userEvent.keyboard("{Alt>}{ArrowUp}{/Alt}");
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 20));
    });
    expect(order).toEqual(["c1"]);
    release();
    await waitFor(() => {
      expect(order).toEqual(["c1", "c3"]);
    });
  });

  it.each([
    ["Ctrl+Z", "{Control>}z{/Control}", true],
    ["Ctrl+Shift+Z", "{Control>}{Shift>}z{/Shift}{/Control}", false],
    ["Cmd+Y", "{Meta>}y{/Meta}", false],
  ])("undoes the latest change with %s: %s", async (_name, keys, undoes) => {
    const { fetch } = await openPanel({
      "PUT /api/lists/l1/choices/c2/position": savedAs(),
    });
    focusRow("c2");
    await userEvent.keyboard("{Alt>}{ArrowDown}{/Alt}");
    await waitFor(() => {
      expect(
        bodyOf(fetch, "PUT", "/api/lists/l1/choices/c2/position"),
      ).toHaveLength(1);
    });
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 20));
    });
    await userEvent.keyboard(keys);
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 20));
    });
    expect(undone(fetch)).toEqual(undoes ? [s1] : []);
  });

  it("leaves Cmd+Z to undo typing in a field that has text", async () => {
    const { fetch } = await openPanel({
      "PUT /api/lists/l1/choices/c2/position": savedAs(),
    });
    focusRow("c2");
    await userEvent.keyboard("{Alt>}{ArrowDown}{/Alt}");
    await waitFor(() => {
      expect(
        bodyOf(fetch, "PUT", "/api/lists/l1/choices/c2/position"),
      ).toHaveLength(1);
    });
    await userEvent.type(entryName(), "Draft");
    await userEvent.keyboard("{Meta>}z{/Meta}");
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 20));
    });
    expect(
      bodyOf(fetch, "PUT", "/api/lists/l1/choices/c2/position"),
    ).toHaveLength(1);
  });
});

describe("only the latest change", () => {
  it("can be undone: a newer change closes an older change's Undo", async () => {
    await openPanel({
      "PUT /api/lists/l1/choices/c2/retired": savedAs(),
      "PUT /api/lists/l1/choices/c3/retired": savedAs(),
    });
    focusRow("c2");
    await userEvent.keyboard("r");
    expect(
      await screen.findByText("Drafted retiring Northmere."),
    ).toBeDefined();
    focusRow("c3");
    await userEvent.keyboard("r");
    expect(
      await screen.findByText("Drafted retiring Corran Quay."),
    ).toBeDefined();
    await waitFor(() => {
      expect(screen.getAllByRole("button", { name: "Undo" })).toHaveLength(1);
    });
  });

  it("is not undone behind an open dialog", async () => {
    const { fetch } = await openPanel({
      "PUT /api/lists/l1/choices/c2/position": savedAs(),
    });
    focusRow("c2");
    await userEvent.keyboard("{Alt>}{ArrowDown}{/Alt}");
    await waitFor(() => {
      expect(
        bodyOf(fetch, "PUT", "/api/lists/l1/choices/c2/position"),
      ).toHaveLength(1);
    });
    await userEvent.click(screen.getByRole("button", { name: "Edit list…" }));
    await screen.findByRole("dialog");
    await userEvent.keyboard("{Meta>}z{/Meta}");
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 20));
    });
    expect(
      bodyOf(fetch, "PUT", "/api/lists/l1/choices/c2/position"),
    ).toHaveLength(1);
  });
});
