// SPDX-License-Identifier: Apache-2.0

// Tests for reporting teams on the Org chart page: their colours and names, changed from managers'
// cards and the Teams panel as drafts.

import type { OrgChartPerson } from "@fathom/shared";
import { screen, waitFor, within } from "@testing-library/react";
import { userEvent } from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import {
  fictionalUser,
  renderApp,
  serverAnswers,
  changesSent,
} from "./test-support.tsx";
import {
  setUpEachTest,
  person,
  people,
  chartJson,
  chartAnswer,
  showLevels,
  openChart,
  card,
  liveCopyOf,
} from "./test-org-chart-page.tsx";

setUpEachTest();

describe("the org chart", () => {
  // The chart for one who may change people and their teams, with the answers given added.
  function openAsEditor(
    answers: Record<string, () => Response>,
    chart: readonly OrgChartPerson[] = people,
  ) {
    const fetch = serverAnswers({
      "GET /api/session": () =>
        Response.json({
          ...fictionalUser,
          permissions: ["people:view", "feature-teams:view", "people:edit"],
        }),
      "GET /api/unpublished": () => Response.json({ changes: [] }),
      "GET /api/org-chart": () => chartJson({ people: chart }),
      ...answers,
    });
    renderApp("/org-chart");
    return fetch;
  }

  it("draws each team in its colour, reaching down to teams with none, even when a team is shown alone, whose top has no band", async () => {
    const coloured = [
      person("p1", "Robin Fictional", null, {
        teamName: "Fictional top team",
        teamColour: "teal",
      }),
      person("p2", "Sasha Fictional", "p1", {
        teamName: "Fictional team",
        teamColour: "grape",
      }),
      person("p3", "Tatum Fictional", "p2"),
      person("p4", "Uma Fictional", "p3"),
    ];
    const colourOf = (name: string) =>
      card(name)
        .querySelector<HTMLElement>("[data-coloured]")
        ?.style.getPropertyValue("--team-colour") ?? null;
    await openChart(() => chartJson({ people: coloured }));
    await screen.findByRole("link", { name: "Robin Fictional" });
    expect(colourOf("Robin Fictional")).toBeNull();
    expect(colourOf("Sasha Fictional")).toBe(
      "var(--mantine-color-teal-filled)",
    );
    expect(colourOf("Tatum Fictional")).toBe(
      "var(--mantine-color-grape-filled)",
    );
    expect(colourOf("Uma Fictional")).toBe("var(--mantine-color-grape-filled)");
    await userEvent.click(
      screen.getByRole("button", {
        name: "Show only the team of Tatum Fictional",
      }),
    );
    await screen.findByText("Only the team of Tatum Fictional is shown.");
    expect(colourOf("Uma Fictional")).toBe("var(--mantine-color-grape-filled)");
    expect(colourOf("Tatum Fictional")).toBeNull();
  });

  it("lets those who may change teams choose a named team's colour from its manager's card, and undo it", async () => {
    let colour: string | null = null;
    const fetch = serverAnswers({
      "GET /api/session": () =>
        Response.json({
          ...fictionalUser,
          permissions: ["people:view", "feature-teams:view", "people:edit"],
        }),
      "GET /api/unpublished": () => Response.json({ changes: [] }),
      "GET /api/org-chart": () =>
        chartJson({
          people: people.map((one) =>
            one.id === "p2" ? { ...one, teamColour: colour } : one,
          ),
        }),
      "PUT /api/org-chart/teams/p2/colour": () =>
        new Response(null, {
          status: 204,
        }),
    });
    renderApp("/org-chart");
    await showLevels("All levels");
    await screen.findByRole("link", { name: "Tatum Fictional" });
    expect(
      screen.queryByRole("button", { name: /^Colour of Robin Fictional/ }),
    ).toBeNull();
    await userEvent.click(
      screen.getByRole("button", { name: /^Colour of Fictional team:/ }),
    );
    colour = "grape";
    await userEvent.click(
      await screen.findByRole("menuitem", { name: "Grape" }),
    );
    expect(changesSent(fetch, "PUT").map(([, body]) => body)).toEqual([
      { colour: "grape" },
    ]);
    expect(
      await screen.findByText("Fictional team is now drawn in Grape."),
    ).toBeDefined();
    expect(
      card("Tatum Fictional")
        .querySelector<HTMLElement>("[data-coloured]")
        ?.style.getPropertyValue("--team-colour"),
    ).toBe("var(--mantine-color-grape-filled)");
    colour = null;
    await userEvent.click(screen.getByRole("button", { name: "Undo" }));
    expect(changesSent(fetch, "PUT").map(([, body]) => body)).toEqual([
      { colour: "grape" },
      { colour: null },
    ]);
  });

  it("lets those who change people rename a team from its manager's card, as a draft", async () => {
    const fetch = serverAnswers({
      "GET /api/session": () =>
        Response.json({
          ...fictionalUser,
          permissions: ["people:view", "feature-teams:view", "people:edit"],
        }),
      "GET /api/unpublished": () => Response.json({ changes: [] }),
      "GET /api/org-chart": chartAnswer,
      "PATCH /api/people/p2": () =>
        Response.json({ changeSetId: "00000000-0000-4000-8000-000000000002" }),
    });
    renderApp("/org-chart");
    await screen.findByRole("link", { name: "Sasha Fictional" });
    expect(
      screen.queryByRole("button", {
        name: "Add a name for the team of Robin Fictional",
      }),
    ).toBeNull();
    await userEvent.click(
      screen.getByRole("button", { name: "Rename Fictional team" }),
    );
    const field = await screen.findByRole("textbox", {
      name: /Team name/,
    });
    await userEvent.clear(field);
    await userEvent.type(field, "Harbour Crew{Enter}");
    expect(
      await screen.findByText(
        "Draft saved. The team's name becomes Harbour Crew once approved.",
      ),
    ).toBeDefined();
    const patch = fetch.mock.calls.find(
      ([url, init]) => url === "/api/people/p2" && init?.method === "PATCH",
    );
    expect(JSON.parse(patch?.[1]?.body as string)).toEqual({
      teamName: "Harbour Crew",
    });
  });

  it("lists every manager's team in the Teams panel, where an unnamed one can be named", async () => {
    serverAnswers({
      "GET /api/session": () =>
        Response.json({
          ...fictionalUser,
          permissions: ["people:view", "feature-teams:view", "people:edit"],
        }),
      "GET /api/unpublished": () => Response.json({ changes: [] }),
      "GET /api/org-chart": chartAnswer,
    });
    renderApp("/org-chart");
    await screen.findByRole("link", { name: "Sasha Fictional" });
    await userEvent.click(screen.getByRole("button", { name: "Teams" }));
    const panel = await screen.findByRole("dialog", { name: "Teams" });
    expect(
      within(panel).getByRole("button", { name: /^Colour of Fictional team:/ }),
    ).toBeDefined();
    expect(within(panel).getByText("Led by Sasha Fictional")).toBeDefined();
    expect(
      within(panel).getByRole("button", {
        name: "Add a name for the team of Robin Fictional",
      }).textContent,
    ).toBe("Add a name");
  });

  it("orders named teams by name, and offers no colour menu for a team named only in a draft", async () => {
    serverAnswers({
      "GET /api/session": () =>
        Response.json({
          ...fictionalUser,
          permissions: ["people:view", "feature-teams:view", "people:edit"],
        }),
      "GET /api/unpublished": () => Response.json({ changes: [] }),
      "GET /api/org-chart": () =>
        chartJson({
          people: people.map((one) =>
            one.id === "p1"
              ? {
                  ...one,
                  teamColour: "grape",
                  draft: {
                    teamName: "Fictional board",
                    state: "waiting",
                    unpublished: false,
                  },
                }
              : one,
          ),
        }),
    });
    renderApp("/org-chart");
    await screen.findByRole("link", { name: "Sasha Fictional" });
    await userEvent.click(screen.getByRole("button", { name: "Teams" }));
    const panel = await screen.findByRole("dialog", { name: "Teams" });
    const text = panel.textContent;
    expect(text.indexOf("Fictional board")).toBeLessThan(
      text.indexOf("Fictional team"),
    );
    expect(
      within(panel).queryByRole("button", {
        name: /^Colour of Fictional board/,
      }),
    ).toBeNull();
  });

  it("marks a drafted team name in the Teams panel, with the live one under it", async () => {
    serverAnswers({
      "GET /api/session": () =>
        Response.json({
          ...fictionalUser,
          permissions: ["people:view", "feature-teams:view", "people:edit"],
        }),
      "GET /api/unpublished": () => Response.json({ changes: [] }),
      "GET /api/org-chart": () =>
        chartJson({
          people: people.map((one) =>
            one.id === "p2"
              ? {
                  ...one,
                  draft: {
                    teamName: "Fictional crew",
                    state: "waiting",
                    unpublished: false,
                  },
                }
              : one,
          ),
        }),
    });
    renderApp("/org-chart");
    await screen.findByRole("link", { name: "Sasha Fictional" });
    await userEvent.click(screen.getByRole("button", { name: "Teams" }));
    const panel = await screen.findByRole("dialog", { name: "Teams" });
    expect(within(panel).getByText("Fictional crew")).toBeDefined();
    expect(within(panel).getByText(", Draft")).toBeDefined();
    expect(within(panel).getByText("Fictional team")).toBeDefined();
    expect(within(panel).getByText(", live")).toBeDefined();
  });

  it("shows those who may change teams a name drafted to come off, and a Live copy in its team's colour, and goes back to drafts beside live", async () => {
    const history = await openChart(() =>
      chartJson({
        people: people.map((one) =>
          one.id === "p2"
            ? {
                ...one,
                teamColour: "teal",
                draft: { teamName: null, state: "waiting", unpublished: false },
              }
            : one.id === "p4"
              ? {
                  ...one,
                  draft: {
                    managerId: "p2",
                    state: "waiting",
                    unpublished: false,
                  },
                }
              : one,
        ),
      }),
    );
    await screen.findByRole("link", { name: "Sasha Fictional" });
    expect(within(card("Sasha Fictional")).getByText("No name")).toBeDefined();
    expect(
      liveCopyOf("Uma Fictional").querySelector("[data-coloured]"),
    ).not.toBeNull();
    await userEvent.click(
      screen.getByRole("button", { name: "Draft: Drafts & Live" }),
    );
    await userEvent.click(
      await screen.findByRole("menuitem", { name: "Drafts applied" }),
    );
    expect(history.location.search).toContain("show=drafts");
    await userEvent.click(
      await screen.findByRole("menuitem", { name: "Drafts & Live" }),
    );
    expect(history.location.search).not.toContain("show=");
  });

  it("lets those who may change teams colour them, from cards and the Teams panel", async () => {
    serverAnswers({
      "GET /api/session": () =>
        Response.json({
          ...fictionalUser,
          permissions: ["people:view", "feature-teams:view", "people:edit"],
        }),
      "GET /api/unpublished": () => Response.json({ changes: [] }),
      "GET /api/org-chart": chartAnswer,
    });
    renderApp("/org-chart");
    await screen.findByRole("link", { name: "Sasha Fictional" });
    expect(
      screen.getByRole("button", { name: /^Colour of Fictional team:/ }),
    ).toBeDefined();
    await userEvent.click(screen.getByRole("button", { name: "Teams" }));
    const panel = await screen.findByRole("dialog", { name: "Teams" });
    expect(within(panel).getByText("Fictional team")).toBeDefined();
  });

  it("takes a team's colour away with No colour", async () => {
    const fetch = openAsEditor(
      {
        "PUT /api/org-chart/teams/p2/colour": () =>
          new Response(null, { status: 204 }),
      },
      people.map((one) =>
        one.id === "p2" ? { ...one, teamColour: "teal" as const } : one,
      ),
    );
    await userEvent.click(
      await screen.findByRole("button", {
        name: "Colour of Fictional team: Teal",
      }),
    );
    await userEvent.click(
      await screen.findByRole("menuitem", { name: "No colour" }),
    );
    expect(
      await screen.findByText("Fictional team no longer has a colour."),
    ).toBeDefined();
    expect(changesSent(fetch, "PUT").map(([, body]) => body)).toEqual([
      { colour: null },
    ]);
  });

  it("says so, and keeps the colour, when it cannot be changed", async () => {
    openAsEditor({
      "PUT /api/org-chart/teams/p2/colour": () =>
        new Response(null, { status: 500 }),
    });
    await userEvent.click(
      await screen.findByRole("button", { name: /^Colour of Fictional team:/ }),
    );
    await userEvent.click(
      await screen.findByRole("menuitem", { name: "Lime" }),
    );
    expect(
      await screen.findByText(/could not change the colour of Fictional team/),
    ).toBeDefined();
    expect(card("Sasha Fictional").querySelector("[data-coloured]")).toBeNull();
  });

  it("empties the name with the ×, and changes nothing on Cancel", async () => {
    const fetch = openAsEditor({});
    await userEvent.click(
      await screen.findByRole("button", { name: "Rename Fictional team" }),
    );
    const field = await screen.findByRole<HTMLInputElement>("textbox", {
      name: "Team name",
    });
    await userEvent.click(
      screen.getByRole("button", { name: "Clear the name" }),
    );
    expect(field.value).toBe("");
    expect(screen.queryByRole("button", { name: "Clear the name" })).toBeNull();
    await userEvent.click(screen.getByRole("button", { name: "Cancel" }));
    expect(fetch.mock.calls.some(([, init]) => init?.method === "PATCH")).toBe(
      false,
    );
  });

  it("says so when a team's name cannot be changed", async () => {
    openAsEditor({
      "PATCH /api/people/p2": () => new Response(null, { status: 500 }),
    });
    await userEvent.click(
      await screen.findByRole("button", { name: "Rename Fictional team" }),
    );
    const field = await screen.findByRole("textbox", { name: "Team name" });
    await userEvent.clear(field);
    await userEvent.type(field, "Harbour Crew{Enter}");
    expect(
      await screen.findByText(/could not change the name of Fictional team/),
    ).toBeDefined();
  });

  it("closes the Teams panel", async () => {
    openAsEditor({});
    await userEvent.click(await screen.findByRole("button", { name: "Teams" }));
    await screen.findByRole("dialog", { name: "Teams" });
    await userEvent.keyboard("{Escape}");
    await waitFor(() => {
      expect(screen.queryByRole("dialog", { name: "Teams" })).toBeNull();
    });
  });

  it("does nothing when the colour chosen is the team's already", async () => {
    const fetch = openAsEditor(
      {},
      people.map((one) =>
        one.id === "p2" ? { ...one, teamColour: "teal" as const } : one,
      ),
    );
    await userEvent.click(
      await screen.findByRole("button", { name: /^Colour of Fictional team:/ }),
    );
    await userEvent.click(
      await screen.findByRole("menuitem", { name: /Teal/ }),
    );
    expect(changesSent(fetch, "PUT")).toEqual([]);
  });

  it("removes a team's name as a draft when the field is emptied, and saves nothing unchanged", async () => {
    const fetch = openAsEditor({
      "PATCH /api/people/p2": () =>
        Response.json({ changeSetId: "00000000-0000-4000-8000-000000000002" }),
    });
    const rename = await screen.findByRole("button", {
      name: "Rename Fictional team",
    });
    await userEvent.click(rename);
    await userEvent.click(await screen.findByRole("button", { name: "Save" }));
    expect(fetch.mock.calls.some(([, init]) => init?.method === "PATCH")).toBe(
      false,
    );
    await userEvent.click(rename);
    await userEvent.click(
      await screen.findByRole("button", { name: "Clear the name" }),
    );
    await userEvent.click(screen.getByRole("button", { name: "Save" }));
    expect(
      await screen.findByText(
        "Draft saved. The team's name comes off once approved.",
      ),
    ).toBeDefined();
    const patch = fetch.mock.calls.find(([, init]) => init?.method === "PATCH");
    expect(JSON.parse(patch?.[1]?.body as string)).toEqual({ teamName: "" });
  });

  it("names an unnamed team from the Teams panel, as a draft", async () => {
    const fetch = openAsEditor({
      "PATCH /api/people/p1": () =>
        Response.json({ changeSetId: "00000000-0000-4000-8000-000000000002" }),
    });
    await userEvent.click(await screen.findByRole("button", { name: "Teams" }));
    const panel = await screen.findByRole("dialog", { name: "Teams" });
    await userEvent.click(
      within(panel).getByRole("button", {
        name: "Add a name for the team of Robin Fictional",
      }),
    );
    const field = await screen.findByRole<HTMLInputElement>("textbox", {
      name: "Team name",
    });
    expect(field.value).toBe("");
    await userEvent.type(field, "Fictional top team{Enter}");
    expect(
      await screen.findByText(
        "Draft saved. The team's name becomes Fictional top team once approved.",
      ),
    ).toBeDefined();
    const patch = fetch.mock.calls.find(([, init]) => init?.method === "PATCH");
    expect(JSON.parse(patch?.[1]?.body as string)).toEqual({
      teamName: "Fictional top team",
    });
  });

  it("offers no colour menu, renaming or Teams panel to those who cannot change people", async () => {
    await openChart();
    await screen.findByRole("link", { name: "Sasha Fictional" });
    expect(screen.queryByRole("button", { name: "Teams" })).toBeNull();
    expect(
      screen.queryByRole("button", { name: /^Colour of Fictional team:/ }),
    ).toBeNull();
    expect(
      screen.queryByRole("button", { name: "Rename Fictional team" }),
    ).toBeNull();
  });
});
