// SPDX-License-Identifier: Apache-2.0

// Tests for the Metrics panel beside the People table: opening and closing it, breaking people down
// by a column and by two crossed, following the table's filters, and offering only the columns the
// table has.

import type { Field, List } from "@fathom/shared";
import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import { userEvent } from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { formatMonth } from "./day-formats.ts";
import { share } from "./metrics.ts";
import { panelWidth, panelWidths } from "./side-panel.tsx";
import { emptyView, type View } from "./table-view.ts";
import { chooseIn, optionsIn } from "./test-support.tsx";
import {
  choice,
  everyone,
  figures,
  hours,
  level,
  lists,
  panel,
  person,
  role,
  Table,
} from "./test-metrics-panel.tsx";

afterEach(() => {
  vi.restoreAllMocks();
});

describe("the Metrics panel", () => {
  it("opens from the bar above the table and closes with Esc, once its choices are closed, giving focus back", async () => {
    const user = userEvent.setup();
    render(<Table />);
    const button = screen.getByRole("button", { name: "Metrics" });
    expect(button.getAttribute("aria-expanded")).toBe("false");
    await user.click(button);
    expect(panel().textContent).toContain("4 people");
    expect(button.getAttribute("aria-expanded")).toBe("true");
    await user.click(within(panel()).getByLabelText("Break down by"));
    await user.keyboard("{Escape}");
    expect(screen.queryByRole("region", { name: "Metrics" })).not.toBeNull();
    await user.keyboard("{Escape}");
    expect(screen.queryByRole("region", { name: "Metrics" })).toBeNull();
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(document.activeElement).toBe(button);
  });

  it("closes with Esc pressed straight after opening, though the panel is drawn a little later", async () => {
    const user = userEvent.setup();
    render(<Table drawnLater />);
    const button = screen.getByRole("button", { name: "Metrics" });

    await user.click(button);
    await screen.findByRole("region", { name: "Metrics" });
    await waitFor(() => {
      expect(panel().contains(document.activeElement)).toBe(true);
    });
    await user.keyboard("{Escape}");

    await waitFor(() => {
      expect(screen.queryByRole("region", { name: "Metrics" })).toBeNull();
    });
  });

  it("counts a checkbox column's ticked boxes as Yes and the rest as No, as Manager? does", () => {
    const firstAider: Field = {
      ...level,
      id: "f3",
      name: "First aider",
      type: "flag",
      listId: null,
      visibility: "general",
    };
    render(
      <Table
        people={everyone.map((one, index) =>
          index === 0 ? { ...one, flags: { f3: true } } : one,
        )}
        fields={[firstAider]}
        start={{ ...emptyView, breakdown: ["f3"] }}
      />,
    );
    expect(figures("Yes")).toEqual(["1", share(1, 4)]);
    expect(figures("No")).toEqual(["3", share(3, 4)]);
  });

  it("counts a text column as Populated and Empty, as a number column", () => {
    const desk: Field = {
      ...level,
      id: "f4",
      name: "Desk",
      type: "text",
      listId: null,
      visibility: "general",
    };
    render(
      <Table
        people={everyone.map((one, index) =>
          index === 0 ? { ...one, texts: { f4: "North 4-12" } } : one,
        )}
        fields={[desk]}
        start={{ ...emptyView, breakdown: ["f4"] }}
      />,
    );
    expect(figures("Populated")).toEqual(["1", share(1, 4)]);
    expect(figures("Empty")).toEqual(["3", share(3, 4)]);
  });

  it("breaks a date column down by month, earliest first, then No date", () => {
    const lastReview: Field = {
      ...level,
      id: "f5",
      name: "Last review",
      type: "date",
      listId: null,
      visibility: "general",
    };
    const reviewed = ["2026-03-14", "2025-11-02", "2026-03-01"];
    render(
      <Table
        people={everyone.map((one, index) => {
          const day = reviewed.at(index);
          return day === undefined ? one : { ...one, days: { f5: day } };
        })}
        fields={[lastReview]}
        start={{ ...emptyView, breakdown: ["f5"] }}
      />,
    );
    expect(
      within(panel())
        .getAllByRole("rowheader")
        .map((header) => header.textContent)
        .slice(0, 3),
    ).toEqual([formatMonth("2025-11"), formatMonth("2026-03"), "No date"]);
    expect(figures(formatMonth("2026-03"))).toEqual(["2", share(2, 4)]);
    expect(figures("No date")).toEqual(["1", share(1, 4)]);
  });

  it("offers a required date column, whose months still break people down", async () => {
    const nextReview: Field = {
      ...level,
      id: "f6",
      name: "Next review",
      type: "date",
      listId: null,
      visibility: "general",
      required: true,
    };
    render(
      <Table fields={[nextReview]} start={{ ...emptyView, breakdown: [] }} />,
    );
    expect(await optionsIn(panel(), "Break down by")).toContain("Next review");
  });

  it("breaks people down by a column, each choice with its count and share, and empty values", async () => {
    render(<Table start={{ ...emptyView, breakdown: [] }} />);
    await chooseIn(panel(), "Break down by", "Level");
    expect(figures("P4")).toEqual(["2", share(2, 4)]);
    expect(figures("P3")).toEqual(["1", share(1, 4)]);
    expect(figures("Empty")).toEqual(["1", share(1, 4)]);
  });

  describe("adding a number column up", () => {
    const counted = [
      { ...person("a", ["p4"], ["test"]), numbers: { f3: 10 } },
      { ...person("b", ["p4"], ["dev"]), numbers: { f3: 6 } },
      person("c", ["p3"], ["test"]),
      { ...person("d", [], ["test"]), numbers: { f3: 2 } },
    ];
    const summing = (start: View) => (
      <Table people={counted} fields={[level, role, hours]} start={start} />
    );

    it("offers Measure only once Break down by has a column", async () => {
      render(summing({ ...emptyView, breakdown: [] }));
      expect(within(panel()).queryByLabelText("Measure")).toBeNull();

      await chooseIn(panel(), "Break down by", "Level");

      expect(within(panel()).getByLabelText("Measure")).toBeTruthy();
    });

    it("offers the number columns, and adds nothing up at first where the table names none", () => {
      render(summing({ ...emptyView, breakdown: ["f1"] }));
      expect(
        within(panel()).getByLabelText<HTMLInputElement>("Measure").value,
      ).toBe("Nothing");
      expect(figures("P4")).toEqual(["2", share(2, 4)]);
    });

    it("gives each group its total, the average of those with an amount, and how many have none, then the whole", async () => {
      render(summing({ ...emptyView, breakdown: ["f1"] }));
      await chooseIn(panel(), "Measure", "Hours");
      expect(
        within(panel()).getByRole("columnheader", { name: "Hours" }),
      ).toBeTruthy();
      expect(figures("P4")).toEqual(["2", share(2, 4), "16", "8", ""]);
      expect(figures("P3")).toEqual(["1", share(1, 4), "", "", "1"]);
      expect(figures("Empty")).toEqual(["1", share(1, 4), "2", "2", ""]);
      const all = within(panel()).getByRole("rowheader", { name: "All" });
      expect(
        within(all.closest("tr") as HTMLElement)
          .getAllByRole("cell")
          .map((cell) => cell.textContent),
      ).toEqual(["4", share(4, 4), "18", "6", "1"]);
    });

    it("shows the totals in the crossed table, as counts or shares do", async () => {
      const user = userEvent.setup();
      render(summing({ ...emptyView, breakdown: ["f1", "f2"], sum: "f3" }));
      await user.click(within(panel()).getByRole("radio", { name: "Hours" }));
      expect(figures("P4")).toEqual(["10", "6", "16"]);
      expect(figures("P3")).toEqual(["", "", ""]);
    });

    it("gives each total as drafted, with the live total under it where it differs", () => {
      const drafted = {
        ...person("e", ["p4"], ["test"], {
          state: "waiting",
          madeBy: null,
          madeAt: null,
          action: "changed",
          changed: ["f3"],
          live: { values: {}, links: {}, numbers: { f3: 1 } },
        }),
        numbers: { f3: 5 },
      };
      render(
        <Table
          people={[...counted, drafted]}
          fields={[level, role, hours]}
          start={{ ...emptyView, breakdown: ["f1"], sum: "f3" }}
        />,
      );
      expect(figures("P4")[2]).toBe("2117, live");
    });

    it("goes back to counts in the crossed table once Nothing is added up", async () => {
      const user = userEvent.setup();
      render(summing({ ...emptyView, breakdown: ["f1", "f2"], sum: "f3" }));
      await user.click(within(panel()).getByRole("radio", { name: "Hours" }));
      await chooseIn(panel(), "Measure", "Nothing");
      expect(
        within(panel()).queryByRole("radio", { name: "Hours" }),
      ).toBeNull();
      expect(figures("P4")).toEqual(["1", "1", "2"]);
    });

    it("keeps adding up when Clear all clears the search", async () => {
      const user = userEvent.setup();
      render(
        summing({
          ...emptyView,
          search: "Fictional",
          breakdown: ["f1"],
          sum: "f3",
        }),
      );
      await user.click(screen.getByRole("button", { name: "Clear all" }));
      expect(
        within(panel()).getByLabelText<HTMLInputElement>("Measure").value,
      ).toBe("Hours");
    });

    it("adds nothing up once Nothing is chosen", async () => {
      render(summing({ ...emptyView, breakdown: ["f1"], sum: "f3" }));
      await chooseIn(panel(), "Measure", "Nothing");
      expect(
        within(panel()).queryByRole("columnheader", { name: "Hours" }),
      ).toBeNull();
    });

    it("says a row counts in each of a column's several choices, with totals too", () => {
      render(
        <Table
          people={counted}
          fields={[level, { ...role, multiple: true }, hours]}
          start={{ ...emptyView, breakdown: ["f2"], sum: "f3" }}
        />,
      );
      expect(
        within(panel()).getByText(
          "A person in several role choices counts in each.",
        ),
      ).toBeTruthy();
    });
  });

  it.each([
    ["Projects", "A person in several projects counts in each."],
    ["KPIs", "A person in several KPIs counts in each."],
    [
      "Fictional Scores",
      "A person in several Fictional Scores counts in each.",
    ],
    ["Status", "A person in several status choices counts in each."],
    ["Class", "A person in several class choices counts in each."],
  ])(
    "names a column %s with several choices in the note under the figures",
    (label, note) => {
      render(
        <Table
          people={[person("a", ["p4"], ["test", "dev"])]}
          fields={[level, { ...role, name: label, multiple: true }]}
          start={{ ...emptyView, breakdown: ["f2"] }}
        />,
      );
      expect(within(panel()).getByText(note)).toBeTruthy();
    },
  );

  it("opens a column's list on Enter, and picks from it with the arrow keys and Enter", async () => {
    const user = userEvent.setup();
    render(<Table start={{ ...emptyView, breakdown: [] }} />);
    act(() => {
      within(panel()).getByLabelText("Break down by").focus();
    });

    await user.keyboard("{Enter}");
    await screen.findByRole("option", { name: "Level" });
    await user.keyboard("{ArrowUp}{Enter}");

    expect(
      within(panel()).getByLabelText<HTMLInputElement>("Break down by").value,
    ).toBe("Expected");
  });

  it("crosses two columns, with totals, as counts or shares", async () => {
    const user = userEvent.setup();
    render(<Table start={{ ...emptyView, breakdown: ["f1", "f2"] }} />);
    expect(
      within(panel()).getByRole("columnheader", { name: "Level by Role" }),
    ).toBeTruthy();
    expect(figures("P4")).toEqual(["1", "1", "2"]);
    expect(figures("All")).toEqual(["3", "1", "4"]);
    await user.click(within(panel()).getByRole("radio", { name: "Share" }));
    expect(figures("P4")).toEqual([share(1, 4), share(1, 4), share(2, 4)]);
    await chooseIn(panel(), "and by", "Nothing more");
    expect(figures("P4")).toEqual(["2", share(2, 4)]);
  });

  it("counts only the people the table's filters show", () => {
    render(
      <Table
        start={{
          ...emptyView,
          filters: { f2: { any: ["test"] } },
          breakdown: ["f1"],
        }}
      />,
    );
    expect(panel().textContent).toContain("3 people");
    expect(figures("P4")).toEqual(["1", share(1, 3)]);
  });

  it("offers only the columns the table has, and drops one it does not", async () => {
    render(
      <Table fields={[level]} start={{ ...emptyView, breakdown: ["f2"] }} />,
    );
    const picker =
      within(panel()).getByLabelText<HTMLInputElement>("Break down by");
    expect(picker.value).toBe("Choose a column");
    expect(await optionsIn(panel(), "Break down by")).toEqual([
      "Choose a column",
      "Position",
      "Manager",
      "Manager?",
      "Team",
      "Level",
      "Expected",
    ]);
    expect(panel().textContent).not.toContain("Choose a column to count");
  });

  it("drops a column the metrics do not offer, such as names, from the breakdown", () => {
    render(
      <Table start={{ ...emptyView, breakdown: ["preferredName", "f1"] }} />,
    );
    expect(
      within(panel()).getByLabelText<HTMLInputElement>("Break down by").value,
    ).toBe("Level");
    expect(figures("P4")).toEqual(["2", share(2, 4)]);
  });

  it("is broken down by a column from its menu", async () => {
    const user = userEvent.setup();
    render(<Table />);
    await user.click(screen.getByRole("button", { name: "Level column" }));
    await user.click(await screen.findByRole("menuitem", { name: "Metrics" }));
    expect(figures("P4")).toEqual(["2", share(2, 4)]);
  });

  it("takes focus when broken down from a column's menu, though drawn a little later", async () => {
    const user = userEvent.setup();
    render(<Table drawnLater />);
    await user.click(screen.getByRole("button", { name: "Level column" }));

    await user.click(await screen.findByRole("menuitem", { name: "Metrics" }));

    await waitFor(() => {
      expect(panel().contains(document.activeElement)).toBe(true);
    });
  });

  it("says when one person is counted, and that someone may hold several choices", async () => {
    const user = userEvent.setup();
    const several = { ...role, multiple: true };
    render(
      <Table
        people={[person("a", ["p4"], ["test", "dev"])]}
        fields={[level, several]}
        start={{ ...emptyView, breakdown: ["f2"] }}
      />,
    );
    expect(panel().textContent).toContain("1 person");
    expect(panel().textContent).toContain(
      "A person in several role choices counts in each.",
    );
    expect(figures("Test engineer")).toEqual(["1", share(1, 1)]);
    await chooseIn(panel(), "and by", "Level");
    expect(panel().textContent).toContain(
      "A person in several role choices counts in each.",
    );
    await chooseIn(panel(), "Break down by", "Level");
    expect(
      within(panel()).getByLabelText<HTMLInputElement>("and by").value,
    ).toBe("Nothing more");
    await chooseIn(panel(), "and by", "Role");
    expect(panel().textContent).toContain(
      "A person in several role choices counts in each.",
    );
    await chooseIn(panel(), "Break down by", "Choose a column");
    expect(panel().textContent).not.toContain("Choose a column to count");
    await user.keyboard("{Tab}");
    expect(panel()).toBeTruthy();
  });

  it("covers the screen below the top bar on a narrow screen", () => {
    const matchMedia = vi.spyOn(window, "matchMedia").mockImplementation(
      (query) =>
        ({
          matches: true,
          media: query,
          onchange: null,
          addEventListener: () => undefined,
          removeEventListener: () => undefined,
          dispatchEvent: () => false,
        }) as unknown as MediaQueryList,
    );
    try {
      render(<Table start={{ ...emptyView, breakdown: [] }} />);
      const dialog = screen.getByRole("dialog", { name: "Metrics" });
      expect(dialog.getAttribute("aria-modal")).toBe("true");
      expect(dialog.className).toMatch(/frameNarrow/);
      expect(screen.queryByRole("separator")).toBeNull();
    } finally {
      matchMedia.mockRestore();
    }
  });
  it("closes from its close button and from the Metrics button, and puts focus on its title when opened", async () => {
    const user = userEvent.setup();
    render(<Table />);
    const button = screen.getByRole("button", { name: "Metrics" });
    await user.click(button);
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(document.activeElement?.textContent).toBe("Metrics");
    expect(button.getAttribute("aria-expanded")).toBe("true");
    expect(button.getAttribute("aria-controls")).toBe(panel().id);
    await user.click(
      within(panel()).getByRole("button", { name: "Close metrics" }),
    );
    expect(screen.queryByRole("region", { name: "Metrics" })).toBeNull();
    await user.click(button);
    await user.click(button);
    expect(screen.queryByRole("region", { name: "Metrics" })).toBeNull();
  });

  it("stays open when Clear all clears the search, and counts what the search shows", async () => {
    const user = userEvent.setup();
    render(<Table start={{ ...emptyView, search: "b", breakdown: ["f1"] }} />);
    expect(panel().textContent).toContain("1 person");
    await user.click(screen.getByRole("button", { name: "Clear all" }));
    expect(panel().textContent).toContain("4 people");
  });

  it("shows a retired choice only while someone holds it, and dates as Populated and Empty", () => {
    const [levels, roles] = lists as [List, List];
    const retired: List = {
      ...levels,
      choices: [...levels.choices, { ...choice("p1", "P1"), retired: true }],
    };
    const { unmount } = render(
      <Table
        listsShown={[retired, roles]}
        people={[...everyone, person("e", ["p1"], [])]}
        start={{ ...emptyView, breakdown: ["f1"] }}
      />,
    );
    expect(figures("P1")).toEqual(["1", share(1, 5)]);
    unmount();
    const dated = render(
      <Table
        listsShown={[retired, roles]}
        start={{ ...emptyView, breakdown: ["f1"] }}
      />,
    );
    expect(within(panel()).queryByRole("rowheader", { name: "P1" })).toBeNull();
    dated.unmount();
    render(
      <Table
        showDates
        people={[
          { ...person("a", [], []), startDate: "2024-01-01" },
          person("b", [], []),
        ]}
        start={{ ...emptyView, breakdown: ["startDate"] }}
      />,
    );
    expect(figures("Populated")).toEqual(["1", share(1, 2)]);
    expect(figures("Empty")).toEqual(["1", share(1, 2)]);
  });

  it("is resized by its edge, from the keyboard or by dragging, never past the table's least width", async () => {
    const user = userEvent.setup();
    localStorage.clear();
    vi.spyOn(Element.prototype, "getBoundingClientRect").mockReturnValue({
      width: 1200,
      right: 1200,
    } as DOMRect);
    render(<Table start={{ ...emptyView, breakdown: [] }} />);
    const edge = screen.getByRole("separator", { name: "Resize metrics" });
    expect(edge.getAttribute("aria-valuenow")).toBe(String(panelWidths.start));
    const layout = edge.closest("div[style]") as HTMLElement;
    await user.click(within(panel()).getByRole("heading", { name: "Metrics" }));
    await user.tab({ shift: true });
    expect(document.activeElement).toBe(edge);
    await user.keyboard("{ArrowLeft}");
    expect(edge.getAttribute("aria-valuenow")).toBe(
      String(panelWidths.start + panelWidths.step),
    );
    await user.keyboard("{ArrowRight}{ArrowRight}{Enter}");
    expect(edge.getAttribute("aria-valuenow")).toBe(
      String(panelWidths.start - panelWidths.step),
    );
    expect(layout.style.getPropertyValue("--side-panel-column")).toBe(
      `${String(panelWidths.start - panelWidths.step)}px`,
    );
    edge.setPointerCapture = vi.fn();
    let captured = false;
    edge.hasPointerCapture = () => captured;
    fireEvent.pointerMove(edge, { clientX: 500 });
    expect(edge.getAttribute("aria-valuenow")).toBe(
      String(panelWidths.start - panelWidths.step),
    );
    fireEvent.pointerDown(edge, { pointerId: 1 });
    captured = true;
    fireEvent.pointerMove(edge, { clientX: 500 });
    expect(edge.getAttribute("aria-valuenow")).toBe("700");
    fireEvent.pointerMove(edge, { clientX: 100 });
    expect(edge.getAttribute("aria-valuenow")).toBe(
      String(1200 - panelWidths.least),
    );
  });
});

describe("the panel's width", () => {
  it("stays between its least and what leaves the table its least", () => {
    expect(panelWidth(100, 1000)).toBe(panelWidths.least);
    expect(panelWidth(900, 1000)).toBe(1000 - panelWidths.least);
    expect(panelWidth(500.4, 1000)).toBe(500);
    expect(panelWidth(500, 0)).toBe(panelWidths.least);
  });
});
