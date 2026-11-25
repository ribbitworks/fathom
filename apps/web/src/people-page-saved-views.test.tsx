// SPDX-License-Identifier: Apache-2.0

// Tests of the People table's saved views.

import { act, screen, waitFor, within } from "@testing-library/react";
import { userEvent } from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { bodyOf } from "./test-support.tsx";
import {
  s1,
  session,
  viewer,
  savedAs,
  undone,
  openAt,
  shownNames,
  choose,
  viewsButton,
  viewsMenu,
  viewsMenuItems,
  viewsMenuLayout,
  chooseView,
  address,
} from "./test-people-page.tsx";

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("saved views", () => {
  const v1 = "00000000-0000-4000-8000-0000000000a1";
  const v2 = "00000000-0000-4000-8000-0000000000a2";
  const harbour = {
    id: v1,
    name: "Harbour",
    scope: "shared",
    definition: { filters: { f1: { any: ["c1"] } } },
    canChange: true,
    canShare: false,
  };
  const theirs = {
    id: v2,
    name: "Theirs",
    scope: "shared",
    definition: { sort: ["-preferredName"] },
    canChange: false,
    canShare: false,
  };
  const withViews = (views: object[]) => () => Response.json(views);

  it("offers nothing to save or apply until there is a view or a saved one", async () => {
    await openAt("/people");
    expect(await viewsMenuLayout()).toEqual(["Hidden", "Key, show"]);
  });

  it("saves the view under a name, applies it, and goes back with Back", async () => {
    let views: object[] = [];
    const { fetch, history } = await openAt(
      '/people?filters={"f1":{"any":["c1"]}}',
      {
        "GET /api/views/people": () => withViews(views)(),
        "POST /api/views/people": () => {
          views = [harbour];
          return Response.json(
            { view: harbour, changeSetId: s1 },
            { status: 201 },
          );
        },
      },
    );
    // Changed from the table's default view, with nothing saved yet.
    expect(viewsButton().getAttribute("aria-label")).toBe("Views, changed");
    await chooseView("Save view…");
    const dialog = await screen.findByRole("dialog", { name: "Save view" });
    await userEvent.keyboard("{Enter}");
    expect(within(dialog).getByText("Name needed")).toBeDefined();
    expect(within(dialog).getByText("Includes")).toBeDefined();
    await userEvent.keyboard("Harbour{Enter}");
    await waitFor(() => {
      expect(address(history)).toContain(`view=${v1}`);
    });
    expect(bodyOf(fetch, "POST", "/api/views/people")).toEqual([
      {
        name: "Harbour",
        scope: "personal",
        definition: { filters: { f1: { any: ["c1"] } } },
      },
    ]);
    expect(viewsButton().getAttribute("aria-label")).toBe("Views: Harbour");

    await userEvent.click(screen.getByRole("button", { name: "Clear all" }));
    expect(address(history)).not.toContain("view=");
    expect(shownNames()).toEqual(["Avery Fictional", "Blake Fictional"]);
    await chooseView("Harbour");
    expect(shownNames()).toEqual(["Avery Fictional"]);
    expect(address(history)).toContain(`view=${v1}`);
    act(() => {
      history.back();
    });
    await waitFor(() => {
      expect(shownNames()).toEqual(["Avery Fictional", "Blake Fictional"]);
    });
  });

  it("sets what may be done with the user's own view apart from the views, even with nothing in it", async () => {
    await openAt(`/people?view=${v1}`, {
      "GET /api/views/people": withViews([
        { ...harbour, definition: {} },
        theirs,
      ]),
    });
    expect(await viewsMenuLayout()).toEqual([
      "Shared views",
      "Harbour, chosen",
      "Theirs",
      "—",
      "Hidden",
      "Key, show",
      "—",
      "Rename…",
      "Delete view",
    ]);
  });

  it("marks a changed view, updates, renames, and deletes the user's own, with Undo", async () => {
    // The server keeps what each change sent.
    let mine = harbour;
    const { fetch, history } = await openAt(
      `/people?filters={"f1":{"any":["c1"]}}&view=${v1}`,
      {
        "GET /api/views/people": () => withViews([mine, theirs])(),
        [`PUT /api/views/people/${v1}`]: () => {
          const [change] = bodyOf(
            fetch,
            "PUT",
            `/api/views/people/${v1}`,
          ).slice(-1) as object[];
          mine = { ...mine, ...change };
          return Response.json({ view: mine, changeSetId: s1 });
        },
        [`DELETE /api/views/people/${v1}`]: savedAs(),
      },
    );
    expect(viewsButton().getAttribute("aria-label")).toBe("Views: Harbour");
    await choose("Name", "Sort A to Z");
    expect(viewsButton().getAttribute("aria-label")).toBe(
      "Views: Harbour, changed",
    );
    expect(address(history)).toContain(`view=${v1}`);
    await chooseView("Update view");
    expect(bodyOf(fetch, "PUT", `/api/views/people/${v1}`)).toEqual([
      {
        definition: {
          filters: { f1: { any: ["c1"] } },
          sort: ["preferredName"],
        },
      },
    ]);
    expect(viewsButton().getAttribute("aria-label")).toBe("Views: Harbour");

    await chooseView("Rename…");
    const dialog = await screen.findByRole("dialog", { name: "Rename view" });
    const name = within(dialog).getByRole("textbox", { name: "Name" });
    await userEvent.clear(name);
    await userEvent.type(name, "theirs");
    expect(
      within(dialog).getByText("Another view has that name"),
    ).toBeDefined();
    await userEvent.clear(name);
    await userEvent.type(name, "Home{Enter}");
    await waitFor(() => {
      expect(screen.queryByRole("dialog")).toBeNull();
    });
    expect(bodyOf(fetch, "PUT", `/api/views/people/${v1}`)).toContainEqual({
      name: "Home",
    });

    await chooseView("Delete view");
    expect(fetch).toHaveBeenCalledWith(
      `/api/views/people/${v1}`,
      expect.objectContaining({ method: "DELETE" }),
    );
    await screen.findByText("Deleted the Home view.");
    await userEvent.click(screen.getByRole("button", { name: "Undo" }));
    await waitFor(() => {
      expect(undone(fetch)).toEqual([s1]);
    });
  });

  it("lists views under My views and Shared views", async () => {
    await openAt("/people", {
      "GET /api/views/people": withViews([
        { ...harbour, scope: "personal" },
        theirs,
      ]),
    });
    expect(await viewsMenuLayout()).toEqual([
      "My views",
      "Harbour",
      "Shared views",
      "Theirs",
      "—",
      "Hidden",
      "Key, show",
    ]);
  });

  it("leaves out a group with no views", async () => {
    await openAt("/people", { "GET /api/views/people": withViews([theirs]) });
    expect(await viewsMenuLayout()).toEqual([
      "Shared views",
      "Theirs",
      "—",
      "Hidden",
      "Key, show",
    ]);
  });

  describe("a view of the user's own that their role can no longer use", () => {
    const v3 = "00000000-0000-4000-8000-0000000000a3";
    const leaving = {
      id: v3,
      name: "Leaving soon",
      missing: { columns: ["End"], groupings: [] },
    };

    it("is listed dimmed under My views, saying what it uses that the role can't see", async () => {
      await openAt("/people", {
        "GET /api/views/people": withViews([theirs, leaving]),
      });
      expect(await viewsMenuLayout()).toEqual([
        "My views",
        "Leaving soonUses End, which this role can't see.",
        "Shared views",
        "Theirs",
        "—",
        "Hidden",
        "Key, show",
      ]);
    });

    it("offers Rename… and Delete… alone, and renames it with no Undo", async () => {
      let views: object[] = [leaving];
      const renamed = { ...leaving, name: "Leaving later" };
      const { fetch } = await openAt("/people", {
        "GET /api/views/people": () => withViews(views)(),
        [`PUT /api/views/people/${v3}`]: () => {
          views = [renamed];
          return Response.json({ view: renamed, changeSetId: s1 });
        },
      });
      await userEvent.click(
        within(await viewsMenu()).getByRole("menuitem", {
          name: /^Leaving soon/,
        }),
      );
      const offered = await screen.findAllByRole("menuitem", {
        name: /^(Rename…|Delete…)$/,
      });
      expect(offered.map((item) => item.textContent)).toEqual([
        "Rename…",
        "Delete…",
      ]);
      await userEvent.click(offered[0] as HTMLElement);
      const dialog = await screen.findByRole("dialog", {
        name: "Rename view",
      });
      await userEvent.clear(within(dialog).getByRole("textbox"));
      await userEvent.type(
        within(dialog).getByRole("textbox"),
        "Leaving later{Enter}",
      );
      await waitFor(() => {
        expect(screen.queryByRole("dialog")).toBeNull();
      });
      expect(bodyOf(fetch, "PUT", `/api/views/people/${v3}`)).toEqual([
        { name: "Leaving later" },
      ]);
      await userEvent.keyboard("{Meta>}z{/Meta}");
      expect(
        fetch.mock.calls.some(([url]) => url.startsWith("/api/undo")),
      ).toBe(false);
      expect(await viewsMenuItems()).toContain(
        "Leaving laterUses End, which this role can't see.",
      );
    });

    it("deletes it only once asked, saying so with no Undo", async () => {
      const { fetch } = await openAt("/people", {
        "GET /api/views/people": withViews([leaving]),
        [`DELETE /api/views/people/${v3}`]: savedAs(),
      });
      await userEvent.click(
        within(await viewsMenu()).getByRole("menuitem", {
          name: /^Leaving soon/,
        }),
      );
      await userEvent.click(
        await screen.findByRole("menuitem", { name: "Delete…" }),
      );
      const question = await screen.findByRole("dialog", {
        name: "Delete the Leaving soon view?",
      });
      expect(within(question).getByText("This can't be undone.")).toBeDefined();
      expect(within(question).getByRole("button", { name: "Cancel" })).toBe(
        document.activeElement,
      );
      await userEvent.keyboard("{Escape}");
      await waitFor(() => {
        expect(screen.queryByRole("dialog")).toBeNull();
      });
      await userEvent.click(
        within(await viewsMenu()).getByRole("menuitem", {
          name: /^Leaving soon/,
        }),
      );
      await userEvent.click(
        await screen.findByRole("menuitem", { name: "Delete…" }),
      );
      await userEvent.click(
        within(
          await screen.findByRole("dialog", {
            name: "Delete the Leaving soon view?",
          }),
        ).getByRole("button", { name: "Cancel" }),
      );
      const deletes = () =>
        fetch.mock.calls.filter(
          ([url, init]) =>
            url === `/api/views/people/${v3}` && init?.method === "DELETE",
        ).length;
      expect(deletes()).toBe(0);
      await userEvent.click(
        within(await viewsMenu()).getByRole("menuitem", {
          name: /^Leaving soon/,
        }),
      );
      await userEvent.click(
        await screen.findByRole("menuitem", { name: "Delete…" }),
      );
      await userEvent.click(
        within(
          await screen.findByRole("dialog", {
            name: "Delete the Leaving soon view?",
          }),
        ).getByRole("button", { name: "Delete" }),
      );
      expect(
        await screen.findByText("Deleted the Leaving soon view."),
      ).toBeDefined();
      expect(screen.queryByRole("button", { name: "Undo" })).toBeNull();
      expect(deletes()).toBe(1);
    });
  });

  it("shares the applied view, offering Undo", async () => {
    const mine = {
      ...harbour,
      scope: "personal",
      canShare: true,
      definition: {},
    };
    const url = `/api/views/people/${v1}`;
    const { fetch } = await openAt(`/people?view=${v1}`, {
      "GET /api/views/people": withViews([mine]),
      [`PUT ${url}`]: () =>
        Response.json({
          view: { ...mine, scope: "shared" },
          changeSetId: s1,
        }),
    });
    await chooseView("Share current view");
    await screen.findByText("Shared the Harbour view.");
    expect(bodyOf(fetch, "PUT", url)).toEqual([{ scope: "shared" }]);
    await userEvent.click(screen.getByRole("button", { name: "Undo" }));
    await waitFor(() => {
      expect(undone(fetch)).toEqual([s1]);
    });
  });

  it("stops sharing the applied view, offering Undo", async () => {
    const shared = { ...harbour, canShare: true, definition: {} };
    const url = `/api/views/people/${v1}`;
    const { fetch } = await openAt(`/people?view=${v1}`, {
      "GET /api/views/people": withViews([shared]),
      [`PUT ${url}`]: () =>
        Response.json({
          view: { ...shared, scope: "personal" },
          changeSetId: s1,
        }),
    });
    await chooseView("Stop sharing current view");
    await screen.findByText("Stopped sharing the Harbour view.");
    expect(bodyOf(fetch, "PUT", url)).toEqual([{ scope: "personal" }]);
    await userEvent.click(screen.getByRole("button", { name: "Undo" }));
    await waitFor(() => {
      expect(undone(fetch)).toEqual([s1]);
    });
  });

  it("says why a view could not be shared", async () => {
    const mine = {
      ...harbour,
      scope: "personal",
      canShare: true,
      definition: {},
    };
    await openAt(`/people?view=${v1}`, {
      "GET /api/views/people": withViews([mine]),
      [`PUT /api/views/people/${v1}`]: () =>
        Response.json(
          { error: "Another shared view is named Harbour" },
          { status: 409 },
        ),
    });
    await chooseView("Share current view");
    await screen.findByText("Another shared view is named Harbour");
    expect(await viewsMenuLayout()).toContain("My views");
  });

  it("offers no sharing of a view the user may not share", async () => {
    await openAt(`/people?view=${v1}`, {
      "GET /api/views/people": withViews([{ ...harbour, definition: {} }]),
    });
    const items = await viewsMenuItems();
    expect(items).toContain("Rename…");
    expect(items).not.toContain("Stop sharing current view");
  });

  it("saves a view as shared when the box is ticked", async () => {
    const { fetch } = await openAt("/people?search=avery", {
      "GET /api/views/people": withViews([]),
      "POST /api/views/people": () =>
        Response.json({ view: harbour, changeSetId: s1 }, { status: 201 }),
    });
    await chooseView("Save view…");
    const dialog = await screen.findByRole("dialog", { name: "Save view" });
    await userEvent.click(
      within(dialog).getByRole("checkbox", {
        name: "Share with everyone who sees this page",
      }),
    );
    await userEvent.type(
      within(dialog).getByRole("textbox", { name: "Name" }),
      "Harbour{Enter}",
    );
    await waitFor(() => {
      expect(bodyOf(fetch, "POST", "/api/views/people")).toEqual([
        { name: "Harbour", scope: "shared", definition: { search: "avery" } },
      ]);
    });
  });

  it("offers no choice of sharing to those who may not save shared views", async () => {
    await openAt("/people?search=avery", {
      "GET /api/session": viewer,
      "GET /api/views/people": withViews([]),
    });
    await chooseView("Save view…");
    const dialog = await screen.findByRole("dialog", { name: "Save view" });
    expect(within(dialog).getByText("Includes")).toBeDefined();
    expect(within(dialog).queryByRole("checkbox")).toBeNull();
  });

  it.each([
    ["edits people", ["people:view", "people:edit"], true],
    [
      "only changes configuration",
      ["people:view", "configuration:view", "configuration:edit"],
      false,
    ],
  ] as const)(
    "offers the choice of sharing to a role that %s: %s",
    async (_role, permissions, offered) => {
      await openAt("/people?search=avery", {
        "GET /api/session": session([...permissions]),
        "GET /api/views/people": withViews([]),
      });
      await chooseView("Save view…");
      const dialog = await screen.findByRole("dialog", { name: "Save view" });
      expect(
        within(dialog).queryByRole("checkbox", {
          name: "Share with everyone who sees this page",
        }) !== null,
      ).toBe(offered);
    },
  );

  it("checks a name only against views kept the same way", async () => {
    await openAt("/people?search=avery", {
      "GET /api/views/people": withViews([theirs]),
    });
    await chooseView("Save view…");
    const dialog = await screen.findByRole("dialog", { name: "Save view" });
    await userEvent.keyboard("theirs");
    expect(within(dialog).queryByText("Another view has that name")).toBeNull();
    await userEvent.click(within(dialog).getByRole("checkbox"));
    expect(
      within(dialog).getByText("Another view has that name"),
    ).toBeDefined();
    await userEvent.click(within(dialog).getByRole("checkbox"));
    expect(within(dialog).queryByText("Another view has that name")).toBeNull();
  });

  it("stops showing a name as taken once the view would be kept the other way", async () => {
    await openAt("/people?search=avery", {
      "GET /api/views/people": withViews([]),
      "POST /api/views/people": () =>
        Response.json({ error: "Another view has that name" }, { status: 409 }),
    });
    await chooseView("Save view…");
    const dialog = await screen.findByRole("dialog", { name: "Save view" });
    await userEvent.keyboard("Taken{Enter}");
    expect(
      await within(dialog).findByText("Another view has that name"),
    ).toBeDefined();
    await userEvent.click(within(dialog).getByRole("checkbox"));
    expect(within(dialog).queryByText("Another view has that name")).toBeNull();
  });

  it("saves a moved column in the view", async () => {
    const { fetch } = await openAt("/people", {
      "GET /api/views/people": withViews([]),
      "POST /api/views/people": () =>
        Response.json({ view: harbour, changeSetId: s1 }, { status: 201 }),
    });
    await userEvent.click(
      screen.getByRole("button", { name: /^Preferred name|^Name/ }),
    );
    await userEvent.click(
      await screen.findByRole("menuitem", { name: /Move right/ }),
    );
    await chooseView("Save view…");
    const dialog = await screen.findByRole("dialog", { name: "Save view" });
    await userEvent.type(
      within(dialog).getByRole("textbox", { name: "Name" }),
      "Moved",
    );
    await userEvent.click(
      within(dialog).getByRole("button", { name: "Save view" }),
    );
    await waitFor(() => {
      expect(bodyOf(fetch, "POST", "/api/views/people")).toEqual([
        {
          name: "Moved",
          scope: "personal",
          definition: expect.objectContaining({
            order: expect.arrayContaining([
              "preferredName",
            ]) as unknown as string[],
          }) as unknown,
        },
      ]);
    });
  });

  it("clears moved columns with Clear all", async () => {
    const { history } = await openAt(
      '/people?order=["employeeId","preferredName"]',
    );
    await userEvent.click(screen.getByRole("button", { name: "Clear all" }));
    await waitFor(() => {
      expect(address(history)).not.toContain("order=");
    });
  });

  it("names moved columns in the menu, and puts them back from it", async () => {
    const { history } = await openAt(
      '/people?order=["employeeId","preferredName"]',
      { "GET /api/views/people": withViews([]) },
    );
    await chooseView(/^Columns moved/);
    await waitFor(() => {
      expect(address(history)).not.toContain("order=");
    });
  });

  it("lets a new view, which is personal, take the name of a shared one", async () => {
    await openAt("/people?search=avery", {
      "GET /api/views/people": withViews([harbour]),
    });
    await chooseView("Save view…");
    const dialog = await screen.findByRole("dialog", { name: "Save view" });
    await userEvent.keyboard("harbour");
    expect(within(dialog).queryByText("Another view has that name")).toBeNull();
  });

  it("starts the menu with no divider when there are no saved views", async () => {
    await openAt("/people?show=drafts", {
      "GET /api/views/people": withViews([]),
    });
    expect((await viewsMenuLayout())[0]).not.toBe("—");
  });

  it("lets others apply a view without changing it, save it as their own, and clear it", async () => {
    await openAt(`/people?sort=["-preferredName"]&view=${v2}`, {
      "GET /api/views/people": withViews([harbour, theirs]),
    });
    await userEvent.click(viewsButton());
    const offered = await screen.findAllByRole("menuitem");
    expect(offered.map((item) => item.textContent)).toEqual([
      "Harbour",
      "Theirs, chosen",
      "Name ↓descending, remove sort",
      "Key, show",
      "Clear view",
      "Save as new view…",
    ]);
    // Every saved view keeps room for the tick, so names line up.
    expect(
      offered
        .slice(0, 2)
        .map((item) => item.querySelector("[data-position='left']") !== null),
    ).toEqual([true, true]);
    await userEvent.click(
      screen.getByRole("menuitem", { name: "Save as new view…" }),
    );
    await screen.findByRole("dialog", { name: "Save view" });
    await userEvent.keyboard("{Escape}");
    await waitFor(() => {
      expect(screen.queryByRole("dialog")).toBeNull();
    });
    await chooseView("Clear view");
    expect(viewsButton().getAttribute("aria-label")).toBe("Views");
    // With no view applied, none is ticked.
    await userEvent.click(viewsButton());
    const items = await screen.findAllByRole("menuitem");
    expect(items.map((item) => item.textContent)).toEqual([
      "Harbour",
      "Theirs",
      "Key, show",
    ]);
    expect(items.filter((item) => item.querySelector("[data-chosen]"))).toEqual(
      [],
    );
  });

  it("refuses a name someone has just taken, and says when a view cannot be saved", async () => {
    let status = 409;
    await openAt("/people?search=avery", {
      "GET /api/views/people": withViews([]),
      "POST /api/views/people": () =>
        Response.json({ error: "Another view has that name" }, { status }),
    });
    await chooseView("Save view…");
    const dialog = await screen.findByRole("dialog", { name: "Save view" });
    await userEvent.keyboard("Taken{Enter}");
    expect(
      await within(dialog).findByText("Another view has that name"),
    ).toBeDefined();
    status = 500;
    await userEvent.keyboard("!{Enter}");
    expect(await within(dialog).findByRole("alert")).toBeDefined();
    await userEvent.click(
      within(dialog).getByRole("button", { name: "Cancel" }),
    );
    await waitFor(() => {
      expect(screen.queryByRole("dialog")).toBeNull();
    });
    await chooseView("Save view…");
    await screen.findByRole("dialog", { name: "Save view" });
    await userEvent.keyboard("{Escape}");
    await waitFor(() => {
      expect(screen.queryByRole("dialog")).toBeNull();
    });
  });
});
