// SPDX-License-Identifier: Apache-2.0

// Tests for the Releases page's Cycles tab: the table of every schedule's cycles, what it keeps in
// the address, past cycles, its columns and filters, a cycle's details and its Duration's changes,
// the drafts of cycles and their row menus, the timeline, and what each role may do there.

import type { Cycle, RecordDraft, ReleaseStream } from "@fathom/shared";
import { screen, waitFor, within } from "@testing-library/react";
import { userEvent } from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  bodyOf,
  detailRow,
  detailValue,
  fictionalFeature,
  fictionalPattern,
  fictionalRelease,
  fictionalStream,
  fictionalUser,
  planAnswers,
  quarters,
  recordCell,
  recordDraft,
  renderApp,
  serverAnswers,
  signedIn,
  streamId,
  featuresAddress,
  openedIn,
} from "./test-support.tsx";

beforeEach(() => {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(new Date("2027-05-15T12:00:00Z"));
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

type Answers = Parameters<typeof serverAnswers>[0];
type Can = { canEditStreams?: boolean; canEditReleases?: boolean };

const changeSetId = "00000000-0000-4000-8000-000000000001";
const savedAs = () => Response.json({ changeSetId });
const minorsId = "10000000-0000-4000-8000-000000000002";
const patternId = "20000000-0000-4000-8000-000000000002";
const editsStreams = { canEditStreams: true };
const approver = () =>
  Response.json({
    ...fictionalUser,
    permissions: [
      "plan:view",
      "features:view",
      "plan:approve",
      "features:approve",
      "configuration:approve",
    ],
  });

const answer =
  (shown: ReleaseStream[], can: Can = {}) =>
  () =>
    Response.json({
      streams: shown,
      canEditStreams: false,
      canEditReleases: false,
      ...can,
    });

const bySchedule = { path: "/releases?tab=cycles&grouping=schedule" };

// Opens the page at the address given, with the schedules given, and any other answers the test
// needs, once the table of cycles shows.
async function openPage(
  shown: ReleaseStream[],
  {
    path = "/releases?tab=cycles",
    can = {},
    answers = {},
  }: { path?: string; can?: Can; answers?: Answers } = {},
) {
  const fetch = serverAnswers({
    "GET /api/session": signedIn,
    "GET /api/release-streams": answer(shown, can),
    ...answers,
  });
  const history = renderApp(path);
  await screen.findByRole("grid", { name: "Cycles" });
  return { fetch, history };
}

const cycleId = (startsOn: string, stream = streamId) =>
  `${stream} ${startsOn}`;
const searchOf = (history: { location: { search: string } }) =>
  new URLSearchParams(history.location.search);

// Opens the page with a cycle's details open, the second of Fictional Majors to start.
async function openCycle(
  shown: ReleaseStream[],
  options: { can?: Can; answers?: Answers; view?: string } = {},
  startsOn = "2027-04-01",
) {
  const opened = await openPage(shown, {
    ...options,
    path: `/releases?tab=cycles&open=${encodeURIComponent(cycleId(startsOn))}${options.view ?? ""}`,
  });
  await screen.findByRole("heading", { level: 2, name: cycleHeading });
  return opened;
}

const cycleHeading = /^Fictional Majors: /;
const cyclePanel = () => screen.getByRole("region", { name: cycleHeading });
const panelHeading = () =>
  screen.getByRole("heading", { level: 2, name: cycleHeading });
const grid = () => screen.getByRole("grid", { name: "Cycles" });
// The rows of the table, after its header, as read.
const rowTexts = () =>
  within(grid())
    .getAllByRole("row")
    .slice(1)
    .map(({ textContent }) => textContent);
const headings = () =>
  within(grid())
    .getAllByRole("columnheader")
    .map(({ textContent }) => textContent)
    .filter((text) => text !== "Actions");

// Fictional Majors' second cycle, 27.2, drafted to end a month early, the next starting a month
// early to keep its end, by a new pattern from 27.2 on.
const shortened = (fields: Partial<ReleaseStream> = {}) => {
  const [first, second, third, fourth] = quarters(4) as [
    Cycle,
    Cycle,
    Cycle,
    Cycle,
  ];
  return fictionalStream({
    patterns: [
      fictionalPattern(),
      fictionalPattern({
        id: patternId,
        startsOn: "2027-04-01",
        length: 2,
        draft: recordDraft({ action: "created" }),
      }),
    ],
    cycles: [
      first,
      { ...second, endsOn: "2027-05-31" },
      { ...third, startsOn: "2027-06-01" },
      fourth,
    ],
    liveCycles: quarters(4),
    ...fields,
  });
};

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

// Chooses an item from the menu of a cycle's row, from the ⋯ beside its name.
async function chooseRowAction(name: string, item: string) {
  const [more] = within(grid()).getAllByRole("button", {
    name: `Actions for ${name}`,
  });
  await userEvent.click(more as HTMLElement);
  await userEvent.click(await screen.findByRole("menuitem", { name: item }));
}

// The texts of the menu of a cycle's row, from the ⋯ beside its name.
async function rowMenuTexts(name: string) {
  const [more] = within(grid()).getAllByRole("button", {
    name: `Actions for ${name}`,
  });
  await userEvent.click(more as HTMLElement);
  const menu = await screen.findByRole("menu");
  return [...menu.querySelectorAll("[role='menuitem'], p, div[class*='label']")]
    .map(({ textContent }) => textContent)
    .filter((text) => text !== "");
}

describe("the Cycles tab", () => {
  it("sits between Releases and Schedules, chosen, with no New button", async () => {
    await openPage([fictionalStream()]);
    expect(
      screen
        .getAllByRole("tab")
        .map((tab) => [tab.textContent, tab.getAttribute("aria-selected")]),
    ).toEqual([
      ["Releases", "false"],
      ["Cycles", "true"],
      ["Schedules", "false"],
    ]);
    expect(
      within(screen.getByRole("tabpanel", { name: "Cycles" })).getByRole(
        "grid",
        { name: "Cycles" },
      ),
    ).toBeDefined();
    expect(screen.queryByRole("button", { name: /^New / })).toBeNull();
  });

  it("is chosen from its tab, keeping it in the address", async () => {
    serverAnswers({
      "GET /api/session": signedIn,
      "GET /api/release-streams": answer([fictionalStream()]),
    });
    const history = renderApp("/releases");
    await userEvent.click(await screen.findByRole("tab", { name: "Cycles" }));
    await screen.findByRole("grid", { name: "Cycles" });
    expect(searchOf(history).get("tab")).toBe("cycles");
  });

  it("lists each cycle under its schedule, with its days, Current on today's and the release that includes it", async () => {
    await openPage(
      [
        fictionalStream({
          releases: [fictionalRelease({ lastCycle: "2027-04-01" })],
        }),
      ],
      { path: "/releases?tab=cycles&grouping=schedule&past=shown&later=shown" },
    );
    expect(rowTexts()).toEqual([
      "Fictional Majors4 cycles",
      "27.1Fictional MajorsJan 1, 2027Mar 31, 2027Fictional One",
      "27.2Fictional MajorsApr 1, 2027Jun 30, 2027CurrentFictional One",
      "27.3Fictional MajorsJul 1, 2027Sep 30, 2027",
      "27.4Fictional MajorsOct 1, 2027Dec 31, 2027",
    ]);
  });

  it("hides past cycles until Show past cycles is chosen in the Views menu, keeping the choice in the address", async () => {
    const { history } = await openPage([fictionalStream()], bySchedule);
    expect(rowTexts()).toEqual([
      "Fictional Majors2 cycles",
      "27.2Fictional MajorsApr 1, 2027Jun 30, 2027Current",
      "27.3Fictional MajorsJul 1, 2027Sep 30, 2027",
    ]);
    await userEvent.click(
      screen.getByRole("button", { name: "Views, changed" }),
    );
    await userEvent.click(
      await screen.findByRole("menuitem", { name: "Show past cycles (1)" }),
    );
    await waitFor(() => {
      expect(rowTexts()).toHaveLength(4);
    });
    expect(searchOf(history).get("past")).toBe("shown");
  });

  it("offers hiding past cycles again while they show, though none has ended", async () => {
    vi.setSystemTime(new Date("2027-02-15T12:00:00Z"));
    const { history } = await openPage([fictionalStream()], {
      path: "/releases?tab=cycles&past=shown",
    });
    await userEvent.click(
      screen.getByRole("button", { name: "Views, changed" }),
    );
    await userEvent.click(
      await screen.findByRole("menuitem", {
        name: "Show past cycles (0), chosen",
      }),
    );
    await waitFor(() => {
      expect(searchOf(history).has("past")).toBe(false);
    });
  });

  // Cycles of a week starting on the last day of next quarter and the day after, beside quarters.
  const weeks = () =>
    fictionalStream({
      id: minorsId,
      name: "Fictional Minors",
      cycles: [
        {
          startsOn: "2027-09-30",
          endsOn: "2027-09-30",
          name: "Last",
          months: [],
        },
        {
          startsOn: "2027-10-01",
          endsOn: "2027-10-07",
          name: "After",
          months: [],
        },
      ],
    });
  const startOf = (text: string | null) => text?.split("Fictional")[0];

  it("shows a cycle starting on next quarter's last day, hiding one starting the day after until Show later cycles is chosen", async () => {
    const { history } = await openPage([weeks()], {
      path: "/releases?tab=cycles",
    });
    expect(rowTexts().map(startOf)).toEqual(["Last"]);
    await userEvent.click(screen.getByRole("button", { name: "Views" }));
    await userEvent.click(
      await screen.findByRole("menuitem", { name: "Show later cycles (1)" }),
    );
    await waitFor(() => {
      expect(rowTexts().map(startOf)).toEqual(["Last", "After"]);
    });
    expect(searchOf(history).get("later")).toBe("shown");
  });

  it("shows past and later cycles together once both are chosen, the timeline drawing them all", async () => {
    await openPage([fictionalStream()], {
      path: "/releases?tab=cycles&grouping=schedule&past=shown&later=shown",
    });
    expect(rowTexts().map((text) => text.slice(0, 4))).toEqual([
      "Fict",
      "27.1",
      "27.2",
      "27.3",
      "27.4",
    ]);
    expect(
      within(
        within(screen.getByRole("region", { name: "Timeline" })).getByRole(
          "list",
          { name: "Cycles of Fictional Majors" },
        ),
      )
        .getAllByRole("listitem")
        .map((item) => item.getAttribute("data-tip")?.slice(0, 4)),
    ).toEqual(["27.1", "27.2", "27.3", "27.4"]);
    await userEvent.click(
      screen.getByRole("button", { name: "Views, changed" }),
    );
    expect(
      (await screen.findAllByRole("menuitem"))
        .map(({ textContent }) => textContent)
        .filter((text) => text.startsWith("Show")),
    ).toEqual([
      "Show past cycles (1), chosen",
      "Show later cycles (1), chosen",
    ]);
  });

  it("saves a view showing past cycles among the Cycles tab's views", async () => {
    const saved = {
      id: "00000000-0000-4000-8000-0000000000a1",
      name: "Everything",
      scope: "personal",
      definition: { choices: { past: "shown" } },
      canChange: true,
      canShare: false,
    };
    const { fetch } = await openPage([fictionalStream()], {
      path: "/releases?tab=cycles&past=shown",
      answers: {
        "GET /api/views/cycles": () => Response.json([]),
        "POST /api/views/cycles": () =>
          Response.json({ view: saved, changeSetId: null }, { status: 201 }),
      },
    });
    await userEvent.click(
      screen.getByRole("button", { name: "Views, changed" }),
    );
    await userEvent.click(
      await screen.findByRole("menuitem", { name: "Save view…" }),
    );
    const dialog = await screen.findByRole("dialog", { name: "Save view" });
    expect(within(dialog).getByText("Past cycles")).toBeDefined();
    await userEvent.type(
      within(dialog).getByRole("textbox"),
      "Everything{Enter}",
    );
    await waitFor(() => {
      expect(bodyOf(fetch, "POST", "/api/views/cycles")).toEqual([
        {
          name: "Everything",
          scope: "personal",
          definition: { choices: { past: "shown" } },
        },
      ]);
    });
  });

  it("says when there are no cycles yet", async () => {
    serverAnswers({
      "GET /api/session": signedIn,
      "GET /api/release-streams": answer([
        fictionalStream({ patterns: [], cycles: [] }),
      ]),
    });
    renderApp("/releases?tab=cycles");
    expect(await screen.findByText("No cycles yet.")).toBeDefined();
  });
});

// Fictional Majors, shipping Fictional One with 27.2, and Fictional Minors, with no releases, each
// with cycles named as the other's.
const twoSchedules = () => [
  fictionalStream({
    releases: [
      fictionalRelease({ firstCycle: "2027-04-01", lastCycle: "2027-04-01" }),
    ],
  }),
  fictionalStream({ id: minorsId, name: "Fictional Minors" }),
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
    const freeze = (startsOn: string, endsOn: string) => ({
      startsOn,
      endsOn,
      name: "Freeze",
      months: [],
    });
    await openPage([
      fictionalStream({
        cycles: [
          freeze("2027-07-01", "2027-07-07"),
          freeze("2027-08-01", "2027-08-07"),
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
        fictionalStream({
          id: minorsId,
          name: "Fictional Minors",
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
    expect([
      within(grid()).queryByRole("textbox"),
      fetch.mock.calls.filter(
        ([, init]) => init?.method !== undefined && init.method !== "GET",
      ),
    ]).toEqual([null, []]);
  });
});

describe("a cycle's details", () => {
  it("show the table's values in its order, then its Duration, under the cycle named with its schedule", async () => {
    await openCycle([fictionalStream()]);
    const labels = [...cyclePanel().querySelectorAll("dt")].map(
      ({ textContent }) => textContent,
    );
    expect(labels).toEqual([
      "Cycle",
      "Schedule",
      "Starts",
      "Ends",
      "Current",
      "Release",
      "Duration",
    ]);
    expect(labels.map((label) => detailValue(label, cyclePanel()))).toEqual([
      "27.2",
      "Fictional Majors",
      "Apr 1, 2027",
      "Jun 30, 2027",
      "Current",
      "None",
      "3 months",
    ]);
    expect(panelHeading().textContent).toBe("Fictional Majors: 27.2");
  });

  it("say Not current for another cycle, and name its release", async () => {
    await openCycle(
      [
        fictionalStream({
          releases: [
            fictionalRelease({ colour: "grape", lastCycle: "2027-07-01" }),
          ],
        }),
      ],
      {},
      "2027-07-01",
    );
    expect(
      ["Current", "Release"].map((label) => detailValue(label, cyclePanel())),
    ).toEqual(["Not current", "Fictional One"]);
  });

  it("open from the address even while past cycles are hidden", async () => {
    await openCycle([fictionalStream()], {}, "2027-01-01");
    expect(panelHeading().textContent).toBe("Fictional Majors: 27.1");
  });

  it("close from Close details, putting focus back on the cycle's name in the table", async () => {
    const { history } = await openCycle([fictionalStream()]);
    await userEvent.click(
      screen.getByRole("button", { name: "Close details" }),
    );
    await waitFor(() => {
      expect(searchOf(history).has("open")).toBe(false);
      expect(document.activeElement).toBe(
        recordCell(cycleId("2027-04-01"), "name"),
      );
    });
  });

  it("open from a row's details button, keeping the tab", async () => {
    const { history } = await openPage([fictionalStream()]);
    await userEvent.click(
      screen.getByRole("button", {
        name: "Show details of Fictional Majors: 27.3",
      }),
    );
    await screen.findByRole("heading", { level: 2, name: cycleHeading });
    expect([
      searchOf(history).get("tab"),
      searchOf(history).get("open"),
    ]).toEqual(["cycles", cycleId("2027-07-01")]);
  });
});

describe("changing a cycle's Duration from its details", () => {
  const streamPath = `/api/release-streams/${streamId}`;
  const saved = () => Response.json({ stream: fictionalStream(), changeSetId });
  const durationPencil = () =>
    within(cyclePanel()).queryByRole("button", {
      name: "Change Duration of 27.2",
    });

  it("asks whether it is for this cycle only, drafting its new length", async () => {
    const { fetch } = await openCycle([fictionalStream()], {
      can: editsStreams,
      answers: { [`PUT ${streamPath}/cycles/2027-04-01/length`]: saved },
    });
    await userEvent.click(durationPencil() as HTMLElement);
    expect(
      (await screen.findAllByRole("menuitem")).map(
        ({ textContent }) => textContent,
      ),
    ).toEqual(["This cycle only…", "This and later cycles…"]);
    await userEvent.click(
      screen.getByRole("menuitem", { name: "This cycle only…" }),
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
    expect(
      fetch.mock.calls.filter(([, init]) => init?.method === "PUT"),
    ).toHaveLength(1);
  });

  it("or for it and later cycles, from it on", async () => {
    const { fetch } = await openCycle([fictionalStream()], {
      can: editsStreams,
      answers: { [`POST ${streamPath}/patterns`]: saved },
    });
    await userEvent.click(durationPencil() as HTMLElement);
    await userEvent.click(
      await screen.findByRole("menuitem", { name: "This and later cycles…" }),
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

  it.each([
    ["a role that doesn't change schedules", [fictionalStream()], {}, ""],
    [
      "a retired schedule",
      [fictionalStream({ retired: true })],
      editsStreams,
      "",
    ],
    [
      "a schedule drafted to be retired",
      [
        fictionalStream({
          retired: true,
          draft: recordDraft({ changed: ["retired"] }),
        }),
      ],
      editsStreams,
      "",
    ],
    [
      "a schedule someone else is changing",
      [fictionalStream({ heldBy: "Fictional Colleague" })],
      editsStreams,
      "",
    ],
    ["Live only", [fictionalStream()], editsStreams, "&show=live"],
  ] as const)("is read only for %s", async (_case, shown, can, view) => {
    await openCycle([...shown], { can, view });
    await screen.findByText("3 months");
    expect(durationPencil()).toBeNull();
  });

  it("is locked with a schedule someone else is changing", async () => {
    await openCycle([fictionalStream({ heldBy: "Fictional Colleague" })], {
      can: editsStreams,
    });
    expect(
      cyclePanel().querySelector(
        "[data-tip='Being changed by Fictional Colleague']",
      ),
    ).not.toBeNull();
  });

  it("is read only for a cycle a draft removes", async () => {
    const [first, second] = quarters(2) as [Cycle, Cycle];
    await openCycle(
      [
        fictionalStream({
          endsOn: "2027-03-31",
          draft: recordDraft({ changed: ["endsOn"], live: { endsOn: null } }),
          cycles: [first],
          liveCycles: [first, second],
        }),
      ],
      { can: editsStreams },
      "2027-04-01 removed",
    );
    await screen.findByText("3 months");
    expect(durationPencil()).toBeNull();
  });
});

describe("a cycle's drafts", () => {
  it("mark the values a draft of its schedule's cycles changes, with each as it is live, and the row for its Duration", async () => {
    await openPage([shortened()], bySchedule);
    expect(rowTexts()).toEqual([
      "Fictional Majors2 cycles",
      "27.2, DraftFictional MajorsApr 1, 2027May 31, 2027, Draft: changed from “Jun 30, 2027”, draft, live Jun 30, 2027Current",
      "27.3, DraftFictional MajorsJun 1, 2027, Draft: changed from “Jul 1, 2027”, draft, live Jul 1, 2027Sep 30, 2027",
    ]);
  });

  it("mark the Duration in the cycle's details, with its length as it is live", async () => {
    await openCycle([shortened()]);
    expect(
      ["Ends", "Duration"].map((label) => detailValue(label, cyclePanel())),
    ).toEqual([
      "May 31, 2027, Draft: changed from “Jun 30, 2027”Jun 30, 2027, live",
      "2 months, Draft: changed from “3 months”3 months, live",
    ]);
  });

  it("say in the row's menu what the draft is and what it changes", async () => {
    await openPage([shortened()], { can: editsStreams });
    expect(await rowMenuTexts("Fictional Majors: 27.2")).toEqual(
      expect.arrayContaining([
        "Part of a change to the cycles of Fictional Majors from 27.2",
        "Discard draft",
      ]),
    );
  });

  it("mark a cycle's Release that its release's own draft changes, saying so in the row's menu", async () => {
    const renamed = fictionalRelease({
      firstCycle: "2027-04-01",
      lastCycle: "2027-04-01",
      name: "Fictional New",
      draft: recordDraft({
        changed: ["name"],
        live: { name: "Fictional Old" },
      }),
    });
    await openPage([fictionalStream({ releases: [renamed] })], {
      can: editsStreams,
    });

    expect(recordCell(cycleId("2027-04-01"), "release")?.textContent).toContain(
      "Draft",
    );
    expect(await rowMenuTexts("Fictional Majors: 27.2")).toEqual(
      expect.arrayContaining(["Part of a change to Fictional New"]),
    );
  });

  it("are discarded from the row's menu, as the draft of the pattern behind the cycle", async () => {
    const { fetch } = await openPage([shortened()], {
      can: editsStreams,
      answers: {
        [`DELETE /api/records/cycle-pattern/${patternId}/draft`]: savedAs,
      },
    });
    await chooseRowAction("Fictional Majors: 27.3", "Discard draft");
    expect(await screen.findByText("Discarded the draft.")).toBeDefined();
    expect(
      fetch.mock.calls
        .filter(([, init]) => init?.method === "DELETE")
        .map(([url]) => url),
    ).toEqual([`/api/records/cycle-pattern/${patternId}/draft`]);
  });

  it("discard a release's own draft from a cycle's menu, as the release's draft", async () => {
    const renamed = fictionalRelease({
      firstCycle: "2027-04-01",
      lastCycle: "2027-04-01",
      draft: recordDraft({
        changed: ["name"],
        live: { name: "Fictional Old" },
      }),
    });
    const { fetch } = await openPage(
      [fictionalStream({ releases: [renamed] })],
      {
        can: { canEditReleases: true },
        answers: {
          [`DELETE /api/records/release/${renamed.id}/draft`]: savedAs,
        },
      },
    );

    await chooseRowAction("Fictional Majors: 27.2", "Discard draft");

    expect(await screen.findByText("Discarded the draft.")).toBeDefined();
    expect(
      fetch.mock.calls
        .filter(([, init]) => init?.method === "DELETE")
        .map(([url]) => url),
    ).toEqual([`/api/records/release/${renamed.id}/draft`]);
  });

  it.each([
    ["those who change releases", { canEditReleases: true }, true],
    ["those who change only schedules", editsStreams, false],
  ])(
    "offer a release's own draft in a cycle's menu to %s alone",
    async (_who, can, offered) => {
      const renamed = fictionalRelease({
        firstCycle: "2027-04-01",
        lastCycle: "2027-04-01",
        draft: recordDraft({
          changed: ["name"],
          live: { name: "Fictional Old" },
        }),
      });
      await openPage([fictionalStream({ releases: [renamed] })], { can });

      expect(
        (await rowMenuTexts("Fictional Majors: 27.2")).includes(
          "Discard draft",
        ),
      ).toBe(offered);
    },
  );

  it("are resubmitted from the row's menu once rejected", async () => {
    const rejected = shortened({
      patterns: [
        fictionalPattern(),
        fictionalPattern({
          id: patternId,
          startsOn: "2027-04-01",
          length: 2,
          draft: recordDraft({
            action: "created",
            state: "rejected",
            reason: "Fictional reason",
          }),
        }),
      ],
    });
    await openPage([rejected], {
      can: editsStreams,
      answers: {
        [`DELETE /api/records/cycle-pattern/${patternId}/draft/rejection`]:
          savedAs,
      },
    });
    await chooseRowAction("Fictional Majors: 27.2", "Resubmit");
    expect(await screen.findByText("Resubmitted the draft.")).toBeDefined();
  });

  it("are approved all at once from the Draft menu as one draft, though it changes several cycles", async () => {
    await openPage([shortened()], {
      answers: { "GET /api/session": approver },
    });
    await userEvent.click(screen.getByRole("button", { name: /^Draft/ }));
    await userEvent.click(
      await screen.findByRole("menuitem", { name: /^Approve/ }),
    );
    expect(
      await screen.findByRole("dialog", { name: "Approve 1 draft?" }),
    ).toBeDefined();
  });

  it("are approved from the row's menu, as the draft of the pattern behind the cycle", async () => {
    const { fetch } = await openPage([shortened()], {
      answers: {
        "GET /api/session": approver,
        "POST /api/drafts/approval": savedAs,
      },
    });
    await chooseRowAction("Fictional Majors: 27.2", "Approve draft");
    const dialog = await screen.findByRole("dialog", {
      name: "Approve 1 draft?",
    });
    await userEvent.click(
      within(dialog).getByRole("button", { name: "Approve" }),
    );
    await waitFor(() => {
      expect(bodyOf(fetch, "POST", "/api/drafts/approval")).toEqual([
        expect.objectContaining({
          records: [{ type: "cycle-pattern", id: patternId }],
        }),
      ]);
    });
  });

  describe("with the release's own draft changing the cycle too", () => {
    const releaseId = "30000000-0000-4000-8000-000000000001";
    // 27.2's release drafted to be renamed, besides the new pattern that shortens 27.2.
    const renamedToo = (release: Partial<RecordDraft> = {}) =>
      shortened({
        releases: [
          fictionalRelease({
            name: "Harbour",
            firstCycle: "2027-04-01",
            lastCycle: "2027-04-01",
            draft: recordDraft({
              changed: ["name"],
              live: { name: "Fictional One" },
              ...release,
            }),
          }),
        ],
      });

    const approvedBody = async (fetch: Parameters<typeof bodyOf>[0]) => {
      const dialog = await screen.findByRole("dialog", {
        name: /^Approve \d drafts?\?$/,
      });
      await userEvent.click(
        within(dialog).getByRole("button", { name: "Approve" }),
      );
      await waitFor(() => {
        expect(bodyOf(fetch, "POST", "/api/drafts/approval")).toHaveLength(1);
      });
      return bodyOf(fetch, "POST", "/api/drafts/approval");
    };

    async function approveFromRow(session: () => Response) {
      const { fetch } = await openPage([renamedToo()], {
        answers: {
          "GET /api/session": session,
          "POST /api/drafts/approval": savedAs,
        },
      });
      await chooseRowAction("Fictional Majors: 27.2", "Approve draft");
      return approvedBody(fetch);
    }

    // The release's rename waiting, and the new length's draft as given.
    const withLength = (
      draft: Partial<RecordDraft>,
      release: Partial<RecordDraft> = {},
    ) => ({
      ...renamedToo(release),
      patterns: [
        fictionalPattern(),
        fictionalPattern({
          id: patternId,
          startsOn: "2027-04-01",
          length: 2,
          draft: recordDraft({ action: "created", ...draft }),
        }),
      ],
    });
    const releaseAlone = [
      expect.objectContaining({
        records: [{ type: "release", id: releaseId }],
      }),
    ];

    it("are approved from the Draft menu as the release's draft alone once the new length is rejected", async () => {
      const { fetch } = await openPage([withLength({ state: "rejected" })], {
        answers: {
          "GET /api/session": approver,
          "POST /api/drafts/approval": savedAs,
        },
      });

      await userEvent.click(screen.getByRole("button", { name: /^Draft/ }));
      const menu = await screen.findByRole("menu");
      expect(within(menu).getByText("Waiting drafts")).toBeDefined();
      await userEvent.click(
        within(menu).getByRole("menuitem", { name: /^Approve/ }),
      );

      expect(await approvedBody(fetch)).toEqual(releaseAlone);
    });

    it.each([
      ["rejected", { state: "rejected" }, "Reject Harbour's draft…"],
      [
        "rejected, and the approver's own",
        { state: "rejected", needsOtherApprover: true },
        "Reject Harbour's draft…",
      ],
      ["the approver's own", { needsOtherApprover: true }, "Reject draft…"],
    ] as const)(
      "are approved from the row's menu as the release's draft alone, named, where the new length is %s",
      async (_case, draft, reject) => {
        const { fetch } = await openPage([withLength(draft)], {
          answers: {
            "GET /api/session": approver,
            "POST /api/drafts/approval": savedAs,
          },
        });

        expect(await rowMenuTexts("Fictional Majors: 27.2")).toEqual(
          expect.arrayContaining(["Approve Harbour's draft", reject]),
        );
        await userEvent.click(
          screen.getByRole("menuitem", { name: "Approve Harbour's draft" }),
        );

        expect(await approvedBody(fetch)).toEqual(releaseAlone);
      },
    );

    it.each([
      [
        "Draft menu",
        () => screen.getByRole("button", { name: /^Draft/ }),
        /^Reject /,
      ],
      [
        "row's menu",
        () =>
          within(grid()).getAllByRole("button", {
            name: "Actions for Fictional Majors: 27.2",
          })[0] as HTMLElement,
        "Reject Harbour's draft…",
      ],
    ])(
      "are rejected from the %s as the release's draft alone once the new length is rejected",
      async (_case, menuButton, item) => {
        const { fetch } = await openPage([withLength({ state: "rejected" })], {
          answers: {
            "GET /api/session": approver,
            "POST /api/drafts/rejection": savedAs,
          },
        });

        await userEvent.click(menuButton());
        await userEvent.click(
          await screen.findByRole("menuitem", { name: item }),
        );
        const dialog = await screen.findByRole("dialog", {
          name: "Reject 1 draft?",
        });
        await userEvent.type(
          within(dialog).getByRole("textbox", { name: "Reason" }),
          "Fictional reason",
        );
        await userEvent.click(
          within(dialog).getByRole("button", { name: "Reject" }),
        );

        await waitFor(() => {
          expect(bodyOf(fetch, "POST", "/api/drafts/rejection")).toEqual([
            expect.objectContaining({
              records: [{ type: "release", id: releaseId }],
            }),
          ]);
        });
      },
    );

    it("turn the row's Approve off, saying why, where both drafts are the approver's own", async () => {
      await openPage(
        [
          withLength(
            { needsOtherApprover: true },
            { needsOtherApprover: true },
          ),
        ],
        { answers: { "GET /api/session": approver } },
      );

      await rowMenuTexts("Fictional Majors: 27.2");
      const menu = screen.getByRole("menu");

      expect(
        within(menu)
          .getByRole("menuitem", { name: "Approve draft" })
          .hasAttribute("data-disabled"),
      ).toBe(true);
      expect(within(menu).getByText("Needs another approver")).toBeDefined();
    });

    it("are both approved from the row's menu", async () => {
      expect(await approveFromRow(approver)).toEqual([
        expect.objectContaining({
          records: [
            { type: "cycle-pattern", id: patternId },
            { type: "release", id: releaseId },
          ],
        }),
      ]);
    });

    it("leave the release's draft for a role that doesn't approve releases", async () => {
      const plansOnly = () =>
        Response.json({
          ...fictionalUser,
          permissions: ["plan:view", "features:view", "plan:approve"],
        });
      expect(await approveFromRow(plansOnly)).toEqual([
        expect.objectContaining({
          records: [{ type: "cycle-pattern", id: patternId }],
        }),
      ]);
    });
  });

  it("offer nothing to decide on a cycle no draft changes", async () => {
    await openPage([shortened()], {
      path: "/releases?tab=cycles&later=shown",
      answers: { "GET /api/session": approver },
    });
    expect(await rowMenuTexts("Fictional Majors: 27.4")).toEqual([
      "Fictional Majors: 27.4",
      "Show details",
    ]);
  });

  // Fictional Majors' 27.2 drafted to be cut into months, named by month: the first takes 27.2's
  // first day, the second is new, and 27.3 goes.
  const split = () => {
    const [first, second, third] = quarters(3) as [Cycle, Cycle, Cycle];
    return fictionalStream({
      patterns: [
        fictionalPattern(),
        fictionalPattern({
          id: patternId,
          startsOn: "2027-04-01",
          length: 1,
          naming: "{YY}.{MM}",
          draft: recordDraft({ action: "created" }),
        }),
      ],
      cycles: [
        first,
        { ...second, endsOn: "2027-04-30", name: "27.04" },
        {
          ...second,
          startsOn: "2027-05-01",
          endsOn: "2027-05-31",
          name: "27.05",
        },
      ],
      liveCycles: [first, second, third],
    });
  };

  it("mark a cycle a draft adds, one it removes, and one starting the same day as it is live renamed", async () => {
    await openPage([split()], {
      path: "/releases?tab=cycles&grouping=schedule&past=shown",
    });
    expect(rowTexts()).toEqual([
      "Fictional Majors4 cycles",
      "27.1Fictional MajorsJan 1, 2027Mar 31, 2027",
      "27.04, Draft: changed from “27.2”, Draft, draft, live 27.2Fictional MajorsApr 1, 2027Apr 30, 2027, Draft: changed from “Jun 30, 2027”, draft, live Jun 30, 2027, Draft: changed from “Current”, draft, live Current",
      "27.05, Draft: added, draftFictional Majors, draftMay 1, 2027, draftMay 31, 2027, draftCurrent, draft, draft",
      "27.3, Draft: removedFictional MajorsJul 1, 2027Sep 30, 2027",
    ]);
  });

  describe("Live rows", () => {
    const everyCycle = "/releases?tab=cycles&past=shown&later=shown";
    // The Live rows under drafted ones, as seen; assistive technology hears each changed cell's live
    // value instead.
    const liveRowTexts = () =>
      [...grid().querySelectorAll('tr[aria-hidden="true"]')].map(
        ({ textContent }) => textContent,
      );

    it("name a cycle a new length moves", async () => {
      // Given 27.3 drafted to start on Jun 1, so its identifier as it is live is another
      await openPage([shortened()], { path: everyCycle });

      // Then its Live row names it
      expect(liveRowTexts()).toContainEqual(
        expect.stringMatching(/^27\.3, live.*Jul 1, 2027/),
      );
      expect(liveRowTexts().join()).not.toContain(streamId);
    });

    it("name a cycle and its release as they are live, where drafts rename both", async () => {
      // Given 27.2 renamed 27.04, and its release renamed
      await openPage(
        [
          {
            ...split(),
            releases: [
              fictionalRelease({
                name: "Harbour",
                colour: "teal",
                firstCycle: "2027-04-01",
                lastCycle: "2027-04-01",
                draft: recordDraft({
                  changed: ["name"],
                  live: { name: "Fictional One" },
                }),
              }),
            ],
          },
        ],
        { path: everyCycle },
      );

      // Then its Live row names both as they are live
      expect(liveRowTexts()).toContainEqual(
        expect.stringMatching(/^27\.2, live.*Fictional One, live$/),
      );
      // And the release keeps its colour's square in both rows
      const renamedRow = within(grid())
        .getAllByRole("row")
        .find(({ textContent }) => textContent.startsWith("27.04"));
      const liveRow = grid().querySelector('tr[aria-hidden="true"]');
      expect(renamedRow?.querySelector('[data-colour="teal"]')).not.toBeNull();
      expect(liveRow?.querySelector('[data-colour="teal"]')).not.toBeNull();
    });

    it("name a cycle moved off a first day another drafted cycle now has", async () => {
      // Given 27.2 moved from Apr 1 to Feb 1, and 27.04 drafted to start on Apr 1
      const monthly = (name: string, startsOn: string, endsOn: string) => ({
        name,
        startsOn,
        endsOn,
        months: [],
      });
      await openPage(
        [
          fictionalStream({
            patterns: [
              fictionalPattern({
                draft: recordDraft({ changed: ["length"] }),
              }),
            ],
            cycles: [
              monthly("27.1", "2027-01-01", "2027-01-31"),
              monthly("27.2", "2027-02-01", "2027-02-28"),
              monthly("27.3", "2027-03-01", "2027-03-31"),
              monthly("27.04", "2027-04-01", "2027-04-30"),
            ],
            liveCycles: [
              monthly("27.1", "2027-01-01", "2027-03-31"),
              monthly("27.2", "2027-04-01", "2027-06-30"),
            ],
          }),
        ],
        { path: everyCycle },
      );

      // Then 27.2's Live row names it, not the cycle now starting on its old first day
      expect(liveRowTexts()).toContainEqual(
        expect.stringMatching(/^27\.2, live.*Apr 1, 2027/),
      );
    });
  });

  it("leave out a cycle a draft removes once drafts are applied", async () => {
    await openPage([split()], {
      path: "/releases?tab=cycles&grouping=schedule&past=shown&show=drafts",
    });
    expect(rowTexts().map((text) => text.slice(0, 5))).toEqual([
      "Ficti",
      "27.1F",
      "27.04",
      "27.05",
    ]);
  });

  it("say which change of a schedule's end is behind a cycle it cuts short", async () => {
    const [first, second] = quarters(2) as [Cycle, Cycle];
    await openPage(
      [
        fictionalStream({
          endsOn: "2027-05-31",
          draft: recordDraft({ changed: ["endsOn"], live: { endsOn: null } }),
          cycles: [first, { ...second, endsOn: "2027-05-31" }],
          liveCycles: [first, second],
        }),
      ],
      { can: editsStreams },
    );
    expect(await rowMenuTexts("Fictional Majors: 27.2")).toEqual(
      expect.arrayContaining([
        "Part of a change to when Fictional Majors ends",
      ]),
    );
  });

  it("leave out a schedule drafted to be removed once drafts are applied", async () => {
    await openPage(
      [
        fictionalStream({ draft: recordDraft({ action: "deleted" }) }),
        fictionalStream({ id: minorsId, name: "Fictional Minors" }),
      ],
      { path: "/releases?tab=cycles&grouping=schedule&show=drafts" },
    );
    expect(rowTexts()[0]).toBe("Fictional Minors2 cycles");
  });

  it("show a schedule only drafted to be added with every cycle added, none under Live only, where its cycles don't open", async () => {
    const added = fictionalStream({
      id: minorsId,
      name: "Fictional Minors",
      draft: recordDraft({ action: "created" }),
    });
    await openPage([fictionalStream(), added], {
      path: `/releases?tab=cycles&grouping=schedule&show=live&open=${encodeURIComponent(cycleId("2027-04-01", minorsId))}`,
    });
    expect(rowTexts()[0]).toBe("Fictional Majors2 cycles");
    expect(rowTexts()).toHaveLength(3);
    expect(
      screen.queryByRole("heading", { level: 2, name: /^Fictional Minors: / }),
    ).toBeNull();
  });
});

describe("the Cycles timeline", () => {
  const timeline = () => screen.getByRole("region", { name: "Timeline" });
  const lane = (name: string) =>
    within(timeline()).getByRole("list", { name: `Cycles of ${name}` });

  it("names each cycle shown, marks the current one, and puts each release's diamond on its ship day", async () => {
    await openPage([
      fictionalStream({
        releases: [
          fictionalRelease({
            firstCycle: "2027-04-01",
            lastCycle: "2027-04-01",
          }),
        ],
      }),
    ]);
    const items = within(lane("Fictional Majors")).getAllByRole("listitem");
    // Each name shows inside its block, and its words follow for assistive technology.
    expect(items.map(({ textContent }) => textContent)).toEqual([
      "27.227.2, Apr 1, 2027 to Jun 30, 2027, current",
      "27.327.3, Jul 1, 2027 to Sep 30, 2027",
      "Fictional One ships Jun 30, 2027",
    ]);
    // The current cycle is marked as today's, and its tip says so.
    expect(
      items.map((item) => [
        item.getAttribute("aria-current"),
        item.getAttribute("data-tip"),
      ]),
    ).toEqual([
      ["date", "27.2: Apr 1, 2027 to Jun 30, 2027, current"],
      [null, "27.3: Jul 1, 2027 to Sep 30, 2027"],
      [null, "Fictional One ships Jun 30, 2027"],
    ]);
  });

  it("draws past cycles, faded, once Show past cycles is on", async () => {
    await openPage([fictionalStream()], {
      path: "/releases?tab=cycles&past=shown",
    });
    const items = within(lane("Fictional Majors")).getAllByRole("listitem");
    expect(
      items.map((item) => [
        item.getAttribute("data-tip"),
        item.matches("[class*='timelineCyclePast']"),
      ]),
    ).toEqual([
      ["27.1: Jan 1, 2027 to Mar 31, 2027", true],
      ["27.2: Apr 1, 2027 to Jun 30, 2027, current", false],
      ["27.3: Jul 1, 2027 to Sep 30, 2027", false],
    ]);
  });

  it("draws the cycles shown as they are live under Live only", async () => {
    await openPage([shortened()], { path: "/releases?tab=cycles&show=live" });
    expect(
      within(lane("Fictional Majors"))
        .getAllByRole("listitem")
        .map((item) => item.getAttribute("data-tip")),
    ).toEqual([
      "27.2: Apr 1, 2027 to Jun 30, 2027, current",
      "27.3: Jul 1, 2027 to Sep 30, 2027",
    ]);
  });
});

describe("a cycle's features", () => {
  const inCycle = (name: string, at: number) =>
    fictionalFeature({
      id: `60000000-0000-4000-8000-00000000000${String(at)}`,
      name,
      targetStreamId: streamId,
      targetCycle: "2027-04-01",
    });
  const features = [
    inCycle("Fictional Export", 1),
    inCycle("Fictional Search", 2),
    inCycle("Fictional Sync", 3),
    inCycle("Fictional Maps", 4),
    inCycle("Fictional Voice", 5),
    inCycle("Fictional Fax", 6),
  ];
  const openWithFeatures = () =>
    openCycle([fictionalStream()], { answers: planAnswers(features) });
  // The Features row of the cycle's details, once the features are read.
  const featuresRow = async () => {
    await within(cyclePanel()).findByRole("button", {
      name: "Fictional Export",
    });
    return detailRow("Features", cyclePanel());
  };

  it("names them in one line in the table", async () => {
    await openWithFeatures();

    await waitFor(() => {
      expect(recordCell(cycleId("2027-04-01"), "features")?.textContent).toBe(
        "Fictional Export, Fictional Search, Fictional Sync, Fictional Maps, Fictional Voice, Fictional Fax",
      );
    });
    expect(recordCell(cycleId("2027-07-01"), "features")?.textContent).toBe("");
  });

  it("lists the first five one to a line in its details, and folds the rest", async () => {
    const user = userEvent.setup();
    await openWithFeatures();
    const row = await featuresRow();
    const links = () =>
      within(row)
        .getAllByRole("button")
        .map(({ textContent }) => textContent);

    expect(links()).toEqual([
      "Fictional Export",
      "Fictional Search",
      "Fictional Sync",
      "Fictional Maps",
      "Fictional Voice",
      "Show all (6)",
      "Show on Features",
      "Show on the Board",
    ]);

    await user.click(within(row).getByRole("button", { name: "Show all (6)" }));

    expect(links()).toContain("Fictional Fax");
  });

  it("opens a feature's details on Features", async () => {
    const user = userEvent.setup();
    const { history } = await openWithFeatures();

    await user.click(
      within(await featuresRow()).getByRole("button", {
        name: "Fictional Maps",
      }),
    );

    expect([history.location.pathname, searchOf(history).get("open")]).toEqual([
      "/features",
      "60000000-0000-4000-8000-000000000004",
    ]);
  });

  it.each([
    ["Show on Features", {}],
    [
      "Show on the Board",
      { mode: "board", stream: streamId, from: "2027-04-01" },
    ],
  ])("shows them with %s, filtered to the cycle", async (button, board) => {
    const user = userEvent.setup();
    const { history } = await openWithFeatures();

    await user.click(
      within(await featuresRow()).getByRole("button", { name: button }),
    );

    expect(featuresAddress(history)).toEqual({
      page: "/features",
      filters: { targetCycle: { any: [cycleId("2027-04-01")] } },
      board,
    });
  });

  it("says None for a cycle with no features", async () => {
    await openCycle([fictionalStream()], { answers: planAnswers([]) });

    await waitFor(() => {
      expect(detailValue("Features", cyclePanel())).toBe("None");
    });
  });
});

describe("links from a cycle", () => {
  const withRelease = () =>
    fictionalStream({
      releases: [
        fictionalRelease({ firstCycle: "2027-04-01", lastCycle: "2027-04-01" }),
      ],
    });
  it.each([
    [
      "Release",
      "Fictional One",
      { tab: null, open: "30000000-0000-4000-8000-000000000001" },
    ],
    ["Schedule", "Fictional Majors", { tab: "schedules", open: streamId }],
  ])(
    "opens what its %s row names, on its own tab",
    async (label, link, address) => {
      const user = userEvent.setup();
      const { history } = await openCycle([withRelease()]);

      await user.click(
        within(detailRow(label, cyclePanel())).getByRole("button", {
          name: link,
        }),
      );

      expect(openedIn(history)).toEqual(address);
    },
  );

  it("opens a cycle from its block on the timeline, and a release from its diamond", async () => {
    const user = userEvent.setup();
    const { history } = await openPage([withRelease()]);
    const timeline = () => screen.getByRole("region", { name: "Timeline" });

    await user.click(
      within(timeline()).getByRole("button", { name: /^27\.3, / }),
    );
    expect(openedIn(history)).toEqual({
      tab: "cycles",
      open: cycleId("2027-07-01"),
    });

    await user.click(
      within(timeline()).getByRole("button", { name: /^Fictional One ships / }),
    );
    expect(openedIn(history)).toEqual({
      tab: null,
      open: "30000000-0000-4000-8000-000000000001",
    });
  });

  it("opens a cycle from its block on the timeline with the keyboard", async () => {
    const user = userEvent.setup();
    const { history } = await openPage([withRelease()]);

    within(screen.getByRole("region", { name: "Timeline" }))
      .getByRole("button", { name: /^27\.3, / })
      .focus();
    await user.keyboard("{Enter}");

    expect(openedIn(history)).toEqual({
      tab: "cycles",
      open: cycleId("2027-07-01"),
    });
  });
});
