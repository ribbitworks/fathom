// SPDX-License-Identifier: Apache-2.0

// Tests for the Releases page's Schedules tab as a whole: listing schedules, a schedule's panel,
// and adding, renaming, retiring and restoring schedules.

import { fireEvent, screen, waitFor, within } from "@testing-library/react";
import { userEvent } from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import {
  fictionalCycle,
  fictionalMinors,
  fictionalPattern,
  fictionalRelease,
  fictionalStream,
  streamId,
  streamsAnswer,
} from "./test-releases.ts";
import {
  recordCell,
  recordDraft,
  renderApp,
  serverAnswers,
  signedIn,
  onNarrowScreen,
} from "./test-support.tsx";
import {
  setUpEachTest,
  editsAll,
  changeSetId,
  streamPath,
  release,
  openStream,
  panel,
  openIn,
  chooseRowAction,
  detailsOf,
  calls,
} from "./test-releases-page.tsx";

setUpEachTest();

const streamsReply = streamsAnswer([
  fictionalStream({
    id: "s1",
    cyclesUntil: "2028-12-31",
    patterns: [fictionalPattern({ id: "p1" })],
    cycles: [
      fictionalCycle("27.1", "2027-01-01", "2027-03-31"),
      fictionalCycle("27.2", "2027-04-01", "2027-06-30"),
    ],
    releases: [fictionalRelease({ id: "r1", lastCycle: "2027-04-01" })],
  }),
]);

describe("the Releases page", () => {
  it("lists every stream for those who see the plan", async () => {
    serverAnswers({
      "GET /api/session": signedIn,
      "GET /api/release-streams": streamsReply,
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
      "GET /api/release-streams": streamsReply,
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
      "GET /api/release-streams": streamsReply,
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
      "#SCHEDULE-1, copy link or key",
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
    onNarrowScreen();
    await openStream([fictionalStream()]);
    expect(
      screen
        .getByRole("dialog", { name: "Fictional Majors" })
        .getAttribute("aria-modal"),
    ).toBe("true");
  });
});

describe("changing streams", () => {
  it("offers no New schedule under Live only, where nothing new would show", async () => {
    serverAnswers({
      "GET /api/session": signedIn,
      "GET /api/release-streams": streamsAnswer([fictionalStream()], editsAll),
    });
    renderApp("/releases?tab=schedules&show=live");
    expect(await screen.findAllByText("Fictional Majors")).not.toHaveLength(0);
    expect(screen.queryByRole("button", { name: "New schedule" })).toBeNull();
  });

  it("adds a stream, and opens it", async () => {
    const added = fictionalMinors();
    const fetch = serverAnswers({
      "GET /api/session": signedIn,
      "GET /api/release-streams": streamsAnswer([fictionalStream()], editsAll),
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
      "GET /api/release-streams": streamsAnswer(
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
