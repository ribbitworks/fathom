// SPDX-License-Identifier: Apache-2.0

// Tests for the Releases page's Schedules table.

import { screen, waitFor, within } from "@testing-library/react";
import { userEvent } from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  fictionalMinors,
  fictionalPattern,
  fictionalRelease,
  fictionalStream,
  streamId,
  streamsAnswer,
} from "./test-releases.ts";
import {
  bodyOf,
  detailRow,
  detailValue,
  fictionalFeature,
  planAnswers,
  recordCell,
  recordDraft,
  renderApp,
  savedFiles,
  serverAnswers,
  signedIn,
  featuresAddress,
  openedIn,
} from "./test-support.tsx";
import { exportedCsv } from "./test-exports.tsx";
import {
  setUpEachTest,
  approver,
  pattern,
  release,
  panel,
  openIn,
  streamsGrid,
  rowTexts,
  cellOf,
  detailsOf,
  chooseInColumn,
  calls,
} from "./test-releases-page.tsx";

setUpEachTest();

describe("the Schedules table", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("shows each schedule's current cycle and its days, next release and its day, and how long cycles last", async () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date("2027-02-15T12:00:00Z"));
    serverAnswers({
      "GET /api/session": signedIn,
      "GET /api/release-streams": streamsAnswer([
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
      "GET /api/release-streams": streamsAnswer([fictionalStream()]),
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
        "GET /api/release-streams": streamsAnswer([fictionalStream()]),
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
        "GET /api/release-streams": streamsAnswer([
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
      "GET /api/release-streams": streamsAnswer([
        fictionalStream({ releases: [fictionalRelease()] }),
        fictionalMinors({
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
      "GET /api/release-streams": streamsAnswer([fictionalStream()]),
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
      "GET /api/release-streams": streamsAnswer([fictionalStream()]),
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
      "GET /api/release-streams": streamsAnswer([fictionalStream()]),
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
      "GET /api/release-streams": streamsAnswer([
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
      "GET /api/release-streams": streamsAnswer([
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
      "GET /api/release-streams": streamsAnswer([fictionalStream()]),
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
      "GET /api/release-streams": streamsAnswer([
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
      "GET /api/release-streams": streamsAnswer([
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
      "GET /api/release-streams": streamsAnswer([fictionalStream()]),
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
      "GET /api/release-streams": streamsAnswer([fictionalStream()]),
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
      "GET /api/release-streams": streamsAnswer([
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
      "GET /api/release-streams": streamsAnswer([
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
      "GET /api/release-streams": streamsAnswer([
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
      "GET /api/release-streams": streamsAnswer([
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

  it("shows a schedule's empty cycle length in its Live row as Live's dot alone while a draft adds its first cycles", async () => {
    serverAnswers({
      "GET /api/session": signedIn,
      "GET /api/release-streams": streamsAnswer([
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
    expect(liveRow.textContent).not.toContain("No cycle length");
    expect(liveRow.textContent).toContain("Fictional Majors");
  });

  it("finds streams by any word in them", async () => {
    serverAnswers({
      "GET /api/session": signedIn,
      "GET /api/release-streams": streamsAnswer([
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
      "GET /api/release-streams": streamsAnswer([
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
      "GET /api/release-streams": streamsAnswer([
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

  it("keeps its table while there are no schedules yet, saying so in it", async () => {
    serverAnswers({
      "GET /api/session": signedIn,
      "GET /api/release-streams": streamsAnswer([]),
    });
    renderApp("/releases?tab=schedules");
    const table = await screen.findByRole("grid", { name: "Schedules" });
    expect(within(table).getByText("No schedules yet")).toBeDefined();
    expect(screen.getByText("0 schedules")).toBeDefined();
  });

  it("says when the streams cannot be loaded, and loads them when tried again", async () => {
    let tries = 0;
    serverAnswers({
      "GET /api/session": signedIn,
      "GET /api/release-streams": () => {
        tries += 1;
        return tries === 1
          ? Response.json({ error: "Broken" }, { status: 500 })
          : streamsAnswer([fictionalStream()])();
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
      "GET /api/release-streams": streamsAnswer([fictionalStream()]),
    });
    const history = renderApp("/releases?tab=schedules");
    await userEvent.click(await detailsOf("Fictional Majors"));
    await waitFor(() => {
      expect(openIn(history)).toBe(streamId);
    });
  });
});

describe("exporting the Schedules tab", () => {
  it("saves what it shows at once, asking nothing, since schedules are General", async () => {
    // Given the Schedules tab
    const files = savedFiles();
    serverAnswers({
      "GET /api/session": signedIn,
      "GET /api/release-streams": streamsAnswer([fictionalStream()]),
    });
    renderApp("/releases?tab=schedules");
    await streamsGrid();

    // When it is exported as a CSV file
    const { name, lines } = await exportedCsv(files);

    // Then no question is asked, and the file holds what the table shows
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(name).toMatch(/^fathom_schedules_fictional-person_.*\.csv$/u);
    expect(lines[0]).toMatch(/^Draft,Change,Schedule,/u);
    expect(lines.some((line) => line.includes("Fictional Majors"))).toBe(true);
  });
});
