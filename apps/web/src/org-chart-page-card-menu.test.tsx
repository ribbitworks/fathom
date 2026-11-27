// SPDX-License-Identifier: Apache-2.0

// Tests for the menu of a card on the Org chart page, and finding a card by its key.

import { screen, within } from "@testing-library/react";
import { userEvent } from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import {
  setUpEachTest,
  person,
  people,
  chartJson,
  openChart,
} from "./test-org-chart-page.tsx";

setUpEachTest();

describe("a card's menu and finding by key", () => {
  // Uma, and a planned hire, under the same number, as each kind counts its own.
  const keyed = () =>
    chartJson({
      people: [
        ...people.map((one) =>
          one.id === "p4" ? { ...one, keyNumber: 4 } : one,
        ),
        person("h1", "Fictional Engineer, TBD-7", "p1", {
          keyNumber: 4,
          employeeId: null,
          planned: { expected: "2027-03", shownId: "TBD-7" },
        }),
      ],
    });

  // The items of the card's menu, which opens while Show levels' menu may still be closing.
  const items = async () => {
    const copy = await screen.findByRole("menuitem", { name: "Copy link" });
    return within(copy.closest<HTMLElement>("[role=menu]") as HTMLElement)
      .getAllByRole("menuitem")
      .map(({ textContent }) => textContent);
  };

  it("opens a person's card menu from a right-click, with no ⋯, and copies their link", async () => {
    const user = userEvent.setup();
    await openChart(keyed);
    await screen.findByRole("link", { name: "Uma Fictional" });
    expect(
      screen.queryByRole("button", { name: "Actions for Uma Fictional" }),
    ).toBeNull();
    await user.pointer({
      keys: "[MouseRight]",
      target: screen.getByRole("link", { name: "Uma Fictional" }),
    });
    expect(await items()).toEqual(["Show details", "Copy link"]);
    await user.click(screen.getByRole("menuitem", { name: "Copy link" }));
    expect(await navigator.clipboard.readText()).toBe(
      `${window.location.origin}/go/person/4`,
    );
  });

  it("shows a person's details from their card's menu, opened from the menu key", async () => {
    const history = await openChart(keyed);
    screen.getByRole("link", { name: "Uma Fictional" }).focus();
    await userEvent.keyboard("{ContextMenu}");
    await userEvent.click(
      await screen.findByRole("menuitem", { name: "Show details" }),
    );
    expect(history.location.search).toContain("open=FX-p4");
  });

  it("offers a planned hire's placeholder only Copy link, linking the hire", async () => {
    const user = userEvent.setup();
    await openChart(keyed);
    const placeholder = await screen.findByRole("group", {
      name: "Fictional Engineer, TBD-7",
    });
    await user.pointer({ keys: "[MouseRight]", target: placeholder });
    expect(await items()).toEqual(["Copy link"]);
    await user.click(screen.getByRole("menuitem", { name: "Copy link" }));
    expect(await navigator.clipboard.readText()).toBe(
      `${window.location.origin}/go/hire/4`,
    );
  });

  it("opens the menu of a card with no link from Shift+F10 on the card itself", async () => {
    await openChart(keyed);
    const placeholder = await screen.findByRole("group", {
      name: "Fictional Engineer, TBD-7",
    });
    placeholder.focus();
    await userEvent.keyboard("{Shift>}{F10}{/Shift}");
    expect(await items()).toEqual(["Copy link"]);
  });

  it.each([
    ["#person-4", "Uma Fictional"],
    ["HIRE-4", "Fictional Engineer, TBD-7"],
  ])("finds by the key %s only who has it", async (typed, name) => {
    await openChart(keyed);
    await userEvent.type(
      screen.getByRole("combobox", { name: "Find a person or team" }),
      typed,
    );
    await screen.findByRole("option", {
      name: (label) => label.startsWith(name),
    });
    const options = screen.getAllByRole("option");
    expect(options).toHaveLength(1);
    expect(options[0]?.textContent.startsWith(name)).toBe(true);
  });

  it("says nobody has a key nobody on the chart has", async () => {
    await openChart(keyed);
    await userEvent.type(
      screen.getByRole("combobox", { name: "Find a person or team" }),
      "#PERSON-40",
    );
    expect(await screen.findByText("Nobody has that key")).toBeDefined();
  });
});
