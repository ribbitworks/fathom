// SPDX-License-Identifier: Apache-2.0

// Tests for feature teams on the Org chart page: drawing them, opening a team or a person from its
// card, finding them by key, and reading a team read only.

import { screen, waitFor, within } from "@testing-library/react";
import { userEvent } from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { featureTeamPanelId } from "./feature-team-panel.tsx";
import {
  setUpEachTest,
  card,
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
  it("switches between reporting and feature teams, keeping the person whose details are open found", async () => {
    const { history } = await openFeatureTeams({
      path: "/org-chart?open=FX-p4",
    });
    await screen.findByRole("region", { name: "Uma Fictional" });
    await userEvent.click(screen.getByRole("radio", { name: "Feature teams" }));
    const params = () => new URLSearchParams(history.location.search);
    expect([
      params().get("teams"),
      params().get("person"),
      params().get("open"),
    ]).toEqual(["feature", "FX-p4", "FX-p4"]);
    expect(
      (await screen.findAllByRole("link", { name: "Uma Fictional" })).length,
    ).toBe(2);
    await userEvent.click(
      screen.getByRole("radio", { name: "Reporting teams" }),
    );
    expect([params().get("teams"), params().get("person")]).toEqual([
      null,
      "FX-p4",
    ]);
  });

  it("draws each team under its lead, or a card naming it while it has none, with its members under it", async () => {
    await openFeatureTeams();
    await screen.findByRole("link", { name: "Sasha Fictional" });
    const own = card("Fictional Quay");
    expect(within(own).getByText("No feature lead")).toBeDefined();
    expect(
      within(own).getByRole("button", { name: "Fictional Quay" }),
    ).toBeDefined();
    expect(
      within(card("Sasha Fictional")).getByRole("button", {
        name: "Fictional Lighthouse",
      }),
    ).toBeDefined();
    expect(screen.getAllByRole("link", { name: "Uma Fictional" }).length).toBe(
      2,
    );
    expect(screen.queryByRole("link", { name: "Robin Fictional" })).toBeNull();
    expect(
      screen.getByRole("button", { name: "Hide 1 member of Sasha Fictional" }),
    ).toBeDefined();
    await userEvent.click(
      screen.getByRole("button", { name: "Hide 2 members of Fictional Quay" }),
    );
    expect(screen.getAllByRole("link", { name: "Uma Fictional" }).length).toBe(
      1,
    );
    expect(
      screen.queryByRole("button", { name: /^Show only the team of/ }),
    ).toBeNull();
  });

  it("says so, and draws nothing, when there are no feature teams", async () => {
    await openFeatureTeams({ shown: [] });
    await userEvent.click(
      await screen.findByRole("button", { name: "Feature teams" }),
    );
    expect(await screen.findByText("No feature teams yet")).toBeDefined();
    expect(
      screen.queryByRole("menuitem", { name: "New feature team" }),
    ).toBeNull();
    expect(screen.queryByRole("link", { name: "Sasha Fictional" })).toBeNull();
  });

  it("says so when the feature teams cannot load, and tries them again", async () => {
    let fail = true;
    await openFeatureTeams({
      answers: {
        "GET /api/feature-teams": () =>
          fail
            ? Response.json({ error: "Down" }, { status: 500 })
            : Response.json({ teams: [] }),
      },
    });
    const alert = await screen.findByRole("alert");
    expect(alert.textContent).toContain("Fathom could not load the org chart.");
    fail = false;
    await userEvent.click(
      within(alert).getByRole("button", { name: "Try again" }),
    );
    await waitFor(() => {
      expect(screen.queryByRole("alert")).toBeNull();
    });
  });

  it("opens a team from the team name on its lead's card, finding the lead, and closes it", async () => {
    const { history } = await openFeatureTeams();
    await screen.findByRole("link", { name: "Sasha Fictional" });
    await userEvent.click(
      screen.getByRole("button", { name: "Fictional Lighthouse" }),
    );
    const panel = await teamPanel();
    expect(rowText(panel, "Name")).toBe("Fictional Lighthouse");
    expect(history.location.search).toContain(`featureTeam=${lighthouse}`);
    expect(
      card("Sasha Fictional").querySelector("[data-found]"),
    ).not.toBeNull();
    await userEvent.click(
      within(panel).getByRole("button", { name: "Close feature team" }),
    );
    expect(history.location.search).not.toContain("featureTeam=");
    expect(document.getElementById(featureTeamPanelId)).toBeNull();
  });

  it("opens a team with no lead from its own card", async () => {
    const { history } = await openFeatureTeams();
    await userEvent.click(
      await screen.findByRole("link", { name: "Fictional Quay" }),
    );
    await teamPanel();
    expect(history.location.search).toContain(`featureTeam=${quay}`);
    expect(history.location.search).not.toContain("open=");
    expect(card("Fictional Quay").querySelector("[data-found]")).not.toBeNull();
  });

  it("copies a team's link from the menu of its own card", async () => {
    const user = userEvent.setup();
    await openFeatureTeams({
      shown: [
        ...teams.slice(0, 1),
        featureTeam({
          id: quay,
          keyNumber: 6,
          name: "Fictional Quay",
          members: ["p4", "p3"],
        }),
      ],
    });
    await user.pointer({
      keys: "[MouseRight]",
      target: await screen.findByRole("link", { name: "Fictional Quay" }),
    });
    await user.click(
      await screen.findByRole("menuitem", { name: "Copy link" }),
    );
    expect(await navigator.clipboard.readText()).toBe(
      `${window.location.origin}/go/team/6`,
    );
  });

  it.each([
    ["#TEAM-1", "Fictional Lighthouse"],
    ["team-6", "Fictional Quay"],
  ])(
    "finds by the key %s only the team with it, led or not",
    async (typed, name) => {
      await openFeatureTeams({
        shown: [
          ...teams.slice(0, 1),
          featureTeam({
            id: quay,
            keyNumber: 6,
            name: "Fictional Quay",
            members: ["p4", "p3"],
          }),
        ],
      });
      await screen.findByRole("link", { name: "Sasha Fictional" });
      await userEvent.type(
        screen.getByRole("combobox", { name: "Find a person or team" }),
        typed,
      );
      await screen.findByRole("option", {
        name: (label) => label.startsWith(name),
      });
      expect(screen.getAllByRole("option")).toHaveLength(1);
    },
  );

  it("says no team has a team key no team on the chart has", async () => {
    await openFeatureTeams();
    await screen.findByRole("link", { name: "Sasha Fictional" });
    await userEvent.type(
      screen.getByRole("combobox", { name: "Find a person or team" }),
      "#TEAM-40",
    );
    expect(await screen.findByText("No team has that key")).toBeDefined();
  });

  it("opens another team chosen from the Feature teams button while one is open", async () => {
    const { history } = await openFeatureTeams({
      path: `/org-chart?teams=feature&featureTeam=${lighthouse}`,
    });
    await teamPanel();
    const panel = await openTeamPanel("Fictional Quay");
    expect(history.location.search).toContain(`featureTeam=${quay}`);
    expect(rowText(panel, "Name")).toBe("Fictional Quay");
  });

  it("opens a person from their card, with their manager and feature teams in place of their reporting team", async () => {
    const { history } = await openFeatureTeams();
    const [uma] = await screen.findAllByRole("link", { name: "Uma Fictional" });
    await userEvent.click(uma as HTMLElement);
    const details = await screen.findByRole("region", {
      name: "Uma Fictional",
    });
    expect(history.location.search).not.toContain("featureTeam=");
    const reporting = within(details).getByRole("region", {
      name: "Reporting",
    });
    expect(
      [...reporting.querySelectorAll("dt")].map(
        ({ textContent }) => textContent,
      ),
    ).toEqual(["Manager"]);
    const memberships = within(details).getByRole("region", {
      name: "Feature teams",
    });
    expect(
      [...memberships.querySelectorAll("li")].map(
        ({ textContent }) => textContent,
      ),
    ).toEqual([
      "Fictional LighthouseLed by Sasha Fictional",
      "Fictional QuayNo feature lead",
    ]);
    await userEvent.click(
      within(memberships).getByRole("link", { name: "Fictional Quay" }),
    );
    expect(await teamPanel()).toBeDefined();
    expect(screen.getByRole("region", { name: "Uma Fictional" })).toBeDefined();
  });

  it("lists the teams a person leads apart from those they are a member of", async () => {
    await openFeatureTeams({
      path: "/org-chart?teams=feature&open=FX-p4",
      shown: [
        featureTeam({
          id: lighthouse,
          name: "Fictional Lighthouse",
          leadId: "p2",
          members: ["p2", "p4"],
        }),
        featureTeam({
          id: quay,
          name: "Fictional Quay",
          leadId: "p4",
          members: ["p4", "p3"],
        }),
      ],
    });
    const details = await screen.findByRole("region", {
      name: "Uma Fictional",
    });
    const memberships = within(details).getByRole("region", {
      name: "Feature teams",
    });
    expect([
      rowText(memberships, "Leads"),
      rowText(memberships, "Member of"),
    ]).toEqual([
      "Fictional Quay",
      "Fictional LighthouseLed by Sasha Fictional",
    ]);
  });

  it("finds people with the feature team of their card, and a team with no lead as a team", async () => {
    await openFeatureTeams();
    await screen.findByRole("link", { name: "Sasha Fictional" });
    const finder = screen.getByRole("combobox", {
      name: "Find a person or team",
    });
    await userEvent.type(finder, "Fictional");
    await screen.findByRole("option", { name: /^Sasha Fictional/ });
    const options = screen
      .getAllByRole("option")
      .map(({ textContent }) => textContent);
    expect(options).toEqual([
      "Sasha FictionalFictional Lighthouse",
      "Tatum FictionalFictional Quay",
      "Uma FictionalFictional Quay",
      "Uma FictionalFictional Lighthouse",
      "Fictional LighthouseLed by Sasha Fictional",
      "Fictional QuayNo feature lead",
    ]);
    await userEvent.click(
      screen.getByRole("option", { name: /^Fictional Quay/ }),
    );
    expect(card("Fictional Quay").querySelector("[data-found]")).not.toBeNull();
  });

  it("offers those who may not edit feature teams each team read only", async () => {
    await openFeatureTeams();
    await userEvent.click(
      await screen.findByRole("button", { name: "Feature teams" }),
    );
    await screen.findByRole("menuitem", { name: "Fictional Quay" });
    expect(
      screen.queryByRole("menuitem", { name: "New feature team" }),
    ).toBeNull();
    await userEvent.click(
      screen.getByRole("menuitem", { name: "Fictional Lighthouse" }),
    );
    const panel = await teamPanel();
    expect(rowText(panel, "Feature lead")).toBe("Sasha Fictional");
    expect(
      within(panel).queryByRole("button", { name: /^Change / }),
    ).toBeNull();
  });
});
