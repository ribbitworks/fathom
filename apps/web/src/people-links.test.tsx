// SPDX-License-Identifier: Apache-2.0

// Tests for web link columns on the People page, with the server's responses simulated: a link in
// its cell and in its person's menu, editing and clearing it, pasting addresses into new rows, a
// drafted link beside its live one, and adding a web link column with its visibility. The link
// components alone are tested in link-field.test.tsx.

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
  bodyOf,
  chooseIn,
  fictionalUser,
  renderApp,
  serverAnswers,
} from "./test-support.tsx";

const s1 = "00000000-0000-4000-8000-000000000001";

const editor = () =>
  Response.json({
    ...fictionalUser,
    permissions: [
      "configuration:edit",
      "configuration:view",
      "people:edit",
      "people:view",
      "plan:view",
      "features:view",
    ],
  });

const profile = {
  id: "f1",
  name: "Profile",
  type: "link",
  listId: null,
  visibility: "general",
  multiple: false,
  required: false,
};
const page = {
  address: "https://wiki.example.test/avery",
  text: "Avery's page",
};
const avery = {
  id: "p1",
  preferredName: "Avery Fictional",
  employeeId: "E1",
  positionId: "position-1",
  values: {},
  links: { f1: page },
};
const blake = {
  id: "p2",
  preferredName: "Blake Fictional",
  employeeId: "E2",
  positionId: "position-1",
  values: {},
  links: {},
};
const peopleAnswer =
  (people: object[] = [avery, blake]) =>
  () =>
    Response.json({
      people,
      fields: [profile],
      order: ["preferredName", "employeeId", "f1"],
      views: [],
    });
const saved = () => Response.json({ changeSetId: s1 });
// The built-in Positions list, with the one position everyone here has.
const positions = {
  id: "positions",
  name: "Positions",
  description: "",
  visibility: "general",
  retired: false,
  builtIn: "positions",
  choices: [
    {
      id: "position-1",
      label: "Fictional Engineer",
      description: "",
      retired: false,
    },
  ],
};

afterEach(() => {
  vi.unstubAllGlobals();
});

type Answers = Parameters<typeof serverAnswers>[0];

// An editor who may give a new column a class beyond General.
const classifier = () =>
  Response.json({
    ...fictionalUser,
    permissions: [
      "configuration:edit",
      "configuration:view",
      "people:edit",
      "people:view",
      "plan:view",
      "features:view",
      "confidential:view",
      "data:classify",
    ],
  });

async function openPeople(answers: Answers = {}, session = editor) {
  const fetch = serverAnswers({
    "GET /api/session": session,
    "GET /api/people": peopleAnswer(),
    "GET /api/lists": () => Response.json({ lists: [positions] }),
    ...answers,
  });
  renderApp("/people");
  await screen.findByRole("grid", { name: "People" });
  return fetch;
}

const cell = (row: string) =>
  document.getElementById(`cell-${row}-f1`) as HTMLElement;

const newCell = () =>
  document.querySelector('[id^="cell-new-"][id$="-f1"]') as HTMLElement;

async function editCell(row: string) {
  act(() => {
    cell(row).focus();
  });
  await userEvent.keyboard("{Enter}");
  return screen.findByRole("form", { name: "Profile" });
}

describe("a web link column", () => {
  it("shows each link by its text, opening its address in a new tab", async () => {
    await openPeople();
    const link = within(cell("p1")).getByRole("link", { name: "Avery's page" });
    expect(link.getAttribute("href")).toBe(page.address);
    expect(link.getAttribute("rel")).toBe("noopener noreferrer");
  });

  it("offers opening the link from its person's menu", async () => {
    await openPeople();
    act(() => {
      cell("p1").focus();
    });
    await userEvent.keyboard("{Shift>}{F10}{/Shift}");
    const item = await screen.findByRole("menuitem", { name: "Open Profile" });
    expect(item.getAttribute("href")).toBe(page.address);
  });

  it("saves a link edited in its cell", async () => {
    const fetch = await openPeople({ "PATCH /api/people/p2": saved });
    const form = await editCell("p2");
    await userEvent.type(
      within(form).getByRole("textbox", { name: "Address" }),
      "wiki.example.test/blake{Enter}",
    );
    expect(bodyOf(fetch, "PATCH", "/api/people/p2")).toEqual([
      {
        links: {
          f1: { address: "https://wiki.example.test/blake", text: "" },
        },
      },
    ]);
  });

  it("starts the address with what is typed on a link's cell", async () => {
    await openPeople();
    act(() => {
      cell("p2").focus();
    });
    await userEvent.keyboard("w");
    const form = await screen.findByRole("form", { name: "Profile" });
    const address: HTMLInputElement = within(form).getByRole("textbox", {
      name: "Address",
    });
    expect(address.value).toBe("w");
  });

  it("names a required web link column still empty in a new row", async () => {
    await openPeople({
      "GET /api/people": () =>
        Response.json({
          people: [avery],
          fields: [{ ...profile, required: true }],
          order: ["preferredName", "employeeId", "f1"],
          views: [],
        }),
    });
    const name = document.querySelector(
      '[id^="cell-new-"][id$="-preferredName"]',
    ) as HTMLElement;
    act(() => {
      name.focus();
    });
    await userEvent.keyboard("Casey{Tab}E9{Tab}");
    await waitFor(() => {
      expect(name.textContent).toBe(
        "Casey, New, not saved yet: Profile, Position needed",
      );
    });
  });

  it("cancels editing a link with Esc, saving nothing", async () => {
    const fetch = await openPeople();
    const form = await editCell("p1");
    await userEvent.type(
      within(form).getByRole("textbox", { name: "Address" }),
      "x{Escape}",
    );
    await waitFor(() => {
      expect(screen.queryByRole("form", { name: "Profile" })).toBeNull();
    });
    expect(bodyOf(fetch, "PATCH", "/api/people/p1")).toEqual([]);
  });

  it("clears a link with Delete", async () => {
    const fetch = await openPeople({ "PATCH /api/people/p1": saved });
    act(() => {
      cell("p1").focus();
    });
    await userEvent.keyboard("{Delete}");
    expect(bodyOf(fetch, "PATCH", "/api/people/p1")).toEqual([
      { links: { f1: null } },
    ]);
  });

  it("adds people with the addresses pasted into new rows", async () => {
    const fetch = await openPeople({
      "POST /api/people": () =>
        Response.json({ ids: ["p3"], changeSetId: s1 }, { status: 201 }),
    });
    const name = document.querySelector(
      '[id^="cell-new-"][id$="-preferredName"]',
    ) as HTMLElement;
    act(() => {
      name.focus();
    });
    await userEvent.paste(
      "Casey Fictional\tE3\thttp://wiki/casey\tFictional Engineer\nDrew Fictional\tE4\t\tFictional Engineer\n",
    );
    expect(bodyOf(fetch, "POST", "/api/people")).toEqual([
      {
        people: [
          {
            preferredName: "Casey Fictional",
            employeeId: "E3",
            positionId: "position-1",
            values: {},
            links: { f1: { address: "http://wiki/casey", text: "" } },
          },
          {
            preferredName: "Drew Fictional",
            employeeId: "E4",
            positionId: "position-1",
            values: {},
            links: {},
          },
        ],
      },
    ]);
  });

  it("refuses pasting something other than a web address", async () => {
    const fetch = await openPeople();
    const name = document.querySelector(
      '[id^="cell-new-"][id$="-preferredName"]',
    ) as HTMLElement;
    act(() => {
      name.focus();
    });
    await userEvent.paste("Casey Fictional\tE3\tjavascript:alert(1)\n");
    expect(
      await screen.findByText(
        "Profile: javascript:alert(1) is not a web address",
      ),
    ).toBeDefined();
    expect(bodyOf(fetch, "POST", "/api/people")).toEqual([]);
    expect(newCell()).toBeDefined();
  });

  it("names a drafted link's live link to assistive technology", async () => {
    await openPeople({
      "GET /api/people": peopleAnswer([
        {
          ...avery,
          links: { f1: { address: "https://example.test/", text: "" } },
          draft: {
            action: "changed",
            changed: ["f1"],
            live: { values: {}, links: { f1: page } },
            state: "waiting",
            madeBy: null,
            madeAt: null,
          },
        },
      ]),
    });
    expect(cell("p1").textContent).toContain(", draft, live Avery's page");
  });

  it.each([
    ["added", undefined, page, `Profile set to Avery's page (${page.address})`],
    [
      "removed",
      page,
      undefined,
      `Profile cleared, from Avery's page (${page.address})`,
    ],
  ])(
    "puts a link drafted to be %s in words in its person's menu",
    async (_name, live, drafted, words) => {
      await openPeople({
        "GET /api/people": peopleAnswer([
          {
            ...avery,
            links: drafted === undefined ? {} : { f1: drafted },
            draft: {
              action: "changed",
              changed: ["f1"],
              live: {
                values: {},
                links: live === undefined ? {} : { f1: live },
              },
              state: "waiting",
              madeBy: null,
              madeAt: null,
            },
          },
        ]),
      });
      act(() => {
        cell("p1").focus();
      });
      await userEvent.keyboard("{Shift>}{F10}{/Shift}");
      const menu = await screen.findByRole("menu");
      expect(menu.textContent).toContain(words);
    },
  );

  it("shows the live link again once its draft is discarded", async () => {
    let discarded = false;
    const drafted = {
      ...avery,
      links: { f1: { address: "https://example.test/", text: "" } },
      draft: {
        action: "changed",
        changed: ["f1"],
        live: { values: {}, links: { f1: page } },
        state: "waiting",
        madeBy: null,
        madeAt: null,
      },
    };
    await openPeople({
      "GET /api/people": () =>
        peopleAnswer([discarded ? avery : drafted, blake])(),
      "DELETE /api/people/p1/draft": () => {
        discarded = true;
        return saved();
      },
    });
    act(() => {
      cell("p1").focus();
    });
    await userEvent.keyboard("{Shift>}{F10}{/Shift}");
    await userEvent.click(
      await screen.findByRole("menuitem", { name: "Discard draft" }),
    );
    expect(
      await within(cell("p1")).findByRole("link", { name: "Avery's page" }),
    ).toBeDefined();
  });

  it("is added from the column dialog with its own visibility, and no list", async () => {
    const fetch = await openPeople(
      {
        "POST /api/people/columns": () =>
          Response.json(
            {
              field: { ...profile, id: "f2", name: "Reviews" },
              changeSetId: s1,
            },
            { status: 201 },
          ),
      },
      classifier,
    );
    await userEvent.click(screen.getByRole("button", { name: "New column" }));
    const dialog = await screen.findByRole("dialog", { name: "New column" });
    await userEvent.type(within(dialog).getByLabelText("Name"), "Reviews");
    await chooseIn(dialog, "Type", "Web link");
    expect(within(dialog).queryByLabelText("List")).toBeNull();
    expect(within(dialog).queryByLabelText("Several choices")).toBeNull();
    fireEvent.click(
      within(dialog).getByRole("radio", { name: /^Confidential/ }),
    );
    await userEvent.click(
      within(dialog).getByRole("button", { name: "Add column" }),
    );
    await waitFor(() => {
      expect(bodyOf(fetch, "POST", "/api/people/columns")).toEqual([
        {
          name: "Reviews",
          type: "link",
          visibility: "confidential",
          multiple: false,
          required: false,
          onPlannedHires: true,
        },
      ]);
    });
  });

  it("moves like any other column", async () => {
    await openPeople();
    const place = () =>
      screen
        .getAllByRole("button", { name: / column$/ })
        .map((button) => button.getAttribute("aria-label"))
        .indexOf("Profile column");
    const before = place();
    await userEvent.click(
      await screen.findByRole("button", { name: "Profile column" }),
    );
    await userEvent.click(
      await screen.findByRole("menuitem", { name: /Move left/ }),
    );
    await waitFor(() => {
      expect(place()).toBe(before - 1);
    });
  });

  it("changes class at once from its menu, which then marks its heading", async () => {
    let moved = false;
    const fetch = await openPeople(
      {
        "GET /api/people": () =>
          Response.json({
            people: [avery, blake],
            fields: [
              { ...profile, visibility: moved ? "confidential" : "general" },
              { ...profile, id: "f2", name: "Portfolio" },
            ],
            order: ["preferredName", "employeeId", "f1", "f2"],
            views: [],
          }),
        "PUT /api/columns/f1/class": () => {
          moved = true;
          return saved();
        },
      },
      classifier,
    );
    // An approved column's class is moved, not changed in a draft.
    await userEvent.click(
      await screen.findByRole("button", { name: "Profile column" }),
    );
    await userEvent.click(
      await screen.findByRole("menuitem", { name: "Edit column" }),
    );
    const edit = await screen.findByRole("dialog", { name: "Edit column" });
    expect(within(edit).queryByRole("radio")).toBe(null);
    await userEvent.click(within(edit).getByRole("button", { name: "Cancel" }));
    await userEvent.click(
      await screen.findByRole("button", { name: "Profile column" }),
    );
    await userEvent.click(
      await screen.findByRole("menuitem", { name: "Change class…" }),
    );
    const dialog = await screen.findByRole("dialog", {
      name: "Change the class of Profile",
    });
    expect(
      within(dialog).getByRole<HTMLInputElement>("radio", {
        name: /^Personal/,
      }).disabled,
    ).toBe(true);
    await userEvent.click(
      within(dialog).getByRole("radio", { name: /^Confidential/ }),
    );
    await userEvent.click(
      within(dialog).getByRole("button", { name: "Change" }),
    );
    expect(bodyOf(fetch, "PUT", "/api/columns/f1/class")).toEqual([
      { dataClass: "confidential" },
    ]);
    const heading = await screen.findByRole("button", {
      name: "Profile column, Confidential",
    });
    expect(within(heading).getByText(", Confidential")).toBeTruthy();
    const symbol = heading.querySelector("[class*='classSymbol']");
    expect(symbol?.querySelector("svg")).not.toBeNull();
    await userEvent.hover(symbol as HTMLElement);
    expect((await screen.findByRole("tooltip")).textContent).toBe(
      "Confidential",
    );
  });

  it("offers no change of class to a role without Classify data, nor a class for a new column", async () => {
    await openPeople();
    await userEvent.click(
      await screen.findByRole("button", { name: "Profile column" }),
    );
    await screen.findByRole("menuitem", { name: "Edit column" });
    expect(screen.queryByRole("menuitem", { name: "Change class…" })).toBe(
      null,
    );
    await userEvent.keyboard("{Escape}");
    await userEvent.click(screen.getByRole("button", { name: "New column" }));
    const dialog = await screen.findByRole("dialog", { name: "New column" });
    await chooseIn(dialog, "Type", "Web link");
    expect(within(dialog).queryByRole("radio")).toBe(null);
  });

  it("offers no change of class for a column drafted to be removed", async () => {
    await openPeople(
      {
        "GET /api/people": () =>
          Response.json({
            people: [avery, blake],
            fields: [
              {
                ...profile,
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
            order: ["preferredName", "employeeId", "f1"],
            views: [],
          }),
      },
      classifier,
    );
    await userEvent.click(
      await screen.findByRole("button", { name: /^Profile column/ }),
    );
    await screen.findByRole("menuitem", { name: /Wider/ });
    expect(screen.queryByRole("menuitem", { name: "Change class…" })).toBe(
      null,
    );
  });

  it("turns off changing the class of a column someone else is changing", async () => {
    await openPeople(
      {
        "GET /api/people": () =>
          Response.json({
            people: [avery, blake],
            fields: [{ ...profile, heldBy: "Fictional Editor" }],
            order: ["preferredName", "employeeId", "f1"],
            views: [],
          }),
      },
      classifier,
    );
    await userEvent.click(
      await screen.findByRole("button", { name: /^Profile column/ }),
    );
    expect(
      (
        await screen.findByRole("menuitem", { name: "Change class…" })
      ).hasAttribute("data-disabled"),
    ).toBe(true);
  });

  it("gives a column only drafted to be added its class in its dialog, not from its menu", async () => {
    const added = {
      ...profile,
      draft: {
        action: "created",
        changed: [],
        live: {},
        state: "waiting",
        madeBy: "Fictional Editor",
        madeAt: "2026-11-01T10:00:00.000Z",
      },
    };
    await openPeople(
      {
        "GET /api/people": () =>
          Response.json({
            people: [avery, blake],
            fields: [added],
            order: ["preferredName", "employeeId", "f1"],
            views: [],
          }),
      },
      classifier,
    );
    await userEvent.click(
      await screen.findByRole("button", { name: /^Profile column/ }),
    );
    await screen.findByRole("menuitem", { name: "Edit column" });
    expect(screen.queryByRole("menuitem", { name: "Change class…" })).toBe(
      null,
    );
    await userEvent.click(
      screen.getByRole("menuitem", { name: "Edit column" }),
    );
    const dialog = await screen.findByRole("dialog", { name: "Edit column" });
    expect(
      within(dialog).getByRole<HTMLInputElement>("radio", {
        name: /^General/,
      }).checked,
    ).toBe(true);
  });

  it("keeps its type once added", async () => {
    await openPeople();
    await userEvent.click(
      await screen.findByRole("button", { name: "Profile column" }),
    );
    await userEvent.click(
      await screen.findByRole("menuitem", { name: "Edit column" }),
    );
    const dialog = await screen.findByRole("dialog");
    expect(
      within(dialog).getByRole("combobox", { name: /Type/ }),
    ).toHaveProperty("disabled", true);
  });
});
