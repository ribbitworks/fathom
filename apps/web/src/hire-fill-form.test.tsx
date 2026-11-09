// SPDX-License-Identifier: Apache-2.0

// Tests for filling a planned hire in its details panel on People, with the server's responses
// simulated: the form for a new or an existing person, what it sends, what it asks for, and how a
// fill waiting for approval shows.

import { act, screen, waitFor, within } from "@testing-library/react";
import { userEvent } from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { fictionalUser, renderApp, serverAnswers } from "./test-support.tsx";

const person = (id: string, name: string, details: object = {}) => ({
  id,
  preferredName: name,
  employeeId: `E${id}`,
  positionId: "engineer",
  startDate: "2020-01-01",
  endDate: null,
  isManager: false,
  manager: null,
  values: {},
  links: {},
  ...details,
});
const robin = person("m1", "Robin Fictional", { isManager: true });
const riley = person("m2", "Riley Fictional", { isManager: true });
const sasha = person("p1", "Sasha Fictional", { positionId: "tester" });
const hire = (details: object = {}) =>
  person("h1", "Fictional Hire", {
    kind: "planned-hire",
    employeeId: "TBD-1",
    stateId: "open",
    startDate: "2030-03-01",
    expected: "2030-03",
    manager: { id: "m1", preferredName: "Robin Fictional" },
    ...details,
  });
const builtIn = (id: string, choices: object[]) => ({
  id,
  name: id,
  description: "",
  visibility: "general",
  retired: false,
  builtIn: id,
  choices,
});
const choice = (id: string, label: string, meaning?: string) => ({
  id,
  label,
  description: "",
  retired: false,
  ...(meaning === undefined ? {} : { meaning }),
});
const grade = {
  id: "grade",
  name: "Grade",
  type: "choice",
  listId: "grades",
  visibility: "general",
  multiple: false,
  required: true,
  onPlannedHires: true,
};
const grades = {
  ...builtIn("grades", [choice("p1", "P1")]),
  builtIn: null,
};

function answers(
  people: object[],
  options: {
    fields?: object[];
    positionHidden?: boolean;
    fill?: () => Response;
    permissions?: string[];
  } = {},
) {
  return serverAnswers({
    "GET /api/session": () =>
      Response.json({
        ...fictionalUser,
        permissions: options.permissions ?? [
          "people:view",
          "people:edit",
          "hiring-plan:view",
          "hiring-plan:edit",
          "restricted:view",
          "plan:view",
        ],
      }),
    "GET /api/people": () =>
      Response.json({
        people,
        fields: options.fields ?? [],
        order: [],
        views: [],
        ...(options.positionHidden === true ? { positionHidden: true } : {}),
      }),
    "GET /api/lists": () =>
      Response.json({
        lists: [
          builtIn("positions", [
            choice("engineer", "Fictional Engineer"),
            choice("tester", "Fictional Tester"),
          ]),
          builtIn("hiring-states", [
            choice("open", "Approved to hire", "open"),
            choice("proposed", "Request to hire", "proposed"),
          ]),
          grades,
        ],
      }),
    "GET /api/unpublished": () => Response.json({ changes: [] }),
    "POST /api/planned-hires/h1/fill":
      options.fill ?? (() => Response.json({ changeSetId: null })),
  });
}

type Fetch = ReturnType<typeof answers>;

async function sent(fetch: Fetch): Promise<unknown> {
  await waitFor(() => {
    expect(fetch.mock.calls.some(([, init]) => init?.method === "POST")).toBe(
      true,
    );
  });
  const [, init] = fetch.mock.calls.find(
    ([, init]) => init?.method === "POST",
  ) as [string, RequestInit];
  return JSON.parse(init.body as string);
}

async function openForm() {
  await userEvent.click(
    await screen.findByRole("button", { name: "Fill Fictional Hire" }),
  );
  await screen.findByRole("heading", { name: "Fill this planned hire" });
}

const fillNow = () =>
  userEvent.click(
    within(
      screen
        .getByRole("heading", { name: "Fill this planned hire" })
        .closest("section") as HTMLElement,
    ).getByRole("button", { name: "Fill" }),
  );

const type = (label: string, text: string) =>
  userEvent.type(screen.getByRole("textbox", { name: label }), text);

const row = (label: string) =>
  screen.getByText(label, { selector: "dt" }).parentElement as HTMLElement;

async function pick(label: string, name: RegExp | string) {
  await userEvent.click(
    screen.getByRole("button", { name: `Change ${label}` }),
  );
  await userEvent.click(await screen.findByRole("option", { name }));
}

const useExisting = () =>
  userEvent.click(screen.getByRole("radio", { name: "Existing person" }));

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("filling a planned hire with a new person", () => {
  it("begins with the hire's start date, position and manager, and sends what is typed", async () => {
    const fetch = answers([robin, hire()]);
    renderApp("/people");
    await openForm();

    expect(
      screen.getByRole<HTMLInputElement>("textbox", { name: "Start" }).value,
    ).toBe("2030-03-01");
    expect(row("Position").textContent).toContain("Fictional Engineer");
    expect(row("Manager").textContent).toContain("Robin Fictional");
    await type("Name", " Fictional Starter ");
    await type("ID", "E9");
    await userEvent.tab();
    await fillNow();

    expect(await sent(fetch)).toEqual({
      by: "new person",
      preferredName: "Fictional Starter",
      employeeId: "E9",
      startDate: "2030-03-01",
      values: {},
      links: {},
    });
  });

  it("keeps what is typed while a note is written", async () => {
    const fetch = answers([robin, hire()], {
      fields: [
        {
          id: "background",
          name: "Background",
          type: "note",
          listId: null,
          visibility: "general",
          multiple: false,
          required: true,
          onPlannedHires: false,
        },
      ],
    });
    renderApp("/people");
    await openForm();
    await userEvent.click(
      screen.getByRole("button", { name: "Change Background" }),
    );
    const opened = await screen.findByRole("region", {
      name: /^Background for/u,
    });
    await userEvent.click(within(opened).getByText("Markdown"));
    await userEvent.type(
      within(opened).getByRole("textbox", { name: "Markdown" }),
      "Words",
    );
    await type("Name", "Fictional Starter");
    await type("ID", "E9");
    await userEvent.tab();
    await userEvent.click(within(opened).getByRole("button", { name: "Save" }));
    await waitFor(() => {
      expect(
        screen.queryByRole("region", { name: /^Background for/u }),
      ).toBeNull();
    });

    await fillNow();

    expect(await sent(fetch)).toMatchObject({
      preferredName: "Fictional Starter",
      employeeId: "E9",
      notes: { background: "Words" },
    });
  });

  it("asks before Fill discards a note being changed", async () => {
    const fetch = answers([robin, hire()], {
      fields: [
        {
          id: "background",
          name: "Background",
          type: "note",
          listId: null,
          visibility: "general",
          multiple: false,
          required: true,
          onPlannedHires: false,
        },
      ],
    });
    renderApp("/people");
    await openForm();
    await type("Name", "Fictional Starter");
    await type("ID", "E9");
    await userEvent.click(
      screen.getByRole("button", { name: "Change Background" }),
    );
    const opened = await screen.findByRole("region", {
      name: /^Background for/u,
    });
    await userEvent.click(within(opened).getByText("Markdown"));
    await userEvent.type(
      within(opened).getByRole("textbox", { name: "Markdown" }),
      "Words",
    );
    await userEvent.click(within(opened).getByRole("button", { name: "Save" }));
    await userEvent.click(
      await screen.findByRole("button", { name: "Change Background" }),
    );
    const again = await screen.findByRole("region", {
      name: /^Background for/u,
    });
    await userEvent.click(within(again).getByText("Markdown"));
    await userEvent.type(
      within(again).getByRole("textbox", { name: "Markdown" }),
      " more",
    );
    await userEvent.click(
      within(
        screen
          .getByRole("heading", { name: "Fill this planned hire" })
          .closest("section") as HTMLElement,
      ).getByRole("button", { name: "Fill" }),
    );
    expect(
      await screen.findByText("Discard the note you're writing?"),
    ).toBeTruthy();
    await userEvent.click(screen.getByRole("button", { name: "Keep writing" }));
    expect(fetch.mock.calls.some(([, init]) => init?.method === "POST")).toBe(
      false,
    );
  });

  it("fills nothing while a web link it cannot keep is still being entered", async () => {
    const fetch = answers([robin, hire()], {
      fields: [
        {
          id: "site",
          name: "Site",
          type: "link",
          listId: null,
          visibility: "general",
          multiple: false,
          required: true,
          onPlannedHires: false,
        },
      ],
    });
    renderApp("/people");
    await openForm();
    await type("Name", "Fictional Starter");
    await type("ID", "E9");
    await userEvent.click(screen.getByRole("button", { name: "Change Site" }));
    await userEvent.type(
      await screen.findByRole("textbox", { name: "Address" }),
      "not an address",
    );
    await fillNow();
    expect(fetch.mock.calls.some(([, init]) => init?.method === "POST")).toBe(
      false,
    );
  });

  it("sends no start date when the hire has none", async () => {
    const fetch = answers([robin, hire({ startDate: null })]);
    renderApp("/people");
    await openForm();
    await type("Name", "Fictional Starter");
    await type("ID", "E9");
    await userEvent.tab();

    await fillNow();

    expect(await sent(fetch)).toMatchObject({ startDate: null });
  });

  it("leaves out the start date and position for those who may not see them", async () => {
    const fetch = answers([robin, hire()], {
      positionHidden: true,
      permissions: [
        "people:view",
        "people:edit",
        "hiring-plan:view",
        "hiring-plan:edit",
        "plan:view",
      ],
    });
    renderApp("/people");
    await openForm();
    expect(screen.queryByRole("textbox", { name: "Start" })).toBeNull();
    expect(screen.queryByText("Position", { selector: "dt" })).toBeNull();
    await type("Name", "Fictional Starter");
    await type("ID", "E9");
    await userEvent.tab();

    await fillNow();

    expect(await sent(fetch)).toMatchObject({ startDate: null });
  });

  it("names what is missing and sends nothing", async () => {
    const fetch = answers([robin, hire()]);
    renderApp("/people");
    await openForm();

    await fillNow();

    expect(await screen.findByText("Name needed")).toBeDefined();
    expect(screen.getByText("ID needed")).toBeDefined();
    expect(fetch.mock.calls.some(([, init]) => init?.method === "POST")).toBe(
      false,
    );
  });

  it("refuses an ID someone already has", async () => {
    answers([robin, hire()]);
    renderApp("/people");
    await openForm();
    await type("Name", "Fictional Starter");
    await type("ID", "Em1");
    await userEvent.tab();

    expect(
      await screen.findByText("Someone already has that ID"),
    ).toBeDefined();
  });

  it("sends another manager when one is chosen", async () => {
    const fetch = answers([robin, riley, hire()]);
    renderApp("/people");
    await openForm();
    await type("Name", "Fictional Starter");
    await type("ID", "E9");
    await userEvent.tab();
    await pick("Manager", "Riley Fictional");

    await fillNow();

    expect(await sent(fetch)).toMatchObject({ managerId: "m2" });
  });

  it("asks for what People requires and the hire has no value for, and sends it", async () => {
    const fetch = answers([robin, hire()], { fields: [grade] });
    renderApp("/people");
    await openForm();
    await type("Name", "Fictional Starter");
    await type("ID", "E9");
    await userEvent.tab();
    await fillNow();
    expect(await screen.findByText("Grade needed")).toBeDefined();

    await pick("Grade", "P1");
    await fillNow();

    expect(await sent(fetch)).toMatchObject({ values: { grade: ["p1"] } });
  });

  it("does not ask for a required value the hire already has", async () => {
    answers([robin, hire({ values: { grade: ["p1"] } })], { fields: [grade] });
    renderApp("/people");
    await openForm();

    expect(screen.queryByRole("button", { name: "Change Grade" })).toBeNull();
  });

  it("needs a manager chosen for a hire under a planned manager", async () => {
    const planned = person("h2", "Fictional Lead", {
      kind: "planned-hire",
      employeeId: "TBD-2",
      stateId: "proposed",
      isManager: true,
    });
    answers([
      robin,
      planned,
      hire({ manager: { id: "h2", preferredName: "Fictional Lead" } }),
    ]);
    renderApp("/people");
    await openForm();
    expect(row("Manager").textContent).toContain("No manager");

    await fillNow();

    expect(await screen.findByText("Manager needed")).toBeDefined();
  });

  it("shows who a planned manager's planned hires are", async () => {
    const report = person("h3", "Fictional Report", {
      kind: "planned-hire",
      employeeId: "TBD-3",
      stateId: "proposed",
      manager: { id: "h1", preferredName: "Fictional Hire" },
    });
    answers([robin, hire({ isManager: true }), report]);
    renderApp("/people");
    await openForm();

    expect(row("Direct reports").textContent).toContain("Fictional Report");
  });

  it("keeps the form and what was entered when the server refuses", async () => {
    answers([robin, hire()], {
      fill: () =>
        Response.json({ error: "Fictional refusal" }, { status: 409 }),
    });
    renderApp("/people");
    await openForm();
    await type("Name", "Fictional Starter");
    await type("ID", "E9");
    await userEvent.tab();

    await fillNow();

    expect(await screen.findByText("Fictional refusal")).toBeDefined();
    expect(
      screen.getByRole<HTMLInputElement>("textbox", { name: "Name" }).value,
    ).toBe("Fictional Starter");
  });
});

describe("filling a planned hire with someone already in Fathom", () => {
  it("lists who can fill it, with their ID and position", async () => {
    answers([robin, sasha, hire()]);
    renderApp("/people");
    await openForm();
    await useExisting();

    await userEvent.click(
      screen.getByRole("button", { name: "Change Person" }),
    );

    expect(
      await screen.findByRole("option", {
        name: "Sasha Fictional (Ep1), Fictional Tester",
      }),
    ).toBeDefined();
    expect(screen.queryByRole("option", { name: /Robin/ })).toBeNull();
  });

  it("needs someone chosen", async () => {
    answers([robin, sasha, hire()]);
    renderApp("/people");
    await openForm();
    await useExisting();

    await fillNow();

    expect(await screen.findByText("Person needed")).toBeDefined();
  });

  it("sends who was chosen, and the day given when they would move", async () => {
    const fetch = answers([robin, sasha, hire()]);
    renderApp("/people");
    await openForm();
    await useExisting();
    await pick("Person", /Sasha/);
    expect(row("Position").textContent).toContain("Fictional Engineer");
    await userEvent.clear(
      screen.getByRole("textbox", { name: "Manager since" }),
    );
    await type("Manager since", "2026-01-05");
    await userEvent.tab();

    await fillNow();

    expect(await sent(fetch)).toEqual({
      by: "existing person",
      personId: "p1",
      managerFrom: "2026-01-05",
    });
  });

  it("asks for no day when they already report to the manager", async () => {
    answers([
      robin,
      person("p2", "Sam Fictional", {
        manager: { id: "m1", preferredName: "Robin Fictional" },
      }),
      hire(),
    ]);
    renderApp("/people");
    await openForm();
    await useExisting();

    await pick("Person", /Sam/);

    expect(screen.queryByRole("textbox", { name: "Manager since" })).toBeNull();
  });

  it("keeps their manager when a hire under a planned manager has none chosen", async () => {
    const planned = person("h2", "Fictional Lead", {
      kind: "planned-hire",
      employeeId: "TBD-2",
      stateId: "proposed",
      isManager: true,
    });
    const fetch = answers([
      robin,
      sasha,
      planned,
      hire({ manager: { id: "h2", preferredName: "Fictional Lead" } }),
    ]);
    renderApp("/people");
    await openForm();
    await useExisting();
    await pick("Person", /Sasha/);
    expect(row("Manager").textContent).toContain("Keeps their manager");

    await fillNow();

    expect(await sent(fetch)).toMatchObject({
      by: "existing person",
      managerId: null,
    });
  });
});

describe("leaving the form", () => {
  it("asks first when something has been entered, and closes when told to", async () => {
    answers([robin, hire()]);
    renderApp("/people");
    await openForm();
    await type("Name", "Fictional Starter");
    await userEvent.tab();

    await userEvent.click(screen.getByRole("button", { name: "Cancel" }));
    expect(
      await screen.findByRole("dialog", {
        name: "Stop filling this planned hire?",
      }),
    ).toBeDefined();
    await userEvent.click(screen.getByRole("button", { name: "Discard" }));

    await waitFor(() => {
      expect(
        screen.queryByRole("heading", { name: "Fill this planned hire" }),
      ).toBeNull();
    });
  });

  const showRobin = async () =>
    userEvent.click(
      await screen.findByRole("button", {
        name: "Show details of Robin Fictional",
      }),
    );

  it("asks first before showing someone else when something has been entered", async () => {
    answers([robin, hire()]);
    renderApp("/people");
    await openForm();
    await type("Name", "Fictional Starter");
    await userEvent.tab();

    await showRobin();

    expect(
      await screen.findByRole("dialog", {
        name: "Stop filling this planned hire?",
      }),
    ).toBeDefined();
  });

  it("shows someone else at once with nothing entered", async () => {
    answers([robin, hire()]);
    renderApp("/people");
    await openForm();

    await showRobin();

    expect(
      await screen.findByRole("region", { name: "Robin Fictional" }),
    ).toBeDefined();
  });

  it("closes at once with nothing entered", async () => {
    answers([robin, hire()]);
    renderApp("/people");
    await openForm();

    await userEvent.click(screen.getByRole("button", { name: "Cancel" }));

    await waitFor(() => {
      expect(
        screen.queryByRole("heading", { name: "Fill this planned hire" }),
      ).toBeNull();
    });
  });
});

describe("going back while filling", () => {
  it("leaves the form when another record is shown", async () => {
    answers([robin, hire()]);
    const history = renderApp("/people?open=Em1");
    await screen.findByRole("region", { name: "Robin Fictional" });
    await openForm();

    act(() => {
      history.back();
    });

    await screen.findByRole("region", { name: "Robin Fictional" });
    expect(
      screen.queryByRole("heading", { name: "Fill this planned hire" }),
    ).toBeNull();
  });
});

describe("a planned hire's details", () => {
  it("offer Fill when it can be filled", async () => {
    answers([robin, hire()]);
    renderApp("/people?open=TBD-1");
    await screen.findByRole("region", { name: "Fictional Hire" });

    await userEvent.click(
      within(screen.getByRole("region", { name: "Fictional Hire" })).getByRole(
        "button",
        { name: "Fill" },
      ),
    );

    expect(
      await screen.findByRole("heading", { name: "Fill this planned hire" }),
    ).toBeDefined();
  });

  it("offer no Fill to those who may not change planned hires", async () => {
    answers([robin, hire()], {
      permissions: [
        "people:view",
        "people:edit",
        "hiring-plan:view",
        "restricted:view",
        "plan:view",
      ],
    });
    renderApp("/people?open=TBD-1");
    const panel = await screen.findByRole("region", { name: "Fictional Hire" });

    expect(within(panel).queryByRole("button", { name: "Fill" })).toBeNull();
  });

  it("name who is filling it, with links to them", async () => {
    answers([
      robin,
      person("n1", "Fictional Starter", { employeeId: "E9" }),
      hire({ filler: "n1" }),
    ]);
    renderApp("/people?open=TBD-1");
    const panel = await screen.findByRole("region", { name: "Fictional Hire" });
    expect(
      within(panel).getByRole("heading", { name: "Filled by" }),
    ).toBeDefined();
    expect(within(panel).getByRole("button", { name: "E9" })).toBeDefined();

    await userEvent.click(
      within(panel).getByRole("button", { name: "Fictional Starter" }),
    );

    expect(
      await screen.findByRole("region", { name: "Fictional Starter" }),
    ).toBeDefined();
  });

  it("say only that it is filled to those who may not know by whom", async () => {
    answers([robin, hire({ filler: null })]);
    renderApp("/people?open=TBD-1");
    const panel = await screen.findByRole("region", { name: "Fictional Hire" });

    expect(
      within(panel).getByRole("heading", { name: "Filled by" }),
    ).toBeDefined();
    expect(within(panel).queryByRole("button", { name: "Fill" })).toBeNull();
  });
});

describe("after filling", () => {
  it("shows the new person once People has them", async () => {
    let filled = false;
    const added = person("n1", "Fictional Starter", { employeeId: "E9" });
    const fetch = serverAnswers({});
    fetch.mockImplementation((url: string, init?: RequestInit) => {
      const respond = (body: object) => Promise.resolve(Response.json(body));
      if (url === "/api/session") {
        return respond({
          ...fictionalUser,
          permissions: [
            "people:view",
            "people:edit",
            "hiring-plan:view",
            "hiring-plan:edit",
            "restricted:view",
            "plan:view",
          ],
        });
      }
      if (url === "/api/people") {
        return respond({
          people: filled
            ? [robin, hire({ filler: "n1" }), added]
            : [robin, hire()],
          fields: [],
          order: [],
          views: [],
        });
      }
      if (url === "/api/lists") {
        return respond({
          lists: [
            builtIn("positions", [choice("engineer", "Fictional Engineer")]),
            builtIn("hiring-states", [
              choice("open", "Approved to hire", "open"),
            ]),
          ],
        });
      }
      if (url === "/api/unpublished") return respond({ changes: [] });
      if (init?.method === "POST") {
        filled = true;
        return respond({ changeSetId: null });
      }
      return respond({});
    });
    renderApp("/people");
    await openForm();
    await type("Name", "Fictional Starter");
    await type("ID", "E9");
    await userEvent.tab();

    await fillNow();

    expect(
      await screen.findByRole("region", { name: "Fictional Starter" }),
    ).toBeDefined();
  });
});
