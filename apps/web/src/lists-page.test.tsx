// SPDX-License-Identifier: Apache-2.0

// Tests for the Lists page, with the server's responses simulated: who sees it; the table of lists;
// the side panel and its address; adding, editing, moving, retiring, restoring, and removing choices
// from the keyboard and the choice menus, including pasting several at once; creating, editing,
// retiring, and deleting lists; and Undo, focus, and the server's refusals throughout. Where dropped
// choices end up is tested in list-panel.test.ts.

import { act, screen, within } from "@testing-library/react";
import { userEvent } from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  fictionalUser,
  greeting,
  renderApp,
  serverAnswers,
  signedIn,
} from "./test-support.tsx";

const viewer = () =>
  Response.json({
    ...fictionalUser,
    permissions: ["configuration:view", "plan:view"],
  });

const editor = () =>
  Response.json({
    ...fictionalUser,
    roles: ["viewer", "workforce-administrator"],
    permissions: ["configuration:edit", "configuration:view", "plan:view"],
  });

const choice = (id: string, label: string, extra: object = {}) => ({
  id,
  label,
  description: "",
  retired: false,
  ...extra,
});

const locations = {
  id: "l1",
  name: "Locations",
  description: "Offices and labs.",
  visibility: "general",
  retired: false,
  choices: [
    choice("c1", "Kestrel Bay", { description: "Head office." }),
    choice("c2", "Northmere"),
    choice("c3", "Corran Quay"),
    choice("c4", "Old Mill", { retired: true }),
  ],
};
const skills = {
  id: "l2",
  name: "Skills",
  description: "",
  visibility: "restricted",
  retired: false,
  choices: [choice("c5", "Rust")],
};
const empty = {
  id: "l3",
  name: "Empty List",
  description: "",
  visibility: "general",
  retired: false,
  choices: [],
};
const regions = {
  id: "l4",
  name: "Regions",
  description: "",
  visibility: "confidential",
  retired: true,
  choices: [choice("c6", "North"), choice("c7", "South", { retired: true })],
};

const listsAnswer = () =>
  Response.json({ lists: [locations, skills, empty, regions] });
const noContent = () => new Response(null, { status: 204 });
const refused = (status: number) => () =>
  Response.json({ error: "Refused" }, { status });

afterEach(() => {
  vi.unstubAllGlobals();
});

type Answers = Parameters<typeof serverAnswers>[0];

async function openPanel(answers: Answers = {}, path = "/lists/l1") {
  const fetch = serverAnswers({
    "GET /api/session": editor,
    "GET /api/lists": listsAnswer,
    ...answers,
  });
  const history = renderApp(path);
  await screen.findByRole("heading", { name: "Locations", level: 2 });
  return { fetch, history };
}

function panel(): HTMLElement {
  return screen.getByRole("region", { name: /./ });
}

function row(id: string): HTMLElement {
  return document.getElementById(`choice-${id}`) as HTMLElement;
}

function focusRow(id: string) {
  act(() => {
    row(id).focus();
  });
}

function entryName() {
  return screen.getByLabelText<HTMLInputElement>("New choice name");
}

function bodyOf(
  fetch: ReturnType<typeof serverAnswers>,
  method: string,
  url: string,
): unknown[] {
  return fetch.mock.calls
    .filter(([called, init]) => called === url && init?.method === method)
    .map(([, init]) => JSON.parse(init?.body as string) as unknown);
}

// Matches an accessible name that starts with the text, such as a menu item followed by its shortcut.
function startsWith(text: string) {
  return (name: string) => name.startsWith(text);
}

// Undoes the latest change with Cmd+Z, once it has finished saving and become undoable.
async function undoWithKeys() {
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 20));
  });
  await userEvent.keyboard("{Meta>}z{/Meta}");
}

async function undoLast() {
  await userEvent.click(await screen.findByRole("button", { name: "Undo" }));
}

describe("who sees the Lists page", () => {
  it("links to it for users who may see planning configuration", async () => {
    serverAnswers({
      "GET /api/session": viewer,
      "GET /api/greeting": greeting,
      "GET /api/lists": listsAnswer,
    });
    renderApp("/");
    await userEvent.click(await screen.findByRole("link", { name: "Lists" }));
    expect(await screen.findByRole("table", { name: "Lists" })).toBeDefined();
    expect(screen.queryByRole("button", { name: "New list" })).toBeNull();
  });

  it("is not linked or shown for anyone else", async () => {
    serverAnswers({
      "GET /api/session": signedIn,
      "GET /api/greeting": greeting,
    });
    const history = renderApp("/");
    expect(await screen.findByText("Hello, Fathom")).toBeDefined();
    expect(screen.queryByRole("link", { name: "Lists" })).toBeNull();
    for (const path of ["/lists", "/lists/l1"]) {
      history.push(path);
      expect(
        await screen.findByText("There is no page at this address."),
      ).toBeDefined();
    }
  });
});

describe("the table of lists", () => {
  it("shows each current list with its description and offered choices in order", async () => {
    serverAnswers({
      "GET /api/session": viewer,
      "GET /api/lists": listsAnswer,
    });
    renderApp("/lists");
    const table = await screen.findByRole("table", { name: "Lists" });
    const rows = within(table)
      .getAllByRole("row")
      .slice(1)
      .map((tableRow) => tableRow.textContent);
    expect(rows).toEqual([
      "LocationsOffices and labs.(3) Kestrel Bay, Northmere, Corran Quay",
      "Skills(1) Rust",
      "Empty List(0) ",
    ]);
  });

  it("shows retired lists only when asked", async () => {
    serverAnswers({
      "GET /api/session": viewer,
      "GET /api/lists": listsAnswer,
    });
    renderApp("/lists");
    await userEvent.click(
      await screen.findByRole("button", { name: "Show retired (1)" }),
    );
    expect(screen.getByText("Regions")).toBeDefined();
    expect(screen.getByText("Retired")).toBeDefined();
    await userEvent.click(screen.getByRole("button", { name: "Hide retired" }));
    expect(screen.queryByText("Regions")).toBeNull();
  });

  it("says when there are no lists yet", async () => {
    serverAnswers({
      "GET /api/session": viewer,
      "GET /api/lists": () => Response.json({ lists: [] }),
    });
    renderApp("/lists");
    expect(await screen.findByText("No lists yet")).toBeDefined();
  });

  it("shows a loading indicator until the lists arrive", async () => {
    serverAnswers({
      "GET /api/session": viewer,
      "GET /api/lists": () => new Promise<Response>(() => undefined),
    });
    renderApp("/lists");
    expect(await screen.findByLabelText("Loading")).toBeDefined();
  });

  it("says when the lists cannot be loaded, and tries again", async () => {
    let attempts = 0;
    serverAnswers({
      "GET /api/session": viewer,
      "GET /api/lists": () => {
        attempts += 1;
        return attempts === 1 ? refused(500)() : listsAnswer();
      },
    });
    renderApp("/lists");
    expect((await screen.findByRole("alert")).textContent).toMatch(
      /could not load the lists/,
    );
    await userEvent.click(screen.getByRole("button", { name: "Try again" }));
    expect(await screen.findByText("Skills")).toBeDefined();
  });

  it("opens no panel when the address names no list", async () => {
    serverAnswers({
      "GET /api/session": viewer,
      "GET /api/lists": listsAnswer,
    });
    renderApp("/lists/unknown");
    await screen.findByRole("table", { name: "Lists" });
    expect(screen.queryByRole("region")).toBeNull();
  });
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
    await vi.waitFor(() => {
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
    expect(screen.queryByRole("button", { name: "Edit list" })).toBeNull();
    expect(screen.queryByRole("button", { name: /^Actions for/ })).toBeNull();
    await userEvent.click(row("c1"));
    expect(screen.queryByLabelText("name")).toBeNull();
    history.push("/lists/l3");
    expect(await screen.findByText("No choices yet")).toBeDefined();
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
    vi.stubGlobal("matchMedia", (query: string) => ({
      matches: true,
      media: query,
      addEventListener: () => undefined,
      removeEventListener: () => undefined,
    }));
    await openPanel();
    expect(
      row("c1").querySelector("[data-rbd-drag-handle-draggable-id]"),
    ).toBeNull();
  });
});

describe("adding choices", () => {
  const added = (label: string) => () =>
    Response.json({ choices: [choice("c9", label)] }, { status: 201 });

  it("adds a choice from the empty row, keeps focus there, and undoes it", async () => {
    const { fetch } = await openPanel({
      "POST /api/lists/l1/choices": added("Fenwick Down"),
      "DELETE /api/lists/l1/choices/c9": noContent,
    });
    await userEvent.type(entryName(), "Fenwick Down");
    await userEvent.tab();
    await userEvent.type(
      screen.getByLabelText("New choice description"),
      "Test lab.{Enter}",
    );
    await vi.waitFor(() => {
      expect(bodyOf(fetch, "POST", "/api/lists/l1/choices")).toEqual([
        { choices: [{ label: "Fenwick Down", description: "Test lab." }] },
      ]);
    });
    expect(screen.queryByText(/^Added/)).toBeNull();
    expect(entryName().value).toBe("");
    await vi.waitFor(() => {
      expect(document.activeElement).toBe(entryName());
    });
    await undoWithKeys();
    await vi.waitFor(() => {
      expect(
        fetch.mock.calls.some(
          ([url, init]) =>
            url === "/api/lists/l1/choices/c9" && init?.method === "DELETE",
        ),
      ).toBe(true);
    });
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
    await vi.waitFor(() => {
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
    await vi.waitFor(() => {
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
    await vi.waitFor(() => {
      expect(document.activeElement).toBe(row("c2"));
    });
    expect(row("c2").getAttribute("aria-selected")).toBe("true");
    await userEvent.keyboard("{End}");
    await vi.waitFor(() => {
      expect(document.activeElement).toBe(entryName());
    });
    await userEvent.keyboard("{ArrowUp}");
    await vi.waitFor(() => {
      expect(document.activeElement).toBe(row("c3"));
    });
    await userEvent.keyboard("{Home}");
    await vi.waitFor(() => {
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
    await vi.waitFor(() => {
      expect(document.activeElement).toBe(row("c4"));
    });
  });
});

describe("editing choices", () => {
  const saved = () => Response.json({ choice: choice("c2", "Northmere Lab") });

  it("edits a choice in place with Enter, saves it with Enter, and undoes it", async () => {
    const { fetch } = await openPanel({
      "PUT /api/lists/l1/choices/c2": saved,
    });
    focusRow("c2");
    await userEvent.keyboard("{Enter}");
    const name = await screen.findByLabelText<HTMLInputElement>("name");
    await vi.waitFor(() => {
      expect(document.activeElement).toBe(name);
    });
    await userEvent.type(name, " Lab{Enter}");
    await vi.waitFor(() => {
      expect(bodyOf(fetch, "PUT", "/api/lists/l1/choices/c2")).toHaveLength(1);
    });
    await undoWithKeys();
    await vi.waitFor(() => {
      expect(bodyOf(fetch, "PUT", "/api/lists/l1/choices/c2")).toEqual([
        { label: "Northmere Lab", description: "" },
        { label: "Northmere", description: "" },
      ]);
    });
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
    await vi.waitFor(() => {
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
    await vi.waitFor(() => {
      expect(screen.queryByLabelText("name")).toBeNull();
    });
    expect(bodyOf(fetch, "PUT", "/api/lists/l1/choices/c2")).toEqual([]);
  });

  it("cancels with Escape", async () => {
    const { fetch, history } = await openPanel();
    focusRow("c2");
    await userEvent.keyboard("{Enter}");
    await userEvent.type(await screen.findByLabelText("name"), " Lab{Escape}");
    await vi.waitFor(() => {
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
      "PUT /api/lists/l1/choices/c2/position": noContent,
    });
    focusRow("c2");
    await userEvent.keyboard("{Alt>}{ArrowDown}{/Alt}");
    await vi.waitFor(() => {
      expect(document.activeElement).toBe(row("c2"));
    });
    await vi.waitFor(() => {
      expect(
        bodyOf(fetch, "PUT", "/api/lists/l1/choices/c2/position"),
      ).toHaveLength(1);
    });
    await undoWithKeys();
    await vi.waitFor(() => {
      expect(bodyOf(fetch, "PUT", "/api/lists/l1/choices/c2/position")).toEqual(
        [{ after: "c3" }, { after: "c1" }],
      );
    });
  });

  it("moves a choice up, and to the top", async () => {
    const { fetch } = await openPanel({
      "PUT /api/lists/l1/choices/c2/position": noContent,
    });
    focusRow("c2");
    await userEvent.keyboard("{Alt>}{ArrowUp}{/Alt}");
    await vi.waitFor(() => {
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
      "PUT /api/lists/l1/choices/c2/position": noContent,
    });
    focusRow("c2");
    await userEvent.keyboard("{Shift>}{F10}{/Shift}");
    await userEvent.click(
      await screen.findByRole("menuitem", { name: startsWith(item) }),
    );
    await vi.waitFor(() => {
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
    await vi.waitFor(() => {
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
      "PUT /api/lists/l1/choices/c2/retired": noContent,
      "PUT /api/lists/l1/choices/c2/position": noContent,
    });
    focusRow("c2");
    await userEvent.keyboard("r");
    expect(await screen.findByText("Retired Northmere.")).toBeDefined();
    await vi.waitFor(() => {
      expect(document.activeElement).toBe(row("c3"));
    });
    await undoLast();
    await vi.waitFor(() => {
      expect(bodyOf(fetch, "PUT", "/api/lists/l1/choices/c2/retired")).toEqual([
        { retired: true, keepPlace: false },
        { retired: false, keepPlace: true },
      ]);
      expect(bodyOf(fetch, "PUT", "/api/lists/l1/choices/c2/position")).toEqual(
        [{ after: "c1" }],
      );
    });
    await vi.waitFor(() => {
      expect(document.activeElement).toBe(row("c2"));
    });
  });

  it("restores a retired choice to the end from its menu, and undoes it", async () => {
    const { fetch } = await openPanel({
      "PUT /api/lists/l1/choices/c4/retired": noContent,
      "PUT /api/lists/l1/choices/c4/position": noContent,
    });
    await userEvent.click(
      within(panel()).getByRole("button", { name: "Show retired (1)" }),
    );
    focusRow("c4");
    await userEvent.keyboard("{ContextMenu}");
    expect(screen.queryByRole("menuitem", { name: "Move up" })).toBeNull();
    await userEvent.click(
      await screen.findByRole("menuitem", { name: /^Restore/ }),
    );
    expect(await screen.findByText("Restored Old Mill.")).toBeDefined();
    await undoLast();
    await vi.waitFor(() => {
      expect(bodyOf(fetch, "PUT", "/api/lists/l1/choices/c4/retired")).toEqual([
        { retired: false, keepPlace: false },
        { retired: true, keepPlace: true },
      ]);
      expect(bodyOf(fetch, "PUT", "/api/lists/l1/choices/c4/position")).toEqual(
        [{ after: "c3" }],
      );
    });
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

describe("removing choices", () => {
  it("removes a choice with Delete, and undoes it by adding it back in its place", async () => {
    const { fetch } = await openPanel({
      "DELETE /api/lists/l1/choices/c3": noContent,
      "POST /api/lists/l1/choices": () =>
        Response.json(
          { choices: [choice("c9", "Corran Quay")] },
          { status: 201 },
        ),
      "PUT /api/lists/l1/choices/c9/position": noContent,
    });
    focusRow("c3");
    await userEvent.keyboard("{Delete}");
    expect(await screen.findByText("Removed Corran Quay.")).toBeDefined();
    await vi.waitFor(() => {
      expect(document.activeElement).toBe(row("c2"));
    });
    await undoLast();
    await vi.waitFor(() => {
      expect(bodyOf(fetch, "PUT", "/api/lists/l1/choices/c9/position")).toEqual(
        [{ after: "c2" }],
      );
    });
  });

  it("removes a retired choice from its menu, and undoes it as retired", async () => {
    const { fetch } = await openPanel({
      "DELETE /api/lists/l1/choices/c4": noContent,
      "POST /api/lists/l1/choices": () =>
        Response.json({ choices: [choice("c9", "Old Mill")] }, { status: 201 }),
      "PUT /api/lists/l1/choices/c9/position": noContent,
      "PUT /api/lists/l1/choices/c9/retired": noContent,
    });
    await userEvent.click(
      within(panel()).getByRole("button", { name: "Show retired (1)" }),
    );
    focusRow("c4");
    await userEvent.keyboard("{Shift>}{F10}{/Shift}");
    await userEvent.click(
      await screen.findByRole("menuitem", { name: /^Remove/ }),
    );
    await undoLast();
    await vi.waitFor(() => {
      expect(bodyOf(fetch, "PUT", "/api/lists/l1/choices/c9/retired")).toEqual([
        { retired: true, keepPlace: false },
      ]);
    });
  });

  it("removes the only choice, moving focus to the empty row, and edits from the menu", async () => {
    serverAnswers({
      "GET /api/session": editor,
      "GET /api/lists": listsAnswer,
      "DELETE /api/lists/l2/choices/c5": noContent,
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
    await vi.waitFor(() => {
      expect(document.activeElement).toBe(entryName());
    });
  });

  it("says when the undo cannot be done", async () => {
    await openPanel({
      "DELETE /api/lists/l1/choices/c3": noContent,
      "POST /api/lists/l1/choices": refused(500),
    });
    focusRow("c3");
    await userEvent.keyboard("{Delete}");
    await undoLast();
    expect(
      await screen.findByText(
        "Fathom could not undo the change. Try again in a moment.",
      ),
    ).toBeDefined();
  });
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
      "GET /api/session": editor,
      "GET /api/lists": () => Response.json({ lists }),
      "POST /api/lists": () => {
        lists = [...lists, createdList];
        return Response.json({ list: createdList }, { status: 201 });
      },
      "DELETE /api/lists/l9": noContent,
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
    await userEvent.click(within(dialog).getByText("Restricted"));
    await userEvent.click(
      within(dialog).getByRole("button", { name: "Create list" }),
    );
    expect(bodyOf(fetch, "POST", "/api/lists")).toEqual([
      {
        name: "Product areas",
        description: "Parts of the product.",
        visibility: "restricted",
      },
    ]);
    await vi.waitFor(() => {
      expect(history.location.pathname).toBe("/lists/l9");
    });
    expect(
      await screen.findByRole("heading", { name: "Product areas", level: 2 }),
    ).toBeDefined();
    expect(
      within(screen.getByRole("table", { name: "Lists" })).getByText(
        "Product areas",
      ),
    ).toBeDefined();
    await undoWithKeys();
    await vi.waitFor(() => {
      expect(
        fetch.mock.calls.some(
          ([url, init]) => url === "/api/lists/l9" && init?.method === "DELETE",
        ),
      ).toBe(true);
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
    expect(within(dialog).getByText("Already a list")).toBeDefined();
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
    [409, "Already a list"],
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
        Response.json({ list: { ...skills, name: "Strengths" } }),
    });
    renderApp("/lists/l2");
    await userEvent.click(
      await screen.findByRole("button", { name: "Edit list" }),
    );
    const dialog = await screen.findByRole("dialog", { name: "Edit list" });
    const name = within(dialog).getByLabelText("Name");
    await userEvent.clear(name);
    await userEvent.type(name, "Strengths");
    await userEvent.click(within(dialog).getByRole("button", { name: "Save" }));
    await vi.waitFor(() => {
      expect(bodyOf(fetch, "PUT", "/api/lists/l2")).toHaveLength(1);
    });
    await undoWithKeys();
    await vi.waitFor(() => {
      expect(bodyOf(fetch, "PUT", "/api/lists/l2")).toEqual([
        { name: "Strengths", description: "", visibility: "restricted" },
        { name: "Skills", description: "", visibility: "restricted" },
      ]);
    });
  });

  it("retires a list, and undoes it", async () => {
    const fetch = serverAnswers({
      "GET /api/session": editor,
      "GET /api/lists": listsAnswer,
      "PUT /api/lists/l2/retired": noContent,
    });
    renderApp("/lists/l2");
    await userEvent.click(
      await screen.findByRole("button", { name: "Edit list" }),
    );
    await userEvent.click(
      await screen.findByRole("button", { name: "Retire list" }),
    );
    expect(await screen.findByText("Retired Skills.")).toBeDefined();
    await undoLast();
    await vi.waitFor(() => {
      expect(bodyOf(fetch, "PUT", "/api/lists/l2/retired")).toEqual([
        { retired: true },
        { retired: false },
      ]);
    });
  });

  it("restores a retired list", async () => {
    serverAnswers({
      "GET /api/session": editor,
      "GET /api/lists": listsAnswer,
      "PUT /api/lists/l4/retired": noContent,
    });
    renderApp("/lists/l4");
    await userEvent.click(
      await screen.findByRole("button", { name: "Edit list" }),
    );
    await userEvent.click(
      await screen.findByRole("button", { name: "Restore list" }),
    );
    expect(await screen.findByText("Restored Regions.")).toBeDefined();
  });

  it("says when a list cannot be retired", async () => {
    serverAnswers({
      "GET /api/session": editor,
      "GET /api/lists": listsAnswer,
      "PUT /api/lists/l2/retired": refused(500),
    });
    renderApp("/lists/l2");
    await userEvent.click(
      await screen.findByRole("button", { name: "Edit list" }),
    );
    await userEvent.click(
      await screen.findByRole("button", { name: "Retire list" }),
    );
    expect(
      await screen.findByText("Fathom could not retire Skills."),
    ).toBeDefined();
  });

  it("deletes a list, closing its panel, and undoes it with its choices, retired ones too", async () => {
    let lists = [locations, skills, empty, regions];
    const fetch = serverAnswers({
      "GET /api/session": editor,
      "GET /api/lists": () => Response.json({ lists }),
      "DELETE /api/lists/l4": () => {
        lists = [locations, skills, empty];
        return noContent();
      },
      "POST /api/lists": () => {
        lists = [...lists, { ...regions, id: "l8" }];
        return Response.json(
          { list: { ...regions, id: "l8", choices: [] } },
          { status: 201 },
        );
      },
      "POST /api/lists/l8/choices": () =>
        Response.json(
          { choices: [choice("d1", "North"), choice("d2", "South")] },
          { status: 201 },
        ),
      "PUT /api/lists/l8/choices/d2/retired": noContent,
      "PUT /api/lists/l8/retired": noContent,
    });
    const history = renderApp("/lists/l4");
    await userEvent.click(
      await screen.findByRole("button", { name: "Edit list" }),
    );
    await userEvent.click(
      await screen.findByRole("button", { name: "Delete list" }),
    );
    expect(await screen.findByText("Deleted Regions.")).toBeDefined();
    await vi.waitFor(() => {
      expect(history.location.pathname).toBe("/lists");
    });
    await undoLast();
    await vi.waitFor(() => {
      expect(history.location.pathname).toBe("/lists/l8");
    });
    expect(bodyOf(fetch, "POST", "/api/lists/l8/choices")).toEqual([
      {
        choices: [
          { label: "North", description: "" },
          { label: "South", description: "" },
        ],
      },
    ]);
    expect(bodyOf(fetch, "PUT", "/api/lists/l8/retired")).toEqual([
      { retired: true },
    ]);
  });

  it("undoes deleting a list that had no choices", async () => {
    const fetch = serverAnswers({
      "GET /api/session": editor,
      "GET /api/lists": listsAnswer,
      "DELETE /api/lists/l3": noContent,
      "POST /api/lists": () =>
        Response.json({ list: { ...empty, id: "l7" } }, { status: 201 }),
    });
    renderApp("/lists/l3");
    await userEvent.click(
      await screen.findByRole("button", { name: "Edit list" }),
    );
    await userEvent.click(
      await screen.findByRole("button", { name: "Delete list" }),
    );
    await undoLast();
    await vi.waitFor(() => {
      expect(bodyOf(fetch, "POST", "/api/lists")).toHaveLength(1);
    });
    expect(bodyOf(fetch, "POST", "/api/lists/l7/choices")).toEqual([]);
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
    await vi.waitFor(() => {
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
      await screen.findByRole("button", { name: "Edit list" }),
    );
    await userEvent.click(
      await screen.findByRole("button", { name: "Delete list" }),
    );
    expect(
      await screen.findByText("Fathom could not delete Skills."),
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
    await vi.waitFor(() => {
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
    await vi.waitFor(() => {
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
    await vi.waitFor(() => {
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
    await vi.waitFor(() => {
      expect(document.activeElement).toBe(title);
    });
  });

  it("goes back to the list's row in the table when the panel closes with Esc from its buttons", async () => {
    const { history } = await openPanel();
    act(() => {
      screen.getByRole("button", { name: "Close" }).focus();
    });
    await userEvent.keyboard("{Escape}");
    await vi.waitFor(() => {
      expect(history.location.pathname).toBe("/lists");
    });
    await vi.waitFor(() => {
      expect(document.activeElement?.textContent).toBe("Locations");
    });
  });

  it("does not close the panel for clicks on the page's buttons", async () => {
    const { history } = await openPanel();
    await userEvent.click(
      within(
        screen.getByRole("table", { name: "Lists" })
          .parentElement as HTMLElement,
      ).getByRole("button", {
        name: "Show retired (1)",
      }),
    );
    expect(history.location.pathname).toBe("/lists/l1");
  });

  it("moves to New list once a list is deleted", async () => {
    serverAnswers({
      "GET /api/session": editor,
      "GET /api/lists": listsAnswer,
      "DELETE /api/lists/l2": noContent,
    });
    renderApp("/lists/l2");
    await userEvent.click(
      await screen.findByRole("button", { name: "Edit list" }),
    );
    await userEvent.click(
      await screen.findByRole("button", { name: "Delete list" }),
    );
    await vi.waitFor(() => {
      expect(document.activeElement?.textContent).toBe("New list");
    });
  });

  it("edits the description when it is clicked", async () => {
    await openPanel();
    await userEvent.click(screen.getByText("Head office."));
    await vi.waitFor(() => {
      expect(document.activeElement).toBe(screen.getByLabelText("description"));
    });
  });
});

describe("adding choices, more", () => {
  it("gives back what was typed when a choice cannot be added", async () => {
    await openPanel({ "POST /api/lists/l1/choices": refused(500) });
    await userEvent.type(entryName(), "Ashgrove{Enter}");
    await vi.waitFor(() => {
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
    await vi.waitFor(() => {
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
        resolve(noContent());
      };
    });
    await openPanel({
      "PUT /api/lists/l1/choices/c1/position": () => {
        order.push("c1");
        return first;
      },
      "PUT /api/lists/l1/choices/c3/position": () => {
        order.push("c3");
        return noContent();
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
    await vi.waitFor(() => {
      expect(order).toEqual(["c1", "c3"]);
    });
  });

  it.each([
    ["Ctrl+Z", "{Control>}z{/Control}", true],
    ["Ctrl+Shift+Z", "{Control>}{Shift>}z{/Shift}{/Control}", false],
    ["Cmd+Y", "{Meta>}y{/Meta}", false],
  ])("undoes the latest change with %s: %s", async (_name, keys, undone) => {
    const { fetch } = await openPanel({
      "PUT /api/lists/l1/choices/c2/position": noContent,
    });
    focusRow("c2");
    await userEvent.keyboard("{Alt>}{ArrowDown}{/Alt}");
    await vi.waitFor(() => {
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
    expect(
      bodyOf(fetch, "PUT", "/api/lists/l1/choices/c2/position"),
    ).toHaveLength(undone ? 2 : 1);
  });

  it("leaves Cmd+Z to undo typing in a field that has text", async () => {
    const { fetch } = await openPanel({
      "PUT /api/lists/l1/choices/c2/position": noContent,
    });
    focusRow("c2");
    await userEvent.keyboard("{Alt>}{ArrowDown}{/Alt}");
    await vi.waitFor(() => {
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
      "PUT /api/lists/l1/choices/c2/retired": noContent,
      "PUT /api/lists/l1/choices/c3/retired": noContent,
    });
    focusRow("c2");
    await userEvent.keyboard("r");
    expect(await screen.findByText("Retired Northmere.")).toBeDefined();
    focusRow("c3");
    await userEvent.keyboard("r");
    expect(await screen.findByText("Retired Corran Quay.")).toBeDefined();
    await vi.waitFor(() => {
      expect(screen.getAllByRole("button", { name: "Undo" })).toHaveLength(1);
    });
  });

  it("is not undone behind an open dialog", async () => {
    const { fetch } = await openPanel({
      "PUT /api/lists/l1/choices/c2/position": noContent,
    });
    focusRow("c2");
    await userEvent.keyboard("{Alt>}{ArrowDown}{/Alt}");
    await vi.waitFor(() => {
      expect(
        bodyOf(fetch, "PUT", "/api/lists/l1/choices/c2/position"),
      ).toHaveLength(1);
    });
    await userEvent.click(screen.getByRole("button", { name: "Edit list" }));
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
