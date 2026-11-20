// SPDX-License-Identifier: Apache-2.0

// Tests for the shared table's rows under their headings, with a made-up kind of record, gadgets.

import { MantineProvider } from "@mantine/core";
import { act, render, screen, waitFor } from "@testing-library/react";
import { userEvent } from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { focusRecordCell } from "./grid-row.tsx";
import { RecordGrid } from "./record-grid.tsx";
import type { RecordActions, RecordTable } from "./record-table.ts";
import { emptyView } from "./table-view.ts";
import type { RowGroup } from "./row-groups.ts";
import {
  type Gadget,
  type GadgetChange,
  actions,
  choiceUnder,
  choicesUnder,
  gadget,
  gadgetTable,
  noop,
  recordCell,
  renderGadgets,
  testTheme,
  tipOn,
  waiting,
} from "./test-support.tsx";

describe("a record under several groups", () => {
  // Each letter of a gadget's code is a group it's in.
  const byLetters: RecordTable<Gadget, GadgetChange, GadgetChange> = {
    ...gadgetTable(),
    groupings: [
      {
        key: "letters",
        label: "Letters",
        holds: "list",
        of: ({ code }) => {
          const [first, ...rest] = Array.from(code, (letter) => ({
            key: letter,
            label: `Group ${letter}`,
            rank: letter.charCodeAt(0),
          }));
          // Every gadget here has a code.
          return [first as RowGroup, ...rest];
        },
      },
    ],
  };
  const gadgets = [
    gadget("a", { code: "XY" }),
    gadget("b", { code: "X" }),
    gadget("c", { code: "Y" }),
  ];
  const view = { ...emptyView, grouping: "letters" };
  const nameCells = () =>
    screen
      .getAllByRole("gridcell")
      .filter((cell) =>
        cell.getAttribute("data-record-cell")?.endsWith(" name"),
      );

  it("shows a record under each of its groups, each heading counting its own rows, and the table counting it once", () => {
    renderGadgets({ gadgets, table: byLetters, view });

    expect(
      screen.getAllByRole("rowheader").map(({ textContent }) => textContent),
    ).toEqual(["Group X2 gadgets", "Group Y2 gadgets"]);
    expect(nameCells().map(({ textContent }) => textContent)).toEqual([
      "Gadget a+1, also under Group Y.",
      "Gadget b",
      "Gadget a+1, also under Group X.",
      "Gadget c",
    ]);
    expect(screen.getByRole("status").textContent).toBe("3 gadgets");
  });

  it("names the other groups in the mark's tip, shown on pointing at it", async () => {
    renderGadgets({ gadgets, table: byLetters, view });

    const tips = [];
    for (const mark of screen.getAllByText("+1")) tips.push(await tipOn(mark));
    expect(tips).toEqual(["Also under Group Y", "Also under Group X"]);
  });

  it("gives each row of a record a cell of its own, which the arrows step through", async () => {
    renderGadgets({ gadgets, table: byLetters, view });
    const [first, , second] = nameCells();
    expect(first?.id).not.toBe(second?.id);
    act(() => {
      first?.focus();
    });

    await userEvent.keyboard("{ArrowDown}{ArrowDown}");

    expect(document.activeElement).toBe(second);
  });

  it("saves a change made in any of a record's rows to the record", async () => {
    const update =
      vi.fn<RecordActions<Gadget, GadgetChange, GadgetChange>["update"]>();
    renderGadgets({
      gadgets,
      table: byLetters,
      view,
      given: actions({ update }),
    });
    act(() => {
      nameCells()[2]?.focus();
    });

    await userEvent.keyboard("Renamed{Enter}");

    expect(update).toHaveBeenCalledWith(gadgets[0], { name: "Renamed" });
  });

  it("shows a refused value's problem in the row it was typed in alone, and keeps that row's cell after Esc", async () => {
    renderGadgets({
      gadgets,
      table: {
        ...byLetters,
        recordProblem: (values) =>
          values.name === "Bad" ? { message: "Not this name" } : undefined,
      },
    });
    const second = nameCells()[2];
    act(() => {
      second?.focus();
    });

    await userEvent.keyboard("Bad{Enter}");
    expect(screen.getAllByText("Not this name")).toHaveLength(1);
    expect(second?.closest("tr")?.textContent).toContain("Not this name");
    await userEvent.keyboard("{Escape}");

    expect(document.activeElement).toBe(nameCells()[2]);
  });

  it("keeps a record shown since the view was set under its headings while its grouped value changes", () => {
    const grid = (shown: Gadget[]) => (
      <MantineProvider theme={testTheme}>
        <RecordGrid
          records={shown}
          table={byLetters}
          fields={[]}
          order={[]}
          lists={[]}
          canEdit
          canEditColumns={false}
          view={view}
          onView={noop}
          actions={actions()}
        />
      </MantineProvider>
    );
    const { rerender } = render(grid(gadgets));
    rerender(grid([...gadgets, gadget("d", { code: "X" })]));
    rerender(grid([...gadgets, gadget("d", { code: "Y" })]));

    expect(
      recordCell("d", "name")?.closest("tr")?.previousSibling?.textContent,
    ).toBe("Group X1 gadget");
  });

  it("marks a record's draft, with its Live row, under each of its groups", () => {
    renderGadgets({
      gadgets: [
        gadget("a", {
          code: "XY",
          name: "Renamed",
          draft: {
            ...waiting,
            action: "changed",
            changed: ["name"],
            live: { name: "Gadget a", values: {}, links: {} },
          },
        }),
      ],
      table: byLetters,
      view,
    });

    expect(screen.getAllByText("Gadget a")).toHaveLength(2);
    expect(
      nameCells().map(({ textContent }) =>
        textContent.includes("Draft: changed from “Gadget a”"),
      ),
    ).toEqual([true, true]);
  });

  it("puts focus on a record's cell in the row of the active cell, or else its first", async () => {
    renderGadgets({ gadgets, table: byLetters, view });
    const [first, , second, last] = nameCells();

    focusRecordCell("a", "name");
    await waitFor(() => {
      expect(document.activeElement).toBe(first);
    });
    act(() => {
      last?.focus();
    });
    await userEvent.keyboard("{ArrowUp}");
    act(() => {
      (document.activeElement as HTMLElement).blur();
    });
    focusRecordCell("a", "name");
    await waitFor(() => {
      expect(document.activeElement).toBe(second);
    });
  });
});

describe("rows grouped again under each heading", () => {
  const letterGroup = (prefix: string) => (letter: string) => ({
    key: letter,
    label: `${prefix} ${letter}`,
    rank: letter.charCodeAt(0),
  });
  const nested = (
    more: Partial<RecordTable<Gadget, GadgetChange, GadgetChange>> = {},
  ): RecordTable<Gadget, GadgetChange, GadgetChange> => ({
    ...gadgetTable(),
    groupings: [
      {
        key: "first",
        label: "First letter",
        holds: "list",
        of: ({ code }) => [letterGroup("Starts")(code.charAt(0))],
      },
      {
        key: "letters",
        label: "Letters",
        holds: "list",
        of: ({ code }) => {
          const [first, ...rest] = Array.from(code, letterGroup("Group"));
          // Every gadget here has a code.
          return [first as RowGroup, ...rest];
        },
      },
    ],
    ...more,
  });
  const gadgets = [
    gadget("a", { code: "XY" }),
    gadget("b", { code: "X" }),
    gadget("c", { code: "YZ" }),
  ];
  const view = { ...emptyView, grouping: "first", thenBy: "letters" };
  const headings = () =>
    screen.getAllByRole("rowheader").map(({ textContent }) => textContent);

  it("heads each group's rows with their second groups, leaving out those empty, each counting its own records", () => {
    renderGadgets({ gadgets, table: nested(), view });

    expect(headings()).toEqual([
      "Starts X2 gadgets",
      "Group X2 gadgets",
      "Group Y1 gadget",
      "Starts Y1 gadget",
      "Group Y1 gadget",
      "Group Z1 gadget",
    ]);
    expect(screen.getByRole("status").textContent).toBe("3 gadgets");
  });

  it("marks a record under several second groups, naming the others", async () => {
    renderGadgets({ gadgets, table: nested(), view });

    const tips = [];
    for (const mark of screen.getAllByText("+1")) tips.push(await tipOn(mark));
    expect(tips).toEqual([
      "Also under Group Y",
      "Also under Group X",
      "Also under Group Z",
      "Also under Group Y",
    ]);
  });

  it("names another place differing in both groups by both, the first, a colon, then the second", async () => {
    renderGadgets({
      gadgets: [gadget("a", { code: "XY" })],
      table: nested({
        groupings: [
          ...(nested().groupings ?? []),
          {
            key: "again",
            label: "Again",
            holds: "list",
            of: ({ code }) => {
              const [first, ...rest] = Array.from(code, letterGroup("Again"));
              // Every gadget here has a code.
              return [first as RowGroup, ...rest];
            },
          },
        ],
      }),
      view: { ...emptyView, grouping: "letters", thenBy: "again" },
    });

    expect(await tipOn(screen.getAllByText("+3")[0] as HTMLElement)).toBe(
      "Also under Again Y, Group Y, Group Y: Again Y",
    );
  });

  it("names both groupings on one button, offering the other groupings under the first, starting with none", async () => {
    const onView = vi.fn();
    renderGadgets({
      gadgets,
      table: nested(),
      view: { ...emptyView, grouping: "first" },
      onView,
    });

    await userEvent.click(
      screen.getByRole("button", { name: "Group by: First letter" }),
    );

    expect(
      (await choicesUnder("Group by"))
        .getAllByRole("menuitem")
        .map(({ textContent }) => textContent),
    ).toEqual(["None", "First letter, chosen", "Letters"]);
    const thenBy = await choicesUnder("Then by");
    expect(
      thenBy.getAllByRole("menuitem").map(({ textContent }) => textContent),
    ).toEqual(["None, chosen", "Letters"]);
    await userEvent.click(thenBy.getByRole("menuitem", { name: "Letters" }));
    expect(onView).toHaveBeenLastCalledWith(view);
  });

  it("takes the second grouping away when none is chosen for it", async () => {
    const onView = vi.fn();
    renderGadgets({ gadgets, table: nested(), view, onView });

    await userEvent.click(
      screen.getByRole("button", {
        name: "Group by: First letter, then Letters",
      }),
    );
    await userEvent.click(await choiceUnder("Then by", "None"));

    expect(onView).toHaveBeenLastCalledWith({ ...view, thenBy: undefined });
  });

  it("takes the second grouping away with the first, or when it becomes the first", async () => {
    const onView = vi.fn();
    renderGadgets({ gadgets, table: nested(), view, onView });

    await userEvent.click(
      screen.getByRole("button", {
        name: "Group by: First letter, then Letters",
      }),
    );
    await userEvent.click(await choiceUnder("Group by", "Letters"));

    expect(onView).toHaveBeenLastCalledWith({
      ...emptyView,
      grouping: "letters",
      thenBy: undefined,
    });
  });

  it("keeps the second grouping when another first is chosen", async () => {
    const onView = vi.fn();
    renderGadgets({
      gadgets,
      table: nested({
        groupings: [
          ...(nested().groupings ?? []),
          {
            key: "code",
            label: "Code",
            holds: "list",
            of: ({ code }) => [letterGroup("Code")(code)],
          },
        ],
      }),
      view,
      onView,
    });

    await userEvent.click(
      screen.getByRole("button", {
        name: "Group by: First letter, then Letters",
      }),
    );
    await userEvent.click(await choiceUnder("Group by", "Code"));

    expect(onView).toHaveBeenLastCalledWith({
      ...emptyView,
      grouping: "code",
      thenBy: "letters",
    });
  });

  it("clears both groupings back to none, offered only once one is chosen", async () => {
    const onView = vi.fn();
    const { unmount } = renderGadgets({
      gadgets,
      table: nested(),
      view: { ...emptyView, grouping: "letters", thenBy: "first" },
      onView,
    });

    await userEvent.click(
      screen.getByRole("button", {
        name: "Group by: Letters, then First letter",
      }),
    );
    await userEvent.click(
      await screen.findByRole("menuitem", { name: "Clear grouping" }),
    );
    expect(onView).toHaveBeenLastCalledWith({
      ...emptyView,
      grouping: undefined,
      thenBy: undefined,
    });
    unmount();

    renderGadgets({ gadgets, table: nested() });
    await userEvent.click(screen.getByRole("button", { name: "Group by" }));
    await screen.findAllByRole("menuitem");
    expect(
      screen.queryByRole("menuitem", { name: "Clear grouping" }),
    ).toBeNull();
  });

  it("offers no second grouping while the rows show as one list", async () => {
    renderGadgets({
      gadgets,
      table: nested(),
      view: { ...emptyView, thenBy: "letters" },
    });

    await userEvent.click(screen.getByRole("button", { name: "Group by" }));

    expect(
      (await screen.findAllByRole("menuitem")).map(
        ({ textContent }) => textContent,
      ),
    ).toEqual(["None, chosen", "First letter", "Letters"]);
    expect(screen.queryByRole("group", { name: "Then by" })).toBeNull();
  });

  it("offers no second grouping, and groups one level deep, on a table whose records are made for its grouping", async () => {
    renderGadgets({ gadgets, table: nested({ oneLevel: true }), view });

    await userEvent.click(
      screen.getByRole("button", { name: "Group by: First letter" }),
    );

    expect(
      (await screen.findAllByRole("menuitem")).map(
        ({ textContent }) => textContent,
      ),
    ).toEqual([
      "None",
      "First letter, chosen",
      "Letters",
      "List order, chosen",
      "Reverse list order",
      "Clear grouping",
    ]);
    expect(screen.queryByRole("group", { name: "Then by" })).toBeNull();
    expect(headings()).toEqual(["Starts X2 gadgets", "Starts Y1 gadget"]);
  });
});
