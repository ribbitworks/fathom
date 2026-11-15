// SPDX-License-Identifier: Apache-2.0

// Tests for a long list folded as a panel shows it: its first few from a starting item, the rest
// behind one control in one place (Show all, or Later where earlier items fold above), and the items
// before the start behind a control of their own, each
// saying whether it is open and folding back to how the list first appeared.

import { MantineProvider } from "@mantine/core";
import { render, screen } from "@testing-library/react";
import { userEvent } from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { FoldedList } from "./folded-list.tsx";
import { testTheme } from "./test-support.tsx";

const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul"];

function renderList(items: readonly string[], start: number, first: number) {
  render(
    <MantineProvider theme={testTheme}>
      <FoldedList items={items} start={start} first={first} noun="months">
        {(shown) => (
          <ul aria-label="Months">
            {shown.map((month) => (
              <li key={month}>{month}</li>
            ))}
          </ul>
        )}
      </FoldedList>
    </MantineProvider>,
  );
}

const shown = () =>
  screen.getAllByRole("listitem").map(({ textContent }) => textContent);
const control = (name: string) => screen.getByRole("button", { name });

describe("a folded list", () => {
  it("first shows its first few from the start, with the earlier ones and the rest folded", () => {
    renderList(months, 2, 3);
    expect([
      shown(),
      control("Earlier months (2)").getAttribute("aria-expanded"),
      control("Later months (2)").getAttribute("aria-expanded"),
    ]).toEqual([["Mar", "Apr", "May"], "false", "false"]);
  });

  it("shows the later ones, then folds them back in the same place", async () => {
    renderList(months, 2, 3);
    await userEvent.click(control("Later months (2)"));
    expect([
      shown(),
      control("Hide later months").getAttribute("aria-expanded"),
    ]).toEqual([["Mar", "Apr", "May", "Jun", "Jul"], "true"]);

    await userEvent.click(control("Hide later months"));
    expect(shown()).toEqual(["Mar", "Apr", "May"]);
  });

  it("unfolds the earlier ones above, and hides them again", async () => {
    renderList(months, 2, 3);
    await userEvent.click(control("Earlier months (2)"));
    expect([
      shown(),
      control("Hide earlier months").getAttribute("aria-expanded"),
    ]).toEqual([["Jan", "Feb", "Mar", "Apr", "May"], "true"]);

    await userEvent.click(control("Hide earlier months"));
    expect(shown()).toEqual(["Mar", "Apr", "May"]);
  });

  it("keeps focus on the control used", async () => {
    renderList(months, 2, 3);
    await userEvent.click(control("Later months (2)"));
    expect(document.activeElement).toBe(control("Hide later months"));
  });

  it("shows all of a list starting at its first item, then less", async () => {
    renderList(months, 0, 3);
    await userEvent.click(control("Show all (7)"));
    expect(shown()).toHaveLength(7);

    await userEvent.click(control("Show less"));
    expect(shown()).toEqual(["Jan", "Feb", "Mar"]);
  });

  it("offers no controls for a list that fits from its first item", () => {
    renderList(months.slice(0, 3), 0, 3);
    expect([shown(), screen.queryAllByRole("button")]).toEqual([
      ["Jan", "Feb", "Mar"],
      [],
    ]);
  });
});
