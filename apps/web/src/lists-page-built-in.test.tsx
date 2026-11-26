// SPDX-License-Identifier: Apache-2.0

// Tests for built-in lists on the Lists page: their classes and changing them, the meanings of
// their choices, and the weights of feature sizes.

import { act, screen, waitFor, within } from "@testing-library/react";
import { userEvent } from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  bodyOf,
  fictionalUser,
  recordCell,
  renderApp,
  serverAnswers,
  undoWithKeys,
} from "./test-support.tsx";
import { turnedOffItem } from "./test-menus.tsx";
import {
  viewer,
  editor,
  classifier,
  choice,
  locations,
  skills,
  empty,
  regions,
  s1,
  u1,
  savedAs,
  type Answers,
  panel,
  row,
  focusRow,
  entryName,
  undone,
  startsWith,
  rowMenu,
} from "./test-lists-page.tsx";

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("built-in lists and lists with meanings", () => {
  const states = {
    id: "l5",
    keyNumber: 1,
    name: "Hiring states",
    description: "",
    visibility: "confidential",
    retired: false,
    builtIn: "hiring-states",
    choices: [
      choice("c10", "Proposed", { meaning: "proposed" }),
      choice("c11", "Open", { meaning: "open" }),
      choice("c12", "Approved", { meaning: "open" }),
    ],
  };
  const withStates = () =>
    Response.json({ lists: [locations, skills, empty, regions, states] });

  async function openStates(answers: Answers = {}) {
    const fetch = serverAnswers({
      "GET /api/session": editor,
      "GET /api/lists": withStates,
      [`POST /api/undo/${s1}`]: savedAs(u1),
      ...answers,
    });
    renderApp("/lists/l5");
    await screen.findByRole("heading", { name: "Hiring states", level: 2 });
    await waitFor(() => {
      expect(panel().contains(document.activeElement)).toBe(true);
    });
    return fetch;
  }

  it("marks a built-in list and its class, and offers neither retiring nor deleting it", async () => {
    await openStates();
    const name = recordCell("l5", "name") as HTMLElement;
    expect(within(name).getByText("Built in")).toBeTruthy();
    expect(name.querySelector("[class*='classSymbol'] svg")).not.toBeNull();
    expect(recordCell("l5", "visibility")?.textContent).toBe("Confidential");
    expect(within(panel()).getByText("Built in")).toBeTruthy();
    expect(within(panel()).getByText(", Confidential")).toBeTruthy();
    // Without Classify data, an approved list's class is neither changed nor moved.
    expect(screen.queryByRole("button", { name: "Change class…" })).toBe(null);
    expect(
      within(panel()).getByText(
        /Proposed: the request to hire is not yet approved\.\s+Open: the request to hire is approved\.\s+Hired: everyone in People who hasn't left\. A planned hire is hired when someone fills it\.\s+Left: everyone in People whose end date has passed\.\s+Keep at least one choice for each\./,
      ),
    ).toBeTruthy();
    await userEvent.click(screen.getByRole("button", { name: "Edit list…" }));
    const dialog = await screen.findByRole("dialog", { name: "Edit list" });
    expect(within(dialog).queryByRole("button", { name: "Retire list" })).toBe(
      null,
    );
    expect(within(dialog).queryByRole("button", { name: "Remove list" })).toBe(
      null,
    );
    expect(within(dialog).queryByRole("radio")).toBe(null);
    await userEvent.click(
      within(dialog).getByRole("button", { name: "Cancel" }),
    );
    const menu = await rowMenu("Hiring states");
    expect(
      within(menu).getByRole("menuitem", { name: "Show details" }),
    ).toBeTruthy();
    expect(
      within(menu).queryByRole("menuitem", { name: startsWith("Retire") }),
    ).toBe(null);
    expect(
      within(menu).queryByRole("menuitem", { name: startsWith("Remove") }),
    ).toBe(null);
  });

  it("changes an approved list's class at once, from its panel", async () => {
    let shown = skills;
    const fetch = serverAnswers({
      "GET /api/session": classifier,
      "GET /api/lists": () => Response.json({ lists: [locations, shown] }),
      "PUT /api/lists/l2/class": () => {
        shown = { ...skills, visibility: "general" };
        return savedAs(s1)();
      },
    });
    renderApp("/lists/l2");
    await screen.findByRole("heading", { name: "Skills", level: 2 });
    await userEvent.click(screen.getByRole("button", { name: "Edit list…" }));
    const edit = await screen.findByRole("dialog", { name: "Edit list" });
    expect(within(edit).queryByRole("radio")).toBe(null);
    await userEvent.click(within(edit).getByRole("button", { name: "Cancel" }));
    await userEvent.click(
      screen.getByRole("button", { name: "Change class…" }),
    );
    const dialog = await screen.findByRole("dialog", {
      name: "Change the class of Skills",
    });
    expect(
      within(dialog).getByRole<HTMLInputElement>("radio", {
        name: /^Personal/,
      }).checked,
    ).toBe(true);
    await userEvent.click(
      within(dialog).getByRole("radio", { name: /^General/ }),
    );
    await userEvent.click(
      within(dialog).getByRole("button", { name: "Change" }),
    );
    expect(bodyOf(fetch, "PUT", "/api/lists/l2/class")).toEqual([
      { dataClass: "general" },
    ]);
    await waitFor(() => {
      expect(within(panel()).queryByText("Personal")).toBe(null);
    });
  });

  it("changes the class of a list only drafted to be added in its draft, from its dialog or its panel", async () => {
    // Given
    const added = {
      ...empty,
      draft: {
        action: "created",
        changed: [],
        live: {},
        state: "waiting",
        madeBy: "Fictional Editor",
        madeAt: "2026-11-01T10:00:00.000Z",
      },
    };
    let visibility = "general";
    const fetch = serverAnswers({
      "GET /api/session": classifier,
      "GET /api/lists": () =>
        Response.json({ lists: [{ ...added, visibility }] }),
      "PUT /api/lists/l3": () => {
        visibility = "personal";
        return Response.json({
          list: { ...added, visibility },
          changeSetId: s1,
        });
      },
      "PUT /api/lists/l3/class": () => {
        visibility = "general";
        return Response.json({ changeSetId: s1 });
      },
      [`POST /api/undo/${s1}`]: savedAs(u1),
    });
    renderApp("/lists/l3");
    await screen.findByRole("heading", { name: "Empty List", level: 2 });
    await userEvent.click(screen.getByRole("button", { name: "Edit list…" }));
    const edit = await screen.findByRole("dialog", { name: "Edit list" });
    await userEvent.click(
      within(edit).getByRole("radio", { name: /^Personal/ }),
    );
    await userEvent.click(within(edit).getByRole("button", { name: "Save" }));
    await waitFor(() => {
      expect(bodyOf(fetch, "PUT", "/api/lists/l3")).toEqual([
        { name: "Empty List", description: "", visibility: "personal" },
      ]);
    });
    // When
    await userEvent.click(
      await screen.findByRole("button", { name: "Change class…" }),
    );
    const dialog = await screen.findByRole("dialog", {
      name: "Change the class of Empty List",
    });
    await userEvent.click(
      within(dialog).getByRole("radio", { name: /^General/ }),
    );
    await userEvent.click(
      within(dialog).getByRole("button", { name: "Change" }),
    );
    // Then
    await waitFor(() => {
      expect(bodyOf(fetch, "PUT", "/api/lists/l3/class")).toEqual([
        { dataClass: "general" },
      ]);
    });
    await undoWithKeys(fetch);
    await waitFor(() => {
      expect(undone(fetch)).toEqual([s1]);
    });
  });

  it("offers no change of class on a list only drafted to be added to a role that doesn't change lists", async () => {
    serverAnswers({
      "GET /api/session": () =>
        Response.json({
          ...fictionalUser,
          permissions: [
            "configuration:view",
            "people:view",
            "personal:view",
            "data:classify",
          ],
        }),
      "GET /api/lists": () =>
        Response.json({
          lists: [
            {
              ...empty,
              draft: {
                action: "created",
                changed: [],
                live: {},
                state: "waiting",
                madeBy: "Fictional Editor",
                madeAt: "2026-11-01T10:00:00.000Z",
              },
            },
          ],
        }),
    });
    renderApp("/lists/l3");
    await screen.findByRole("heading", { name: "Empty List", level: 2 });
    expect(screen.queryByRole("button", { name: "Change class…" })).toBe(null);
  });

  it("makes a General list for a role without Classify data, offering no class", async () => {
    const fetch = serverAnswers({
      "GET /api/session": editor,
      "GET /api/lists": () => Response.json({ lists: [] }),
      "POST /api/lists": () =>
        Response.json({ list: empty, changeSetId: s1 }, { status: 201 }),
    });
    renderApp("/lists");
    await userEvent.click(
      await screen.findByRole("button", { name: "New list" }),
    );
    const dialog = await screen.findByRole("dialog", { name: "New list" });
    expect(within(dialog).queryByRole("radio")).toBe(null);
    await userEvent.type(within(dialog).getByLabelText("Name"), "Empty List");
    await userEvent.click(
      within(dialog).getByRole("button", { name: "Create list" }),
    );
    expect(bodyOf(fetch, "POST", "/api/lists")).toEqual([
      { name: "Empty List", description: "", visibility: "general" },
    ]);
  });

  it("offers no change of class for a list drafted to be removed", async () => {
    serverAnswers({
      "GET /api/session": classifier,
      "GET /api/lists": () =>
        Response.json({
          lists: [
            {
              ...empty,
              draft: {
                action: "deleted",
                changed: [],
                live: {},
                state: "waiting",
                madeBy: "Fictional Editor",
                madeAt: "2026-11-01T10:00:00.000Z",
              },
            },
          ],
        }),
    });
    renderApp("/lists/l3");
    await screen.findByRole("heading", { name: "Empty List", level: 2 });
    expect(screen.queryByRole("button", { name: "Change class…" })).toBe(null);
  });

  it("turns off changing the class of a list someone else is changing", async () => {
    serverAnswers({
      "GET /api/session": classifier,
      "GET /api/lists": () =>
        Response.json({
          lists: [{ ...empty, heldBy: "Fictional Editor" }],
        }),
    });
    renderApp("/lists/l3");
    await screen.findByRole("heading", { name: "Empty List", level: 2 });
    const button = screen.getByRole<HTMLButtonElement>("button", {
      name: "Change class…",
    });
    expect(button.disabled).toBe(true);
    expect(
      document.getElementById(String(button.getAttribute("aria-describedby")))
        ?.textContent,
    ).toBe("Fictional Editor is changing this list");
  });

  it("keeps a list a column on Features draws on General, saying why", async () => {
    serverAnswers({
      "GET /api/session": classifier,
      "GET /api/lists": () =>
        Response.json({ lists: [{ ...empty, onFeatures: true }] }),
    });
    renderApp("/lists/l3");
    await screen.findByRole("heading", { name: "Empty List", level: 2 });
    await userEvent.click(
      screen.getByRole("button", { name: "Change class…" }),
    );
    const dialog = await screen.findByRole("dialog");
    expect(
      within(dialog).getByRole<HTMLInputElement>("radio", {
        name: /^Personal/,
      }).disabled,
    ).toBe(true);
    expect(
      within(dialog).getByText(
        "A column on Features or Activities uses this list, so it stays General",
      ),
    ).toBeTruthy();
  });

  it("shows each choice's meaning, and adds choices, pasted too, with the meaning chosen", async () => {
    const fetch = await openStates({
      "POST /api/lists/l5/choices": () =>
        Response.json(
          {
            choices: [choice("c13", "Budgeted", { meaning: "open" })],
            changeSetId: s1,
          },
          { status: 201 },
        ),
    });
    expect(
      within(row("c10")).getByText("Proposed", {
        selector: "[data-field='meaning']",
      }),
    ).toBeTruthy();
    expect(within(row("c12")).getByText("Open")).toBeTruthy();
    const meaning =
      screen.getByLabelText<HTMLSelectElement>("New choice meaning");
    expect(meaning.value).toBe("proposed");
    await userEvent.selectOptions(meaning, "open");
    await userEvent.type(entryName(), "Budgeted{Enter}");
    await waitFor(() => {
      expect(bodyOf(fetch, "POST", "/api/lists/l5/choices")).toEqual([
        { choices: [{ label: "Budgeted", description: "", meaning: "open" }] },
      ]);
    });
    // The meaning chosen stays for the next choice, and pasted lines take it.
    expect(meaning.value).toBe("open");
    act(() => {
      entryName().focus();
    });
    await userEvent.paste("Sourcing\nScreening");
    await waitFor(() => {
      expect(bodyOf(fetch, "POST", "/api/lists/l5/choices")).toHaveLength(2);
    });
    expect(bodyOf(fetch, "POST", "/api/lists/l5/choices")[1]).toEqual({
      choices: [
        { label: "Sourcing", description: "", meaning: "open" },
        { label: "Screening", description: "", meaning: "open" },
      ],
    });
  });

  it("gives a choice another meaning when edited", async () => {
    const fetch = await openStates({
      "PUT /api/lists/l5/choices/c12": () =>
        Response.json({
          choice: choice("c12", "Approved", { meaning: "proposed" }),
          changeSetId: s1,
        }),
    });
    focusRow("c12");
    await userEvent.keyboard("{Enter}");
    await userEvent.selectOptions(screen.getByLabelText("meaning"), "proposed");
    await userEvent.keyboard("{Enter}");
    await waitFor(() => {
      expect(bodyOf(fetch, "PUT", "/api/lists/l5/choices/c12")).toEqual([
        { label: "Approved", description: "", meaning: "proposed" },
      ]);
    });
  });

  it("shows nothing for a meaning the server no longer knows, and a changed meaning's live one under it", async () => {
    const changed = {
      id: "l5",
      keyNumber: 1,
      name: "Hiring states",
      description: "",
      visibility: "confidential",
      retired: false,
      builtIn: "hiring-states",
      choices: [
        choice("c10", "Proposed", { meaning: "proposed" }),
        choice("c11", "Open", {
          meaning: "proposed",
          draft: {
            action: "changed",
            changed: ["meaning"],
            live: { meaning: "open" },
            state: "waiting",
            madeBy: "Fictional Editor",
            madeAt: "2026-11-01T10:00:00.000Z",
          },
        }),
        choice("c14", "Unknown"),
      ],
    };
    serverAnswers({
      "GET /api/session": editor,
      "GET /api/lists": () => Response.json({ lists: [changed] }),
    });
    renderApp("/lists/l5");
    await screen.findByRole("heading", { name: "Hiring states", level: 2 });
    const meaningOf = (element: Element | null) =>
      element?.querySelector("[data-field='meaning']")?.textContent ??
      element?.lastElementChild?.textContent;
    expect(meaningOf(row("c14"))).toBe("");
    expect(meaningOf(row("c11"))).toBe("Proposed");
    expect(row("c11").nextElementSibling?.textContent).toContain("Open");
    focusRow("c14");
    await userEvent.keyboard("{Enter}");
    const meaning = screen.getByLabelText<HTMLSelectElement>("meaning");
    expect(meaning.value).toBe("");
    expect(meaning.selectedOptions[0]?.textContent).toBe("Choose a meaning");
  });

  it("says a draft empties a list's description, with the live description under it beside live", async () => {
    serverAnswers({
      "GET /api/session": viewer,
      "GET /api/lists": () =>
        Response.json({
          lists: [
            {
              ...locations,
              description: "",
              draft: {
                action: "changed",
                changed: ["description"],
                live: { description: "Offices and labs." },
                state: "waiting",
                madeBy: "Fictional Editor",
                madeAt: "2026-11-01T10:00:00.000Z",
              },
            },
          ],
        }),
    });
    renderApp("/lists/l1");
    const panel = (
      await screen.findByRole("heading", { name: "Locations", level: 2 })
    ).closest("[data-list-panel]") as HTMLElement;
    const drafted = within(panel).getByText("No description");
    expect(drafted.parentElement?.textContent).toContain(
      "Draft: changed from “Offices and labs.”",
    );
    const live = within(panel).getByText("Offices and labs.");
    expect(live.parentElement?.textContent).toContain("live");
  });

  it("edits the name of the only choice for a meaning when its meaning is clicked, and saves it with Tab from the description", async () => {
    const fetch = await openStates({
      "PUT /api/lists/l5/choices/c10": () =>
        Response.json({
          choice: choice("c10", "Requested", { meaning: "proposed" }),
          changeSetId: s1,
        }),
    });
    await userEvent.click(
      within(row("c10")).getByText("Proposed", {
        selector: "[data-field='meaning']",
      }),
    );
    const name = await screen.findByLabelText<HTMLInputElement>("name");
    await waitFor(() => {
      expect(document.activeElement).toBe(name);
    });
    await userEvent.clear(name);
    await userEvent.type(name, "Requested");
    await userEvent.tab();
    expect(document.activeElement).toBe(screen.getByLabelText("description"));
    await userEvent.tab();
    await waitFor(() => {
      expect(bodyOf(fetch, "PUT", "/api/lists/l5/choices/c10")).toEqual([
        { label: "Requested", description: "", meaning: "proposed" },
      ]);
    });
  });

  it("keeps the last choice offered for a meaning offered, with that meaning", async () => {
    const fetch = await openStates();
    focusRow("c10");
    await userEvent.keyboard("r");
    await userEvent.keyboard("{Delete}");
    await userEvent.keyboard("{ContextMenu}");
    const menu = await screen.findByRole("menu");
    expect(
      turnedOffItem(menu, startsWith("Retire"), "Needed for Proposed"),
    ).toBeDefined();
    expect(
      turnedOffItem(menu, startsWith("Remove"), "Needed for Proposed"),
    ).toBeDefined();
    await userEvent.keyboard("{Escape}");
    await waitFor(() => {
      expect(screen.queryByRole("menu")).toBeNull();
    });
    focusRow("c10");
    await userEvent.keyboard("{Enter}");
    expect(screen.getByLabelText<HTMLSelectElement>("meaning").disabled).toBe(
      true,
    );
    expect(screen.getByText("Needed for Proposed")).toBeTruthy();
    // The meaning cannot change, so Tab leaves the row from the description.
    await waitFor(() => {
      expect(document.activeElement?.getAttribute("aria-label")).toBe("name");
    });
    await userEvent.keyboard("{Tab}");
    expect(document.activeElement?.getAttribute("aria-label")).toBe(
      "description",
    );
    await userEvent.keyboard("{Tab}");
    await waitFor(() => {
      expect(screen.queryByLabelText("meaning")).toBeNull();
    });
    // Open has another choice, so either can be retired.
    focusRow("c11");
    await userEvent.keyboard("{ContextMenu}");
    const other = await screen.findByRole("menu");
    expect(
      within(other)
        .getByRole("menuitem", { name: startsWith("Retire") })
        .hasAttribute("data-disabled"),
    ).toBe(false);
    await userEvent.keyboard("{Escape}");
    await waitFor(() => {
      expect(screen.queryByRole("menu")).toBeNull();
    });
    focusRow("c11");
    await userEvent.keyboard("{Enter}");
    await waitFor(() => {
      expect(document.activeElement?.getAttribute("aria-label")).toBe("name");
    });
    await userEvent.keyboard("{Tab}{Tab}");
    expect(document.activeElement?.getAttribute("aria-label")).toBe("meaning");
    await userEvent.keyboard("{Escape}");
    expect(
      fetch.mock.calls.filter(
        ([, init]) => init?.method !== "GET" && init?.method !== undefined,
      ),
    ).toEqual([]);
  });
});

describe("the weights of feature sizes", () => {
  const changedTo = (live: object) => ({
    action: "changed",
    changed: ["weight"],
    live,
    state: "waiting",
    madeBy: "Fictional Editor",
    madeAt: "2026-11-01T10:00:00.000Z",
  });
  const sizes = {
    id: "l6",
    keyNumber: 1,
    name: "Feature sizes",
    description: "",
    visibility: "general",
    retired: false,
    builtIn: "feature-sizes",
    choices: [
      choice("c20", "S", { weight: 1 }),
      choice("c21", "M", { weight: 2.5, draft: changedTo({ weight: 2 }) }),
      choice("c22", "Unknown"),
    ],
  };

  async function openSizes(answers: Answers = {}, path = "/lists/l6") {
    const fetch = serverAnswers({
      "GET /api/session": editor,
      "GET /api/lists": () => Response.json({ lists: [sizes] }),
      ...answers,
    });
    renderApp(path);
    await screen.findByRole("heading", { name: "Feature sizes", level: 2 });
    await waitFor(() => {
      expect(panel().contains(document.activeElement)).toBe(true);
    });
    return fetch;
  }

  const weightOf = (element: Element | null) =>
    element?.querySelector("[data-field='weight']")?.textContent ??
    element?.lastElementChild?.textContent;

  const entryWeight = () =>
    screen.getByLabelText<HTMLInputElement>("New choice weight");

  it("shows each size's weight, and a changed weight's live one under it", async () => {
    await openSizes();
    expect(weightOf(row("c20"))).toBe("1");
    expect(weightOf(row("c21"))).toBe("2.5");
    expect(weightOf(row("c21").nextElementSibling)).toBe("2");
    expect(weightOf(row("c22"))).toBe("");
  });

  it("shows the live weights with Live only chosen", async () => {
    await openSizes({}, "/lists/l6?show=live");
    expect(weightOf(row("c21"))).toBe("2");
  });

  it("adds a size with the weight typed, and pasted sizes take it", async () => {
    const fetch = await openSizes({
      "POST /api/lists/l6/choices": () =>
        Response.json({ choices: [], changeSetId: s1 }, { status: 201 }),
    });
    await userEvent.type(entryWeight(), "6");
    await userEvent.type(entryName(), "XXL{Enter}");
    await waitFor(() => {
      expect(bodyOf(fetch, "POST", "/api/lists/l6/choices")).toEqual([
        { choices: [{ label: "XXL", description: "", weight: 6 }] },
      ]);
    });
    expect(entryWeight().value).toBe("");
    await userEvent.type(entryWeight(), "8");
    act(() => {
      entryName().focus();
    });
    await userEvent.paste("XXXL\nHuge");
    await waitFor(() => {
      expect(bodyOf(fetch, "POST", "/api/lists/l6/choices")[1]).toEqual({
        choices: [
          { label: "XXXL", description: "", weight: 8 },
          { label: "Huge", description: "", weight: 8 },
        ],
      });
    });
  });

  it("says what is wrong with a weight, and adds nothing until it will do", async () => {
    const fetch = await openSizes();
    await userEvent.type(entryName(), "XXL{Enter}");
    expect(screen.getByRole("alert").textContent).toBe("Weight needed");
    expect(document.activeElement).toBe(entryWeight());
    expect(entryWeight().getAttribute("aria-invalid")).toBe("true");
    for (const [typed, problem] of [
      ["abc", "Weight: use a number such as 1234.5"],
      ["0", "Weight: use 0.01 to 9999.99"],
      ["10000", "Weight: use 0.01 to 9999.99"],
      ["1.234", "Weight: use at most 2 digits after the point"],
    ] as const) {
      await userEvent.clear(entryWeight());
      await userEvent.type(entryWeight(), `${typed}{Enter}`);
      expect(screen.getByRole("alert").textContent).toBe(problem);
    }
    await userEvent.clear(entryName());
    await userEvent.clear(entryWeight());
    act(() => {
      entryName().focus();
    });
    await userEvent.paste("XXXL\nHuge");
    expect(screen.getByRole("alert").textContent).toBe("Weight needed");
    expect(entryName().value).toBe("");
    await userEvent.type(entryWeight(), "3{Escape}");
    expect(entryWeight().value).toBe("");
    expect(screen.queryByRole("alert")).toBe(null);
    // Leaving the empty row with a size's name but no weight adds nothing, leaving focus where it went.
    await userEvent.type(entryName(), "Big");
    focusRow("c20");
    expect(screen.getByRole("alert").textContent).toBe("Weight needed");
    expect(document.activeElement).toBe(row("c20"));
    expect(
      fetch.mock.calls.filter(([, init]) => init?.method === "POST"),
    ).toEqual([]);
  });

  it("changes a size's weight when edited from it, and refuses one that will not do", async () => {
    const fetch = await openSizes({
      "PUT /api/lists/l6/choices/c20": () =>
        Response.json({
          choice: choice("c20", "S", { weight: 1.5 }),
          changeSetId: s1,
        }),
    });
    await userEvent.click(within(row("c20")).getByText("1"));
    const weight = screen.getByLabelText<HTMLInputElement>("weight");
    expect(document.activeElement).toBe(weight);
    await userEvent.clear(weight);
    await userEvent.keyboard("{Enter}");
    expect(screen.getByRole("alert").textContent).toBe("Weight needed");
    expect(weight.getAttribute("aria-invalid")).toBe("true");
    await userEvent.type(weight, "1.5{Tab}");
    await waitFor(() => {
      expect(bodyOf(fetch, "PUT", "/api/lists/l6/choices/c20")).toEqual([
        { label: "S", description: "", weight: 1.5 },
      ]);
    });
  });
});
