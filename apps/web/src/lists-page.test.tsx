// SPDX-License-Identifier: Apache-2.0

// Tests for the Lists page, with the server's responses simulated: who sees it, the table of
// lists, what the page shows, and searching lists.

import { act, screen, waitFor, within } from "@testing-library/react";
import { userEvent } from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  fictionalUser,
  greeting,
  renderApp,
  serverAnswers,
  signedIn,
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
  refused,
  panel,
  focusRow,
  startsWith,
  added,
  noPeople,
  openDraftMenu,
} from "./test-lists-page.tsx";

afterEach(() => {
  vi.unstubAllGlobals();
});

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

  it("does not read people for an editor who may see them but not approve", async () => {
    const fetch = serverAnswers({
      "GET /api/session": () =>
        Response.json({
          ...fictionalUser,
          permissions: [
            "configuration:edit",
            "configuration:view",
            "people:view",
            "plan:view",
            "features:view",
          ],
        }),
      "GET /api/greeting": greeting,
      "GET /api/lists": listsAnswer,
    });
    renderApp("/lists");
    expect(await screen.findByRole("table", { name: "Lists" })).toBeDefined();
    expect(fetch.mock.calls.some(([url]) => url.endsWith("/api/people"))).toBe(
      false,
    );
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
  it("keeps the last position offered", async () => {
    serverAnswers({
      "GET /api/session": editor,
      "GET /api/lists": () =>
        Response.json({
          lists: [
            {
              ...skills,
              builtIn: "positions",
              name: "Positions",
              visibility: "general",
            },
          ],
        }),
    });
    renderApp("/lists/l2");
    await screen.findByRole("heading", { name: "Positions", level: 2 });
    focusRow("c5");
    await userEvent.keyboard("{ContextMenu}");
    const menu = await screen.findByRole("menu");
    expect(
      within(menu)
        .getByRole("menuitem", { name: startsWith("Retire") })
        .hasAttribute("data-disabled"),
    ).toBe(true);
    expect(
      within(menu)
        .getByRole("menuitem", { name: startsWith("Remove") })
        .hasAttribute("data-disabled"),
    ).toBe(true);
    expect(within(menu).getByText("Positions needs a choice")).toBeTruthy();
    await userEvent.keyboard("{Escape}");
    await waitFor(() => {
      expect(screen.queryByRole("menu")).toBeNull();
    });
    focusRow("c5");
    await userEvent.keyboard("{Enter}");
    await waitFor(() => {
      expect(document.activeElement?.getAttribute("aria-label")).toBe("name");
    });
    expect(screen.queryByText("Positions needs a choice")).toBeNull();
  });

  const builtInPositions = {
    ...locations,
    builtIn: "positions",
    name: "Positions",
  };
  const invitation = "These can be renamed, added to, or retired.";

  it("shows all lists, those built in, or the custom ones, as chosen, kept in the address", async () => {
    serverAnswers({
      "GET /api/session": editor,
      "GET /api/lists": () =>
        Response.json({
          lists: [
            { ...locations, builtIn: "positions", name: "Positions" },
            skills,
          ],
        }),
    });
    const history = renderApp("/lists");
    const table = await screen.findByRole("table", { name: "Lists" });
    const names = () =>
      within(table)
        .getAllByRole("link")
        .map((link) => link.textContent);
    const which = screen.getByRole("radiogroup", { name: "Which lists" });
    expect(names()).toEqual(["Positions", "Skills"]);
    await userEvent.click(
      within(which).getByRole("radio", { name: "Built in" }),
    );
    await waitFor(() => {
      expect(names()).toEqual(["Positions"]);
    });
    expect(screen.getByRole("status").textContent).toBe("1 of 2");
    expect(history.location.search).toContain("kind=built-in");
    await userEvent.click(within(which).getByRole("radio", { name: "Custom" }));
    await waitFor(() => {
      expect(names()).toEqual(["Skills"]);
    });
    await userEvent.click(screen.getByRole("link", { name: "Skills" }));
    await waitFor(() => {
      expect(history.location.search).toContain("kind=custom");
    });
    await userEvent.click(within(which).getByRole("radio", { name: "All" }));
    await waitFor(() => {
      expect(names()).toEqual(["Positions", "Skills"]);
    });
    expect(history.location.search).not.toContain("kind=");
  });

  it("leaves the search without moving focus when no list is shown", async () => {
    serverAnswers({
      "GET /api/session": editor,
      "GET /api/lists": () => Response.json({ lists: [skills] }),
    });
    renderApp("/lists?kind=built-in");
    const search = await screen.findByRole("textbox", { name: "Search lists" });
    expect(screen.getByText("No matching lists")).toBeTruthy();
    search.focus();
    await userEvent.keyboard("{Escape}");
    expect(document.activeElement).toBe(search);
  });

  it("tells those who may change lists that a built-in list is theirs to change", async () => {
    serverAnswers({
      "GET /api/session": editor,
      "GET /api/lists": () => Response.json({ lists: [builtInPositions] }),
    });
    renderApp("/lists/l1");
    await screen.findByRole("heading", { name: "Positions", level: 2 });
    expect(screen.getByText(new RegExp(invitation))).toBeTruthy();
  });

  it("does not tell those who may only view lists that a built-in list is theirs to change", async () => {
    serverAnswers({
      "GET /api/session": viewer,
      "GET /api/lists": () => Response.json({ lists: [builtInPositions] }),
    });
    renderApp("/lists/l1");
    await screen.findByRole("heading", { name: "Positions", level: 2 });
    expect(screen.getByText(/Keep at least one\./)).toBeTruthy();
    expect(screen.queryByText(new RegExp(invitation))).toBeNull();
  });

  it("keeps the lists chosen in the address when searching or changing what to show", async () => {
    serverAnswers({
      "GET /api/session": editor,
      "GET /api/lists": () =>
        Response.json({ lists: [builtInPositions, skills] }),
    });
    const history = renderApp("/lists?kind=custom");
    await screen.findByRole("table", { name: "Lists" });
    await userEvent.type(
      screen.getByRole("textbox", { name: "Search lists" }),
      "s",
    );
    await waitFor(() => {
      expect(history.location.search).toContain("search=s");
    });
    expect(history.location.search).toContain("kind=custom");
  });

  it.each(["all", "nonsense"])(
    "shows every list for an address asking for %s lists",
    async (kind) => {
      serverAnswers({
        "GET /api/session": editor,
        "GET /api/lists": () =>
          Response.json({ lists: [builtInPositions, skills] }),
      });
      renderApp(`/lists?kind=${kind}`);
      const which = await screen.findByRole("radiogroup", {
        name: "Which lists",
      });
      expect(within(which).getByRole("radio", { name: "All" })).toHaveProperty(
        "checked",
        true,
      );
      expect(screen.getByRole("status").textContent).toBe("2 lists");
    },
  );

  it("puts focus on the switch when closing a list it hides", async () => {
    serverAnswers({
      "GET /api/session": editor,
      "GET /api/lists": () =>
        Response.json({ lists: [builtInPositions, skills] }),
    });
    renderApp("/lists/l1?kind=custom");
    await screen.findByRole("heading", { name: "Positions", level: 2 });
    await userEvent.keyboard("{Escape}");
    await waitFor(() => {
      expect(document.activeElement).toBe(
        screen.getByRole("radio", { name: "Custom" }),
      );
    });
  });

  it("says under Positions' choices what the list is for", async () => {
    serverAnswers({
      "GET /api/session": editor,
      "GET /api/lists": () =>
        Response.json({
          lists: [{ ...locations, builtIn: "positions", name: "Positions" }],
        }),
    });
    renderApp("/lists/l1");
    await screen.findByRole("heading", { name: "Positions", level: 2 });
    expect(
      screen.getByText(
        /Every person and planned hire has one of these positions\.\s+Keep at least one\./,
      ),
    ).toBeTruthy();
  });

  it("says under proposal statuses' choices what the list is for", async () => {
    serverAnswers({
      "GET /api/session": editor,
      "GET /api/lists": () =>
        Response.json({
          lists: [
            {
              ...locations,
              builtIn: "proposal-statuses",
              name: "Proposal statuses",
            },
          ],
        }),
    });
    renderApp("/lists/l1");
    await screen.findByRole("heading", {
      name: "Proposal statuses",
      level: 2,
    });
    expect(
      screen.getByText(
        /Every proposal has one of these statuses\.\s+Keep at least one\./,
      ),
    ).toBeTruthy();
  });

  it("says what each feature status means", async () => {
    serverAnswers({
      "GET /api/session": viewer,
      "GET /api/lists": () =>
        Response.json({
          lists: [
            {
              ...locations,
              builtIn: "feature-statuses",
              name: "Feature statuses",
            },
          ],
        }),
    });
    renderApp("/lists/l1");
    await screen.findByRole("heading", {
      name: "Feature statuses",
      level: 2,
    });
    expect(
      screen.getByText(
        /Possible: the feature may come, and needs no feature team yet\.[\s\S]+Keep at least one choice for each\./,
      ),
    ).toBeTruthy();
  });

  it.each([
    [
      "feature-priorities",
      "Feature priorities",
      /How much a feature matters to the organization, apart from its status, highest first\.\s+Keep at least one\./,
    ],
    [
      "feature-sizes",
      "Feature sizes",
      /A feature's rough size, before it is estimated, smallest first\.\s+Keep at least one\./,
    ],
    [
      "feature-risks",
      "Feature risks",
      /How much could go wrong in building a feature, lowest first\.\s+Keep at least one\./,
    ],
  ])("says what the %s list is for", async (builtIn, name, note) => {
    serverAnswers({
      "GET /api/session": viewer,
      "GET /api/lists": () =>
        Response.json({ lists: [{ ...locations, builtIn, name }] }),
    });
    renderApp("/lists/l1");
    await screen.findByRole("heading", { name, level: 2 });
    expect(screen.getByText(note)).toBeTruthy();
  });

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
      "Skills, Personal(1) Rust",
      "Empty List",
    ]);
  });

  it("marks a list's choices waiting while any of them, or their order, waits, and rejected only once every one was", async () => {
    const drafted = (state: string, more: object) => ({
      ...removal,
      state,
      ...(state === "rejected" ? { reason: "Not yet" } : {}),
      ...more,
    });
    const described = {
      action: "changed",
      changed: ["description"],
      live: { description: "" },
    };
    serverAnswers({
      "GET /api/session": viewer,
      "GET /api/lists": () =>
        Response.json({
          lists: [
            {
              ...locations,
              choices: [
                choice("c9", "Fenwick", {
                  draft: drafted("rejected", {
                    action: "created",
                    changed: ["label"],
                  }),
                }),
                ...locations.choices,
              ],
              orderDraft: drafted("waiting", {
                live: ["c1", "c2", "c3", "c4"],
                uses: ["c9"],
              }),
            },
            {
              ...skills,
              description: "What people know.",
              choices: [
                choice("c5", "Rust", {
                  draft: drafted("rejected", {
                    action: "changed",
                    changed: ["label"],
                    live: { label: "Go" },
                  }),
                }),
              ],
              draft: drafted("rejected", described),
            },
            {
              ...empty,
              description: "Kept empty.",
              choices: [
                choice("c8", "Spare", { draft: drafted("waiting", {}) }),
              ],
              draft: drafted("rejected", described),
            },
          ],
        }),
    });
    const rows = async () =>
      within(await screen.findByRole("table", { name: "Lists" }))
        .getAllByRole("row")
        .slice(1)
        .map((tableRow) =>
          [...tableRow.children].map((cell) => cell.textContent),
        );
    const history = renderApp("/lists");
    expect(await rows()).toEqual([
      [
        "Locations",
        "Offices and labs.",
        "(4) Fenwick, Kestrel Bay, Northmere, Corran QuayReordered, Draft: reordered",
      ],
      [
        "Skills, Personal",
        "What people know., Rejected, changed from no description: Not yet",
        "(1) Rust, Rejected",
      ],
      [
        "Empty List",
        "Kept empty., Rejected, changed from no description: Not yet",
        "(0) Spare, Draft",
      ],
    ]);
    act(() => {
      history.push("/lists?show=drafts");
    });
    await waitFor(async () => {
      expect((await rows())[1]?.[1]).toBe("No description");
    });
    expect(await rows()).toEqual([
      [
        "Locations",
        "Offices and labs.",
        "(3) Kestrel Bay, Northmere, Corran QuayReordered, Draft: reordered",
      ],
      ["Skills, Personal", "No description", "(1) Go"],
      ["Empty List", "No description", ", Draft"],
    ]);
  });

  it("strikes through and leaves uncounted a choice drafted to be removed", async () => {
    serverAnswers({
      "GET /api/session": viewer,
      "GET /api/lists": () =>
        Response.json({
          lists: [
            {
              ...locations,
              choices: locations.choices.map((one) =>
                one.id === "c2" ? { ...one, draft: removal } : one,
              ),
            },
          ],
        }),
    });
    renderApp("/lists");
    const table = await screen.findByRole("table", { name: "Lists" });
    const [drafted] = within(table).getAllByRole("row").slice(1);
    const choices = within(drafted as HTMLElement).getAllByRole("cell")[2];
    expect(choices?.textContent).toBe(
      "(2) Kestrel Bay, Northmere, Corran Quay, Draft",
    );
    expect(
      within(choices as HTMLElement).getByText("Northmere").className,
    ).toMatch(/struck/);
  });

  it("keeps a list or choice a draft retires or restores where it is live, marked, until applied", async () => {
    const retiring = (retired: boolean) => ({
      ...removal,
      action: "changed",
      changed: ["retired"],
      live: { retired: !retired },
    });
    serverAnswers({
      "GET /api/session": editor,
      "GET /api/lists": () =>
        Response.json({
          lists: [
            {
              ...locations,
              retired: true,
              draft: retiring(true),
              choices: locations.choices.map((one) =>
                one.id === "c2"
                  ? { ...one, retired: true, draft: retiring(true) }
                  : one,
              ),
            },
            { ...regions, retired: false, draft: retiring(false) },
          ],
        }),
    });
    const names = async () =>
      within(await screen.findByRole("table", { name: "Lists" }))
        .getAllByRole("row")
        .slice(1)
        .map((tableRow) => tableRow.firstElementChild?.textContent);
    const history = renderApp("/lists");
    expect(await names()).toEqual(["LocationsRetired, Draft: retired"]);
    await userEvent.click(
      screen.getByRole("button", { name: "Show retired (1)" }),
    );
    expect(await names()).toEqual([
      "LocationsRetired, Draft: retired",
      "Retired",
      "Regions, ConfidentialRestored, Draft: restored",
    ]);
    await userEvent.click(screen.getByRole("link", { name: "Locations" }));
    const opened = await screen.findByRole("region", { name: /./ });
    expect(within(opened).getAllByText(/Draft: retired/)).toHaveLength(2);
    expect(
      within(document.getElementById("choice-c2") as HTMLElement).getAllByText(
        /Draft: retired/,
      ).length,
    ).toBeGreaterThan(0);
    act(() => {
      history.push("/lists?show=drafts");
    });
    await waitFor(async () => {
      expect(await names()).toEqual([
        "Regions, ConfidentialRestored, Draft: restored",
        "Retired",
        "LocationsRetired, Draft: retired",
      ]);
    });
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

describe("what the Lists page shows", () => {
  it("keeps the choice of what to show while lists are opened and closed", async () => {
    serverAnswers({
      "GET /api/session": editor,
      "GET /api/lists": listsAnswer,
    });
    const history = renderApp("/lists?show=drafts");
    await userEvent.click(await screen.findByRole("link", { name: "Skills" }));
    await screen.findByRole("heading", { name: "Skills", level: 2 });
    expect(history.location.search).toContain("show=drafts");
    await userEvent.click(
      within(panel()).getByRole("button", { name: "Close" }),
    );
    await waitFor(() => {
      expect(history.location.pathname).toBe("/lists");
    });
    expect(history.location.search).toContain("show=drafts");
  });
});

describe("searching lists", () => {
  it("finds lists by every word in their names, descriptions, or choices, kept in the address", async () => {
    serverAnswers({
      "GET /api/session": editor,
      "GET /api/lists": listsAnswer,
    });
    const history = renderApp("/lists");
    const table = await screen.findByRole("table", { name: "Lists" });
    await userEvent.type(
      screen.getByRole("textbox", { name: "Search lists" }),
      "head kestrel",
    );
    await waitFor(() => {
      expect(
        within(table)
          .getAllByRole("link")
          .map((link) => link.textContent),
      ).toEqual(["Locations"]);
    });
    expect(screen.getByRole("status").textContent).toBe("1 of 4");
    expect(history.location.search).toContain("search=");
    await userEvent.clear(
      screen.getByRole("textbox", { name: "Search lists" }),
    );
    await userEvent.type(
      screen.getByRole("textbox", { name: "Search lists" }),
      "nothing here",
    );
    expect(await within(table).findByText("No matching lists")).toBeDefined();
    // Esc clears the search, then goes back to the table, at its first list.
    await userEvent.keyboard("{Escape}{Escape}");
    await waitFor(() => {
      expect(document.activeElement?.textContent).toBe(
        within(table).getAllByRole("link")[0]?.textContent,
      );
    });
  });

  it.each([
    ["#LIST-2", ["Skills"]],
    ["list-2", ["Skills"]],
    ["#LIST-20", []],
    ["#FEATURE-2", []],
  ])("finds by the key %s only the list with it", async (typed, shown) => {
    serverAnswers({
      "GET /api/session": editor,
      "GET /api/lists": () =>
        Response.json({
          lists: [locations, { ...skills, keyNumber: 2 }, empty, regions],
        }),
    });
    renderApp("/lists");
    const table = await screen.findByRole("table", { name: "Lists" });
    await userEvent.type(
      screen.getByRole("textbox", { name: "Search lists" }),
      typed,
    );
    await waitFor(() => {
      expect(
        within(table)
          .queryAllByRole("link")
          .map((link) => link.textContent),
      ).toEqual(shown);
    });
  });
});

describe("a list of a class the role can't see", () => {
  // Changes lists and sees people, but neither Personal nor Confidential data.
  const peopleOnly =
    (extra: readonly string[] = []) =>
    () =>
      Response.json({
        ...fictionalUser,
        permissions: [
          "configuration:edit",
          "configuration:view",
          "people:view",
          ...extra,
        ],
      });
  const unseenLine =
    "This role can't see Personal data, so it can't change this list.";

  it("is read only, saying why", async () => {
    serverAnswers({
      "GET /api/session": peopleOnly(),
      "GET /api/lists": () => Response.json({ lists: [skills] }),
    });
    renderApp("/lists/l2");
    expect(await screen.findByText(unseenLine)).toBeDefined();
    expect(screen.queryByRole("button", { name: "Edit list" })).toBeNull();
    expect(screen.queryByLabelText("New choice name")).toBeNull();
  });

  it("says why under Live only too", async () => {
    serverAnswers({
      "GET /api/session": peopleOnly(),
      "GET /api/lists": () => Response.json({ lists: [skills] }),
    });
    renderApp("/lists/l2?show=live");
    expect(await screen.findByText(unseenLine)).toBeDefined();
  });

  it("says nothing to a role that only sees lists", async () => {
    serverAnswers({
      "GET /api/session": viewer,
      "GET /api/lists": () => Response.json({ lists: [skills] }),
    });
    renderApp("/lists/l2");
    await screen.findByRole("heading", { name: "Skills", level: 2 });
    expect(screen.queryByText(unseenLine)).toBeNull();
  });

  it("is left out of deciding every draft waiting", async () => {
    serverAnswers({
      "GET /api/session": peopleOnly(["configuration:approve"]),
      "GET /api/people": noPeople,
      "GET /api/lists": () =>
        Response.json({ lists: [added, { ...skills, draft: { ...removal } }] }),
    });
    renderApp("/lists");
    const menu = await openDraftMenu();
    expect(
      within(menu).getByRole("menuitem", { name: "Approve 2 drafts…" }),
    ).toBeDefined();
    expect(within(menu).queryByText(/ of /u)).toBeNull();
  });
});
