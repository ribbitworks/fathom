// SPDX-License-Identifier: Apache-2.0

// Tests for a filter in words, and as its pill names it, a coloured choice after its square.

import { MantineProvider } from "@mantine/core";
import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { describeFilter, FilterWords } from "./filter-words.tsx";
import type { Filter } from "./table-view.ts";
import { testTheme } from "./test-support.tsx";

const column = (more: object) => ({
  key: "effort",
  label: "Effort",
  kind: "number" as const,
  choices: [],
  multiple: false,
  ...more,
});

describe("describeFilter of every value that isn't empty", () => {
  it("names it in words matching the column's Empty box, alone", () => {
    expect(
      describeFilter(column({ label: "Onboarding", kind: "note" }), {
        notEmpty: true,
        contains: "plan",
      }),
    ).toBe("Onboarding: Not empty");
    expect(
      describeFilter(column({ label: "Start", kind: "date" }), {
        notEmpty: true,
      }),
    ).toBe("Start: Any date");
    expect(describeFilter(column({}), { notEmpty: true })).toBe(
      "Effort: Any number",
    );
  });
});

const unlabelled = column({
  key: "team",
  label: "Team",
  kind: "choice" as const,
  choices: [
    { id: "t1", label: "Mobile apps", retired: false, description: "" },
    { id: "t2", label: "Data platform", retired: false, description: "" },
  ],
  choiceColour: (id: string) => (id === "t1" ? "teal" : null),
});
const teams = { ...unlabelled, emptyLabel: "No team" };

// A pill's words, and the colours of the squares among them.
const pill = (
  shown: Parameters<typeof FilterWords>[0]["column"],
  filter: Filter,
) => {
  render(
    <MantineProvider theme={testTheme}>
      <span id="pill">
        <FilterWords column={shown} filter={filter} />
      </span>
    </MantineProvider>,
  );
  const container = document.getElementById("pill") as HTMLElement;
  return [
    container.textContent,
    [...container.querySelectorAll<HTMLElement>("[data-colour]")].map(
      (square) => square.dataset.colour,
    ),
  ];
};

describe("a filter's pill", () => {
  it("names each coloured choice after its square, and the empty one by its words", () => {
    expect(pill(teams, { any: ["t1", "t2"], empty: true })).toEqual([
      "Team: Mobile apps, Data platform, No team",
      ["teal"],
    ]);
  });

  it("calls an empty choice Empty where the column has no words for it", () => {
    expect(pill(unlabelled, { empty: true })).toEqual(["Team: Empty", []]);
  });

  it("names every value that isn't empty in words alone", () => {
    expect(pill(teams, { notEmpty: true })).toEqual(["Team: Not empty", []]);
  });

  it("names a column with no colours in words alone", () => {
    expect(
      pill({ ...teams, choiceColour: undefined }, { any: ["t1"] }),
    ).toEqual(["Team: Mobile apps", []]);
  });
});
