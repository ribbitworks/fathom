// SPDX-License-Identifier: Apache-2.0

// Tests for the Releases page's Schedules tab: the table of schedules, each schedule's details and
// cycles, the changes made from them and from each row's menu, its drafts, the timeline above the
// table, and what each role may do there.

import type { Cycle, ReleaseStream, ReleaseStreams } from "@fathom/shared";
import { MantineProvider } from "@mantine/core";
import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import { userEvent } from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { TimelineView } from "./timeline-view.tsx";
import {
  bodyOf,
  detailRow,
  detailValue,
  featureDraft,
  fictionalFeature,
  fictionalPattern,
  fictionalRelease,
  fictionalStream,
  fictionalUser,
  noFeatureColumns,
  planAnswers,
  quarters,
  recordCell,
  recordDraft,
  renderApp,
  serverAnswers,
  signedIn,
  streamId,
  testTheme,
  featuresAddress,
  openedIn,
} from "./test-support.tsx";

afterEach(() => {
  vi.unstubAllGlobals();
});

const streams: ReleaseStreams = {
  canEditStreams: false,
  canEditReleases: false,
  streams: [
    {
      id: "s1",
      keyNumber: 1,
      name: "Fictional Majors",
      retired: false,
      cyclesUntil: "2028-12-31",
      endsOn: null,
      patterns: [
        {
          id: "p1",
          startsOn: "2027-01-01",
          length: 3,
          unit: "months",
          naming: "{YY}.{N}",
        },
      ],
      cycles: [
        {
          startsOn: "2027-01-01",
          endsOn: "2027-03-31",
          name: "27.1",
          months: [],
        },
        {
          startsOn: "2027-04-01",
          endsOn: "2027-06-30",
          name: "27.2",
          months: [],
        },
      ],
      releases: [
        {
          id: "r1",
          keyNumber: 1,
          name: "Fictional One",
          firstCycle: "2027-01-01",
          lastCycle: "2027-04-01",
          shipsOn: null,
          colour: null,
          note: null,
        },
      ],
    },
  ],
};

describe("the Releases page", () => {
  it("lists every stream for those who see the plan", async () => {
    serverAnswers({
      "GET /api/session": signedIn,
      "GET /api/release-streams": () => Response.json(streams),
    });
    renderApp("/releases?tab=schedules");
    expect(
      await screen.findByRole("button", {
        name: "Show details of Fictional Majors",
      }),
    ).toBeDefined();
    expect(screen.getByText("3 months")).toBeDefined();
  });

  it("opens a stream in its panel at its own address", async () => {
    serverAnswers({
      "GET /api/session": signedIn,
      "GET /api/release-streams": () => Response.json(streams),
    });
    renderApp("/releases/s1");
    expect(
      await screen.findByRole("heading", { name: "Fictional Majors" }),
    ).toBeDefined();
    expect(
      within(panel()).getByRole("region", { name: "Details" }),
    ).toBeDefined();
  });

  it("keeps the panel open when its edge is dragged to resize it", async () => {
    serverAnswers({
      "GET /api/session": signedIn,
      "GET /api/release-streams": () => Response.json(streams),
    });
    renderApp("/releases/s1");
    const edge = await screen.findByRole("separator", {
      name: "Resize the schedule's panel",
    });
    fireEvent.click(edge);
    expect(
      screen.getByRole("heading", { name: "Fictional Majors" }),
    ).toBeDefined();
  });
});

const answer =
  (
    shown: ReleaseStream[],
    can: { canEditStreams?: boolean; canEditReleases?: boolean } = {},
  ) =>
  () =>
    Response.json({
      streams: shown,
      canEditStreams: false,
      canEditReleases: false,
      ...can,
    });
const editsAll = { canEditStreams: true, canEditReleases: true };
const approver = () =>
  Response.json({
    ...fictionalUser,
    permissions: [
      "plan:view",
      "features:view",
      "plan:approve",
      "features:approve",
      "people:approve",
      "hiring-plan:approve",
      "configuration:approve",
    ],
  });
const changeSetId = "00000000-0000-4000-8000-000000000001";
const savedAs = () => Response.json({ changeSetId });
const streamPath = `/api/release-streams/${streamId}`;
const pattern = fictionalPattern();
const release = fictionalRelease();

type Answers = Parameters<typeof serverAnswers>[0];

// Opens the schedule's panel, with the streams given, and any other answers the test needs.
async function openStream(
  shown: ReleaseStream[],
  {
    can = {},
    answers = {},
  }: { can?: typeof editsAll | object; answers?: Answers } = {},
) {
  const fetch = serverAnswers({
    "GET /api/session": signedIn,
    "GET /api/release-streams": answer(shown, can),
    ...answers,
  });
  const history = renderApp(`/releases/${streamId}`);
  await screen.findByRole("heading", {
    name: (shown[0] as ReleaseStream).name,
    level: 2,
  });
  return { fetch, history };
}

const panel = () => screen.getByRole("region", { name: "Fictional Majors" });

// The record whose details the address opens, if any.
const openIn = (history: { location: { search: string } }) =>
  new URLSearchParams(history.location.search).get("open") ?? undefined;

// Opens the menu of the schedule's row in the table, from the ⋯ beside its Schedule cell.
async function openRowMenu() {
  const [more] = within(
    screen.getByRole("grid", { name: "Schedules" }),
  ).getAllByRole("button", { name: "Actions for Fictional Majors" });
  await userEvent.click(more as HTMLElement);
  return screen.findByRole("menu");
}

// Chooses an action from the menu of the schedule's row.
async function chooseRowAction(item: string) {
  await openRowMenu();
  await userEvent.click(await screen.findByRole("menuitem", { name: item }));
}

const streamsGrid = () => screen.findByRole("grid", { name: "Schedules" });
// The rows of the table, after its header, as read.
const rowTexts = () =>
  within(screen.getByRole("grid", { name: "Schedules" }))
    .getAllByRole("row")
    .slice(1)
    .map(({ textContent }) => textContent);
// A stream's cell in a column, by its row's name.
const cellOf = (name: string, column: number) =>
  within(
    screen
      .getByRole("button", { name: `Show details of ${name}` })
      .closest("tr") as HTMLElement,
  )
    .getAllByRole("gridcell")
    .at(column) as HTMLElement;
const detailsOf = (name: string) =>
  screen.findByRole("button", { name: `Show details of ${name}` });

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

function calls(fetch: ReturnType<typeof serverAnswers>, method: string) {
  return fetch.mock.calls
    .filter(([, init]) => init?.method === method)
    .map(([url]) => url);
}

describe("the Schedules table", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("shows each schedule's current cycle and its days, next release and its day, and how long cycles last", async () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date("2027-02-15T12:00:00Z"));
    serverAnswers({
      "GET /api/session": signedIn,
      "GET /api/release-streams": answer([
        fictionalStream({ releases: [release] }),
      ]),
    });
    renderApp("/releases?tab=schedules");
    await streamsGrid();
    expect(rowTexts()).toEqual([
      "Fictional Majors27.1Jan 1, 2027Mar 31, 2027Fictional OneMar 31, 20273 months",
    ]);
  });

  it("names the features of each schedule's current cycle, in one line in the table and one to a line in its details", async () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date("2027-02-15T12:00:00Z"));
    const targeting = (targetCycle: string, at: number) =>
      fictionalFeature({
        id: `60000000-0000-4000-8000-00000000000${String(at)}`,
        name: `Fictional Feature ${String(at)}`,
        targetStreamId: streamId,
        targetCycle,
      });
    serverAnswers({
      "GET /api/session": signedIn,
      "GET /api/release-streams": answer([fictionalStream()]),
      ...planAnswers([
        targeting("2027-01-01", 1),
        targeting("2027-01-01", 2),
        targeting("2027-04-01", 3),
      ]),
    });
    renderApp(`/releases?tab=schedules&open=${streamId}`);
    await streamsGrid();

    await waitFor(() => {
      expect(recordCell(streamId, "features")?.textContent).toBe(
        "Fictional Feature 1, Fictional Feature 2",
      );
    });
    expect(
      within(detailRow("Features this cycle"))
        .getAllByRole("button")
        .map(({ textContent }) => textContent),
    ).toEqual([
      "Fictional Feature 1",
      "Fictional Feature 2",
      "Show on Features",
      "Show on the Board",
    ]);
  });

  it.each([
    ["Fictional Feature 1", { page: "/features", filters: null, board: {} }],
    [
      "Show on Features",
      {
        page: "/features",
        filters: { targetCycle: { any: [`${streamId} 2027-01-01`] } },
        board: {},
      },
    ],
    [
      "Show on the Board",
      {
        page: "/features",
        filters: { targetCycle: { any: [`${streamId} 2027-01-01`] } },
        board: { mode: "board", stream: streamId, from: "2027-01-01" },
      },
    ],
  ])(
    "sends %s from a schedule's details to Features",
    async (button, address) => {
      vi.useFakeTimers({ toFake: ["Date"] });
      vi.setSystemTime(new Date("2027-02-15T12:00:00Z"));
      serverAnswers({
        "GET /api/session": signedIn,
        "GET /api/release-streams": answer([fictionalStream()]),
        ...planAnswers([
          fictionalFeature({
            name: "Fictional Feature 1",
            targetStreamId: streamId,
            targetCycle: "2027-01-01",
          }),
        ]),
      });
      const history = renderApp(`/releases?tab=schedules&open=${streamId}`);
      await streamsGrid();

      await userEvent.click(
        await within(detailRow("Features this cycle")).findByRole("button", {
          name: button,
        }),
      );

      expect(featuresAddress(history)).toEqual(address);
    },
  );

  it.each([
    [
      "Current cycle",
      "27.1",
      { tab: "cycles", open: `${streamId} 2027-01-01` },
    ],
    [
      "Next release",
      "Fictional One",
      { tab: null, open: "30000000-0000-4000-8000-000000000001" },
    ],
  ])(
    "opens what a schedule's %s row names, on its own tab",
    async (label, link, address) => {
      vi.useFakeTimers({ toFake: ["Date"] });
      vi.setSystemTime(new Date("2027-02-15T12:00:00Z"));
      serverAnswers({
        "GET /api/session": signedIn,
        "GET /api/release-streams": answer([
          fictionalStream({ releases: [fictionalRelease()] }),
        ]),
      });
      const history = renderApp(`/releases?tab=schedules&open=${streamId}`);
      await streamsGrid();

      await userEvent.click(
        await within(detailRow(label)).findByRole("button", { name: link }),
      );

      expect(openedIn(history)).toEqual(address);
    },
  );

  it.each([
    ["Show its releases", null],
    ["Show its cycles", "cycles"],
  ])("shows a schedule's own records with %s", async (button, tab) => {
    serverAnswers({
      "GET /api/session": signedIn,
      "GET /api/release-streams": answer([
        fictionalStream({ releases: [fictionalRelease()] }),
        fictionalStream({
          id: "10000000-0000-4000-8000-000000000002",
          name: "Fictional Minors",
          releases: [
            fictionalRelease({
              id: "30000000-0000-4000-8000-000000000002",
              name: "Fictional Other",
            }),
          ],
        }),
      ]),
    });
    const history = renderApp(`/releases?tab=schedules&open=${streamId}`);
    await streamsGrid();

    await userEvent.click(await screen.findByRole("button", { name: button }));

    const search = new URLSearchParams(history.location.search);
    expect([
      search.get("tab"),
      JSON.parse(search.get("filters") ?? "null"),
      search.get("open"),
    ]).toEqual([tab, { schedule: { any: [streamId] } }, null]);
    expect(
      within(
        await screen.findByRole("grid", {
          name: tab === null ? "Releases" : "Cycles",
        }),
      ).queryByText("Fictional Minors"),
    ).toBeNull();
  });

  it("opens a schedule from its name on the timeline, and a cycle from its block", async () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date("2027-02-15T12:00:00Z"));
    serverAnswers({
      "GET /api/session": signedIn,
      "GET /api/release-streams": answer([fictionalStream()]),
    });
    const history = renderApp("/releases?tab=schedules");
    await streamsGrid();
    const timeline = () => screen.getByRole("region", { name: "Timeline" });

    await userEvent.click(
      within(timeline()).getByRole("button", { name: "Fictional Majors" }),
    );
    expect(openedIn(history)).toEqual({ tab: "schedules", open: streamId });

    await userEvent.click(
      within(timeline()).getByRole("button", { name: /^27\.2, / }),
    );
    expect(openedIn(history)).toEqual({
      tab: "cycles",
      open: `${streamId} 2027-04-01`,
    });
  });

  it("says None for features this cycle once a schedule's cycles are over", async () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date("2028-06-15T12:00:00Z"));
    serverAnswers({
      "GET /api/session": signedIn,
      "GET /api/release-streams": answer([fictionalStream()]),
      ...planAnswers([
        fictionalFeature({
          targetStreamId: streamId,
          targetCycle: "2027-10-01",
        }),
      ]),
    });
    renderApp(`/releases?tab=schedules&open=${streamId}`);
    await streamsGrid();

    await waitFor(() => {
      expect(detailValue("Features this cycle")).toBe("None");
    });
  });

  it("leaves Features out for a role that can't see the plan", async () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date("2027-02-15T12:00:00Z"));
    serverAnswers({
      "GET /api/session": signedIn,
      "GET /api/release-streams": answer([fictionalStream()]),
      "GET /api/projects": () =>
        Response.json({ error: "No" }, { status: 403 }),
    });
    renderApp(`/releases?tab=schedules&open=${streamId}`);
    await streamsGrid();

    expect([
      screen.queryByRole("columnheader", { name: /Features this cycle/ }),
      [...panel().querySelectorAll("dt")].map(({ textContent }) => textContent),
    ]).toEqual([null, expect.not.arrayContaining(["Features this cycle"])]);
  });

  it("heads each column, Schedule first, each offering a filter of its kind from its menu", async () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date("2027-02-15T12:00:00Z"));
    serverAnswers({
      "GET /api/session": signedIn,
      "GET /api/release-streams": answer([
        fictionalStream({ releases: [release] }),
        fictionalStream({
          id: "s2",
          name: "Fictional Empty",
          patterns: [],
          cycles: [],
        }),
      ]),
    });
    renderApp("/releases?tab=schedules");
    const grid = await streamsGrid();
    const labels = within(grid)
      .getAllByRole("columnheader")
      .map(({ textContent }) => textContent)
      .filter((text) => text !== "Actions");
    expect(labels).toEqual([
      "Schedule",
      "Current cycle",
      "Cycle starts",
      "Cycle ends",
      "Next release",
      "Release date",
      "Cycle length",
      "Schedule ends",
    ]);
    const offered = [];
    for (const label of labels) {
      await chooseInColumn(label, "Filter…");
      const dialog = await screen.findByRole("dialog", {
        name: `Filter ${label}`,
      });
      offered.push(
        [
          ...within(dialog).queryAllByRole("textbox"),
          ...within(dialog).queryAllByRole("checkbox"),
        ].map((box) => (box as HTMLInputElement).labels?.[0]?.textContent),
      );
      await userEvent.keyboard("{Escape}");
      await waitFor(() => {
        expect(screen.queryByRole("dialog")).toBeNull();
      });
    }
    const days = ["From", "To", "No date", "Any date"];
    expect(offered).toEqual([
      ["Fictional Empty", "Fictional Majors"],
      ["27.1", "Empty", "Not empty"],
      days,
      days,
      ["Fictional One", "Empty", "Not empty"],
      days,
      ["3 months", "Empty", "Not empty"],
      days,
    ]);
  });

  it("leaves the cells of a schedule with no cycles blank", async () => {
    serverAnswers({
      "GET /api/session": signedIn,
      "GET /api/release-streams": answer([
        fictionalStream({ patterns: [], cycles: [] }),
      ]),
    });
    renderApp("/releases?tab=schedules");
    await streamsGrid();
    expect(rowTexts()).toEqual(["Fictional Majors"]);
  });

  it("sits under the Schedules tab, chosen, beside the heading", async () => {
    serverAnswers({
      "GET /api/session": signedIn,
      "GET /api/release-streams": answer([fictionalStream()]),
    });
    renderApp("/releases?tab=schedules");
    const tab = await screen.findByRole("tab", { name: "Schedules" });
    await userEvent.click(tab);
    expect([
      tab.getAttribute("aria-selected"),
      within(screen.getByRole("tabpanel", { name: "Schedules" })).getByRole(
        "grid",
        { name: "Schedules" },
      ),
    ]).toEqual(["true", expect.anything()]);
  });

  it("hides retired streams until Show retired is chosen in the Views menu, keeping the choice in the address", async () => {
    serverAnswers({
      "GET /api/session": signedIn,
      "GET /api/release-streams": answer([
        fictionalStream({ id: "s1", name: "Fictional Old", retired: true }),
        fictionalStream({ id: "s2", name: "Fictional New", patterns: [] }),
      ]),
    });
    const history = renderApp("/releases?tab=schedules");
    await detailsOf("Fictional New");
    expect(
      screen.queryByRole("button", { name: "Show details of Fictional Old" }),
    ).toBeNull();
    await userEvent.click(screen.getByRole("button", { name: "Views" }));
    await userEvent.click(
      await screen.findByRole("menuitem", { name: "Show retired (1)" }),
    );
    await detailsOf("Fictional Old");
    expect(rowTexts().map((text) => text.slice(0, 13))).toEqual([
      "Fictional Old",
      "Fictional New",
    ]);
    expect(history.location.search).toContain("retired=true");
  });

  it("saves a view showing retired streams, naming it under Includes, and applies it again", async () => {
    const saved = {
      id: "00000000-0000-4000-8000-0000000000a1",
      name: "Everything",
      scope: "personal",
      definition: { retired: true },
      canChange: true,
      canShare: false,
    };
    let views: object[] = [];
    const fetch = serverAnswers({
      "GET /api/session": signedIn,
      "GET /api/release-streams": answer([
        fictionalStream({ id: "s1", name: "Fictional Old", retired: true }),
        fictionalStream({ id: "s2", name: "Fictional New", patterns: [] }),
      ]),
      "GET /api/views/release-streams": () => Response.json(views),
      "POST /api/views/release-streams": () => {
        views = [saved];
        return Response.json(
          { view: saved, changeSetId: null },
          { status: 201 },
        );
      },
    });
    const history = renderApp("/releases?tab=schedules&retired=true");
    await userEvent.click(
      await screen.findByRole("button", { name: "Views, changed" }),
    );
    await userEvent.click(
      await screen.findByRole("menuitem", { name: "Save view…" }),
    );
    const dialog = await screen.findByRole("dialog", { name: "Save view" });
    expect(within(dialog).getByText("Retired schedules")).toBeDefined();
    await userEvent.type(
      within(dialog).getByRole("textbox"),
      "Everything{Enter}",
    );
    await waitFor(() => {
      expect(history.location.search).toContain(`view=${saved.id}`);
    });
    expect(bodyOf(fetch, "POST", "/api/views/release-streams")).toEqual([
      { name: "Everything", scope: "personal", definition: { retired: true } },
    ]);

    // Cleared, then applied again from the menu
    await userEvent.click(
      screen.getByRole("button", { name: "Views: Everything" }),
    );
    await userEvent.click(
      await screen.findByRole("menuitem", { name: "Clear view" }),
    );
    await waitFor(() => {
      expect(history.location.search).not.toContain("retired");
    });
    await userEvent.click(screen.getByRole("button", { name: "Views" }));
    await userEvent.click(
      await screen.findByRole("menuitem", { name: /^Everything/ }),
    );
    await waitFor(() => {
      expect(history.location.search).toContain("retired=true");
    });
  });

  it("offers only the hidden Key column in its Views menu while it would hold nothing else", async () => {
    serverAnswers({
      "GET /api/session": signedIn,
      "GET /api/release-streams": answer([fictionalStream()]),
    });
    renderApp("/releases?tab=schedules");
    await streamsGrid();
    await userEvent.click(screen.getByRole("button", { name: "Views" }));
    expect(
      (await screen.findAllByRole("menuitem")).map(
        ({ textContent }) => textContent,
      ),
    ).toEqual(["Key, show"]);
  });

  it("offers hiding retired streams again while they show, though none is retired any more", async () => {
    serverAnswers({
      "GET /api/session": signedIn,
      "GET /api/release-streams": answer([fictionalStream()]),
    });
    const history = renderApp("/releases?tab=schedules&retired=true");
    // Showing retired streams is something to save, so the button is marked.
    await userEvent.click(
      await screen.findByRole("button", { name: "Views, changed" }),
    );
    await userEvent.click(
      await screen.findByRole("menuitem", {
        name: "Show retired (0), chosen",
      }),
    );
    await waitFor(() => {
      expect(history.location.search).not.toContain("retired");
    });
  });

  it("shows how long cycles last today, leaving out changes of cycles drafted to be removed", async () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date("2027-08-15T12:00:00Z"));
    serverAnswers({
      "GET /api/session": signedIn,
      "GET /api/release-streams": answer([
        fictionalStream({
          patterns: [
            pattern,
            fictionalPattern({
              id: "20000000-0000-4000-8000-000000000002",
              startsOn: "2027-07-01",
              length: 1,
              unit: "weeks",
            }),
            fictionalPattern({
              id: "20000000-0000-4000-8000-000000000003",
              startsOn: "2027-08-01",
              draft: recordDraft({ action: "deleted" }),
            }),
          ],
        }),
      ]),
    });
    renderApp("/releases?tab=schedules");
    expect(await screen.findByText("1 week")).toBeDefined();
  });

  it("marks each stream's draft, saying when it retires the stream, which stays where it is live", async () => {
    const changing = (id: string, name: string, fields: object) =>
      fictionalStream({ id, name, draft: recordDraft(fields) });
    serverAnswers({
      "GET /api/session": signedIn,
      "GET /api/release-streams": answer([
        changing("s1", "Fictional A", { action: "created" }),
        {
          ...changing("s4", "Fictional D", { changed: ["retired"] }),
          retired: true,
        },
        changing("s5", "Fictional E", {
          changed: ["retired"],
          state: "rejected",
        }),
      ]),
    });
    renderApp("/releases?tab=schedules&retired=true");
    await detailsOf("Fictional E");
    expect(rowTexts().map((text) => text.replace(/3 months.*$/, ""))).toEqual([
      "Fictional A, Draft: added, draft, draft, draft, draft, draft, draft",
      "Fictional DRetired, Draft: retired",
      "Fictional E, Rejected, restored",
    ]);
  });

  it("says a stream's retirement is waiting under Live only", async () => {
    serverAnswers({
      "GET /api/session": signedIn,
      "GET /api/release-streams": answer([
        {
          ...fictionalStream({
            draft: recordDraft({ changed: ["retired"] }),
          }),
          retired: true,
        },
      ]),
    });
    renderApp("/releases?tab=schedules&show=live");
    await detailsOf("Fictional Majors");
    expect(cellOf("Fictional Majors", 0).textContent).toContain(
      "Live. Its retirement is waiting for approval.",
    );
  });

  it("marks only the cells whose values its parts' drafts change, with a Live row", async () => {
    serverAnswers({
      "GET /api/session": signedIn,
      "GET /api/release-streams": answer([
        fictionalStream({
          id: "s1",
          name: "Fictional Coloured",
          releases: [
            fictionalRelease({ draft: recordDraft({ changed: ["colour"] }) }),
          ],
        }),
        fictionalStream({
          id: "s2",
          name: "Fictional Removing",
          releases: [
            fictionalRelease({ draft: recordDraft({ action: "deleted" }) }),
          ],
        }),
      ]),
    });
    renderApp("/releases?tab=schedules");
    await detailsOf("Fictional Removing");
    const rowOf = (name: string) =>
      screen
        .getByRole("button", { name: `Show details of ${name}` })
        .closest("tr") as HTMLElement;
    expect([
      rowOf("Fictional Coloured").className,
      rowOf("Fictional Coloured").nextElementSibling?.getAttribute(
        "aria-hidden",
      ),
      cellOf("Fictional Coloured", 4).textContent,
      rowOf("Fictional Removing").className,
      rowOf("Fictional Removing").nextElementSibling?.textContent,
    ]).toEqual([
      expect.not.stringMatching(/draftRow/),
      null,
      "Fictional One",
      expect.stringMatching(/draftRow/),
      expect.stringContaining("Fictional One"),
    ]);
  });

  it("says a schedule had no cycle length in its Live row while a draft adds its first cycles", async () => {
    serverAnswers({
      "GET /api/session": signedIn,
      "GET /api/release-streams": answer([
        fictionalStream({
          patterns: [
            fictionalPattern({ draft: recordDraft({ action: "created" }) }),
          ],
        }),
      ]),
    });
    renderApp("/releases?tab=schedules");
    await detailsOf("Fictional Majors");
    const liveRow = cellOf("Fictional Majors", 0).closest("tr")
      ?.nextElementSibling as HTMLElement;
    expect(liveRow.textContent).toContain("No cycle length");
  });

  it("finds streams by any word in them", async () => {
    serverAnswers({
      "GET /api/session": signedIn,
      "GET /api/release-streams": answer([
        fictionalStream({ id: "s1", name: "Fictional Majors" }),
        fictionalStream({ id: "s2", name: "Fictional Patches" }),
      ]),
    });
    renderApp("/releases?tab=schedules");
    await detailsOf("Fictional Patches");
    await userEvent.type(
      screen.getByRole("textbox", { name: "Search schedules" }),
      "patch",
    );
    await waitFor(() => {
      expect(
        screen.queryByRole("button", {
          name: "Show details of Fictional Majors",
        }),
      ).toBeNull();
    });
    expect(screen.getByRole("status").textContent).toBe("1 of 2");
  });

  it("starts with no grouping, and groups schedules by status when asked, keeping it in the address", async () => {
    serverAnswers({
      "GET /api/session": signedIn,
      "GET /api/release-streams": answer([
        fictionalStream({ id: "s1", name: "Fictional Majors" }),
        fictionalStream({
          id: "s2",
          name: "Fictional Ended",
          endsOn: "2020-01-01",
        }),
      ]),
    });
    const history = renderApp("/releases?tab=schedules");
    await detailsOf("Fictional Ended");
    await userEvent.click(screen.getByRole("button", { name: "Group by" }));
    await userEvent.click(
      await screen.findByRole("menuitem", { name: "Status" }),
    );
    await waitFor(() => {
      expect(history.location.search).toContain("grouping=status");
    });
    expect(rowTexts().map((text) => text.slice(0, 13))).toEqual([
      "Current1 sche",
      "Fictional Maj",
      "Ended1 schedu",
      "Fictional End",
    ]);
  });

  it("approves every draft shown, of streams and what is in them, from the Draft menu", async () => {
    const drafted = recordDraft();
    const fetch = serverAnswers({
      "GET /api/session": approver,
      "GET /api/release-streams": answer([
        fictionalStream({
          name: "Fictional Renamed",
          draft: recordDraft({
            changed: ["name"],
            live: { name: "Fictional Majors" },
          }),
          patterns: [fictionalPattern({ draft: drafted })],
          releases: [
            fictionalRelease({ draft: recordDraft({ action: "deleted" }) }),
          ],
        }),
      ]),
      "POST /api/drafts/approve": () => Response.json({ approved: 3 }),
    });
    renderApp("/releases?tab=schedules");
    await detailsOf("Fictional Renamed");
    await userEvent.click(screen.getByRole("button", { name: /^Draft/ }));
    await userEvent.click(
      await screen.findByRole("menuitem", { name: /^Approve/ }),
    );
    expect(
      await screen.findByRole("dialog", { name: "Approve 3 drafts?" }),
    ).toBeDefined();
    expect(calls(fetch, "POST")).toEqual([]);
  });

  it("says when there are no streams yet", async () => {
    serverAnswers({
      "GET /api/session": signedIn,
      "GET /api/release-streams": answer([]),
    });
    renderApp("/releases?tab=schedules");
    expect(await screen.findByText("No schedules yet.")).toBeDefined();
  });

  it("says when the streams cannot be loaded, and loads them when tried again", async () => {
    let tries = 0;
    serverAnswers({
      "GET /api/session": signedIn,
      "GET /api/release-streams": () => {
        tries += 1;
        return tries === 1
          ? Response.json({ error: "Broken" }, { status: 500 })
          : answer([fictionalStream()])();
      },
    });
    renderApp("/releases?tab=schedules");
    await userEvent.click(
      await screen.findByRole("button", { name: "Try again" }),
    );
    expect(await detailsOf("Fictional Majors")).toBeDefined();
  });

  it("opens a schedule from the details button in its Schedule cell", async () => {
    serverAnswers({
      "GET /api/session": signedIn,
      "GET /api/release-streams": answer([fictionalStream()]),
    });
    const history = renderApp("/releases?tab=schedules");
    await userEvent.click(await detailsOf("Fictional Majors"));
    await waitFor(() => {
      expect(openIn(history)).toBe(streamId);
    });
  });
});

describe("a stream's panel", () => {
  it("says a stream is retired", async () => {
    await openStream([fictionalStream({ retired: true })]);
    expect(within(panel()).getByText("Retired")).toBeDefined();
  });

  it("offers viewers no changes, only links and ways to see its records", async () => {
    await openStream([fictionalStream({ releases: [release] })]);
    expect(
      within(panel())
        .queryAllByRole("button")
        .map(
          (button) => button.getAttribute("aria-label") ?? button.textContent,
        ),
    ).toEqual([
      "Close details",
      "Fictional One",
      "Show its releases",
      "Show its cycles",
    ]);
  });

  it.each([
    [
      "the close button",
      async () => {
        await userEvent.click(
          screen.getByRole("button", { name: "Close details" }),
        );
      },
    ],
    [
      "Escape",
      async () => {
        screen.getByRole("button", { name: "Close details" }).focus();
        await userEvent.keyboard("{Escape}");
      },
    ],
    [
      "a click on the page outside the table",
      async () => {
        await userEvent.click(
          screen.getByRole("heading", { name: "Releases", level: 1 }),
        );
      },
    ],
  ])(
    "closes with %s, putting focus on the schedule's Schedule cell",
    async (_case, close) => {
      const { history } = await openStream([fictionalStream()]);
      await close();
      await waitFor(() => {
        expect(openIn(history)).toBeUndefined();
        expect(document.activeElement).toBe(recordCell(streamId, "name"));
      });
    },
  );

  it("stays open when a key other than Escape is pressed in it", async () => {
    const { history } = await openStream([fictionalStream()]);
    screen.getByRole("button", { name: "Close details" }).focus();
    await userEvent.keyboard("{Shift}");
    expect(openIn(history)).toBe(streamId);
  });

  it("stays open when the search field is clicked, so what is typed goes there", async () => {
    const { history } = await openStream([fictionalStream()]);
    const search = screen.getByRole("textbox", {
      name: "Search schedules",
    });
    await userEvent.click(search);
    expect([openIn(history), document.activeElement]).toEqual([
      streamId,
      search,
    ]);
  });

  it("stays open when clicked inside", async () => {
    const { history } = await openStream([fictionalStream()]);
    await userEvent.click(within(panel()).getByText("Details"));
    expect(openIn(history)).toBe(streamId);
  });

  it("puts focus on the stream's name when it opens", async () => {
    await openStream([fictionalStream()]);
    await waitFor(() => {
      expect(document.activeElement).toBe(
        screen.getByRole("heading", { name: "Fictional Majors", level: 2 }),
      );
    });
  });

  it("fills the screen on narrow screens", async () => {
    vi.stubGlobal("matchMedia", (query: string) => ({
      matches: true,
      media: query,
      addEventListener: () => undefined,
      removeEventListener: () => undefined,
    }));
    await openStream([fictionalStream()]);
    expect(
      screen
        .getByRole("dialog", { name: "Fictional Majors" })
        .getAttribute("aria-modal"),
    ).toBe("true");
  });
});

describe("changing streams", () => {
  it("adds a stream, and opens it", async () => {
    const added = fictionalStream({
      id: "10000000-0000-4000-8000-000000000002",
      name: "Fictional Minors",
    });
    const fetch = serverAnswers({
      "GET /api/session": signedIn,
      "GET /api/release-streams": answer([fictionalStream()], editsAll),
      "POST /api/release-streams": () =>
        Response.json({ stream: added, changeSetId }),
    });
    const history = renderApp("/releases?tab=schedules");
    await userEvent.click(
      await screen.findByRole("button", { name: "New schedule" }),
    );
    const dialog = await screen.findByRole("dialog", {
      name: "New schedule",
    });
    await userEvent.type(
      within(dialog).getByRole("textbox", { name: "Name" }),
      "Fictional Minors",
    );
    await userEvent.click(
      within(dialog).getByRole("button", { name: "Add schedule" }),
    );
    expect(await screen.findByText("Drafted the new schedule.")).toBeDefined();
    await waitFor(() => {
      expect(openIn(history)).toBe(added.id);
    });
    expect(calls(fetch, "POST")).toEqual(["/api/release-streams"]);
  });

  it("renames a stream", async () => {
    await openStream([fictionalStream()], {
      can: editsAll,
      answers: {
        [`PUT ${streamPath}`]: () =>
          Response.json({ stream: fictionalStream(), changeSetId }),
      },
    });
    await userEvent.click(
      within(panel()).getByRole("button", { name: "Change Schedule" }),
    );
    const dialog = await screen.findByRole("dialog", {
      name: "Rename Fictional Majors",
    });
    await userEvent.click(within(dialog).getByRole("button", { name: "Save" }));
    expect(await screen.findByText("Drafted the new name.")).toBeDefined();
    await waitFor(() => {
      expect(screen.queryByRole("dialog")).toBeNull();
    });
  });

  it("closes a dialog when cancelled", async () => {
    await openStream([fictionalStream()], { can: editsAll });
    await userEvent.click(
      within(panel()).getByRole("button", { name: "Change Schedule" }),
    );
    const dialog = await screen.findByRole("dialog", {
      name: "Rename Fictional Majors",
    });
    await userEvent.click(
      within(dialog).getByRole("button", { name: "Cancel" }),
    );
    await waitFor(() => {
      expect(screen.queryByRole("dialog")).toBeNull();
    });
  });

  it("closes a dialog with Escape", async () => {
    await openStream([fictionalStream()], { can: editsAll });
    await userEvent.click(
      within(panel()).getByRole("button", { name: "Change Schedule" }),
    );
    await screen.findByRole("dialog", { name: "Rename Fictional Majors" });
    await userEvent.keyboard("{Escape}");
    await waitFor(() => {
      expect(screen.queryByRole("dialog")).toBeNull();
    });
  });

  it("drafts retiring a schedule from its row's menu", async () => {
    const { fetch } = await openStream([fictionalStream()], {
      can: editsAll,
      answers: {
        [`PUT ${streamPath}/retired`]: () =>
          Response.json({ stream: fictionalStream(), changeSetId }),
      },
    });
    await chooseRowAction("Retire");
    expect(
      await screen.findByText("Drafted retiring Fictional Majors."),
    ).toBeDefined();
    expect(
      fetch.mock.calls.find(([url]) => url === `${streamPath}/retired`)?.[1]
        ?.body,
    ).toBe(JSON.stringify({ retired: true }));
  });

  it("drafts restoring a retired schedule from its row's menu", async () => {
    // Given a retired schedule, shown with the retired ones
    serverAnswers({
      "GET /api/session": signedIn,
      "GET /api/release-streams": answer(
        [fictionalStream({ retired: true })],
        editsAll,
      ),
      [`PUT ${streamPath}/retired`]: () =>
        Response.json({ stream: fictionalStream(), changeSetId }),
    });
    renderApp("/releases?tab=schedules&retired=true");
    await detailsOf("Fictional Majors");

    // When Restore is chosen from its row's menu
    await chooseRowAction("Restore");

    // Then restoring it is drafted
    expect(
      await screen.findByText("Drafted restoring Fictional Majors."),
    ).toBeDefined();
  });

  it("says when a change could not be made", async () => {
    await openStream([fictionalStream()], {
      can: editsAll,
      answers: {
        [`PUT ${streamPath}/retired`]: () =>
          Response.json({ error: "Fictional refusal" }, { status: 409 }),
      },
    });
    await chooseRowAction("Retire");
    expect(await screen.findByText("Fictional refusal")).toBeDefined();
  });

  it("offers no changes to a stream someone else is changing", async () => {
    await openStream([fictionalStream({ heldBy: "Fictional Colleague" })], {
      can: editsAll,
    });
    expect([
      within(panel()).queryByRole("button", { name: /^Change / }),
      within(panel()).getByText(/being changed by Fictional Colleague/),
    ]).toEqual([null, expect.anything()]);
  });

  it("offers no renaming of a schedule drafted to be removed", async () => {
    await openStream(
      [fictionalStream({ draft: recordDraft({ action: "deleted" }) })],
      { can: editsAll },
    );
    expect(
      within(panel()).queryByRole("button", { name: "Change Schedule" }),
    ).toBeNull();
  });
});

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
      expect.stringMatching(/May 15, 2027.*No end date/),
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
        {
          startsOn: "2027-06-01",
          endsOn: "2027-06-30",
          name: "Freeze",
          months: [],
        },
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
      "GET /api/release-streams": answer([recut()]),
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
        "GET /api/release-streams": answer([stream], editsAll),
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

describe("the Draft menu", () => {
  const drafted = [
    fictionalStream({
      name: "Fictional Majors",
      draft: recordDraft({
        changed: ["name"],
        live: { name: "Fictional Earlier" },
      }),
    }),
    fictionalStream({
      id: "10000000-0000-4000-8000-000000000002",
      name: "Fictional Added",
      draft: recordDraft({ action: "created" }),
    }),
    fictionalStream({
      id: "10000000-0000-4000-8000-000000000003",
      name: "Fictional Back",
      retired: true,
      draft: recordDraft({ changed: ["retired"] }),
    }),
  ];
  const names = () =>
    within(screen.getByRole("grid", { name: "Schedules" }))
      .getAllByRole("button", { name: /^Show details of / })
      .map((button) =>
        button.getAttribute("aria-label")?.replace("Show details of ", ""),
      );
  const choose = async (name: string) => {
    await userEvent.click(
      screen.getByRole("button", { name: /^Draft(?!s of)/ }),
    );
    await userEvent.click(
      await screen.findByRole("menuitem", {
        name: (shown) => shown.startsWith(name),
      }),
    );
    await userEvent.keyboard("{Escape}");
  };

  it("shows the streams live alone, as their drafts make them, or beside live, keeping the choice in the address", async () => {
    serverAnswers({
      "GET /api/session": signedIn,
      "GET /api/release-streams": answer(drafted),
    });
    const history = renderApp("/releases?tab=schedules&show=live&retired=true");
    await detailsOf("Fictional Earlier");
    expect(names()).toEqual(["Fictional Earlier", "Fictional Back"]);
    expect(cellOf("Fictional Back", 0).textContent).not.toContain("Retired,");
    await choose("Drafts applied");
    await waitFor(() => {
      expect(history.location.search).toContain("show=drafts");
    });
    await detailsOf("Fictional Added");
    expect(names()).toEqual([
      "Fictional Majors",
      "Fictional Added",
      "Fictional Back",
    ]);
    expect(cellOf("Fictional Back", 0).textContent).toContain("Retired");
    await choose("Drafts & Live");
    await waitFor(() => {
      expect(history.location.search).not.toContain("show");
    });
  });

  it("keeps the choice in the address as a stream is opened", async () => {
    serverAnswers({
      "GET /api/session": signedIn,
      "GET /api/release-streams": answer(drafted),
    });
    const history = renderApp("/releases?tab=schedules&show=drafts");
    await userEvent.click(await detailsOf("Fictional Majors"));
    await waitFor(() => {
      expect(openIn(history)).toBe(streamId);
    });
    expect(history.location.search).toContain("show=drafts");
  });
});

describe("a schedule's draft in its row's menu", () => {
  const draftPath = `/api/records/release-stream/${streamId}/draft`;

  it("shows who made a draft, and closes the menu on a click beside its items", async () => {
    await openStream([fictionalStream({ draft: recordDraft() })]);
    const menu = await openRowMenu();
    await userEvent.click(within(menu).getByText(/by Fictional Editor$/));
    await waitFor(() => {
      expect(screen.queryByRole("menu")).toBeNull();
    });
  });

  it("discards a draft", async () => {
    const { fetch } = await openStream(
      [fictionalStream({ draft: recordDraft() })],
      { can: editsAll, answers: { [`DELETE ${draftPath}`]: savedAs } },
    );
    await chooseRowAction("Discard draft");
    expect(await screen.findByText("Discarded the draft.")).toBeDefined();
    expect(calls(fetch, "DELETE")).toEqual([draftPath]);
  });

  it("resubmits a rejected draft", async () => {
    const { fetch } = await openStream(
      [
        fictionalStream({
          draft: recordDraft({ state: "rejected", reason: "Fictional reason" }),
        }),
      ],
      {
        can: editsAll,
        answers: { [`DELETE ${draftPath}/rejection`]: savedAs },
      },
    );
    await chooseRowAction("Resubmit");
    expect(await screen.findByText("Resubmitted the draft.")).toBeDefined();
    expect(calls(fetch, "DELETE")).toEqual([`${draftPath}/rejection`]);
  });

  it("offers no discarding on a schedule whose only draft is a release's", async () => {
    // Given a schedule with no draft of its own, whose next release is drafted to be renamed
    await openStream(
      [
        fictionalStream({
          releases: [
            fictionalRelease({
              draft: recordDraft({
                changed: ["name"],
                live: { name: "Fictional Before" },
              }),
            }),
          ],
        }),
      ],
      { can: editsAll },
    );

    // Then its row's menu offers neither Discard draft nor Resubmit
    const menu = await openRowMenu();
    expect([
      within(menu).queryByRole("menuitem", { name: "Discard draft" }),
      within(menu).queryByRole("menuitem", { name: "Resubmit" }),
    ]).toEqual([null, null]);
  });

  it("offers no discarding of a draft someone else is changing, and says who", async () => {
    await openStream(
      [
        fictionalStream({
          draft: recordDraft(),
          heldBy: "Fictional Colleague",
        }),
      ],
      { can: editsAll },
    );
    const menu = await openRowMenu();
    expect([
      within(menu).queryByRole("menuitem", { name: "Discard draft" }),
      within(menu).getByText(/^Being changed by Fictional Colleague\./),
    ]).toEqual([null, expect.anything()]);
  });

  it("says only the user sees their unpublished draft", async () => {
    await openStream([
      fictionalStream({
        draft: recordDraft({ unpublished: true }),
      }),
    ]);
    await openRowMenu();
    expect(
      await screen.findByText(
        "Nobody else sees these changes until they're published.",
      ),
    ).toBeDefined();
  });

  it("names a feature's draft that approving includes", async () => {
    const featureId = "00000000-0000-4000-8000-0000000000f1";
    const stream = fictionalStream({
      draft: recordDraft({
        action: "changed",
        uses: [{ type: "feature", id: featureId }],
      }),
    });
    const { fetch } = await openStream([stream], {
      answers: {
        "GET /api/session": approver,
        "GET /api/projects": () =>
          Response.json({
            customers: [],
            projects: [],
            proposals: [],
            features: [
              {
                id: featureId,
                keyNumber: 1,
                name: "Fictional Moving",
                statusId: "s1",
                priorityId: null,
                sizeId: null,
                riskId: null,
                neededBy: null,
                staffed: false,
                staffedLive: false,
                customerIds: [],
                note: null,
                values: {},
                links: {},
                targetStreamId: streamId,
                targetCycle: "2027-07-01",
                estimateHours: null,
                featureTeamId: null,
                description: null,
                draft: featureDraft({ action: "changed" }),
              },
            ],
            canEdit: false,
            canEditFeatures: false,
            featureColumns: noFeatureColumns,
          }),
      },
    });
    await waitFor(() => {
      expect(fetch.mock.calls.map(([url]) => url)).toContain("/api/projects");
    });
    await chooseRowAction("Approve draft");
    const dialog = await screen.findByRole("dialog", {
      name: "Approve 2 drafts?",
    });
    expect(
      within(dialog).getByText("the feature Fictional Moving"),
    ).toBeDefined();
  });

  it("approves a draft with the drafts it uses", async () => {
    // Given a schedule's change that uses a change of its cycles only drafted to be added
    const stream = fictionalStream({
      draft: recordDraft({
        uses: [{ type: "cycle-pattern", id: pattern.id }],
      }),
      patterns: [
        fictionalPattern({ draft: recordDraft({ action: "created" }) }),
      ],
    });
    const { fetch } = await openStream([stream], {
      answers: {
        "GET /api/session": approver,
        "POST /api/drafts/approval": savedAs,
      },
    });
    await chooseRowAction("Approve draft");
    const dialog = await screen.findByRole("dialog", {
      name: "Approve 2 drafts?",
    });
    await userEvent.click(
      within(dialog).getByRole("button", { name: "Approve" }),
    );
    await waitFor(() => {
      expect(screen.queryByRole("dialog")).toBeNull();
    });
    expect(
      JSON.parse(
        fetch.mock.calls.find(([url]) => url === "/api/drafts/approval")?.[1]
          ?.body as string,
      ),
    ).toEqual(
      expect.objectContaining({
        records: [
          { type: "release-stream", id: streamId },
          { type: "cycle-pattern", id: pattern.id },
        ],
      }),
    );
  });

  it("approves only the schedule's own draft from its row, leaving its parts' drafts", async () => {
    // Given a renamed schedule whose cycles and release also have drafts
    const stream = fictionalStream({
      draft: recordDraft(),
      patterns: [fictionalPattern({ draft: recordDraft() })],
      releases: [fictionalRelease({ draft: recordDraft() })],
    });
    const { fetch } = await openStream([stream], {
      answers: {
        "GET /api/session": approver,
        "POST /api/drafts/approval": savedAs,
      },
    });

    // When Approve draft is chosen from its row's menu
    await chooseRowAction("Approve draft");
    const dialog = await screen.findByRole("dialog", {
      name: "Approve 1 draft?",
    });
    await userEvent.click(
      within(dialog).getByRole("button", { name: "Approve" }),
    );
    await waitFor(() => {
      expect(screen.queryByRole("dialog")).toBeNull();
    });

    // Then only the schedule's own draft is approved
    expect(bodyOf(fetch, "POST", "/api/drafts/approval")).toEqual([
      expect.objectContaining({
        records: [{ type: "release-stream", id: streamId }],
      }),
    ]);
  });

  it("offers no approval on a schedule's row whose only drafts are its parts'", async () => {
    await openStream(
      [
        fictionalStream({
          patterns: [fictionalPattern({ draft: recordDraft() })],
          releases: [fictionalRelease({ draft: recordDraft() })],
        }),
      ],
      { answers: { "GET /api/session": approver } },
    );
    const menu = await openRowMenu();
    expect([
      within(menu).queryByRole("menuitem", { name: "Approve draft" }),
      within(menu).queryByRole("menuitem", { name: "Reject draft…" }),
    ]).toEqual([null, null]);
  });

  it("asks before rejecting a draft, and closes when cancelled", async () => {
    await openStream([fictionalStream({ draft: recordDraft() })], {
      answers: { "GET /api/session": approver },
    });
    await chooseRowAction("Reject draft…");
    const dialog = await screen.findByRole("dialog", {
      name: "Reject 1 draft?",
    });
    await userEvent.click(
      within(dialog).getByRole("button", { name: "Cancel" }),
    );
    await waitFor(() => {
      expect(screen.queryByRole("dialog")).toBeNull();
    });
  });

  it("approves no draft that uses a rejected one, saying it waits for that one", async () => {
    // Given a schedule's change that uses a rejected change of its cycles
    const stream = fictionalStream({
      draft: recordDraft({
        uses: [{ type: "cycle-pattern", id: pattern.id }],
      }),
      patterns: [
        fictionalPattern({
          draft: recordDraft({ action: "created", state: "rejected" }),
        }),
      ],
    });
    const { fetch } = await openStream([stream], {
      answers: { "GET /api/session": approver },
    });

    // When approving it is chosen from its row's menu
    await chooseRowAction("Approve draft");

    // Then Fathom says it waits for the rejected one, and approves nothing
    expect(
      await screen.findByText(
        "Waiting for a rejected draft to be resubmitted.",
      ),
    ).toBeDefined();
    expect(calls(fetch, "POST")).toEqual([]);
  });

  it("offers no approval of a draft this account changed, but still rejecting it", async () => {
    const stream = fictionalStream({
      draft: recordDraft({ needsOtherApprover: true }),
    });
    await openStream([stream], { answers: { "GET /api/session": approver } });
    const menu = await openRowMenu();
    const approve = within(menu).getByRole("menuitem", {
      name: "Approve draft",
    });
    expect(
      approve.hasAttribute("disabled") ||
        approve.getAttribute("data-disabled") === "true",
    ).toBe(true);
    expect(within(menu).getByText("Needs another approver")).toBeDefined();
    expect(
      within(menu)
        .getByRole("menuitem", { name: "Reject draft…" })
        .hasAttribute("data-disabled"),
    ).toBe(false);
  });

  it("closes only the row's menu with Escape, keeping the panel open", async () => {
    const { history } = await openStream([
      fictionalStream({ draft: recordDraft() }),
    ]);
    await openRowMenu();
    await userEvent.keyboard("{Escape}");
    await waitFor(() => {
      expect(screen.queryByRole("menu")).toBeNull();
    });
    expect(openIn(history)).toBe(streamId);
  });

  it("moves through the row menu's items with the arrow keys, keeping the panel open", async () => {
    const { history } = await openStream(
      [fictionalStream({ draft: recordDraft() })],
      { can: editsAll },
    );
    await openRowMenu();
    await userEvent.keyboard("{ArrowDown}{ArrowDown}");
    expect([
      document.activeElement?.getAttribute("role"),
      openIn(history),
    ]).toEqual(["menuitem", streamId]);
  });
});

describe("the timeline", () => {
  // The view leaves 540 pixels for the tracks beside the streams' names, and the tests start at
  // Month, which shows 180 days across them: three pixels a day.
  const room = 540;
  // The streams' names' column beside the tracks.
  const names = 180;
  let viewWidth = names + room;
  beforeEach(() => {
    viewWidth = names + room;
    localStorage.setItem(zoomKey, '"month"');
    vi.spyOn(HTMLElement.prototype, "clientWidth", "get").mockImplementation(
      () => viewWidth,
    );
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
    vi.unstubAllEnvs();
    localStorage.removeItem(zoomKey);
  });

  const zoomKey = "fathom-releases-timeline-zoom";

  it("draws only the streams the table shows, as the view narrows them", async () => {
    const timeline = await showTimeline(
      [
        fictionalStream({ id: "s1", name: "Fictional Old" }),
        fictionalStream({ id: "s2", name: "Fictional New" }),
      ],
      "2027-02-15",
      "?search=New",
    );
    expect(
      within(timeline).getByRole("list", { name: "Cycles of Fictional New" }),
    ).toBeDefined();
    expect(
      within(timeline).queryByRole("list", { name: "Cycles of Fictional Old" }),
    ).toBeNull();
  });

  // The schedules the timeline draws, in its order.
  const lanes = (timeline: HTMLElement) =>
    within(timeline)
      .getAllByRole("list", { name: /^Cycles of / })
      .map((list) => list.getAttribute("aria-label"));
  const oldAndNew = [
    fictionalStream({
      id: "s1",
      name: "Fictional Old",
      cycles: quarters(2),
      endsOn: "2027-06-30",
    }),
    fictionalStream({ id: "s2", name: "Fictional New" }),
  ];

  it("draws only the schedules a filter on the Schedule column leaves, as the table does", async () => {
    const timeline = await showTimeline(oldAndNew, "2027-02-15");
    await chooseInColumn("Schedule", "Filter…");
    const dialog = await screen.findByRole("dialog", {
      name: "Filter Schedule",
    });
    await userEvent.click(
      within(dialog).getByRole("checkbox", { name: "Fictional Old" }),
    );
    await waitFor(() => {
      expect(rowTexts().map((text) => text.slice(0, 13))).toEqual([
        "Fictional Old",
      ]);
    });
    expect(lanes(timeline)).toEqual(["Cycles of Fictional Old"]);
  });

  it("draws only the schedules a filter on Schedule ends leaves, as the table does", async () => {
    const timeline = await showTimeline(oldAndNew, "2027-02-15");
    await chooseInColumn("Schedule ends", "Filter…");
    const dialog = await screen.findByRole("dialog", {
      name: "Filter Schedule ends",
    });
    await userEvent.click(
      within(dialog).getByRole("checkbox", { name: "No date" }),
    );
    await waitFor(() => {
      expect(rowTexts().map((text) => text.slice(0, 13))).toEqual([
        "Fictional New",
      ]);
    });
    expect(lanes(timeline)).toEqual(["Cycles of Fictional New"]);
  });

  it("draws retired schedules while the table shows them, in the table's order", async () => {
    const timeline = await showTimeline(
      [
        fictionalStream({ id: "s2", name: "Fictional New" }),
        fictionalStream({ id: "s1", name: "Fictional Old", retired: true }),
      ],
      "2027-02-15",
      '?retired=true&sort=["-name"]',
    );
    await waitFor(() => {
      expect(rowTexts().map((text) => text.slice(0, 13))).toEqual([
        "Fictional Old",
        "Fictional New",
      ]);
    });
    expect(lanes(timeline)).toEqual([
      "Cycles of Fictional Old",
      "Cycles of Fictional New",
    ]);
  });

  async function showTimeline(
    shown: ReleaseStream[],
    today: string,
    view = "",
    tab: "schedules" | "releases" = "schedules",
  ) {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date(`${today}T12:00:00Z`));
    serverAnswers({
      "GET /api/session": signedIn,
      "GET /api/release-streams": answer(shown),
    });
    renderApp(`/releases?tab=${tab}${view.replace("?", "&")}`);
    return screen.findByRole("region", { name: "Timeline" });
  }

  const items = (timeline: HTMLElement, list: string) =>
    within(within(timeline).getByRole("list", { name: list })).getAllByRole(
      "listitem",
    );

  const view = (timeline: HTMLElement) =>
    within(timeline).getByRole("group", { name: "Timeline" });

  const widths = (timeline: HTMLElement) =>
    items(timeline, "Cycles of Fictional Majors").map(
      ({ style }) => style.width,
    );

  it("draws each cycle at its real length, with its dates", async () => {
    const timeline = await showTimeline([fictionalStream()], "2027-02-15");
    const cycles = items(timeline, "Cycles of Fictional Majors");
    expect(cycles.map((cycle) => cycle.getAttribute("data-tip"))).toEqual([
      "27.1: Jan 1, 2027 to Mar 31, 2027",
      "27.2: Apr 1, 2027 to Jun 30, 2027",
      "27.3: Jul 1, 2027 to Sep 30, 2027",
      "27.4: Oct 1, 2027 to Dec 31, 2027",
    ]);
    expect(
      within(cycles[0] as HTMLElement).getByText(
        "27.1, Jan 1, 2027 to Mar 31, 2027",
      ),
    ).toBeDefined();
    // Three pixels a day: 90 days in the first quarter, 91 in the second.
    expect(cycles.map(({ style }) => [style.left, style.width])).toEqual([
      ["0px", "270px"],
      ["270px", "273px"],
      ["543px", "276px"],
      ["819px", "276px"],
    ]);
  });

  it("draws the Schedules tab's cycles unnamed, with each schedule's end", async () => {
    const timeline = await showTimeline(
      [fictionalStream({ endsOn: "2027-12-31" })],
      "2027-02-15",
    );
    const lane = items(timeline, "Cycles of Fictional Majors");
    // Each cycle's name is only for assistive technology, and its title.
    expect(
      lane.map((item) => item.querySelector("[aria-hidden]")?.textContent),
    ).toEqual([undefined, undefined, undefined, undefined, undefined]);
    expect(lane.map(({ textContent }) => textContent)).toEqual([
      "27.1, Jan 1, 2027 to Mar 31, 2027",
      "27.2, Apr 1, 2027 to Jun 30, 2027",
      "27.3, Jul 1, 2027 to Sep 30, 2027",
      "27.4, Oct 1, 2027 to Dec 31, 2027",
      "Ends Dec 31, 2027",
    ]);
    expect(
      within(timeline).queryByRole("list", {
        name: "Releases of Fictional Majors",
      }),
    ).toBeNull();
  });

  it("spans each release across its cycles, marked on the day it ships", async () => {
    const timeline = await showTimeline(
      [
        fictionalStream({
          releases: [
            fictionalRelease({ lastCycle: "2027-04-01" }),
            fictionalRelease({
              id: "30000000-0000-4000-8000-000000000002",
              name: "Fictional Two",
              firstCycle: "2027-07-01",
              lastCycle: "2027-07-01",
              shipsOn: "2027-08-14",
              draft: recordDraft(),
            }),
          ],
        }),
      ],
      "2027-02-15",
      "",
      "releases",
    );
    const releases = items(timeline, "Releases of Fictional Majors");
    // Each release's words are its tip in the timeline's one tooltip, which a draft's dot inside it
    // takes over while pointed at, so only one tip shows.
    expect(releases.map((item) => item.hasAttribute("title"))).toEqual([
      false,
      false,
    ]);
    expect(releases.map((item) => item.getAttribute("data-tip"))).toEqual([
      "Fictional One: 27.1 to 27.2, ships 2027-06-30.",
      "Fictional Two: 27.3, ships 2027-08-14. Draft.",
    ]);
    expect(
      releases[1]
        ?.querySelector("[aria-hidden] [data-tip]")
        ?.getAttribute("data-tip"),
    ).toBe("Draft");
    const [one, two] = releases.map((item) =>
      [...item.querySelectorAll<HTMLElement>(":scope > [aria-hidden]")].map(
        ({ style }) => [style.left, style.width],
      ),
    );
    // The first ships when its last cycle ends; the second's marker is 46 days before 27.3 ends,
    // with a line back to it from that end.
    expect(one).toEqual([
      ["0px", "543px"],
      ["543px", ""],
    ]);
    expect(two).toEqual([
      ["0px", "276px"],
      ["135px", "141px"],
      ["135px", ""],
    ]);
  });

  it("draws each release in its colour, or sea when it has none", async () => {
    const timeline = await showTimeline(
      [
        fictionalStream({
          releases: [
            fictionalRelease(),
            fictionalRelease({
              id: "30000000-0000-4000-8000-000000000002",
              name: "Fictional Two",
              firstCycle: "2027-07-01",
              lastCycle: "2027-07-01",
              colour: "grape",
            }),
          ],
        }),
      ],
      "2027-02-15",
      "",
      "releases",
    );
    expect(
      items(timeline, "Releases of Fictional Majors").map(({ style }) =>
        style.getPropertyValue("--release-filled"),
      ),
    ).toEqual([
      "var(--mantine-color-sea-filled)",
      "var(--mantine-color-grape-filled)",
    ]);
  });

  it("marks today across every stream", async () => {
    const timeline = await showTimeline(
      [
        fictionalStream(),
        fictionalStream({ id: "s2", name: "Fictional Minors" }),
      ],
      "2027-02-15",
    );
    expect(
      within(timeline)
        .getAllByRole("list", { name: /^Cycles of/ })
        .map((list) => list.getAttribute("aria-label")),
    ).toEqual(["Cycles of Fictional Majors", "Cycles of Fictional Minors"]);
    expect(
      within(timeline).getByText(
        (_, element) => element?.textContent === "Today, 2027-02-15",
        { selector: "span" },
      ),
    ).toBeDefined();
  });

  it("marks today in Fathom's time zone, not the reader's own", async () => {
    // Late on 15 February for a reader in Los Angeles is already the 16th in Tokyo.
    vi.stubEnv("TZ", "America/Los_Angeles");
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date(2027, 1, 15, 23, 30));
    serverAnswers({
      "GET /api/session": () =>
        Response.json({
          ...fictionalUser,
          settings: { ...fictionalUser.settings, timeZone: "Asia/Tokyo" },
        }),
      "GET /api/release-streams": answer([fictionalStream()]),
    });
    renderApp("/releases?tab=schedules");
    const timeline = await screen.findByRole("region", { name: "Timeline" });
    expect(
      within(timeline).getByText(
        (_, element) => element?.textContent === "Today, 2027-02-16",
        { selector: "span" },
      ),
    ).toBeDefined();
  });

  it("leaves today out once it is past the last cycle", async () => {
    const timeline = await showTimeline([fictionalStream()], "2028-02-15");
    expect(within(timeline).queryByText(/^Today/)).toBeNull();
  });

  it("opens with today a sixth of the way across, and goes back to it", async () => {
    const timeline = await showTimeline([fictionalStream()], "2027-06-15");
    // Today is 165 days in, at 495 pixels, with a sixth of the view before it.
    const todayAt = 495 - room / 6;
    expect(view(timeline).scrollLeft).toBe(todayAt);
    view(timeline).scrollLeft = 600;
    await userEvent.click(
      within(timeline).getByRole("button", { name: "Today" }),
    );
    expect(view(timeline).scrollLeft).toBe(todayAt);
  });

  it("offers no Today button once today is past the last cycle", async () => {
    const timeline = await showTimeline([fictionalStream()], "2028-02-15");
    expect(
      within(timeline).queryByRole("button", { name: "Today" }),
    ).toBeNull();
    expect(view(timeline).scrollLeft).toBe(0);
  });

  const pixels = (days: number, shown: number) =>
    `${String(Math.round(((days * room) / shown) * 100) / 100)}px`;

  it("keeps today a sixth of the way across while zooming, until the reader scrolls", async () => {
    const timeline = await showTimeline([fictionalStream()], "2027-06-15");
    // Its own scrolling, to today, does not count as the reader's.
    fireEvent.scroll(view(timeline));
    await userEvent.click(
      within(timeline).getByRole("radio", { name: "Week" }),
    );
    // Today is 165 days in; Week shows 42 days across 540 pixels.
    expect(view(timeline).scrollLeft).toBeCloseTo((165 * room) / 42 - room / 6);
  });

  it("keeps the day in the middle of the view when an earlier stream moves the timeline's start", () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date("2027-06-15T12:00:00Z"));
    const shown = (streams: ReleaseStream[]) => (
      <MantineProvider theme={testTheme}>
        <TimelineView
          title="Timeline"
          zoomKey={zoomKey}
          releaseStreams={streams}
          layerForm="schedules"
          today="2027-06-15"
        />
      </MantineProvider>
    );
    const { rerender } = render(shown([fictionalStream()]));
    const timeline = screen.getByRole("region", { name: "Timeline" });
    view(timeline).scrollLeft = 270;
    fireEvent.scroll(view(timeline));
    // The middle, 540 pixels in at three a day, is day 180 from 2027-01-01. A stream from
    // 2026-07-01 starts the timeline 184 days sooner.
    rerender(
      shown([
        fictionalStream(),
        fictionalStream({
          id: "s2",
          name: "Fictional Minors",
          cycles: [
            {
              startsOn: "2026-07-01",
              endsOn: "2026-09-30",
              name: "M1",
              months: [],
            },
          ],
        }),
      ]),
    );
    expect(view(timeline).scrollLeft).toBe((names + 184) * 3 - room / 2);
  });

  it("zooms, keeping the zoom for next time and the middle of the view in place", async () => {
    const timeline = await showTimeline([fictionalStream()], "2027-02-15");
    view(timeline).scrollLeft = 270;
    fireEvent.scroll(view(timeline));
    expect(widths(timeline)).toEqual(["270px", "273px", "276px", "276px"]);
    await userEvent.click(
      within(timeline).getByRole("radio", { name: "Week" }),
    );
    // Week shows 42 days. The day in the middle, 180, stays there.
    expect(widths(timeline)[0]).toBe(pixels(90, 42));
    expect(view(timeline).scrollLeft).toBeCloseTo((180 * room) / 42 - room / 2);
    expect(localStorage.getItem(zoomKey)).toBe('"week"');
  });

  it("zooms in and out a step at a time, as far as the whole timeline", async () => {
    const timeline = await showTimeline([fictionalStream()], "2027-02-15");
    const zoomOut = within(timeline).getByRole("button", { name: "Zoom out" });
    await userEvent.click(
      within(timeline).getByRole("button", { name: "Zoom in" }),
    );
    expect(widths(timeline)[0]).toBe(pixels(90, 120));
    expect(localStorage.getItem(zoomKey)).toBe("120");
    expect(
      within(timeline)
        .getAllByRole("radio")
        .filter((radio) => (radio as HTMLInputElement).checked),
    ).toEqual([]);
    await userEvent.click(zoomOut);
    await userEvent.click(zoomOut);
    expect(widths(timeline)[0]).toBe(pixels(90, 270));
    // Half as much again would be more than the timeline's 365 days.
    await userEvent.click(zoomOut);
    expect(widths(timeline)[0]).toBe(pixels(90, 365));
    expect(zoomOut).toHaveProperty("disabled", true);
  });

  it("zooms in no further than two weeks", async () => {
    localStorage.setItem(zoomKey, "5");
    const timeline = await showTimeline([fictionalStream()], "2027-02-15");
    expect(widths(timeline)[0]).toBe(pixels(90, 14));
    expect(
      within(timeline).getByRole("button", { name: "Zoom in" }),
    ).toHaveProperty("disabled", true);
  });

  it("shows the whole timeline at All, and at a zoom showing more than it", async () => {
    const timeline = await showTimeline(
      [fictionalStream({ cycles: quarters(2) })],
      "2027-02-15",
    );
    // Two quarters, 181 days, fill the view at Quarter, which shows a year, as at All.
    for (const zoom of ["All", "Quarter"]) {
      await userEvent.click(
        within(timeline).getByRole("radio", { name: zoom }),
      );
      expect(widths(timeline)[0]).toBe(pixels(90, 181));
    }
  });

  it("widens its days as the view widens", async () => {
    // Mantine's controls watch their own sizes too, so every watcher is told.
    const watchers: (() => unknown)[] = [];
    vi.stubGlobal(
      "ResizeObserver",
      class {
        constructor(callback: () => unknown) {
          watchers.push(callback);
        }
        observe() {}
        unobserve() {}
        disconnect() {}
      },
    );
    const timeline = await showTimeline([fictionalStream()], "2027-02-15");
    viewWidth = names + 2 * room;
    act(() => {
      for (const watcher of watchers) watcher();
    });
    expect(widths(timeline)[0]).toBe("540px");
  });

  // The labels of the axis's tier holding the label given.
  const tierLabels = (timeline: HTMLElement, label: string) =>
    [
      ...((
        within(timeline).getAllByText(label)[0]?.parentElement as HTMLElement
      ).children as HTMLCollectionOf<HTMLElement>),
    ].map(({ textContent }) => textContent);

  it("names each level's own period above the next smaller one", async () => {
    localStorage.setItem(zoomKey, '"year"');
    viewWidth = names + 2 * room;
    const timeline = await showTimeline(
      [
        fictionalStream({ cycles: quarters(12) }),
        fictionalStream({
          id: "s2",
          name: "Fictional Minors",
          cycles: [
            {
              startsOn: "2026-12-14",
              endsOn: "2027-01-10",
              name: "M1",
              months: [],
            },
          ],
        }),
      ],
      "2027-02-15",
    );
    // Year shows three years across 1,080 pixels: December 2026 is too narrow for its year, and
    // has room only for its half year's first month.
    expect(tierLabels(timeline, "2027")).toEqual(["", "2027", "2028", "2029"]);
    expect(tierLabels(timeline, "Jan to Jun 27").slice(0, 3)).toEqual([
      "Jul",
      "Jan to Jun 27",
      "Jul to Dec 27",
    ]);
    await userEvent.click(
      within(timeline).getByRole("radio", { name: "6 months" }),
    );
    expect(tierLabels(timeline, "Jan to Jun 2027").slice(0, 2)).toEqual([
      "",
      "Jan to Jun 2027",
    ]);
    expect(tierLabels(timeline, "Q1 27").slice(0, 3)).toEqual([
      "Q4 26",
      "Q1 27",
      "Q2 27",
    ]);
  });

  it("names periods by their first months at All, when their names do not fit", async () => {
    localStorage.setItem(zoomKey, '"all"');
    viewWidth = names + 2 * room;
    const timeline = await showTimeline(
      [fictionalStream({ cycles: quarters(40) })],
      "2027-02-15",
    );
    // Ten years across 1,080 pixels: a half year is about 54 pixels, too narrow for
    // "Jan to Jun 27".
    expect(tierLabels(timeline, "Jul").slice(0, 3)).toEqual([
      "Jan",
      "Jul",
      "Jan",
    ]);
  });

  // The axis's lowest tier, the one with the tick whose label is given.
  const tierOf = (timeline: HTMLElement, label: string) =>
    within(timeline).getAllByText(label)[0]?.parentElement as HTMLElement;

  it("marks weeks by their Mondays at Week, with their days as marks", async () => {
    localStorage.setItem(zoomKey, '"week"');
    const timeline = await showTimeline([fictionalStream()], "2027-02-15");
    const weeks = tierOf(timeline, "Feb 15");
    expect(weeks.style.backgroundImage).toContain("repeating-linear-gradient");
    expect(
      [...weeks.children].slice(0, 3).map(({ textContent }) => textContent),
    ).toEqual(["", "Jan 4", "Jan 11"]);
  });

  it("names each day at Days, when the view has room", async () => {
    localStorage.setItem(zoomKey, '"days"');
    viewWidth = names + 2 * room;
    const timeline = await showTimeline([fictionalStream()], "2027-02-15");
    const days = tierOf(timeline, "Mon 15");
    expect(days.style.backgroundImage).toBe("");
    expect(
      [...days.children].slice(0, 4).map(({ textContent }) => textContent),
    ).toEqual(["Fri 1", "Sat 2", "Sun 3", "Mon 4"]);
  });

  it("starts at Year when the zoom kept is not one it knows", async () => {
    localStorage.setItem(zoomKey, '"decade"');
    const timeline = await showTimeline([fictionalStream()], "2027-02-15");
    // Year shows three years, more than the timeline's one.
    expect(widths(timeline)[0]).toBe(pixels(90, 365));
    expect(
      within(timeline).getByRole("radio", { name: "Year" }),
    ).toHaveProperty("checked", true);
  });

  describe("drafts on it, as the Draft view shows them", () => {
    // Fictional One moved a quarter later, Fictional Two drafted to be removed, Fictional Three
    // added, on a stream drafted to be retired.
    const drafted = () =>
      fictionalStream({
        retired: true,
        draft: recordDraft({ changed: ["retired"], live: { retired: false } }),
        releases: [
          fictionalRelease({
            firstCycle: "2027-04-01",
            lastCycle: "2027-04-01",
            draft: recordDraft({
              changed: ["firstCycle", "lastCycle"],
              live: { firstCycle: "2027-01-01", lastCycle: "2027-01-01" },
            }),
          }),
          fictionalRelease({
            id: "30000000-0000-4000-8000-000000000002",
            name: "Fictional Two",
            firstCycle: "2027-07-01",
            lastCycle: "2027-07-01",
            draft: recordDraft({ action: "deleted" }),
          }),
          fictionalRelease({
            id: "30000000-0000-4000-8000-000000000003",
            name: "Fictional Three",
            firstCycle: "2027-10-01",
            lastCycle: "2027-10-01",
            draft: recordDraft({ action: "created" }),
          }),
        ],
      });

    const names = (timeline: HTMLElement, list: string) =>
      items(timeline, list).map((item) => item.getAttribute("data-tip"));

    const liveList = "Releases of Fictional Majors as they are live";

    it("shows beside live each release a draft moves in its old place, and what a draft removes", async () => {
      const timeline = await showTimeline(
        [drafted()],
        "2027-02-15",
        "",
        "releases",
      );
      expect(names(timeline, "Releases of Fictional Majors")).toEqual([
        "Fictional One: 27.2, ships 2027-06-30. Draft: moved.",
        "Fictional Two: 27.3, ships 2027-09-30. Draft: removed.",
        "Fictional Three: 27.4, ships 2027-12-31. Draft: added.",
      ]);
      expect(names(timeline, liveList)).toEqual([
        "Fictional One: 27.1, ships 2027-03-31. Live.",
      ]);
      expect(
        within(items(timeline, "Schedules")[0] as HTMLElement).getByText(
          "Retired",
        ),
      ).toBeDefined();
    });

    it("shows with drafts applied only what the drafts make", async () => {
      const timeline = await showTimeline(
        [drafted()],
        "2027-02-15",
        "?show=drafts",
        "releases",
      );
      expect(names(timeline, "Releases of Fictional Majors")).toEqual([
        "Fictional One: 27.2, ships 2027-06-30. Draft: moved.",
        "Fictional Three: 27.4, ships 2027-12-31. Draft: added.",
      ]);
      expect(
        within(timeline).queryByRole("list", { name: liveList }),
      ).toBeNull();
    });

    it("shows Live only the releases as they are live, saying which a waiting draft would change", async () => {
      const timeline = await showTimeline(
        [drafted()],
        "2027-02-15",
        "?show=live",
        "releases",
      );
      expect(names(timeline, "Releases of Fictional Majors")).toEqual([
        "Fictional One: 27.1, ships 2027-03-31. Live. A move is waiting for approval.",
        "Fictional Two: 27.3, ships 2027-09-30. Live. Its removal is waiting for approval.",
      ]);
    });

    // A rejected removal, a rejected move, and the reader's own unpublished change of colour.
    const judged = () =>
      fictionalStream({
        releases: [
          fictionalRelease({
            firstCycle: "2027-04-01",
            lastCycle: "2027-04-01",
            draft: recordDraft({
              changed: ["firstCycle", "lastCycle"],
              live: { firstCycle: "2027-01-01", lastCycle: "2027-01-01" },
              state: "rejected",
            }),
          }),
          fictionalRelease({
            id: "30000000-0000-4000-8000-000000000002",
            name: "Fictional Two",
            firstCycle: "2027-07-01",
            lastCycle: "2027-07-01",
            draft: recordDraft({ action: "deleted", state: "rejected" }),
          }),
          fictionalRelease({
            id: "30000000-0000-4000-8000-000000000003",
            name: "Fictional Three",
            firstCycle: "2027-10-01",
            lastCycle: "2027-10-01",
            colour: "teal",
            draft: recordDraft({
              changed: ["colour"],
              live: { colour: null },
              unpublished: true,
            }),
          }),
        ],
      });

    it("says beside live which drafts were rejected, striking out none, and which are unpublished", async () => {
      const timeline = await showTimeline(
        [judged()],
        "2027-02-15",
        "",
        "releases",
      );
      const [moved, removed, unpublished] = names(
        timeline,
        "Releases of Fictional Majors",
      );
      expect(moved).toMatch(/^Fictional One: .*\. Rejected/);
      expect(removed).toMatch(/^Fictional Two: .*\. Rejected/);
      expect(unpublished).toMatch(/^Fictional Three: .*unpublished/);
      expect(
        items(timeline, "Releases of Fictional Majors").map(
          (item) =>
            item.querySelector(":scope > [aria-hidden]")?.className ?? "",
        ),
      ).not.toContainEqual(expect.stringMatching(/struck/));
    });

    it("says who is changing a stream or a release", async () => {
      const timeline = await showTimeline(
        [
          fictionalStream({
            heldBy: "Fictional Editor",
            releases: [fictionalRelease({ heldBy: "Fictional Editor" })],
          }),
        ],
        "2027-02-15",
        "",
        "releases",
      );
      expect(names(timeline, "Releases of Fictional Majors")).toEqual([
        "Fictional One: 27.1, ships 2027-03-31. Being changed by Fictional Editor.",
      ]);
      expect(items(timeline, "Schedules")[0]?.textContent).toContain(
        "being changed by Fictional Editor",
      );
    });

    it("takes rejected drafts back with drafts applied", async () => {
      const timeline = await showTimeline(
        [judged()],
        "2027-02-15",
        "?show=drafts",
        "releases",
      );
      expect(
        names(timeline, "Releases of Fictional Majors").slice(0, 2),
      ).toEqual([
        "Fictional One: 27.1, ships 2027-03-31.",
        "Fictional Two: 27.3, ships 2027-09-30.",
      ]);
    });
  });

  it("is left out while no stream has cycles", async () => {
    serverAnswers({
      "GET /api/session": signedIn,
      "GET /api/release-streams": answer([
        fictionalStream({ cycles: [], patterns: [] }),
      ]),
    });
    renderApp("/releases?tab=schedules");
    await streamsGrid();
    expect(screen.queryByRole("region", { name: "Timeline" })).toBeNull();
  });
});
