// SPDX-License-Identifier: Apache-2.0

// Tests for making the shared table's columns, with a made-up kind of record, gadgets.

import { userEvent } from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { MantineProvider } from "@mantine/core";
import { act, render, screen, within } from "@testing-library/react";
import { choice } from "./lists.ts";
import { startingEffortConversions } from "@fathom/shared";
import { effortColumnUnits } from "./effort.ts";
import {
  breaksDown,
  cellColumn,
  inOrder,
  inViewUnits,
  keyColumn,
  keyColumnKey,
  liveContent,
  wordsColumn,
} from "./grid-columns.tsx";
import { effortColumn } from "./planning-columns.tsx";
import type { GridDraft, RecordActions } from "./record-table.ts";
import { type View, emptyView } from "./table-view.ts";
import {
  type Gadget,
  type GadgetChange,
  actions,
  gadget,
  gadgetTable,
  nameThen,
  nextColumn,
  recordCell,
  renderGadgets,
  testTheme,
  waiting,
} from "./test-support.tsx";

describe("the order of the columns", () => {
  it("follows the order given, putting columns it does not name at the end in their usual order", () => {
    expect(
      inOrder([{ key: "a" }, { key: "b" }, { key: "c" }], ["c", "a"]).map(
        ({ key }) => key,
      ),
    ).toEqual(["c", "a", "b"]);
  });
});

describe("a column of the words its records hold", () => {
  interface Held {
    id: string;
    site: unknown;
    draft?: GridDraft & { live: object };
  }
  const held: Held[] = [
    { id: "a", site: "B" },
    { id: "b", site: "" },
    { id: "c", site: ["C10", "C9", 1] },
  ];

  it("reads one word, none, or several, as they are live too", () => {
    const sites = wordsColumn<Held, never>("site", "Site", held);
    expect([
      ...held.map((record) => sites.value(record)),
      sites.live({
        action: "changed",
        changed: ["site"],
        state: "waiting",
        madeBy: "Fictional Editor",
        live: { site: "X" },
      }),
      sites.readOnly,
    ]).toEqual([["B"], [], ["C10", "C9"], ["X"], true]);
  });

  it("offers every word its records hold, alphabetically with numbers in order, or in the order given", () => {
    const labels = (order?: (one: string, other: string) => number) =>
      wordsColumn<Held, never>("site", "Site", held, {
        required: true,
        multiple: true,
        emptyLabel: "None",
        ...(order === undefined ? {} : { order }),
      }).choices.map(({ label }) => label);
    expect([
      labels(),
      labels((one, other) => other.localeCompare(one)),
    ]).toEqual([
      ["B", "C9", "C10"],
      ["C9", "C10", "B"],
    ]);
  });
});

describe("the Key column", () => {
  // Gadget "a" has a draft, so it has a Live row, "c" stands for a record not yet saved, which has
  // no key, and "d" is drafted to be added.
  const keyNumbers = new Map([
    ["a", 2],
    ["b", 12],
    ["c", 0],
    ["d", 5],
  ]);
  const keyOf = ({ id }: Gadget) => ({
    kind: "feature" as const,
    keyNumber: keyNumbers.get(id) ?? 0,
  });
  const keyedTable = () => ({ ...gadgetTable(), keyOf });
  const keyed = [
    gadget("a", {
      draft: { ...waiting, action: "changed", changed: ["code"] },
    }),
    gadget("b"),
    gadget("c"),
    gadget("d", { draft: { ...waiting, action: "created" } }),
  ];
  const keyShown: View = { ...emptyView, shown: [keyColumnKey] };
  const headings = () =>
    screen
      .getAllByRole("button", { name: / column/u })
      .map((button) => button.getAttribute("aria-label")?.split(" column")[0]);
  const namesShown = () =>
    screen
      .getAllByRole("row")
      .flatMap((row) => /Gadget \w/u.exec(row.textContent)?.[0] ?? []);

  it("is hidden at first, offered under Hidden in the Views menu", async () => {
    // Given a table whose records have keys
    const onView = vi.fn<(view: View) => void>();
    renderGadgets({ gadgets: keyed, table: keyedTable(), onView });
    expect(headings()).not.toContain("Key");

    // When it is chosen under Hidden in the Views menu
    await userEvent.click(screen.getByRole("button", { name: /^Views/u }));
    const menu = await screen.findByRole("menu");
    expect(within(menu).getByText("Hidden")).toBeDefined();
    await userEvent.click(
      within(menu).getByRole("menuitem", { name: "Key, show" }),
    );

    // Then the view names it shown
    expect(onView).toHaveBeenLastCalledWith(
      expect.objectContaining({ shown: [keyColumnKey] }),
    );
  });

  it("shows each saved row's whole key right after Name, and none for a row not saved or being added", () => {
    renderGadgets({ gadgets: keyed, table: keyedTable(), view: keyShown });

    expect(headings()).toEqual(["Name", "Key", "Code", "Colour"]);
    expect(recordCell("a", keyColumnKey)?.textContent).toBe("#FEATURE-2");
    expect(recordCell("b", keyColumnKey)?.textContent).toBe("#FEATURE-12");
    expect(recordCell("c", keyColumnKey)?.textContent).toBe("");
    expect(recordCell("d", keyColumnKey)?.textContent).toContain("#FEATURE-5");
    expect(document.getElementById("cell-new-0-recordKey")?.textContent).toBe(
      "",
    );
  });

  it("draws the key in a changed record's Live row too", () => {
    renderGadgets({ gadgets: keyed, table: keyedTable(), view: keyShown });

    const liveRows = [
      ...document.querySelectorAll('tbody tr[aria-hidden="true"]'),
    ];
    expect(liveRows).toHaveLength(1);
    expect(liveRows[0]?.textContent).toContain("#FEATURE-2");
  });

  it("asks nothing of it, or of any other read-only column, for a new record", async () => {
    // Given a table with keys and another read-only column, whose change is watched
    const change = vi.fn((): GadgetChange => ({}));
    const add =
      vi.fn<RecordActions<Gadget, GadgetChange, GadgetChange>["add"]>();
    renderGadgets({
      gadgets: [],
      fields: [],
      table: {
        ...nameThen({ ...nextColumn("text"), readOnly: true, change }),
        keyOf,
      },
      given: actions({ add }),
    });

    // When a new record is added
    act(() => {
      document.getElementById("cell-new-0-name")?.focus();
    });
    await userEvent.keyboard("Widget{Enter}");

    // Then its request holds its name alone
    expect(add.mock.calls.at(0)?.[0].map(({ request }) => request)).toEqual([
      { name: "Widget" },
    ]);
    expect(change).not.toHaveBeenCalled();
  });

  it("sorts by the key's number, not its text", () => {
    renderGadgets({
      gadgets: [gadget("b"), gadget("a")],
      table: keyedTable(),
      view: { ...keyShown, sort: [{ key: keyColumnKey, descending: false }] },
    });
    expect(namesShown()).toEqual(["Gadget a", "Gadget b"]);
  });

  it("filters by the key's number", () => {
    renderGadgets({
      gadgets: keyed,
      table: keyedTable(),
      view: { ...keyShown, filters: { [keyColumnKey]: { atLeast: 10 } } },
    });
    expect(namesShown()).toEqual(["Gadget b"]);
  });

  it("goes after Name in a view whose own order does not name it", () => {
    renderGadgets({
      gadgets: keyed,
      table: keyedTable(),
      view: { ...keyShown, order: ["code", "name", "f1"] },
    });
    expect(headings()).toEqual(["Code", "Name", "Key", "Colour"]);
  });

  it("keeps its place in a view whose own order names it", () => {
    renderGadgets({
      gadgets: keyed,
      table: keyedTable(),
      view: { ...keyShown, order: ["code", keyColumnKey, "name", "f1"] },
    });
    expect(headings()).toEqual(["Code", "Key", "Name", "Colour"]);
  });

  it("is left out of word search, while a whole key typed finds its record", () => {
    const found = (search: string) => {
      const { unmount } = renderGadgets({
        gadgets: keyed,
        table: keyedTable(),
        view: { ...keyShown, search },
      });
      const names = namesShown();
      unmount();
      return names;
    };
    expect(found("12")).toEqual([]);
    expect(found("#FEATURE-12")).toEqual(["Gadget b"]);
  });

  describe("on its own", () => {
    it("is as wide as its longest key, each character counted a little wider", () => {
      expect(keyColumn(keyOf, keyed).cellChars).toBe(
        Math.ceil("#FEATURE-12".length * 1.3),
      );
      expect(keyColumn(keyOf, []).cellChars).toBe(
        Math.ceil("Key".length * 1.3),
      );
    });

    it("has no live value and refuses any change", () => {
      const column = keyColumn<Gadget, GadgetChange>(keyOf, keyed);
      expect(column.live({ ...waiting, action: "changed" })).toBeNull();
      expect(() => column.change("3")).toThrow(
        "A record's key can't be changed",
      );
    });
  });
});

describe("which columns Metrics breaks rows down by", () => {
  it.each([
    ["text", false, false],
    ["note", false, false],
    ["link", false, false],
    ["choice", true, true],
    ["flag", true, true],
    ["month", true, true],
    ["date", false, true],
    ["number", false, true],
  ] as const)(
    "a %s column: required %s, otherwise %s",
    (kind, whenRequired, otherwise) => {
      expect(breaksDown({ kind, required: true })).toBe(whenRequired);
      expect(breaksDown({ kind, required: false })).toBe(otherwise);
    },
  );

  it("follows the column where a table says otherwise", () => {
    expect(
      breaksDown({ kind: "text", required: false, breaksDown: true }),
    ).toBe(true);
    expect(
      breaksDown({ kind: "choice", required: true, breaksDown: false }),
    ).toBe(false);
  });
});

describe("a column shown in a unit", () => {
  it.each([
    ["with the conversions", startingEffortConversions],
    ["without them", undefined],
  ] as const)(
    "keeps Effort out of Metrics' breakdown in every unit and decimal place, %s",
    (_case, conversions) => {
      const effort = effortColumn(conversions);
      for (const { key } of effortColumnUnits) {
        for (const places of [0, 1, 2]) {
          const shown = inViewUnits(effort, {
            units: { estimateHours: key },
            places: { estimateHours: places },
          });
          expect(breaksDown(shown), `${key} to ${String(places)}`).toBe(false);
        }
      }
      expect(breaksDown(inViewUnits(effort, emptyView))).toBe(false);
    },
  );
});

describe("a Live row's coloured choices", () => {
  it("names each after its square, in one line", () => {
    render(
      <MantineProvider theme={testTheme}>
        <span id="live">
          {liveContent(
            {
              ...cellColumn<Gadget, GadgetChange>("teams", "choice", {
                label: "Feature teams",
                required: false,
                multiple: true,
                choices: [
                  choice("t1", "Mobile apps", false),
                  choice("t2", "Data platform", false),
                ],
              }),
              choiceColour: (id) => (id === "t1" ? "teal" : null),
            },
            ["t1", "t2"],
          )}
        </span>
      </MantineProvider>,
    );
    const live = document.getElementById("live");
    expect([
      live?.textContent,
      [...(live?.querySelectorAll<HTMLElement>("[data-colour]") ?? [])].map(
        (square) => square.dataset.colour,
      ),
    ]).toEqual(["Mobile apps, Data platform", ["teal"]]);
  });
});
