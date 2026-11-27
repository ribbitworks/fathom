// SPDX-License-Identifier: Apache-2.0

// Tests for changing feature teams from the Org chart page as drafts: adding, renaming, leads,
// members and colours, on another day, with Live only, and the server's refusals.

import { screen, waitFor, within } from "@testing-library/react";
import { userEvent } from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { fictionalUser, serverAnswers, changesSent } from "./test-support.tsx";
import {
  setUpEachTest,
  chartJson,
  chartAnswer,
  openFeatureTeams,
  teamPanel,
  rowText,
  teams,
  featureTeam,
  lighthouse,
  quay,
  openTeamPanel,
} from "./test-org-chart-page.tsx";

setUpEachTest();

describe("feature teams on the org chart", () => {
  const beacon = "00000000-0000-4000-8000-0000000000f3";
  const changeSet = "00000000-0000-4000-8000-0000000000c1";
  const undone = "00000000-0000-4000-8000-0000000000c2";

  const session = (permissions: string[]) => () =>
    Response.json({ ...fictionalUser, permissions });
  // The server sends the permissions editing implies, as here viewing Personal details.
  const editor = session([
    "people:view",
    "feature-teams:view",
    "feature-teams:edit",
    "people:edit",
    "personal:view",
    "personal:edit",
  ]);
  const saved =
    (changeSetId: string | null = changeSet) =>
    () =>
      Response.json({ changeSetId });

  // Ticks or unticks each person named in a team's Members row, then finishes.
  async function changeMembers(panel: HTMLElement, names: RegExp[]) {
    await userEvent.click(
      within(panel).getByRole("button", { name: "Change Members" }),
    );
    for (const name of names) {
      await userEvent.click(await screen.findByRole("option", { name }));
    }
    await userEvent.keyboard("{Enter}");
  }

  it("offers no adding of teams with Live only", async () => {
    await openFeatureTeams({
      signedInAs: editor,
      path: "/org-chart?teams=feature&show=live",
    });
    await userEvent.click(
      await screen.findByRole("button", { name: "Feature teams" }),
    );
    await screen.findByRole("menuitem", { name: "Fictional Quay" });
    expect(
      screen.queryByRole("menuitem", { name: "New feature team" }),
    ).toBeNull();
  });

  it("lists with Live only no team a draft only adds", async () => {
    await openFeatureTeams({
      path: "/org-chart?teams=feature&show=live",
      shown: [
        ...teams,
        featureTeam({
          id: "f0000000-0000-4000-8000-0000000000b1",
          name: "Fictional Beacon",
          draft: {
            action: "created",
            changed: [],
            live: {},
            state: "waiting",
            madeBy: "Fictional Editor",
            madeAt: "2026-10-30T15:00:00.000Z",
          },
        }),
      ],
    });
    await userEvent.click(
      await screen.findByRole("button", { name: "Feature teams" }),
    );
    await screen.findByRole("menuitem", { name: "Fictional Quay" });
    expect(
      screen.queryByRole("menuitem", { name: /Fictional Beacon/ }),
    ).toBeNull();
  });

  it("marks with Live only a member a waiting draft takes off the team", async () => {
    await openFeatureTeams({
      path: "/org-chart?teams=feature&show=live",
      shown: [
        {
          ...teams[0],
          members: ["p2"],
          draft: {
            action: "changed",
            changed: ["members"],
            live: { members: ["p2", "p4"] },
            state: "waiting",
            madeBy: "Fictional Editor",
            madeAt: "2026-10-30T15:00:00.000Z",
          },
        },
      ],
    });
    const uma = await screen.findByRole("link", { name: "Uma Fictional" });
    expect(
      within(uma.closest("div.react-flow__node") as HTMLElement).getByText(
        /Live\. Its removal is waiting for approval\./,
      ),
    ).toBeDefined();
  });

  it("adds a team, opening it, and undoes it with Cmd+Z", async () => {
    let shown = teams;
    const { fetch, history } = await openFeatureTeams({
      signedInAs: editor,
      answers: {
        "GET /api/feature-teams": () => Response.json({ teams: shown }),
        "POST /api/feature-teams": () => {
          shown = [
            ...teams,
            featureTeam({ id: beacon, name: "Fictional Beacon" }),
          ];
          return Response.json({ id: beacon, changeSetId: changeSet });
        },
        [`POST /api/undo/${changeSet}`]: saved(undone),
      },
    });
    await userEvent.click(
      await screen.findByRole("button", { name: "Feature teams" }),
    );
    await userEvent.click(
      await screen.findByRole("menuitem", { name: "New feature team" }),
    );
    const form = await screen.findByRole("region", {
      name: "New feature team",
    });
    await userEvent.type(
      within(form).getByRole("textbox", { name: "Name" }),
      "Fictional Beacon",
    );
    await userEvent.click(within(form).getByRole("button", { name: "Add" }));
    const panel = await teamPanel();
    await waitFor(() => {
      expect(rowText(panel, "Name")).toBe("Fictional Beacon");
    });
    expect(history.location.search).toContain(`featureTeam=${beacon}`);
    expect(changesSent(fetch, "POST")).toEqual([
      [
        "/api/feature-teams",
        { name: "Fictional Beacon", leadId: null, members: [] },
      ],
    ]);
    await userEvent.keyboard("{Meta>}z{/Meta}");
    await waitFor(() => {
      expect(changesSent(fetch, "POST")).toHaveLength(2);
    });
    expect(changesSent(fetch, "POST")[1]).toEqual([
      `/api/undo/${changeSet}`,
      {},
    ]);
  });

  it("leaves a team just added alone with Cmd+Z while a view is being named", async () => {
    // Given a team added, and the Save view dialog open
    const { fetch } = await openFeatureTeams({
      signedInAs: editor,
      answers: {
        "POST /api/feature-teams": () =>
          Response.json({ id: beacon, changeSetId: changeSet }),
        [`POST /api/undo/${changeSet}`]: saved(undone),
      },
    });
    await userEvent.click(
      await screen.findByRole("button", { name: "Feature teams" }),
    );
    await userEvent.click(
      await screen.findByRole("menuitem", { name: "New feature team" }),
    );
    const form = await screen.findByRole("region", {
      name: "New feature team",
    });
    await userEvent.type(
      within(form).getByRole("textbox", { name: "Name" }),
      "Fictional Beacon",
    );
    await userEvent.click(within(form).getByRole("button", { name: "Add" }));
    await waitFor(() => {
      expect(changesSent(fetch, "POST")).toHaveLength(1);
    });
    await userEvent.click(
      screen.getByRole("button", { name: "Views, changed" }),
    );
    await userEvent.click(
      await screen.findByRole("menuitem", { name: "Save view…" }),
    );
    await screen.findByRole("dialog", { name: "Save view" });

    // When Cmd+Z is pressed
    await userEvent.keyboard("{Meta>}z{/Meta}");

    // Then nothing is undone until the dialog closes
    expect(changesSent(fetch, "POST")).toHaveLength(1);
    await userEvent.keyboard("{Escape}");
    await waitFor(async () => {
      await userEvent.keyboard("{Meta>}z{/Meta}");
      expect(changesSent(fetch, "POST")[1]).toEqual([
        `/api/undo/${changeSet}`,
        {},
      ]);
    });
  });

  it("says so when a team cannot be added", async () => {
    await openFeatureTeams({
      signedInAs: editor,
      answers: {
        "POST /api/feature-teams": () =>
          Response.json({ error: "Down" }, { status: 500 }),
      },
    });
    await userEvent.click(
      await screen.findByRole("button", { name: "Feature teams" }),
    );
    await userEvent.click(
      await screen.findByRole("menuitem", { name: "New feature team" }),
    );
    const form = await screen.findByRole("region", {
      name: "New feature team",
    });
    await userEvent.type(
      within(form).getByRole("textbox", { name: "Name" }),
      "Fictional Beacon",
    );
    await userEvent.click(within(form).getByRole("button", { name: "Add" }));
    expect(
      await screen.findByText("Fathom could not add Fictional Beacon."),
    ).toBeDefined();
  });

  it("closes a new team's form on Cancel", async () => {
    await openFeatureTeams({ signedInAs: editor });
    await userEvent.click(
      await screen.findByRole("button", { name: "Feature teams" }),
    );
    await userEvent.click(
      await screen.findByRole("menuitem", { name: "New feature team" }),
    );
    const form = await screen.findByRole("region", {
      name: "New feature team",
    });
    await userEvent.click(within(form).getByRole("button", { name: "Cancel" }));
    expect(
      screen.queryByRole("region", { name: "New feature team" }),
    ).toBeNull();
  });

  it("saves renaming, the lead, and members as drafts, from an earlier day once given", async () => {
    const team = `/api/feature-teams/${lighthouse}`;
    const { fetch } = await openFeatureTeams({
      signedInAs: editor,
      answers: { [`PATCH ${team}`]: saved() },
    });
    const panel = await openTeamPanel("Fictional Lighthouse");
    await userEvent.click(
      within(panel).getByRole("button", { name: "Change Name" }),
    );
    const name = within(panel).getByRole("textbox", { name: "Name" });
    await userEvent.clear(name);
    await userEvent.type(name, "Fictional Pier{Enter}");
    await userEvent.click(
      within(panel).getByRole("button", { name: "Change Feature lead" }),
    );
    await userEvent.click(
      await screen.findByRole("option", { name: /^Uma Fictional/ }),
    );
    await changeMembers(panel, [/^Robin Fictional/, /^Uma Fictional/]);
    await waitFor(() => {
      expect(changesSent(fetch, "PATCH")).toHaveLength(3);
    });
    expect(changesSent(fetch, "PATCH")).toEqual(
      [
        { name: "Fictional Pier" },
        { leadId: "p4" },
        { add: ["p1"], remove: ["p4"] },
      ].map((body) => [team, body]),
    );
  });

  describe("on another day", () => {
    const seesDetails = session([
      "people:view",
      "feature-teams:view",
      "personal:view",
      "feature-teams:edit",
    ]);
    const seesChart = session(["people:view", "feature-teams:view"]);
    const onDay = "2025-03-01";
    const teamsOnDay = {
      [`GET /api/feature-teams?on=${onDay}`]: () => Response.json({ teams }),
    };
    const chartOnDay = { [`GET /api/org-chart?on=${onDay}`]: chartAnswer };
    const urls = (fetch: ReturnType<typeof serverAnswers>) =>
      fetch.mock.calls.map(([url]) => url);

    it("draws the chart as of an earlier day, read only, for those who may not change earlier days", async () => {
      const { fetch } = await openFeatureTeams({
        path: `/org-chart?teams=feature&day=${onDay}`,
        signedInAs: seesDetails,
        answers: { ...teamsOnDay, ...chartOnDay },
      });
      await screen.findByRole("link", { name: "Sasha Fictional" });
      expect(urls(fetch)).toContain(`/api/org-chart?on=${onDay}`);
      expect(urls(fetch)).toContain(`/api/feature-teams?on=${onDay}`);
      expect(screen.queryByRole("button", { name: /^Draft/ })).toBeNull();
      const panel = await openTeamPanel("Fictional Lighthouse");
      expect(
        within(panel).queryByRole("button", { name: /^Change / }),
      ).toBeNull();
    });

    it("changes feature teams from a later day shown, with drafts", async () => {
      const later = "2099-03-01";
      const { fetch } = await openFeatureTeams({
        path: `/org-chart?teams=feature&day=${later}`,
        signedInAs: seesDetails,
        answers: {
          [`GET /api/feature-teams?on=${later}`]: () =>
            Response.json({ teams }),
          [`PATCH /api/feature-teams/${lighthouse}`]: saved(),
        },
      });
      expect(
        await screen.findByRole("button", { name: /^Draft/ }),
      ).toBeDefined();
      // People are drawn as today, since later reporting lines need Confidential data.
      expect(urls(fetch)).not.toContain(`/api/org-chart?on=${later}`);
      const panel = await openTeamPanel("Fictional Lighthouse");
      expect(
        within(panel).queryByRole("button", { name: "Change Name" }),
      ).toBeNull();
      expect(
        within(panel).queryByRole("button", { name: "Remove feature team" }),
      ).toBeNull();
      expect(
        within(panel).queryByRole("button", { name: /^Colour of/ }),
      ).toBeNull();
      await userEvent.click(
        within(panel).getByRole("button", { name: "Change Feature lead" }),
      );
      await userEvent.click(
        await screen.findByRole("option", { name: /^Uma Fictional/ }),
      );
      await changeMembers(panel, [/^Robin Fictional/, /^Uma Fictional/]);
      await waitFor(() => {
        expect(changesSent(fetch, "PATCH")).toHaveLength(2);
      });
      expect(changesSent(fetch, "PATCH")).toEqual(
        [
          { leadId: "p4", from: later },
          { add: ["p1"], remove: ["p4"], from: later },
        ].map((body) => [`/api/feature-teams/${lighthouse}`, body]),
      );
    });

    it("changes feature teams from an earlier day for those who may change Personal details", async () => {
      await openFeatureTeams({
        path: `/org-chart?teams=feature&day=${onDay}`,
        signedInAs: editor,
        answers: { ...teamsOnDay, ...chartOnDay },
      });
      expect(
        await screen.findByRole("button", { name: /^Draft/ }),
      ).toBeDefined();
      const panel = await openTeamPanel("Fictional Lighthouse");
      expect(
        within(panel).getByRole("button", { name: "Change Members" }),
      ).toBeDefined();
    });

    it("leaves out the date row, and draws today, for those who do not see Personal details", async () => {
      const { fetch } = await openFeatureTeams({
        path: `/org-chart?teams=feature&day=${onDay}`,
        signedInAs: seesChart,
      });
      await screen.findByRole("link", { name: "Sasha Fictional" });
      expect(screen.queryByRole("button", { name: "Today" })).toBeNull();
      expect(urls(fetch).join(" ")).not.toContain("?on=");
    });

    it("draws today, saying nothing of later dates, for those who do not see Confidential data", async () => {
      const { fetch } = await openFeatureTeams({
        path: "/org-chart?day=2099-03-01",
        signedInAs: seesDetails,
      });
      expect(
        await screen.findByRole("button", { name: "Today" }),
      ).toBeDefined();
      expect(urls(fetch).join(" ")).not.toContain("?on=");
    });

    it("ignores a date that does not exist", async () => {
      const { fetch } = await openFeatureTeams({
        path: "/org-chart?teams=feature&day=2025-02-30",
        signedInAs: seesDetails,
      });
      await screen.findByRole("button", { name: "Today" });
      expect(urls(fetch).join(" ")).not.toContain("?on=");
    });

    it("draws reporting teams on that day, read only, for those who see Personal details", async () => {
      const { fetch } = await openFeatureTeams({
        path: `/org-chart?day=${onDay}`,
        signedInAs: seesDetails,
        answers: chartOnDay,
      });
      await screen.findByRole("link", { name: "Sasha Fictional" });
      expect(urls(fetch)).toContain(`/api/org-chart?on=${onDay}`);
      expect(screen.queryByRole("button", { name: /^Draft/ })).toBeNull();
    });

    it.each([
      [
        "nobody was on it",
        () => chartJson({ people: [] }),
        "Nobody is on the org chart yet.",
      ],
      [
        "it cannot load",
        () => Response.json({ error: "Down" }, { status: 500 }),
        "Fathom could not load the org chart.",
      ],
    ])(
      "keeps the date row on a day when %s, to go back to today",
      async (_, answer, said) => {
        const { history } = await openFeatureTeams({
          path: `/org-chart?day=${onDay}`,
          signedInAs: seesDetails,
          answers: { [`GET /api/org-chart?on=${onDay}`]: answer },
        });
        expect(await screen.findByText(said)).toBeDefined();
        await userEvent.click(screen.getByRole("button", { name: "Today" }));
        await waitFor(() => {
          expect(history.location.search).not.toContain("day=");
        });
      },
    );

    it("changes reporting lines from an earlier day for those who change people and Personal details", async () => {
      await openFeatureTeams({
        path: `/org-chart?day=${onDay}`,
        signedInAs: session([
          "people:view",
          "people:edit",
          "feature-teams:view",
          "personal:view",
          "personal:edit",
          "confidential:view",
        ]),
        answers: chartOnDay,
      });
      expect(
        await screen.findByRole("button", { name: /^Draft/ }),
      ).toBeDefined();
      expect(screen.queryByRole("button", { name: "Teams" })).toBeNull();
      expect(
        screen.queryByRole("button", { name: "Rename Fictional team" }),
      ).toBeNull();
    });

    it("draws reporting teams on a later day read only, even for those who change Personal details", async () => {
      const later = "2099-03-01";
      await openFeatureTeams({
        path: `/org-chart?day=${later}`,
        signedInAs: session([
          "people:view",
          "people:edit",
          "feature-teams:view",
          "personal:view",
          "personal:edit",
          "confidential:view",
        ]),
        answers: { [`GET /api/org-chart?on=${later}`]: chartAnswer },
      });
      await screen.findByRole("link", { name: "Sasha Fictional" });
      expect(screen.queryByRole("button", { name: /^Draft/ })).toBeNull();
    });

    it("offers no date on reporting teams to those who do not", async () => {
      await openFeatureTeams({ path: "/org-chart", signedInAs: seesChart });
      expect(screen.queryByRole("button", { name: "Today" })).toBeNull();
    });

    it("keeps the day when the teams switch changes", async () => {
      const { history } = await openFeatureTeams({
        path: `/org-chart?teams=feature&day=${onDay}`,
        signedInAs: seesDetails,
        answers: { ...teamsOnDay, ...chartOnDay },
      });
      await userEvent.click(
        await screen.findByRole("radio", { name: "Reporting teams" }),
      );
      await waitFor(() => {
        expect(history.location.search).toContain(`day=${onDay}`);
      });
    });

    it("goes back to today", async () => {
      const { history } = await openFeatureTeams({
        path: `/org-chart?teams=feature&day=${onDay}`,
        signedInAs: seesDetails,
        answers: { ...teamsOnDay, ...chartOnDay },
      });
      await userEvent.click(
        await screen.findByRole("button", { name: "Today" }),
      );
      await waitFor(() => {
        expect(history.location.search).not.toContain("day=");
      });
    });
  });

  it("says so when a change cannot be saved", async () => {
    await openFeatureTeams({
      signedInAs: editor,
      answers: {
        [`PATCH /api/feature-teams/${lighthouse}`]: () =>
          Response.json({ error: "Down" }, { status: 500 }),
      },
    });
    const panel = await openTeamPanel("Fictional Lighthouse");
    await changeMembers(panel, [/^Uma Fictional/]);
    expect(
      await screen.findByText(
        "Fathom could not change the members of Fictional Lighthouse.",
      ),
    ).toBeDefined();
  });

  it("says so when the team has been removed by someone else", async () => {
    await openFeatureTeams({
      signedInAs: editor,
      answers: {
        [`DELETE /api/feature-teams/${lighthouse}`]: () =>
          Response.json({ error: "Not found" }, { status: 404 }),
      },
    });
    const panel = await openTeamPanel("Fictional Lighthouse");
    await userEvent.click(
      within(panel).getByRole("button", { name: "Remove feature team" }),
    );
    expect(
      await screen.findByText(
        "Someone else has removed this feature team. The teams have been refreshed.",
      ),
    ).toBeDefined();
  });

  it("resubmits and discards a rejected draft, and removes the team", async () => {
    const team = `/api/feature-teams/${quay}`;
    const { fetch } = await openFeatureTeams({
      signedInAs: editor,
      shown: [
        featureTeam({
          id: quay,
          name: "Fictional Quay",
          members: ["p4"],
          draft: {
            action: "changed",
            changed: ["members"],
            live: { members: [] },
            state: "rejected",
            reason: "Fictional reason",
            madeBy: "Fictional Editor",
            madeAt: "2026-10-30T15:00:00.000Z",
            changedByUser: true,
          },
        }),
      ],
      answers: {
        [`DELETE ${team}/draft/rejection`]: saved(),
        [`DELETE ${team}/draft`]: saved(),
        [`DELETE ${team}`]: saved(null),
      },
    });
    const panel = await openTeamPanel(/^Fictional Quay/);
    for (const action of ["Resubmit", "Discard draft", "Remove feature team"]) {
      await userEvent.click(
        within(panel).getByRole("button", { name: action }),
      );
    }
    await waitFor(() => {
      expect(changesSent(fetch, "DELETE")).toHaveLength(3);
    });
    expect(changesSent(fetch, "DELETE").map(([url]) => url)).toEqual([
      `${team}/draft/rejection`,
      `${team}/draft`,
      team,
    ]);
  });

  it("colours a team from its panel", async () => {
    const { fetch } = await openFeatureTeams({
      signedInAs: editor,
      answers: {
        [`PUT /api/feature-teams/${lighthouse}/colour`]: () =>
          new Response(null, { status: 204 }),
      },
    });
    const panel = await openTeamPanel("Fictional Lighthouse");
    await userEvent.click(
      within(panel).getByRole("button", { name: "Change Colour" }),
    );
    await userEvent.click(
      await screen.findByRole("menuitem", { name: "Grape" }),
    );
    expect(
      await screen.findByText("Fictional Lighthouse now has the colour Grape."),
    ).toBeDefined();
    expect(changesSent(fetch, "PUT")).toEqual([
      [`/api/feature-teams/${lighthouse}/colour`, { colour: "grape" }],
    ]);
  });
});
