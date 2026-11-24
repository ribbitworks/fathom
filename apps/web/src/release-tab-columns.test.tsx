// SPDX-License-Identifier: Apache-2.0

// Tests for the Releases table's columns and cells: their headings, filters, sorting and hiding.

import { screen, waitFor, within } from "@testing-library/react";
import { userEvent } from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { fictionalMinors, fictionalRelease } from "./test-releases.ts";
import { recordCell, changesSent } from "./test-support.tsx";
import {
  setUpEachTest,
  release,
  shipped,
  editsReleases,
  openPage,
  inStream,
  bySchedule,
  rowTexts,
  detailsOf,
} from "./test-release-tab.tsx";

setUpEachTest();

const minor = fictionalRelease({
  id: "30000000-0000-4000-8000-000000000003",
  name: "Fictional Two",
  firstCycle: "2027-07-01",
  lastCycle: "2027-07-01",
});
// A release in each of two schedules: Fictional One in Fictional Majors, shipping on Mar 31, 2027,
// and Fictional Two in Fictional Minors, shipping on Sep 30, 2027.
const twoSchedules = () => [
  ...inStream(release),
  fictionalMinors({
    releases: [minor],
  }),
];
// The schedules the timeline draws releases of, in its order.
const timelineLanes = () =>
  within(screen.getByRole("region", { name: "Timeline" }))
    .getAllByRole("list", { name: /^Releases of / })
    .map((list) => list.getAttribute("aria-label"));
const headings = () =>
  within(screen.getByRole("grid", { name: "Releases" }))
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

describe("the Releases table's columns", () => {
  it("are headed Release, Schedule, Ships on, Cycles and Status, Schedule shown though the rows are grouped by it", async () => {
    await openPage(inStream(release));
    expect(headings()).toEqual([
      "Release",
      "Schedule",
      "Ships on",
      "Cycles",
      "Status",
    ]);
  });

  it("each offer a filter of their kind from their menu", async () => {
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
      await offered("Release"),
      await offered("Schedule"),
      await offered("Ships on"),
      await offered("Cycles"),
    ]).toEqual([
      ["Fictional One", "Fictional Two"],
      ["Fictional Majors", "Fictional Minors"],
      ["From", "To", "No date", "Any date"],
      [
        "Fictional Majors: 27.1",
        "Fictional Minors: 27.3",
        "Empty",
        "Not empty",
      ],
    ]);
    await userEvent.click(
      screen.getByRole("button", {
        name: (name) => name.startsWith("Status column"),
      }),
    );
    const menu = await screen.findByRole("menu");
    expect(
      within(menu).queryByRole("menuitem", { name: "Filter…" }),
    ).toBeNull();
  });

  it("list in Release only the releases shown, those shipped once Show shipped is on", async () => {
    await openPage(inStream(release, shipped));
    const listed = async () => {
      await chooseInColumn("Release", "Filter…");
      const dialog = await screen.findByRole("dialog", {
        name: "Filter Release",
      });
      const names = within(dialog)
        .getAllByRole("checkbox")
        .map((box) => (box as HTMLInputElement).labels?.[0]?.textContent);
      await userEvent.keyboard("{Escape}");
      await waitFor(() => {
        expect(screen.queryByRole("dialog")).toBeNull();
      });
      return names;
    };
    const before = await listed();
    await userEvent.click(screen.getByRole("button", { name: "Views" }));
    await userEvent.click(
      await screen.findByRole("menuitem", { name: "Show shipped (1)" }),
    );
    await detailsOf("Fictional Shipped");
    expect([before, await listed()]).toEqual([
      ["Fictional One"],
      ["Fictional One", "Fictional Shipped"],
    ]);
  });

  it("filter by two releases ticked in the Release column's menu", async () => {
    const third = fictionalRelease({
      id: "30000000-0000-4000-8000-000000000004",
      name: "Fictional Three",
      firstCycle: "2027-04-01",
      lastCycle: "2027-04-01",
    });
    await openPage(
      [
        ...inStream(release, third),
        fictionalMinors({
          releases: [minor],
        }),
      ],
      bySchedule,
    );
    await chooseInColumn("Release", "Filter…");
    const dialog = await screen.findByRole("dialog", {
      name: "Filter Release",
    });
    for (const name of ["Fictional Three", "Fictional Two"]) {
      await userEvent.click(within(dialog).getByRole("checkbox", { name }));
    }
    await waitFor(() => {
      expect(timelineLanes()).toEqual([
        "Releases of Fictional Majors",
        "Releases of Fictional Minors",
      ]);
    });
    expect(
      rowTexts().map((text) => text.slice(0, "Fictional Three".length)),
    ).toEqual([
      "Fictional Major",
      "Fictional Three",
      "Fictional Minor",
      "Fictional TwoFi",
    ]);
  });

  it("filter by a cycle, listing each release whose cycles hold it", async () => {
    const spanning = fictionalRelease({ lastCycle: "2027-07-01" });
    await openPage(
      [
        ...inStream(spanning),
        fictionalMinors({
          releases: [minor],
        }),
      ],
      bySchedule,
    );
    await chooseInColumn("Cycles", "Filter…");
    const dialog = await screen.findByRole("dialog", {
      name: "Filter Cycles",
    });
    await userEvent.click(
      within(dialog).getByRole("checkbox", { name: "Fictional Majors: 27.2" }),
    );
    await waitFor(() => {
      expect(rowTexts()).toEqual([
        "Fictional Majors1 release",
        "Fictional OneFictional MajorsSep 30, 202727.1 to 27.3",
      ]);
    });
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
      expect(rowTexts()).toEqual([
        "Fictional Minors1 release",
        "Fictional TwoFictional MinorsSep 30, 202727.3",
      ]);
    });
    expect(timelineLanes()).toEqual(["Releases of Fictional Minors"]);
  });

  it("filter by the day a release ships, narrowing the timeline too", async () => {
    await openPage(twoSchedules(), bySchedule);
    await chooseInColumn("Ships on", "Filter…");
    const dialog = await screen.findByRole("dialog", {
      name: "Filter Ships on",
    });
    await userEvent.type(
      within(dialog).getByRole("textbox", { name: "To" }),
      "2027-06-30",
    );
    await waitFor(() => {
      expect(rowTexts()).toEqual([
        "Fictional Majors1 release",
        "Fictional OneFictional MajorsMar 31, 202727.1",
      ]);
    });
    expect(timelineLanes()).toEqual(["Releases of Fictional Majors"]);
  });

  it("sort by schedule in the schedules' order, the timeline's lanes following the rows", async () => {
    await openPage(twoSchedules());
    await chooseInColumn("Schedule", "Reverse list order");
    await waitFor(() => {
      expect(
        rowTexts().map((text) => text.slice(0, "Fictional One".length)),
      ).toEqual(["Fictional Two", "Fictional One"]);
    });
    expect(timelineLanes()).toEqual([
      "Releases of Fictional Minors",
      "Releases of Fictional Majors",
    ]);
  });

  it("hide the Schedule column from its menu", async () => {
    await openPage(inStream(release));
    await chooseInColumn("Schedule", "Hide column");
    await waitFor(() => {
      expect(headings()).toEqual(["Release", "Ships on", "Cycles", "Status"]);
    });
  });
});

describe("the Releases table's cells", () => {
  it("can't be changed in place, though the release can be changed", async () => {
    const { fetch } = await openPage(inStream(release), { can: editsReleases });
    const cell = recordCell(release.id, "shipsOn") as HTMLElement;
    cell.focus();
    await userEvent.keyboard("{Enter}2027-05-01{Enter}");
    await userEvent.keyboard("{Delete}");
    expect([
      within(screen.getByRole("grid", { name: "Releases" })).queryByRole(
        "textbox",
      ),
      changesSent(fetch),
    ]).toEqual([null, []]);
  });
});
