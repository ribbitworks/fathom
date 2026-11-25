// SPDX-License-Identifier: Apache-2.0

// Tests of adding a person or a planned hire from the People page's New menu.

import { act, screen, waitFor, within } from "@testing-library/react";
import { userEvent } from "@testing-library/user-event";
import { addToMonth, monthOf } from "@fathom/shared";
import { afterEach, describe, expect, it, vi } from "vitest";
import { bodyOf, detailRow } from "./test-support.tsx";
import { today } from "./today.ts";
import {
  s1,
  session,
  editor,
  hiringEditor,
  sites,
  roles,
  positions,
  listsAnswer,
  states,
  site,
  role,
  avery,
  blake,
  order,
  peopleAnswer,
  refused,
  Answers,
  openPeople,
  offeredOptions,
  pick,
} from "./test-people-page.tsx";

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("adding from New", () => {
  const casey = {
    ...avery,
    id: "p9",
    keyNumber: 1,
    preferredName: "Casey Fictional",
    employeeId: "E9",
    stateId: "s-hired",
    values: { f1: ["c1"] },
  };

  async function openNew(
    who: () => Response = hiringEditor,
    answers: Answers = {},
  ) {
    const fetch = await openPeople({
      "GET /api/session": who,
      "GET /api/lists": () =>
        Response.json({ lists: [sites, roles, positions, states] }),
      ...answers,
    });
    const button = screen.getByRole<HTMLButtonElement>("button", {
      name: "New person",
    });
    await waitFor(() => {
      expect(button.disabled).toBe(false);
    });
    await userEvent.click(button);
    await form("New person");
    return fetch;
  }

  const form = (title: string) => screen.findByRole("region", { name: title });

  const row = (label: string) => detailRow(label);

  const field = (label: string) =>
    screen.getByRole<HTMLInputElement>("textbox", { name: label });

  async function typeInto(label: string, text: string) {
    await userEvent.type(field(label), `${text}{Tab}`);
  }

  async function choose(label: string, option: string | RegExp) {
    await userEvent.click(
      screen.getByRole("button", { name: `Change ${label}` }),
    );
    await pick(option);
  }

  async function answerQuestion(title: string, answer: string) {
    await userEvent.click(
      within(await screen.findByRole("dialog", { name: title })).getByRole(
        "button",
        { name: answer },
      ),
    );
    await waitFor(() => {
      expect(screen.queryByRole("dialog", { name: title })).toBeNull();
    });
  }

  it("starts a new person, with State first and Hired", async () => {
    await openNew();
    const panel = await form("New person");
    expect(
      within(panel)
        .getAllByRole("heading")
        .map(({ textContent }) => textContent)[0],
    ).toBe("New person");
    expect(panel.querySelector("dt")?.textContent).toBe("State");
    expect(within(row("State")).getByText("Hired")).toBeDefined();
  });

  it("names every problem on Add, with focus on the first the panel shows", async () => {
    // Given a new person with a name and ID, but no position or site
    const fetch = await openNew();
    await typeInto("Name", "Casey Fictional");
    await typeInto("ID", "E9");
    // When Add is pressed
    await userEvent.click(screen.getByRole("button", { name: "Add" }));
    // Then each missing value is named under its row, focus goes to Position, and nothing is sent
    expect(within(row("Position")).getByText("Position needed")).toBeDefined();
    expect(within(row("Site")).getByText("Site needed")).toBeDefined();
    await waitFor(() => {
      expect(document.activeElement).toBe(
        screen.getByRole("button", { name: "Change Position" }),
      );
    });
    expect(bodyOf(fetch, "POST", "/api/people")).toEqual([]);
  });

  it("adds the person with Add, then shows them in the panel", async () => {
    // Given a new person with every value needed
    let added = false;
    const fetch = await openNew(hiringEditor, {
      "POST /api/people": () => {
        added = true;
        return Response.json({ ids: ["p9"], changeSetId: s1 }, { status: 201 });
      },
      "GET /api/people": () =>
        Response.json({
          people: added ? [avery, blake, casey] : [avery, blake],
          fields: [site, role],
          order,
        }),
    });
    await typeInto("Name", "Casey Fictional");
    await typeInto("ID", "E9");
    await choose("Position", "Engineer");
    await choose("Site", "Harbour");
    // When Add is pressed
    await userEvent.click(screen.getByRole("button", { name: "Add" }));
    // Then they are sent, as Hired, and their details show in place of the form
    await waitFor(() => {
      expect(bodyOf(fetch, "POST", "/api/people")).toEqual([
        {
          people: [
            expect.objectContaining({
              preferredName: "Casey Fictional",
              employeeId: "E9",
              positionId: "position-1",
              stateId: "s-hired",
              values: expect.objectContaining({ f1: ["c1"] }) as unknown,
            }),
          ],
        },
      ]);
    });
    expect(await form("Casey Fictional")).toBeDefined();
    expect(screen.queryByRole("region", { name: "New person" })).toBeNull();
  });

  it("puts the cursor in Name when it opens, ready to type into", async () => {
    await openNew();
    await waitFor(() => {
      expect(document.activeElement).toBe(
        screen.getByRole("textbox", { name: "Name" }),
      );
    });
  });

  it("keeps the form while an add is saved, and leaves a newer one as it is when the add fails", async () => {
    // Given an add still being saved
    let answer: (response: Response) => void = () => undefined;
    const fetch = await openNew(hiringEditor, {
      "POST /api/people": () =>
        new Promise<Response>((resolve) => {
          answer = resolve;
        }),
    });
    await typeInto("Name", "Casey Fictional");
    await typeInto("ID", "E9");
    await choose("Position", "Engineer");
    await choose("Site", "Harbour");
    await userEvent.click(screen.getByRole("button", { name: "Add" }));
    // When the panel's close button is pressed
    await userEvent.click(
      screen.getByRole("button", { name: "Close New person" }),
    );
    // Then the form stays
    expect(await form("New person")).toBeDefined();
    // When New is pressed, the add discarded, and the add then fails
    await userEvent.click(screen.getByRole("button", { name: "New person" }));
    await answerQuestion("Discard the new person?", "Discard");
    await typeInto("Name", "Dee Fictional");
    act(() => {
      answer(new Response(null, { status: 500 }));
    });
    await waitFor(() => {
      expect(bodyOf(fetch, "POST", "/api/people")).toHaveLength(1);
    });
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 50));
    });
    // Then the newer form stays as it is
    expect(field("Name").value).toBe("Dee Fictional");
  });

  it("leaves a form opened while an add is saved as it is", async () => {
    // Given an add still being saved
    let answer: (response: Response) => void = () => undefined;
    const fetch = await openNew(hiringEditor, {
      "POST /api/people": () =>
        new Promise<Response>((resolve) => {
          answer = resolve;
        }),
    });
    await typeInto("Name", "Casey Fictional");
    await typeInto("ID", "E9");
    await choose("Position", "Engineer");
    await choose("Site", "Harbour");
    await userEvent.click(screen.getByRole("button", { name: "Add" }));
    // When New is pressed, the add asked about, and the add then saved
    await userEvent.click(screen.getByRole("button", { name: "New person" }));
    await answerQuestion("Discard the new person?", "Discard");
    await typeInto("Name", "Dee Fictional");
    act(() => {
      answer(Response.json({ ids: ["p9"], changeSetId: s1 }, { status: 201 }));
    });
    // Then, once it is saved, the new form stays, with what was typed in it
    await waitFor(() => {
      expect(bodyOf(fetch, "POST", "/api/people")).toHaveLength(1);
    });
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 50));
    });
    expect(await form("New person")).toBeDefined();
    expect(field("Name").value).toBe("Dee Fictional");
  });

  it("closes with Cancel, putting focus back on New", async () => {
    await openNew();
    await userEvent.click(screen.getByRole("button", { name: "Cancel" }));
    await waitFor(() => {
      expect(screen.queryByRole("region", { name: "New person" })).toBeNull();
    });
    await waitFor(() => {
      expect(document.activeElement).toBe(
        screen.getByRole("button", { name: "New person" }),
      );
    });
  });

  it("offers every state to those who may change people and the hiring plan", async () => {
    await openNew();
    await userEvent.click(screen.getByRole("button", { name: "Change State" }));
    expect(await offeredOptions()).toEqual([
      "Request to hire",
      "Approved to hire",
      "Hired",
      "Fictional Resigned",
    ]);
  });

  it("offers only a person's states to those who may change people alone", async () => {
    await openNew(editor);
    await userEvent.click(screen.getByRole("button", { name: "Change State" }));
    expect(await offeredOptions()).toEqual(["Hired", "Fictional Resigned"]);
  });

  it("becomes a planned hire with a hiring state, keeping the values both have and naming those cleared", async () => {
    // Given a new person with a name and an end date
    await openNew();
    await typeInto("Name", "Casey Fictional");
    await typeInto("End", "2027-01-31");
    // When their state is changed to Request to hire
    await choose("State", "Request to hire");
    // Then it is a planned hire, keeping the name, with the end date cleared and said to be
    expect(await form("New planned hire")).toBeDefined();
    expect(field("Name").value).toBe("Casey Fictional");
    expect(screen.queryByRole("textbox", { name: "End" })).toBeNull();
    expect(
      screen.getByText(
        "End was cleared, since a planned hire doesn't have it.",
      ),
    ).toBeDefined();
    // When it is changed back to Hired
    await choose("State", "Hired");
    // Then it is a person again, keeping the name, with nothing more cleared
    expect(await form("New person")).toBeDefined();
    expect(field("Name").value).toBe("Casey Fictional");
    expect(screen.queryByText(/was cleared/)).toBeNull();
  });

  it("names a new planned hire in grey by its position, then its position and ID", async () => {
    await openNew();
    await choose("State", "Request to hire");
    await form("New planned hire");
    expect(field("Name").placeholder).toBe("");
    await choose("Position", "Tester");
    await waitFor(() => {
      expect(field("Name").placeholder).toBe("Tester");
    });
    await typeInto("ID", "REQ-4100");
    await waitFor(() => {
      expect(field("Name").placeholder).toBe("Tester, REQ-4100");
    });
  });

  it("names no new person in grey", async () => {
    await openNew();
    await choose("Position", "Tester");
    await waitFor(() => {
      expect(within(row("Position")).getByText("Tester")).toBeDefined();
    });
    expect(field("Name").placeholder).toBe("");
  });

  it("closes an untouched form without asking", async () => {
    await openNew();
    await userEvent.click(
      screen.getByRole("button", { name: "Close New person" }),
    );
    await waitFor(() => {
      expect(screen.queryByRole("region", { name: "New person" })).toBeNull();
    });
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("asks before another date discards a person being added, which it then closes", async () => {
    // Given a new person with a name, on a page with a date row
    const lastMonth = `${addToMonth(monthOf(today()), -1)}-01`;
    await openNew(hiringEditor, {
      [`GET /api/people?on=${lastMonth}`]: peopleAnswer,
    });
    await typeInto("Name", "Casey Fictional");
    // When an earlier month is chosen, and adding kept
    const earlier = screen.getByRole("button", { name: "Previous month" });
    await userEvent.click(earlier);
    await answerQuestion("Discard the new person?", "Keep adding");
    // Then the form stays, on today
    expect(field("Name").value).toBe("Casey Fictional");
    const todayButton = () =>
      screen.getByRole<HTMLButtonElement>("button", { name: "Today" });
    expect(todayButton().disabled).toBe(true);
    // When the month is chosen again, and adding discarded
    await userEvent.click(earlier);
    await answerQuestion("Discard the new person?", "Discard");
    // Then the form closes, and the earlier date shows
    await waitFor(() => {
      expect(screen.queryByRole("region", { name: "New person" })).toBeNull();
    });
    await waitFor(() => {
      expect(todayButton().disabled).toBe(false);
    });
  });

  it("asks before discarding a person being added, keeping them until Discard", async () => {
    // Given a new person with a name
    await openNew();
    await typeInto("Name", "Casey Fictional");
    const close = screen.getByRole("button", { name: "Close New person" });
    // When the form is closed, and adding kept
    await userEvent.click(close);
    await answerQuestion("Discard the new person?", "Keep adding");
    // Then the form stays, as it was
    expect(field("Name").value).toBe("Casey Fictional");
    // When it is closed again, and discarded
    await userEvent.click(close);
    await answerQuestion("Discard the new person?", "Discard");
    // Then it closes
    await waitFor(() => {
      expect(screen.queryByRole("region", { name: "New person" })).toBeNull();
    });
  });

  it("asks before discarding a planned hire being added", async () => {
    await openNew();
    await choose("State", "Approved to hire");
    await form("New planned hire");
    await userEvent.click(
      screen.getByRole("button", { name: "Close New planned hire" }),
    );
    await answerQuestion("Discard the new planned hire?", "Discard");
    await waitFor(() => {
      expect(
        screen.queryByRole("region", { name: "New planned hire" }),
      ).toBeNull();
    });
  });

  it("has no State for those not sent the hiring states", async () => {
    await openNew(editor, { "GET /api/lists": listsAnswer });
    const panel = await form("New person");
    expect(panel.querySelector("dt")?.textContent).toBe("Name");
    expect(screen.queryByText("State", { selector: "dt" })).toBeNull();
  });

  it("empties a field with its ×, keeping focus in it", async () => {
    await openNew();
    await userEvent.type(field("Name"), "Casey Fictional");
    await userEvent.click(screen.getByRole("button", { name: "Clear Name" }));
    expect(field("Name").value).toBe("");
    expect(document.activeElement).toBe(field("Name"));
  });

  it("keeps the form, with what was entered, when adding fails", async () => {
    // Given a new person with every value needed, whom the server will not add
    await openNew(hiringEditor, {
      "POST /api/people": refused(500, "Fictional failure"),
    });
    await typeInto("Name", "Casey Fictional");
    await typeInto("ID", "E9");
    await choose("Position", "Engineer");
    await choose("Site", "Harbour");
    // When Add is pressed
    await userEvent.click(screen.getByRole("button", { name: "Add" }));
    // Then the form stays, as it was, to be added again
    expect(
      await screen.findByText(
        "Fathom could not add the person. Try again in a moment.",
      ),
    ).toBeDefined();
    expect(field("Name").value).toBe("Casey Fictional");
    await waitFor(() => {
      expect(
        screen.getByRole<HTMLButtonElement>("button", { name: "Add" }).disabled,
      ).toBe(false);
    });
  });

  it("names every value cleared when it becomes a planned hire", async () => {
    await openNew(hiringEditor, {
      "GET /api/people": () =>
        Response.json({
          people: [{ ...avery, isManager: true }, blake],
          fields: [site, role],
          order,
        }),
    });
    await typeInto("End", "2027-01-31");
    await choose("Manager", /^Avery Fictional\b/);
    await typeInto("Manager assigned", "2026-12-01");
    await choose("State", "Request to hire");
    expect(
      await screen.findByText(
        "End and Manager assigned were cleared, since a planned hire doesn't have them.",
      ),
    ).toBeDefined();
  });

  it("adds a planned hire through the planned hires' route", async () => {
    const fetch = await openNew(hiringEditor, {
      "POST /api/planned-hires": () =>
        Response.json({ ids: ["h9"], changeSetId: s1 }, { status: 201 }),
    });
    await choose("State", "Approved to hire");
    await choose("Position", "Tester");
    await userEvent.click(screen.getByRole("button", { name: "Add" }));
    await waitFor(() => {
      expect(bodyOf(fetch, "POST", "/api/planned-hires")).toEqual([
        {
          hires: [
            expect.objectContaining({
              name: null,
              requisition: null,
              positionId: "position-2",
              stateId: "s-open",
            }),
          ],
        },
      ]);
    });
    expect(bodyOf(fetch, "POST", "/api/people")).toEqual([]);
  });

  it("puts focus in the first box to type in when its value is the first problem", async () => {
    await openNew();
    await userEvent.click(screen.getByRole("button", { name: "Add" }));
    expect(within(row("Name")).getByText("Name needed")).toBeDefined();
    await waitFor(() => {
      expect(document.activeElement).toBe(field("Name"));
    });
  });

  it("names a value cleared when a planned hire becomes a person", async () => {
    // Given a reader who sees planned hires' dates but not people's
    await openNew(
      session([
        "configuration:view",
        "hiring-plan:edit",
        "confidential:edit",
        "hiring-plan:view",
        "confidential:view",
        "people:edit",
        "people:view",
        "plan:view",
        "features:view",
      ]),
    );
    await choose("State", "Request to hire");
    await typeInto("Start", "2027-03-01");
    // When the planned hire becomes a person
    await choose("State", "Hired");
    // Then the date is cleared, and named
    expect(
      await screen.findByText(
        "Start was cleared, since a person doesn't have it.",
      ),
    ).toBeDefined();
  });
});
