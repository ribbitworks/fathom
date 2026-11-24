// SPDX-License-Identifier: Apache-2.0

// Tests for the rows of the Lists page's table, with the server's responses simulated: renaming a
// list in its row, what each row's menu offers to each role, grouping by kind, and the columns
// that use each list.

import { act, screen, waitFor, within } from "@testing-library/react";
import { userEvent } from "@testing-library/user-event";
import { listLengths } from "@fathom/shared";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  bodyOf,
  choicesUnder,
  recordCell,
  renderApp,
  serverAnswers,
} from "./test-support.tsx";
import {
  added,
  approver,
  cellText,
  choice,
  editor,
  listsAnswer,
  listsGrid,
  openList,
  locations,
  noPeople,
  regions,
  removal,
  rowMenu,
  savedAs,
  sent,
  shownLists,
  skills,
  startsWith,
  viewer,
  waiting,
  type Answers,
} from "./test-lists-page.tsx";
import { currentRows } from "./test-open-row.tsx";

afterEach(() => {
  vi.unstubAllGlobals();
});

async function openLists(answers: Answers = {}, path = "/lists") {
  const fetch = serverAnswers({
    "GET /api/session": editor,
    "GET /api/lists": listsAnswer,
    ...answers,
  });
  const history = renderApp(path);
  await listsGrid();
  return { fetch, history };
}

async function editName(id: string) {
  act(() => {
    recordCell(id, "name")?.focus();
  });
  await userEvent.keyboard("{Enter}");
  await waitFor(() => {
    expect(document.activeElement?.tagName).toBe("INPUT");
  });
  return document.activeElement as HTMLInputElement;
}

const itemNames = (menu: HTMLElement) =>
  within(menu)
    .getAllByRole("menuitem")
    .map((item) => item.textContent);

describe("renaming a list in its row", () => {
  it("saves the new name as a draft, with the list's description and class", async () => {
    // Given an editor on the table of lists
    let shown: object = skills;
    const { fetch } = await openLists({
      "GET /api/lists": () => Response.json({ lists: [locations, shown] }),
      "PUT /api/lists/l2": () => {
        shown = {
          ...skills,
          name: "Talents",
          draft: {
            ...removal,
            action: "changed",
            changed: ["name"],
            live: { name: "Skills" },
          },
        };
        return savedAs()();
      },
    });

    // When Skills is renamed in its row
    const input = await editName("l2");
    await userEvent.clear(input);
    await userEvent.type(input, "Talents{Enter}");

    // Then the draft is saved with the list's other details as they were, and shows beside live
    await waitFor(() => {
      expect(bodyOf(fetch, "PUT", "/api/lists/l2")).toEqual([
        { name: "Talents", description: "", visibility: "personal" },
      ]);
    });
    await waitFor(() => {
      expect(cellText("l2", "name")).toMatch(/^Talents.*, draft, live Skills$/);
    });
  });

  it("refuses a name another list has, saving nothing", async () => {
    // Given an editor on the table of lists
    const { fetch } = await openLists({ "PUT /api/lists/l2": savedAs() });

    // When Skills is given Locations' name, in other letters
    const input = await editName("l2");
    await userEvent.clear(input);
    await userEvent.type(input, "locations{Enter}");

    // Then the row says why, and nothing is sent
    expect(await screen.findByText("Another list has that name")).toBeDefined();
    expect(sent(fetch, "PUT", "/api/lists/l2")).toBe(false);
  });

  it("refuses an empty name, keeping focus in the name and saving nothing", async () => {
    // Given an editor on the table of lists
    const { fetch } = await openLists({ "PUT /api/lists/l2": savedAs() });

    // When Skills' name is emptied
    const input = await editName("l2");
    await userEvent.clear(input);
    await userEvent.keyboard("{Enter}");

    // Then the row says why, the name stays open, and nothing is sent
    expect(await screen.findByText("Name needed")).toBeDefined();
    expect(document.activeElement).toBe(input);
    expect(sent(fetch, "PUT", "/api/lists/l2")).toBe(false);
  });

  it("refuses a name longer than a list's name holds, saving nothing", async () => {
    // Given an editor on the table of lists
    const { fetch } = await openLists({ "PUT /api/lists/l2": savedAs() });

    // When a name longer than a list's name holds is typed
    const input = await editName("l2");
    await userEvent.clear(input);
    await userEvent.type(input, `${"x".repeat(listLengths.name + 1)}{Enter}`);

    // Then the row says why, the name stays open, and nothing is sent
    expect(await screen.findByText("Name too long")).toBeDefined();
    expect(document.activeElement).toBe(input);
    expect(sent(fetch, "PUT", "/api/lists/l2")).toBe(false);
  });

  it("refuses the name of a list the switch hides", async () => {
    // Given an editor on the custom lists, beside a built-in list the switch hides
    const { fetch } = await openLists(
      {
        "GET /api/lists": () =>
          Response.json({
            lists: [{ ...locations, builtIn: "positions" }, skills],
          }),
        "PUT /api/lists/l2": savedAs(),
      },
      "/lists?kind=custom",
    );
    expect(shownLists()).toEqual(["Skills"]);

    // When Skills is given the hidden list's name
    const input = await editName("l2");
    await userEvent.clear(input);
    await userEvent.type(input, "Locations{Enter}");

    // Then the row says why, and nothing is sent
    expect(await screen.findByText("Another list has that name")).toBeDefined();
    expect(sent(fetch, "PUT", "/api/lists/l2")).toBe(false);
  });

  it("is not offered to those who may only view lists", async () => {
    await openLists({ "GET /api/session": viewer });
    expect(recordCell("l2", "name")?.getAttribute("aria-readonly")).toBe(
      "true",
    );
  });
});

describe("a list's row menu", () => {
  it("offers an editor its details, its link, retiring and removing a custom list", async () => {
    await openLists();
    expect(itemNames(await rowMenu("Locations"))).toEqual([
      expect.stringMatching(/^Show details/),
      expect.stringMatching(/^Copy link/),
      "Retire",
      "Remove list",
    ]);
  });

  it("offers an editor only the details and link of a list Fathom builds in", async () => {
    await openLists({
      "GET /api/lists": () =>
        Response.json({ lists: [{ ...locations, builtIn: "positions" }] }),
    });
    expect(itemNames(await rowMenu("Locations"))).toEqual([
      expect.stringMatching(/^Show details/),
      expect.stringMatching(/^Copy link/),
    ]);
  });

  it("offers a viewer only its details and its link", async () => {
    await openLists({ "GET /api/session": viewer });
    expect(itemNames(await rowMenu("Locations"))).toEqual([
      expect.stringMatching(/^Show details/),
      expect.stringMatching(/^Copy link/),
    ]);
  });

  it("drafts retiring a list from its menu", async () => {
    // Given an editor on the table of lists
    const { fetch } = await openLists({
      "PUT /api/lists/l1/retired": savedAs(),
    });

    // When Retire is chosen in Locations' menu
    await userEvent.click(
      within(await rowMenu("Locations")).getByRole("menuitem", {
        name: "Retire",
      }),
    );

    // Then retiring it is drafted
    expect(
      await screen.findByText("Drafted retiring Locations."),
    ).toBeDefined();
    expect(bodyOf(fetch, "PUT", "/api/lists/l1/retired")).toEqual([
      { retired: true },
    ]);
  });

  it("says why the server refuses retiring a list, leaving it as it was", async () => {
    // Given an editor on the table of lists, where a column uses Locations
    const refusal = "A column uses this list, so it can't be retired";
    await openLists({
      "PUT /api/lists/l1/retired": () =>
        Response.json({ error: refusal }, { status: 409 }),
    });

    // When Retire is chosen in Locations' menu
    await userEvent.click(
      within(await rowMenu("Locations")).getByRole("menuitem", {
        name: "Retire",
      }),
    );

    // Then the refusal is shown, and Locations isn't drafted to be retired
    expect(await screen.findByText(refusal, { exact: false })).toBeDefined();
    expect(screen.queryByText("Drafted retiring Locations.")).toBeNull();
    expect(cellText("l1", "name")).not.toContain("Retired");
  });

  it("drafts restoring a retired list from its menu", async () => {
    // Given an editor on the table of lists, showing retired ones
    const { fetch } = await openLists(
      { "PUT /api/lists/l4/retired": savedAs() },
      "/lists?retired=true",
    );

    // When Restore is chosen in Regions' menu
    await userEvent.click(
      within(await rowMenu("Regions")).getByRole("menuitem", {
        name: "Restore",
      }),
    );

    // Then restoring it is drafted
    await waitFor(() => {
      expect(bodyOf(fetch, "PUT", "/api/lists/l4/retired")).toEqual([
        { retired: false },
      ]);
    });
  });

  it("drafts removing a list from its menu, keeping focus on its row", async () => {
    const { fetch } = await openLists({ "DELETE /api/lists/l2": savedAs() });
    await userEvent.click(
      within(await rowMenu("Skills")).getByRole("menuitem", {
        name: "Remove list",
      }),
    );
    await waitFor(() => {
      expect(sent(fetch, "DELETE", "/api/lists/l2")).toBe(true);
    });
    await waitFor(() => {
      expect(document.activeElement).toBe(recordCell("l2", "name"));
    });
  });

  it("offers no retiring or removing for a list only drafted to be added, but discards its draft", async () => {
    // Given a list only drafted to be added
    const { fetch } = await openLists({
      "GET /api/lists": () => Response.json({ lists: [locations, added] }),
      "DELETE /api/lists/l5/draft": savedAs(),
    });

    // When its row's menu is opened
    const menu = await rowMenu("Teams");

    // Then it offers neither retiring nor removing it, and discards its draft
    expect(
      within(menu).queryByRole("menuitem", { name: "Remove list" }),
    ).toBeNull();
    expect(within(menu).queryByRole("menuitem", { name: "Retire" })).toBeNull();
    await userEvent.click(
      within(menu).getByRole("menuitem", { name: startsWith("Discard draft") }),
    );
    expect(
      await screen.findByText("Discarded the draft of Teams."),
    ).toBeDefined();
    expect(sent(fetch, "DELETE", "/api/lists/l5/draft")).toBe(true);
  });

  it("puts its draft's items before Remove list, as every table's menu does", async () => {
    // Given Skills renamed by a draft of the editor's, waiting for approval
    await openLists({
      "GET /api/lists": () =>
        Response.json({
          lists: [
            {
              ...skills,
              name: "Talents",
              draft: {
                ...removal,
                action: "changed",
                changed: ["name"],
                live: { name: "Skills" },
              },
            },
          ],
        }),
    });

    // When its row's menu is opened
    const names = itemNames(await rowMenu("Talents"));

    // Then Discard draft comes before Remove list
    const discard = names.findIndex((name) => name.startsWith("Discard draft"));
    expect(discard).not.toBe(-1);
    expect(names.indexOf("Remove list")).toBeGreaterThan(discard);
  });

  it("resubmits a list's rejected draft from its menu, saying why it was rejected", async () => {
    const { fetch } = await openLists({
      "GET /api/lists": () =>
        Response.json({
          lists: [
            {
              ...skills,
              name: "Talents",
              draft: {
                ...removal,
                state: "rejected",
                reason: "Keep Skills",
                action: "changed",
                changed: ["name"],
                live: { name: "Skills" },
              },
            },
          ],
        }),
      "DELETE /api/lists/l2/draft/rejection": savedAs(),
    });
    const menu = await rowMenu("Talents");
    expect(within(menu).getByText("Reason: Keep Skills")).toBeDefined();
    await userEvent.click(
      within(menu).getByRole("menuitem", { name: startsWith("Resubmit") }),
    );
    await waitFor(() => {
      expect(sent(fetch, "DELETE", "/api/lists/l2/draft/rejection")).toBe(true);
    });
  });

  it("offers an Approver deciding a list's draft with its choices' drafts", async () => {
    // Given an Approver, and a list drafted to be added with a choice drafted into it
    await openLists({
      "GET /api/session": approver,
      "GET /api/people": noPeople,
      "GET /api/lists": () => Response.json({ lists: [locations, added] }),
    });

    // When Reject is chosen in the list's menu
    const menu = await rowMenu("Teams");
    expect(
      within(menu).getByRole("menuitem", { name: startsWith("Approve") }),
    ).toBeDefined();
    await userEvent.click(
      within(menu).getByRole("menuitem", { name: startsWith("Reject") }),
    );

    // Then the dialog rejects both drafts
    expect(
      await screen.findByRole("dialog", { name: "Reject 2 drafts?" }),
    ).toBeDefined();
  });

  it("offers an Approver deciding a list's choices' drafts from its row", async () => {
    await openLists({
      "GET /api/session": approver,
      "GET /api/people": noPeople,
      "GET /api/lists": () =>
        Response.json({
          lists: [
            {
              ...locations,
              choices: [
                {
                  ...choice("c9", "Brindle Hill"),
                  draft: {
                    ...waiting,
                    action: "created",
                    changed: ["label"],
                    live: {},
                  },
                },
              ],
            },
          ],
        }),
    });
    await userEvent.click(
      within(await rowMenu("Locations")).getByRole("menuitem", {
        name: startsWith("Approve"),
      }),
    );
    expect(
      await screen.findByRole("dialog", { name: "Approve 1 draft?" }),
    ).toBeDefined();
  });

  it("offers an editor who doesn't approve lists no deciding of a list's drafts", async () => {
    await openLists({
      "GET /api/lists": () => Response.json({ lists: [locations, added] }),
    });
    expect(itemNames(await rowMenu("Teams"))).not.toContainEqual(
      expect.stringMatching(/^(Approve|Reject)/),
    );
  });
});

describe("a list's row", () => {
  it("is marked as selected while the list's details are open", async () => {
    await openLists({}, "/lists/l2");
    await waitFor(() => {
      expect(currentRows()).toEqual([expect.stringContaining("Skills")]);
    });
  });

  it("says a list's class after its name", async () => {
    await openLists();
    expect(cellText("l2", "name")).toMatch(/^Skills, Personal/);
  });

  it("says a retired list is retired, live only too", async () => {
    await openLists({}, "/lists?retired=true&show=live");
    await waitFor(() => {
      expect(shownLists()).toContain("Regions");
    });
    expect(cellText("l4", "name")).toContain("Retired");
  });

  it("says a list is retired before saying a draft restores it", async () => {
    await openLists(
      {
        "GET /api/lists": () =>
          Response.json({
            lists: [
              {
                ...regions,
                retired: false,
                draft: {
                  ...waiting,
                  action: "changed",
                  changed: ["retired"],
                  live: { retired: true },
                },
              },
            ],
          }),
      },
      "/lists?retired=true",
    );
    await waitFor(() => {
      expect(cellText("l4", "name")).toMatch(/Retired.*Restored/);
    });
  });
});

describe("grouping lists", () => {
  it("groups lists by kind, those built in first", async () => {
    await openLists(
      {
        "GET /api/lists": () =>
          Response.json({
            lists: [skills, { ...locations, builtIn: "positions" }],
          }),
      },
      "/lists?grouping=kind",
    );
    await waitFor(() => {
      expect(
        screen.getAllByRole("rowheader").map(({ textContent }) => textContent),
      ).toEqual([
        expect.stringMatching(/^Built in/),
        expect.stringMatching(/^Custom/),
      ]);
    });
    await userEvent.click(
      screen.getByRole("button", { name: "Group by: Kind" }),
    );
    expect(
      (await choicesUnder("Group by")).getByRole("menuitem", { name: /Kind/ }),
    ).toBeDefined();
  });
});

describe("the columns that use a list", () => {
  it("names each column that offers a list's choices, by its page", async () => {
    await openLists({
      "GET /api/lists": () =>
        Response.json({
          lists: [
            {
              ...locations,
              usedBy: [
                { page: "Features", column: "Site" },
                { page: "People", column: "Office" },
              ],
            },
            { ...skills, usedBy: [] },
            regions,
          ],
        }),
    });
    expect(shownLists()).toEqual(["Locations", "Skills"]);
    expect(cellText("l1", "usedBy")).toBe("Features: Site, People: Office");
    expect(cellText("l2", "usedBy")).toBe("");
  });

  it("finds a list by a column that uses it", async () => {
    await openLists({
      "GET /api/lists": () =>
        Response.json({
          lists: [
            { ...locations, usedBy: [{ page: "People", column: "Office" }] },
            skills,
          ],
        }),
    });
    await userEvent.type(
      screen.getByRole("textbox", { name: "Search lists" }),
      "office",
    );
    await waitFor(() => {
      expect(shownLists()).toEqual(["Locations"]);
    });
  });
});

describe("the Lists page's saved views", () => {
  it("keeps the view applied in the address while a list is opened", async () => {
    const view = {
      id: "00000000-0000-4000-8000-0000000000d1",
      name: "Custom only",
      scope: "personal",
      definition: { search: "skills" },
      canChange: true,
      canShare: false,
    };
    const { history } = await openLists(
      { "GET /api/views/lists": () => Response.json([view]) },
      `/lists?view=${view.id}&search=skills`,
    );
    await openList("Skills");
    await waitFor(() => {
      expect(history.location.pathname).toBe("/lists/l2");
    });
    expect(history.location.search).toContain(`view=${view.id}`);
  });
});
