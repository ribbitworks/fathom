// SPDX-License-Identifier: Apache-2.0

// Tests for a list's choices on the Lists page: the side panel and its address, and adding,
// moving through, editing, ordering, retiring and removing choices, from the keyboard and menus.
// Where dropped choices end up is tested in choice-drag.test.ts.

import { screen, waitFor, within } from "@testing-library/react";
import { userEvent } from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  bodyOf,
  renderApp,
  serverAnswers,
  undoWithKeys,
  recordDraft,
  onNarrowScreen,
} from "./test-support.tsx";
import {
  viewer,
  editor,
  choice,
  locations,
  skills,
  empty,
  regions,
  removal,
  listsAnswer,
  s1,
  savedAs,
  refused,
  openPanel,
  panel,
  row,
  focusRow,
  entryName,
  undone,
  startsWith,
  undoLast,
} from "./test-lists-page.tsx";

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("the side panel", () => {
  it("opens a list from the table at its own address, and switches to another", async () => {
    serverAnswers({
      "GET /api/session": viewer,
      "GET /api/lists": listsAnswer,
    });
    const history = renderApp("/lists");
    await userEvent.click(await screen.findByText("Offices and labs."));
    expect(
      await screen.findByRole("heading", { name: "Locations", level: 2 }),
    ).toBeDefined();
    expect(history.location.pathname).toBe("/lists/l1");
    await userEvent.click(screen.getByText("Rust", { selector: "span" }));
    expect(
      await screen.findByRole("heading", { name: "Skills", level: 2 }),
    ).toBeDefined();
  });

  it.each([
    [
      "the close button",
      async () => {
        await userEvent.click(screen.getByRole("button", { name: "Close" }));
      },
    ],
    [
      "Escape on a choice",
      async () => {
        focusRow("c1");
        await userEvent.keyboard("{Escape}");
      },
    ],
    [
      "a click on the page outside the table",
      async () => {
        await userEvent.click(screen.getByRole("heading", { name: "Lists" }));
      },
    ],
  ])("closes with %s", async (_case, close) => {
    const { history } = await openPanel();
    await close();
    await waitFor(() => {
      expect(history.location.pathname).toBe("/lists");
    });
  });

  it("shows choices read only to viewers, and says when there are none", async () => {
    serverAnswers({
      "GET /api/session": viewer,
      "GET /api/lists": listsAnswer,
    });
    const history = renderApp("/lists/l1");
    await screen.findByRole("heading", { name: "Locations", level: 2 });
    expect(screen.getByText("Head office.")).toBeDefined();
    expect(screen.queryByLabelText("New choice name")).toBeNull();
    expect(screen.queryByRole("button", { name: "Edit list…" })).toBeNull();
    expect(screen.queryByRole("button", { name: /^Actions for/ })).toBeNull();
    await userEvent.click(row("c1"));
    expect(screen.queryByLabelText("name")).toBeNull();
    history.push("/lists/l3");
    expect(await screen.findByText("None")).toBeDefined();
  });

  it("shows retired choices only when asked", async () => {
    await openPanel();
    expect(screen.queryByText("Old Mill")).toBeNull();
    await userEvent.click(
      within(panel()).getByRole("button", { name: "Show retired (1)" }),
    );
    expect(screen.getByText("Old Mill")).toBeDefined();
    await userEvent.click(
      within(panel()).getByRole("button", { name: "Hide retired" }),
    );
    expect(screen.queryByText("Old Mill")).toBeNull();
  });

  it("fills the screen on narrow screens", async () => {
    onNarrowScreen();
    await openPanel();
    expect([
      panel().getAttribute("aria-modal"),
      row("c1").querySelector("[data-rbd-drag-handle-draggable-id]"),
    ]).toEqual(["true", null]);
  });

  it("holds focus in the panel, a modal dialog, on narrow screens", async () => {
    // Given the panel on a narrow screen
    onNarrowScreen();
    await openPanel();
    const dialog = screen.getByRole("dialog", { name: /./ });

    // When Tab is pressed past its last control, then Shift+Tab past its first
    const stops: boolean[] = [];
    for (const keys of ["{Tab}", "{Shift>}{Tab}{/Shift}"]) {
      for (let press = 0; press < 30; press++) {
        await userEvent.keyboard(keys);
        stops.push(dialog.contains(document.activeElement));
      }
    }

    // Then focus never leaves it
    expect([dialog.getAttribute("aria-modal"), stops.every(Boolean)]).toEqual([
      "true",
      true,
    ]);
  });
});

describe("adding choices", () => {
  const added = (label: string) => () =>
    Response.json(
      { choices: [choice("c9", label)], changeSetId: s1 },
      { status: 201 },
    );

  it("adds a choice from the empty row, keeps focus there, and undoes it", async () => {
    const { fetch } = await openPanel({
      "POST /api/lists/l1/choices": added("Fenwick Down"),
    });
    await userEvent.type(entryName(), "Fenwick Down");
    await userEvent.tab();
    await userEvent.type(
      screen.getByLabelText("New choice description"),
      "Test lab.{Enter}",
    );
    await waitFor(() => {
      expect(bodyOf(fetch, "POST", "/api/lists/l1/choices")).toEqual([
        { choices: [{ label: "Fenwick Down", description: "Test lab." }] },
      ]);
    });
    expect(screen.queryByText(/^Added/)).toBeNull();
    expect(entryName().value).toBe("");
    await waitFor(() => {
      expect(document.activeElement).toBe(entryName());
    });
    await undoWithKeys(fetch);
    await waitFor(() => {
      expect(undone(fetch)).toEqual([s1]);
    });
  });

  it("adds what was typed once focus leaves the empty row, without taking focus back", async () => {
    const { fetch } = await openPanel({
      "POST /api/lists/l1/choices": added("Fenwick Down"),
    });
    await userEvent.type(entryName(), "Fenwick Down");
    await userEvent.click(
      screen.getByRole("heading", { name: "Locations", level: 2 }),
    );
    await waitFor(() => {
      expect(bodyOf(fetch, "POST", "/api/lists/l1/choices")).toEqual([
        { choices: [{ label: "Fenwick Down", description: "" }] },
      ]);
    });
    expect(entryName().value).toBe("");
    expect(document.activeElement).not.toBe(entryName());
  });

  it("shows what is wrong once focus leaves the empty row, adding nothing", async () => {
    const { fetch } = await openPanel();
    await userEvent.type(entryName(), "Northmere");
    await userEvent.click(
      screen.getByRole("heading", { name: "Locations", level: 2 }),
    );
    expect(await screen.findByText("Already in this list")).toBeTruthy();
    expect(bodyOf(fetch, "POST", "/api/lists/l1/choices")).toEqual([]);
    expect(document.activeElement).not.toBe(entryName());
  });

  it("says what is wrong with a new choice, in place", async () => {
    const { fetch } = await openPanel();
    await userEvent.type(entryName(), "{Enter}");
    expect(screen.queryByText("Name needed")).toBeNull();
    await userEvent.type(screen.getByLabelText("New choice description"), "x");
    await userEvent.type(entryName(), "{Enter}");
    expect(screen.getByText("Name needed")).toBeDefined();
    await userEvent.type(entryName(), " northmere {Enter}");
    expect(screen.getByText("Already in this list")).toBeDefined();
    await userEvent.clear(entryName());
    await userEvent.click(entryName());
    await userEvent.paste("x".repeat(58));
    expect(screen.getByText("58/60")).toBeDefined();
    await userEvent.paste("xxx");
    await userEvent.keyboard("{Enter}");
    expect(screen.getByText("Too long")).toBeDefined();
    expect(screen.getByText("61/60")).toBeDefined();
    expect(bodyOf(fetch, "POST", "/api/lists/l1/choices")).toEqual([]);
  });

  it("clears the empty row with Escape, and closes the panel when it is already empty", async () => {
    const { history } = await openPanel();
    await userEvent.type(entryName(), "Draft{Escape}");
    expect(entryName().value).toBe("");
    await userEvent.keyboard("{Escape}");
    await waitFor(() => {
      expect(history.location.pathname).toBe("/lists");
    });
  });

  it("adds every pasted line as a choice, all at once", async () => {
    const { fetch } = await openPanel({
      "POST /api/lists/l1/choices": () =>
        Response.json(
          { choices: [choice("c8", "Ashgrove"), choice("c9", "Brindle")] },
          { status: 201 },
        ),
    });
    await userEvent.click(entryName());
    await userEvent.paste("Ashgrove\tSatellite office\nBrindle");
    await waitFor(() => {
      expect(bodyOf(fetch, "POST", "/api/lists/l1/choices")).toEqual([
        {
          choices: [
            { label: "Ashgrove", description: "Satellite office" },
            { label: "Brindle", description: "" },
          ],
        },
      ]);
    });
  });

  it.each([
    ["one the list has", "Ashgrove\nNorthmere", "Line 2: Already in this list"],
    [
      "the same name twice",
      "Ashgrove\nashgrove",
      "Line 2: Already in this list",
    ],
    ["a name too long", `Ashgrove\n${"x".repeat(61)}`, "Line 2: Too long"],
    [
      "a description too long",
      `Ashgrove\tx\nBrindle\t${"x".repeat(501)}`,
      "Line 2: Description too long",
    ],
  ])(
    "adds nothing when the pasted lines include %s",
    async (_case, text, message) => {
      const { fetch } = await openPanel();
      await userEvent.click(entryName());
      await userEvent.paste(text);
      expect(screen.getByText(message)).toBeDefined();
      expect(bodyOf(fetch, "POST", "/api/lists/l1/choices")).toEqual([]);
    },
  );

  it("pastes a single line as ordinary text", async () => {
    await openPanel();
    await userEvent.click(entryName());
    await userEvent.paste("Ashgrove");
    expect(entryName().value).toBe("Ashgrove");
  });

  it("says when choices cannot be added", async () => {
    await openPanel({ "POST /api/lists/l1/choices": refused(500) });
    await userEvent.type(entryName(), "Ashgrove{Enter}");
    expect(
      await screen.findByText(
        "Fathom could not add the choices. Try again in a moment.",
      ),
    ).toBeDefined();
  });
});

describe("moving through choices", () => {
  it("selects choices with the arrow keys, Home, and End, and goes on into the empty row", async () => {
    await openPanel();
    focusRow("c1");
    await userEvent.keyboard("{ArrowDown}");
    await waitFor(() => {
      expect(document.activeElement).toBe(row("c2"));
    });
    expect(row("c2").getAttribute("aria-selected")).toBe("true");
    await userEvent.keyboard("{End}");
    await waitFor(() => {
      expect(document.activeElement).toBe(entryName());
    });
    await userEvent.keyboard("{ArrowUp}");
    await waitFor(() => {
      expect(document.activeElement).toBe(row("c3"));
    });
    await userEvent.keyboard("{Home}");
    await waitFor(() => {
      expect(document.activeElement).toBe(row("c1"));
    });
    await userEvent.keyboard("{ArrowUp}");
    expect(document.activeElement).toBe(row("c1"));
    await userEvent.keyboard("{a}");
    expect(document.activeElement).toBe(row("c1"));
  });

  it("goes on from the empty row into retired choices when shown", async () => {
    await openPanel();
    await userEvent.click(
      within(panel()).getByRole("button", { name: "Show retired (1)" }),
    );
    await userEvent.click(entryName());
    await userEvent.keyboard("{ArrowDown}");
    await waitFor(() => {
      expect(document.activeElement).toBe(row("c4"));
    });
  });
});

describe("editing choices", () => {
  const saved = () =>
    Response.json({
      choice: choice("c2", "Northmere Lab"),
      changeSetId: s1,
    });

  it("edits a choice in place with Enter, saves it with Enter, and undoes it", async () => {
    const { fetch } = await openPanel({
      "PUT /api/lists/l1/choices/c2": saved,
    });
    focusRow("c2");
    await userEvent.keyboard("{Enter}");
    const name = await screen.findByLabelText<HTMLInputElement>("name");
    await waitFor(() => {
      expect(document.activeElement).toBe(name);
    });
    await userEvent.type(name, " Lab{Enter}");
    await waitFor(() => {
      expect(bodyOf(fetch, "PUT", "/api/lists/l1/choices/c2")).toHaveLength(1);
    });
    await undoWithKeys(fetch);
    await waitFor(() => {
      expect(undone(fetch)).toEqual([s1]);
    });
    expect(row("c2").textContent).toContain("Northmere");
    expect(row("c2").textContent).not.toContain("Lab");
  });

  it("starts editing with a click, but not from the choice's actions", async () => {
    await openPanel();
    await userEvent.click(
      screen.getByRole("button", { name: "Actions for Northmere" }),
    );
    expect(screen.queryByLabelText("name")).toBeNull();
    await userEvent.keyboard("{Escape}");
    await userEvent.click(within(row("c2")).getByText("Northmere"));
    expect(await screen.findByLabelText("name")).toBeDefined();
    await userEvent.click(screen.getByLabelText("name"));
  });

  it.each([
    ["Tab from the description", "{Tab}{Tab}"],
    ["Shift+Tab from the name", "{Shift>}{Tab}{/Shift}"],
  ])("saves when leaving with %s", async (_case, keys) => {
    const { fetch } = await openPanel({
      "PUT /api/lists/l1/choices/c2": saved,
    });
    focusRow("c2");
    await userEvent.keyboard("{Enter}");
    await userEvent.type(await screen.findByLabelText("name"), " Lab");
    await userEvent.keyboard(keys);
    await waitFor(() => {
      expect(bodyOf(fetch, "PUT", "/api/lists/l1/choices/c2")).toHaveLength(1);
    });
  });

  it("saves when focus leaves the row, and sends nothing when nothing changed", async () => {
    const { fetch } = await openPanel({
      "PUT /api/lists/l1/choices/c2": saved,
    });
    focusRow("c2");
    await userEvent.keyboard("{Enter}");
    await screen.findByLabelText("name");
    await userEvent.click(
      screen.getByRole("heading", { name: "Locations", level: 2 }),
    );
    await waitFor(() => {
      expect(screen.queryByLabelText("name")).toBeNull();
    });
    expect(bodyOf(fetch, "PUT", "/api/lists/l1/choices/c2")).toEqual([]);
  });

  it("cancels with Escape", async () => {
    const { fetch, history } = await openPanel();
    focusRow("c2");
    await userEvent.keyboard("{Enter}");
    await userEvent.type(await screen.findByLabelText("name"), " Lab{Escape}");
    await waitFor(() => {
      expect(document.activeElement).toBe(row("c2"));
    });
    expect(screen.getByText("Northmere")).toBeDefined();
    expect(history.location.pathname).toBe("/lists/l1");
    expect(bodyOf(fetch, "PUT", "/api/lists/l1/choices/c2")).toEqual([]);
  });

  it("keeps the row open with what is wrong", async () => {
    await openPanel();
    focusRow("c2");
    await userEvent.keyboard("{Enter}");
    const name = await screen.findByLabelText("name");
    await userEvent.clear(name);
    await userEvent.type(name, "kestrel bay{Enter}");
    expect(screen.getByText("Already in this list")).toBeDefined();
    await userEvent.type(name, "x");
    expect(screen.queryByText("Already in this list")).toBeNull();
    await userEvent.type(screen.getByLabelText("description"), "A fictional");
    expect(
      screen.getByLabelText<HTMLTextAreaElement>("description").value,
    ).toBe("A fictional");
  });

  it("says when a choice cannot be saved, and puts it back", async () => {
    await openPanel({ "PUT /api/lists/l1/choices/c2": refused(500) });
    focusRow("c2");
    await userEvent.keyboard("{Enter}");
    await userEvent.type(await screen.findByLabelText("name"), " Lab{Enter}");
    expect(
      await screen.findByText("Fathom could not save Northmere Lab."),
    ).toBeDefined();
    expect(await screen.findByText("Northmere")).toBeDefined();
  });
});

describe("ordering choices", () => {
  it("moves a choice with Alt and the arrow keys, keeping focus on it, and undoes it", async () => {
    const { fetch } = await openPanel({
      "PUT /api/lists/l1/choices/c2/position": savedAs(),
    });
    focusRow("c2");
    await userEvent.keyboard("{Alt>}{ArrowDown}{/Alt}");
    await waitFor(() => {
      expect(document.activeElement).toBe(row("c2"));
    });
    await waitFor(() => {
      expect(
        bodyOf(fetch, "PUT", "/api/lists/l1/choices/c2/position"),
      ).toHaveLength(1);
    });
    await undoWithKeys(fetch);
    await waitFor(() => {
      expect(undone(fetch)).toEqual([s1]);
    });
    expect(bodyOf(fetch, "PUT", "/api/lists/l1/choices/c2/position")).toEqual([
      { after: "c3" },
    ]);
  });

  it("moves a choice up, and to the top", async () => {
    const { fetch } = await openPanel({
      "PUT /api/lists/l1/choices/c2/position": savedAs(),
    });
    focusRow("c2");
    await userEvent.keyboard("{Alt>}{ArrowUp}{/Alt}");
    await waitFor(() => {
      expect(bodyOf(fetch, "PUT", "/api/lists/l1/choices/c2/position")).toEqual(
        [{ after: null }],
      );
    });
  });

  it("does not move a choice past either end", async () => {
    const { fetch } = await openPanel();
    focusRow("c1");
    await userEvent.keyboard("{Alt>}{ArrowUp}{/Alt}");
    focusRow("c3");
    await userEvent.keyboard("{Alt>}{ArrowDown}{/Alt}");
    expect(fetch.mock.calls.some(([url]) => url.endsWith("/position"))).toBe(
      false,
    );
  });

  it.each([
    ["Move to top", null],
    ["Move up", null],
    ["Move down", "c3"],
    ["Move to bottom", "c3"],
  ] as const)("offers %s in the choice's menu", async (item, after) => {
    const { fetch } = await openPanel({
      "PUT /api/lists/l1/choices/c2/position": savedAs(),
    });
    focusRow("c2");
    await userEvent.keyboard("{Shift>}{F10}{/Shift}");
    await userEvent.click(
      await screen.findByRole("menuitem", { name: startsWith(item) }),
    );
    await waitFor(() => {
      expect(bodyOf(fetch, "PUT", "/api/lists/l1/choices/c2/position")).toEqual(
        [{ after }],
      );
    });
  });

  it.each([
    ["c1", "Move to top"],
    ["c1", "Move up"],
    ["c3", "Move down"],
    ["c3", "Move to bottom"],
  ])("disables moves that go nowhere: %s %s", async (id, item) => {
    await openPanel();
    focusRow(id);
    await userEvent.keyboard("{ContextMenu}");
    expect(
      (
        await screen.findByRole("menuitem", { name: startsWith(item) })
      ).hasAttribute("data-disabled"),
    ).toBe(true);
    await userEvent.keyboard("{Escape}");
    await waitFor(() => {
      expect(screen.queryByRole("menuitem")).toBeNull();
    });
    expect(screen.getByRole("region")).toBeDefined();
  });

  it.each([
    [500, "Fathom could not move Northmere."],
    [404, "Someone else has removed this. The lists have been refreshed."],
  ])(
    "puts a choice back and says why when the server answers %i",
    async (status, message) => {
      await openPanel({
        "PUT /api/lists/l1/choices/c2/position": refused(status),
      });
      focusRow("c2");
      await userEvent.keyboard("{Alt>}{ArrowDown}{/Alt}");
      expect(await screen.findByText(message)).toBeDefined();
    },
  );
});

describe("retiring and restoring choices", () => {
  it("retires a choice with R, selects the next, and undoes it in place", async () => {
    const { fetch } = await openPanel({
      "PUT /api/lists/l1/choices/c2/retired": savedAs(),
    });
    focusRow("c2");
    await userEvent.keyboard("r");
    expect(
      await screen.findByText("Drafted retiring Northmere."),
    ).toBeDefined();
    await waitFor(() => {
      expect(document.activeElement).toBe(row("c3"));
    });
    await undoLast();
    await waitFor(() => {
      expect(undone(fetch)).toEqual([s1]);
    });
    expect(bodyOf(fetch, "PUT", "/api/lists/l1/choices/c2/retired")).toEqual([
      { retired: true },
    ]);
    await waitFor(() => {
      expect(document.activeElement).toBe(row("c2"));
    });
  });

  it("restores a retired choice from its menu, and undoes it", async () => {
    const { fetch } = await openPanel({
      "PUT /api/lists/l1/choices/c4/retired": savedAs(),
    });
    await userEvent.click(
      within(panel()).getByRole("button", { name: "Show retired (1)" }),
    );
    focusRow("c4");
    await userEvent.keyboard("{ContextMenu}");
    const restore = await screen.findByRole("menuitem", { name: /^Restore/ });
    expect(screen.queryByRole("menuitem", { name: "Move up" })).toBeNull();
    await userEvent.click(restore);
    expect(
      await screen.findByText("Drafted restoring Old Mill."),
    ).toBeDefined();
    expect(
      within(within(panel()).getByRole("grid", { name: "Retired" })).getByText(
        "Old Mill",
      ),
    ).toBeDefined();
    await undoLast();
    await waitFor(() => {
      expect(undone(fetch)).toEqual([s1]);
    });
    expect(bodyOf(fetch, "PUT", "/api/lists/l1/choices/c4/retired")).toEqual([
      { retired: false },
    ]);
  });

  it("keeps a choice drafted to be restored among the retired beside live, with no moves", async () => {
    const restoring = {
      ...locations,
      choices: [
        ...locations.choices.filter((one) => one.id !== "c4"),
        choice("c4", "Old Mill", {
          retired: false,
          draft: recordDraft({ changed: ["retired"], live: { retired: true } }),
        }),
      ],
    };
    const { fetch } = await openPanel({
      "GET /api/lists": () =>
        Response.json({ lists: [restoring, skills, empty, regions] }),
    });
    await userEvent.click(
      within(panel()).getByRole("button", { name: "Show retired (1)" }),
    );
    expect(
      within(
        within(panel()).getByRole("grid", { name: "Retired" }),
      ).getAllByText("Old Mill").length,
    ).toBeGreaterThan(0);
    focusRow("c4");
    await userEvent.keyboard("{Alt>}{ArrowDown}{/Alt}");
    await userEvent.keyboard("{ContextMenu}");
    expect(
      await screen.findByRole("menuitem", { name: /^Edit/ }),
    ).toBeDefined();
    expect(screen.queryByRole("menuitem", { name: /^Move/ })).toBeNull();
    expect(fetch.mock.calls.some(([url]) => url.endsWith("/position"))).toBe(
      false,
    );
  });

  it("says when a choice cannot be retired", async () => {
    await openPanel({
      "PUT /api/lists/l1/choices/c3/retired": refused(500),
    });
    focusRow("c3");
    await userEvent.keyboard("R");
    expect(
      await screen.findByText("Fathom could not retire Corran Quay."),
    ).toBeDefined();
  });
});

describe("choice menus", () => {
  it("are named after their choice, and close when anything but an item is clicked", async () => {
    await openPanel();
    focusRow("c2");
    await userEvent.keyboard("{ContextMenu}");
    const menu = await screen.findByRole("menu");
    await userEvent.click(within(menu).getByText("Northmere"));
    await waitFor(() => {
      expect(screen.queryByRole("menu")).toBeNull();
    });
  });

  it("close with Esc before the panel does, putting focus back on their choice", async () => {
    const { history } = await openPanel();
    focusRow("c2");
    await userEvent.keyboard("{ContextMenu}");
    await screen.findByRole("menu");

    await userEvent.keyboard("{Escape}");

    await waitFor(() => {
      expect(screen.queryByRole("menu")).toBeNull();
    });
    await waitFor(() => {
      expect(document.activeElement).toBe(row("c2"));
    });
    expect(history.location.pathname).toBe("/lists/l1");
    await userEvent.keyboard("{Escape}");
    await waitFor(() => {
      expect(history.location.pathname).toBe("/lists");
    });
  });
});

describe("removing choices", () => {
  it("drafts removing a choice with Delete, keeping it in place, struck through, and undoes it", async () => {
    let shown = [locations, skills, empty, regions];
    const { fetch } = await openPanel({
      "GET /api/lists": () => Response.json({ lists: shown }),
      "DELETE /api/lists/l1/choices/c3": () => {
        shown = [
          {
            ...locations,
            choices: locations.choices.map((one) =>
              one.id === "c3" ? { ...one, draft: removal } : one,
            ),
          },
          skills,
          empty,
          regions,
        ];
        return savedAs()();
      },
    });
    focusRow("c3");
    await userEvent.keyboard("{Delete}");
    expect(await within(row("c3")).findByText(/Draft: removed/)).toBeDefined();
    await waitFor(() => {
      expect(document.activeElement).toBe(row("c2"));
    });
    await undoWithKeys(fetch);
    await waitFor(() => {
      expect(undone(fetch)).toEqual([s1]);
    });
  });

  it("removes a retired choice from its menu, and undoes it", async () => {
    const { fetch } = await openPanel({
      "DELETE /api/lists/l1/choices/c4": savedAs(),
    });
    await userEvent.click(
      within(panel()).getByRole("button", { name: "Show retired (1)" }),
    );
    focusRow("c4");
    await userEvent.keyboard("{Shift>}{F10}{/Shift}");
    await userEvent.click(
      await screen.findByRole("menuitem", { name: /^Remove/ }),
    );
    await undoWithKeys(fetch);
    await waitFor(() => {
      expect(undone(fetch)).toEqual([s1]);
    });
  });

  it("removes the only choice, moving focus to the empty row, and edits from the menu", async () => {
    serverAnswers({
      "GET /api/session": editor,
      "GET /api/lists": listsAnswer,
      "DELETE /api/lists/l2/choices/c5": savedAs(),
    });
    renderApp("/lists/l2");
    await screen.findByRole("heading", { name: "Skills", level: 2 });
    focusRow("c5");
    await userEvent.keyboard("{ContextMenu}");
    await userEvent.click(
      await screen.findByRole("menuitem", { name: /^Edit/ }),
    );
    expect(await screen.findByLabelText("name")).toBeDefined();
    await userEvent.keyboard("{Escape}");
    focusRow("c5");
    await userEvent.keyboard("{Backspace}");
    await waitFor(() => {
      expect(document.activeElement).toBe(entryName());
    });
  });

  it("says when the undo cannot be done", async () => {
    const { fetch } = await openPanel({
      "DELETE /api/lists/l1/choices/c3": savedAs(),
      [`POST /api/undo/${s1}`]: refused(500),
    });
    focusRow("c3");
    await userEvent.keyboard("{Delete}");
    await undoWithKeys(fetch);
    expect(
      await screen.findByText(
        "Fathom could not undo the change. Try again in a moment.",
      ),
    ).toBeDefined();
  });
});
