// SPDX-License-Identifier: Apache-2.0

// Tests of searching the People table, freezing and sorting its columns, and a column's filter.

import {
  act,
  fireEvent,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import { userEvent } from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  s1,
  site,
  role,
  avery,
  blake,
  order,
  peopleAnswer,
  cell,
  focusCell,
  openAt,
  shownNames,
  header,
  choose,
  viewsButton,
  viewsMenuItems,
  viewsMenuLayout,
  chooseView,
  address,
} from "./test-people-page.tsx";

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("searching and sorting", () => {
  it("searches every column from the search field, which Cmd+F focuses and Esc clears", async () => {
    const { history } = await openAt("/people");
    focusCell("p1", "employeeId");
    await userEvent.keyboard("{Control>}f{/Control}");
    const search = screen.getByRole("textbox", { name: "Search people" });
    expect(document.activeElement).toBe(search);
    await userEvent.keyboard("northmere");
    expect(shownNames()).toEqual([]);
    expect(screen.getByText("No matching people")).toBeDefined();
    await userEvent.clear(search);
    await userEvent.type(search, "team lead");
    expect(shownNames()).toEqual(["Avery Fictional"]);
    expect(screen.getByText("1 of 2")).toBeDefined();
    expect(history.location.search).toBe("?search=team+lead");
    await userEvent.keyboard("{Escape}");
    expect(shownNames()).toEqual(["Avery Fictional", "Blake Fictional"]);
    expect(history.location.search).toBe("");
    await userEvent.keyboard("{Escape}");
    expect(document.activeElement).toBe(cell("p1", "employeeId"));
    await userEvent.keyboard("{Control>}{Alt>}f{/Alt}{/Control}");
    await userEvent.keyboard("{Meta>}f{/Meta}");
    expect(document.activeElement).toBe(cell("p1", "employeeId"));
  });

  it("clears the search with its clear button, which Back undoes, leaving the field focused", async () => {
    const { history } = await openAt("/people");
    const search = screen.getByRole("textbox", { name: "Search people" });
    expect(screen.queryByRole("button", { name: "Clear search" })).toBeNull();
    await userEvent.type(search, "team lead");
    expect(shownNames()).toEqual(["Avery Fictional"]);
    await userEvent.click(screen.getByRole("button", { name: "Clear search" }));
    expect(shownNames()).toEqual(["Avery Fictional", "Blake Fictional"]);
    expect(history.location.search).toBe("");
    expect(document.activeElement).toBe(search);
    expect(screen.queryByRole("button", { name: "Clear search" })).toBeNull();
    history.back();
    await waitFor(() => {
      expect(history.location.search).toBe("?search=team+lead");
    });
    expect((search as HTMLInputElement).value).toBe("team lead");
    await userEvent.click(search);
    await userEvent.tab();
    expect(document.activeElement).toBe(
      screen.getByRole("button", { name: "Clear search" }),
    );
    await userEvent.keyboard("{Enter}");
    expect((search as HTMLInputElement).value).toBe("");
    expect(document.activeElement).toBe(search);
  });

  it("takes Cmd+F on a Mac, and leaves it alone in a dialog", async () => {
    const agent = vi
      .spyOn(navigator, "userAgent", "get")
      .mockReturnValue("Mozilla/5.0 (Macintosh)");
    await openAt("/people");
    const search = screen.getByRole("textbox", { name: "Search people" });
    focusCell("p1", "employeeId");
    await userEvent.keyboard("{Control>}f{/Control}");
    expect(document.activeElement).toBe(cell("p1", "employeeId"));
    await userEvent.click(screen.getByRole("button", { name: "New column" }));
    const dialog = await screen.findByRole("dialog");
    await userEvent.keyboard("{Meta>}f{/Meta}");
    expect(dialog.contains(document.activeElement)).toBe(true);
    // The test's browser types Cmd+F's "f" into the dialog's field, so leaving asks first.
    await userEvent.keyboard("{Escape}");
    await userEvent.click(
      within(
        await screen.findByRole("dialog", { name: "Discard the new column?" }),
      ).getByRole("button", { name: "Discard" }),
    );
    await waitFor(() => {
      expect(screen.queryByRole("dialog")).toBeNull();
    });
    await userEvent.keyboard("{Meta>}f{/Meta}");
    expect(document.activeElement).toBe(search);
    agent.mockRestore();
  });

  it("keeps every character typed quickly, and Back undoes a whole search", async () => {
    const { history } = await openAt('/people?sort=["f1"]');
    const search = screen.getByRole("textbox", { name: "Search people" });
    act(() => {
      search.focus();
    });
    fireEvent.change(search, { target: { value: "a" } });
    fireEvent.change(search, { target: { value: "av" } });
    fireEvent.change(search, { target: { value: "ave" } });
    await waitFor(() => {
      expect(history.location.search).toContain("search=ave");
    });
    expect(search).toHaveProperty("value", "ave");
    await waitFor(() => {
      expect(shownNames()).toEqual(["Avery Fictional"]);
    });
    history.back();
    await waitFor(() => {
      expect(search).toHaveProperty("value", "");
    });
    expect(history.location.search).toContain("sort=");
    // Typing again after Back adds to history rather than replacing where Back went.
    await userEvent.type(search, "b");
    history.back();
    await waitFor(() => {
      expect(search).toHaveProperty("value", "");
    });
    expect(history.location.search).toContain("sort=");
  });

  it("keeps people the user adds, even when they do not match", async () => {
    let answer = peopleAnswer;
    await openAt('/people?filters={"f1":{"any":["c1"]}}', {
      "GET /api/people": () => answer(),
      "POST /api/people": () => {
        answer = () =>
          Response.json({
            people: [
              avery,
              blake,
              {
                ...blake,
                id: "p9",
                keyNumber: 1,
                preferredName: "Casey Fictional",
                employeeId: "E9",
                positionId: "position-1",
                values: { f1: ["c2"] },
              },
            ],
            fields: [site, role],
            order,
          });
        return Response.json({ ids: ["p9"], changeSetId: s1 }, { status: 201 });
      },
    });
    act(() => {
      cell("new-0", "preferredName").focus();
    });
    await userEvent.keyboard("Casey{Tab}E9{Tab}eng{Tab}north{Tab}");
    await userEvent.keyboard("{Escape}{Enter}");
    await waitFor(() => {
      expect(shownNames()).toEqual(["Avery Fictional", "Casey Fictional"]);
    });
  });

  it("freezes the columns up to one chosen, naming them in the Views menu until reset", async () => {
    const { history } = await openAt("/people");
    const frozen = (label: string) =>
      header(label).closest("th")?.style.left !== "";
    const [first] = screen
      .getAllByRole("columnheader")
      .map((cell) => cell.textContent);
    expect(frozen(String(first))).toBe(true);
    expect(frozen("Site")).toBe(false);

    await choose("Site", "Freeze up to this column");
    expect(frozen("Site")).toBe(true);
    expect(address(history)).toMatch(/frozen=\d/);
    expect(screen.queryByText("Frozen to Site")).toBeNull();
    expect(await viewsMenuLayout()).toEqual([
      "Frozen to Site, reset",
      "—",
      "Hidden",
      "Key, show",
      "—",
      "Clear view",
      "Save view…",
    ]);
    await userEvent.keyboard("{Escape}");
    await userEvent.click(header("Site"));
    const unfreeze = await screen.findByRole("menuitem", {
      name: "Unfreeze columns",
    });
    expect(
      screen.queryByRole("menuitem", { name: "Freeze up to this column" }),
    ).toBeNull();
    await userEvent.click(unfreeze);
    expect(address(history)).toContain("frozen=0");
    expect(frozen(String(first))).toBe(false);
    expect(await viewsMenuItems()).toContain("Unfrozen, reset");
    await userEvent.keyboard("{Escape}");

    await chooseView("Unfrozen, reset");
    expect(history.location.search).toBe("");
    expect(frozen(String(first))).toBe(true);

    await choose("Site", "Freeze up to this column");
    await userEvent.click(screen.getByRole("button", { name: "Clear all" }));
    expect(history.location.search).toBe("");
  });

  it("sorts by each column chosen in turn, naming each level in the Views menu", async () => {
    const { history } = await openAt("/people");
    await choose("Site", "List order");
    expect(shownNames()).toEqual(["Avery Fictional", "Blake Fictional"]);
    await choose("Name", "Sort Z to A");
    expect(shownNames()).toEqual(["Avery Fictional", "Blake Fictional"]);
    expect(
      screen.getByRole("button", {
        name: "Name column, sorted descending, level 2",
      }),
    ).toBeDefined();
    expect(header("Site").closest("th")?.getAttribute("aria-sort")).toBe(
      "ascending",
    );
    expect(header("Name").closest("th")?.getAttribute("aria-sort")).toBeNull();

    // Choosing a sort on a sorted column changes its direction in place.
    await choose("Site", "Reverse list order");
    expect(shownNames()).toEqual(["Blake Fictional", "Avery Fictional"]);
    expect(address(history)).toContain('sort=["-f1","-preferredName"]');
    expect(screen.queryByText(/Site ↓/)).toBeNull();
    await choose("Site", "Freeze up to this column");
    expect(await viewsMenuLayout()).toEqual([
      "Sort",
      "Site ↓descending, remove sort",
      "Name ↓descending, remove sort",
      "—",
      "Frozen to Site, reset",
      "—",
      "Hidden",
      "Key, show",
      "—",
      "Clear view",
      "Save view…",
    ]);
    await userEvent.keyboard("{Escape}");

    // From the keyboard too.
    viewsButton().focus();
    await userEvent.keyboard("{Enter}");
    const menu = await screen.findByRole("menu", { name: /^Views/ });
    await userEvent.keyboard("{ArrowDown}");
    await waitFor(() => {
      expect(
        within(menu).getByRole("menuitem", {
          name: "Site descending, remove sort",
        }),
      ).toBe(document.activeElement);
    });
    await userEvent.keyboard("{Enter}");
    expect(address(history)).toContain('sort=["-preferredName"]');
    expect(
      screen.getByRole("button", { name: "Name column, sorted descending" }),
    ).toBeDefined();

    await choose("Start", "Oldest first");
    await choose("Start", "Clear sort");
    expect(address(history)).not.toContain("startDate");
    history.back();
    await waitFor(() => {
      expect(address(history)).toContain("startDate");
    });
    await userEvent.click(screen.getByRole("button", { name: "Clear all" }));
    expect(history.location.search).toBe("");
  });

  it("filters a choice column, naming the filter above the table until it is removed", async () => {
    const { history } = await openAt("/people");
    await choose("Site", "Filter…");
    const dialog = await screen.findByRole("dialog", { name: "Filter Site" });
    expect(
      within(dialog)
        .getAllByRole("checkbox")
        .map((box) => (box as HTMLInputElement).labels?.[0]?.textContent),
    ).toEqual(["Harbour", "Northmere", "Empty", "Not empty", "Old Mill"]);
    await userEvent.click(
      within(dialog).getByRole("checkbox", { name: "Northmere" }),
    );
    await userEvent.click(
      within(dialog).getByRole("checkbox", { name: "Harbour" }),
    );
    expect(shownNames()).toEqual(["Avery Fictional"]);
    await userEvent.click(
      within(dialog).getByRole("checkbox", { name: "Northmere" }),
    );
    await userEvent.keyboard("{Escape}");
    expect(screen.getByText("Site: Harbour")).toBeDefined();
    await choose("Site", "Clear filter");
    expect(shownNames()).toEqual(["Avery Fictional", "Blake Fictional"]);
    history.back();
    await waitFor(() => {
      expect(screen.getByText("Site: Harbour")).toBeDefined();
    });
    expect(
      screen.getByRole("button", { name: "Site column, filtered" }),
    ).toBeDefined();
    expect(address(history)).toContain('filters={"f1":{"any":["c1"]}}');
    history.back();
    await waitFor(() => {
      expect(shownNames()).toEqual(["Avery Fictional", "Blake Fictional"]);
    });
    history.forward();
    await waitFor(() => {
      expect(shownNames()).toEqual(["Avery Fictional"]);
    });
    await choose("Site", "Filter…");
    const again = await screen.findByRole("dialog", { name: "Filter Site" });
    await userEvent.click(
      within(again).getByRole("checkbox", { name: "Empty" }),
    );
    expect(screen.getByText("Site: Harbour, Empty")).toBeDefined();
    await userEvent.click(
      within(again).getByRole("checkbox", { name: "Empty" }),
    );
    await userEvent.click(
      within(again).getByRole("checkbox", { name: "Harbour" }),
    );
    expect(shownNames()).toEqual(["Avery Fictional", "Blake Fictional"]);
    await userEvent.click(
      within(again).getByRole("checkbox", { name: "Old Mill" }),
    );
    await userEvent.keyboard("{Escape}");
    await userEvent.click(
      screen.getByRole("button", { name: "Remove filter on Site" }),
    );
    expect(shownNames()).toEqual(["Avery Fictional", "Blake Fictional"]);
    expect(screen.queryByText("Clear all")).toBeNull();
  });
});
