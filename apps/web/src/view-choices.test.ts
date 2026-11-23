// SPDX-License-Identifier: Apache-2.0

// Tests for a table's own choices of which records it shows: a choice kept under its name, and the
// rows a tab hides unless a choice shows them, and those a table keeps while its narrowing choices
// are on, with the Views menu's items for them.

import { describe, expect, it } from "vitest";
import { emptyView, type View } from "./table-view.ts";
import {
  hiddenUnlessShown,
  keptByChoices,
  namedChoice,
} from "./view-choices.ts";

const over = namedChoice("over");
const under = namedChoice("under");

describe("namedChoice", () => {
  it("is on once turned on, and off again once turned off, keeping the view's other choices", () => {
    const shown = over.turned(
      { ...emptyView, choices: { under: "shown" } },
      true,
    );

    expect([over.on(shown), under.on(shown)]).toEqual([true, true]);
    expect(over.on(over.turned(shown, false))).toBe(false);
    expect(under.on(over.turned(shown, false))).toBe(true);
  });

  it("is off in a view with no choices", () => {
    expect(over.on(emptyView)).toBe(false);
  });
});

describe("keptByChoices", () => {
  const rows = [
    { name: "Avery", over: true, under: false },
    { name: "Casey", over: false, under: true },
    { name: "Blair", over: true, under: true },
    { name: "Dana", over: false, under: false },
  ];
  type Row = (typeof rows)[number];

  const kept = (view: View, among: readonly Row[] = rows) =>
    keptByChoices({
      rows: among,
      choices: [
        { choice: over, label: "Over", matches: (row) => row.over },
        { choice: under, label: "Under", matches: (row) => row.under },
      ],
      view,
    });

  const names = (view: View) => kept(view).rows.map(({ name }) => name);

  it("keeps every row while no choice is on", () => {
    expect(names(emptyView)).toEqual(["Avery", "Casey", "Blair", "Dana"]);
  });

  it("keeps only the rows matching the choice on", () => {
    expect(names(over.turned(emptyView, true))).toEqual(["Avery", "Blair"]);
  });

  it("keeps the rows matching either choice while both are on", () => {
    const both = under.turned(over.turned(emptyView, true), true);

    expect(names(both)).toEqual(["Avery", "Casey", "Blair"]);
  });

  it("offers each choice with the rows it would keep, named Only in a saved view", () => {
    expect(
      kept(emptyView).choices.map(({ label, count, part }) => ({
        label,
        count,
        part,
      })),
    ).toEqual([
      { label: "Over", count: 2, part: { name: "Only", value: "Over" } },
      { label: "Under", count: 2, part: { name: "Only", value: "Under" } },
    ]);
  });

  it("offers a choice no row matches only while it is on, so it can be turned off", () => {
    const none = rows.filter(({ over: isOver }) => !isOver);

    expect(kept(emptyView, none).choices.map(({ label }) => label)).toEqual([
      "Under",
    ]);
    expect(
      kept(over.turned(emptyView, true), none).choices.map(
        ({ label }) => label,
      ),
    ).toEqual(["Over", "Under"]);
  });
});

describe("hiddenUnlessShown", () => {
  const shipped = namedChoice("shipped");
  const releases = [
    { name: "27.1", shipped: true },
    { name: "27.2", shipped: false },
  ];

  const shown = (view: View, rows = releases) =>
    hiddenUnlessShown({
      rows,
      hidden: (row) => row.shipped,
      choice: shipped,
      label: "Show shipped",
      records: "shipped",
      view,
    });

  it("leaves out the hidden rows until the choice is on", () => {
    expect(shown(emptyView).rows.map(({ name }) => name)).toEqual(["27.2"]);
    expect(
      shown(shipped.turned(emptyView, true)).rows.map(({ name }) => name),
    ).toEqual(["27.1", "27.2"]);
  });

  it("offers the choice with the rows it adds, named Show in a saved view", () => {
    expect(
      shown(emptyView).choices.map(({ label, count, part }) => ({
        label,
        count,
        part,
      })),
    ).toEqual([
      {
        label: "Show shipped",
        count: 1,
        part: { name: "Show", value: "shipped" },
      },
    ]);
  });

  it("offers no choice while nothing is hidden and it is off", () => {
    const unshipped = releases.filter((row) => !row.shipped);

    expect(shown(emptyView, unshipped).choices).toEqual([]);
  });
});
