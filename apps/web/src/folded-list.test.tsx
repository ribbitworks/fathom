// SPDX-License-Identifier: Apache-2.0

// Tests for a long list folded as a panel shows it.

import { MantineProvider } from "@mantine/core";
import { render, screen } from "@testing-library/react";
import { userEvent } from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { FoldedList } from "./folded-list.tsx";
import { testTheme } from "./test-support.tsx";

const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul"];

function renderList(
  items: readonly string[],
  start: number,
  first: number,
  more: { newestFirst?: boolean; keepShown?: number } = {},
) {
  render(
    <MantineProvider theme={testTheme}>
      <FoldedList
        items={items}
        start={start}
        first={first}
        noun="months"
        {...more}
      >
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

describe("a folded list newest first, as a timeline's days", () => {
  it("calls those folded above later and those below earlier, even with none above", async () => {
    renderList([...months].reverse(), 2, 3, { newestFirst: true });

    expect(control("Later months (2)")).toBeDefined();
    await userEvent.click(control("Earlier months (2)"));
    expect(control("Hide earlier months")).toBeDefined();
    await userEvent.click(control("Later months (2)"));
    expect(control("Hide later months")).toBeDefined();
  });

  it("opens the fold holding the item to keep shown", () => {
    renderList(months, 2, 3, { keepShown: 0 });
    expect(shown()).toContain("Jan");
  });

  it("opens the fold after the first few when the item to keep shown is there", () => {
    renderList(months, 0, 3, { keepShown: 6 });
    expect(shown()).toContain("Jul");
  });
});

describe("an item to keep shown that changes", () => {
  it("opens the fold holding the new one", () => {
    const list = (keepShown?: number) => (
      <MantineProvider theme={testTheme}>
        <FoldedList
          items={months}
          start={2}
          first={3}
          noun="months"
          keepShown={keepShown}
        >
          {(shownItems) => (
            <ul aria-label="Months">
              {shownItems.map((month) => (
                <li key={month}>{month}</li>
              ))}
            </ul>
          )}
        </FoldedList>
      </MantineProvider>
    );
    const { rerender } = render(list());
    rerender(list(0));
    expect(shown()).toContain("Jan");
    rerender(list(6));
    expect(shown()).toContain("Jul");
  });
});
