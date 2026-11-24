// SPDX-License-Identifier: Apache-2.0

// Tests for changing a person's manager on an earlier day, from their panel beside the org chart.

import { screen, waitFor } from "@testing-library/react";
import { userEvent } from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { bodyOf, renderApp, serverAnswers } from "./test-support.tsx";
import {
  setUpEachTest,
  session,
  person,
  robin,
  sasha,
  uma,
  peopleAnswer,
  positions,
  chart,
  panel,
} from "./test-person-panel.tsx";

setUpEachTest();

describe("changing a manager beside the org chart on an earlier day", () => {
  const day = "2025-01-01";
  const saved = Response.json.bind(Response, {
    changeSetId: "00000000-0000-4000-8000-0000000000c1",
  });
  const changesDates = [
    "people:view",
    "people:edit",
    "feature-teams:view",
    "personal:view",
    "personal:edit",
    "plan:view",
    "features:view",
  ];

  function onDay(
    permissions = changesDates,
    shown = day,
    people = [robin, sasha, uma],
    peopleThen = people,
  ) {
    const fetch = serverAnswers({
      "GET /api/session": session(permissions),
      "GET /api/people": peopleAnswer(people),
      [`GET /api/people?on=${shown}`]: peopleAnswer(peopleThen),
      "GET /api/lists": () => Response.json({ lists: [positions] }),
      "GET /api/unpublished": () => Response.json({ changes: [] }),
      "GET /api/org-chart": () =>
        Response.json({ people: chart, drafted: chart }),
      [`GET /api/org-chart?on=${shown}`]: () =>
        Response.json({ people: chart, drafted: chart }),
      "PATCH /api/people/3": saved,
    });
    return fetch;
  }

  const change = (label: string) =>
    screen.queryByRole("button", { name: `Change ${label}` });

  it("offers only the manager, and changes it from that day", async () => {
    const fetch = onDay();
    renderApp(`/org-chart?open=E3&day=${day}`);
    await panel("Uma Fictional");
    expect(change("Name")).toBeNull();
    expect(change("Position")).toBeNull();
    expect(change("Manager assigned")).toBeNull();
    await userEvent.click(change("Manager") as HTMLElement);
    await userEvent.click(
      await screen.findByRole("option", { name: /Robin Fictional/ }),
    );
    await waitFor(() => {
      expect(bodyOf(fetch, "PATCH", "/api/people/3")).toEqual([
        { managerId: "1", managerFrom: day },
      ]);
    });
  });

  it.each([
    ["by name, as today's People has them", "E3", "Uma Fictional"],
    ["by ID, when today's People has nobody with it", "E9", "E9"],
  ])(
    "says someone isn't employed on that day %s",
    async (_case, employeeId, called) => {
      serverAnswers({
        "GET /api/session": session(changesDates),
        "GET /api/people": peopleAnswer([robin, sasha, uma]),
        [`GET /api/people?on=${day}`]: peopleAnswer([robin, sasha]),
        "GET /api/lists": () => Response.json({ lists: [positions] }),
        "GET /api/unpublished": () => Response.json({ changes: [] }),
        [`GET /api/org-chart?on=${day}`]: () =>
          Response.json({ people: chart, drafted: chart }),
      });
      renderApp(`/org-chart?open=${employeeId}&day=${day}`);
      expect(
        await screen.findByText((text) =>
          text.startsWith(`${called} isn't employed on `),
        ),
      ).toBeDefined();
    },
  );

  it("withdraws a drafted move when the live manager is chosen again, keeping the live line's date", async () => {
    // Given Uma drafted from Sasha, since 2024-05-01, to Robin
    const fetch = onDay(changesDates, day, [
      robin,
      sasha,
      person("3", "Uma Fictional", {
        manager: { id: "1", preferredName: "Robin Fictional" },
        managerFrom: day,
        draft: {
          action: "changed",
          changed: ["managerId", "managerFrom"],
          live: {
            managerId: "2",
            managerFrom: "2024-05-01",
            values: {},
            links: {},
          },
          state: "waiting",
          madeBy: null,
          madeAt: null,
        },
      }),
    ]);
    renderApp(`/org-chart?open=E3&day=${day}`);
    await panel("Uma Fictional");
    await userEvent.click(change("Manager") as HTMLElement);
    await userEvent.click(
      await screen.findByRole("option", { name: /Sasha Fictional/ }),
    );
    await waitFor(() => {
      expect(bodyOf(fetch, "PATCH", "/api/people/3")).toEqual([
        { managerId: "2", managerFrom: "2024-05-01" },
      ]);
    });
  });

  it("offers no change to someone whose current line started after that day", async () => {
    // Given Sasha's current line, from 2024-03-01, after an earlier line in force on the day shown
    onDay(
      changesDates,
      "2024-02-29",
      [robin, sasha, uma],
      [robin, { ...sasha, managerFrom: "2023-01-01" }, uma],
    );
    renderApp("/org-chart?open=E2&day=2024-02-29");
    await panel("Sasha Fictional");
    expect(change("Manager")).toBeNull();
  });

  it("offers no change to those who may not change Personal details", async () => {
    onDay(changesDates.filter((one) => one !== "personal:edit"));
    renderApp(`/org-chart?open=E3&day=${day}`);
    await panel("Uma Fictional");
    expect(change("Manager")).toBeNull();
  });
});
