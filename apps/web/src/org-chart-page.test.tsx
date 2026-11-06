// SPDX-License-Identifier: Apache-2.0

// Tests for the Org chart page, with the server's responses simulated: who sees it, each person's
// card and its link to People and back, hiding and showing a manager's reports and levels, finding a
// person, one team shown alone, the chart's controls, and when the chart cannot load or has nobody on
// it.

import type { OrgChartPerson } from "@fathom/shared";
import { fireEvent, screen, within } from "@testing-library/react";
import { userEvent } from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  fictionalUser,
  greeting,
  renderApp,
  serverAnswers,
  signedIn,
} from "./test-support.tsx";

const viewer = () =>
  Response.json({
    ...fictionalUser,
    roles: ["resource-planner"],
    permissions: ["people:view", "plan:view"],
  });

const person = (
  id: string,
  preferredName: string,
  managerId: string | null,
  details: Partial<OrgChartPerson> = {},
): OrgChartPerson => ({
  id,
  preferredName,
  employeeId: `FX-${id}`,
  position: "Fictional Engineer",
  teamName: null,
  managerId,
  ...details,
});

const people = [
  person("p1", "Robin Fictional", null, { position: "Fictional Director" }),
  person("p2", "Sasha Fictional", "p1", { teamName: "Fictional team" }),
  person("p3", "Tatum Fictional", "p2", { left: true }),
  person("p4", "Uma Fictional", "p3"),
];

const chartAnswer = () => Response.json({ people });

// People's answers, with one of the chart's people on it.
const peopleAnswers = {
  "GET /api/people": () =>
    Response.json({
      people: [
        {
          id: "p4",
          preferredName: "Uma Fictional",
          employeeId: "FX-p4",
          positionId: "position-1",
          values: {},
        },
      ],
      fields: [],
      order: [],
      views: [],
    }),
  "GET /api/lists": () => Response.json({ lists: [] }),
};

afterEach(() => {
  vi.unstubAllGlobals();
});

async function showLevels(choice: string) {
  await userEvent.click(
    await screen.findByRole("button", { name: "Show levels" }),
  );
  await userEvent.click(await screen.findByRole("menuitem", { name: choice }));
}

// Opens the chart at the address given, with every level shown unless asked not to.
async function openChart(
  answer: () => Response = chartAnswer,
  expand = true,
  path = "/org-chart",
) {
  serverAnswers({ "GET /api/session": viewer, "GET /api/org-chart": answer });
  const history = renderApp(path);
  await screen.findByRole("heading", { name: "Org chart" });
  if (expand) await showLevels("All levels");
  return history;
}

const card = (name: string) =>
  screen
    .getByRole("link", { name })
    .closest("div.react-flow__node") as HTMLElement;

describe("who sees the Org chart page", () => {
  it("links to it under People for users who see people", async () => {
    serverAnswers({
      "GET /api/session": viewer,
      "GET /api/greeting": greeting,
      "GET /api/org-chart": chartAnswer,
    });
    const history = renderApp("/");
    await userEvent.click(
      await screen.findByRole("link", { name: "Org chart" }),
    );
    expect(
      await screen.findByRole("heading", { name: "Org chart" }),
    ).toBeDefined();
    expect(history.location.pathname).toBe("/org-chart");
  });

  it("is not shown to anyone else", async () => {
    serverAnswers({ "GET /api/session": signedIn });
    renderApp("/org-chart");
    expect(
      await screen.findByText("There is no page at this address."),
    ).toBeDefined();
  });
});

describe("the org chart", () => {
  it("shows each person's name, position, and the team they lead, and marks a manager who has left", async () => {
    await openChart();
    await screen.findByRole("link", { name: "Robin Fictional" });
    const top = card("Robin Fictional");
    expect(within(top).getByText("Fictional Director")).toBeDefined();
    const sasha = card("Sasha Fictional");
    expect(within(sasha).getByText("Fictional team")).toBeDefined();
    expect(within(card("Tatum Fictional")).getByText("Left")).toBeDefined();
    expect(within(sasha).queryByText("Left")).toBeNull();
  });

  it("opens with the top two levels shown, and shows the levels chosen", async () => {
    await openChart(chartAnswer, false);
    await screen.findByRole("link", { name: "Sasha Fictional" });
    expect(screen.queryByRole("link", { name: "Tatum Fictional" })).toBeNull();
    await showLevels("All levels");
    expect(
      await screen.findByRole("link", { name: "Uma Fictional" }),
    ).toBeDefined();
    await showLevels("3 levels");
    expect(
      await screen.findByRole("link", { name: "Tatum Fictional" }),
    ).toBeDefined();
    expect(screen.queryByRole("link", { name: "Uma Fictional" })).toBeNull();
    await showLevels("1 level");
    expect(screen.queryByRole("link", { name: "Sasha Fictional" })).toBeNull();
    expect(screen.getByRole("link", { name: "Robin Fictional" })).toBeDefined();
  });

  it("offers no levels when everyone is on one", async () => {
    await openChart(
      () => Response.json({ people: [person("a", "Avery Fictional", null)] }),
      false,
    );
    await screen.findByRole("link", { name: "Avery Fictional" });
    expect(screen.queryByRole("button", { name: "Show levels" })).toBeNull();
  });

  it("opens People, searched for the person, from their name, and leads back to them", async () => {
    const history = await openChart();
    await userEvent.click(
      await screen.findByRole("link", { name: "Uma Fictional" }),
    );
    expect(history.location.pathname).toBe("/people");
    expect(history.location.search).toContain("search=FX-p4");
    await userEvent.click(
      await screen.findByRole("link", { name: "Back to org chart" }),
    );
    expect(history.location.pathname).toBe("/org-chart");
    await screen.findByRole("link", { name: "Uma Fictional" });
    expect(card("Uma Fictional").querySelector("[data-found]")).not.toBeNull();
  });

  it("finds the person opened when the browser goes back", async () => {
    const history = await openChart();
    await userEvent.click(
      await screen.findByRole("link", { name: "Uma Fictional" }),
    );
    await screen.findByRole("link", { name: "Back to org chart" });
    history.back();
    await screen.findByRole("link", { name: "Uma Fictional" });
    expect(card("Uma Fictional").querySelector("[data-found]")).not.toBeNull();
  });

  it("keeps the link back while People's search changes", async () => {
    serverAnswers({
      "GET /api/session": viewer,
      ...peopleAnswers,
    });
    const history = renderApp(
      `/people?search=FX-p4&chart=${encodeURIComponent(JSON.stringify({ person: "FX-p4" }))}`,
    );
    const search = await screen.findByRole("textbox", {
      name: "Search people",
    });
    await userEvent.clear(search);
    await userEvent.type(search, "Uma");
    expect(history.location.search).toContain("search=Uma");
    expect(
      screen
        .getByRole("link", { name: "Back to org chart" })
        .getAttribute("href"),
    ).toBe("/org-chart?person=FX-p4");
  });

  it("shows no link back when People is opened another way", async () => {
    serverAnswers({
      "GET /api/session": viewer,
      ...peopleAnswers,
    });
    renderApp("/people");
    await screen.findByRole("textbox", { name: "Search people" });
    expect(
      screen.queryByRole("link", { name: "Back to org chart" }),
    ).toBeNull();
  });

  it("leaves a click that opens a new tab to the browser", async () => {
    const history = await openChart();
    const link = await screen.findByRole("link", { name: "Uma Fictional" });
    let leftToBrowser = false;
    // Seen after the page has handled the click; the simulated browser cannot open a tab, so it is
    // then stopped.
    const browser = (event: MouseEvent) => {
      leftToBrowser = !event.defaultPrevented;
      event.preventDefault();
    };
    document.addEventListener("click", browser);
    fireEvent.click(link, { ctrlKey: true });
    document.removeEventListener("click", browser);
    expect(leftToBrowser).toBe(true);
    expect(history.location.pathname).toBe("/org-chart");
  });

  it("gives cards and lines no focus of their own", async () => {
    await openChart();
    await screen.findByRole("link", { name: "Uma Fictional" });
    const own = document.querySelectorAll(
      ".react-flow__node[tabindex], .react-flow__edge[tabindex]",
    );
    expect(own).toHaveLength(0);
    expect(
      [...document.querySelectorAll(".react-flow__edge")].every(
        (line) => line.getAttribute("aria-hidden") === "true",
      ),
    ).toBe(true);
  });

  it("opens People from anywhere else on the card", async () => {
    const history = await openChart();
    await screen.findByRole("link", { name: "Uma Fictional" });
    fireEvent.click(
      within(card("Uma Fictional")).getByText("Fictional Engineer"),
    );
    expect(history.location.pathname).toBe("/people");
    expect(history.location.search).toContain("search=FX-p4");
  });

  it("hides a manager's reports, and everyone below them, and shows them again", async () => {
    await openChart();
    await screen.findByRole("link", { name: "Uma Fictional" });
    const hide = screen.getByRole("button", {
      name: "Hide reports of Sasha Fictional",
    });
    expect(hide.getAttribute("aria-expanded")).toBe("true");
    await userEvent.click(hide);
    expect(screen.queryByRole("link", { name: "Tatum Fictional" })).toBeNull();
    expect(screen.queryByRole("link", { name: "Uma Fictional" })).toBeNull();
    const show = screen.getByRole("button", {
      name: "Show 1 report of Sasha Fictional",
    });
    expect(show.getAttribute("aria-expanded")).toBe("false");
    await userEvent.click(show);
    expect(
      await screen.findByRole("link", { name: "Uma Fictional" }),
    ).toBeDefined();
  });

  it("counts several reports when hidden", async () => {
    await openChart(() =>
      Response.json({
        people: [
          person("a", "Avery Fictional", null),
          person("b", "Blake Fictional", "a"),
          person("c", "Casey Fictional", "a"),
        ],
      }),
    );
    await userEvent.click(
      await screen.findByRole("button", {
        name: "Hide reports of Avery Fictional",
      }),
    );
    expect(
      screen.getByRole("button", { name: "Show 2 reports of Avery Fictional" }),
    ).toBeDefined();
  });

  it("finds a person by name, showing them even below a hidden manager, and marks them", async () => {
    await openChart();
    await screen.findByRole("link", { name: "Uma Fictional" });
    await userEvent.click(
      screen.getByRole("button", {
        name: "Hide reports of Robin Fictional",
      }),
    );
    expect(screen.queryByRole("link", { name: "Uma Fictional" })).toBeNull();
    const finder = screen.getByRole("combobox", { name: "Find a person" });
    await userEvent.type(finder, "Uma");
    await userEvent.click(
      await screen.findByRole("option", { name: /Uma Fictional/ }),
    );
    await screen.findByRole("link", { name: "Uma Fictional" });
    expect(card("Uma Fictional").querySelector("[data-found]")).not.toBeNull();
  });

  it("finds someone already shown, and clears the search", async () => {
    await openChart();
    await screen.findByRole("link", { name: "Uma Fictional" });
    const finder = screen.getByRole("combobox", { name: "Find a person" });
    await userEvent.type(finder, "Robin");
    await userEvent.click(
      await screen.findByRole("option", { name: /Robin Fictional/ }),
    );
    expect(
      card("Robin Fictional").querySelector("[data-found]"),
    ).not.toBeNull();
    // Mantine keeps its clear button from screen readers.
    await userEvent.click(
      within(finder.parentElement as HTMLElement).getByRole("button", {
        hidden: true,
      }),
    );
    expect(card("Robin Fictional").querySelector("[data-found]")).toBeNull();
  });

  it("shows one manager's team alone, and everyone again", async () => {
    const history = await openChart();
    await userEvent.click(
      await screen.findByRole("button", {
        name: "Show only the team of Sasha Fictional",
      }),
    );
    expect(
      await screen.findByText(
        "You're seeing only the team of Sasha Fictional.",
      ),
    ).toBeDefined();
    expect(screen.queryByRole("link", { name: "Robin Fictional" })).toBeNull();
    expect(screen.getByRole("link", { name: "Tatum Fictional" })).toBeDefined();
    expect(
      screen.queryByRole("button", {
        name: "Show only the team of Sasha Fictional",
      }),
    ).toBeNull();
    expect(history.location.search).toBe("?team=FX-p2");
    await userEvent.click(
      screen.getByRole("button", { name: "Show everyone" }),
    );
    expect(
      await screen.findByRole("link", { name: "Robin Fictional" }),
    ).toBeDefined();
    expect(screen.queryByText(/You're seeing only/)).toBeNull();
  });

  it("shows everyone when the team in the address is not on the chart", async () => {
    await openChart(chartAnswer, false, "/org-chart?team=FX-p4");
    expect(
      await screen.findByRole("link", { name: "Robin Fictional" }),
    ).toBeDefined();
    expect(screen.queryByText(/You're seeing only/)).toBeNull();
  });

  it("zooms in and out, and fits the chart to the screen", async () => {
    await openChart();
    await screen.findByRole("link", { name: "Uma Fictional" });
    const viewport = document.querySelector(
      ".react-flow__viewport",
    ) as HTMLElement;
    const scale = () =>
      Number(/scale\(([\d.]+)\)/.exec(viewport.style.transform)?.[1]);
    const before = scale();
    await userEvent.click(screen.getByRole("button", { name: "Zoom in" }));
    await vi.waitFor(() => {
      expect(scale()).toBeGreaterThan(before);
    });
    const zoomed = scale();
    await userEvent.click(screen.getByRole("button", { name: "Zoom out" }));
    await vi.waitFor(() => {
      expect(scale()).toBeLessThan(zoomed);
    });
    await userEvent.click(
      screen.getByRole("button", { name: "Fit to screen" }),
    );
    expect(screen.getByRole("link", { name: "Uma Fictional" })).toBeDefined();
  });

  it("shows a manager People does not show the reader by name alone, opening nothing", async () => {
    const history = await openChart(() =>
      Response.json({
        people: [
          person("g", "Gale Fictional", null, {
            employeeId: null,
            position: null,
          }),
          person("h", "Harper Fictional", "g"),
        ],
      }),
    );
    await screen.findByRole("link", { name: "Harper Fictional" });
    expect(screen.queryByRole("link", { name: "Gale Fictional" })).toBeNull();
    const gale = screen
      .getByText("Gale Fictional")
      .closest("div.react-flow__node") as HTMLElement;
    expect(within(gale).queryByText("Fictional Engineer")).toBeNull();
    expect(
      screen.queryByRole("button", {
        name: "Show only the team of Gale Fictional",
      }),
    ).toBeNull();
    fireEvent.click(gale);
    expect(history.location.pathname).toBe("/org-chart");
    await userEvent.click(
      screen.getByRole("combobox", { name: "Find a person" }),
    );
    expect(screen.queryByRole("option", { name: /Gale Fictional/ })).toBeNull();
  });

  it("brings back the person found when chosen again after their card was hidden", async () => {
    await openChart();
    const finder = await screen.findByRole("combobox", {
      name: "Find a person",
    });
    await userEvent.type(finder, "Uma");
    await userEvent.click(
      await screen.findByRole("option", { name: /Uma Fictional/ }),
    );
    await screen.findByRole("link", { name: "Uma Fictional" });
    await showLevels("1 level");
    expect(screen.queryByRole("link", { name: "Uma Fictional" })).toBeNull();
    await userEvent.click(finder);
    await userEvent.click(
      await screen.findByRole("option", { name: /Uma Fictional/ }),
    );
    expect(
      await screen.findByRole("link", { name: "Uma Fictional" }),
    ).toBeDefined();
    expect(card("Uma Fictional").querySelector("[data-found]")).not.toBeNull();
  });

  it("leads back to the team shown alone", async () => {
    const history = await openChart(chartAnswer, true, "/org-chart?team=FX-p2");
    await userEvent.click(
      await screen.findByRole("link", { name: "Uma Fictional" }),
    );
    await userEvent.click(
      await screen.findByRole("link", { name: "Back to org chart" }),
    );
    expect(history.location.search).toContain("team=FX-p2");
    expect(
      await screen.findByText(
        "You're seeing only the team of Sasha Fictional.",
      ),
    ).toBeDefined();
  });

  it("leads back to the whole chart when the person in People's address cannot be read", async () => {
    serverAnswers({ "GET /api/session": viewer, ...peopleAnswers });
    renderApp(
      `/people?chart=${encodeURIComponent(JSON.stringify({ person: 5 }))}`,
    );
    await screen.findByRole("textbox", { name: "Search people" });
    expect(
      screen
        .getByRole("link", { name: "Back to org chart" })
        .getAttribute("href"),
    ).toBe("/org-chart");
  });

  it("shows no link back when People's address names the chart wrongly", async () => {
    serverAnswers({ "GET /api/session": viewer, ...peopleAnswers });
    renderApp("/people?chart=%22nonsense%22");
    await screen.findByRole("textbox", { name: "Search people" });
    expect(
      screen.queryByRole("link", { name: "Back to org chart" }),
    ).toBeNull();
  });

  it("shows everyone, with nobody found, when the address names a person or team too long to be one", async () => {
    // Employee IDs on the chart one character longer than an Employee ID may be.
    const tooLong = "X".repeat(41);
    await openChart(
      () =>
        Response.json({
          people: [
            person("p1", "Robin Fictional", null, {
              employeeId: `${tooLong}1`,
            }),
            person("p2", "Sasha Fictional", "p1", { employeeId: tooLong }),
            person("p3", "Tatum Fictional", "p2"),
          ],
        }),
      false,
      `/org-chart?person=${tooLong}&team=${tooLong}1`,
    );
    expect(
      await screen.findByRole("link", { name: "Robin Fictional" }),
    ).toBeDefined();
    expect(screen.queryByText(/You're seeing only/)).toBeNull();
    expect(
      screen.getByRole<HTMLInputElement>("combobox", {
        name: "Find a person",
      }).value,
    ).toBe("");
  });

  it("says so when nobody is on it", async () => {
    await openChart(() => Response.json({ people: [] }), false);
    expect(
      await screen.findByText("Nobody is on the org chart yet."),
    ).toBeDefined();
  });

  it("says so when it cannot load, and tries again", async () => {
    let fail = true;
    await openChart(
      () =>
        fail
          ? Response.json({ error: "Down" }, { status: 500 })
          : Response.json({ people }),
      false,
    );
    const alert = await screen.findByRole("alert");
    expect(alert.textContent).toContain("Fathom could not load the org chart.");
    fail = false;
    await userEvent.click(
      within(alert).getByRole("button", { name: "Try again" }),
    );
    expect(
      await screen.findByRole("link", { name: "Robin Fictional" }),
    ).toBeDefined();
  });
});
