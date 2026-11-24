// SPDX-License-Identifier: Apache-2.0

// Tests for grouping and breaking down the People table by manager, feature team and added columns.

import type { Field, List } from "@fathom/shared";
import { render, screen } from "@testing-library/react";
import { userEvent } from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { countRows } from "./metrics.ts";
import { type Column, columnsFor } from "./people-grid.tsx";
import { emptyView } from "./table-view.ts";
import {
  site,
  positions,
  sites,
  person,
  people,
  grid,
} from "./test-people-grid.tsx";

describe("managers and teams", () => {
  it("breaks people down by manager, counting each manager's direct reports", () => {
    const manager = columnsFor([], [], [], true, people).find(
      ({ key }) => key === "managerId",
    ) as Column;
    expect(manager.breaksDown).not.toBe(false);
    const counts = countRows(people, [manager]);
    expect(counts.of(["p1"])).toBe(2);
    expect(counts.of(["p3"])).toBe(1);
  });

  it("groups people under each manager, named with their team's name where it has one, then No manager", () => {
    render(grid({ view: { ...emptyView, grouping: "managerId" } }));
    expect(
      screen.getAllByRole("rowheader").map(({ textContent }) => textContent),
    ).toEqual([
      "Fictional p1, Harbour Crew2 people",
      "Fictional p31 person",
      "Fictional p91 person",
      "No manager1 person",
    ]);
  });

  it("groups each manager's people by site under their heading, leaving out sites none of them is at", () => {
    render(
      grid({
        people: people.map((each) =>
          each.id === "p2" ? { ...each, values: { f1: ["c1"] } } : each,
        ),
        fields: [site],
        lists: [positions, sites],
        view: { ...emptyView, grouping: "managerId", thenBy: "f1" },
      }),
    );
    expect(
      screen.getAllByRole("rowheader").map(({ textContent }) => textContent),
    ).toEqual([
      "Fictional p1, Harbour Crew2 people",
      "Harbour1 person",
      "No site1 person",
      "Fictional p31 person",
      "No site1 person",
      "Fictional p91 person",
      "No site1 person",
      "No manager1 person",
      "No site1 person",
    ]);
  });

  it("offers Group by Manager, Position, State and added choice columns, but not Team", async () => {
    const levels: Field = { ...site, id: "f2", name: "Levels", multiple: true };
    const states: List = {
      ...sites,
      id: "states",
      name: "Hiring states",
      builtIn: "hiring-states",
    };
    render(grid({ fields: [site, levels], lists: [positions, sites, states] }));
    await userEvent.click(screen.getByRole("button", { name: "Group by" }));
    expect(
      (await screen.findAllByRole("menuitem")).map(
        ({ textContent }) => textContent,
      ),
    ).toEqual([
      "None, chosen",
      "Manager",
      "Position",
      "State",
      "Site",
      "Levels",
    ]);
  });

  it("offers Group by Feature teams after Manager, once people's feature teams are sent", async () => {
    render(
      grid({
        people: [person("p1", { featureTeams: [] })],
        lists: [positions],
      }),
    );
    await userEvent.click(screen.getByRole("button", { name: "Group by" }));
    expect(
      (await screen.findAllByRole("menuitem")).map(
        ({ textContent }) => textContent,
      ),
    ).toEqual(["None, chosen", "Manager", "Feature teams", "Position"]);
  });

  it("groups people under each feature team they are on, by name, then those on none, counting each once", () => {
    const mobile = { id: "t2", name: "Mobile apps" };
    const payments = { id: "t1", name: "Payments core" };
    render(
      grid({
        people: [
          person("p1", { featureTeams: [mobile, payments] }),
          person("p2", { featureTeams: [] }),
        ],
        lists: [positions],
        view: { ...emptyView, grouping: "featureTeams" },
      }),
    );
    expect(
      screen.getAllByRole("rowheader").map(({ textContent }) => textContent),
    ).toEqual([
      "Mobile apps1 person",
      "Payments core1 person",
      "No feature team1 person",
    ]);
    expect(screen.getAllByText("+1")).toHaveLength(2);
    expect(screen.getByRole("status").textContent).toBe("2 people");
  });

  it("groups people by an added column's choice, in its list's order, then those with none", () => {
    render(
      grid({
        people: [
          person("p1", { values: { f1: ["c1"] } }),
          person("p2", { values: {} }),
        ],
        fields: [site],
        lists: [positions, sites],
        view: { ...emptyView, grouping: "f1" },
      }),
    );
    expect(
      screen.getAllByRole("rowheader").map(({ textContent }) => textContent),
    ).toEqual(["Harbour1 person", "No site1 person"]);
  });

  it("offers no grouping by a column only drafted to be added while live alone shows", async () => {
    const office: Field = {
      ...site,
      id: "f2",
      name: "Office",
      draft: {
        action: "created",
        changed: [],
        live: {},
        state: "waiting",
        madeBy: null,
        madeAt: null,
      },
    };
    render(
      grid({
        fields: [site, office],
        lists: [positions, sites],
        view: { ...emptyView, show: "live" },
      }),
    );
    await userEvent.click(screen.getByRole("button", { name: "Group by" }));
    expect(
      (await screen.findAllByRole("menuitem")).map(
        ({ textContent }) => textContent,
      ),
    ).toEqual(["None, chosen", "Manager", "Position", "Site"]);
  });
});
