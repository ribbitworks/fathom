// SPDX-License-Identifier: Apache-2.0

// Tests of filtering the People table, by its columns and by draft.

import { act, screen, waitFor, within } from "@testing-library/react";
import { userEvent } from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  findRowActions,
  renderApp,
  serverAnswers,
  wholeText,
} from "./test-support.tsx";
import {
  session,
  viewer,
  sites,
  roles,
  old,
  listsAnswer,
  site,
  role,
  avery,
  blake,
  order,
  peopleAnswer,
  savedAs,
  focusCell,
  pick,
  draftOf,
  manySites,
  openAt,
  shownNames,
  header,
  choose,
  address,
} from "./test-people-page.tsx";

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("filtering", () => {
  it("filters by draft from the bar above the table, keeping the filter in the address", async () => {
    const { history } = await openAt("/people", {
      "GET /api/people": () =>
        Response.json({
          people: [
            {
              ...avery,
              draft: draftOf({ action: "changed", changed: ["f1"] }),
            },
            blake,
            {
              ...blake,
              id: "p3",
              keyNumber: 1,
              preferredName: "Casey Fictional",
              employeeId: "E3",
              positionId: "position-1",
              draft: draftOf({ action: "deleted", state: "rejected" }),
            },
          ],
          fields: [site, role],
          order,
        }),
    });
    const names = () =>
      shownNames().map((name) => name.replace(/,? (Draft|Rejected).*/, ""));
    const button = screen.getByRole("button", {
      name: "Draft: Drafts & Live",
    });
    await userEvent.click(button);
    const item = async (name: string) =>
      screen.findByRole("menuitem", {
        name: (shown) => shown.startsWith(name),
      });
    expect(
      (await screen.findAllByRole("menuitem")).map((one) =>
        one.textContent.replace("✓", ""),
      ),
    ).toEqual([
      "Drafts & Live, on",
      "Drafts applied",
      "Live only",
      "Waiting",
      "Rejected",
      "No draft",
    ]);
    await userEvent.click(await item("Waiting"));
    expect(names()).toEqual(["Avery Fictional"]);
    await userEvent.click(await item("No draft"));
    expect(names()).toEqual(["Avery Fictional", "Blake Fictional"]);
    await userEvent.keyboard("{Escape}");
    await waitFor(() => {
      expect(document.activeElement).toBe(button);
    });
    expect(screen.getByText("Draft: Waiting, No draft")).toBeDefined();
    expect(address(history)).toContain(
      'filters={"draft":{"any":["waiting"],"empty":true}}',
    );
    await userEvent.click(
      screen.getByRole("button", { name: "Remove filter on Draft" }),
    );
    expect(names()).toEqual([
      "Avery Fictional",
      "Blake Fictional",
      "Casey Fictional",
    ]);
    history.push('/people?filters={"draft":{"any":["rejected"]}}');
    await waitFor(() => {
      expect(names()).toEqual(["Casey Fictional"]);
    });
    expect(
      screen.getByRole("button", { name: "Draft: Drafts & Live, filtered" }),
    ).toBeDefined();
    // Drafts are filtered on, but neither searched, since their states are not shown in words, nor
    // sorted on, even from a hand-made address.
    history.push('/people?search=waiting&sort=["draft"]');
    await waitFor(() => {
      expect(screen.getByText("0 of 3").getAttribute("role")).toBe("status");
    });
    expect(screen.queryByText("Draft ↑")).toBeNull();
    expect(
      screen.getByRole("button", { name: "Draft: Drafts & Live" }),
    ).toBeDefined();
  });

  it("shows choices by their live names in live rows and the live people alone", async () => {
    const renamed = {
      ...sites,
      choices: sites.choices.map((one) =>
        (one as { id: string }).id === "c1"
          ? {
              ...one,
              label: "Harbour Drafted",
              draft: {
                action: "changed",
                changed: ["label"],
                live: { label: "Harbour" },
                state: "waiting",
                madeBy: "Fictional Editor",
                madeAt: "2026-10-30T15:00:00.000Z",
              },
            }
          : one,
      ),
    };
    const { history } = await openAt("/people", {
      "GET /api/lists": () => Response.json({ lists: [renamed, roles, old] }),
    });
    expect(screen.getAllByText("Harbour Drafted").length).toBeGreaterThan(0);
    history.push("/people?show=live");
    await waitFor(() => {
      expect(screen.queryByText("Harbour Drafted")).toBeNull();
    });
    expect(screen.getAllByText("Harbour").length).toBeGreaterThan(0);
  });

  it("shows drafts beside live rows, drafts applied, or the live people alone, read only", async () => {
    const { history } = await openAt("/people", {
      "GET /api/people": () =>
        Response.json({
          people: [
            {
              ...avery,
              preferredName: "Avery Drafted",
              draft: draftOf({
                action: "changed",
                changed: ["preferredName"],
                live: { preferredName: "Avery Fictional", values: {} },
              }),
            },
            {
              ...blake,
              id: "p3",
              keyNumber: 1,
              preferredName: "Casey Fictional",
              employeeId: "E3",
              positionId: "position-1",
              draft: draftOf({ action: "created" }),
            },
          ],
          fields: [site, role],
          order,
        }),
    });
    const liveRows = () =>
      document.querySelectorAll("tr[aria-hidden='true']").length;
    await screen.findByText("Avery Drafted");
    expect(liveRows()).toBe(1);
    const choose = async (name: string) => {
      await userEvent.click(screen.getByRole("button", { name: /^Draft/ }));
      await userEvent.click(
        within(await screen.findByRole("menu", { name: /^Draft/ })).getByRole(
          "menuitem",
          { name: (shown) => shown.startsWith(name) },
        ),
      );
      await userEvent.keyboard("{Escape}");
    };
    await choose("Drafts applied");
    await waitFor(() => {
      expect(liveRows()).toBe(0);
    });
    expect(screen.getByText("Avery Drafted")).toBeDefined();
    expect(address(history)).toContain("show=drafts");
    await choose("Live only");
    await waitFor(() => {
      expect(screen.queryByText("Avery Drafted")).toBeNull();
    });
    expect(screen.getByText("Avery Fictional")).toBeDefined();
    expect(screen.queryByText("Casey Fictional")).toBeNull();
    expect(screen.queryByRole("button", { name: "New person" })).toBeNull();
    // The live people have no drafts, so a filter on drafts in the address is set aside.
    history.push('/people?show=live&filters={"draft":{"any":["waiting"]}}');
    await waitFor(() => {
      expect(screen.getByText("Avery Fictional")).toBeDefined();
    });
  });

  it("says in a draft's menu what it changes and who changed each field, and closes when its details are clicked", async () => {
    await openAt("/people", {
      "GET /api/people": () =>
        Response.json({
          people: [
            {
              ...avery,
              preferredName: "Avery Drafted",
              employeeId: "E9",
              positionId: "position-1",
              draft: draftOf({
                action: "changed",
                changed: ["preferredName", "employeeId", "f1"],
                live: {
                  preferredName: "Avery Fictional",
                  employeeId: "E1",
                  positionId: "position-1",
                  values: {},
                },
                changedBy: { preferredName: "Ann Fictional", employeeId: null },
              }),
            },
          ],
          fields: [site, role],
          order,
        }),
    });
    await userEvent.click(await findRowActions("Avery Drafted"));
    const line = await screen.findByText(
      wholeText("Name from Avery Fictional to Avery Drafted, by Ann Fictional"),
    );
    expect(
      screen.getByText(wholeText("ID from E1 to E9, by Fathom")),
    ).toBeDefined();
    await userEvent.click(line);
    await waitFor(() => {
      expect(screen.queryByRole("menu")).toBeNull();
    });
  });

  it.each([
    ["offers no decision on", true],
    ["offers a decision on", false],
  ] as const)(
    "%s a draft holding details the approver can't see, as the server marks it",
    async (_offers, holdsUnseen) => {
      await openAt("/people", {
        "GET /api/session": session(["people:view", "people:approve"]),
        "GET /api/people": () =>
          Response.json({
            people: [
              {
                ...avery,
                preferredName: "Avery Drafted",
                draft: draftOf({
                  action: "changed",
                  changed: ["preferredName"],
                  live: { preferredName: "Avery Fictional", values: {} },
                  ...(holdsUnseen ? { holdsUnseen: true } : {}),
                }),
              },
            ],
            fields: [site, role],
            order,
          }),
      });
      await userEvent.click(await findRowActions("Avery Drafted"));
      const menu = await screen.findByRole("menu");
      expect(
        within(menu).queryByRole("menuitem", { name: /^Approve/u }) === null,
      ).toBe(holdsUnseen);
    },
  );

  it("turns draft filters off again from the Draft menu", async () => {
    const { history } = await openAt("/people");
    await userEvent.click(
      screen.getByRole("button", { name: "Draft: Drafts & Live" }),
    );
    const item = async (name: string) =>
      screen.findByRole("menuitem", {
        name: (shown) => shown.startsWith(name),
      });
    await userEvent.click(await item("No draft"));
    await userEvent.click(await item("Waiting"));
    await userEvent.click(await item("Waiting"));
    await userEvent.click(await item("No draft"));
    await waitFor(() => {
      expect(address(history)).not.toContain("filters");
    });
  });

  it("narrows a long list of choices by typing", async () => {
    await openAt("/people", {
      "GET /api/lists": () => Response.json({ lists: [manySites, roles] }),
    });
    await choose("Site", "Filter…");
    const dialog = await screen.findByRole("dialog", { name: "Filter Site" });
    const narrow = within(dialog).getByRole("textbox", {
      name: "Narrow Site choices",
    });
    await userEvent.type(narrow, "dun");
    expect(within(dialog).getAllByRole("checkbox")).toHaveLength(3);
    await userEvent.click(
      within(dialog).getByRole("button", { name: "Clear" }),
    );
    expect(within(dialog).getAllByRole("checkbox")).toHaveLength(11);
  });

  it("filters text", async () => {
    const { history } = await openAt("/people");
    await choose("Name", "Filter…");
    const name = await screen.findByRole("dialog", { name: "Filter Name" });
    await userEvent.type(
      within(name).getByRole("textbox", { name: "Contains" }),
      "blake",
    );
    await userEvent.click(
      within(name).getByRole("checkbox", { name: "Empty" }),
    );
    expect(screen.getByText("Name: contains “blake” or Empty")).toBeDefined();
    await userEvent.click(
      within(name).getByRole("checkbox", { name: "Empty" }),
    );
    await userEvent.clear(
      within(name).getByRole("textbox", { name: "Contains" }),
    );
    expect(history.location.search).toBe("");
    await userEvent.type(
      within(name).getByRole("textbox", { name: "Contains" }),
      "blake",
    );
    await userEvent.keyboard("{Escape}");
    expect(shownNames()).toEqual(["Blake Fictional"]);
  });

  it("filters to the values that aren't empty, unticking Empty, and names it", async () => {
    // Given the Start filter showing only people with no start date
    await openAt("/people");
    await choose("Start", "Filter…");
    const start = await screen.findByRole("dialog", { name: "Filter Start" });
    await userEvent.click(
      within(start).getByRole("checkbox", { name: "No date" }),
    );

    // When Any date is ticked
    await userEvent.click(
      within(start).getByRole("checkbox", { name: "Any date" }),
    );

    // Then No date is unticked, and the pill names Any date alone
    expect(
      within(start).getByRole<HTMLInputElement>("checkbox", {
        name: "No date",
      }).checked,
    ).toBe(false);
    expect(screen.getByText("Start: Any date")).toBeDefined();
  });

  it("offers no Not empty on a checkbox column, which is never empty", async () => {
    await openAt("/people");

    await choose("Manager?", "Filter…");

    const dialog = await screen.findByRole("dialog", {
      name: "Filter Manager?",
    });
    expect(within(dialog).getByRole("checkbox", { name: "No" })).toBeDefined();
    expect(
      within(dialog).queryByRole("checkbox", { name: "Not empty" }),
    ).toBeNull();
  });

  it("filters dates, and clears everything at once", async () => {
    await openAt('/people?filters={"preferredName":{"contains":"blake"}}');
    await choose("Start", "Filter…");
    const start = await screen.findByRole("dialog", { name: "Filter Start" });
    const from = within(start).getByRole("textbox", { name: "From" });
    const to = within(start).getByRole("textbox", { name: "To" });
    // A date still being typed is not yet wrong, and filters nothing.
    await userEvent.type(from, "2024-01");
    expect(within(start).queryByText("Invalid YYYY-MM-DD date")).toBeNull();
    expect(screen.queryByText(/^Start: from /)).toBeNull();
    await userEvent.type(from, "-01");
    expect(screen.getByText(/^Start: from /)).toBeDefined();
    await userEvent.type(to, "2024-12-31");
    expect(screen.getByText(/^Start: .+ to .+2024$/)).toBeDefined();
    await userEvent.clear(to);
    await userEvent.type(to, "2023-12-31");
    expect(within(start).getByText("Before From")).toBeDefined();
    await userEvent.clear(from);
    expect(screen.getByText(/^Start: until /)).toBeDefined();
    await userEvent.clear(to);
    await userEvent.click(
      within(start).getByRole("checkbox", { name: "No date" }),
    );
    expect(screen.getByText("Start: No date")).toBeDefined();
    expect(shownNames()).toEqual(["Blake Fictional"]);
    await userEvent.keyboard("{Escape}");

    await userEvent.click(screen.getByRole("button", { name: "Clear all" }));
    expect(shownNames()).toEqual(["Avery Fictional", "Blake Fictional"]);
  });

  it("keeps an edited row in place until the view changes", async () => {
    let answer = peopleAnswer;
    await openAt('/people?filters={"f1":{"any":["c1"]}}', {
      "GET /api/people": () => answer(),
      "PATCH /api/people/p1": () => {
        answer = () =>
          Response.json({
            people: [{ ...avery, values: { f1: ["c2"] } }, blake],
            fields: [site, role],
            order,
          });
        return savedAs()();
      },
    });
    expect(shownNames()).toEqual(["Avery Fictional"]);
    focusCell("p1", "f1");
    await userEvent.keyboard("{Enter}");
    await pick("Northmere");
    expect(shownNames()).toEqual(["Avery Fictional"]);
    await choose("Name", "Sort A to Z");
    expect(shownNames()).toEqual([]);
    await userEvent.click(screen.getByRole("button", { name: "Clear all" }));
    expect(shownNames()).toEqual(["Avery Fictional", "Blake Fictional"]);
  });

  it("lets viewers sort and filter, ignoring columns they may not see", async () => {
    serverAnswers({
      "GET /api/session": viewer,
      "GET /api/people": () =>
        Response.json({
          people: [
            {
              ...avery,
              startDate: undefined,
              endDate: undefined,
              values: { f1: ["c1"] },
            },
            { ...blake, startDate: undefined, endDate: undefined },
          ],
          fields: [site],
          order,
        }),
      "GET /api/lists": listsAnswer,
    });
    const history = renderApp(
      '/people?filters={"f2":{"any":["r1"]},"startDate":{"empty":true}}&sort=["-startDate"]',
    );
    await screen.findByRole("grid", { name: "People" });
    expect(shownNames()).toEqual(["Avery Fictional", "Blake Fictional"]);
    expect(screen.queryByText("Clear all")).toBeNull();
    await userEvent.click(header("Name"));
    const sort = await screen.findByRole("menuitem", { name: "Sort Z to A" });
    expect(screen.queryByRole("menuitem", { name: "Edit column…" })).toBeNull();
    expect(screen.getByRole("menuitem", { name: /^Move left/ })).toBeDefined();
    await userEvent.click(sort);
    expect(shownNames()).toEqual(["Blake Fictional", "Avery Fictional"]);
    // Changing the view leaves out what the viewer may not see.
    expect(decodeURIComponent(history.location.search)).toBe(
      '?sort=["-preferredName"]',
    );
    act(() => {
      header("Name").focus();
    });
    await userEvent.keyboard("{Alt>}{ArrowRight}{/Alt}");
    await userEvent.type(
      screen.getByRole("textbox", { name: "Search people" }),
      "nobody",
    );
    expect(screen.getByText("No matching people").closest("td")?.colSpan).toBe(
      10,
    );
    expect(
      within(screen.getByRole("grid"))
        .getAllByRole("columnheader")
        .map((th) => th.textContent),
    ).toEqual([
      "ID",
      "Name",
      "Position",
      "Site",
      "Manager",
      "Team",
      "Team name",
      "Manager?",
      "Expected",
      "Actions",
    ]);
  });
});
