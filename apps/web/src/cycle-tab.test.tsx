// SPDX-License-Identifier: Apache-2.0

// Tests for the Releases page's Cycles tab as a whole: its table, views and timeline.

import { screen, waitFor, within } from "@testing-library/react";
import { userEvent } from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import {
  fictionalCycle,
  fictionalMinors,
  fictionalRelease,
  fictionalStream,
  streamsAnswer,
} from "./test-releases.ts";
import { bodyOf, renderApp, serverAnswers, signedIn } from "./test-support.tsx";
import {
  setUpEachTest,
  bySchedule,
  openPage,
  searchOf,
  rowTexts,
  shortened,
} from "./test-cycle-tab.tsx";

setUpEachTest();

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
      "GET /api/release-streams": streamsAnswer([fictionalStream()]),
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
    fictionalMinors({
      cycles: [
        fictionalCycle("Last", "2027-09-30", "2027-09-30"),
        fictionalCycle("After", "2027-10-01", "2027-10-07"),
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
      "GET /api/release-streams": streamsAnswer([
        fictionalStream({ patterns: [], cycles: [] }),
      ]),
    });
    renderApp("/releases?tab=cycles");
    expect(await screen.findByText("No cycles yet.")).toBeDefined();
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
      "27.227.2, Apr 1 to Jun 30, 2027, current",
      "27.327.3, Jul 1 to Sep 30, 2027",
      "Fictional One ships Jun 30, 2027",
    ]);
    // The current cycle is marked as today's, and its tip says so.
    expect(
      items.map((item) => [
        item.getAttribute("aria-current"),
        item.getAttribute("data-tip"),
      ]),
    ).toEqual([
      ["date", "27.2: Apr 1 to Jun 30, 2027, current"],
      [null, "27.3: Jul 1 to Sep 30, 2027"],
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
      ["27.1: Jan 1 to Mar 31, 2027", true],
      ["27.2: Apr 1 to Jun 30, 2027, current", false],
      ["27.3: Jul 1 to Sep 30, 2027", false],
    ]);
  });

  it("draws the cycles shown as they are live under Live only", async () => {
    await openPage([shortened()], { path: "/releases?tab=cycles&show=live" });
    expect(
      within(lane("Fictional Majors"))
        .getAllByRole("listitem")
        .map((item) => item.getAttribute("data-tip")),
    ).toEqual([
      "27.2: Apr 1 to Jun 30, 2027, current",
      "27.3: Jul 1 to Sep 30, 2027",
    ]);
  });
});
