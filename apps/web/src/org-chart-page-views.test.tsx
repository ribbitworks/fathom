// SPDX-License-Identifier: Apache-2.0

// Tests for the Org chart page's views: the levels and teams kept in the address, and saved views.

import { act, screen, waitFor, within } from "@testing-library/react";
import { userEvent } from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { bodyOf, renderApp, serverAnswers } from "./test-support.tsx";
import {
  setUpEachTest,
  viewer,
  chartAnswer,
  peopleAnswers,
  showLevels,
} from "./test-org-chart-page.tsx";

setUpEachTest();

describe("the org chart's saved views", () => {
  const savedId = "00000000-0000-4000-8000-0000000000c1";

  function openViews(
    path: string,
    views: () => Response = () => Response.json([]),
    created?: () => Response,
  ) {
    const fetch = serverAnswers({
      "GET /api/session": viewer,
      "GET /api/org-chart": chartAnswer,
      "GET /api/feature-teams": () => Response.json({ teams: [] }),
      "GET /api/views/org-chart": views,
      ...(created === undefined
        ? {}
        : { "POST /api/views/org-chart": created }),
      ...peopleAnswers,
    });
    const history = renderApp(path);
    return { fetch, history };
  }

  it("opens on feature teams from an address made before they were named teams", async () => {
    openViews("/org-chart?view=feature-teams");

    expect(
      (
        await screen.findByRole<HTMLInputElement>("radio", {
          name: "Feature teams",
        })
      ).checked,
    ).toBe(true);
  });

  it("keeps the levels shown in the address, so Back shows the levels before", async () => {
    const { history } = openViews("/org-chart");
    await screen.findByRole("link", { name: "Sasha Fictional" });

    await showLevels("1 level");
    expect(history.location.search).toBe("?levels=1");
    expect(screen.queryByRole("link", { name: "Sasha Fictional" })).toBeNull();

    act(() => {
      history.back();
    });
    expect(
      await screen.findByRole("link", { name: "Sasha Fictional" }),
    ).toBeDefined();
    expect(screen.queryByRole("link", { name: "Tatum Fictional" })).toBeNull();
  });

  it("shows the levels chosen again though they are the levels shown, hiding reports shown since", async () => {
    // Given the two levels the chart opens on, with Sasha's report shown since
    openViews("/org-chart");
    await userEvent.click(
      await screen.findByRole("button", { name: /^Show 1 report/u }),
    );
    expect(
      await screen.findByRole("link", { name: "Tatum Fictional" }),
    ).toBeDefined();

    // When two levels are chosen again
    await showLevels("2 levels");

    // Then Sasha's report is hidden again
    await waitFor(() => {
      expect(
        screen.queryByRole("link", { name: "Tatum Fictional" }),
      ).toBeNull();
    });
  });

  it("leaves the two levels the chart opens on out of the address", async () => {
    const { history } = openViews("/org-chart?levels=1");
    await screen.findByRole("link", { name: "Robin Fictional" });

    await showLevels("2 levels");

    await waitFor(() => {
      expect(history.location.search).toBe("");
    });
  });

  it.each([
    [
      "feature teams at every level",
      "/org-chart?teams=feature&levels=all",
      [
        ["Teams", "Feature teams"],
        ["Levels", "All"],
      ],
    ],
    [
      "only the Draft menu's choice",
      "/org-chart?show=live",
      [["Draft", "Live only"]],
    ],
  ])("names %s in what the view saves", async (_, path, parts) => {
    openViews(path);

    await userEvent.click(
      await screen.findByRole("button", { name: "Views, changed" }),
    );
    await userEvent.click(
      await screen.findByRole("menuitem", { name: "Save view…" }),
    );
    const dialog = await screen.findByRole("dialog", { name: "Save view" });

    for (const [name, value] of parts as [string, string][]) {
      expect(within(dialog).getByText(name)).toBeDefined();
      expect(within(dialog).getByText(value)).toBeDefined();
    }
    expect(within(dialog).queryByText("Shown alone")).toBeNull();
  });

  it("saves the teams drawn, the levels and the team shown alone, naming each", async () => {
    // Given Sasha's team shown alone at three levels, and no saved views
    // The address is one made before, naming the lead by Employee ID; the view keeps Fathom's own.
    const definition = {
      choices: { team: "p2", levels: "3" },
    };
    const view = {
      id: savedId,
      name: "Sasha's team",
      scope: "personal",
      definition,
      canChange: true,
      canShare: false,
    };
    const { fetch, history } = openViews(
      "/org-chart?team=FX-p2&levels=3",
      () => Response.json([]),
      () => Response.json({ view, changeSetId: null }, { status: 201 }),
    );

    // When it is saved as a view
    await userEvent.click(
      await screen.findByRole("button", { name: "Views, changed" }),
    );
    await userEvent.click(
      await screen.findByRole("menuitem", { name: "Save view…" }),
    );
    const dialog = await screen.findByRole("dialog", { name: "Save view" });

    // Then the dialog names the team and the levels, and the view keeps them
    expect(
      within(dialog).getByText("The team of Sasha Fictional"),
    ).toBeDefined();
    expect(within(dialog).getByText("Levels")).toBeDefined();
    await userEvent.type(
      within(dialog).getByRole("textbox"),
      "Sasha's team{Enter}",
    );
    await waitFor(() => {
      expect(history.location.search).toContain(`view=${savedId}`);
    });
    expect(bodyOf(fetch, "POST", "/api/views/org-chart")).toEqual([
      { name: "Sasha's team", scope: "personal", definition },
    ]);
  });

  it("applies a saved view of feature teams at every level, leaving the day", async () => {
    const view = {
      id: savedId,
      name: "Feature teams",
      scope: "shared",
      definition: { choices: { teams: "feature", levels: "all" } },
      canChange: false,
      canShare: false,
    };
    const { history } = openViews("/org-chart?day=2026-12-01", () =>
      Response.json([view]),
    );

    await userEvent.click(await screen.findByRole("button", { name: "Views" }));
    await userEvent.click(
      await screen.findByRole("menuitem", { name: /^Feature teams/u }),
    );

    await waitFor(() => {
      expect(
        Object.fromEntries(new URLSearchParams(history.location.search)),
      ).toEqual({
        day: "2026-12-01",
        teams: "feature",
        levels: "all",
        view: savedId,
      });
    });
  });

  it("clears the view back to reporting teams at two levels, keeping the day and the person found", async () => {
    const { history } = openViews(
      "/org-chart?teams=feature&levels=3&show=live&person=FX-p4&day=2026-12-01",
    );

    await userEvent.click(
      await screen.findByRole("button", { name: "Views, changed" }),
    );
    await userEvent.click(
      await screen.findByRole("menuitem", { name: "Clear view" }),
    );

    await waitFor(() => {
      expect(history.location.search).toBe("?person=FX-p4&day=2026-12-01");
    });
  });
});
