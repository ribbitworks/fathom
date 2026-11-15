// SPDX-License-Identifier: Apache-2.0

// Tests for a record's parts in a summary row: how many, then their names, and a blank cell, but
// for its mark, when there are none, in the draft's row and the live row alike; and a row with its
// Live row under it.

import { MantineProvider } from "@mantine/core";
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { LiveParts, Parts, RowWithLive } from "./summary-row.tsx";
import { testTheme } from "./test-support.tsx";

const shown = (cell: React.ReactNode) =>
  render(
    <MantineProvider theme={testTheme}>
      <span data-testid="cell">{cell}</span>
    </MantineProvider>,
  );

const cellText = () => screen.getByTestId("cell").textContent;

describe("a record's parts", () => {
  it("counts those kept and names every one", () => {
    shown(
      <Parts
        mark={undefined}
        parts={[
          { id: "a", name: "Kept", removed: false },
          { id: "b", name: "Gone", removed: true },
        ]}
      />,
    );
    expect(cellText()).toBe("(1) Kept, Gone");
  });

  it("is blank with none, but for its draft's mark", () => {
    shown(<Parts mark={{ action: "changed", state: "waiting" }} parts={[]} />);
    expect(cellText()).toBe(", Draft");
  });
});

describe("a record's parts as they are live", () => {
  it("counts and names them", () => {
    shown(<LiveParts marked={false} names={["One", "Two"]} />);
    expect(cellText()).toBe("(2) One, Two");
  });

  it("is blank with none, but for Live's mark", () => {
    shown(<LiveParts marked names={[]} />);
    expect(cellText()).toBe(", live");
  });
});

describe("a row with its Live row", () => {
  it("draws the Live row under it, hidden from screen readers, with no role of its own when the row has none", () => {
    shown(
      <RowWithLive
        className="row"
        liveClassName="live"
        tint={{ action: "changed", state: "waiting" }}
        liveCells={<span>Fictional Was</span>}
      >
        Fictional Now
      </RowWithLive>,
    );
    const live = screen.getByText("Fictional Was").parentElement as HTMLElement;
    expect([
      live.getAttribute("aria-hidden"),
      live.getAttribute("role"),
      live.previousElementSibling?.textContent,
    ]).toEqual(["true", null, "Fictional Now"]);
  });
});
