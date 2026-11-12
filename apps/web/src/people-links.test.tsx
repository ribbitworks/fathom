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

async function openPeople(answers: Answers = {}) {
  const fetch = serverAnswers({
    "GET /api/session": editor,
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
    const fetch = await openPeople({
      "POST /api/people/columns": () =>
        Response.json(
          { field: { ...profile, id: "f2", name: "Reviews" }, changeSetId: s1 },
          { status: 201 },
        ),
    });
    await userEvent.click(screen.getByRole("button", { name: "New column" }));
    const dialog = await screen.findByRole("dialog", { name: "New column" });
    await userEvent.type(within(dialog).getByLabelText("Name"), "Reviews");
    await userEvent.selectOptions(
      within(dialog).getByRole("combobox", { name: "Type" }),
      "Web link",
    );
    expect(within(dialog).queryByRole("combobox", { name: "List" })).toBeNull();
    expect(within(dialog).queryByLabelText("Several choices")).toBeNull();
    fireEvent.click(within(dialog).getByText("Confidential"));
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
