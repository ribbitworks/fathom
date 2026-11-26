// SPDX-License-Identifier: Apache-2.0

// Tests for a person's timeline beside People.

import { screen, waitFor, within } from "@testing-library/react";
import { userEvent } from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { fictionalUser, onNarrowScreen, renderApp } from "./test-support.tsx";
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
import { formatDay } from "./day-formats.ts";
import { personPanelId } from "./person-editing.tsx";
import { timelinePanelId } from "./person-timeline.tsx";
import { today } from "./today.ts";

setUpEachTest();

const team = {
  id: "00000000-0000-4000-8000-0000000000f1",
  name: "Fictional Pier",
};

// Sasha's timeline, earliest first: she filled a hire, started reporting to Robin, then to Uma, joined a team, and will lead it.
const timeline = () =>
  Response.json({
    days: [
      {
        day: "2019-12-02",
        changes: [
          {
            field: "filled",
            value: { id: "h1", name: "HIRE-42", keyNumber: 42 },
          },
        ],
      },
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
// The place in the stack of panels that holds a panel.
const stackItemOf = (panel: HTMLElement | null) =>
  (panel as HTMLElement).closest("[class*='stackItem']") as HTMLElement;

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
    ).toEqual(["Jan 4, 2099", "Mar 1, 2024", "Jan 1, 2020", "Dec 2, 2019"]);
  });

  // The timeline open beside Sasha's details, as its address keeps it.
  const openedTimeline = async (
    more: Record<string, () => Response> = {},
    address = "/people?open=E2&timeline=true",
  ) => {
    editAnswers({
      "GET /api/feature-teams": () => Response.json({ teams: [] }),
      "GET /api/people/2/timeline": timeline,
      ...more,
    });
    const history = renderApp(address);
    await waitFor(() => {
      expect(timelinePanel()).not.toBeNull();
    });
    return { history, inPanel: within(timelinePanel() as HTMLElement) };
  };

  it("moves People to a day from its date, which a later day can't for a role that doesn't see later dates", async () => {
    const { history, inPanel } = await openedTimeline();
    const past = await inPanel.findByRole("button", { name: "Mar 1, 2024" });

    expect(inPanel.getByText("Jan 4, 2099").closest("button")).toBeNull();
    await userEvent.click(past);

    expect(history.location.search).toContain("day=2024-03-01");
  });

  it("shows its dates as plain words for a role that doesn't see other days", async () => {
    const { inPanel } = await openedTimeline({
      "GET /api/session": () =>
        Response.json({
          ...fictionalUser,
          permissions: ["people:view", "personal:view", "plan:view"],
          settings: {
            ...fictionalUser.settings,
            dataClasses: {
              ...fictionalUser.settings.dataClasses,
              managerHistory: "confidential",
            },
          },
        }),
    });

    await inPanel.findByText("Mar 1, 2024");
    expect(inPanel.queryByRole("button", { name: "Mar 1, 2024" })).toBeNull();
  });

  it("takes the rest of the column under the details, which take only the height they need", async () => {
    await openedTimeline();

    expect(
      stackItemOf(document.getElementById(personPanelId)).className,
    ).toMatch(/stackItemFitted/u);
    expect(stackItemOf(timelinePanel()).className).not.toMatch(
      /stackItemFitted/u,
    );
  });

  it("covers the details on a narrow screen, opened from an address naming both", async () => {
    onNarrowScreen();
    await openedTimeline();

    expect(
      stackItemOf(document.getElementById(personPanelId)).className,
    ).toMatch(/stackItemBehind/u);
    expect(stackItemOf(timelinePanel()).className).not.toMatch(
      /stackItemBehind/u,
    );
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

  it("says when it can't be read, offering Try again in the preview and the panel", async () => {
    let failing = true;
    const { inPanel } = await openedTimeline({
      "GET /api/people/2/timeline": () =>
        failing
          ? Response.json({ error: "Fictional failure" }, { status: 500 })
          : timeline(),
    });

    await userEvent.click(
      await within(preview()).findByRole("button", { name: "Try again" }),
    );
    await inPanel.findByRole("button", { name: "Try again" });
    failing = false;
    await userEvent.click(
      await inPanel.findByRole("button", { name: "Try again" }),
    );

    expect(await inPanel.findByText("Mar 1, 2024")).toBeDefined();
    expect(
      within(preview()).queryByRole("button", { name: "Try again" }),
    ).toBeNull();
  });

  it("opens a filled hire by its key", async () => {
    const { history, inPanel } = await openedTimeline({
      "GET /api/go/hire/42": () =>
        Response.json({ error: "Not found" }, { status: 404 }),
    });

    await userEvent.click(
      await inPanel.findByRole("button", { name: "#HIRE-42" }),
    );

    await waitFor(() => {
      expect(history.location.pathname).toBe("/go/hire/42");
    });
  });

  it("shows as plain words the records the role can't open: someone not among the people, a team without feature teams, a hire without its key", async () => {
    editAnswers({
      "GET /api/session": session([
        "people:view",
        "personal:view",
        "plan:view",
      ]),
      "GET /api/people/2/timeline": () =>
        Response.json({
          days: [
            {
              day: "2020-01-01",
              changes: [
                { field: "filled", value: { id: "h1", name: "HIRE-42" } },
                {
                  field: "manager",
                  value: { id: "77", name: "Fictional Gone" },
                },
                { field: "featureTeams", value: team, part: "added" },
              ],
            },
          ],
        }),
    });
    renderApp("/people?open=E2&timeline=true");
    await waitFor(() => {
      expect(timelinePanel()).not.toBeNull();
    });
    const inPanel = within(timelinePanel() as HTMLElement);

    await inPanel.findByText("Fictional Gone");
    expect(
      inPanel.queryByRole("button", { name: "Fictional Gone" }),
    ).toBeNull();
    expect(inPanel.queryByRole("button", { name: team.name })).toBeNull();
    expect(inPanel.queryByRole("button", { name: "#HIRE-42" })).toBeNull();
  });

  it("moves People back to today from today's date", async () => {
    editAnswers({
      "GET /api/feature-teams": () => Response.json({ teams: [] }),
      "GET /api/people/2/timeline": () =>
        Response.json({
          days: [{ day: today(), changes: [{ field: "start" }] }],
        }),
      "GET /api/people?on=2024-03-01": peopleAnswer(),
    });
    const history = renderApp("/people?open=E2&timeline=true&day=2024-03-01");
    await waitFor(() => {
      expect(timelinePanel()).not.toBeNull();
    });

    await userEvent.click(
      await within(timelinePanel() as HTMLElement).findByRole("button", {
        name: formatDay(today()),
      }),
    );

    await waitFor(() => {
      expect(history.location.search).not.toContain("day=");
    });
  });

  describe("on a day someone isn't employed", () => {
    // Sasha's timeline open on a day People doesn't list her.
    const notEmployed = () =>
      openedTimeline(
        {
          "GET /api/people?on=2019-06-03": peopleAnswer([robin, uma]),
          "GET /api/people": peopleAnswer(),
        },
        "/people?open=E2&timeline=true&day=2019-06-03",
      );

    it("keeps the timeline open beside the line saying so, with every day of their changes", async () => {
      const { inPanel } = await notEmployed();

      expect(
        await screen.findByText(
          /Sasha Fictional isn't employed on Jun 3, 2019\./u,
        ),
      ).toBeDefined();
      expect(
        inPanel.getAllByRole("term").map(({ textContent }) => textContent),
      ).toEqual(["Jan 4, 2099", "Mar 1, 2024", "Jan 1, 2020", "Dec 2, 2019"]);
    });

    it("ends the details with the Timeline section employed people have, focus going back to its Show timeline once closed and to the title once opened again", async () => {
      const { history } = await notEmployed();
      await waitFor(() => {
        expect(
          within(preview())
            .getAllByRole("term")
            .map(({ textContent }) => textContent),
        ).toEqual(["Dec 2, 2019"]);
      });
      await userEvent.click(
        screen.getByRole("button", { name: "Close timeline" }),
      );
      expect(timelinePanel()).toBeNull();
      await waitFor(() => {
        expect(document.activeElement?.textContent).toBe("Show timeline");
      });

      await userEvent.click(
        await screen.findByRole("button", { name: "Show timeline" }),
      );

      await waitFor(() => {
        expect(document.activeElement?.textContent).toBe("Timeline");
      });
      expect(history.location.search).toContain("timeline=true");
    });
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
