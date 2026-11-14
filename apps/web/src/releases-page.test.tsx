// SPDX-License-Identifier: Apache-2.0

// Tests for the Releases page: each release stream with how its cycles are made, its releases, and
// its cycles, the timeline of them all, and what those who see the plan may do there.

import type { ReleaseStream, ReleaseStreams } from "@fathom/shared";
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
import { focusManager } from "@tanstack/react-query";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { TimelineView } from "./timeline-view.tsx";
import {
  bodyOf,
  featureDraft,
  fictionalPattern,
  fictionalRelease,
  fictionalStream,
  fictionalUser,
  noFeatureColumns,
  quarters,
  recordDraft,
  renderApp,
  serverAnswers,
  signedIn,
  streamId,
  testTheme,
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
      name: "Fictional Majors",
      retired: false,
      cyclesUntil: "2028-12-31",
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
    renderApp("/releases");
    expect(
      await screen.findByRole("button", {
        name: "Show details of Fictional Majors",
      }),
    ).toBeDefined();
    expect(screen.getByText("Every 3 months, named {YY}.{N}")).toBeDefined();
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
    expect(screen.getByText("27.1 to 27.2")).toBeDefined();
  });

  it("keeps the panel open when its edge is dragged to resize it", async () => {
    serverAnswers({
      "GET /api/session": signedIn,
      "GET /api/release-streams": () => Response.json(streams),
    });
    renderApp("/releases/s1");
    const edge = await screen.findByRole("separator", {
      name: "Resize the stream's panel",
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

// Opens the stream's panel, with the streams given, and any other answers the test needs.
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
const section = (name: string) => within(panel()).getByRole("region", { name });

async function chooseInMenu(of: string, item: string) {
  await userEvent.click(screen.getByRole("button", { name: `Menu of ${of}` }));
  await userEvent.click(await screen.findByRole("menuitem", { name: item }));
}

const streamsGrid = () =>
  screen.findByRole("grid", { name: "Release streams" });
// The rows of the table, after its header, as read.
const rowTexts = () =>
  within(screen.getByRole("grid", { name: "Release streams" }))
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

function calls(fetch: ReturnType<typeof serverAnswers>, method: string) {
  return fetch.mock.calls
    .filter(([, init]) => init?.method === method)
    .map(([url]) => url);
}

describe("the table of release streams", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("shows each stream's cycles in force, releases, next release and how far its cycles are made", async () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date("2027-02-15T12:00:00Z"));
    serverAnswers({
      "GET /api/session": signedIn,
      "GET /api/release-streams": answer([
        fictionalStream({ releases: [release] }),
      ]),
    });
    renderApp("/releases");
    await streamsGrid();
    expect(rowTexts()).toEqual([
      "Current1 release stream",
      "Fictional MajorsEvery 3 months, named {YY}.{N}(1) Fictional OneFictional One, ships Mar 31, 2027Dec 31, 2027",
    ]);
  });

  it("leaves the Releases cell blank for a stream with no releases", async () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date("2027-02-15T12:00:00Z"));
    serverAnswers({
      "GET /api/session": signedIn,
      "GET /api/release-streams": answer([fictionalStream()]),
    });
    renderApp("/releases");
    await streamsGrid();
    expect(rowTexts().at(1)).toBe(
      "Fictional MajorsEvery 3 months, named {YY}.{N}Dec 31, 2027",
    );
  });

  it("hides retired streams until Show retired is chosen in the Views menu, keeping the choice in the address", async () => {
    serverAnswers({
      "GET /api/session": signedIn,
      "GET /api/release-streams": answer([
        fictionalStream({ id: "s1", name: "Fictional Old", retired: true }),
        fictionalStream({ id: "s2", name: "Fictional New", patterns: [] }),
      ]),
    });
    const history = renderApp("/releases");
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
      "Current1 rele",
      "Fictional New",
      "Retired1 rele",
      "Fictional Old",
    ]);
    expect(history.location.search).toContain("retired=true");
  });

  it("offers no Views menu while it would hold nothing", async () => {
    serverAnswers({
      "GET /api/session": signedIn,
      "GET /api/release-streams": answer([fictionalStream()]),
    });
    renderApp("/releases");
    await streamsGrid();
    expect(screen.queryByRole("button", { name: "Views" })).toBeNull();
  });

  it("offers hiding retired streams again while they show, though none is retired any more", async () => {
    serverAnswers({
      "GET /api/session": signedIn,
      "GET /api/release-streams": answer([fictionalStream()]),
    });
    const history = renderApp("/releases?retired=true");
    await userEvent.click(await screen.findByRole("button", { name: "Views" }));
    await userEvent.click(
      await screen.findByRole("menuitem", {
        name: "Show retired (0), chosen",
      }),
    );
    await waitFor(() => {
      expect(history.location.search).not.toContain("retired");
    });
  });

  it("shows the cycles in force today, leaving out those drafted to be removed", async () => {
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
    renderApp("/releases");
    expect(
      await screen.findByText("Every 1 week, named {YY}.{N}"),
    ).toBeDefined();
  });

  it("lists a stream's releases, striking through and leaving uncounted those drafted to be removed", async () => {
    serverAnswers({
      "GET /api/session": signedIn,
      "GET /api/release-streams": answer([
        fictionalStream({
          releases: [
            release,
            fictionalRelease({
              id: "30000000-0000-4000-8000-000000000002",
              name: "Fictional Gone",
              draft: recordDraft({ action: "deleted" }),
            }),
          ],
        }),
      ]),
    });
    renderApp("/releases");
    await detailsOf("Fictional Majors");
    const releases = cellOf("Fictional Majors", 2);
    expect(releases.textContent).toMatch(
      /^\(1\) Fictional One, Fictional Gone, Draft/,
    );
    expect(within(releases).getByText("Fictional Gone").className).toMatch(
      /struck/,
    );
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
    renderApp("/releases?retired=true");
    await detailsOf("Fictional E");
    expect(rowTexts().map((text) => text.replace(/Every.*$/, ""))).toEqual([
      "Current2 release streams",
      "Fictional A, Draft: added, draft",
      "Fictional DRetired, Draft: retired",
      "Retired1 release stream",
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
    renderApp("/releases?show=live");
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
    renderApp("/releases");
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
      cellOf("Fictional Coloured", 2).textContent,
      rowOf("Fictional Removing").className,
      rowOf("Fictional Removing").nextElementSibling?.textContent,
    ]).toEqual([
      expect.not.stringMatching(/draftRow/),
      null,
      "(1) Fictional One, Draft",
      expect.stringMatching(/draftRow/),
      expect.stringContaining("(1) Fictional One"),
    ]);
  });

  it("says a stream had no cycles in its Live row while a draft adds its first", async () => {
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
    renderApp("/releases");
    await detailsOf("Fictional Majors");
    const liveRow = cellOf("Fictional Majors", 0).closest("tr")
      ?.nextElementSibling as HTMLElement;
    expect(liveRow.textContent).toContain("No cycles yet");
  });

  it("finds streams by any word in them", async () => {
    serverAnswers({
      "GET /api/session": signedIn,
      "GET /api/release-streams": answer([
        fictionalStream({ id: "s1", name: "Fictional Majors" }),
        fictionalStream({ id: "s2", name: "Fictional Patches" }),
      ]),
    });
    renderApp("/releases");
    await detailsOf("Fictional Patches");
    await userEvent.type(
      screen.getByRole("textbox", { name: "Search release streams" }),
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

  it("groups streams by their cycle schedule, keeping the grouping in the address", async () => {
    serverAnswers({
      "GET /api/session": signedIn,
      "GET /api/release-streams": answer([
        fictionalStream({ id: "s1", name: "Fictional Majors" }),
        fictionalStream({ id: "s2", name: "Fictional New", patterns: [] }),
      ]),
    });
    const history = renderApp("/releases");
    await detailsOf("Fictional New");
    await userEvent.click(
      screen.getByRole("button", { name: "Group by: Status" }),
    );
    await userEvent.click(
      await screen.findByRole("menuitem", { name: "Cycle schedule" }),
    );
    await waitFor(() => {
      expect(history.location.search).toContain("grouping=schedule");
    });
    expect(rowTexts().map((text) => text.slice(0, 13))).toEqual([
      "Every 3 month",
      "Fictional Maj",
      "No cycles yet",
      "Fictional New",
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
    renderApp("/releases");
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
    renderApp("/releases");
    expect(await screen.findByText("No release streams yet.")).toBeDefined();
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
    renderApp("/releases");
    await userEvent.click(
      await screen.findByRole("button", { name: "Try again" }),
    );
    expect(await detailsOf("Fictional Majors")).toBeDefined();
  });

  it("opens a stream from the arrow in its Stream cell", async () => {
    serverAnswers({
      "GET /api/session": signedIn,
      "GET /api/release-streams": answer([fictionalStream()]),
    });
    const history = renderApp("/releases");
    await userEvent.click(await detailsOf("Fictional Majors"));
    await waitFor(() => {
      expect(history.location.pathname).toBe(`/releases/${streamId}`);
    });
  });
});

describe("a stream's panel", () => {
  it("shows each release's cycles and the day it ships", async () => {
    await openStream([
      fictionalStream({
        releases: [
          release,
          fictionalRelease({
            id: "30000000-0000-4000-8000-000000000002",
            name: "Fictional Two",
            firstCycle: "2027-04-01",
            lastCycle: "2027-07-01",
            shipsOn: "2027-08-15",
          }),
          fictionalRelease({
            id: "30000000-0000-4000-8000-000000000003",
            name: "Fictional Far",
            firstCycle: "2031-01-01",
            lastCycle: "2031-01-01",
          }),
        ],
      }),
    ]);
    expect(
      within(section("Releases"))
        .getAllByText(/ships/)
        .map((line) => line.parentElement?.textContent),
    ).toEqual([
      "27.1 · ships Mar 31, 2027",
      "27.2 to 27.3 · ships Aug 15, 2027, 46 days before 27.3 ends",
      "2031-01-01 · ships ",
    ]);
  });

  it("shows each release's colour before its name, hidden from screen readers", async () => {
    await openStream([
      fictionalStream({
        releases: [
          release,
          fictionalRelease({
            id: "30000000-0000-4000-8000-000000000002",
            name: "Fictional Two",
            firstCycle: "2027-04-01",
            lastCycle: "2027-04-01",
            colour: "grape",
          }),
        ],
      }),
    ]);
    expect(
      [
        ...section("Releases").querySelectorAll<HTMLElement>(
          ".mantine-ColorSwatch-root",
        ),
      ].map((swatch) => [
        swatch.parentElement?.getAttribute("aria-hidden"),
        swatch.parentElement?.nextSibling?.textContent,
        swatch.querySelector<HTMLElement>(".mantine-ColorSwatch-colorOverlay")
          ?.style.backgroundColor,
      ]),
    ).toEqual([
      ["true", "Fictional One", "var(--mantine-color-sea-filled)"],
      ["true", "Fictional Two", "var(--mantine-color-grape-filled)"],
    ]);
  });

  it("lists each cycle with its release and the share of each month it covers", async () => {
    await openStream([
      fictionalStream({
        cycles: [
          {
            startsOn: "2027-12-16",
            endsOn: "2028-02-29",
            name: "28.1",
            months: [
              { month: "2027-12", share: 16 / 31 },
              { month: "2028-01", share: 1 },
              { month: "2028-02", share: 1 },
            ],
          },
          {
            startsOn: "2028-03-01",
            endsOn: "2028-03-31",
            name: "28.2",
            months: [{ month: "2028-03", share: 1 }],
          },
        ],
        releases: [
          fictionalRelease({
            firstCycle: "2027-12-16",
            lastCycle: "2027-12-16",
          }),
          fictionalRelease({
            id: "30000000-0000-4000-8000-000000000002",
            name: "Fictional Gone",
            firstCycle: "2028-03-01",
            lastCycle: "2028-03-01",
            draft: recordDraft({ action: "deleted" }),
          }),
        ],
      }),
    ]);
    expect(
      within(section("Cycles (2)"))
        .getAllByRole("row")
        .map(({ textContent }) => textContent),
    ).toEqual([
      "NameStartsEndsReleaseMonths",
      "28.1Dec 16, 2027Feb 29, 2028Fictional OneDec 2027 52%, Jan 2028, Feb",
      "28.2Mar 1, 2028Mar 31, 2028Mar 2028",
    ]);
  });

  it("shows the cycle schedule's days with a short month and the year", async () => {
    await openStream([fictionalStream()]);
    expect([
      within(section("Cycle schedule")).getByText("From Jan 1, 2027"),
      within(section("Cycle schedule")).getByText("Dec 31, 2027"),
    ]).toEqual([expect.anything(), expect.anything()]);
  });

  it("says when a stream has no cycles or releases yet", async () => {
    await openStream([fictionalStream({ patterns: [], cycles: [] })]);
    expect([
      within(panel()).getByText("No cycles yet."),
      within(panel()).getByText("No releases yet."),
      within(panel()).queryByRole("region", { name: /^Cycles \(/ }),
    ]).toEqual([expect.anything(), expect.anything(), null]);
  });

  it("says a stream is retired", async () => {
    await openStream([fictionalStream({ retired: true })]);
    expect(within(panel()).getByText("Retired")).toBeDefined();
  });

  it("offers viewers no changes", async () => {
    await openStream([fictionalStream({ releases: [release] })]);
    expect(
      within(panel())
        .queryAllByRole("button")
        .map(({ textContent }) => textContent),
    ).toEqual([""]);
  });

  it.each([
    [
      "the close button",
      async () => {
        await userEvent.click(screen.getByRole("button", { name: "Close" }));
      },
    ],
    [
      "Escape",
      async () => {
        screen.getByRole("button", { name: "Close" }).focus();
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
    "closes with %s, putting focus on the stream's Stream cell",
    async (_case, close) => {
      const { history } = await openStream([fictionalStream()]);
      await close();
      await waitFor(() => {
        expect([history.location.pathname, document.activeElement?.id]).toEqual(
          ["/releases", `cell-${streamId}-name`],
        );
      });
    },
  );

  it("stays open when a key other than Escape is pressed in it", async () => {
    const { history } = await openStream([fictionalStream()]);
    screen.getByRole("button", { name: "Close" }).focus();
    await userEvent.keyboard("{Shift}");
    expect(history.location.pathname).toBe(`/releases/${streamId}`);
  });

  it("stays open when the search field is clicked, so what is typed goes there", async () => {
    const { history } = await openStream([fictionalStream()]);
    const search = screen.getByRole("textbox", {
      name: "Search release streams",
    });
    await userEvent.click(search);
    expect([history.location.pathname, document.activeElement]).toEqual([
      `/releases/${streamId}`,
      search,
    ]);
  });

  it("stays open when clicked inside", async () => {
    const { history } = await openStream([fictionalStream()]);
    await userEvent.click(within(panel()).getByText("Cycle schedule"));
    expect(history.location.pathname).toBe(`/releases/${streamId}`);
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
    const dialog = screen.getByRole("dialog", { name: "Fictional Majors" });
    expect([dialog.getAttribute("aria-modal"), dialog.className]).toEqual([
      "true",
      expect.stringMatching(/panelNarrow/),
    ]);
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
    const history = renderApp("/releases");
    await userEvent.click(
      await screen.findByRole("button", { name: "New release stream" }),
    );
    const dialog = await screen.findByRole("dialog", {
      name: "New release stream",
    });
    await userEvent.type(
      within(dialog).getByRole("textbox", { name: "Name" }),
      "Fictional Minors",
    );
    await userEvent.click(
      within(dialog).getByRole("button", { name: "Add stream" }),
    );
    expect(
      await screen.findByText("Drafted the new release stream."),
    ).toBeDefined();
    await waitFor(() => {
      expect(history.location.pathname).toBe(`/releases/${added.id}`);
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
      within(panel()).getByRole("button", { name: "Rename" }),
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
      within(panel()).getByRole("button", { name: "Rename" }),
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
      within(panel()).getByRole("button", { name: "Rename" }),
    );
    await screen.findByRole("dialog", { name: "Rename Fictional Majors" });
    await userEvent.keyboard("{Escape}");
    await waitFor(() => {
      expect(screen.queryByRole("dialog")).toBeNull();
    });
  });

  it("drafts retiring a stream", async () => {
    const { fetch } = await openStream([fictionalStream()], {
      can: editsAll,
      answers: {
        [`PUT ${streamPath}/retired`]: () =>
          Response.json({ stream: fictionalStream(), changeSetId }),
      },
    });
    await userEvent.click(
      within(panel()).getByRole("button", { name: "Retire" }),
    );
    expect(
      await screen.findByText("Drafted retiring Fictional Majors."),
    ).toBeDefined();
    expect(
      fetch.mock.calls.find(([url]) => url === `${streamPath}/retired`)?.[1]
        ?.body,
    ).toBe(JSON.stringify({ retired: true }));
  });

  it("drafts restoring a retired stream", async () => {
    await openStream([fictionalStream({ retired: true })], {
      can: editsAll,
      answers: {
        [`PUT ${streamPath}/retired`]: () =>
          Response.json({ stream: fictionalStream(), changeSetId }),
      },
    });
    await userEvent.click(
      within(panel()).getByRole("button", { name: "Restore" }),
    );
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
    await userEvent.click(
      within(panel()).getByRole("button", { name: "Retire" }),
    );
    expect(await screen.findByText("Fictional refusal")).toBeDefined();
  });

  it("offers no changes to a stream someone else is changing", async () => {
    await openStream([fictionalStream({ heldBy: "Fictional Colleague" })], {
      can: editsAll,
    });
    expect([
      within(panel()).queryByRole("button", { name: "Rename" }),
      within(section("Cycle schedule")).queryByRole("button", {
        name: "Change…",
      }),
      within(panel()).getByText(/being changed by Fictional Colleague/),
    ]).toEqual([null, null, expect.anything()]);
  });

  it("offers no renaming of a stream drafted to be removed", async () => {
    await openStream(
      [fictionalStream({ draft: recordDraft({ action: "deleted" }) })],
      { can: editsAll },
    );
    expect(
      within(panel()).queryByRole("button", { name: "Rename" }),
    ).toBeNull();
  });
});

describe("changing a stream's cycles", () => {
  const saved = () => Response.json({ stream: fictionalStream(), changeSetId });

  it("sets up the cycles of a stream without any", async () => {
    await openStream([fictionalStream({ patterns: [], cycles: [] })], {
      can: editsAll,
      answers: { [`POST ${streamPath}/patterns`]: saved },
    });
    await userEvent.click(
      screen.getByRole("button", { name: "Set up cycles…" }),
    );
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

  it("offers only setting up the cycles of a stream without any", async () => {
    await openStream([fictionalStream({ patterns: [], cycles: [] })], {
      can: editsAll,
    });
    expect(
      within(section("Cycle schedule"))
        .getAllByRole("button")
        .map(({ textContent }) => textContent),
    ).toEqual(["Set up cycles…"]);
  });

  it("changes the length or names of the cycles from a date", async () => {
    await openStream([fictionalStream()], {
      can: editsAll,
      answers: { [`POST ${streamPath}/patterns`]: saved },
    });
    await userEvent.click(
      within(section("Cycle schedule")).getByRole("button", {
        name: "Change…",
      }),
    );
    await userEvent.click(
      await screen.findByRole("menuitem", {
        name: "Length or names from a date…",
      }),
    );
    const dialog = await screen.findByRole("dialog", {
      name: "Change the length or names of Fictional Majors's cycles",
    });
    await userEvent.click(
      within(dialog).getByRole("button", { name: "Change cycles" }),
    );
    expect(
      await screen.findByText("Drafted the change to the cycles."),
    ).toBeDefined();
  });

  it("changes a change of cycles from its menu", async () => {
    await openStream([fictionalStream()], {
      can: editsAll,
      answers: { [`PUT ${streamPath}/patterns/${pattern.id}`]: saved },
    });
    await chooseInMenu("Cycles from Jan 1, 2027", "Change…");
    const dialog = await screen.findByRole("dialog", {
      name: "Cycles from Jan 1, 2027",
    });
    await userEvent.click(within(dialog).getByRole("button", { name: "Save" }));
    expect(
      await screen.findByText("Drafted the change to the cycles."),
    ).toBeDefined();
  });

  it("drafts removing a change of cycles from its menu", async () => {
    const { fetch } = await openStream([fictionalStream()], {
      can: editsAll,
      answers: { [`DELETE ${streamPath}/patterns/${pattern.id}`]: savedAs },
    });
    await chooseInMenu("Cycles from Jan 1, 2027", "Remove");
    expect(
      await screen.findByText("Drafted removing the cycles from Jan 1, 2027."),
    ).toBeDefined();
    expect(calls(fetch, "DELETE")).toEqual([
      `${streamPath}/patterns/${pattern.id}`,
    ]);
  });

  it("offers no change to a change of cycles drafted to be removed, only its draft", async () => {
    await openStream(
      [
        fictionalStream({
          patterns: [
            fictionalPattern({ draft: recordDraft({ action: "deleted" }) }),
          ],
        }),
      ],
      { can: editsAll },
    );
    await userEvent.click(
      screen.getByRole("button", { name: "Menu of Cycles from Jan 1, 2027" }),
    );
    const menu = await screen.findByRole("menu");
    expect(
      within(menu)
        .getAllByRole("menuitem")
        .map(({ textContent }) => textContent),
    ).toEqual(["Discard draft"]);
  });

  it("changes the day the cycles end", async () => {
    await openStream([fictionalStream()], {
      can: editsAll,
      answers: { [`PUT ${streamPath}/cycles-until`]: saved },
    });
    await userEvent.click(
      within(section("Cycle schedule")).getByRole("button", {
        name: "Change…",
      }),
    );
    await userEvent.click(
      await screen.findByRole("menuitem", { name: "Planned to…" }),
    );
    const dialog = await screen.findByRole("dialog", {
      name: "Change how far Fictional Majors is planned",
    });
    await userEvent.click(within(dialog).getByRole("button", { name: "Save" }));
    expect(
      await screen.findByText("Drafted the change to the cycles."),
    ).toBeDefined();
  });
});

describe("changing one cycle's length", () => {
  const saved = () => Response.json({ stream: fictionalStream(), changeSetId });

  it("is offered on each cycle to those who change cycles, and drafts the new length", async () => {
    const { fetch } = await openStream([fictionalStream()], {
      can: editsAll,
      answers: { [`PUT ${streamPath}/cycles/2027-04-01/length`]: saved },
    });
    await chooseInMenu("27.2", "Change length…");
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
    expect(screen.queryByRole("button", { name: "Menu of 27.2" })).toBeNull();
  });
});

describe("changing releases", () => {
  const saved = () => Response.json({ stream: fictionalStream(), changeSetId });

  it("makes a release", async () => {
    await openStream([fictionalStream()], {
      can: editsAll,
      answers: { [`POST ${streamPath}/releases`]: saved },
    });
    await userEvent.click(screen.getByRole("button", { name: "New release…" }));
    const dialog = await screen.findByRole("dialog", {
      name: "New release in Fictional Majors",
    });
    await userEvent.type(
      within(dialog).getByRole("textbox", { name: "Name" }),
      "Fictional Two",
    );
    await userEvent.click(
      within(dialog).getByRole("combobox", { name: "First cycle" }),
    );
    await userEvent.click(
      await screen.findByRole("option", {
        name: "27.2 (2027-04-01 to 2027-06-30)",
      }),
    );
    await userEvent.click(
      within(dialog).getByRole("button", { name: "Make release" }),
    );
    expect(await screen.findByText("Drafted the new release.")).toBeDefined();
  });

  it.each([
    ["a retired stream", fictionalStream({ retired: true })],
    ["a stream without cycles", fictionalStream({ patterns: [], cycles: [] })],
  ])("offers no new release in %s", async (_case, shown) => {
    await openStream([shown], { can: editsAll });
    expect(screen.queryByRole("button", { name: "New release…" })).toBeNull();
  });

  it("changes a release from its menu", async () => {
    await openStream([fictionalStream({ releases: [release] })], {
      can: editsAll,
      answers: { [`PUT ${streamPath}/releases/${release.id}`]: saved },
    });
    await chooseInMenu("Fictional One", "Change…");
    const dialog = await screen.findByRole("dialog", {
      name: "Change Fictional One",
    });
    await userEvent.click(within(dialog).getByRole("button", { name: "Save" }));
    expect(
      await screen.findByText("Drafted the change to the release."),
    ).toBeDefined();
  });

  it("drafts removing a release from its menu", async () => {
    await openStream([fictionalStream({ releases: [release] })], {
      can: editsAll,
      answers: { [`DELETE ${streamPath}/releases/${release.id}`]: savedAs },
    });
    await chooseInMenu("Fictional One", "Remove");
    expect(
      await screen.findByText("Drafted removing Fictional One."),
    ).toBeDefined();
  });

  it("offers no change to a release someone else is changing", async () => {
    await openStream(
      [
        fictionalStream({
          releases: [fictionalRelease({ heldBy: "Fictional Colleague" })],
        }),
      ],
      { can: editsAll },
    );
    expect(
      screen.queryByRole("button", { name: "Menu of Fictional One" }),
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
    within(screen.getByRole("grid", { name: "Release streams" }))
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
    const history = renderApp("/releases?show=live&retired=true");
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
    await choose("Drafts beside live");
    await waitFor(() => {
      expect(history.location.search).not.toContain("show");
    });
  });

  it("keeps the choice in the address as a stream is opened", async () => {
    serverAnswers({
      "GET /api/session": signedIn,
      "GET /api/release-streams": answer(drafted),
    });
    const history = renderApp("/releases?show=drafts");
    await userEvent.click(await detailsOf("Fictional Majors"));
    await waitFor(() => {
      expect(history.location.pathname).toBe(`/releases/${streamId}`);
    });
    expect(history.location.search).toContain("show=drafts");
  });
});

describe("drafts in a stream's panel", () => {
  const draftPath = `/api/records/release/${release.id}/draft`;

  it("says what a renamed release was called", async () => {
    await openStream([
      fictionalStream({
        releases: [
          fictionalRelease({
            draft: recordDraft({
              changed: ["name"],
              live: { name: "Fictional Earlier" },
            }),
          }),
        ],
      }),
    ]);
    expect(
      within(section("Releases")).getByText(
        ", Draft: changed from “Fictional Earlier”",
      ),
    ).toBeDefined();
  });

  it("marks a release a draft moves to other cycles as moved", async () => {
    await openStream([
      fictionalStream({
        releases: [
          fictionalRelease({
            firstCycle: "2027-04-01",
            lastCycle: "2027-04-01",
            draft: recordDraft({
              changed: ["firstCycle", "lastCycle"],
              live: { firstCycle: "2027-01-01", lastCycle: "2027-01-01" },
            }),
          }),
        ],
      }),
    ]);
    const releases = section("Releases");
    expect(within(releases).getByText("Moved")).toBeDefined();
    expect(within(releases).getByText(/Draft: moved/)).toBeDefined();
  });

  it("shows who made a draft, and closes the menu on a click beside its items", async () => {
    await openStream([
      fictionalStream({
        releases: [fictionalRelease({ draft: recordDraft() })],
      }),
    ]);
    await userEvent.click(
      screen.getByRole("button", { name: "Menu of Fictional One" }),
    );
    const menu = await screen.findByRole("menu");
    await userEvent.click(
      within(menu).getByText("Changed by Fictional Editor"),
    );
    await waitFor(() => {
      expect(screen.queryByRole("menu")).toBeNull();
    });
  });

  it("discards a draft", async () => {
    const { fetch } = await openStream(
      [
        fictionalStream({
          releases: [fictionalRelease({ draft: recordDraft() })],
        }),
      ],
      { can: editsAll, answers: { [`DELETE ${draftPath}`]: savedAs } },
    );
    await chooseInMenu("Fictional One", "Discard draft");
    expect(await screen.findByText("Discarded the draft.")).toBeDefined();
    expect(calls(fetch, "DELETE")).toEqual([draftPath]);
  });

  it("resubmits a rejected draft", async () => {
    const { fetch } = await openStream(
      [
        fictionalStream({
          releases: [
            fictionalRelease({
              draft: recordDraft({
                state: "rejected",
                reason: "Fictional reason",
              }),
            }),
          ],
        }),
      ],
      {
        can: editsAll,
        answers: { [`DELETE ${draftPath}/rejection`]: savedAs },
      },
    );
    await chooseInMenu("Fictional One", "Resubmit");
    expect(await screen.findByText("Resubmitted the draft.")).toBeDefined();
    expect(calls(fetch, "DELETE")).toEqual([`${draftPath}/rejection`]);
  });

  it("offers no discarding of a draft someone else is changing, and says who", async () => {
    await openStream(
      [
        fictionalStream({
          releases: [
            fictionalRelease({
              draft: recordDraft(),
              heldBy: "Fictional Colleague",
            }),
          ],
        }),
      ],
      { can: editsAll },
    );
    await userEvent.click(
      screen.getByRole("button", { name: "Menu of Fictional One" }),
    );
    const menu = await screen.findByRole("menu");
    expect([
      within(menu).queryByRole("menuitem"),
      within(menu).getByText(/^Being changed by Fictional Colleague\./),
    ]).toEqual([null, expect.anything()]);
  });

  it("says only the user sees their unpublished draft", async () => {
    await openStream([
      fictionalStream({
        draft: recordDraft({ unpublished: true }),
      }),
    ]);
    await userEvent.click(
      screen.getByRole("button", { name: "Menu of Fictional Majors" }),
    );
    expect(
      await screen.findByText(
        "Nobody else sees these changes until they're published.",
      ),
    ).toBeDefined();
  });

  it("names a feature's draft that approving includes", async () => {
    const featureId = "00000000-0000-4000-8000-0000000000f1";
    const stream = fictionalStream({
      releases: [
        fictionalRelease({
          draft: recordDraft({
            action: "changed",
            uses: [{ type: "feature", id: featureId }],
          }),
        }),
      ],
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
    await chooseInMenu("Fictional One", "Approve…");
    const dialog = await screen.findByRole("dialog", {
      name: "Approve 2 drafts?",
    });
    expect(
      within(dialog).getByText("the feature Fictional Moving"),
    ).toBeDefined();
  });

  it("approves a draft with the drafts it uses", async () => {
    // A release in a stream only drafted to be added.
    const stream = fictionalStream({
      draft: recordDraft({ action: "created" }),
      releases: [
        fictionalRelease({
          draft: recordDraft({
            action: "created",
            uses: [{ type: "release-stream", id: streamId }],
          }),
        }),
      ],
    });
    const { fetch } = await openStream([stream], {
      answers: {
        "GET /api/session": approver,
        "POST /api/drafts/approval": savedAs,
      },
    });
    await chooseInMenu("Fictional One", "Approve…");
    const dialog = await screen.findByRole("dialog", {
      name: "Approve 2 drafts?",
    });
    expect(
      within(dialog).getByText("the release stream Fictional Majors"),
    ).toBeDefined();
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
          { type: "release", id: release.id },
          { type: "release-stream", id: streamId },
        ],
      }),
    );
  });

  it("asks before rejecting a draft, and closes when cancelled", async () => {
    await openStream(
      [
        fictionalStream({
          releases: [fictionalRelease({ draft: recordDraft() })],
        }),
      ],
      { answers: { "GET /api/session": approver } },
    );
    await chooseInMenu("Fictional One", "Reject…");
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

  it("cannot approve a draft that uses a rejected one", async () => {
    const stream = fictionalStream({
      draft: recordDraft({ action: "created", state: "rejected" }),
      releases: [
        fictionalRelease({
          draft: recordDraft({
            action: "created",
            uses: [{ type: "release-stream", id: streamId }],
          }),
        }),
      ],
    });
    await openStream([stream], { answers: { "GET /api/session": approver } });
    await userEvent.click(
      screen.getByRole("button", { name: "Menu of Fictional One" }),
    );
    const menu = await screen.findByRole("menu");
    expect([
      within(menu)
        .getByRole("menuitem", { name: "Approve…" })
        .hasAttribute("disabled") ||
        within(menu)
          .getByRole("menuitem", { name: "Approve…" })
          .getAttribute("data-disabled"),
      within(menu).getByText("Waiting for a rejected draft to be resubmitted"),
    ]).toEqual([expect.anything(), expect.anything()]);
  });

  it("offers no approval of a release's draft this account changed, but still rejecting it", async () => {
    const stream = fictionalStream({
      releases: [
        fictionalRelease({
          draft: recordDraft({ action: "created", needsOtherApprover: true }),
        }),
      ],
    });
    await openStream([stream], { answers: { "GET /api/session": approver } });
    await userEvent.click(
      screen.getByRole("button", { name: "Menu of Fictional One" }),
    );
    const menu = await screen.findByRole("menu");
    const approve = within(menu).getByRole("menuitem", { name: "Approve…" });
    expect(
      approve.hasAttribute("disabled") ||
        approve.getAttribute("data-disabled") === "true",
    ).toBe(true);
    expect(
      within(menu).getByText(
        "Changed by this account, so another approver must approve it",
      ),
    ).toBeDefined();
    expect(
      within(menu)
        .getByRole("menuitem", { name: "Reject…" })
        .hasAttribute("data-disabled"),
    ).toBe(false);
  });

  it("closes only a menu in the panel with Escape, keeping the panel open", async () => {
    const { history } = await openStream([
      fictionalStream({
        releases: [fictionalRelease({ draft: recordDraft() })],
      }),
    ]);
    await userEvent.click(
      screen.getByRole("button", { name: "Menu of Fictional One" }),
    );
    await screen.findByRole("menu");
    await userEvent.keyboard("{Escape}");
    await waitFor(() => {
      expect(screen.queryByRole("menu")).toBeNull();
    });
    expect(history.location.pathname).toBe(`/releases/${streamId}`);
  });

  it("moves through a menu's items with the arrow keys, keeping the panel open", async () => {
    const { history } = await openStream(
      [
        fictionalStream({
          releases: [fictionalRelease({ draft: recordDraft() })],
        }),
      ],
      { can: editsAll },
    );
    await userEvent.click(
      screen.getByRole("button", { name: "Menu of Fictional One" }),
    );
    await screen.findByRole("menu");
    await userEvent.keyboard("{ArrowDown}{ArrowDown}");
    expect([
      document.activeElement?.getAttribute("role"),
      history.location.pathname,
    ]).toEqual(["menuitem", `/releases/${streamId}`]);
  });

  it("sets a change of cycles' draft apart from what may be done to it", async () => {
    await openStream(
      [
        fictionalStream({
          patterns: [fictionalPattern({ draft: recordDraft() })],
        }),
      ],
      { can: editsAll },
    );
    await userEvent.click(
      screen.getByRole("button", { name: "Menu of Cycles from Jan 1, 2027" }),
    );
    const menu = await screen.findByRole("menu");
    expect(
      within(menu)
        .getAllByRole("menuitem")
        .map(({ textContent }) => textContent),
    ).toEqual(["Change…", "Remove", "Discard draft"]);
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

  async function showTimeline(
    shown: ReleaseStream[],
    today: string,
    view: "" | "?show=drafts" | "?show=live" = "",
  ) {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date(`${today}T12:00:00Z`));
    serverAnswers({
      "GET /api/session": signedIn,
      "GET /api/release-streams": answer(shown),
    });
    renderApp(`/releases${view}`);
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
    expect(cycles.map((cycle) => cycle.getAttribute("title"))).toEqual([
      "27.1: 2027-01-01 to 2027-03-31",
      "27.2: 2027-04-01 to 2027-06-30",
      "27.3: 2027-07-01 to 2027-09-30",
      "27.4: 2027-10-01 to 2027-12-31",
    ]);
    expect(
      within(cycles[0] as HTMLElement).getByText(
        "27.1, 2027-01-01 to 2027-03-31",
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

  it("names a cycle only when its name fits", async () => {
    const timeline = await showTimeline(
      [
        fictionalStream({
          cycles: [
            ...quarters(1),
            {
              startsOn: "2027-04-01",
              endsOn: "2027-04-03",
              name: "Fictional Short",
              months: [],
            },
          ],
        }),
      ],
      "2027-02-15",
    );
    expect(
      items(timeline, "Cycles of Fictional Majors").map(
        (cycle) => cycle.querySelector("[aria-hidden]")?.textContent,
      ),
    ).toEqual(["27.1", ""]);
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
    renderApp("/releases");
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
      const timeline = await showTimeline([drafted()], "2027-02-15");
      expect(names(timeline, "Releases of Fictional Majors")).toEqual([
        "Fictional One: 27.2, ships 2027-06-30. Draft: moved.",
        "Fictional Two: 27.3, ships 2027-09-30. Draft: removed.",
        "Fictional Three: 27.4, ships 2027-12-31. Draft: added.",
      ]);
      expect(names(timeline, liveList)).toEqual([
        "Fictional One: 27.1, ships 2027-03-31. Live.",
      ]);
      expect(
        within(items(timeline, "Release streams")[0] as HTMLElement).getByText(
          "Retired",
        ),
      ).toBeDefined();
    });

    it("shows with drafts applied only what the drafts make", async () => {
      const timeline = await showTimeline(
        [drafted()],
        "2027-02-15",
        "?show=drafts",
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
      const timeline = await showTimeline([judged()], "2027-02-15");
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
      );
      expect(names(timeline, "Releases of Fictional Majors")).toEqual([
        "Fictional One: 27.1, ships 2027-03-31. Being changed by Fictional Editor.",
      ]);
      expect(items(timeline, "Release streams")[0]?.textContent).toContain(
        "being changed by Fictional Editor",
      );
    });

    it("takes rejected drafts back with drafts applied", async () => {
      const timeline = await showTimeline(
        [judged()],
        "2027-02-15",
        "?show=drafts",
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
    renderApp("/releases");
    await streamsGrid();
    expect(screen.queryByRole("region", { name: "Timeline" })).toBeNull();
  });
});

describe("a release's note", () => {
  const noted = fictionalRelease({ note: "Scope **frozen** for now" });
  const notePath = `${streamPath}/releases/${release.id}/note`;
  const saved = () => Response.json({ stream: fictionalStream(), changeSetId });
  const notePanel = () =>
    screen.findByRole("region", { name: "Fictional One" });
  const noteButton = () =>
    screen.getByRole("button", { name: "Fictional One note" });

  it("makes the name of a release that has a note a link to it", async () => {
    await openStream([fictionalStream({ releases: [noted] })]);
    expect(noteButton()).toBeDefined();
  });

  it("links no release without a note", async () => {
    await openStream([fictionalStream({ releases: [release] })]);
    expect(
      screen.queryByRole("button", { name: "Fictional One note" }),
    ).toBeNull();
  });

  it("opens the note, read only, to those who may not change releases, and closes it, putting focus back on its link", async () => {
    await openStream([fictionalStream({ releases: [noted] })]);
    await userEvent.click(noteButton());
    const opened = await notePanel();
    expect(within(opened).getByText("frozen").tagName).toBe("STRONG");
    expect(within(opened).queryByRole("button", { name: "Save" })).toBeNull();
    await userEvent.click(
      within(opened).getByRole("button", { name: "Close note" }),
    );
    await waitFor(() => {
      expect(document.activeElement).toBe(noteButton());
    });
    expect(screen.queryByRole("region", { name: "Fictional One" })).toBeNull();
  });

  it("is added from the release's menu, and drafted once saved", async () => {
    const { fetch } = await openStream(
      [fictionalStream({ releases: [release] })],
      {
        can: editsAll,
        answers: { [`PUT ${notePath}`]: saved },
      },
    );
    await chooseInMenu("Fictional One", "Add note…");
    const opened = await notePanel();
    await userEvent.click(within(opened).getByText("Markdown"));
    await userEvent.type(
      within(opened).getByRole("textbox", { name: "Markdown" }),
      "Ships *late*",
    );
    await userEvent.click(within(opened).getByRole("button", { name: "Save" }));
    expect(
      await screen.findByText("Drafted the note on Fictional One."),
    ).toBeDefined();
    expect(bodyOf(fetch, "PUT", notePath)).toEqual([{ note: "Ships _late_" }]);
  });

  it("is offered only by its link once the release has one", async () => {
    await openStream([fictionalStream({ releases: [noted] })], {
      can: editsAll,
    });
    await userEvent.click(
      screen.getByRole("button", { name: "Menu of Fictional One" }),
    );
    expect(
      await screen.findByRole("menuitem", { name: "Change…" }),
    ).toBeDefined();
    expect(screen.queryByRole("menuitem", { name: "Add note…" })).toBeNull();
  });

  it("is removed when cleared and saved", async () => {
    const { fetch } = await openStream(
      [fictionalStream({ releases: [noted] })],
      {
        can: editsAll,
        answers: { [`PUT ${notePath}`]: saved },
      },
    );
    await userEvent.click(noteButton());
    const opened = await notePanel();
    await userEvent.click(within(opened).getByText("Editor"));
    await userEvent.click(
      within(opened).getByRole("button", { name: "Clear" }),
    );
    await userEvent.click(within(opened).getByRole("button", { name: "Save" }));
    expect(
      await screen.findByText("Drafted removing the note on Fictional One."),
    ).toBeDefined();
    expect(bodyOf(fetch, "PUT", notePath)).toEqual([{ note: null }]);
  });

  it("keeps the panel open, with what was written and why, when the note is refused", async () => {
    await openStream([fictionalStream({ releases: [release] })], {
      can: editsAll,
      answers: {
        [`PUT ${notePath}`]: () =>
          Response.json({ message: "Fictional refusal" }, { status: 400 }),
      },
    });
    await chooseInMenu("Fictional One", "Add note…");
    const opened = await notePanel();
    await userEvent.click(within(opened).getByText("Markdown"));
    const markdown = within(opened).getByRole("textbox", { name: "Markdown" });
    await userEvent.type(markdown, "Kept");
    await userEvent.click(within(opened).getByRole("button", { name: "Save" }));
    expect(await within(opened).findByRole("alert")).toBeDefined();
    expect((markdown as HTMLTextAreaElement).value).toBe("Kept");
  });

  it("leaves the timeline and the stream's panel waiting, and opens no other stream, while the note is being changed", async () => {
    const other = fictionalStream({
      id: "10000000-0000-4000-8000-000000000002",
      name: "Fictional Other",
    });
    const { history } = await openStream(
      [fictionalStream({ releases: [noted] }), other],
      { can: editsAll },
    );
    await userEvent.click(noteButton());
    const opened = await notePanel();
    expect(panel().closest("[inert]")).toBeNull();
    await userEvent.click(within(opened).getByText("Editor"));
    expect(panel().hasAttribute("inert")).toBe(true);
    expect(
      screen
        .getByRole("region", { name: "Timeline", hidden: true })
        .closest("[inert]"),
    ).not.toBeNull();
    await userEvent.click(await detailsOf("Fictional Other"));
    expect(history.location.pathname).toBe(`/releases/${streamId}`);
    await userEvent.click(
      within(opened).getByRole("button", { name: "Cancel" }),
    );
    await waitFor(() => {
      expect(panel().hasAttribute("inert")).toBe(false);
    });
    await waitFor(() => {
      expect(document.activeElement).toBe(noteButton());
    });
  });

  it("puts focus on the release's menu when a new note is cancelled", async () => {
    await openStream([fictionalStream({ releases: [release] })], {
      can: editsAll,
    });
    await chooseInMenu("Fictional One", "Add note…");
    const opened = await notePanel();
    await userEvent.click(
      within(opened).getByRole("button", { name: "Cancel" }),
    );
    await waitFor(() => {
      expect(document.activeElement).toBe(
        screen.getByRole("button", { name: "Menu of Fictional One" }),
      );
    });
  });

  it("stays as it is being written when a refresh shows the release held by someone else", async () => {
    let held = false;
    const fetch = serverAnswers({
      "GET /api/session": signedIn,
      "GET /api/release-streams": () =>
        answer(
          [
            fictionalStream({
              releases: [
                held ? { ...noted, heldBy: "Fictional Colleague" } : noted,
              ],
            }),
          ],
          editsAll,
        )(),
    });
    const reads = () =>
      fetch.mock.calls.filter(([url]) => url === "/api/release-streams").length;
    renderApp(`/releases/${streamId}`);
    await userEvent.click(
      await screen.findByRole("button", { name: "Fictional One note" }),
    );
    const opened = await notePanel();
    await userEvent.click(within(opened).getByText("Markdown"));
    await userEvent.type(
      within(opened).getByRole("textbox", { name: "Markdown" }),
      " more",
    );
    held = true;
    const before = reads();
    // Coming back to the window refreshes the streams.
    act(() => {
      focusManager.setFocused(false);
      focusManager.setFocused(true);
    });
    await waitFor(() => {
      expect(reads()).toBeGreaterThan(before);
    });
    const markdown = await within(opened).findByRole("textbox", {
      name: "Markdown",
    });
    expect((markdown as HTMLTextAreaElement).value).toBe(
      "Scope **frozen** for now more",
    );
  });

  it("opens no other note while one is being changed", async () => {
    const other = fictionalRelease({
      id: "30000000-0000-4000-8000-000000000002",
      name: "Fictional Two",
      firstCycle: "2027-04-01",
      lastCycle: "2027-04-01",
      note: "Fictional",
    });
    await openStream([fictionalStream({ releases: [noted, other] })], {
      can: editsAll,
    });
    await userEvent.click(noteButton());
    const opened = await notePanel();
    await userEvent.click(within(opened).getByText("Editor"));
    await userEvent.click(
      screen.getByRole("button", { name: "Fictional Two note" }),
    );
    expect(screen.getByRole("region", { name: "Fictional One" })).toBe(opened);
    expect(screen.queryByRole("region", { name: "Fictional Two" })).toBeNull();
  });
});
