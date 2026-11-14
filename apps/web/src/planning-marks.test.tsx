// SPDX-License-Identifier: Apache-2.0

// Tests for the Size and Risk marks: a block for each S, half a block for half an S and at most
// four, read aloud with the size's weight; and a segment for each step of a risk's list, filled up
// to its own, green to red.

import { MantineProvider } from "@mantine/core";
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { RiskMark, SizeMark, sizeWords } from "./planning-marks.tsx";
import { testTheme } from "./test-support.tsx";

const shown = (mark: React.ReactNode) =>
  render(<MantineProvider theme={testTheme}>{mark}</MantineProvider>);

const blockSpans = (label: string) =>
  [...screen.getByRole("img", { name: label }).children].map(
    (block) => (block as HTMLElement).style.gridColumn,
  );

describe("the Size mark", () => {
  it("draws a block for each S, half a block for half an S", () => {
    shown(<SizeMark name="M" weight={2.5} />);
    expect(blockSpans("Size M, 2.5 × S")).toEqual([
      "span 2",
      "span 2",
      "span 1",
    ]);
  });

  it("draws at most four blocks", () => {
    shown(<SizeMark name="XXL" weight={6} />);
    expect(blockSpans("Size XXL, 6 × S")).toHaveLength(4);
  });

  it("draws none for a size with no weight, named alone", () => {
    shown(<SizeMark name="Unweighed" weight={null} />);
    expect(blockSpans("Size Unweighed")).toEqual([]);
  });

  it("words a size with its weight, or alone", () => {
    expect(sizeWords("L", 3)).toBe("L, 3 × S");
    expect(sizeWords("L", null)).toBe("L");
  });
});

describe("the Risk mark", () => {
  const shades = () =>
    [...screen.getByRole("img").children].map(
      (segment) => (segment as HTMLElement).dataset.shade,
    );

  it("fills a segment for each step up to its own, green to red", () => {
    shown(<RiskMark name="Severe" step={3} steps={4} />);
    expect(screen.getByRole("img", { name: "Risk Severe" })).toBeTruthy();
    expect(shades()).toEqual(["low", "lowMiddle", "highMiddle", "high"]);
  });

  it("fills only the first step for the lowest", () => {
    shown(<RiskMark name="Low" step={0} steps={3} />);
    expect(shades()).toEqual(["low"]);
  });
});
