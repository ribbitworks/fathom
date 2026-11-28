// SPDX-License-Identifier: Apache-2.0

// Tests of the box saying who fills a planned hire on its card: the name in a part of its own, cut
// short where it doesn't fit, with the whole name in a tip while it is.

import { MantineProvider } from "@mantine/core";
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { FillerBox } from "./filler-box.tsx";
import { testTheme } from "./test-support.tsx";

const name = "Fictional Wilhelmina Featherstonehaugh";

// The box, its name's room measured as cut short or not, since the test's page lays nothing out.
function boxWith(starts: string | undefined, cut = false) {
  render(
    <MantineProvider theme={testTheme}>
      <FillerBox
        filled={{ name, ...(starts === undefined ? {} : { starts }) }}
      />
    </MantineProvider>,
  );
  const shownName = screen.getByText(name);
  Object.defineProperty(shownName, "scrollWidth", { value: cut ? 200 : 100 });
  Object.defineProperty(shownName, "clientWidth", { value: 100 });
  return shownName;
}

describe("the box saying who fills a planned hire", () => {
  it("says who fills it and the day they start, the name in a part of its own, before the comma", () => {
    const shownName = boxWith("starts May 3, 2027");

    expect([
      shownName.textContent,
      shownName.parentElement?.textContent,
    ]).toEqual([name, `Filled by ${name},`]);
    expect(shownName.closest("[data-filler]")?.textContent).toBe(
      `Filled by ${name}, starts May 3, 2027`,
    );
  });

  it("says who fills it alone, with no comma, when they have no start date", () => {
    const shownName = boxWith(undefined);

    expect(shownName.closest("[data-filler]")?.textContent).toBe(
      `Filled by ${name}`,
    );
  });

  it("gives the whole name in a tip while it's cut short and pointed at", async () => {
    const shownName = boxWith("starts May 3, 2027", true);

    fireEvent.mouseEnter(shownName);

    expect((await screen.findByRole("tooltip")).textContent).toBe(name);
  });
});
