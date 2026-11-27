// SPDX-License-Identifier: Apache-2.0

// Tests of planned hires in the People table: their states, names, new rows and export.

import { act, screen, waitFor, within } from "@testing-library/react";
import { userEvent } from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  bodyOf,
  recordCell,
  renderApp,
  savedFiles,
  serverAnswers,
} from "./test-support.tsx";
import {
  s1,
  u1,
  hiringEditor,
  session,
  sites,
  roles,
  positions,
  states,
  site,
  avery,
  savedAs,
  type Answers,
  cell,
  inRow,
  focusCell,
  offeredOptions,
  pick,
  paste,
} from "./test-people-page.tsx";

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("planned hires", () => {
  const rejected = {
    action: "changed",
    changed: ["stateId"],
    live: { stateId: "s-proposed", values: {}, links: {} },
    state: "rejected",
    reason: "Not this quarter",
    madeBy: null,
    madeAt: null,
    discardable: true,
  };
  const opening = {
    id: "h1",
    keyNumber: 1,
    kind: "planned-hire",
    preferredName: "",
    employeeId: "REQ-1",
    positionId: "position-2",
    stateId: "s-open",
    expected: "2027-01",
    startDate: null,
    values: {},
    links: {},
    draft: rejected,
  };
  const drafted = {
    id: "h2",
    keyNumber: 1,
    kind: "planned-hire",
    preferredName: "Fictional hire",
    employeeId: "TBD-2",
    positionId: "position-1",
    stateId: "s-proposed",
    expected: "2026-12",
    startDate: null,
    values: {},
    links: {},
    draft: {
      ...rejected,
      action: "created",
      changed: [],
      live: { values: {}, links: {} },
      state: "waiting",
    },
  };

  async function openHires(answers: Answers = {}) {
    const fetch = serverAnswers({
      "GET /api/session": hiringEditor,
      "GET /api/people": () =>
        Response.json({
          people: [{ ...avery, stateId: "s-hired" }, opening, drafted],
          fields: [],
          order: [
            "preferredName",
            "employeeId",
            "positionId",
            "stateId",
            "startDate",
            "expected",
          ],
        }),
      "GET /api/lists": () =>
        Response.json({ lists: [sites, roles, positions, states] }),
      "PATCH /api/planned-hires/h1": savedAs(),
      "DELETE /api/planned-hires/h1": savedAs(),
      "DELETE /api/planned-hires/h1/draft": savedAs(),
      "DELETE /api/planned-hires/h1/draft/rejection": savedAs(),
      "DELETE /api/planned-hires/h2/draft": savedAs(),
      "POST /api/planned-hires": () =>
        Response.json({ ids: ["h3"], changeSetId: s1 }, { status: 201 }),
      [`POST /api/undo/${s1}`]: savedAs(u1),
      ...answers,
    });
    renderApp("/people");
    await screen.findByRole("grid", { name: "People" });
    return fetch;
  }

  it("finds planned hires with no Site by its Empty, though a person's Site is required", async () => {
    await openHires({
      "GET /api/people": () =>
        Response.json({
          people: [{ ...avery, stateId: "s-hired" }, opening, drafted],
          fields: [site],
          order: ["preferredName", "employeeId", "f1"],
        }),
    });
    await userEvent.click(
      screen.getByRole("button", {
        name: (name) => name.startsWith("Site column"),
      }),
    );
    await userEvent.click(
      await screen.findByRole("menuitem", { name: "Filter…" }),
    );
    const dialog = await screen.findByRole("dialog", { name: "Filter Site" });
    await userEvent.click(
      within(dialog).getByRole("checkbox", { name: "Empty" }),
    );
    await waitFor(() => {
      expect(recordCell(avery.id, "preferredName")).toBeUndefined();
    });
    expect(
      ["h1", "h2"].map((id) => recordCell(id, "preferredName") !== undefined),
    ).toEqual([true, true]);
  });

  async function fromMenu(row: string, item: string) {
    focusCell(row, "employeeId");
    await userEvent.keyboard("{Shift>}{F10}{/Shift}");
    await userEvent.click(await screen.findByRole("menuitem", { name: item }));
  }

  it("asks before exporting the hiring plan and Personal dates, then records the export and saves the file", async () => {
    // Given People with planned hires, read by someone who sees the hiring plan and Personal details
    const files = savedFiles();
    const fetch = await openHires({
      "POST /api/exports": () => Response.json({ recorded: true }),
    });

    // When People is exported as a TSV file
    await userEvent.click(screen.getByRole("button", { name: "Export" }));
    await userEvent.click(
      await screen.findByRole("menuitem", { name: "TSV file" }),
    );

    // Then the question names the hiring plan the hires' rows are, and the Personal column
    const dialog = await screen.findByRole("dialog", {
      name: "Export Confidential and Personal data?",
    });
    expect(dialog.textContent).toContain(
      "This file holds Confidential data (Hiring plan) and Personal data (",
    );
    expect(files).toHaveLength(0);

    // When Export is chosen
    await userEvent.click(
      within(dialog).getByRole("button", { name: "Export" }),
    );

    // Then the export is recorded, then the file saved
    await waitFor(() => {
      expect(files).toHaveLength(1);
    });
    expect(bodyOf(fetch, "POST", "/api/exports")).toEqual([
      {
        table: "people",
        columns: [
          "preferredName",
          "employeeId",
          "positionId",
          "stateId",
          "startDate",
          "expected",
          "endDate",
          "managerId",
          "isManager",
          "managerFrom",
          "team",
          "teamName",
        ],
        details: ["hiringPlan"],
      },
    ]);
    expect(files[0]?.name).toMatch(/\.tsv$/u);
  });

  it("counts a planned hire's drafted manager as the hiring plan, not as Past managers", async () => {
    // Given a reader of the hiring plan who doesn't see Personal data, and a hire whose draft changes
    // its manager
    serverAnswers({
      "GET /api/session": session([
        "people:view",
        "plan:view",
        "configuration:view",
        "hiring-plan:view",
        "confidential:view",
      ]),
      "GET /api/people": () =>
        Response.json({
          people: [
            avery,
            {
              ...opening,
              draft: { ...rejected, changed: ["managerId"], state: "waiting" },
            },
          ],
          fields: [],
          order: ["preferredName", "employeeId", "positionId", "stateId"],
        }),
      "GET /api/lists": () =>
        Response.json({ lists: [sites, roles, positions, states] }),
    });
    renderApp("/people");
    await screen.findByRole("grid", { name: "People" });

    // When People is exported
    await userEvent.click(screen.getByRole("button", { name: "Export" }));
    await userEvent.click(
      await screen.findByRole("menuitem", { name: "CSV file" }),
    );

    // Then it asks about the hiring plan alone, never Personal data the reader can't see
    const dialog = await screen.findByRole("dialog", {
      name: "Export Confidential data?",
    });
    expect(dialog.textContent).not.toContain("Past managers");
  });

  it("saves a reader's approved planned hires without asking, when it isn't sent the hiring plan", async () => {
    // Given People with an approved planned hire, read by a role that sees people but not the hiring
    // plan, so is sent only the hire's General details
    const files = savedFiles();
    const fetch = serverAnswers({
      "GET /api/session": session([
        "people:view",
        "plan:view",
        "configuration:view",
      ]),
      "GET /api/people": () =>
        Response.json({
          people: [
            avery,
            { ...opening, draft: undefined, startDate: undefined },
          ],
          fields: [],
          order: ["preferredName", "employeeId", "positionId", "stateId"],
        }),
      "GET /api/lists": () =>
        Response.json({ lists: [sites, roles, positions, states] }),
    });
    renderApp("/people");
    await screen.findByRole("grid", { name: "People" });

    // When People is exported as a CSV file
    await userEvent.click(screen.getByRole("button", { name: "Export" }));
    await userEvent.click(
      await screen.findByRole("menuitem", { name: "CSV file" }),
    );

    // Then it is saved at once, with no question and nothing for the server to record
    await waitFor(() => {
      expect(files).toHaveLength(1);
    });
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(bodyOf(fetch, "POST", "/api/exports")).toEqual([]);
  });

  it("offers a person the states of their meaning, and a hire only Proposed or Open", async () => {
    await openHires();
    focusCell("p1", "stateId");
    await userEvent.keyboard("{Enter}");
    expect(await offeredOptions()).toEqual(["Hired"]);
    await userEvent.keyboard("{Escape}");
    focusCell("h1", "stateId");
    await userEvent.keyboard("{Enter}");
    expect(await offeredOptions()).toEqual([
      "Request to hire",
      "Approved to hire",
    ]);
  });

  it("names an unnamed hire by its position and ID, and changes it through the planned hires' routes", async () => {
    const fetch = await openHires();
    expect(cell("h1", "preferredName").textContent).toContain("Tester, REQ-1");
    await fromMenu("h2", "Discard draft");
    expect(
      await screen.findByText(
        "Discarded the draft adding the planned hire Fictional hire.",
        {
          exact: false,
        },
      ),
    ).toBeDefined();
    expect(cell("p1", "stateId").getAttribute("aria-readonly")).toBeNull();
    focusCell("h1", "preferredName");
    await userEvent.keyboard("Fictional opening{Enter}");
    await waitFor(() => {
      expect(bodyOf(fetch, "PATCH", "/api/planned-hires/h1")).toEqual([
        { name: "Fictional opening" },
      ]);
    });
    focusCell("h1", "employeeId");
    await userEvent.keyboard("{Delete}");
    await waitFor(() => {
      expect(bodyOf(fetch, "PATCH", "/api/planned-hires/h1")).toContainEqual({
        requisition: null,
      });
    });
    await fromMenu("h1", "Resubmit");
    await fromMenu("h1", "Discard draft");
    await fromMenu("h1", "Remove planned hire");
    await waitFor(() => {
      expect(
        fetch.mock.calls
          .filter(([url]) => url.startsWith("/api/planned-hires/h1"))
          .map(([url, init]) => `${String(init?.method)} ${url}`),
      ).toEqual(
        expect.arrayContaining([
          "DELETE /api/planned-hires/h1/draft/rejection",
          "DELETE /api/planned-hires/h1/draft",
          "DELETE /api/planned-hires/h1",
        ]) as string[],
      );
    });
  });

  it("names the new row for the kind its state makes it", async () => {
    await openHires();
    const newRow = () => screen.getAllByRole("row", { name: /^New / })[0];
    const focusNew = (label: string) => {
      act(() => {
        inRow(newRow() as HTMLElement, label).focus();
      });
    };
    focusNew("State");
    await userEvent.keyboard("Request{Tab}{Escape}");
    await waitFor(() => {
      expect(newRow()?.getAttribute("aria-label")).toBe("New planned hire");
    });
    focusNew("State");
    await userEvent.keyboard("Hired{Tab}{Escape}");
    await waitFor(() => {
      expect(newRow()?.getAttribute("aria-label")).toBe("New person");
    });
  });

  it("adds a planned hire when a hiring state is the last value picked in the new row", async () => {
    // Given a new row with a name, ID, and position
    const fetch = await openHires();
    const newRow = screen.getByRole("row", { name: "New person" });
    act(() => {
      inRow(newRow, "Name").focus();
    });
    await userEvent.keyboard("Fictional opening{Tab}REQ-11{Tab}tes{Tab}");
    // When Request to hire is picked for its state
    await pick("Request to hire");
    // Then it is added as a planned hire, not a person
    await waitFor(() => {
      expect(bodyOf(fetch, "POST", "/api/planned-hires")).toHaveLength(1);
    });
    expect(bodyOf(fetch, "POST", "/api/people")).toEqual([]);
  });

  it("adds planned hires from the new row once a hiring state is chosen", async () => {
    const fetch = await openHires({
      "POST /api/planned-hires": () =>
        Response.json({ ids: ["h3", "h4"], changeSetId: s1 }, { status: 201 }),
    });
    const newRow = screen.getByRole("row", { name: "New person" });
    expect(inRow(newRow, "State").textContent).toBe("");
    await paste(
      inRow(newRow, "Name"),
      "\tREQ-9\tEngineer\tRequest to hire\nFictional opening\tREQ-10\tTester\tRequest to hire",
    );
    await waitFor(() => {
      expect(bodyOf(fetch, "POST", "/api/planned-hires")).toEqual([
        {
          hires: [
            {
              name: null,
              requisition: "REQ-9",
              positionId: "position-1",
              targetDate: null,
              managerId: null,
              isManager: false,
              stateId: "s-proposed",
              values: {},
              links: {},
            },
            {
              name: "Fictional opening",
              requisition: "REQ-10",
              positionId: "position-2",
              targetDate: null,
              managerId: null,
              isManager: false,
              stateId: "s-proposed",
              values: {},
              links: {},
            },
          ],
        },
      ]);
    });
  });
});
