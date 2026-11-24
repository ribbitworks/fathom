// SPDX-License-Identifier: Apache-2.0

// Helpers for the Org chart page's tests: fictional people, feature teams and the chart's answers,
// and ways to open the chart or a team's panel, choose its levels, and find a card or a Live copy.

import type { OrgChartPerson } from "@fathom/shared";
import { screen, within, waitFor } from "@testing-library/react";
import { userEvent } from "@testing-library/user-event";
import { afterEach, vi, expect } from "vitest";
import {
  fictionalUser,
  renderApp,
  serverAnswers,
  detailValue,
} from "./test-support.tsx";
import { featureTeamPanelId } from "./feature-team-panel.tsx";

export function setUpEachTest() {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });
}

export const viewer = () =>
  Response.json({
    ...fictionalUser,
    permissions: [
      "people:view",
      "feature-teams:view",
      "plan:view",
      "features:view",
    ],
  });

export const person = (
  id: string,
  preferredName: string,
  managerId: string | null,
  details: Partial<OrgChartPerson> = {},
): OrgChartPerson => ({
  id,
  keyNumber: 1,
  preferredName,
  employeeId: `FX-${id}`,
  position: "Fictional Engineer",
  teamName: null,
  teamColour: null,
  managerId,
  ...details,
});

export const people = [
  person("p1", "Robin Fictional", null, { position: "Fictional Director" }),
  person("p2", "Sasha Fictional", "p1", { teamName: "Fictional team" }),
  person("p3", "Tatum Fictional", "p2", { left: true }),
  person("p4", "Uma Fictional", "p3"),
];

// The chart's answer, drawn the same with drafts applied unless given otherwise.
export const chartJson = ({
  people: shown,
  drafted = shown,
}: {
  people: readonly object[];
  drafted?: readonly object[];
}) => Response.json({ people: shown, drafted });

export const chartAnswer = () => chartJson({ people });

// People's answers, with one of the chart's people on it.
export const peopleAnswers = {
  "GET /api/people": () =>
    Response.json({
      people: [
        {
          id: "p4",
          keyNumber: 1,
          preferredName: "Uma Fictional",
          employeeId: "FX-p4",
          positionId: "position-1",
          values: {},
        },
      ],
      fields: [],
      order: [],
    }),
  "GET /api/lists": () => Response.json({ lists: [] }),
};

export async function showLevels(choice: string) {
  await userEvent.click(
    await screen.findByRole("button", { name: "Show levels" }),
  );
  await userEvent.click(await screen.findByRole("menuitem", { name: choice }));
}

// Opens the chart at the address given, with every level shown unless asked not to.
export async function openChart(
  answer: () => Response = chartAnswer,
  expand = true,
  path = "/org-chart",
) {
  serverAnswers({
    "GET /api/session": viewer,
    "GET /api/org-chart": answer,
    ...peopleAnswers,
  });
  const history = renderApp(path);
  await screen.findByRole("heading", { name: "Org chart" });
  if (expand) await showLevels("All levels");
  return history;
}

export const card = (name: string) =>
  screen
    .getByRole("link", { name })
    .closest("div.react-flow__node") as HTMLElement;

// A person's Live copy on the chart: the card holding their name with no link, since a copy opens
// nothing.
export const liveCopyOf = (name: string) =>
  [...document.querySelectorAll<HTMLElement>("div.react-flow__node")].find(
    (node) =>
      node.textContent.includes(name) &&
      within(node).queryByRole("link", { name }) === null,
  ) as HTMLElement;

export const lighthouse = "00000000-0000-4000-8000-0000000000f1";
export const quay = "00000000-0000-4000-8000-0000000000f2";

export const featureTeam = (fields: object) => ({
  keyNumber: 1,
  colour: null,
  leadId: null,
  members: [],
  names: {},
  ...fields,
});
// Sasha leads one team, Uma is on two, and the other has no lead.
export const teams = [
  featureTeam({
    id: lighthouse,
    name: "Fictional Lighthouse",
    leadId: "p2",
    colour: "teal",
    members: ["p2", "p4"],
  }),
  featureTeam({ id: quay, name: "Fictional Quay", members: ["p4", "p3"] }),
];

type Answers = Parameters<typeof serverAnswers>[0];

export async function openFeatureTeams({
  path = "/org-chart?teams=feature",
  signedInAs = viewer,
  answers = {},
  shown = teams,
}: {
  path?: string;
  signedInAs?: () => Response;
  answers?: Answers;
  shown?: readonly object[];
} = {}) {
  const fetch = serverAnswers({
    "GET /api/session": signedInAs,
    "GET /api/org-chart": chartAnswer,
    "GET /api/feature-teams": () => Response.json({ teams: shown }),
    "GET /api/unpublished": () => Response.json({ changes: [] }),
    ...peopleAnswers,
    ...answers,
  });
  const history = renderApp(path);
  await screen.findByRole("heading", { name: "Org chart" });
  return { fetch, history };
}

// The panel of the feature team open, titled with the team's name, found by its own id.
export const teamPanel = async () => {
  await waitFor(() => {
    expect(document.getElementById(featureTeamPanelId)).not.toBeNull();
  });
  return document.getElementById(featureTeamPanelId) as HTMLElement;
};

// What a row of a panel reads, by its label.
export const rowText = (panel: HTMLElement, label: string) =>
  detailValue(label, panel);

export async function openTeamPanel(name: string | RegExp) {
  await userEvent.click(
    await screen.findByRole("button", { name: "Feature teams" }),
  );
  await userEvent.click(await screen.findByRole("menuitem", { name }));
  return teamPanel();
}
