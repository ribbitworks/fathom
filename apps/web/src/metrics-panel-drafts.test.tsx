// SPDX-License-Identifier: Apache-2.0

// Tests for the Metrics panel's drafts: counting people as the Draft menu shows them, the live
// figures under the counts, and the dot before each figure a draft moves, or will move.

import type { Field } from "@fathom/shared";
import { render, screen, within } from "@testing-library/react";
import { userEvent } from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { share } from "./metrics.ts";
import { emptyView } from "./table-view.ts";
import {
  everyone,
  figures,
  level,
  panel,
  person,
  role,
  Table,
} from "./test-metrics-panel.tsx";

describe("the Metrics panel's drafts", () => {
  const waiting = { state: "waiting" as const, madeBy: null, madeAt: null };
  // How many of a group's figures have a mark, by the mark's class.
  const marksOf = (group: string, mark: string) =>
    within(panel())
      .getByRole("rowheader", { name: group })
      .closest("tr")
      ?.querySelectorAll(`td [class*="${mark}"]`).length;

  it("counts people as drafted, with the live figure under it where it differs, unless drafts are applied or live only", () => {
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
      `42, live`,
      `${share(4, 6)}${share(2, 6)}, live`,
    ]);
    expect(figures("P3")).toEqual([
      "13, live",
      `${share(1, 6)}${share(3, 6)}, live`,
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

  it("marks a figure a waiting draft moves with a yellow dot, one the user's unpublished change moves with a hollow dot, and one both move with the hollow dot alone", async () => {
    // Given one person whose waiting draft moves them from P3 to P4, and another whose unpublished
    // change moves them from no level to P3
    const draft = { state: "waiting" as const, madeBy: null, madeAt: null };
    const people = [
      ...everyone,
      person("w", ["p4"], ["dev"], {
        ...draft,
        action: "changed",
        changed: ["f1"],
        live: { values: { f1: ["p3"] }, links: {} },
      }),
      person("u", ["p3"], ["dev"], {
        ...draft,
        unpublished: true,
        action: "changed",
        changed: ["f1"],
        live: { values: { f1: [] }, links: {} },
      }),
    ];

    // When they are broken down by level, drafts beside live
    render(
      <Table people={people} start={{ ...emptyView, breakdown: ["f1"] }} />,
    );

    // Then P4, which only the waiting draft moves, has the yellow dot; P3, which both move, and
    // Empty, which only the unpublished change moves, have the hollow dot alone
    expect([
      marksOf("P4", "draftMark"),
      marksOf("P4", "unpublishedMark"),
      marksOf("P3", "draftMark"),
      marksOf("P3", "unpublishedMark"),
      marksOf("Empty", "draftMark"),
      marksOf("Empty", "unpublishedMark"),
    ]).toEqual([2, 0, 0, 2, 0, 2]);
    expect(figures("P4")).toEqual([
      "32, live",
      `${share(3, 6)}${share(2, 6)}, live`,
    ]);

    // And P4's figures are semibold, as values a draft changes are
    expect(marksOf("P4", "moved")).toBe(2);
    expect(marksOf("P3", "moved")).toBe(2);

    // And pointing at a figure's dot says what moves it
    const p4 = within(panel())
      .getByRole("rowheader", { name: "P4" })
      .closest("tr") as HTMLElement;
    await userEvent.hover(
      p4.querySelector('td [class*="draftMark"]') as HTMLElement,
    );
    expect(
      await screen.findByText("A change is waiting for approval."),
    ).toBeDefined();
  });

  it("marks, with Drafts applied, a figure a removal moves, though the removed are not counted", () => {
    // Given one person drafted to be removed from P3, waiting, and another from P4, unpublished
    const removal = {
      action: "deleted" as const,
      changed: [],
      live: { values: {}, links: {} },
    };
    const people = [
      ...everyone,
      person("r", ["p3"], ["dev"], { ...waiting, ...removal }),
      person("s", ["p4"], ["dev"], {
        ...waiting,
        ...removal,
        unpublished: true,
      }),
    ];

    // When they are broken down by level, with drafts applied
    render(
      <Table
        people={people}
        start={{ ...emptyView, show: "drafts", breakdown: ["f1"] }}
      />,
    );

    // Then P3's count has the yellow dot, and P4's figures and P3's share, of fewer people, the
    // hollow one
    expect(figures("P3")).toEqual(["1", share(1, 4)]);
    expect([
      marksOf("P3", "draftMark"),
      marksOf("P3", "unpublishedMark"),
      marksOf("P4", "unpublishedMark"),
    ]).toEqual([1, 1, 2]);
    expect(marksOf("P4", "moved")).toBe(0);
  });

  it("marks a figure a rejected draft moves with the red ringed dot, saying it was rejected", async () => {
    // Given a person whose rejected draft moves them from P3 to P4
    const people = [
      ...everyone,
      person("r", ["p4"], ["dev"], {
        ...waiting,
        state: "rejected",
        action: "changed",
        changed: ["f1"],
        live: { values: { f1: ["p3"] }, links: {} },
      }),
    ];

    // When they are broken down by level, drafts beside live
    render(
      <Table people={people} start={{ ...emptyView, breakdown: ["f1"] }} />,
    );

    // Then P4's count has the rejected dot, not the waiting one
    expect([
      marksOf("P4", "draftRejected"),
      marksOf("P4", "draftMark"),
    ]).toEqual([2, 0]);
    const p4 = within(panel())
      .getByRole("rowheader", { name: "P4" })
      .closest("tr") as HTMLElement;
    await userEvent.hover(
      p4.querySelector('td [class*="draftRejected"]') as HTMLElement,
    );
    expect(await screen.findByText("A change was rejected.")).toBeDefined();
  });

  it("marks, live only, a figure a waiting draft will move with Live's green dot, saying a change is waiting", async () => {
    // Given a person whose waiting draft moves them from P3 to P4
    const people = [
      ...everyone,
      person("w", ["p4"], ["dev"], {
        ...waiting,
        action: "changed",
        changed: ["f1"],
        live: { values: { f1: ["p3"] }, links: {} },
      }),
    ];

    // When they are broken down by level, live only
    render(
      <Table
        people={people}
        start={{ ...emptyView, show: "live", breakdown: ["f1"] }}
      />,
    );

    // Then P4's live figures have the green dot, and Empty's, which the draft leaves as they are,
    // none
    expect(figures("P4")).toEqual(["2", share(2, 5)]);
    expect([marksOf("P4", "liveMark"), marksOf("Empty", "liveMark")]).toEqual([
      2, 0,
    ]);
    const p4 = within(panel())
      .getByRole("rowheader", { name: "P4" })
      .closest("tr") as HTMLElement;
    await userEvent.hover(
      p4.querySelector('td [class*="liveMark"]') as HTMLElement,
    );
    expect(
      await screen.findByText("Live. A change is waiting for approval."),
    ).toBeDefined();
  });

  it("says, live only, when the user's own unpublished change will move a figure", async () => {
    // Given the user's own unpublished change moving a person from P3 to P4
    const people = [
      ...everyone,
      person("u", ["p4"], ["dev"], {
        ...waiting,
        unpublished: true,
        action: "changed",
        changed: ["f1"],
        live: { values: { f1: ["p3"] }, links: {} },
      }),
    ];

    // When they are broken down by level, live only
    render(
      <Table
        people={people}
        start={{ ...emptyView, show: "live", breakdown: ["f1"] }}
      />,
    );

    // Then pointing at P4's green dot says the change isn't published
    const p4 = within(panel())
      .getByRole("rowheader", { name: "P4" })
      .closest("tr") as HTMLElement;
    await userEvent.hover(
      p4.querySelector('td [class*="liveMark"]') as HTMLElement,
    );
    expect(
      await screen.findByText("Live. A change isn't published yet."),
    ).toBeDefined();
  });

  it("marks a figure a draft moves with Drafts applied too, without the live figure", () => {
    const people = [
      ...everyone,
      person("w", ["p4"], ["dev"], {
        state: "waiting",
        madeBy: null,
        madeAt: null,
        action: "changed",
        changed: ["f1"],
        live: { values: { f1: ["p3"] }, links: {} },
      }),
    ];
    render(
      <Table
        people={people}
        start={{ ...emptyView, show: "drafts", breakdown: ["f1"] }}
      />,
    );
    const row = within(panel())
      .getByRole("rowheader", { name: "P4" })
      .closest("tr") as HTMLElement;
    expect(row.querySelectorAll('td [class*="draftMark"]')).toHaveLength(2);
    expect(figures("P4")).toEqual(["3", share(3, 5)]);
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
});
