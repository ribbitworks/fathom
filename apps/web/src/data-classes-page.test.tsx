// SPDX-License-Identifier: Apache-2.0

// Tests for the Data classes page, with the server's responses simulated: who reaches it, the class
// of each built-in detail, column and list, with what each is about, and changing a class, which
// every page then follows.

import { defaultClasses, type Permission } from "@fathom/shared";
import { screen, waitFor, within } from "@testing-library/react";
import { userEvent } from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  bodyOf,
  fictionalUser,
  renderApp,
  serverAnswers,
} from "./test-support.tsx";

type Answers = Parameters<typeof serverAnswers>[0];

const classifierPermissions: Permission[] = [
  "plan:view",
  "features:view",
  "people:view",
  "personal:view",
  "configuration:view",
  "data:classify",
];

const session =
  (dataClasses = defaultClasses, permissions = classifierPermissions) =>
  () =>
    Response.json({
      ...fictionalUser,
      permissions,
      settings: { ...fictionalUser.settings, dataClasses },
    });

const field = (id: string, name: string, extra: object) => ({
  id,
  name,
  type: "link",
  listId: null,
  visibility: "general",
  multiple: false,
  required: false,
  ...extra,
});

const sites = {
  id: "l1",
  name: "Sites",
  description: "",
  visibility: "general",
  retired: false,
  choices: [],
};
const sizes = { ...sites, id: "l2", name: "Sizes", onFeatures: true };
const removed = {
  ...sites,
  id: "l4",
  name: "Removed",
  draft: {
    action: "deleted",
    changed: [],
    live: {},
    state: "waiting",
    madeBy: "Fictional Editor",
    madeAt: "2026-11-01T10:00:00.000Z",
  },
};
const drafted = {
  ...sites,
  id: "l3",
  name: "Drafted",
  draft: {
    action: "created",
    changed: [],
    live: {},
    state: "waiting",
    madeBy: "Fictional Editor",
    madeAt: "2026-11-01T10:00:00.000Z",
  },
};

const people = (fields: object[]) => () => Response.json({ fields, order: [] });

const site = field("f1", "Site", {
  type: "choice",
  listId: "l1",
  visibility: null,
});
const profile = field("f2", "Profile", { visibility: "personal" });

function openPage(answers: Answers = {}) {
  const fetch = serverAnswers({
    "GET /api/session": session(),
    "GET /api/people/columns": people([site, profile]),
    "GET /api/lists": () =>
      Response.json({ lists: [sites, sizes, drafted, removed] }),
    ...answers,
  });
  renderApp("/data-classes");
  return fetch;
}

afterEach(() => {
  vi.unstubAllGlobals();
});

const section = (name: string) => screen.findByRole("region", { name });

const cellsOf = (row: HTMLElement) =>
  within(row)
    .getAllByRole("cell")
    .map((cell) => cell.textContent);

const rowOf = (holder: HTMLElement, name: string) =>
  within(holder).getByRole("cell", { name }).closest("tr") as HTMLElement;

describe("the Data classes page", () => {
  it("shows each built-in detail's class, as its symbol and name, and what needs it", async () => {
    openPage();
    const details = await section("Built-in details");
    expect(cellsOf(rowOf(details, "Start date"))).toEqual([
      "Start date",
      "Personal",
      "These need it: People on other dates, Org chart on other dates, People on future dates, Org chart on future dates, Feature assignments, Feature assignments grouped by manager, Allocations grouped by manager, Allocations, People's Start.",
      "Change class…",
    ]);
    expect(cellsOf(rowOf(details, "Hiring plan"))).toEqual([
      "Hiring plan",
      "Confidential",
      "These need it: Planned hires on People and the Org chart.",
      "Change class…This role can't see Confidential data",
    ]);
    // The symbol is seen only, so the class is read once, by its name.
    const classCell = within(rowOf(details, "Start date")).getAllByRole(
      "cell",
    )[1] as HTMLElement;
    expect(
      classCell.querySelector("[class*='classSymbol'] svg"),
    ).not.toBeNull();
    expect(
      within(details).getAllByRole("cell", { name: "Personal" }),
    ).toContain(classCell);
  });

  it("shows People's added columns, a column taking its list's class with no change of its own", async () => {
    openPage();
    const columns = await section("Columns");
    await within(columns).findByRole("cell", { name: "Site" });
    await waitFor(() => {
      expect(cellsOf(rowOf(columns, "Site"))).toEqual([
        "Site",
        "General",
        "People shows it. It has the class of its list, Sites.",
        "",
      ]);
    });
    expect(cellsOf(rowOf(columns, "Profile"))).toEqual([
      "Profile",
      "Personal",
      "People shows it.",
      "Change class…",
    ]);
  });

  it("names the list a column takes its class from, for a role without the Lists section", async () => {
    openPage({
      "GET /api/session": session(
        defaultClasses,
        classifierPermissions.filter(
          (permission) => permission !== "configuration:view",
        ),
      ),
    });
    const columns = await section("Columns");
    expect(
      cellsOf(
        (await within(columns).findByRole("cell", { name: "Site" })).closest(
          "tr",
        ) as HTMLElement,
      )[2],
    ).toBe("People shows it. It has the class of its list, Sites.");
    expect(screen.queryByRole("region", { name: "Lists" })).toBeNull();
  });

  it("says nothing of the columns using a list until they are read", async () => {
    openPage({
      "GET /api/people/columns": () =>
        Response.json({ error: "Internal Server Error" }, { status: 500 }),
    });
    await screen.findByText("Fathom could not load the columns.");
    const lists = await section("Lists");
    await within(lists).findByRole("cell", { name: "Sites" });
    expect(cellsOf(rowOf(lists, "Sites"))[2]).toBe("");
  });

  it("leaves out a column whose list isn't sent, rather than guess its class", async () => {
    openPage({
      "GET /api/lists": () => Response.json({ lists: [sizes] }),
    });
    const columns = await section("Columns");
    await within(columns).findByRole("cell", { name: "Profile" });
    expect(within(columns).queryByRole("cell", { name: "Site" })).toBeNull();
  });

  it("shows a column taking its list's class only once the lists are read, never as General first", async () => {
    let answer: (response: Response) => void = () => undefined;
    openPage({
      "GET /api/lists": () =>
        new Promise<Response>((resolve) => {
          answer = resolve;
        }),
    });
    const columns = await section("Columns");
    // Profile has a class of its own, so it would be shown as soon as the columns are read, were the
    // columns not held for the lists; Site with it, as General.
    await expect(
      within(columns).findByRole("cell", { name: "Profile" }, { timeout: 500 }),
    ).rejects.toThrow();
    expect(within(columns).queryByRole("cell", { name: "Site" })).toBeNull();
    answer(Response.json({ lists: [{ ...sites, visibility: "personal" }] }));
    const site = await within(columns).findByRole("cell", { name: "Site" });
    expect(cellsOf(site.closest("tr") as HTMLElement)[1]).toBe("Personal");
  });

  it("says why the columns can't be shown when the lists can't be read, and tries both again", async () => {
    let failing = true;
    openPage({
      "GET /api/lists": () =>
        failing
          ? Response.json({ error: "Internal Server Error" }, { status: 500 })
          : Response.json({ lists: [sites] }),
    });
    const columns = await screen.findByText(/the columns/u);
    failing = false;
    await userEvent.click(
      within(columns.closest("[role='alert']") as HTMLElement).getByRole(
        "button",
        { name: "Try again" },
      ),
    );
    expect(
      await within(await section("Columns")).findByRole("cell", {
        name: "Site",
      }),
    ).toBeTruthy();
  });

  it("shows the approved lists with the columns using them", async () => {
    openPage();
    const lists = await section("Lists");
    await within(lists).findByRole("cell", { name: "Sites" });
    await waitFor(() => {
      expect(cellsOf(rowOf(lists, "Sites"))).toEqual([
        "Sites",
        "General",
        "These People columns use it: Site.",
        "Change class…",
      ]);
    });
    expect(cellsOf(rowOf(lists, "Sizes"))[2]).toBe("No People column uses it.");
    expect(within(lists).queryByRole("cell", { name: "Drafted" })).toBe(null);
    expect(within(lists).queryByRole("cell", { name: "Removed" })).toBe(null);
  });

  it("is not in the menu of a role without Classify data", async () => {
    serverAnswers({
      "GET /api/session": () =>
        Response.json({
          ...fictionalUser,
          permissions: ["plan:view", "features:view"],
        }),
    });
    renderApp("/");
    await screen.findByRole("link", { name: "Overview" });
    expect(screen.queryByRole("link", { name: "Data classes" })).toBe(null);
  });

  it("shows only the built-in details to a role reading neither people nor lists", async () => {
    serverAnswers({
      "GET /api/session": session(defaultClasses, [
        "plan:view",
        "features:view",
        "personal:view",
        "data:classify",
      ]),
    });
    renderApp("/data-classes");
    await section("Built-in details");
    expect(screen.queryByRole("region", { name: "Columns" })).toBe(null);
    expect(screen.queryByRole("region", { name: "Lists" })).toBe(null);
  });

  it("turns off changing a class the role can't see, saying why", async () => {
    openPage();
    const row = rowOf(
      await section("Built-in details"),
      "Future reorganizations",
    );
    expect(
      within(row).getByRole<HTMLButtonElement>("button", {
        name: "Change the class of Future reorganizations",
      }).disabled,
    ).toBe(true);
    expect(
      within(row).getByText("This role can't see Confidential data"),
    ).toBeTruthy();
  });

  it("turns off changing the class of a column or list someone else is changing, saying who", async () => {
    openPage({
      "GET /api/people/columns": people([
        site,
        { ...profile, heldBy: "Fictional Editor" },
      ]),
      "GET /api/lists": () =>
        Response.json({ lists: [{ ...sites, heldBy: "Fictional Editor" }] }),
    });
    for (const name of ["Profile", "Sites"]) {
      const button = await screen.findByRole<HTMLButtonElement>("button", {
        name: `Change the class of ${name}`,
      });
      expect(button.disabled).toBe(true);
    }
    expect(
      screen.getAllByText("Being changed by Fictional Editor"),
    ).toHaveLength(2);
  });

  it("changes a detail's class at once, to a class the role sees", async () => {
    let dataClasses = defaultClasses;
    const fetch = openPage({
      "GET /api/session": () => session(dataClasses)(),
      "PUT /api/data-classes/endDate": () => {
        dataClasses = { ...dataClasses, endDate: "general" };
        return Response.json(dataClasses);
      },
    });
    await section("Built-in details");
    await userEvent.click(
      screen.getByRole("button", { name: "Change the class of End date" }),
    );
    const dialog = await screen.findByRole("dialog", {
      name: "Change the class of End date",
    });
    expect(
      within(dialog).getByRole<HTMLInputElement>("radio", {
        name: /^Confidential/,
      }).disabled,
    ).toBe(true);
    await userEvent.click(
      within(dialog).getByRole("radio", { name: /^General/ }),
    );
    await userEvent.click(
      within(dialog).getByRole("button", { name: "Change" }),
    );
    expect(bodyOf(fetch, "PUT", "/api/data-classes/endDate")).toEqual([
      { dataClass: "general" },
    ]);
    await waitFor(async () => {
      expect(
        cellsOf(rowOf(await section("Built-in details"), "End date"))[1],
      ).toBe("General");
    });
  });

  it("changes a column's and a list's class, reloading what holds them", async () => {
    let shownSites = sites;
    let shownProfile = profile;
    const fetch = openPage({
      "GET /api/people/columns": () => people([site, shownProfile])(),
      "GET /api/lists": () =>
        Response.json({ lists: [shownSites, sizes, drafted] }),
      "PUT /api/columns/f2/class": () => {
        shownProfile = { ...profile, visibility: "general" };
        return Response.json({ changeSetId: null });
      },
      "PUT /api/lists/l1/class": () => {
        shownSites = { ...sites, visibility: "personal" };
        return Response.json({ changeSetId: null });
      },
    });
    await screen.findByRole("cell", { name: "Profile" });
    await userEvent.click(
      screen.getByRole("button", { name: "Change the class of Profile" }),
    );
    let dialog = await screen.findByRole("dialog");
    await userEvent.click(
      within(dialog).getByRole("radio", { name: /^General/ }),
    );
    await userEvent.click(
      within(dialog).getByRole("button", { name: "Change" }),
    );
    expect(bodyOf(fetch, "PUT", "/api/columns/f2/class")).toEqual([
      { dataClass: "general" },
    ]);
    await waitFor(async () => {
      expect(cellsOf(rowOf(await section("Columns"), "Profile"))[1]).toBe(
        "General",
      );
    });
    await waitFor(() => {
      expect(screen.queryByRole("dialog")).toBe(null);
    });
    await userEvent.click(
      screen.getByRole("button", { name: "Change the class of Sites" }),
    );
    dialog = await screen.findByRole("dialog");
    await userEvent.click(
      within(dialog).getByRole("radio", { name: /^Personal/ }),
    );
    await userEvent.click(
      within(dialog).getByRole("button", { name: "Change" }),
    );
    await waitFor(async () => {
      expect(cellsOf(rowOf(await section("Lists"), "Sites"))[1]).toBe(
        "Personal",
      );
    });
  });

  it("keeps a list a column on Features draws on General, saying why", async () => {
    openPage();
    await screen.findByRole("cell", { name: "Sizes" });
    await userEvent.click(
      screen.getByRole("button", { name: "Change the class of Sizes" }),
    );
    const dialog = await screen.findByRole("dialog");
    expect(
      within(dialog).getByRole<HTMLInputElement>("radio", {
        name: /^Personal/,
      }).disabled,
    ).toBe(true);
    expect(
      within(dialog).getAllByText(
        "A column on Features draws on this list, so it stays General",
      ),
    ).toHaveLength(1);
  });

  it("closes without a change when the class stays the same", async () => {
    const fetch = openPage();
    await section("Built-in details");
    await userEvent.click(
      screen.getByRole("button", { name: "Change the class of Start date" }),
    );
    const dialog = await screen.findByRole("dialog");
    await userEvent.click(
      within(dialog).getByRole("button", { name: "Change" }),
    );
    await waitFor(() => {
      expect(screen.queryByRole("dialog")).toBe(null);
    });
    expect(bodyOf(fetch, "PUT", "/api/data-classes/startDate")).toEqual([]);
  });

  it("keeps the dialog open with the server's refusal, and can't be closed while saving", async () => {
    let refuse: (() => void) | undefined;
    openPage({
      "PUT /api/data-classes/startDate": () =>
        new Promise<Response>((resolve) => {
          refuse = () => {
            resolve(Response.json({ error: "Refused" }, { status: 400 }));
          };
        }),
    });
    await section("Built-in details");
    await userEvent.click(
      screen.getByRole("button", { name: "Change the class of Start date" }),
    );
    const dialog = await screen.findByRole("dialog");
    await userEvent.click(
      within(dialog).getByRole("radio", { name: /^General/ }),
    );
    await userEvent.click(
      within(dialog).getByRole("button", { name: "Change" }),
    );
    await waitFor(() => {
      expect(refuse).toBeDefined();
    });
    await userEvent.keyboard("{Escape}");
    expect(screen.getByRole("dialog")).toBeTruthy();
    refuse?.();
    expect(await within(dialog).findByRole("alert")).toBeTruthy();
  });

  it("says when the columns or lists can't be loaded, and tries again", async () => {
    let failing = true;
    const answer = (ok: () => Response) => () =>
      failing ? Response.json({}, { status: 500 }) : ok();
    openPage({
      "GET /api/people/columns": answer(people([site, profile])),
      "GET /api/lists": answer(() =>
        Response.json({ lists: [sites, sizes, drafted] }),
      ),
    });
    expect(
      await screen.findByText("Fathom could not load the columns."),
    ).toBeTruthy();
    expect(
      await screen.findByText("Fathom could not load the lists."),
    ).toBeTruthy();
    failing = false;
    const retry = (what: string) =>
      userEvent.click(
        within(
          screen
            .getByText(`Fathom could not load ${what}.`)
            .closest("[role='alert']") as HTMLElement,
        ).getByRole("button", { name: "Try again" }),
      );
    // The lists first, since trying the columns again reads the lists too.
    await retry("the lists");
    expect(await screen.findByRole("cell", { name: "Sizes" })).toBeTruthy();
    await retry("the columns");
    expect(await screen.findByRole("cell", { name: "Profile" })).toBeTruthy();
    expect(await screen.findByRole("cell", { name: "Sizes" })).toBeTruthy();
  });
});
