// SPDX-License-Identifier: Apache-2.0

// Tests for the Cycles table's columns: their headings, filters, sorting and hiding.

import { screen, waitFor, within } from "@testing-library/react";
import { userEvent } from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import {
  fictionalCycle,
  fictionalMinors,
  fictionalRelease,
  fictionalStream,
} from "./test-releases.ts";
import { recordCell, changesSent } from "./test-support.tsx";
import {
  setUpEachTest,
  editsStreams,
  bySchedule,
  openPage,
  cycleId,
  grid,
  rowTexts,
} from "./test-cycle-tab.tsx";

setUpEachTest();

const headings = () =>
  within(grid())
    .getAllByRole("columnheader")
    .map(({ textContent }) => textContent)
    .filter((text) => text !== "Actions");

// Chooses an item from a column's menu, from its heading.
async function chooseInColumn(label: string, item: string) {
  await userEvent.click(
    screen.getByRole("button", {
      name: (name) => name.startsWith(`${label} column`),
    }),
  );
  await userEvent.click(await screen.findByRole("menuitem", { name: item }));
  await waitFor(() => {
    expect(screen.queryByRole("menu")).toBeNull();
  });
}

// Fictional Majors, shipping Fictional One with 27.2, and Fictional Minors, with no releases, each
// with cycles named as the other's.
const twoSchedules = () => [
  fictionalStream({
    releases: [
      fictionalRelease({ firstCycle: "2027-04-01", lastCycle: "2027-04-01" }),
    ],
  }),
  fictionalMinors(),
];

describe("the Cycles table's columns", () => {
  it("are headed Cycle, Schedule, Starts, Ends, Current and Release", async () => {
    await openPage([fictionalStream()]);
    expect(headings()).toEqual([
      "Cycle",
      "Schedule",
      "Starts",
      "Ends",
      "Current",
      "Release",
    ]);
  });

  it("each offer a filter of their kind from their menu, choosing cycles, schedules, Current and releases from lists", async () => {
    await openPage(twoSchedules());
    const offered = async (label: string) => {
      await chooseInColumn(label, "Filter…");
      const dialog = await screen.findByRole("dialog", {
        name: `Filter ${label}`,
      });
      const controls = [
        ...within(dialog).queryAllByRole("textbox"),
        ...within(dialog).queryAllByRole("checkbox"),
      ].map(
        (control) =>
          control.getAttribute("aria-label") ??
          (control as HTMLInputElement).labels?.[0]?.textContent,
      );
      await userEvent.keyboard("{Escape}");
      await waitFor(() => {
        expect(screen.queryByRole("dialog")).toBeNull();
      });
      return controls;
    };
    expect([
      await offered("Cycle"),
      await offered("Schedule"),
      await offered("Starts"),
      await offered("Ends"),
      await offered("Current"),
      await offered("Release"),
    ]).toEqual([
      [
        "Fictional Majors: 27.2",
        "Fictional Majors: 27.3",
        "Fictional Minors: 27.2",
        "Fictional Minors: 27.3",
      ],
      ["Fictional Majors", "Fictional Minors"],
      ["From", "To"],
      ["From", "To"],
      ["Current"],
      ["Fictional One", "Empty", "Not empty"],
    ]);
  });

  it("names each cycle alone in its cell, beside its schedule", async () => {
    await openPage(twoSchedules(), {
      path: "/releases?tab=cycles",
    });
    expect(rowTexts()[0]).toBe(
      "27.2Fictional MajorsApr 1, 2027Jun 30, 2027CurrentFictional One",
    );
  });

  it("filter by schedule from the Schedule column's menu, narrowing the timeline too", async () => {
    await openPage(twoSchedules(), bySchedule);
    await chooseInColumn("Schedule", "Filter…");
    const dialog = await screen.findByRole("dialog", {
      name: "Filter Schedule",
    });
    await userEvent.click(
      within(dialog).getByRole("checkbox", { name: "Fictional Minors" }),
    );
    await waitFor(() => {
      expect(rowTexts()[0]).toBe("Fictional Minors2 cycles");
    });
    expect(
      within(screen.getByRole("region", { name: "Timeline" }))
        .getAllByRole("list", { name: /^Cycles of / })
        .map((list) => list.getAttribute("aria-label")),
    ).toEqual(["Cycles of Fictional Minors"]);
  });

  it("filter by release, listing the cycles it includes", async () => {
    await openPage(twoSchedules(), bySchedule);
    await chooseInColumn("Release", "Filter…");
    const dialog = await screen.findByRole("dialog", {
      name: "Filter Release",
    });
    await userEvent.click(
      within(dialog).getByRole("checkbox", { name: "Fictional One" }),
    );
    await waitFor(() => {
      expect(rowTexts()).toEqual([
        "Fictional Majors1 cycle",
        "27.2Fictional MajorsApr 1, 2027Jun 30, 2027CurrentFictional One",
      ]);
    });
  });

  it("filter by Current, listing the cycles holding today", async () => {
    await openPage(twoSchedules(), {
      path: "/releases?tab=cycles",
    });
    await chooseInColumn("Current", "Filter…");
    const dialog = await screen.findByRole("dialog", {
      name: "Filter Current",
    });
    await userEvent.click(
      within(dialog).getByRole("checkbox", { name: "Current" }),
    );
    await waitFor(() => {
      expect(
        rowTexts().map((text) => text.slice(0, "27.2Fictional Mi".length)),
      ).toEqual(["27.2Fictional Ma", "27.2Fictional Mi"]);
    });
    await userEvent.click(
      within(dialog).getByRole("checkbox", { name: "Current" }),
    );
    await waitFor(() => {
      expect(rowTexts()).toHaveLength(4);
    });
  });

  it("list two cycles of one name in one schedule with their first days", async () => {
    await openPage([
      fictionalStream({
        cycles: [
          fictionalCycle("Freeze", "2027-07-01", "2027-07-07"),
          fictionalCycle("Freeze", "2027-08-01", "2027-08-07"),
        ],
      }),
    ]);
    await chooseInColumn("Cycle", "Filter…");
    const dialog = await screen.findByRole("dialog", { name: "Filter Cycle" });
    expect(
      within(dialog)
        .getAllByRole("checkbox")
        .map((box) => (box as HTMLInputElement).labels?.[0]?.textContent),
    ).toEqual([
      "Fictional Majors: Freeze, Aug 1, 2027",
      "Fictional Majors: Freeze, Jul 1, 2027",
    ]);
  });

  it("name a release alone in its cell, though another schedule's has its name", async () => {
    const onSecond = fictionalRelease({
      firstCycle: "2027-04-01",
      lastCycle: "2027-04-01",
    });
    await openPage(
      [
        fictionalStream({ releases: [onSecond] }),
        fictionalMinors({
          releases: [
            { ...onSecond, id: "30000000-0000-4000-8000-000000000009" },
          ],
        }),
      ],
      { path: "/releases?tab=cycles" },
    );
    expect(rowTexts()[0]).toBe(
      "27.2Fictional MajorsApr 1, 2027Jun 30, 2027CurrentFictional One",
    );
    await chooseInColumn("Release", "Filter…");
    const dialog = await screen.findByRole("dialog", {
      name: "Filter Release",
    });
    expect(
      within(dialog)
        .getAllByRole("checkbox")
        .map((box) => (box as HTMLInputElement).labels?.[0]?.textContent)
        .slice(0, 2),
    ).toEqual([
      "Fictional Majors: Fictional One",
      "Fictional Minors: Fictional One",
    ]);
  });

  it("can't be changed in place", async () => {
    const { fetch } = await openPage([fictionalStream()], {
      can: editsStreams,
    });
    const cell = recordCell(cycleId("2027-04-01"), "endsOn") as HTMLElement;
    cell.focus();
    await userEvent.keyboard("{Enter}2027-05-01{Enter}");
    await userEvent.keyboard("{Delete}");
    expect([within(grid()).queryByRole("textbox"), changesSent(fetch)]).toEqual(
      [null, []],
    );
  });
});
