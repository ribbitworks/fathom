// SPDX-License-Identifier: Apache-2.0

// Tests for opening a planned hire's card on the Org chart page: its own details, or, on a feature
// team, the details of the person filling it.

import {
  act,
  fireEvent,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import { userEvent } from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { serverAnswers, renderApp } from "./test-support.tsx";
import {
  setUpEachTest,
  viewer,
  person,
  people,
  chartJson,
  card,
  openFeatureTeams,
  teams,
} from "./test-org-chart-page.tsx";

setUpEachTest();

// Fathom's own IDs, as long as the server's, since the address keeps a hire by its own.
const hireId = "00000000-0000-4000-8000-0000000000a1";

const opening = person(hireId, "Fictional Opening", "p1", {
  keyNumber: 7,
  employeeId: null,
  planned: { expected: "2027-03" },
});

const row = (fields: object) => ({
  keyNumber: 1,
  positionId: "position-1",
  values: {},
  ...fields,
});

const hireRow = row({
  id: hireId,
  keyNumber: 7,
  kind: "planned-hire",
  preferredName: "Fictional Opening",
  employeeId: "REQ-7",
  expected: "2027-03",
});

const joinerRow = row({
  id: "p9",
  preferredName: "Fictional Joiner",
  employeeId: "FX-p9",
});

const peopleListing = (rows: readonly object[]) => ({
  "GET /api/people": () =>
    Response.json({ people: rows, fields: [], order: [] }),
  "GET /api/lists": () => Response.json({ lists: [] }),
});

async function openReportingChart() {
  serverAnswers({
    "GET /api/session": viewer,
    "GET /api/org-chart": () => chartJson({ people: [...people, opening] }),
    ...peopleListing([hireRow]),
  });
  const history = renderApp("/org-chart");
  await screen.findByRole("heading", { name: "Org chart" });
  return history;
}

describe("a planned hire's card on Reporting teams", () => {
  it("opens the hire's details beside the chart from its name, finding it, and puts focus back on it when they close", async () => {
    // Given the chart with a planned hire People lists
    const history = await openReportingChart();

    // When its name is selected
    await userEvent.click(
      await screen.findByRole("link", { name: "Fictional Opening" }),
    );

    // Then its details open, as its People row's do, and its card is found
    const details = await screen.findByRole("region", {
      name: "Fictional Opening",
    });
    expect(history.location.search).toContain("open=REQ-7");
    expect(
      card("Fictional Opening").querySelector("[data-found]"),
    ).not.toBeNull();

    // And closing them puts focus back on the card's name
    await userEvent.click(
      within(details).getByRole("button", { name: "Close details" }),
    );
    await waitFor(() => {
      expect(document.activeElement).toBe(
        screen.getByRole("link", { name: "Fictional Opening" }),
      );
    });
  });

  it("opens them on Enter, as a person's card does", async () => {
    const history = await openReportingChart();
    const name = await screen.findByRole("link", { name: "Fictional Opening" });
    act(() => {
      name.focus();
    });
    await userEvent.keyboard("{Enter}");
    await screen.findByRole("region", { name: "Fictional Opening" });
    expect(history.location.search).toContain("open=REQ-7");
  });

  it("opens them from anywhere else on the card", async () => {
    const history = await openReportingChart();
    await screen.findByRole("link", { name: "Fictional Opening" });
    fireEvent.click(
      within(card("Fictional Opening")).getByText(/^Planned, expected/),
    );
    expect(history.location.search).toContain("open=REQ-7");
  });
});

describe("a filled hire's card on Feature teams", () => {
  const filledTeams = (filledBy: object) => [
    {
      ...teams[0],
      members: [hireId, "p2", "p4"],
      hires: { [hireId]: { keyNumber: 7, expected: "2027-03", filledBy } },
    },
    ...teams.slice(1),
  ];

  it("opens the details of the person filling it, to a reader shown them", async () => {
    // Given a hire on Lighthouse filled by someone yet to start, whom People lists
    const { history } = await openFeatureTeams({
      answers: {
        "GET /api/org-chart": () =>
          Response.json({ people, drafted: people, filled: [opening] }),
        ...peopleListing([joinerRow]),
      },
      shown: filledTeams({
        id: "p9",
        name: "Fictional Joiner",
        starts: "2027-03-01",
      }),
    });

    // When its card's name is selected
    await userEvent.click(
      await screen.findByRole("link", { name: "Fictional Opening" }),
    );

    // Then the person's details open, with the hire's card found
    expect(
      await screen.findByRole("region", { name: "Fictional Joiner" }),
    ).toBeDefined();
    expect(history.location.search).toContain("open=FX-p9");
    expect(
      card("Fictional Opening").querySelector("[data-found]"),
    ).not.toBeNull();

    // And closing them puts focus back on the hire's card
    await userEvent.click(
      within(
        screen.getByRole("region", { name: "Fictional Joiner" }),
      ).getByRole("button", { name: "Close details" }),
    );
    await waitFor(() => {
      expect(document.activeElement).toBe(
        screen.getByRole("link", { name: "Fictional Opening" }),
      );
    });
  });

  it("opens the hire's own details to a reader not shown who fills it, finding its card", async () => {
    const { history } = await openFeatureTeams({
      answers: {
        "GET /api/org-chart": () => chartJson({ people: [...people, opening] }),
        ...peopleListing([hireRow]),
      },
      shown: [
        {
          ...teams[0],
          members: [hireId, "p2", "p4"],
          hires: { [hireId]: { keyNumber: 7, expected: "2027-03" } },
        },
        ...teams.slice(1),
      ],
    });
    await userEvent.click(
      await screen.findByRole("link", { name: "Fictional Opening" }),
    );
    await screen.findByRole("region", { name: "Fictional Opening" });
    expect(history.location.search).toContain("open=REQ-7");
    expect(
      card("Fictional Opening").querySelector("[data-found]"),
    ).not.toBeNull();
  });
});
