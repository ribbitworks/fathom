// SPDX-License-Identifier: Apache-2.0

// Tests for a schedule's details: its values, cycles and drafts, and the changes made from them.

import type { Cycle } from "@fathom/shared";
import { screen, within } from "@testing-library/react";
import { userEvent } from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  fictionalCycle,
  fictionalPattern,
  fictionalStream,
  quarters,
  streamId,
  streamsAnswer,
} from "./test-releases.ts";
import {
  bodyOf,
  detailRow,
  detailValue,
  recordDraft,
  renderApp,
  serverAnswers,
  signedIn,
} from "./test-support.tsx";
import {
  setUpEachTest,
  editsAll,
  changeSetId,
  streamPath,
  pattern,
  release,
  openStream,
  panel,
  openRowMenu,
  calls,
} from "./test-releases-page.tsx";

setUpEachTest();

describe("a schedule's details", () => {
  const saved = () => Response.json({ stream: fictionalStream(), changeSetId });
  const details = () =>
    within(panel()).getByRole("region", { name: "Details" });
  const cycles = () => within(panel()).getByRole("region", { name: "Cycles" });
  const cycleRows = () =>
    within(cycles())
      .getAllByRole("row")
      .slice(1)
      .map(({ textContent }) => textContent);
  const pencil = (label: string) =>
    within(panel()).getByRole("button", { name: `Change ${label}` });

  beforeEach(() => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date("2027-02-15T12:00:00Z"));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("shows the table's values first, then its Name pattern as typed", async () => {
    await openStream([fictionalStream({ releases: [release] })]);
    expect(
      [
        "Schedule",
        "Current cycle",
        "Cycle starts",
        "Cycle ends",
        "Next release",
        "Release date",
        "Cycle length",
        "Schedule ends",
        "Name pattern",
      ].map((label) => detailValue(label, details())),
    ).toEqual([
      "Fictional Majors",
      "27.1",
      "Jan 1, 2027",
      "Mar 31, 2027",
      "Fictional One",
      "Mar 31, 2027",
      "3 months",
      "No end date",
      "{YY}.{N} (now 27.1)",
    ]);
  });

  it("says None for what a schedule with no cycles yet doesn't have", async () => {
    await openStream([fictionalStream({ patterns: [], cycles: [] })]);
    expect(
      ["Current cycle", "Next release", "Name pattern"].map((label) =>
        detailValue(label, details()),
      ),
    ).toEqual(["None", "None", "None"]);
  });

  it("offers no pencils to those who don't change schedules", async () => {
    await openStream([fictionalStream()], { can: { canEditReleases: true } });
    expect(
      within(panel()).queryAllByRole("button", { name: /^Change / }),
    ).toEqual([]);
  });

  it("marks a drafted name and end, with what they are live", async () => {
    await openStream([
      fictionalStream({
        endsOn: "2027-05-15",
        draft: recordDraft({
          changed: ["name", "endsOn"],
          live: { name: "Fictional Was", endsOn: null },
        }),
      }),
    ]);
    expect([
      detailValue("Schedule", details()),
      detailValue("Schedule ends", details()),
    ]).toEqual([
      expect.stringContaining("Fictional Was"),
      expect.stringMatching(/May 15, 2027.*empty, live$/),
    ]);
  });

  it("marks a drafted change of how long cycles last, with how long they last live, as its row does", async () => {
    // Given a draft making cycles a month long, where they are three months live
    await openStream([
      fictionalStream({
        patterns: [
          fictionalPattern({
            length: 1,
            draft: recordDraft({ changed: ["length"], live: { length: 3 } }),
          }),
        ],
      }),
    ]);

    // Then Cycle length has the draft's dot, with the live length on its Live line
    const length = detailRow("Cycle length", details());
    expect([
      length.querySelector("[class*='dot']") !== null,
      detailValue("Cycle length", details()),
    ]).toEqual([true, expect.stringMatching(/^1 month.*3 months/)]);
  });

  // A drafted change of cycles cutting 27.2 to two months, with a month's freeze after it.
  const recut = () => {
    const [first, second, ...later] = quarters(4) as [Cycle, Cycle, ...Cycle[]];
    return fictionalStream({
      patterns: [
        pattern,
        fictionalPattern({
          id: "20000000-0000-4000-8000-000000000002",
          startsOn: "2027-06-01",
          draft: recordDraft({ action: "created" }),
        }),
      ],
      cycles: [
        first,
        { ...second, endsOn: "2027-05-31" },
        fictionalCycle("Freeze", "2027-06-01", "2027-06-30"),
        ...later,
      ],
      liveCycles: quarters(4),
    });
  };
  const markedCycles = () =>
    within(cycles())
      .getAllByRole("row")
      .slice(1)
      .map((row) => [
        row.querySelector("[class*='dot']") !== null,
        row.textContent,
      ]);

  it("marks each cycle a draft changes or adds, with how long a changed one lasts live", async () => {
    await openStream([recut()]);

    expect(markedCycles()).toEqual([
      [false, "27.1 CurrentJan 1, 2027Mar 31, 20273 months"],
      [true, expect.stringMatching(/^27\.2.*May 31, 2027.*2 months.*3 months/)],
      [true, expect.stringMatching(/^Freeze.*Jun 30, 2027.*1 month$/)],
      [false, "27.3Jul 1, 2027Sep 30, 20273 months"],
      [false, "27.4Oct 1, 2027Dec 31, 20273 months"],
    ]);
  });

  it("shows the cycles as they are live under Live only, marking each a draft would change", async () => {
    // Given the same drafted change, under Live only
    serverAnswers({
      "GET /api/session": signedIn,
      "GET /api/release-streams": streamsAnswer([recut()]),
    });
    renderApp(`/releases/${streamId}?show=live`);
    await screen.findByRole("heading", { name: "Fictional Majors", level: 2 });

    // Then 27.2 shows as it is live, marked, with no Live line, and no freeze is shown
    expect(markedCycles()).toEqual([
      [false, "27.1 CurrentJan 1, 2027Mar 31, 20273 months"],
      [true, expect.stringMatching(/^27\.2.*Jun 30, 2027.*3 months$/)],
      [false, "27.3Jul 1, 2027Sep 30, 20273 months"],
      [false, "27.4Oct 1, 2027Dec 31, 20273 months"],
    ]);
  });

  it("marks no value or cycle of a schedule only drafted to be added", async () => {
    await openStream([
      fictionalStream({ draft: recordDraft({ action: "created" }) }),
    ]);

    expect([
      detailValue("Cycle length", details()),
      detailValue("Name pattern", details()),
      markedCycles().map(([marked]) => marked),
    ]).toEqual([
      "3 months",
      "{YY}.{N} (now 27.1)",
      [false, false, false, false],
    ]);
  });

  it("marks a drafted Name pattern, with the pattern live", async () => {
    await openStream([
      fictionalStream({
        patterns: [
          fictionalPattern({
            naming: "{YYYY}.{N}",
            draft: recordDraft({
              changed: ["naming"],
              live: { naming: "{YY}.{N}" },
            }),
          }),
        ],
      }),
    ]);

    const naming = detailRow("Name pattern", details());
    expect([
      naming.querySelector("[class*='dot']") !== null,
      detailValue("Name pattern", details()),
    ]).toEqual([
      true,
      expect.stringMatching(/^\{YYYY\}\.\{N\} \(now 27\.1\).*\{YY\}\.\{N\}/),
    ]);
  });

  it("shows an ended schedule's last cycle, with no current cycle or length", async () => {
    // Given a schedule whose last cycle ended before today
    vi.setSystemTime(new Date("2028-02-15T12:00:00Z"));
    await openStream([
      fictionalStream({ endsOn: "2027-12-31", cycles: quarters(4) }),
    ]);

    // Then it has no current cycle or length, and its last cycle shows, the earlier ones folded
    expect([
      detailValue("Current cycle", details()),
      detailValue("Cycle length", details()),
      cycleRows(),
      within(cycles())
        .getByRole("button", { name: "Earlier cycles (3)" })
        .getAttribute("aria-expanded"),
    ]).toEqual([
      "None",
      "None",
      ["27.4Oct 1, 2027Dec 31, 20273 months"],
      "false",
    ]);
  });

  it.each([
    ["retired", fictionalStream({ retired: true })],
    [
      "drafted to be retired",
      fictionalStream({
        retired: true,
        draft: recordDraft({ changed: ["retired"] }),
      }),
    ],
  ])(
    "offers a schedule %s no pencils, and only Restore in its row's menu",
    async (_case, stream) => {
      // Given a schedule retired, or drafted to be, shown with retired ones, to one who changes
      // schedules
      serverAnswers({
        "GET /api/session": signedIn,
        "GET /api/release-streams": streamsAnswer([stream], editsAll),
      });
      renderApp(`/releases/${streamId}?retired=true`);
      await screen.findByRole("heading", {
        name: "Fictional Majors",
        level: 2,
      });

      // When its row's menu opens
      const menu = await openRowMenu();

      // Then its details offer no change, and its menu offers Restore, not Retire
      expect([
        within(panel()).queryAllByRole("button", { name: /^Change / }),
        within(menu).queryByRole("menuitem", { name: "Retire" }),
        within(menu).getByRole("menuitem", { name: "Restore" }),
      ]).toEqual([[], null, expect.anything()]);
    },
  );

  it("marks an end moved from one day to another, with the day it is live", async () => {
    await openStream([
      fictionalStream({
        endsOn: "2027-05-15",
        draft: recordDraft({
          changed: ["endsOn"],
          live: { endsOn: "2027-04-30" },
        }),
      }),
    ]);
    expect(detailValue("Schedule ends", details())).toMatch(
      /May 15, 2027.*Apr 30, 2027/,
    );
  });

  it("sets up the cycles of a schedule without any from its Name pattern", async () => {
    await openStream([fictionalStream({ patterns: [], cycles: [] })], {
      can: editsAll,
      answers: { [`POST ${streamPath}/patterns`]: saved },
    });
    await userEvent.click(pencil("Name pattern"));
    const dialog = await screen.findByRole("dialog", {
      name: "Set up cycles for Fictional Majors",
    });
    await userEvent.type(
      within(dialog).getByRole("textbox", { name: "First cycle starts" }),
      "20270101",
    );
    await userEvent.click(
      within(dialog).getByRole("button", { name: "Set up cycles" }),
    );
    expect(await screen.findByText("Drafted the cycles.")).toBeDefined();
  });

  it("changes the names from the current cycle on, from Name pattern", async () => {
    const { fetch } = await openStream([fictionalStream()], {
      can: editsAll,
      answers: { [`POST ${streamPath}/patterns`]: saved },
    });
    await userEvent.click(pencil("Name pattern"));
    const dialog = await screen.findByRole("dialog", {
      name: "Change the length or names of Fictional Majors's cycles",
    });
    await userEvent.click(
      within(dialog).getByRole("button", { name: "Change cycles" }),
    );
    expect(
      await screen.findByText("Drafted the change to the cycles."),
    ).toBeDefined();
    expect(bodyOf(fetch, "POST", `${streamPath}/patterns`)).toEqual([
      expect.objectContaining({ startsOn: "2027-01-01" }),
    ]);
  });

  it("renames a schedule from Schedule", async () => {
    await openStream([fictionalStream()], { can: editsAll });
    await userEvent.click(pencil("Schedule"));
    expect(
      await screen.findByRole("dialog", { name: "Rename Fictional Majors" }),
    ).toBeDefined();
  });

  it("ends the schedule on a day from Schedule ends", async () => {
    await openStream([fictionalStream()], {
      can: editsAll,
      answers: { [`PUT ${streamPath}/ends-on`]: saved },
    });
    await userEvent.click(pencil("Schedule ends"));
    const dialog = await screen.findByRole("dialog", {
      name: "Change when Fictional Majors ends",
    });
    await userEvent.type(
      within(dialog).getByRole("textbox", { name: "Schedule ends" }),
      "20270515",
    );
    await userEvent.click(within(dialog).getByRole("button", { name: "Save" }));
    expect(
      await screen.findByText("Drafted the change to the cycles."),
    ).toBeDefined();
  });

  it("offers no Schedule ends pencil before a schedule has cycles", async () => {
    await openStream([fictionalStream({ patterns: [], cycles: [] })], {
      can: editsAll,
    });
    expect(
      within(panel()).queryByRole("button", { name: "Change Schedule ends" }),
    ).toBeNull();
  });

  it("lists cycles from the current one, marked, and the next five, with each one's duration", async () => {
    await openStream([fictionalStream({ cycles: quarters(10) })]);
    expect(cycleRows()).toEqual([
      "27.1 CurrentJan 1, 2027Mar 31, 20273 months",
      "27.2Apr 1, 2027Jun 30, 20273 months",
      "27.3Jul 1, 2027Sep 30, 20273 months",
      "27.4Oct 1, 2027Dec 31, 20273 months",
      "28.1Jan 1, 2028Mar 31, 20283 months",
      "28.2Apr 1, 2028Jun 30, 20283 months",
    ]);
  });

  it("shows all cycles on asking, and fewer again, keeping focus on the one control", async () => {
    // Given a schedule with more cycles than the panel first lists
    await openStream([fictionalStream({ cycles: quarters(10) })]);
    const fold = within(cycles()).getByRole("button", {
      name: "Show all (10)",
    });

    // When all are asked for
    await userEvent.click(fold);

    // Then every cycle shows, and the same control, still focused, offers fewer
    expect([
      cycleRows().length,
      fold.textContent,
      fold.getAttribute("aria-expanded"),
      document.activeElement,
    ]).toEqual([10, "Show less", "true", fold]);

    // When fewer are asked for again
    await userEvent.click(fold);

    // Then the first six show again
    expect([cycleRows().length, fold.textContent]).toEqual([
      6,
      "Show all (10)",
    ]);
  });

  it("unfolds the cycles before the current one", async () => {
    vi.setSystemTime(new Date("2027-08-15T12:00:00Z"));
    await openStream([fictionalStream({ cycles: quarters(4) })]);
    await userEvent.click(
      within(cycles()).getByRole("button", { name: "Earlier cycles (2)" }),
    );
    expect(cycleRows().map((row) => row.slice(0, 4))).toEqual([
      "27.1",
      "27.2",
      "27.3",
      "27.4",
    ]);
  });

  it("says None for a schedule with no cycles", async () => {
    await openStream([fictionalStream({ patterns: [], cycles: [] })]);
    expect(within(cycles()).getByText("None")).toBeDefined();
  });

  it("asks whether a Duration's change is for that cycle only or for it and later ones", async () => {
    const { fetch } = await openStream([fictionalStream()], {
      can: editsAll,
      answers: { [`POST ${streamPath}/patterns`]: saved },
    });
    await userEvent.click(pencil("Duration of 27.2"));
    expect(
      (await screen.findAllByRole("menuitem")).map(
        ({ textContent }) => textContent,
      ),
    ).toEqual(["This cycle only…", "This and later cycles…"]);
    await userEvent.click(
      screen.getByRole("menuitem", { name: "This and later cycles…" }),
    );
    const dialog = await screen.findByRole("dialog", {
      name: "Change the length or names of Fictional Majors's cycles",
    });
    await userEvent.click(
      within(dialog).getByRole("button", { name: "Change cycles" }),
    );
    await screen.findByText("Drafted the change to the cycles.");
    expect(bodyOf(fetch, "POST", `${streamPath}/patterns`)).toEqual([
      expect.objectContaining({ startsOn: "2027-04-01" }),
    ]);
  });
});

describe("changing one cycle's length", () => {
  const saved = () => Response.json({ stream: fictionalStream(), changeSetId });

  it("is offered on each cycle's Duration to those who change cycles, and drafts the new length", async () => {
    const { fetch } = await openStream([fictionalStream()], {
      can: editsAll,
      answers: { [`PUT ${streamPath}/cycles/2027-04-01/length`]: saved },
    });
    await userEvent.click(
      within(panel()).getByRole("button", {
        name: "Change Duration of 27.2",
      }),
    );
    await userEvent.click(
      await screen.findByRole("menuitem", { name: "This cycle only…" }),
    );
    const dialog = await screen.findByRole("dialog", {
      name: "Change the length of 27.2",
    });
    const length = within(dialog).getByRole("textbox", { name: "Length" });
    await userEvent.clear(length);
    await userEvent.type(length, "2");
    await userEvent.click(
      within(dialog).getByRole("button", { name: "Change length" }),
    );
    expect(await screen.findByText("Drafted the new length.")).toBeDefined();
    expect(calls(fetch, "PUT")).toHaveLength(1);
  });

  it("is not offered to those who do not change cycles", async () => {
    await openStream([fictionalStream()], {
      can: { canEditReleases: true },
    });
    expect(
      screen.queryByRole("button", { name: "Change Duration of 27.2" }),
    ).toBeNull();
  });
});
