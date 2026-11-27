// SPDX-License-Identifier: Apache-2.0

// Tests for the feature teams the fill form says a planned hire's person joins and leads, with the
// server's responses simulated: each from its day, following the start date entered and whoever is
// chosen, and left out when there are none.

import { screen } from "@testing-library/react";
import { userEvent } from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { detailRow, queryDetailRow, renderApp } from "./test-support.tsx";
import {
  setUpEachTest,
  person,
  robin,
  hire,
  answers,
  openForm,
} from "./test-hire-fill-form.tsx";

setUpEachTest();

const harbour = { id: "t1", name: "Fictional Harbour", colour: null };
const pier = { id: "t2", name: "Fictional Pier", colour: "teal" };

const on = (fromDate: string) => ({ member: true, fromDate });
const off = (fromDate: string) => ({ member: false, fromDate });

// A hire on Fictional Harbour from early 2030, leading it, until it leaves in April, and on
// Fictional Pier from June.
const onTeams = hire({
  teamsCarried: [
    {
      team: harbour,
      memberships: [on("2030-01-01"), off("2030-04-01")],
      leads: [on("2030-01-01")],
    },
    { team: pier, memberships: [on("2030-06-01")], leads: [] },
  ],
});

const form = () =>
  screen
    .getByRole("heading", { name: "Fill this planned hire" })
    .closest("section") as HTMLElement;
const formRow = (label: string) => detailRow(label, form());
const listed = (label: string) =>
  [...formRow(label).querySelectorAll("li")].map((item) => item.textContent);

async function chooseExisting(name: RegExp) {
  await userEvent.click(screen.getByRole("radio", { name: "Existing person" }));
  await userEvent.click(screen.getByRole("button", { name: "Change Person" }));
  await userEvent.click(await screen.findByRole("option", { name }));
}

describe("the feature teams a fill's person takes on", () => {
  it("lists the teams a new person joins and leads, each from its day", async () => {
    answers([robin, onTeams]);
    renderApp("/people");

    await openForm();

    expect(listed("Feature teams")).toEqual([
      "Fictional Harbour from Mar 1, 2030",
      "Fictional Pier from Jun 1, 2030",
    ]);
    expect(listed("Leads")).toEqual(["Fictional Harbour from Mar 1, 2030"]);
  });

  it("follows the start date entered, leaving out a team the hire leaves before it", async () => {
    // Given the form for the hire, starting on its own start date
    answers([robin, onTeams]);
    renderApp("/people");
    await openForm();

    // When a start after the hire leaves Fictional Harbour is entered, and the field left
    const start = screen.getByRole("textbox", { name: "Start" });
    await userEvent.clear(start);
    await userEvent.type(start, "2030-07-01");
    await userEvent.tab();

    // Then only Fictional Pier is joined, from that day, and no team is led
    expect(listed("Feature teams")).toEqual([
      "Fictional Pier from Jul 1, 2030",
    ]);
    expect(queryDetailRow("Leads", form())).toBeNull();
  });

  it("has someone already on a team stay on it, still taking over its lead", async () => {
    // Given someone in Fathom who is on Fictional Harbour today
    const sasha = person("p1", "Sasha Fictional", { featureTeams: [harbour] });
    answers([robin, sasha, onTeams]);
    renderApp("/people");
    await openForm();

    // When they are chosen to fill the hire
    await chooseExisting(/^Sasha Fictional/u);

    // Then they join only Fictional Pier, and lead Fictional Harbour from the hire's day
    expect(listed("Feature teams")).toEqual([
      "Fictional Pier from Jun 1, 2030",
    ]);
    expect(listed("Leads")).toEqual(["Fictional Harbour from Jan 1, 2030"]);
  });

  it("has someone not yet started join from their start date", async () => {
    // Given someone in Fathom who starts in 2031, after the hire joins its teams
    const sasha = person("p1", "Sasha Fictional", { startDate: "2031-01-15" });
    answers([robin, sasha, onTeams]);
    renderApp("/people");
    await openForm();

    // When they are chosen to fill the hire
    await chooseExisting(/^Sasha Fictional/u);

    // Then they join and lead from their start, Fictional Harbour having been left by then
    expect(listed("Feature teams")).toEqual([
      "Fictional Pier from Jan 15, 2031",
    ]);
    expect(queryDetailRow("Leads", form())).toBeNull();
  });

  it("gives no day for a team joined on the day shown", async () => {
    // Given a hire on Fictional Harbour since before today, and someone who started long ago
    const sasha = person("p1", "Sasha Fictional");
    const sinceBefore = hire({
      teamsCarried: [
        { team: harbour, memberships: [on("2020-01-01")], leads: [] },
      ],
    });
    answers([robin, sasha, sinceBefore]);
    renderApp("/people");
    await openForm();

    // When they are chosen to fill the hire
    await chooseExisting(/^Sasha Fictional/u);

    // Then they join it from today, which goes unsaid
    expect(listed("Feature teams")).toEqual(["Fictional Harbour"]);
  });

  it("shows neither row for a hire on no team", async () => {
    answers([robin, hire()]);
    renderApp("/people");

    await openForm();

    expect(queryDetailRow("Feature teams", form())).toBeNull();
    expect(queryDetailRow("Leads", form())).toBeNull();
  });
});
