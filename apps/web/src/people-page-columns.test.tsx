// SPDX-License-Identifier: Apache-2.0

// Tests of the People table's columns: adding, changing, moving and deleting them.

import {
  act,
  fireEvent,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import { userEvent } from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { bodyOf, chooseIn, optionsIn } from "./test-support.tsx";
import {
  s1,
  session,
  list,
  sites,
  role,
  savedAs,
  refused,
  openPeople,
  undone,
  settle,
} from "./test-people-page.tsx";

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("columns", () => {
  async function newColumnDialog() {
    await userEvent.click(screen.getByRole("button", { name: "New column" }));
    return screen.findByRole("dialog", { name: "New column" });
  }

  it("adds a column drawing on a list, and undoes it", async () => {
    const fetch = await openPeople({
      "POST /api/people/columns": () =>
        Response.json(
          {
            field: { ...role, id: "f3", name: "Office", listId: "l1" },
            changeSetId: s1,
          },
          { status: 201 },
        ),
    });
    const dialog = await newColumnDialog();
    await userEvent.type(within(dialog).getByLabelText("Name"), "Office");
    expect(await optionsIn(dialog, "List")).toEqual([
      "Sites",
      "Roles on the team (Personal)",
      "Positions",
    ]);
    await userEvent.click(screen.getByRole("option", { name: "Sites" }));
    await userEvent.click(within(dialog).getByLabelText("Several choices"));
    await userEvent.click(within(dialog).getByLabelText("Must be filled in"));
    await userEvent.click(within(dialog).getByLabelText("Must be filled in"));
    expect(
      within(dialog).getByText("Planned hires can leave it empty"),
    ).toBeDefined();
    const onHires = within(dialog).getByLabelText("Offered on planned hires");
    expect((onHires as HTMLInputElement).checked).toBe(true);
    await userEvent.click(onHires);
    expect(within(dialog).queryByText("Planned hires can leave it empty")).toBe(
      null,
    );
    await userEvent.click(
      within(dialog).getByRole("button", { name: "Add column" }),
    );
    expect(bodyOf(fetch, "POST", "/api/people/columns")).toEqual([
      {
        name: "Office",
        type: "choice",
        listId: "l1",
        multiple: true,
        required: false,
        onPlannedHires: false,
      },
    ]);
    await settle();
    await userEvent.keyboard("{Meta>}z{/Meta}");
    await waitFor(() => {
      expect(undone(fetch)).toEqual([s1]);
    });
  });

  it("offers lists drafted to be added, marked new, and not those drafted to be removed", async () => {
    const draft = (action: string) => ({
      state: "waiting",
      madeBy: "Fictional Editor",
      madeAt: "2026-10-30T15:00:00.000Z",
      action,
      changed: [],
      live: {},
    });
    await openPeople({
      "GET /api/lists": () =>
        Response.json({
          lists: [
            { ...sites, draft: draft("changed") },
            { ...list("l4", "Guilds", []), draft: draft("created") },
            {
              ...list("l5", "Chapters", []),
              visibility: "confidential",
              draft: draft("created"),
            },
            { ...list("l6", "Gone", []), draft: draft("deleted") },
          ],
        }),
    });
    const dialog = await newColumnDialog();
    expect(await optionsIn(dialog, "List")).toEqual([
      "Sites",
      "Guilds (new)",
      "Chapters (new, Confidential)",
    ]);
  });

  it("says what is wrong with a new column, and shows the server's refusals", async () => {
    let answer = refused(409, "There is already a column with that name");
    const fetch = await openPeople({
      "POST /api/people/columns": () => answer(),
    });
    const dialog = await newColumnDialog();
    await userEvent.click(
      within(dialog).getByRole("button", { name: "Add column" }),
    );
    expect(within(dialog).getByText("Name needed")).toBeDefined();
    expect(within(dialog).getByText("List needed")).toBeDefined();
    await userEvent.type(within(dialog).getByLabelText("Name"), "site");
    expect(
      within(dialog).getByText("Another column has that name"),
    ).toBeDefined();
    await userEvent.clear(within(dialog).getByLabelText("Name"));
    await userEvent.type(within(dialog).getByLabelText("Name"), "Desk");
    await chooseIn(dialog, "List", "Sites");
    await userEvent.click(
      within(dialog).getByRole("button", { name: "Add column" }),
    );
    expect(
      await within(dialog).findByText("Another column has that name"),
    ).toBeDefined();
    // A name the server says is taken must change before trying again.
    await userEvent.type(within(dialog).getByLabelText("Name"), "s");
    answer = refused(
      409,
      "1 person has no Desks, so it cannot be required yet",
    );
    await userEvent.click(
      within(dialog).getByRole("button", { name: "Add column" }),
    );
    expect(
      await within(dialog).findByText(
        "1 person has no Desks, so it cannot be required yet",
      ),
    ).toBeDefined();
    expect(bodyOf(fetch, "POST", "/api/people/columns")).toHaveLength(2);
    await userEvent.click(
      within(dialog).getByRole("button", { name: "Cancel" }),
    );
  });

  it("opens the Type list on Enter, rather than adding the column", async () => {
    await openPeople();
    const dialog = await newColumnDialog();
    act(() => {
      within(dialog).getByLabelText("Type").focus();
    });

    await userEvent.keyboard("{Enter}");

    expect(
      (await screen.findAllByRole("option")).map(
        ({ textContent }) => textContent,
      ),
    ).toContain("Number");
    expect(within(dialog).queryByText("List needed")).toBeNull();
  });

  it("opens the List list on Enter, rather than adding the column", async () => {
    await openPeople();
    const dialog = await newColumnDialog();
    act(() => {
      within(dialog).getByLabelText("List").focus();
    });

    await userEvent.keyboard("{Enter}");

    expect(
      (await screen.findAllByRole("option")).map(
        ({ textContent }) => textContent,
      ),
    ).toContain("Sites");
    expect(within(dialog).queryByText("List needed")).toBeNull();
  });

  it("closes the column dialog with Esc", async () => {
    await openPeople();
    await userEvent.click(screen.getByRole("button", { name: "New column" }));
    await screen.findByRole("dialog", { name: "New column" });
    await userEvent.keyboard("{Escape}");
    await waitFor(() => {
      expect(screen.queryByRole("dialog")).toBeNull();
    });
  });

  it("marks each classified column's heading with its class, and moves a choice column only with its list", async () => {
    await openPeople({
      "GET /api/session": session([
        "configuration:edit",
        "configuration:view",
        "people:view",
        "plan:view",
        "features:view",
        "personal:view",
        "data:classify",
      ]),
    });
    expect(
      screen.getByRole("button", { name: "Start column, Personal" }),
    ).toBeTruthy();
    expect(
      screen.getByRole("button", { name: "End column, Personal" }),
    ).toBeTruthy();
    expect(screen.getByRole("button", { name: "Name column" })).toBeTruthy();
    await userEvent.click(
      screen.getByRole("button", { name: "Role on team column, Personal" }),
    );
    expect(
      (
        await screen.findByRole("menuitem", { name: "Change class…" })
      ).hasAttribute("data-disabled"),
    ).toBe(true);
    expect(screen.getByText("This column takes its list's class")).toBeTruthy();
  });

  it("changes a column from its header's menu, and deletes it with Undo", async () => {
    const fetch = await openPeople({
      "PUT /api/people/columns/f2": () =>
        Response.json({ field: { ...role, name: "Roles" }, changeSetId: s1 }),
      "DELETE /api/people/columns/f2": savedAs(),
    });
    await userEvent.click(
      screen.getByRole("button", { name: "Role on team column, Personal" }),
    );
    await userEvent.click(
      await screen.findByRole("menuitem", { name: "Edit column…" }),
    );
    let dialog = await screen.findByRole("dialog", { name: "Edit column" });
    const name = within(dialog).getByLabelText("Name");
    await userEvent.clear(name);
    await userEvent.type(name, "Roles");
    await userEvent.click(within(dialog).getByRole("button", { name: "Save" }));
    expect(bodyOf(fetch, "PUT", "/api/people/columns/f2")).toEqual([
      {
        name: "Roles",
        type: "choice",
        listId: "l2",
        multiple: true,
        required: false,
        onPlannedHires: true,
      },
    ]);
    // The simulated server still answers with the old name once the change has saved.
    await userEvent.click(
      await screen.findByRole("button", {
        name: "Role on team column, Personal",
      }),
    );
    await userEvent.click(
      within(
        await screen.findByRole("menu", { name: /^Role on team column/ }),
      ).getByRole("menuitem", { name: "Edit column…" }),
    );
    dialog = await screen.findByRole("dialog", { name: "Edit column" });
    await userEvent.click(
      within(dialog).getByRole("button", { name: "Remove column" }),
    );
    expect(
      await screen.findByText("Removed the Role on team column."),
    ).toBeDefined();
    await userEvent.click(screen.getByRole("button", { name: "Undo" }));
    await waitFor(() => {
      expect(undone(fetch)).toEqual([s1]);
    });
  });

  it("moves any column from its menu, with Alt and the arrow keys, and by dragging, but not past either end", async () => {
    await openPeople();
    // A classified column's name ends with its class.
    const header = (label: string) =>
      screen.getByRole("button", {
        name: (name) =>
          name === `${label} column` || name === `${label} column, Personal`,
      });
    const labels = () =>
      screen
        .getAllByRole("button", { name: / column(, Personal)?$/ })
        .map((button) => button.getAttribute("aria-label"));
    const place = (label: string) =>
      labels().findIndex((name) => name?.startsWith(`${label} column`));

    // Given the Role on team column somewhere after the first
    const rolePlace = place("Role on team");
    await userEvent.click(header("Role on team"));
    await userEvent.click(
      await screen.findByRole("menuitem", { name: /^Move left/ }),
    );
    await waitFor(() => {
      expect(place("Role on team")).toBe(rolePlace - 1);
      expect(screen.queryByRole("menu")).toBeNull();
    });

    // Built-in columns move too, to the very start, and no further.
    const start = place("Name");
    await settle();
    act(() => {
      header("ID").focus();
    });
    await userEvent.keyboard("{Alt>}{ArrowLeft}{/Alt}");
    await waitFor(() => {
      expect(place("ID")).toBe(start);
    });
    await settle();
    act(() => {
      header("ID").focus();
    });
    await userEvent.keyboard("{Alt>}{ArrowLeft}{/Alt}");
    expect(place("ID")).toBe(start);

    // A column at the end stays there.
    const last = String(labels().at(-1)).replace(/ column$/, "");
    const before = labels();
    await userEvent.click(header(last));
    await userEvent.click(
      within(await screen.findByRole("menu")).getByRole("menuitem", {
        name: /^Move right/,
      }),
    );
    expect(labels()).toEqual(before);

    // Dragging onto itself or without starting moves nothing, and onto another moves it.
    const th = (label: string) => header(label).closest("th") as HTMLElement;
    fireEvent.drop(th("Role on team"));
    fireEvent.dragStart(th("Site"));
    fireEvent.drop(th("Site"));
    expect(labels()).toEqual(before);
    fireEvent.dragStart(th("Site"));
    fireEvent.dragOver(th("Role on team"));
    fireEvent.drop(th("Role on team"));
    await waitFor(() => {
      expect(labels()).not.toEqual(before);
    });
  });
});
