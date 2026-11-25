// SPDX-License-Identifier: Apache-2.0

// Tests for a person's timeline beside People: the preview ending their details, opening the
// timeline in a panel of its own kept in the address, its dates moving the page to that day, its
// records opening their details or the org chart, closing it, and no timeline for a role that doesn't
// see start and end dates.

import { screen, waitFor, within } from "@testing-library/react";
import { userEvent } from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { renderApp } from "./test-support.tsx";
import {
  editAnswers,
  panel,
  session,
  setUpEachTest,
} from "./test-person-panel.tsx";
import { timelinePanelId } from "./person-timeline.tsx";

setUpEachTest();

const team = {
  id: "00000000-0000-4000-8000-0000000000f1",
  name: "Fictional Pier",
};

// Sasha's timeline: she started reporting to Robin, then to Uma, joined a team, and will lead it.
const timeline = () =>
  Response.json({
    days: [
      {
        day: "2020-01-01",
        changes: [
          { field: "start" },
          { field: "manager", value: { id: "1", name: "Robin Fictional" } },
        ],
      },
      {
        day: "2024-03-01",
        changes: [
          {
            field: "manager",
            value: { id: "3", name: "Uma Fictional" },
            was: { id: "1", name: "Robin Fictional" },
          },
          { field: "featureTeams", value: team, part: "added" },
        ],
      },
      {
        day: "2099-01-04",
        changes: [{ field: "leads", value: team, part: "added" }],
      },
    ],
  });

const open = (more: Record<string, () => Response> = {}) => {
  editAnswers({
    "GET /api/feature-teams": () => Response.json({ teams: [] }),
    "GET /api/people/2/timeline": timeline,
    ...more,
  });
  return renderApp("/people?open=E2");
};

const preview = () =>
  document.getElementById("person-timeline")?.closest("section") as HTMLElement;
const timelinePanel = () => document.getElementById(timelinePanelId);

describe("a person's timeline", () => {
  it("ends their details with the next day to come and the latest, and opens in its own panel kept in the address", async () => {
    const history = open();
    await panel("Sasha Fictional");

    await waitFor(() => {
      expect(
        within(preview())
          .getAllByRole("term")
          .map(({ textContent }) => textContent),
      ).toEqual(["Jan 4, 2099", "Mar 1, 2024"]);
    });
    await userEvent.click(
      within(preview()).getByRole("button", { name: "Show timeline" }),
    );

    await waitFor(() => {
      expect(timelinePanel()).not.toBeNull();
    });
    expect(history.location.search).toContain("timeline=true");
    expect(
      within(timelinePanel() as HTMLElement)
        .getAllByRole("term")
        .map(({ textContent }) => textContent),
    ).toEqual(["Jan 4, 2099", "Mar 1, 2024", "Jan 1, 2020"]);
  });

  it("moves People to a day, opens a manager's details, and closes", async () => {
    editAnswers({
      "GET /api/feature-teams": () => Response.json({ teams: [] }),
      "GET /api/people/2/timeline": timeline,
    });
    const history = renderApp("/people?open=E2&timeline=true");
    await waitFor(() => {
      expect(timelinePanel()).not.toBeNull();
    });
    const inPanel = within(timelinePanel() as HTMLElement);

    await userEvent.click(
      await inPanel.findByRole("button", { name: "Mar 1, 2024" }),
    );
    expect(history.location.search).toContain("day=2024-03-01");
    await userEvent.click(
      inPanel.getAllByRole("button", {
        name: "Robin Fictional",
      })[0] as HTMLElement,
    );
    await waitFor(() => {
      expect(history.location.search).toContain("open=%22E1%22");
    });
  });

  it("opens a team on the org chart's feature teams, and closes the panel", async () => {
    editAnswers({
      "GET /api/feature-teams": () => Response.json({ teams: [] }),
      "GET /api/people/2/timeline": timeline,
    });
    const history = renderApp("/people?open=E2&timeline=true");
    await waitFor(() => {
      expect(timelinePanel()).not.toBeNull();
    });

    await userEvent.click(
      screen.getByRole("button", { name: "Close timeline" }),
    );
    expect(timelinePanel()).toBeNull();
    await userEvent.click(
      within(preview()).getAllByRole("button", {
        name: team.name,
      })[0] as HTMLElement,
    );

    await waitFor(() => {
      expect(history.location.pathname).toBe("/org-chart");
    });
    expect(history.location.search).toContain(team.id);
  });

  it("isn't there for a role that doesn't see start and end dates", async () => {
    open({
      "GET /api/session": session(["people:view", "plan:view"]),
    });
    await panel("Sasha Fictional");

    expect(document.getElementById("person-timeline")).toBeNull();
  });
});
