// SPDX-License-Identifier: Apache-2.0

// Tests for the Metrics panel beside the People table: opening and closing it, breaking people down
// by a column and by two crossed, following the table's filters, counting drafts as the Draft menu
// shows them, and offering only the columns the table has.

import type { Field, List, Person, PersonDraft } from "@fathom/shared";
import { MantineProvider } from "@mantine/core";
import { fireEvent, render, screen, within } from "@testing-library/react";
import { userEvent } from "@testing-library/user-event";
import { useState } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { share } from "./metrics.ts";
import { panelWidth, panelWidths } from "./side-panel.tsx";
import { PeopleGrid } from "./people-grid.tsx";
import { emptyView, type View } from "./table-view.ts";

const level: Field = {
  id: "f1",
  name: "Level",
  type: "choice" as const,
  listId: "l1",
  visibility: null,
  multiple: false,
  required: false,
};
const role: Field = {
  id: "f2",
  name: "Role",
  type: "choice" as const,
  listId: "l2",
  visibility: null,
  multiple: false,
  required: false,
};
const choice = (id: string, label: string) => ({
  id,
  label,
  description: "",
  retired: false,
});
const lists: List[] = [
  {
    id: "l1",
    name: "Levels",
    description: "",
    visibility: "general",
    retired: false,
    choices: [choice("p3", "P3"), choice("p4", "P4")],
  },
  {
    id: "l2",
    name: "Roles",
    description: "",
    visibility: "general",
    retired: false,
    choices: [choice("test", "Test engineer"), choice("dev", "Developer")],
  },
];

const person = (
  id: string,
  levels: string[],
  roles: string[],
  draft?: PersonDraft,
): Person => ({
  id,
  preferredName: `Fictional ${id}`,
  employeeId: id,
  positionId: "position-1",
  values: { f1: levels, f2: roles },
  links: {},
  ...(draft ? { draft } : {}),
});

const everyone = [
  person("a", ["p4"], ["test"]),
  person("b", ["p4"], ["dev"]),
  person("c", ["p3"], ["test"]),
  person("d", [], ["test"]),
];

const noop = () => undefined;
const actions = {
  add: noop,
  update: noop,
  remove: noop,
  discard: noop,
  resubmit: noop,
  decide: noop,
  moveColumn: noop,
  editColumn: noop,
  discardColumn: noop,
  resubmitColumn: noop,
};

function Table({
  people = everyone,
  fields = [level, role],
  start = emptyView,
  showDates = false,
  listsShown = lists,
}: {
  people?: Person[];
  fields?: Field[];
  start?: View;
  showDates?: boolean;
  listsShown?: List[];
}) {
  const [view, setView] = useState(start);
  return (
    <MantineProvider>
      <PeopleGrid
        people={people}
        fields={fields}
        order={[]}
        lists={listsShown}
        canEdit={false}
        canEditColumns={false}
        showDates={showDates}
        view={view}
        onView={setView}
        actions={actions}
      />
    </MantineProvider>
  );
}

const panel = () => screen.getByRole("region", { name: "Metrics" });
// The figures of a row of the panel's table, by the name of its group.
const figures = (group: string) =>
  within(
    within(panel())
      .getByRole("rowheader", { name: group })
      .closest("tr") as HTMLElement,
  )
    .getAllByRole("cell")
    .map((cell) => cell.textContent);

afterEach(() => {
  vi.restoreAllMocks();
});

describe("the Metrics panel", () => {
  it("opens from the bar above the table and closes with Esc, giving focus back", async () => {
    const user = userEvent.setup();
    render(<Table />);
    const button = screen.getByRole("button", { name: "Metrics" });
    expect(button.getAttribute("aria-expanded")).toBe("false");
    await user.click(button);
    expect(panel().textContent).toContain("4 people");
    expect(button.getAttribute("aria-expanded")).toBe("true");
    await user.click(
      within(panel()).getByRole("combobox", { name: "Break down by" }),
    );
    await user.keyboard("{Escape}");
    expect(screen.queryByRole("region", { name: "Metrics" })).toBeNull();
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(document.activeElement).toBe(button);
  });

  it("breaks people down by a column, each choice with its count and share, and empty values", async () => {
    const user = userEvent.setup();
    render(<Table start={{ ...emptyView, breakdown: [] }} />);
    await user.selectOptions(
      within(panel()).getByRole("combobox", { name: "Break down by" }),
      "Level",
    );
    expect(figures("P4")).toEqual(["2", share(2, 4)]);
    expect(figures("P3")).toEqual(["1", share(1, 4)]);
    expect(figures("Empty")).toEqual(["1", share(1, 4)]);
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
    await user.selectOptions(
      within(panel()).getByRole("combobox", { name: "and by" }),
      "Nothing more",
    );
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

  it("counts people as drafted, with the live figure beside where it differs, unless drafts are applied or live only", () => {
    const draft = {
      state: "waiting" as const,
      madeBy: null,
      madeAt: null,
    };
    const people = [
      ...everyone,
      person("e", ["p4"], ["dev"], {
        ...draft,
        action: "created",
        changed: [],
        live: { values: {}, links: {} },
      }),
      person("c2", ["p4"], ["test"], {
        ...draft,
        action: "changed",
        changed: ["f1"],
        live: { values: { f1: ["p3"] }, links: {} },
      }),
      person("f", ["p3"], ["dev"], {
        ...draft,
        action: "deleted",
        changed: [],
        live: { values: {}, links: {} },
      }),
    ];
    const { unmount } = render(
      <Table people={people} start={{ ...emptyView, breakdown: ["f1"] }} />,
    );
    expect(panel().textContent).toContain("6 people with drafts");
    expect(figures("P4")).toEqual([
      `4Live 2`,
      `${share(4, 6)}Live ${share(2, 6)}`,
    ]);
    expect(figures("P3")).toEqual([
      "1Live 3",
      `${share(1, 6)}Live ${share(3, 6)}`,
    ]);
    unmount();

    const live = render(
      <Table
        people={people}
        start={{ ...emptyView, show: "live", breakdown: ["f1"] }}
      />,
    );
    expect(panel().textContent).toContain("6 people");
    expect(figures("P4")).toEqual(["2", share(2, 6)]);
    live.unmount();

    render(
      <Table
        people={people}
        start={{ ...emptyView, show: "drafts", breakdown: ["f1"] }}
      />,
    );
    expect(figures("P4")).toEqual(["4", share(4, 6)]);
  });

  it("offers only the columns the table has, and drops one it does not", () => {
    render(
      <Table fields={[level]} start={{ ...emptyView, breakdown: ["f2"] }} />,
    );
    const picker = within(panel()).getByRole("combobox", {
      name: "Break down by",
    });
    expect(
      within(picker)
        .getAllByRole("option")
        .map((option) => option.textContent),
    ).toEqual([
      "Choose a column",
      "Position",
      "Manager",
      "Manager?",
      "Team",
      "Level",
      "Expected",
    ]);
    expect((picker as HTMLSelectElement).value).toBe("");
    expect(panel().textContent).toContain("Choose a column to count people");
  });

  it("drops a column the metrics do not offer, such as names, from the breakdown", () => {
    render(
      <Table start={{ ...emptyView, breakdown: ["preferredName", "f1"] }} />,
    );
    expect(
      within(panel()).getByRole<HTMLSelectElement>("combobox", {
        name: "Break down by",
      }).value,
    ).toBe("f1");
    expect(figures("P4")).toEqual(["2", share(2, 4)]);
  });

  it("is broken down by a column from its menu", async () => {
    const user = userEvent.setup();
    render(<Table />);
    await user.click(screen.getByRole("button", { name: "Level column" }));
    await user.click(
      await screen.findByRole("menuitem", { name: "Break down by" }),
    );
    expect(figures("P4")).toEqual(["2", share(2, 4)]);
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
      "A person may hold several choices of Role, so shares can add up to more than 100%.",
    );
    expect(figures("Test engineer")).toEqual(["1", share(1, 1)]);
    await user.selectOptions(
      within(panel()).getByRole("combobox", { name: "and by" }),
      "Level",
    );
    expect(panel().textContent).toContain(
      "A person may hold several choices of Role, so figures can add up to more than their total.",
    );
    await user.selectOptions(
      within(panel()).getByRole("combobox", { name: "Break down by" }),
      "Level",
    );
    expect(
      within(panel()).queryByRole("combobox", { name: "and by" }),
    ).toBeTruthy();
    expect(
      within(panel()).getByRole<HTMLSelectElement>("combobox", {
        name: "and by",
      }).value,
    ).toBe("");
    await user.selectOptions(
      within(panel()).getByRole("combobox", { name: "and by" }),
      "Role",
    );
    expect(panel().textContent).toContain(
      "A person may hold several choices of Role, so figures can add up to more than their total.",
    );
    await user.selectOptions(
      within(panel()).getByRole("combobox", { name: "Break down by" }),
      "Choose a column",
    );
    expect(panel().textContent).toContain("Choose a column to count people");
    await user.keyboard("{Tab}");
    expect(panel()).toBeTruthy();
  });

  it("says how many are counted live when drafts add someone, and leaves out empty values nobody has", () => {
    const people = [
      ...everyone,
      person("e", ["p4"], ["dev"], {
        state: "waiting",
        madeBy: null,
        madeAt: null,
        action: "created",
        changed: [],
        live: { values: {}, links: {} },
      }),
    ];
    const { unmount } = render(
      <Table people={people} start={{ ...emptyView, breakdown: ["f2"] }} />,
    );
    expect(panel().textContent).toContain("5 people with drafts, 4 live");
    unmount();
    render(
      <Table
        people={people}
        start={{ ...emptyView, show: "live", breakdown: ["f2"] }}
      />,
    );
    expect(
      within(panel()).queryByRole("rowheader", { name: "Empty" }),
    ).toBeNull();
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

  it("gives no live figures for a column only drafted to be added, or to draw on another list", () => {
    const waiting = { state: "waiting" as const, madeBy: null, madeAt: null };
    const people = [
      person("a", ["p4"], ["test"], {
        ...waiting,
        action: "changed",
        changed: ["f1"],
        live: { values: { f1: ["p3"] }, links: {} },
      }),
    ];
    const added: Field = {
      ...level,
      draft: { ...waiting, action: "created", changed: [], live: {} },
    };
    const { unmount } = render(
      <Table
        people={people}
        fields={[added, role]}
        start={{ ...emptyView, breakdown: ["f1"] }}
      />,
    );
    expect(figures("P4")).toEqual(["1", share(1, 1)]);
    unmount();
    const moved: Field = {
      ...level,
      listId: "l2",
      draft: {
        ...waiting,
        action: "changed",
        changed: ["listId"],
        live: { listId: "l1" },
      },
    };
    render(
      <Table
        people={people}
        fields={[moved, role]}
        start={{ ...emptyView, breakdown: ["f1"] }}
      />,
    );
    expect(within(panel()).queryByText(/Live/)).toBeNull();
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
