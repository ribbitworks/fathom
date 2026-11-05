// SPDX-License-Identifier: Apache-2.0

// Tests for the Releases page: each release stream with how its cycles are made, its releases, and
// its cycles, and what those who see the plan may do there.

import type { ReleaseStream, ReleaseStreams } from "@fathom/shared";
import { fireEvent, screen, waitFor, within } from "@testing-library/react";
import { userEvent } from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  fictionalPattern,
  fictionalRelease,
  fictionalStream,
  fictionalUser,
  recordDraft,
  renderApp,
  serverAnswers,
  signedIn,
  streamId,
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
      await screen.findByRole("link", { name: "Fictional Majors" }),
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
    permissions: ["plan:view", "drafts:approve"],
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

const rowTexts = () =>
  within(screen.getByRole("table", { name: "Release streams" }))
    .getAllByRole("row")
    .map(({ textContent }) => textContent);

function calls(fetch: ReturnType<typeof serverAnswers>, method: string) {
  return fetch.mock.calls
    .filter(([, init]) => init?.method === method)
    .map(([url]) => url);
}

describe("the table of release streams", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("puts retired streams after the rest", async () => {
    serverAnswers({
      "GET /api/session": signedIn,
      "GET /api/release-streams": answer([
        fictionalStream({ id: "s1", name: "Fictional Old", retired: true }),
        fictionalStream({ id: "s2", name: "Fictional New", patterns: [] }),
      ]),
    });
    renderApp("/releases");
    await screen.findByRole("table", { name: "Release streams" });
    expect(rowTexts()).toEqual([
      "NameCycles nowReleases",
      "Fictional NewNo cycles yet(0) ",
      "Retired",
      "Fictional OldEvery 3 months, named {YY}.{N}(0) ",
    ]);
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

  it("shows the first cycles when none has started yet", async () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date("2026-08-15T12:00:00Z"));
    serverAnswers({
      "GET /api/session": signedIn,
      "GET /api/release-streams": answer([
        fictionalStream({
          patterns: [fictionalPattern({ length: 2, unit: "weeks" })],
        }),
      ]),
    });
    renderApp("/releases");
    expect(
      await screen.findByText("Every 2 weeks, named {YY}.{N}"),
    ).toBeDefined();
  });

  it("lists a stream's releases, leaving out those drafted to be removed", async () => {
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
    await screen.findByRole("table", { name: "Release streams" });
    expect(rowTexts()[1]).toMatch(/\(1\) Fictional One$/);
  });

  it("marks each stream's draft, saying when it retires or restores the stream", async () => {
    const changing = (id: string, name: string, fields: object) =>
      fictionalStream({ id, name, draft: recordDraft(fields) });
    serverAnswers({
      "GET /api/session": signedIn,
      "GET /api/release-streams": answer([
        changing("s1", "Fictional A", { action: "created" }),
        changing("s2", "Fictional B", { changed: ["name"] }),
        changing("s3", "Fictional C", { changed: ["name", "retired"] }),
        {
          ...changing("s4", "Fictional D", { changed: ["retired"] }),
          retired: true,
        },
        changing("s5", "Fictional E", {
          changed: ["retired"],
          state: "rejected",
        }),
        changing("s6", "Fictional F", { changed: ["retired"] }),
      ]),
    });
    renderApp("/releases");
    await screen.findByRole("table", { name: "Release streams" });
    expect(
      rowTexts()
        .slice(1)
        .map((text) => text.replace(/Every.*$/, "")),
    ).toEqual([
      "Fictional A Draft: added",
      "Fictional B Draft",
      "Fictional C Draft",
      "Fictional E Rejected",
      "Fictional F Draft: restored",
      "Retired",
      "Fictional D Draft: retired",
    ]);
  });

  it("tints the row of a stream when only something in it has a draft", async () => {
    serverAnswers({
      "GET /api/session": signedIn,
      "GET /api/release-streams": answer([
        fictionalStream({
          releases: [fictionalRelease({ draft: recordDraft() })],
        }),
      ]),
    });
    renderApp("/releases");
    const link = await screen.findByRole("link", { name: "Fictional Majors" });
    expect(link.closest("[role=row]")?.className).toMatch(/draftRow/);
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
    expect(
      await screen.findByRole("link", { name: "Fictional Majors" }),
    ).toBeDefined();
  });

  it("opens a stream from its row", async () => {
    serverAnswers({
      "GET /api/session": signedIn,
      "GET /api/release-streams": answer([fictionalStream()]),
    });
    const history = renderApp("/releases");
    const link = await screen.findByRole("link", { name: "Fictional Majors" });
    await userEvent.click(link.closest("[role=row]") as HTMLElement);
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
      "27.1 · ships 2027-03-31",
      "27.2 to 27.3 · ships 2027-08-15, 46 days before 27.3 ends",
      "2031-01-01 · ships ",
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
      "28.12027-12-162028-02-29Fictional OneDec 2027 52%, Jan 2028, Feb",
      "28.22028-03-012028-03-31Mar 2028",
    ]);
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
    "closes with %s, putting focus on the stream's link",
    async (_case, close) => {
      const { history } = await openStream([fictionalStream()]);
      await close();
      await waitFor(() => {
        expect([history.location.pathname, document.activeElement]).toEqual([
          "/releases",
          screen.getByRole("link", { name: "Fictional Majors" }),
        ]);
      });
    },
  );

  it("stays open when a key other than Escape is pressed in it", async () => {
    const { history } = await openStream([fictionalStream()]);
    screen.getByRole("button", { name: "Close" }).focus();
    await userEvent.keyboard("{Shift}");
    expect(history.location.pathname).toBe(`/releases/${streamId}`);
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
      within(panel()).getByText("Being changed"),
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
    await chooseInMenu("Cycles from 2027-01-01", "Change…");
    const dialog = await screen.findByRole("dialog", {
      name: "Cycles from 2027-01-01",
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
    await chooseInMenu("Cycles from 2027-01-01", "Remove");
    expect(
      await screen.findByText("Drafted removing the cycles from 2027-01-01."),
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
      screen.getByRole("button", { name: "Menu of Cycles from 2027-01-01" }),
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
      await screen.findByRole("menuitem", { name: "End date…" }),
    );
    const dialog = await screen.findByRole("dialog", {
      name: "Change when Fictional Majors's cycles end",
    });
    await userEvent.click(within(dialog).getByRole("button", { name: "Save" }));
    expect(
      await screen.findByText("Drafted the change to the cycles."),
    ).toBeDefined();
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

describe("drafts in a stream's panel", () => {
  const draftPath = `/api/records/release/${release.id}/draft`;

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
        "Only you see these changes until you publish them.",
      ),
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
      screen.getByRole("button", { name: "Menu of Cycles from 2027-01-01" }),
    );
    const menu = await screen.findByRole("menu");
    expect(
      within(menu)
        .getAllByRole("menuitem")
        .map(({ textContent }) => textContent),
    ).toEqual(["Change…", "Remove", "Discard draft"]);
  });
});
