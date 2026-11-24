// SPDX-License-Identifier: Apache-2.0

// Tests for the Org chart page's Draft menu: the chart with Live only, with drafts applied, and
// with drafts beside live.

import { screen, within } from "@testing-library/react";
import { userEvent } from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { fictionalUser, renderApp, serverAnswers } from "./test-support.tsx";
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
  // The chart for one who may change people and their teams, at the address given.
  function openEditableAt(path: string, answer: () => Response) {
    serverAnswers({
      "GET /api/session": () =>
        Response.json({
          ...fictionalUser,
          permissions: ["people:view", "feature-teams:view", "people:edit"],
        }),
      "GET /api/unpublished": () => Response.json({ changes: [] }),
      "GET /api/org-chart": answer,
    });
    return renderApp(path);
  }

  it("offers no renaming, colouring or Teams panel with Live only", async () => {
    openEditableAt("/org-chart?show=live", chartAnswer);
    await screen.findByRole("link", { name: "Sasha Fictional" });
    expect(
      screen.getByRole("button", { name: "Draft: Live only" }),
    ).toBeDefined();
    expect(screen.queryByRole("button", { name: "Teams" })).toBeNull();
    expect(
      screen.queryByRole("button", { name: "Rename Fictional team" }),
    ).toBeNull();
    expect(
      screen.queryByRole("button", { name: /^Colour of Fictional team/ }),
    ).toBeNull();
  });

  it("draws no team name where drafts take it off, with Drafts applied", async () => {
    openEditableAt("/org-chart?show=drafts", () =>
      chartJson({
        people,
        drafted: people.map((one) =>
          one.id === "p2" ? { ...one, teamName: null } : one,
        ),
      }),
    );
    await screen.findByRole("link", { name: "Sasha Fictional" });
    const team = card("Sasha Fictional");
    expect(
      within(team).queryByRole("button", { name: "Rename Fictional team" }),
    ).toBeNull();
    expect(
      within(team).queryByRole("button", {
        name: "Add a name for the team of Sasha Fictional",
      }),
    ).toBeNull();
    expect(within(team).queryByText("No name")).toBeNull();
  });

  it("starts with the reports hidden of a manager who first appears when the Draft menu changes", async () => {
    openEditableAt("/org-chart?show=drafts", () =>
      chartJson({
        people,
        drafted: [
          person("p1", "Robin Fictional", null),
          person("p2", "Sasha Fictional", "p1"),
        ],
      }),
    );
    await screen.findByRole("link", { name: "Sasha Fictional" });
    await userEvent.click(
      screen.getByRole("button", { name: "Draft: Drafts applied" }),
    );
    await userEvent.click(
      await screen.findByRole("menuitem", { name: "Drafts & Live" }),
    );
    expect(
      await within(card("Sasha Fictional")).findByRole("button", {
        name: /^Show 1 report/,
      }),
    ).toBeDefined();
  });

  it("shows the reports of a manager who first appears when the Draft menu changes, after All levels", async () => {
    openEditableAt("/org-chart?show=drafts", () =>
      chartJson({
        people,
        drafted: [
          person("p1", "Robin Fictional", null),
          person("p2", "Sasha Fictional", "p1"),
        ],
      }),
    );
    await screen.findByRole("link", { name: "Sasha Fictional" });
    await showLevels("All levels");
    await userEvent.click(
      screen.getByRole("button", { name: "Draft: Drafts applied" }),
    );
    await userEvent.click(
      await screen.findByRole("menuitem", { name: "Drafts & Live" }),
    );
    expect(
      await within(card("Sasha Fictional")).findByRole("button", {
        name: /^Hide 1 report/,
      }),
    ).toBeDefined();
  });

  it("draws drafts beside live, as drafts make the chart, or not at all, from the Draft menu, kept in the address", async () => {
    const history = await openChart(() =>
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
            : one.id === "p2"
              ? {
                  ...one,
                  draft: {
                    teamName: "Fictional crew",
                    state: "rejected",
                    unpublished: false,
                  },
                }
              : one.id === "p1"
                ? {
                    ...one,
                    draft: {
                      position: "Fictional Chief",
                      state: "waiting",
                      unpublished: false,
                    },
                  }
                : one,
        ),
        drafted: [
          person("p1", "Robin Fictional", null),
          person("p5", "Vic Fictional", "p1"),
        ],
      }),
    );
    await screen.findByRole("link", { name: "Uma Fictional" });
    expect(
      within(card("Uma Fictional")).getByText(", Draft: moved"),
    ).toBeDefined();
    expect(within(card("Uma Fictional")).getByText("Moved")).toBeDefined();
    const copy = liveCopyOf("Uma Fictional");
    expect(within(copy).getByText(", live")).toBeDefined();
    const team = card("Sasha Fictional");
    expect(within(team).getByText("Fictional crew")).toBeDefined();
    expect(within(team).getByText(", Rejected")).toBeDefined();
    expect(within(team).getByText("Fictional team")).toBeDefined();
    const top = card("Robin Fictional");
    expect(within(top).getByText("Fictional Chief")).toBeDefined();
    expect(within(top).getByText(", Draft")).toBeDefined();
    expect(within(top).getByText("Fictional Director")).toBeDefined();
    expect(within(top).getByText(", live")).toBeDefined();
    await userEvent.type(
      screen.getByRole("combobox", { name: "Find a person or team" }),
      "Robin",
    );
    expect(
      await screen.findByRole("option", {
        name: /Robin Fictional\s*Fictional Director/,
      }),
    ).toBeDefined();
    await userEvent.keyboard("{Escape}");

    await userEvent.click(
      screen.getByRole("button", { name: "Draft: Drafts & Live" }),
    );
    await userEvent.click(
      await screen.findByRole("menuitem", { name: "Drafts applied" }),
    );
    expect(
      await screen.findByRole("link", { name: "Vic Fictional" }),
    ).toBeDefined();
    expect(screen.queryByText("Uma Fictional")).toBeNull();
    expect(history.location.search).toContain("show=drafts");

    await userEvent.click(
      await screen.findByRole("menuitem", { name: "Live only" }),
    );
    await screen.findByRole("link", { name: "Uma Fictional" });
    expect(within(card("Uma Fictional")).queryByText(/, Draft/)).toBeNull();
    expect(
      within(card("Uma Fictional")).getByText(
        ", Live. A move is waiting for approval.",
      ),
    ).toBeDefined();
    expect(screen.queryByText("Fictional crew")).toBeNull();
    expect(screen.queryByText("Fictional Chief")).toBeNull();
    expect(screen.queryByText(", live")).toBeNull();
  });
});
