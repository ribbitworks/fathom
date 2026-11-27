// SPDX-License-Identifier: Apache-2.0

// Tests for the Org chart page, with the server's responses simulated: who sees it, and the
// reporting chart with its cards, levels, details, finder and zoom.

import {
  act,
  fireEvent,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import { userEvent } from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import {
  fictionalUser,
  findSidebar,
  renderApp,
  serverAnswers,
  signedIn,
} from "./test-support.tsx";
import {
  setUpEachTest,
  viewer,
  person,
  people,
  chartJson,
  chartAnswer,
  showLevels,
  openChart,
  card,
} from "./test-org-chart-page.tsx";

setUpEachTest();

// Opens the chart with its own panel, which holds React Flow, watched for changes of width, which
// the test then makes.
async function openWatchedChart() {
  const resized: ((width: number) => void)[] = [];
  vi.stubGlobal(
    "ResizeObserver",
    class {
      readonly callback: (entries: object[]) => void;
      constructor(callback: (entries: object[]) => void) {
        this.callback = callback;
      }
      observe(target: Element) {
        if (target.querySelector(".react-flow") !== null) {
          resized.push((width) => {
            this.callback([{ contentRect: { width } }]);
          });
        }
      }
      unobserve() {}
      disconnect() {}
    },
  );
  await openChart();
  const viewport = document.querySelector(
    ".react-flow__viewport",
  ) as HTMLElement;
  const transform = () => viewport.style.transform;
  const resize = (width: number) => {
    act(() => {
      for (const callback of resized) callback(width);
    });
  };
  return { transform, resize };
}

const settled = () => new Promise((settle) => setTimeout(settle, 400));

describe("who sees the Org chart page", () => {
  it("links to it under People for users who see people", async () => {
    serverAnswers({
      "GET /api/session": viewer,
      "GET /api/org-chart": chartAnswer,
    });
    const history = renderApp("/");
    await userEvent.click(
      await within(await findSidebar()).findByRole("link", {
        name: "Org chart",
      }),
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
  it("says under a moved person's position when their move takes effect, if not the day shown", async () => {
    await openChart(() =>
      chartJson({
        people: [
          person("p1", "Robin Fictional", null),
          person("p2", "Sasha Fictional", "p1"),
          person("p3", "Tatum Fictional", "p1", {
            draft: {
              managerId: "p2",
              managerFrom: "2020-01-02",
              state: "waiting",
              unpublished: false,
            },
          }),
        ],
      }),
    );
    const moved = await screen.findByRole("link", { name: "Tatum Fictional" });
    expect(
      within(moved.closest("div.react-flow__node") as HTMLElement).getByText(
        "From Jan 2, 2020",
      ),
    ).toBeDefined();
  });

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

  it("draws planned hires as placeholders, one with no name by its ID with its position under it, a planned manager heading its hires, opening nothing and left out of the Teams panel", async () => {
    const planned = [
      ...people,
      person("h1", "Fictional Engineer, TBD-7", null, {
        employeeId: null,
        planned: { expected: "2027-03", shownId: "TBD-7" },
      }),
      person("h2", "Fictional Planned Report", "h1", {
        employeeId: null,
        planned: { expected: "2026-11", undated: true },
      }),
    ];
    serverAnswers({
      "GET /api/session": () =>
        Response.json({
          ...fictionalUser,
          permissions: ["people:view", "feature-teams:view", "people:edit"],
        }),
      "GET /api/unpublished": () => Response.json({ changes: [] }),
      "GET /api/org-chart": () => chartJson({ people: planned }),
    });
    renderApp("/org-chart");
    const onCard = (name: string) =>
      screen
        .getAllByText(name)
        .map((shown) => shown.closest<HTMLElement>("div.react-flow__node"))
        .find((node) => node !== null) as HTMLElement;
    await screen.findAllByText("TBD-7");
    const placeholder = onCard("TBD-7");
    expect(within(placeholder).queryByRole("link")).toBeNull();
    expect(within(placeholder).getByText(/^Planned, expected/)).toBeDefined();
    expect(within(placeholder).getByText("Fictional Engineer")).toBeDefined();
    const report = onCard("Fictional Planned Report").textContent;
    expect(report).toContain("Fictional Engineer");
    expect(report).toContain("Planned, no target date");
    expect(report).not.toContain("Planned, expected");
    await userEvent.click(screen.getByRole("button", { name: "Teams" }));
    const panel = await screen.findByRole("dialog", { name: "Teams" });
    expect(within(panel).queryByText(/Fictional Engineer, TBD-7/)).toBeNull();
    await userEvent.keyboard("{Escape}");
    await userEvent.click(
      screen.getByRole("button", {
        name: "Show only the team of Fictional Engineer, TBD-7",
      }),
    );
    await screen.findByText(
      "Only the team of Fictional Engineer, TBD-7 is shown.",
    );
  });

  it("names someone moved between managers outside a team shown alone once", async () => {
    await openChart(
      () =>
        chartJson({
          people: [
            ...people,
            person("p5", "Wren Fictional", "p1"),
            {
              ...person("p6", "Vic Fictional", "p1"),
              draft: { managerId: "p5", state: "waiting", unpublished: false },
            },
          ],
        }),
      false,
      "/org-chart?team=FX-p2",
    );
    await screen.findByRole("link", { name: "Sasha Fictional" });
    await userEvent.type(
      screen.getByRole("combobox", { name: "Find a person or team" }),
      "Vic",
    );
    expect(
      await screen.findByText("Vic Fictional is not in this team"),
    ).toBeDefined();
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
      () => chartJson({ people: [person("a", "Avery Fictional", null)] }),
      false,
    );
    await screen.findByRole("link", { name: "Avery Fictional" });
    expect(screen.queryByRole("button", { name: "Show levels" })).toBeNull();
  });

  it("shows the person's details beside the chart from their name, and finds them", async () => {
    const history = await openChart();
    await userEvent.click(
      await screen.findByRole("link", { name: "Uma Fictional" }),
    );
    expect(history.location.pathname).toBe("/org-chart");
    expect(history.location.search).toContain("open=FX-p4");
    expect(
      await screen.findByRole("region", { name: "Uma Fictional" }),
    ).toBeDefined();
    expect(history.location.search).toContain("person=FX-p4");
    expect(card("Uma Fictional").querySelector("[data-found]")).not.toBeNull();
  });

  it("keeps the person whose details are opened centred as the chart's width changes, until the chart is moved", async () => {
    const { transform, resize } = await openWatchedChart();
    resize(800);
    // Zoomed out, so finding the person zooms in.
    await userEvent.click(screen.getByRole("button", { name: "Zoom out" }));
    await settled();
    expect(transform()).not.toContain("scale(1)");
    await userEvent.click(
      await screen.findByRole("link", { name: "Uma Fictional" }),
    );
    await screen.findByRole("region", { name: "Uma Fictional" });
    // Narrowing while the chart moves to the person centres them at once, well before the move
    // would have ended.
    resize(600);
    await new Promise((settle) => setTimeout(settle, 60));
    const soon = transform();
    await settled();
    expect(soon).toBe(transform());
    // It is kept at the zoom finding them moves to.
    expect(soon).toContain("scale(1)");
    // Zooming is moving the chart.
    await userEvent.click(screen.getByRole("button", { name: "Zoom in" }));
    await settled();
    const zoomed = transform();
    resize(400);
    expect(transform()).toBe(zoomed);
  });

  it("keeps a person already found at the zoom chosen when their details open again", async () => {
    const { transform, resize } = await openWatchedChart();
    resize(800);
    const uma = await screen.findByRole("link", { name: "Uma Fictional" });
    await userEvent.click(uma);
    await screen.findByRole("region", { name: "Uma Fictional" });
    await settled();
    await userEvent.click(screen.getByRole("button", { name: "Zoom in" }));
    await settled();
    const scale = /scale\([^)]*\)/.exec(transform())?.[0];
    expect(scale).not.toBe("scale(1)");
    await userEvent.click(uma);
    resize(600);
    expect(transform()).toContain(scale);
  });

  it.each([
    [
      "fits them and their Live copy to the screen when both can be read",
      2000,
      false,
    ],
    [
      "centres them alone when fitting both would make the cards too small",
      300,
      true,
    ],
  ])("finding someone a draft moves %s", async (_, room, zoomedIn) => {
    vi.spyOn(HTMLElement.prototype, "clientWidth", "get").mockReturnValue(room);
    vi.spyOn(HTMLElement.prototype, "clientHeight", "get").mockReturnValue(
      room,
    );
    await openChart(() =>
      chartJson({
        people: people.map((one) =>
          one.id === "p4"
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
    const viewport = document.querySelector(
      ".react-flow__viewport",
    ) as HTMLElement;
    await userEvent.click(screen.getByRole("button", { name: "Zoom out" }));
    await settled();
    expect(viewport.style.transform).not.toContain("scale(1)");
    await userEvent.click(
      await screen.findByRole("link", { name: "Uma Fictional" }),
    );
    await screen.findByRole("region", { name: "Uma Fictional" });
    await settled();
    expect(viewport.style.transform.includes("scale(1)")).toBe(zoomedIn);
  });

  it("stops keeping the person centred once the chart is moved by hand", async () => {
    const { transform, resize } = await openWatchedChart();
    resize(800);
    await userEvent.click(
      await screen.findByRole("link", { name: "Uma Fictional" }),
    );
    await screen.findByRole("region", { name: "Uma Fictional" });
    await new Promise((settle) => setTimeout(settle, 400));
    fireEvent.wheel(
      document.querySelector(".react-flow__pane") as HTMLElement,
      { deltaY: 100 },
    );
    await new Promise((settle) => setTimeout(settle, 50));
    const moved = transform();
    resize(600);
    expect(transform()).toBe(moved);
  });

  it.each([
    ["showing a number of levels", () => showLevels("1 level")],
    [
      "hiding reports",
      async () => {
        await userEvent.click(
          screen.getByRole("button", {
            name: "Hide 1 report of Sasha Fictional",
          }),
        );
      },
    ],
  ])("stops keeping the person centred after %s", async (_, move) => {
    const { transform, resize } = await openWatchedChart();
    resize(800);
    await userEvent.click(
      await screen.findByRole("link", { name: "Uma Fictional" }),
    );
    await screen.findByRole("region", { name: "Uma Fictional" });
    await settled();
    await move();
    await settled();
    const moved = transform();
    resize(600);
    expect(transform()).toBe(moved);
  });

  it("closes the details with the browser's back button", async () => {
    const history = await openChart();
    await userEvent.click(
      await screen.findByRole("link", { name: "Uma Fictional" }),
    );
    await screen.findByRole("region", { name: "Uma Fictional" });
    history.back();
    await waitFor(() => {
      expect(
        screen.queryByRole("region", { name: "Uma Fictional" }),
      ).toBeNull();
    });
    expect(history.location.search).not.toContain("open=");
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

  it("shows the person's details from anywhere else on the card", async () => {
    const history = await openChart();
    await screen.findByRole("link", { name: "Uma Fictional" });
    fireEvent.click(
      within(card("Uma Fictional")).getByText("Fictional Engineer"),
    );
    expect(history.location.search).toContain("open=FX-p4");
  });

  it("hides a manager's reports, and everyone below them, and shows them again", async () => {
    await openChart();
    await screen.findByRole("link", { name: "Uma Fictional" });
    const hide = screen.getByRole("button", {
      name: "Hide 1 report of Sasha Fictional",
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

  it("counts several reports, shown or hidden", async () => {
    await openChart(() =>
      chartJson({
        people: [
          person("a", "Avery Fictional", null),
          person("b", "Blake Fictional", "a"),
          person("c", "Casey Fictional", "a"),
        ],
      }),
    );
    await userEvent.click(
      await screen.findByRole("button", {
        name: "Hide 2 reports of Avery Fictional",
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
        name: "Hide 1 report of Robin Fictional",
      }),
    );
    expect(screen.queryByRole("link", { name: "Uma Fictional" })).toBeNull();
    const finder = screen.getByRole("combobox", {
      name: "Find a person or team",
    });
    await userEvent.type(finder, "Uma");
    await userEvent.click(
      await screen.findByRole("option", { name: /Uma Fictional/ }),
    );
    await screen.findByRole("link", { name: "Uma Fictional" });
    expect(card("Uma Fictional").querySelector("[data-found]")).not.toBeNull();
  });

  it("leaves out a position the reader may not see, on the card and in the finder", async () => {
    await openChart(() =>
      chartJson({
        people: people.map((one) =>
          one.preferredName === "Uma Fictional"
            ? { ...one, position: null }
            : one,
        ),
      }),
    );
    expect(
      within(card("Uma Fictional")).queryByText("Fictional Engineer"),
    ).toBeNull();
    await userEvent.type(
      screen.getByRole("combobox", { name: "Find a person or team" }),
      "Uma",
    );
    expect(
      (await screen.findByRole("option", { name: /Uma Fictional/ }))
        .textContent,
    ).toBe("Uma Fictional");
  });

  it("finds someone already shown, and clears the search", async () => {
    await openChart();
    await screen.findByRole("link", { name: "Uma Fictional" });
    const finder = screen.getByRole("combobox", {
      name: "Find a person or team",
    });
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

  it("finds a team by its name, centring the manager who leads it", async () => {
    await openChart(chartAnswer, false);
    await screen.findByRole("link", { name: "Sasha Fictional" });
    await userEvent.type(
      screen.getByRole("combobox", { name: "Find a person or team" }),
      "Fictional team",
    );
    await userEvent.click(
      await screen.findByRole("option", {
        name: /Fictional team\s*Led by Sasha Fictional/,
      }),
    );
    expect(
      card("Sasha Fictional").querySelector("[data-found]"),
    ).not.toBeNull();
    expect(
      await screen.findByRole("link", { name: "Tatum Fictional" }),
    ).toBeDefined();
  });

  it("clears what is typed in the finder before anyone is chosen", async () => {
    await openChart();
    await screen.findByRole("link", { name: "Uma Fictional" });
    const finder = screen.getByRole("combobox", {
      name: "Find a person or team",
    });
    const clear = () =>
      within(finder.parentElement as HTMLElement).queryByRole("button", {
        hidden: true,
      });
    expect(clear()).toBeNull();
    await userEvent.type(finder, "Zz");
    await userEvent.click(clear() as HTMLElement);
    expect((finder as HTMLInputElement).value).toBe("");
    expect(clear()).toBeNull();
  });

  it("shows one manager's team alone, and everyone again", async () => {
    const history = await openChart();
    await userEvent.click(
      await screen.findByRole("button", {
        name: "Show only the team of Sasha Fictional",
      }),
    );
    expect(
      await screen.findByText("Only the team of Sasha Fictional is shown."),
    ).toBeDefined();
    expect(screen.queryByRole("link", { name: "Robin Fictional" })).toBeNull();
    expect(screen.getByRole("link", { name: "Tatum Fictional" })).toBeDefined();
    expect(
      screen.queryByRole("button", {
        name: "Show only the team of Sasha Fictional",
      }),
    ).toBeNull();
    expect(history.location.search).toBe("?team=p2&levels=all");
    await userEvent.type(
      screen.getByRole("combobox", { name: "Find a person or team" }),
      "Robin",
    );
    expect(
      await screen.findByText("Robin Fictional is not in this team"),
    ).toBeDefined();
    await userEvent.click(
      screen.getByRole("button", { name: "Show everyone" }),
    );
    expect(
      await screen.findByRole("link", { name: "Robin Fictional" }),
    ).toBeDefined();
    expect(screen.queryByText(/Only the team of/)).toBeNull();
  });

  it("shows everyone when the team in the address is not on the chart", async () => {
    await openChart(chartAnswer, false, "/org-chart?team=FX-p4");
    expect(
      await screen.findByRole("link", { name: "Robin Fictional" }),
    ).toBeDefined();
    expect(screen.queryByText(/Only the team of/)).toBeNull();
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

  it("brings back the person found when chosen again after their card was hidden", async () => {
    await openChart();
    const finder = await screen.findByRole("combobox", {
      name: "Find a person or team",
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

  it("keeps the team shown alone while showing someone's details", async () => {
    const history = await openChart(chartAnswer, true, "/org-chart?team=FX-p2");
    await userEvent.click(
      await screen.findByRole("link", { name: "Uma Fictional" }),
    );
    expect(history.location.search).toContain("team=FX-p2");
    expect(history.location.search).toContain("open=FX-p4");
    expect(
      await screen.findByText("Only the team of Sasha Fictional is shown."),
    ).toBeDefined();
  });

  it("shows everyone, with nobody found, when the address names a person or team too long to be one", async () => {
    // Employee IDs on the chart one character longer than an Employee ID may be.
    const tooLong = "X".repeat(41);
    await openChart(
      () =>
        chartJson({
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
    expect(screen.queryByText(/Only the team of/)).toBeNull();
    expect(
      screen.getByRole<HTMLInputElement>("combobox", {
        name: "Find a person or team",
      }).value,
    ).toBe("");
  });

  it("finds nobody when the person in the address is not on the chart", async () => {
    await openChart(chartAnswer, false, "/org-chart?person=FX-nobody");
    await screen.findByRole("link", { name: "Sasha Fictional" });
    expect(document.querySelector("[data-found]")).toBeNull();
  });

  it("says so when nobody is on it", async () => {
    await openChart(() => chartJson({ people: [] }), false);
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
          : chartJson({ people }),
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
