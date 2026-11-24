// SPDX-License-Identifier: Apache-2.0

// Tests for a planned hire's details in the person panel, and who may change them.

import { screen, waitFor, within } from "@testing-library/react";
import { userEvent } from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { renderApp, serverAnswers } from "./test-support.tsx";
import {
  setUpEachTest,
  session,
  person,
  robin,
  peopleAnswer,
  positions,
  chart,
  panel,
} from "./test-person-panel.tsx";

setUpEachTest();

describe("changing a planned hire's details", () => {
  const hiringEditor = session([
    "people:view",
    "people:edit",
    "hiring-plan:view",
    "confidential:view",
    "hiring-plan:edit",
    "confidential:edit",
    "feature-teams:view",
    "personal:view",
    "plan:view",
    "features:view",
  ]);
  const peopleEditor = session([
    "people:view",
    "people:edit",
    "hiring-plan:view",
    "confidential:view",
    "feature-teams:view",
    "personal:view",
    "plan:view",
    "features:view",
  ]);
  const states = {
    ...positions,
    id: "states",
    keyNumber: 1,
    name: "Hiring states",
    builtIn: "hiring-states",
    choices: [
      ["s-proposed", "Request to hire", "proposed"],
      ["s-open", "Approved to hire", "open"],
      ["s-hired", "Hired", "hired"],
      ["s-left", "Fictional Resigned", "left"],
    ].map(([id, label, meaning]) => ({
      id,
      label,
      meaning,
      description: "",
      retired: false,
    })),
  };
  const opening = person("h1", "Fictional Opening", {
    kind: "planned-hire",
    employeeId: "REQ-7",
    stateId: "s-open",
    expected: "2027-01",
    startDate: null,
  });

  function hireAnswers(who: () => Response) {
    return serverAnswers({
      "GET /api/session": who,
      "GET /api/people": peopleAnswer([robin, opening]),
      "GET /api/lists": () => Response.json({ lists: [positions, states] }),
      "GET /api/unpublished": () => Response.json({ changes: [] }),
      "GET /api/org-chart": () =>
        Response.json({ people: chart, drafted: chart }),
      "PATCH /api/planned-hires/h1": () =>
        Response.json({ changeSetId: "00000000-0000-4000-8000-0000000000c2" }),
    });
  }

  it("marks a planned hire with no date as Planned, no date", async () => {
    serverAnswers({
      "GET /api/session": hiringEditor,
      "GET /api/people": peopleAnswer([robin, { ...opening, undated: true }]),
      "GET /api/lists": () => Response.json({ lists: [positions, states] }),
      "GET /api/unpublished": () => Response.json({ changes: [] }),
      "GET /api/org-chart": () =>
        Response.json({ people: chart, drafted: chart }),
    });
    renderApp("/people?open=REQ-7");
    const details = await panel("Fictional Opening");
    expect(within(details).getByText("Planned, no date")).toBeDefined();
    expect(within(details).queryByText(/^Planned, expected/)).toBeNull();
  });

  it("offers a planned hire only the hiring states", async () => {
    hireAnswers(hiringEditor);
    renderApp("/people?open=REQ-7");
    await panel("Fictional Opening");
    await userEvent.click(screen.getByRole("button", { name: "Change State" }));
    const options = await screen.findAllByRole("option");
    expect(options.map(({ textContent }) => textContent)).toEqual([
      "Request to hire",
      "Approved to hire",
    ]);
  });

  it("saves a change through the planned hires' route for those who may change the hiring plan", async () => {
    const fetch = hireAnswers(hiringEditor);
    renderApp("/people?open=REQ-7");
    await panel("Fictional Opening");
    await userEvent.click(screen.getByRole("button", { name: "Change Name" }));
    const field = await screen.findByRole("textbox", { name: "Name" });
    await userEvent.clear(field);
    await userEvent.type(field, "Fictional Lead{Enter}");
    await waitFor(() => {
      expect(
        fetch.mock.calls
          .filter(
            ([url, init]) =>
              url === "/api/planned-hires/h1" && init?.method === "PATCH",
          )
          .map(([, init]) => JSON.parse(init?.body as string) as unknown),
      ).toEqual([{ name: "Fictional Lead" }]);
    });
  });

  it("offers no changes to a planned hire to those who may change people but not the hiring plan", async () => {
    hireAnswers(peopleEditor);
    renderApp("/people?open=REQ-7");
    await panel("Fictional Opening");
    expect(screen.queryByRole("button", { name: "Change Name" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Change State" })).toBeNull();
  });
});
