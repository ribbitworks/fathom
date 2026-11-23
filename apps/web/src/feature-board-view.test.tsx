// SPDX-License-Identifier: Apache-2.0

// Tests for the Features Board against a simulated server: its columns, strip and menus, rows from
// Group by, and the keyboard.

import { act, screen, waitFor, within } from "@testing-library/react";
import { userEvent } from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { featureDraft, tipOn } from "./test-support.tsx";
import {
  size,
  ids,
  feature,
  target,
  alpha,
  beta,
  gamma,
  later,
  customers,
  retiring,
  openBoard,
  cardNames,
  majors,
  card,
  headings,
} from "./test-feature-board.tsx";

vi.mock("@mantine/hooks", async (importOriginal) =>
  (await import("./test-board-width.ts")).withBoardWidth(
    await importOriginal(),
  ),
);

// 2027-05-10 is in the second of the stream's quarters, 27.2.
beforeEach(() => {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(new Date("2027-05-10T12:00:00Z"));
  size.width = 1000;
});

afterEach(() => {
  vi.useRealTimers();
});

describe("switching Features between its table and its board", () => {
  it("shows the table, then the board, keeping the choice in the address", async () => {
    const history = await openBoard("/features");
    expect(screen.getByRole("grid", { name: "Features" })).toBeTruthy();
    await userEvent.click(screen.getByRole("radio", { name: "Board" }));
    await screen.findByRole("list", { name: "Later" });
    expect(screen.queryByRole("grid")).toBeNull();
    expect(history.location.search).toContain("mode=board");
    await userEvent.click(screen.getByRole("radio", { name: "Table" }));
    await screen.findByRole("grid", { name: "Features" });
    expect(history.location.search).not.toContain("mode");
  });
});

describe("the columns", () => {
  it("shows the stream's cycles from the current one, as many as fit, then Later", async () => {
    await openBoard();
    expect(headings()).toEqual([
      "Cycle 27.2",
      "Cycle 27.3",
      "Cycle 27.4",
      "Cycle 28.1",
      "Later",
    ]);
  });

  it("marks the current cycle, and its release's draft with what it was", async () => {
    await openBoard();
    const current = screen.getByText("Cycle 27.2").parentElement as HTMLElement;
    expect(current.getAttribute("aria-current")).toBe("date");
    expect(current.textContent).toContain("Fictional Two LTS");
    expect(current.textContent).toContain(
      "Draft: changed from “Fictional Two”",
    );
  });

  it("shows a release a draft moves, and where it is live, dimmed", async () => {
    await openBoard();
    const header = (name: string) =>
      screen.getByText(name).parentElement as HTMLElement;
    expect(header("Cycle 27.3").textContent).toContain("Fictional Three");
    expect(header("Cycle 27.3").textContent).toContain("live");
    expect(header("Cycle 27.4").textContent).toContain("Moved");
  });

  it("shows the cards each cycle holds, in order, and Later's", async () => {
    await openBoard();
    expect(cardNames("Cycle 27.2")).toEqual([
      "Fictional Alpha",
      "Fictional Beta",
    ]);
    expect(cardNames("Later")).toEqual(["Fictional Later"]);
  });

  it("shows Later alone, with no strip, for a schedule with no cycles", async () => {
    await openBoard(undefined, { streams: [{ ...majors, cycles: [] }] });
    expect(headings()).toEqual(["Later"]);
    expect(screen.queryByRole("toolbar", { name: "Cycles" })).toBeNull();
  });

  it("shows months once the schedule chosen is gone", async () => {
    await openBoard(undefined, { streams: [] });
    expect(
      screen.getByRole("button", { name: "Columns: Months" }),
    ).toBeTruthy();
  });

  it("says so when no feature matches the search", async () => {
    await openBoard("/features?mode=board&search=nothing");
    expect(screen.getByText("No matching features")).toBeTruthy();
  });
});

describe("the strip and the Columns menu", () => {
  it("steps by cycle, and Today goes back to the current one", async () => {
    await openBoard();
    await userEvent.click(screen.getByRole("button", { name: "Next cycle" }));
    expect(headings().at(0)).toBe("Cycle 27.3");
    expect(
      screen.getByRole("button", { name: "27.3, in view, selected" }),
    ).toBeTruthy();
    await userEvent.click(
      screen.getByRole("button", { name: "Previous cycle" }),
    );
    expect(headings().at(0)).toBe("Cycle 27.2");
    await userEvent.click(screen.getByRole("button", { name: /^27\.1/ }));
    expect(headings().at(0)).toBe("Cycle 27.1");
    expect(
      screen
        .getByRole("button", { name: "Previous cycle" })
        .getAttribute("aria-disabled"),
    ).toBe("true");
    await userEvent.click(screen.getByRole("button", { name: "Today" }));
    expect(headings().at(0)).toBe("Cycle 27.2");
  });

  it("goes no further than the last cycles that fit", async () => {
    await openBoard("/features?mode=board&from=2028-04-01");
    expect(headings().at(0)).toBe("Cycle 27.3");
    expect(
      screen
        .getByRole("button", { name: "Next cycle" })
        .getAttribute("aria-disabled"),
    ).toBe("true");
  });

  it("offers Months, then schedules not retired as they are live, under Columns, and shows the one chosen", async () => {
    const history = await openBoard();
    await userEvent.click(
      screen.getByRole("button", {
        name: "Columns: Fictional Majors cycles",
      }),
    );
    expect(await screen.findByRole("group", { name: "Columns" })).toBeTruthy();
    expect(
      (await screen.findAllByRole("menuitem")).map(({ textContent }) =>
        textContent.replace(", chosen", ""),
      ),
    ).toEqual([
      "Months",
      "Fictional Majors cycles",
      "Fictional Minors cyclesRetired, Draft: retired",
    ]);
    await userEvent.click(
      screen.getByRole("menuitem", {
        name: "Fictional Minors cycles, Draft: retired",
      }),
    );
    expect(
      screen.getByRole("button", { name: "Columns: Fictional Minors cycles" }),
    ).toBeTruthy();
    expect(history.location.search).toContain(retiring.id);
  });
});

describe("months as columns", () => {
  const overdue = feature("Fictional Overdue", { neededBy: "2027-02" });
  const months = { months: true, features: [alpha, beta, overdue] };

  it("opens on months from this month, as many as fit, then No date", async () => {
    await openBoard("/features?mode=board", months);
    expect([
      screen.getByRole("button", { name: "Columns: Months" }),
      headings(),
      screen
        .getAllByText("May 2027")
        .find((text) => text.tagName === "P")
        ?.closest("[aria-current]")
        ?.getAttribute("aria-current"),
    ]).toEqual([
      expect.anything(),
      ["May 2027", "Jun 2027", "Jul 2027", "Aug 2027", "No date"],
      "date",
    ]);
  });

  it("puts each feature in the month it's needed by, this month once that has passed, or No date", async () => {
    await openBoard("/features?mode=board", months);
    const among = [alpha, beta, overdue];
    expect([
      cardNames("May 2027", among),
      cardNames("Jun 2027", among),
      cardNames("No date", among),
    ]).toEqual([
      ["Fictional Overdue"],
      ["Fictional Alpha"],
      ["Fictional Beta"],
    ]);
  });

  it("shows no Live copy for a draft that moves a feature between months that have passed", async () => {
    const movedPast = feature("Fictional Moved", {
      neededBy: "2027-03",
      draft: featureDraft({
        changed: ["neededBy"],
        live: { neededBy: "2027-02" },
      }),
    });
    await openBoard("/features?mode=board", {
      months: true,
      features: [movedPast],
    });
    expect(cardNames("May 2027", [movedPast])).toEqual(["Fictional Moved"]);
  });

  it("steps by month, and Today goes back to this month", async () => {
    await openBoard("/features?mode=board", { months: true });
    await userEvent.click(screen.getByRole("button", { name: "Next month" }));
    expect(headings().at(0)).toBe("Jun 2027");
    await userEvent.click(screen.getByRole("button", { name: "Today" }));
    expect(headings().at(0)).toBe("May 2027");
  });

  it("goes back to months from a schedule's cycles, keeping no schedule", async () => {
    const history = await openBoard();
    await userEvent.click(
      screen.getByRole("button", { name: "Columns: Fictional Majors cycles" }),
    );
    await userEvent.click(
      await screen.findByRole("menuitem", { name: "Months" }),
    );
    expect([
      screen.getByRole("button", { name: "Columns: Months" }),
      history.location.search.includes("stream="),
    ]).toEqual([expect.anything(), false]);
  });
});

describe("rows from Group by", () => {
  it("starts with none, listed first, and leaves out Cycle", async () => {
    await openBoard();
    await userEvent.click(screen.getByRole("button", { name: "Group by" }));
    expect(
      (await screen.findAllByRole("menuitem")).map(({ textContent }) =>
        textContent.replace(", chosen", ""),
      ),
    ).toEqual([
      "None",
      "Release",
      "Needed by",
      "Status",
      "Customers",
      "Projects",
      "Proposals",
      "Priority",
      "Size",
      "Risk",
      "Feature team",
      "Staffed",
    ]);
  });

  it("puts the cards in a row for each group, those with none last", async () => {
    await openBoard("/features?mode=board&grouping=priorityId");
    expect(
      screen.getByRole("list", { name: "Cycle 27.2, Critical" }).textContent,
    ).toContain("Fictional Alpha");
    expect(
      screen.getByRole("list", { name: "Later, No priority" }).textContent,
    ).toContain("Fictional Later");
  });

  it("turns the rows round once the second order is chosen, the row for none first", async () => {
    const history = await openBoard("/features?mode=board&grouping=priorityId");
    await userEvent.click(
      screen.getByRole("button", { name: "Group by: Priority" }),
    );
    const order = await screen.findByRole("group", { name: "Group order" });
    await userEvent.click(
      within(order).getByRole("menuitem", { name: "Reverse list order" }),
    );

    const rowLabel = (name: string) =>
      screen.getByText(name, { selector: "div" });
    const follows = (first: string, second: string) =>
      rowLabel(first).compareDocumentPosition(rowLabel(second)) &
      Node.DOCUMENT_POSITION_FOLLOWING;
    expect(follows("No priority", "Critical")).toBeTruthy();
    expect(history.location.search).toContain("groupsReversed=true");
  });

  it("names the order of records listed by name A to Z", async () => {
    await openBoard("/features?mode=board&grouping=projectIds");
    await userEvent.click(
      screen.getByRole("button", { name: "Group by: Projects" }),
    );
    expect(
      await screen.findByRole("menuitem", { name: "Z to A" }),
    ).toBeTruthy();
  });

  it("counts and groups only the features on the board, not other streams'", async () => {
    const elsewhere = feature("Fictional Elsewhere", {
      targetStreamId: retiring.id,
      targetCycle: "2027-04-01",
      priorityId: ids.critical,
    });
    await openBoard("/features?mode=board&grouping=priorityId", {
      features: [alpha, beta, gamma, later, elsewhere],
    });
    const rowLabel = (name: string) =>
      screen.getByText(name, { selector: "div" }).textContent;
    expect(rowLabel("Critical")).toBe("Critical1");
    expect(screen.queryByText("Fictional Elsewhere")).toBeNull();
  });

  it("offers no Then by, keeping the table's while another grouping is chosen", async () => {
    const history = await openBoard(
      "/features?mode=board&grouping=priorityId&thenBy=statusId",
    );
    await userEvent.click(
      screen.getByRole("button", { name: "Group by: Priority" }),
    );
    expect(screen.queryByRole("group", { name: "Then by" })).toBeNull();
    await userEvent.click(
      await screen.findByRole("menuitem", { name: "Size" }),
    );

    expect(screen.getByRole("button", { name: "Group by: Size" })).toBeTruthy();
    expect(history.location.search).toContain("thenBy=statusId");
  });

  it("shows none for a grouping the board doesn't offer", async () => {
    await openBoard("/features?mode=board&grouping=targetCycle");
    expect(screen.getByRole("button", { name: "Group by" })).toBeTruthy();
  });
});

describe("a feature under several values", () => {
  const shared = feature("Fictional Shared", {
    ...target("2027-04-01"),
    customerIds: customers.map(({ id }) => id),
  });
  const copies = () =>
    screen.getAllByRole("button", {
      name: (label) => label.startsWith("Fictional Shared"),
    });
  const open = () =>
    openBoard("/features?mode=board&grouping=customerIds", {
      features: [shared, beta],
    });

  it("has a card in the row of each, keyed apart, marked with the others", async () => {
    await open();

    for (const name of customers.map(({ name }) => name)) {
      expect(
        screen.getByRole("list", { name: `Cycle 27.2, ${name}` }).textContent,
      ).toContain("Fictional Shared");
    }
    expect(
      screen.getByRole("list", { name: "Cycle 27.2, No customers" })
        .textContent,
    ).toContain("Fictional Beta");
    const [first, second] = copies();
    expect(first?.id).not.toBe(second?.id);
    expect(first?.textContent).toContain("+1");
    expect(await tipOn(within(first as HTMLElement).getByText("+1"))).toBe(
      "Also under Fictional Quay",
    );
    expect(await tipOn(within(second as HTMLElement).getByText("+1"))).toBe(
      "Also under Fictional Harbour",
    );
  });

  it("steps through each card with the keyboard, and puts focus back on the one opened", async () => {
    await open();
    const [first, second] = copies();
    first?.focus();
    await userEvent.keyboard("{ArrowDown}");
    expect(document.activeElement).toBe(second);

    await userEvent.keyboard("{Enter}");
    await screen.findByRole("heading", { name: "Fictional Shared" });
    await userEvent.keyboard("{Escape}");
    await waitFor(() => {
      expect(document.activeElement).toBe(copies()[1]);
    });
  });

  it("puts focus on the first card of the feature closed, once another card had it", async () => {
    await openBoard(
      `/features?mode=board&grouping=customerIds&open=${shared.id}`,
      { features: [shared, beta] },
    );
    await screen.findByRole("heading", { name: "Fictional Shared" });
    card("Fictional Beta").focus();

    await userEvent.click(screen.getByRole("button", { name: /^Close/ }));

    await waitFor(() => {
      expect(document.activeElement).toBe(copies()[0]);
    });
  });

  it("gives each card an id with no spaces, where a row's key has one, such as a release's", async () => {
    await openBoard("/features?mode=board&grouping=release");

    expect(
      screen
        .getAllByRole("button", {
          name: (label) => label.startsWith("Fictional"),
        })
        .map(({ id }) => id)
        .filter((id) => id.startsWith("card-") && /\s/.test(id)),
    ).toEqual([]);
    expect(card("Fictional Alpha").id).toMatch(/^card-\S+$/);
  });
});

describe("the keyboard and a feature's details", () => {
  it("moves between the cards with the arrow keys, one stop for Tab", async () => {
    await openBoard();
    expect(card("Fictional Alpha").getAttribute("tabindex")).toBe("0");
    expect(card("Fictional Beta").getAttribute("tabindex")).toBe("-1");
    card("Fictional Alpha").focus();
    await userEvent.keyboard("{ArrowDown}");
    expect(document.activeElement).toBe(card("Fictional Beta"));
    await userEvent.keyboard("{ArrowRight}");
    expect(document.activeElement).toBe(card("Fictional Gamma"));
    await userEvent.keyboard("{ArrowRight}");
    expect(document.activeElement).toBe(card("Fictional Later"));
    await userEvent.keyboard("{ArrowRight}");
    expect(document.activeElement).toBe(card("Fictional Later"));
    await userEvent.keyboard("{ArrowLeft}");
    expect(document.activeElement).toBe(card("Fictional Gamma"));
    await userEvent.keyboard("{ArrowLeft}");
    expect(document.activeElement).toBe(card("Fictional Alpha"));
    await userEvent.keyboard("{ArrowUp}");
    expect(document.activeElement).toBe(card("Fictional Alpha"));
    await userEvent.keyboard("{ArrowDown}{ArrowDown}");
    expect(document.activeElement).toBe(card("Fictional Beta"));
    await userEvent.keyboard("{Alt>}{ArrowUp}{/Alt}");
    expect(document.activeElement).toBe(card("Fictional Beta"));
  });

  it("opens a card's details from Enter, and puts focus back on close", async () => {
    await openBoard();
    card("Fictional Beta").focus();
    await userEvent.keyboard("{Enter}");
    expect(
      await screen.findByRole("heading", { name: "Fictional Beta" }),
    ).toBeTruthy();
    expect(card("Fictional Beta").getAttribute("aria-current")).toBe("true");
    await userEvent.keyboard("{Escape}");
    await waitFor(() => {
      expect(document.activeElement).toBe(card("Fictional Beta"));
    });
  });

  it("holds its columns while a side panel is open, and fits again once it has gone", async () => {
    await openBoard();
    await userEvent.click(card("Fictional Alpha"));
    await screen.findByRole("heading", { name: "Fictional Alpha" });
    act(() => {
      size.set(500);
    });
    expect(headings()).toHaveLength(5);
    await userEvent.keyboard("{Escape}");
    await waitFor(() => {
      expect(
        screen.queryByRole("heading", { name: "Fictional Alpha" }),
      ).toBeNull();
    });
    expect(headings()).toHaveLength(5);
    await userEvent.click(card("Fictional Beta"));
    await screen.findByRole("heading", { name: "Fictional Beta" });
    act(() => {
      size.set(520);
    });
    expect(headings()).toHaveLength(5);
    await userEvent.keyboard("{Escape}");
    await waitFor(() => {
      expect(
        screen.queryByRole("heading", { name: "Fictional Beta" }),
      ).toBeNull();
    });
    act(() => {
      size.set(540);
    });
    expect(headings()).toEqual(["Cycle 27.2", "Later"]);
  });

  it("holds nothing while the board's width isn't known yet", async () => {
    size.width = 0;
    await openBoard(`/features?mode=board&open=${alpha.id}`);
    expect(headings()).toEqual(["Cycle 27.2", "Later"]);
    act(() => {
      size.set(1000);
    });
    expect(headings()).toHaveLength(5);
  });
});
