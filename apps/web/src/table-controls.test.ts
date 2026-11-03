// SPDX-License-Identifier: Apache-2.0

// Tests for how the controls above a table describe each filter in words, and how sorting by a
// column adds it to the sort or changes its direction. The controls themselves are tested on the
// People page.

import { describe, expect, it } from "vitest";
import { describeFilter, sortedBy, viewParts } from "./table-controls.tsx";
import { emptyView } from "./table-view.ts";

const column = (kind: "text" | "date" | "choice") => ({
  key: "k",
  label: "Level",
  kind,
  choices: [
    { id: "a", label: "P1" },
    { id: "b", label: "P2" },
  ],
  multiple: false,
});

describe("what saving a view keeps", () => {
  const level = { ...column("choice"), key: "level" };
  const site = { ...column("choice"), key: "site", label: "Site" };

  it("names each part that is set, what the Draft menu shows and the metrics included", () => {
    expect(
      viewParts(
        {
          search: " fictional ",
          show: "live",
          filters: { level: { any: ["a"] }, site: {}, gone: { empty: true } },
          sort: [
            { key: "level", descending: true },
            { key: "gone", descending: false },
            { key: "site", descending: false },
          ],
          breakdown: ["level", "site"],
        },
        [level, site],
      ),
    ).toEqual([
      { name: "Search", value: "“fictional”" },
      { name: "Filter", value: "Level: P1" },
      { name: "Sort", value: "Level ↓, Site ↑" },
      { name: "Draft", value: "Live only" },
      { name: "Metrics", value: "Level by Site" },
    ]);
  });

  it("leaves out what is not set, and metrics that break down by nothing yet", () => {
    expect(viewParts(emptyView, [level])).toEqual([]);
    expect(
      viewParts({ ...emptyView, show: "drafts", breakdown: [] }, [level]),
    ).toEqual([{ name: "Draft", value: "Drafts applied" }]);
  });
});

describe("filters in words", () => {
  it("name the choices picked, in their list's order, and empty values", () => {
    expect(describeFilter(column("choice"), { any: ["b", "a"] })).toBe(
      "Level: P1, P2",
    );
    expect(describeFilter(column("choice"), { empty: true })).toBe(
      "Level: Empty",
    );
    expect(
      describeFilter(
        { ...column("choice"), emptyLabel: "No level" },
        { any: ["a"], empty: true },
      ),
    ).toBe("Level: P1, No level");
  });

  it("give the dates between, from, or until, and no date", () => {
    expect(
      describeFilter(column("date"), { from: "2026-01-01", to: "2026-06-30" }),
    ).toMatch(/^Level: .*2026 to .*2026$/);
    expect(describeFilter(column("date"), { from: "2026-01-01" })).toMatch(
      /^Level: from /,
    );
    expect(
      describeFilter(column("date"), { to: "2026-01-01", empty: true }),
    ).toMatch(/^Level: until .* or no date$/);
  });

  it("say what text contains, and empty text", () => {
    expect(describeFilter(column("text"), { contains: " x " })).toBe(
      "Level contains “x”",
    );
    expect(describeFilter(column("text"), { empty: true })).toBe("Level empty");
  });
});

describe("sorting by a column", () => {
  it("adds it as the next level, or changes its direction in place", () => {
    const first = sortedBy(emptyView, "a", false);
    const both = sortedBy(first, "b", true);
    expect(both.sort).toEqual([
      { key: "a", descending: false },
      { key: "b", descending: true },
    ]);
    expect(sortedBy(both, "a", true).sort).toEqual([
      { key: "a", descending: true },
      { key: "b", descending: true },
    ]);
  });
});
