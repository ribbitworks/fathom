// SPDX-License-Identifier: Apache-2.0

// Tests for filling a planned hire in its details panel on People, with the server's responses
// simulated: the form for a new or an existing person, what it sends and asks for, and leaving it.

import { act, screen, waitFor, within } from "@testing-library/react";
import { userEvent } from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { detailRow, renderApp } from "./test-support.tsx";
import {
  setUpEachTest,
  person,
  robin,
  hire,
  answers,
  openForm,
  fillNow,
  type,
} from "./test-hire-fill-form.tsx";

setUpEachTest();

const riley = person("m2", "Riley Fictional", { isManager: true });

const sasha = person("p1", "Sasha Fictional", { positionId: "tester" });

const grade = {
  id: "grade",
  keyNumber: 1,
  name: "Grade",
  type: "choice",
  listId: "grades",
  visibility: "general",
  multiple: false,
  required: true,
};

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

const row = (label: string) => detailRow(label);

async function pick(label: string, name: RegExp | string) {
  await userEvent.click(
    screen.getByRole("button", { name: `Change ${label}` }),
  );
  await userEvent.click(await screen.findByRole("option", { name }));
}

const useExisting = () =>
  userEvent.click(screen.getByRole("radio", { name: "Existing person" }));

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

  it("fills with Enter in a field typed into, as Fill does", async () => {
    const fetch = answers([robin, hire()]);
    renderApp("/people");
    await openForm();

    await type("Name", "Fictional Starter");
    await type("ID", "E9{Enter}");

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
          keyNumber: 1,
          name: "Background",
          type: "note",
          listId: null,
          visibility: "general",
          multiple: false,
          required: true,
        },
      ],
    });
    renderApp("/people");
    await openForm();
    await userEvent.click(
      screen.getByRole("button", { name: "Open Background" }),
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
          keyNumber: 1,
          name: "Background",
          type: "note",
          listId: null,
          visibility: "general",
          multiple: false,
          required: true,
        },
      ],
    });
    renderApp("/people");
    await openForm();
    await type("Name", "Fictional Starter");
    await type("ID", "E9");
    await userEvent.click(
      screen.getByRole("button", { name: "Open Background" }),
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
      await screen.findByRole("button", { name: "Open Background" }),
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
      await screen.findByText("Discard changes to the note?"),
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
          keyNumber: 1,
          name: "Site",
          type: "link",
          listId: null,
          visibility: "general",
          multiple: false,
          required: true,
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
        "confidential:view",
        "hiring-plan:edit",
        "confidential:edit",
        "plan:view",
        "features:view",
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
    await pick("Manager", /^Riley Fictional\b/);

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
      screen.getByRole("textbox", { name: "Manager assigned" }),
    );
    await type("Manager assigned", "2026-01-05");
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

    expect(
      screen.queryByRole("textbox", { name: "Manager assigned" }),
    ).toBeNull();
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
