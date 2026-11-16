// SPDX-License-Identifier: Apache-2.0

// Tests for the Releases page's Releases tab: the table of releases, what it keeps in the address,
// shipped releases, a release's details and the changes made from them, its note, its row's menu,
// making a release, and what each role may do there.

import type { Release, ReleaseStream } from "@fathom/shared";
import { MantineProvider } from "@mantine/core";
import { render, screen, waitFor, within } from "@testing-library/react";
import { userEvent } from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ReleasesTable } from "./release-tab.tsx";
import type { SavedViews } from "./table-controls.tsx";
import { emptyView } from "./table-view.ts";
import {
  bodyOf,
  detailRow,
  detailValue,
  fictionalFeature,
  fictionalRelease,
  fictionalStream,
  fictionalUser,
  planAnswers,
  recordCell,
  recordDraft,
  renderApp,
  serverAnswers,
  signedIn,
  streamId,
  testTheme,
  featuresAddress,
} from "./test-support.tsx";

// No saved views, for the tab drawn on its own.
const noSavedViews: SavedViews = {
  views: [],
  unusable: [],
  applied: undefined,
  onApply: vi.fn(),
  onSave: vi.fn(),
  onRename: vi.fn(),
  onUpdate: vi.fn(),
  onDelete: vi.fn(),
  onDeleteUnusable: vi.fn(),
  onScope: vi.fn(),
};

beforeEach(() => {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(new Date("2027-02-15T12:00:00Z"));
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

type Answers = Parameters<typeof serverAnswers>[0];

const changeSetId = "00000000-0000-4000-8000-000000000001";
const savedAs = () => Response.json({ changeSetId });
const release = fictionalRelease();
const releasePath = `/api/release-streams/${streamId}/releases/${release.id}`;
const shippedId = "30000000-0000-4000-8000-000000000002";
const shipped = fictionalRelease({
  id: shippedId,
  name: "Fictional Shipped",
  shipsOn: "2027-02-01",
});
const editsReleases = { canEditReleases: true };
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
  (shown: ReleaseStream[], can: { canEditReleases?: boolean } = {}) =>
  () =>
    Response.json({
      streams: shown,
      canEditStreams: false,
      canEditReleases: false,
      ...can,
    });

// Opens the page at the address given, with the schedules given, and any other answers the test
// needs, once the table of releases shows.
async function openPage(
  shown: ReleaseStream[],
  {
    path = "/releases",
    can = {},
    answers = {},
  }: {
    path?: string;
    can?: { canEditReleases?: boolean };
    answers?: Answers;
  } = {},
) {
  const fetch = serverAnswers({
    "GET /api/session": signedIn,
    "GET /api/release-streams": answer(shown, can),
    ...answers,
  });
  const history = renderApp(path);
  await screen.findByRole("grid", { name: "Releases" });
  return { fetch, history };
}

// Opens the page with the release's details open.
async function openRelease(
  shown: ReleaseStream[],
  options: {
    path?: string;
    can?: { canEditReleases?: boolean };
    answers?: Answers;
  } = {},
) {
  const opened = await openPage(shown, {
    ...options,
    path: options.path ?? `/releases?open=${release.id}`,
  });
  await screen.findByRole("heading", { name: "Fictional One", level: 2 });
  return opened;
}

const inStream = (...releases: Release[]) => [fictionalStream({ releases })];
const releasePanel = () =>
  screen.getByRole("region", { name: "Fictional One" });
const searchOf = (history: { location: { search: string } }) =>
  new URLSearchParams(history.location.search);
// The rows of the table, after its header, as read.
const rowTexts = () =>
  within(screen.getByRole("grid", { name: "Releases" }))
    .getAllByRole("row")
    .slice(1)
    .map(({ textContent }) => textContent);
const detailsOf = (name: string) =>
  screen.findByRole("button", { name: `Show details of ${name}` });

// Chooses an item from the menu of a release's row, from the ⋯ beside its name.
async function chooseRowAction(name: string, item: string) {
  const [more] = within(
    screen.getByRole("grid", { name: "Releases" }),
  ).getAllByRole("button", { name: `Actions for ${name}` });
  await userEvent.click(more as HTMLElement);
  await userEvent.click(await screen.findByRole("menuitem", { name: item }));
}

describe("the Releases tab", () => {
  it("is the page's tab to start", async () => {
    await openPage(inStream(release));
    expect(
      screen
        .getByRole("tab", { name: "Releases" })
        .getAttribute("aria-selected"),
    ).toBe("true");
  });

  it("lists each release under its schedule, with the day it ships and its cycles", async () => {
    await openPage(inStream(fictionalRelease({ lastCycle: "2027-04-01" })));
    expect(rowTexts()).toEqual([
      "Fictional Majors1 release",
      "Fictional OneFictional MajorsJun 30, 202727.1 to 27.2",
    ]);
  });

  it("names each release's cycles alone, without their schedule, once the rows are not grouped by schedule", async () => {
    await openPage(inStream(release), { path: "/releases?grouping=none" });
    expect(rowTexts()).toEqual([
      "Fictional OneFictional MajorsMar 31, 202727.1",
    ]);
  });

  it("hides shipped releases until Show shipped is chosen in the Views menu, keeping the choice in the address", async () => {
    // Given a release to come and one shipped
    const { history } = await openPage(inStream(release, shipped));
    await detailsOf("Fictional One");
    expect(
      screen.queryByRole("button", {
        name: "Show details of Fictional Shipped",
      }),
    ).toBeNull();

    // When Show shipped is chosen
    await userEvent.click(screen.getByRole("button", { name: "Views" }));
    await userEvent.click(
      await screen.findByRole("menuitem", { name: "Show shipped (1)" }),
    );

    // Then the shipped release shows, said to be shipped, and the address keeps the choice
    await detailsOf("Fictional Shipped");
    expect(rowTexts()).toEqual([
      "Fictional Majors2 releases",
      "Fictional OneFictional MajorsMar 31, 202727.1",
      "Fictional ShippedFictional MajorsFeb 1, 202727.1Shipped",
    ]);
    expect(searchOf(history).get("shipped")).toBe("shown");
  });

  it("offers hiding shipped releases again while they show, though none has shipped", async () => {
    const { history } = await openPage(inStream(release), {
      path: "/releases?shipped=shown",
    });
    await userEvent.click(
      screen.getByRole("button", { name: "Views, changed" }),
    );
    await userEvent.click(
      await screen.findByRole("menuitem", {
        name: "Show shipped (0), chosen",
      }),
    );
    await waitFor(() => {
      expect(searchOf(history).has("shipped")).toBe(false);
    });
  });

  it("saves a view showing shipped releases among the Releases tab's views", async () => {
    const saved = {
      id: "00000000-0000-4000-8000-0000000000a1",
      name: "Everything",
      scope: "personal",
      definition: { choices: { shipped: "shown" } },
      canChange: true,
      canShare: false,
    };
    const { fetch } = await openPage(inStream(release, shipped), {
      path: "/releases?shipped=shown",
      answers: {
        "GET /api/views/releases": () => Response.json([]),
        "POST /api/views/releases": () =>
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
    expect(within(dialog).getByText("Shipped releases")).toBeDefined();
    await userEvent.type(
      within(dialog).getByRole("textbox"),
      "Everything{Enter}",
    );
    await waitFor(() => {
      expect(bodyOf(fetch, "POST", "/api/views/releases")).toEqual([
        {
          name: "Everything",
          scope: "personal",
          definition: { choices: { shipped: "shown" } },
        },
      ]);
    });
  });

  it("says when there are no releases yet", async () => {
    serverAnswers({
      "GET /api/session": signedIn,
      "GET /api/release-streams": answer([fictionalStream()]),
    });
    renderApp("/releases");
    expect(await screen.findByText("No releases yet.")).toBeDefined();
  });

  it("draws on its timeline only the schedules of the releases it shows", async () => {
    await openPage([
      ...inStream(release),
      fictionalStream({
        id: "10000000-0000-4000-8000-000000000002",
        name: "Fictional Minors",
        releases: [shipped],
      }),
    ]);
    const timeline = screen.getByRole("region", { name: "Timeline" });
    expect([
      within(timeline).queryByRole("list", {
        name: "Releases of Fictional Majors",
      }) !== null,
      within(timeline).queryByRole("list", {
        name: "Releases of Fictional Minors",
      }),
    ]).toEqual([true, null]);
  });
});

const minorsId = "10000000-0000-4000-8000-000000000002";
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
  fictionalStream({
    id: minorsId,
    name: "Fictional Minors",
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
    await openPage([
      ...inStream(release, third),
      fictionalStream({
        id: minorsId,
        name: "Fictional Minors",
        releases: [minor],
      }),
    ]);
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
    await openPage([
      ...inStream(spanning),
      fictionalStream({
        id: minorsId,
        name: "Fictional Minors",
        releases: [minor],
      }),
    ]);
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
    await openPage(twoSchedules());
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
    await openPage(twoSchedules());
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
    await openPage(twoSchedules(), { path: "/releases?grouping=none" });
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
      fetch.mock.calls.filter(
        ([, init]) => init?.method !== undefined && init.method !== "GET",
      ),
    ]).toEqual([null, []]);
  });
});

describe("the Releases page's address", () => {
  it("keeps the tab and the view when a release is opened", async () => {
    const { history } = await openPage(inStream(release), {
      path: "/releases?grouping=none",
    });
    await userEvent.click(await detailsOf("Fictional One"));
    await waitFor(() => {
      expect(searchOf(history).get("open")).toBe(release.id);
    });
    expect(searchOf(history).get("grouping")).toBe("none");
  });

  it("keeps the release open when the view changes", async () => {
    const { history } = await openRelease(inStream(release));
    await userEvent.click(
      screen.getByRole("button", { name: "Group by: Schedule" }),
    );
    await userEvent.click(
      await screen.findByRole("menuitem", { name: "None" }),
    );
    await waitFor(() => {
      expect(searchOf(history).get("grouping")).toBe("none");
    });
    expect(searchOf(history).get("open")).toBe(release.id);
  });

  it("starts the other tab afresh, with nothing open and its own view", async () => {
    const { history } = await openRelease(inStream(release), {
      path: `/releases?grouping=none&open=${release.id}`,
    });
    await userEvent.click(screen.getByRole("tab", { name: "Schedules" }));
    await screen.findByRole("grid", { name: "Schedules" });
    expect(history.location.search).toBe("?tab=schedules");
  });

  it("names no tab once back on Releases", async () => {
    serverAnswers({
      "GET /api/session": signedIn,
      "GET /api/release-streams": answer(inStream(release)),
    });
    const history = renderApp("/releases?tab=schedules&grouping=none");
    await screen.findByRole("grid", { name: "Schedules" });
    await userEvent.click(screen.getByRole("tab", { name: "Releases" }));
    await screen.findByRole("grid", { name: "Releases" });
    expect(history.location.search).toBe("");
  });

  it("keeps the Schedules tab when a schedule is opened", async () => {
    serverAnswers({
      "GET /api/session": signedIn,
      "GET /api/release-streams": answer(inStream(release)),
    });
    const history = renderApp("/releases?tab=schedules");
    await userEvent.click(await detailsOf("Fictional Majors"));
    await waitFor(() => {
      expect(searchOf(history).get("open")).toBe(streamId);
    });
    expect(searchOf(history).get("tab")).toBe("schedules");
  });

  it("opens a schedule's old address on the Schedules tab, with the schedule open", async () => {
    serverAnswers({
      "GET /api/session": signedIn,
      "GET /api/release-streams": answer(inStream(release)),
    });
    const history = renderApp(`/releases/${streamId}?grouping=none`);
    await screen.findByRole("heading", { name: "Fictional Majors", level: 2 });
    expect([
      history.location.pathname,
      Object.fromEntries(searchOf(history)),
    ]).toEqual([
      "/releases",
      { grouping: "none", tab: "schedules", open: streamId },
    ]);
  });
});

describe("a release's details", () => {
  it("show the table's values in its order, then its colour and note, with Not shipped for a release to come", async () => {
    await openRelease(
      inStream(fictionalRelease({ colour: "grape", note: "Fictional words" })),
    );
    const labels = [...releasePanel().querySelectorAll("dt")].map(
      ({ textContent }) => textContent,
    );
    expect(labels).toEqual([
      "Release",
      "Schedule",
      "Ships on",
      "Cycles",
      "Status",
      "Colour",
      "Note",
    ]);
    expect(
      labels.slice(0, -1).map((label) => detailValue(label, releasePanel())),
    ).toEqual([
      "Fictional One",
      "Fictional Majors",
      "Mar 31, 2027",
      "27.1",
      "Not shipped",
      "Grape",
    ]);
  });

  it("mark a value a draft changes, with the value as it is live under it", async () => {
    await openRelease(
      inStream(
        fictionalRelease({
          colour: "grape",
          draft: recordDraft({ changed: ["colour"], live: { colour: null } }),
        }),
      ),
    );
    expect(detailValue("Colour", releasePanel())).toBe(
      "Grape, Draft: changed from “Sea”Sea, live",
    );
  });

  it("mark the note when a draft changes it", async () => {
    await openRelease(
      inStream(
        fictionalRelease({
          note: "Fictional words",
          draft: recordDraft({ changed: ["note"], live: { note: null } }),
        }),
      ),
    );
    expect(detailValue("Note", releasePanel())).toBe("Fictional words, Draft");
  });

  it("open from the address even while shipped releases are hidden", async () => {
    await openPage(inStream(release, shipped), {
      path: `/releases?open=${shippedId}`,
    });
    expect(
      await screen.findByRole("heading", {
        name: "Fictional Shipped",
        level: 2,
      }),
    ).toBeDefined();
  });

  it("put focus on the release's name when they open", async () => {
    await openRelease(inStream(release));
    await waitFor(() => {
      expect(document.activeElement?.textContent).toBe("Fictional One");
    });
  });

  it("close from Close details, putting focus back on the release's name in the table", async () => {
    const { history } = await openRelease(inStream(release));
    await userEvent.click(
      screen.getByRole("button", { name: "Close details" }),
    );
    await waitFor(() => {
      expect(searchOf(history).has("open")).toBe(false);
      expect(document.activeElement).toBe(recordCell(release.id, "name"));
    });
  });
});

describe("changing a release from its details", () => {
  it.each([
    ["Release", "Rename Fictional One", ["Name"]],
    ["Ships on", "Change when Fictional One ships", ["Ships on"]],
    [
      "Cycles",
      "Change the cycles of Fictional One",
      ["First cycle", "Last cycle"],
    ],
    ["Colour", "Change the colour of Fictional One", ["Colour"]],
  ])(
    "asks only for the value changed from %s's pencil",
    async (label, title, fields) => {
      await openRelease(inStream(release), { can: editsReleases });
      await userEvent.click(
        within(releasePanel()).getByRole("button", { name: `Change ${label}` }),
      );
      const dialog = await screen.findByRole("dialog", { name: title });
      expect(
        [...dialog.querySelectorAll("label")].map(
          ({ textContent }) => textContent,
        ),
      ).toEqual(fields);
    },
  );

  it("drafts the change, saying so", async () => {
    const { fetch } = await openRelease(inStream(release), {
      can: editsReleases,
      answers: {
        [`PUT ${releasePath}`]: () =>
          Response.json({ stream: fictionalStream(), changeSetId }),
      },
    });
    await userEvent.click(
      within(releasePanel()).getByRole("button", { name: "Change Release" }),
    );
    const name = await screen.findByRole("textbox", { name: "Name" });
    await userEvent.clear(name);
    await userEvent.type(name, "Fictional Renamed{Enter}");
    expect(
      await screen.findByText("Drafted the change to the release."),
    ).toBeDefined();
    expect(bodyOf(fetch, "PUT", releasePath)).toEqual([
      {
        name: "Fictional Renamed",
        firstCycle: release.firstCycle,
        lastCycle: release.lastCycle,
        shipsOn: null,
        colour: null,
      },
    ]);
  });

  it.each([
    [
      "in a retired schedule",
      [fictionalStream({ retired: true, releases: [release] })],
      editsReleases,
      "",
    ],
    [
      "being changed by someone else",
      inStream(fictionalRelease({ heldBy: "Fictional Editor" })),
      editsReleases,
      "",
    ],
    [
      "drafted to be removed",
      inStream(fictionalRelease({ draft: recordDraft({ action: "deleted" }) })),
      editsReleases,
      "",
    ],
    ["shown as it is live", inStream(release), editsReleases, "&show=live"],
    ["to a role that doesn't change releases", inStream(release), {}, ""],
  ])("is not offered for a release %s", async (_, shown, can, view) => {
    await openRelease(shown, {
      can,
      path: `/releases?open=${release.id}${view}`,
    });
    expect(
      within(releasePanel()).queryByRole("button", { name: "Change Release" }),
    ).toBeNull();
  });
});

describe("a release's note", () => {
  const notePanel = () =>
    screen.findByRole("region", { name: "Note for Fictional One" });

  it("is added from its row's menu, opening the release's details and the note", async () => {
    const { history } = await openPage(inStream(release), {
      can: editsReleases,
    });
    await chooseRowAction("Fictional One", "Add note…");
    expect(await notePanel()).toBeDefined();
    expect(searchOf(history).get("open")).toBe(release.id);
  });

  it.each([
    ["once its release's details open", true, 1],
    ["when its release's details can't open now", false, 0],
  ] as const)(
    "is started from another release's menu %s",
    async (_, opens, started) => {
      const two = fictionalRelease({
        id: "30000000-0000-4000-8000-000000000003",
        name: "Fictional Two",
      });
      const start = vi.fn<(note: { name: string }) => void>();
      const shown = (open: string) => (
        <MantineProvider theme={testTheme}>
          <ReleasesTable
            streams={inStream(release, two)}
            day="2027-02-15"
            view={emptyView}
            onView={vi.fn()}
            approves={[]}
            saved={noSavedViews}
            canEdit
            narrow={false}
            open={open}
            onOpen={(_id, opened) => {
              if (opens) opened?.();
            }}
            onClose={vi.fn()}
            planned={undefined}
            onFeatures={vi.fn()}
            notes={{ start }}
            notePanel={undefined}
            onChange={vi.fn()}
            run={vi.fn()}
            decide={vi.fn()}
          />
        </MantineProvider>
      );
      const { rerender } = render(shown(release.id));
      await chooseRowAction("Fictional Two", "Add note…");
      rerender(shown(two.id));
      await screen.findByRole("heading", { name: "Fictional Two", level: 2 });
      expect(start.mock.calls.map(([note]) => note.name)).toEqual(
        Array.from({ length: started }, () => "Fictional Two"),
      );
    },
  );

  it("is added from the menu of the release already open", async () => {
    await openRelease(inStream(release), { can: editsReleases });
    await chooseRowAction("Fictional One", "Add note…");
    expect(await notePanel()).toBeDefined();
  });

  it("is drafted once written, saying so", async () => {
    const { fetch } = await openRelease(inStream(release), {
      can: editsReleases,
      answers: {
        [`PUT ${releasePath}/note`]: () =>
          Response.json({ stream: fictionalStream(), changeSetId }),
      },
    });
    await chooseRowAction("Fictional One", "Add note…");
    const opened = await notePanel();
    await userEvent.click(within(opened).getByText("Markdown"));
    await userEvent.type(
      within(opened).getByRole("textbox", { name: "Markdown" }),
      "Fictional words",
    );
    await userEvent.click(within(opened).getByRole("button", { name: "Save" }));
    expect(
      await screen.findByText("Drafted the note on Fictional One."),
    ).toBeDefined();
    expect(bodyOf(fetch, "PUT", `${releasePath}/note`)).toEqual([
      { note: "Fictional words" },
    ]);
  });

  it("is drafted to be removed once emptied, saying so", async () => {
    const { fetch } = await openRelease(
      inStream(fictionalRelease({ note: "Fictional words" })),
      {
        can: editsReleases,
        answers: {
          [`PUT ${releasePath}/note`]: () =>
            Response.json({ stream: fictionalStream(), changeSetId }),
        },
      },
    );
    await userEvent.click(
      within(releasePanel()).getByRole("button", { name: "Open Note" }),
    );
    const opened = await notePanel();
    await userEvent.click(await within(opened).findByText("Markdown"));
    await userEvent.clear(
      within(opened).getByRole("textbox", { name: "Markdown" }),
    );
    await userEvent.click(within(opened).getByRole("button", { name: "Save" }));
    expect(
      await screen.findByText("Drafted removing the note on Fictional One."),
    ).toBeDefined();
    expect(bodyOf(fetch, "PUT", `${releasePath}/note`)).toEqual([
      { note: null },
    ]);
  });

  it("is read only for a release that can't be changed now", async () => {
    await openRelease(inStream(fictionalRelease({ note: "Fictional words" })));
    await userEvent.click(
      within(releasePanel()).getByRole("button", { name: "Open Note" }),
    );
    const opened = await notePanel();
    await within(opened).findByRole("button", { name: "Close note" });
    expect(within(opened).queryByText("Markdown")).toBeNull();
  });

  it("is not offered from the menu of a release with one", async () => {
    await openPage(inStream(fictionalRelease({ note: "Fictional words" })), {
      can: editsReleases,
    });
    const [more] = within(
      screen.getByRole("grid", { name: "Releases" }),
    ).getAllByRole("button", { name: "Actions for Fictional One" });
    await userEvent.click(more as HTMLElement);
    const menu = await screen.findByRole("menu");
    await within(menu).findByRole("menuitem", { name: "Remove release" });
    expect(
      within(menu).queryByRole("menuitem", { name: "Add note…" }),
    ).toBeNull();
  });
});

describe("a release's row menu", () => {
  it("drafts removing the release, saying so", async () => {
    const { fetch } = await openPage(inStream(release), {
      can: editsReleases,
      answers: { [`DELETE ${releasePath}`]: savedAs },
    });
    await chooseRowAction("Fictional One", "Remove release");
    expect(
      await screen.findByText("Drafted removing Fictional One."),
    ).toBeDefined();
    expect(
      fetch.mock.calls
        .filter(([, init]) => init?.method === "DELETE")
        .map(([url]) => url),
    ).toEqual([releasePath]);
  });

  const draftPath = `/api/records/release/${release.id}/draft`;

  it("discards the release's draft", async () => {
    await openPage(inStream(fictionalRelease({ draft: recordDraft() })), {
      can: editsReleases,
      answers: { [`DELETE ${draftPath}`]: savedAs },
    });
    await chooseRowAction("Fictional One", "Discard draft");
    expect(await screen.findByText("Discarded the draft.")).toBeDefined();
  });

  it("resubmits the release's rejected draft", async () => {
    await openPage(
      inStream(
        fictionalRelease({
          draft: recordDraft({ state: "rejected", reason: "Fictional reason" }),
        }),
      ),
      {
        can: editsReleases,
        answers: { [`DELETE ${draftPath}/rejection`]: savedAs },
      },
    );
    await chooseRowAction("Fictional One", "Resubmit");
    expect(await screen.findByText("Resubmitted the draft.")).toBeDefined();
  });

  it("approves the release's draft", async () => {
    const { fetch } = await openPage(
      inStream(fictionalRelease({ draft: recordDraft() })),
      {
        answers: {
          "GET /api/session": approver,
          "POST /api/drafts/approval": savedAs,
        },
      },
    );
    await chooseRowAction("Fictional One", "Approve draft");
    const dialog = await screen.findByRole("dialog", {
      name: "Approve 1 draft?",
    });
    await userEvent.click(
      within(dialog).getByRole("button", { name: "Approve" }),
    );
    await waitFor(() => {
      expect(bodyOf(fetch, "POST", "/api/drafts/approval")).toEqual([
        expect.objectContaining({
          records: [{ type: "release", id: release.id }],
        }),
      ]);
    });
  });
});

describe("making a release", () => {
  const added = fictionalRelease({
    id: "30000000-0000-4000-8000-000000000003",
    name: "Fictional New",
    firstCycle: "2027-04-01",
    lastCycle: "2027-04-01",
  });

  it("makes a release in the schedule chosen, opening it once drafted", async () => {
    // Given a schedule that takes releases
    const { fetch, history } = await openPage(inStream(release), {
      can: editsReleases,
      answers: {
        [`POST /api/release-streams/${streamId}/releases`]: () =>
          Response.json({
            stream: fictionalStream({ releases: [release, added] }),
            changeSetId,
          }),
      },
    });

    // When a release is made in it
    await userEvent.click(screen.getByRole("button", { name: "New release" }));
    const dialog = await screen.findByRole("dialog", { name: "New release" });
    await userEvent.click(
      within(dialog).getByRole("combobox", { name: "Schedule" }),
    );
    await userEvent.click(
      await screen.findByRole("option", { name: "Fictional Majors" }),
    );
    await userEvent.type(
      within(dialog).getByRole("textbox", { name: "Name" }),
      "Fictional New",
    );
    await userEvent.click(
      within(dialog).getByRole("combobox", { name: "First cycle" }),
    );
    await userEvent.click(
      await screen.findByRole("option", { name: /^27\.2/ }),
    );
    await userEvent.click(
      within(dialog).getByRole("button", { name: "Make release" }),
    );

    // Then it is drafted, and opened
    expect(await screen.findByText("Drafted the new release.")).toBeDefined();
    await waitFor(() => {
      expect(searchOf(history).get("open")).toBe(added.id);
    });
    expect(
      bodyOf(fetch, "POST", `/api/release-streams/${streamId}/releases`),
    ).toEqual([
      {
        name: "Fictional New",
        firstCycle: "2027-04-01",
        lastCycle: "2027-04-01",
        shipsOn: null,
        colour: null,
      },
    ]);
  });

  it("offers only the schedules that take releases", async () => {
    await openPage(
      [
        fictionalStream({ releases: [release] }),
        fictionalStream({
          id: "10000000-0000-4000-8000-000000000002",
          name: "Fictional Retired",
          retired: true,
        }),
        fictionalStream({
          id: "10000000-0000-4000-8000-000000000003",
          name: "Fictional Removed",
          draft: recordDraft({ action: "deleted" }),
        }),
        fictionalStream({
          id: "10000000-0000-4000-8000-000000000004",
          name: "Fictional Empty",
          patterns: [],
          cycles: [],
        }),
      ],
      { can: editsReleases },
    );
    await userEvent.click(screen.getByRole("button", { name: "New release" }));
    const dialog = await screen.findByRole("dialog", { name: "New release" });
    await userEvent.click(
      within(dialog).getByRole("combobox", { name: "Schedule" }),
    );
    expect(
      (await screen.findAllByRole("option")).map(
        ({ textContent }) => textContent,
      ),
    ).toEqual(["Fictional Majors"]);
  });

  it("can't be done while no schedule has cycles", async () => {
    await openPage(
      [fictionalStream({ patterns: [], cycles: [], releases: [release] })],
      { can: editsReleases },
    );
    expect(
      screen
        .getByRole("button", { name: "New release" })
        .hasAttribute("disabled"),
    ).toBe(true);
  });

  it("is not offered to a role that doesn't change releases", async () => {
    await openPage(inStream(release));
    expect(screen.queryByRole("button", { name: "New release" })).toBeNull();
  });

  it("is not offered under Live only", async () => {
    await openPage(inStream(release), {
      can: editsReleases,
      path: "/releases?show=live",
    });
    expect(screen.queryByRole("button", { name: "New release" })).toBeNull();
  });

  it("says why it can't be done while only a retired schedule has cycles", async () => {
    await openPage([fictionalStream({ retired: true, releases: [release] })], {
      can: editsReleases,
    });
    await userEvent.hover(
      screen.getByRole("button", { name: "New release" })
        .parentElement as HTMLElement,
    );
    expect(
      await screen.findByText("No schedule takes new releases now"),
    ).toBeDefined();
  });
});

describe("a release's features", () => {
  const spanning = fictionalRelease({ lastCycle: "2027-04-01" });
  const inCycle = (name: string, targetCycle: string, at: number) =>
    fictionalFeature({
      id: `60000000-0000-4000-8000-00000000000${String(at)}`,
      name,
      targetStreamId: streamId,
      targetCycle,
    });
  const answers = planAnswers([
    inCycle("Fictional Sync", "2027-01-01", 1),
    inCycle("Fictional Maps", "2027-04-01", 2),
    inCycle("Fictional Later", "2027-07-01", 3),
  ]);
  // The Features row of the release's details, once the features are read.
  const section = async () => {
    await within(releasePanel()).findByRole("button", {
      name: "Fictional Sync",
    });
    return detailRow("Features", releasePanel());
  };

  it("names those in every cycle it spans, in one line in the table and one to a line in its details", async () => {
    await openRelease(inStream(spanning), { answers });

    const listed = await section();
    expect(
      within(listed)
        .getAllByRole("button")
        .map(({ textContent }) => textContent),
    ).toEqual([
      "Fictional Sync",
      "Fictional Maps",
      "Show on Features",
      "Show on the Board",
    ]);
    expect(recordCell(spanning.id, "features")?.textContent).toBe(
      "Fictional Sync, Fictional Maps",
    );
  });

  it.each([
    ["Show on Features", {}],
    [
      "Show on the Board",
      { mode: "board", stream: streamId, from: "2027-01-01" },
    ],
  ])("shows them with %s, filtered to the release", async (button, board) => {
    const user = userEvent.setup();
    const { history } = await openRelease(inStream(spanning), { answers });

    await user.click(
      within(await section()).getByRole("button", { name: button }),
    );

    expect(featuresAddress(history)).toEqual({
      page: "/features",
      filters: { release: { any: [`${streamId} ${spanning.id}`] } },
      board,
    });
  });

  it("opens a feature's details on Features", async () => {
    const user = userEvent.setup();
    const { history } = await openRelease(inStream(spanning), { answers });

    await user.click(
      within(await section()).getByRole("button", { name: "Fictional Sync" }),
    );

    expect([history.location.pathname, searchOf(history).get("open")]).toEqual([
      "/features",
      "60000000-0000-4000-8000-000000000001",
    ]);
  });
});
