// SPDX-License-Identifier: Apache-2.0

// Tests for a person's timeline beside People.

import { screen, waitFor, within } from "@testing-library/react";
import { userEvent } from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { renderApp } from "./test-support.tsx";
import {
  editAnswers,
  panel,
  peopleAnswer,
  person,
  robin,
  sasha,
  session,
  setUpEachTest,
  uma,
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

// A planned hire, whose details have no timeline.
const plannedHire = person("9", "Fictional Engineer", {
  kind: "planned-hire",
  employeeId: "TBD-9",
});

const preview = () =>
  document.getElementById("person-timeline")?.closest("section") as HTMLElement;
const timelinePanel = () => document.getElementById(timelinePanelId);

describe("a person's timeline", () => {
  it("ends their details with the next day to come and the latest, and opens its own panel, kept in the address", async () => {
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

  // The timeline open beside Sasha's details, as its address keeps it.
  const openedTimeline = async (more: Record<string, () => Response> = {}) => {
    editAnswers({
      "GET /api/feature-teams": () => Response.json({ teams: [] }),
      "GET /api/people/2/timeline": timeline,
      ...more,
    });
    const history = renderApp("/people?open=E2&timeline=true");
    await waitFor(() => {
      expect(timelinePanel()).not.toBeNull();
    });
    return { history, inPanel: within(timelinePanel() as HTMLElement) };
  };

  it("moves People to a day from its date, which a later day can't for a role that doesn't see later dates", async () => {
    const { history, inPanel } = await openedTimeline();

    await userEvent.click(
      await inPanel.findByRole("button", { name: "Mar 1, 2024" }),
    );

    expect(history.location.search).toContain("day=2024-03-01");
    expect(inPanel.queryByRole("button", { name: "Jan 4, 2099" })).toBeNull();
  });

  it("opens a manager's details from the timeline", async () => {
    const { history, inPanel } = await openedTimeline();

    await userEvent.click(
      (
        await inPanel.findAllByRole("button", { name: "Robin Fictional" })
      )[0] as HTMLElement,
    );

    await waitFor(() => {
      expect(history.location.search).toContain("open=E1");
    });
  });

  it("opens a team on the org chart's feature teams", async () => {
    const { history, inPanel } = await openedTimeline();

    await userEvent.click(
      (
        await inPanel.findAllByRole("button", { name: team.name })
      )[0] as HTMLElement,
    );

    await waitFor(() => {
      expect(history.location.pathname).toBe("/org-chart");
    });
    expect(history.location.search).toContain(team.id);
  });

  it("puts focus on its title when opened, and back on Show timeline when closed", async () => {
    open();
    await panel("Sasha Fictional");
    const show = await within(preview()).findByRole("button", {
      name: "Show timeline",
    });

    await userEvent.click(show);
    await waitFor(() => {
      expect(document.activeElement?.textContent).toBe("Timeline");
    });
    await userEvent.click(
      screen.getByRole("button", { name: "Close timeline" }),
    );

    expect(timelinePanel()).toBeNull();
    await waitFor(() => {
      expect(document.activeElement?.textContent).toBe("Show timeline");
    });
  });

  it("says when it can't be read, offering Try again", async () => {
    await openedTimeline({
      "GET /api/people/2/timeline": () =>
        Response.json({ error: "Fictional failure" }, { status: 500 }),
    });

    expect(
      await within(preview()).findByRole("button", { name: "Try again" }),
    ).toBeDefined();
  });

  it("isn't there for a planned hire", async () => {
    editAnswers({
      "GET /api/feature-teams": () => Response.json({ teams: [] }),
      "GET /api/people": peopleAnswer([robin, sasha, uma, plannedHire]),
    });
    renderApp("/people?open=TBD-9");
    await panel("Fictional Engineer");

    expect(document.getElementById("person-timeline")).toBeNull();
  });

  it("isn't there for a role that doesn't see start and end dates", async () => {
    open({
      "GET /api/session": session(["people:view", "plan:view"]),
    });
    await panel("Sasha Fictional");

    expect(document.getElementById("person-timeline")).toBeNull();
  });
});
