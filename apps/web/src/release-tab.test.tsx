// SPDX-License-Identifier: Apache-2.0

// Tests for the Releases page's Releases tab as a whole.

import { cleanup, screen, waitFor, within } from "@testing-library/react";
import { userEvent } from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import {
  fictionalMinors,
  fictionalRelease,
  fictionalStream,
  streamId,
  streamsAnswer,
} from "./test-releases.ts";
import {
  bodyOf,
  renderApp,
  savedFiles,
  serverAnswers,
  signedIn,
} from "./test-support.tsx";
import { exportedCsv } from "./test-exports.tsx";
import {
  setUpEachTest,
  release,
  shipped,
  openPage,
  openRelease,
  inStream,
  bySchedule,
  searchOf,
  rowTexts,
  detailsOf,
} from "./test-release-tab.tsx";
import { plan } from "./test-projects-page.tsx";

setUpEachTest();

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
    await openPage(
      inStream(fictionalRelease({ lastCycle: "2027-04-01" })),
      bySchedule,
    );
    expect(rowTexts()).toEqual([
      "Fictional Majors1 release",
      "Fictional OneFictional MajorsJun 30, 202727.1 to 27.2",
    ]);
  });

  it("names each release's cycles alone, without their schedule, while the rows are in one list", async () => {
    await openPage(inStream(release));
    expect(rowTexts()).toEqual([
      "Fictional OneFictional MajorsMar 31, 202727.1",
    ]);
  });

  it("hides shipped releases until Show shipped is chosen in the Views menu, keeping the choice in the address", async () => {
    // Given a release to come and one shipped
    const { history } = await openPage(inStream(release, shipped), bySchedule);
    await detailsOf("Fictional One");
    expect(
      screen.queryByRole("button", {
        name: "Show details of Fictional Shipped",
      }),
    ).toBeNull();

    // When Show shipped is chosen
    await userEvent.click(
      screen.getByRole("button", { name: "Views, changed" }),
    );
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
      "GET /api/release-streams": streamsAnswer([fictionalStream()]),
    });
    renderApp("/releases");
    expect(await screen.findByText("No releases yet.")).toBeDefined();
  });

  it("draws on its timeline only the schedules of the releases it shows", async () => {
    await openPage([
      ...inStream(release),
      fictionalMinors({
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

describe("the Releases page's address", () => {
  it("keeps the tab and the view when a release is opened", async () => {
    const { history } = await openPage(inStream(release), bySchedule);
    await userEvent.click(await detailsOf("Fictional One"));
    await waitFor(() => {
      expect(searchOf(history).get("open")).toBe(release.id);
    });
    expect(searchOf(history).get("grouping")).toBe("schedule");
  });

  it("keeps the release open when the view changes", async () => {
    const { history } = await openRelease(inStream(release), {
      path: `/releases?grouping=schedule&open=${release.id}`,
    });
    await userEvent.click(
      screen.getByRole("button", { name: "Group by: Schedule" }),
    );
    await userEvent.click(
      await screen.findByRole("menuitem", { name: "None" }),
    );
    await waitFor(() => {
      expect(searchOf(history).has("grouping")).toBe(false);
    });
    expect(searchOf(history).get("open")).toBe(release.id);
  });

  it("starts the other tab afresh, with nothing open and its own view", async () => {
    const { history } = await openRelease(inStream(release), {
      path: `/releases?grouping=schedule&open=${release.id}`,
    });
    await userEvent.click(screen.getByRole("tab", { name: "Schedules" }));
    await screen.findByRole("grid", { name: "Schedules" });
    expect(history.location.search).toBe("?tab=schedules");
  });

  it("names no tab once back on Releases", async () => {
    serverAnswers({
      "GET /api/session": signedIn,
      "GET /api/release-streams": streamsAnswer(inStream(release)),
    });
    const history = renderApp("/releases?tab=schedules&grouping=status");
    await screen.findByRole("grid", { name: "Schedules" });
    await userEvent.click(screen.getByRole("tab", { name: "Releases" }));
    await screen.findByRole("grid", { name: "Releases" });
    expect(history.location.search).toBe("");
  });

  it("keeps the Schedules tab when a schedule is opened", async () => {
    serverAnswers({
      "GET /api/session": signedIn,
      "GET /api/release-streams": streamsAnswer(inStream(release)),
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
      "GET /api/release-streams": streamsAnswer(inStream(release)),
    });
    const history = renderApp(`/releases/${streamId}?grouping=status`);
    await screen.findByRole("heading", { name: "Fictional Majors", level: 2 });
    expect([
      history.location.pathname,
      Object.fromEntries(searchOf(history)),
    ]).toEqual([
      "/releases",
      { grouping: "status", tab: "schedules", open: streamId },
    ]);
  });
});

describe("exporting the Releases tab", () => {
  it("saves what it shows at once, asking nothing, since releases are General", async () => {
    // Given the Releases tab
    const files = savedFiles();
    await openPage(inStream(release));

    // When it is exported as a CSV file
    const { name, lines } = await exportedCsv(files);

    // Then no question is asked, and the file holds the release
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(name).toMatch(/^fathom_releases_fictional-person_.*\.csv$/u);
    expect(lines[0]).toMatch(/^Draft,Change,Release,/u);
    expect(lines.some((line) => line.includes("Fictional One"))).toBe(true);
  });

  it("holds the Features column only for a role sent the plan's features", async () => {
    // Given a role sent the plan's features, and one sent none
    const sent = savedFiles();
    await openPage(inStream(release), {
      answers: { "GET /api/projects": () => Response.json(plan()) },
    });
    await screen.findByRole("columnheader", { name: /^Features/u });
    const withFeatures = await exportedCsv(sent);
    cleanup();
    const unsent = savedFiles();
    await openPage(inStream(release));
    const withoutFeatures = await exportedCsv(unsent);

    // Then only the first file has a Features column, as only its table does
    expect(withFeatures.lines[0]?.split(",")).toContain("Features");
    expect(withoutFeatures.lines[0]?.split(",")).not.toContain("Features");
  });
});
