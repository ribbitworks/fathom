// SPDX-License-Identifier: Apache-2.0

// Tests for a cycle's details: its values, features and links, and changing its Duration.

import type { Cycle } from "@fathom/shared";
import { screen, waitFor, within } from "@testing-library/react";
import { userEvent } from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import {
  fictionalRelease,
  fictionalStream,
  quarters,
  streamId,
} from "./test-releases.ts";
import {
  bodyOf,
  detailRow,
  detailValue,
  fictionalFeature,
  planAnswers,
  recordCell,
  recordDraft,
  featuresAddress,
  openedIn,
  changesSent,
} from "./test-support.tsx";
import {
  setUpEachTest,
  changeSetId,
  editsStreams,
  openPage,
  cycleId,
  searchOf,
  openCycle,
  cycleHeading,
  cyclePanel,
} from "./test-cycle-tab.tsx";

setUpEachTest();

const panelHeading = () =>
  screen.getByRole("heading", { level: 2, name: cycleHeading });

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
    expect(changesSent(fetch, "PUT")).toHaveLength(1);
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
