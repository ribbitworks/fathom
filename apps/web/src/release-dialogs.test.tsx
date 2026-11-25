// SPDX-License-Identifier: Apache-2.0

// Tests for the Releases page's schedule dialogs, with the server's answers simulated: naming a
// stream, changing its cycles and one cycle's length, each with what it refuses before saving,
// what it sends, and what it does while and once it saves.

import { releaseLengths } from "@fathom/shared";
import { screen, waitFor } from "@testing-library/react";
import { userEvent } from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { dayNeeded } from "./day-input.tsx";
import {
  CycleLengthDialog,
  PatternDialog,
  StreamDialog,
} from "./release-dialogs.tsx";
import {
  bodiesOf,
  box,
  choose,
  picker,
  changeSetId,
  cyclesIn,
  savedStream,
  show,
  stream,
  streamPath,
} from "./test-release-dialogs.tsx";
import {
  fictionalPattern,
  fictionalRelease,
  fictionalStream,
  streamId,
} from "./test-releases.ts";
import {
  recordDraft,
  serverAnswers,
  signedOut,
  noFeatureColumns,
  featureDraft,
} from "./test-support.tsx";

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("the dialog naming a release stream", () => {
  it("adds a stream with the name typed, without spaces around it", async () => {
    const fetch = serverAnswers({ "POST /api/release-streams": savedStream });
    const { onSaved } = show((handlers) => (
      <StreamDialog streams={[stream]} {...handlers} />
    ));
    await userEvent.type(box("Name"), "  Fictional Minors  ");
    await userEvent.click(screen.getByRole("button", { name: "Add schedule" }));
    await waitFor(() => {
      expect(onSaved.mock.calls[0]?.[0]).toEqual({ stream, changeSetId });
    });
    expect(bodiesOf(fetch)).toEqual([{ name: "Fictional Minors" }]);
  });

  it("renames a stream, which may keep its own name", async () => {
    const fetch = serverAnswers({ [`PUT ${streamPath}`]: savedStream });
    const { onSaved } = show((handlers) => (
      <StreamDialog stream={stream} streams={[stream]} {...handlers} />
    ));
    await userEvent.click(screen.getByRole("button", { name: "Save" }));
    await waitFor(() => {
      expect(onSaved).toHaveBeenCalled();
    });
    expect(bodiesOf(fetch)).toEqual([{ name: "Fictional Majors" }]);
  });

  it("asks for a name once submitted without one", async () => {
    const fetch = serverAnswers({});
    show((handlers) => <StreamDialog streams={[]} {...handlers} />);
    await userEvent.click(screen.getByRole("button", { name: "Add schedule" }));
    expect([screen.getByText("Name needed"), fetch.mock.calls]).toEqual([
      expect.anything(),
      [],
    ]);
  });

  it("says a name is too long as it is typed", async () => {
    show((handlers) => <StreamDialog streams={[]} {...handlers} />);
    await userEvent.type(box("Name"), "x".repeat(41));
    expect(screen.getByText("Too long")).toBeDefined();
  });

  it("refuses the name of another stream, whatever its case", async () => {
    show((handlers) => <StreamDialog streams={[stream]} {...handlers} />);
    await userEvent.type(box("Name"), "fictional majors");
    expect(screen.getByText("Already used")).toBeDefined();
  });

  it("is busy while it saves, and not once saved", async () => {
    serverAnswers({ "POST /api/release-streams": savedStream });
    const { onBusy, onSaved } = show((handlers) => (
      <StreamDialog streams={[]} {...handlers} />
    ));
    await userEvent.type(box("Name"), "Fictional Minors");
    await userEvent.click(screen.getByRole("button", { name: "Add schedule" }));
    await waitFor(() => {
      expect(onSaved).toHaveBeenCalled();
    });
    expect(onBusy.mock.calls).toEqual([[true], [false]]);
  });

  it("says why the server refused the change", async () => {
    serverAnswers({
      "POST /api/release-streams": () =>
        Response.json({ error: "Fictional refusal" }, { status: 409 }),
    });
    show((handlers) => <StreamDialog streams={[]} {...handlers} />);
    await userEvent.type(box("Name"), "Fictional Minors");
    await userEvent.click(screen.getByRole("button", { name: "Add schedule" }));
    expect((await screen.findByRole("alert")).textContent).toBe(
      "Fictional refusal",
    );
  });

  it("cancels", async () => {
    const { onCancel } = show((handlers) => (
      <StreamDialog streams={[]} {...handlers} />
    ));
    await userEvent.click(screen.getByRole("button", { name: "Cancel" }));
    expect(onCancel).toHaveBeenCalled();
  });
});

describe("the dialog changing a stream's cycles", () => {
  const empty = fictionalStream({ patterns: [], cycles: [] });

  it("sets up the cycles of a stream without any from the day typed", async () => {
    const fetch = serverAnswers({
      [`POST ${streamPath}/patterns`]: savedStream,
    });
    const { onSaved } = show((handlers) => (
      <PatternDialog stream={empty} {...handlers} />
    ));
    await userEvent.type(box("First cycle starts"), "20270101");
    await userEvent.click(
      screen.getByRole("button", { name: "Set up cycles" }),
    );
    await waitFor(() => {
      expect(onSaved).toHaveBeenCalled();
    });
    expect(bodiesOf(fetch)).toEqual([
      { startsOn: "2027-01-01", length: 3, unit: "months", naming: "{YY}.{N}" },
    ]);
  });

  it("starts a new pattern from the cycle given, as the one in force there makes cycles", async () => {
    // Given a schedule of fortnights named Sprint, from a cycle of it
    const fetch = serverAnswers({
      [`POST ${streamPath}/patterns`]: savedStream,
    });
    const sprints = fictionalStream({
      patterns: [
        fictionalPattern({ unit: "weeks", length: 2, naming: "Sprint {N}" }),
      ],
    });
    const { onSaved } = show((handlers) => (
      <PatternDialog stream={sprints} from="2027-01-15" {...handlers} />
    ));

    // When the change is saved as it opens
    await userEvent.click(
      screen.getByRole("button", { name: "Change cycles" }),
    );

    // Then it starts on that cycle, as long and named as the pattern in force
    await waitFor(() => {
      expect(onSaved).toHaveBeenCalled();
    });
    expect(bodiesOf(fetch)).toEqual([
      {
        startsOn: "2027-01-15",
        length: 2,
        unit: "weeks",
        naming: "Sprint {N}",
      },
    ]);
  });

  it("shows the first cycles the pattern makes", async () => {
    show((handlers) => <PatternDialog stream={empty} {...handlers} />);
    await userEvent.type(box("First cycle starts"), "20270101");
    expect(cyclesIn("First cycles")).toEqual([
      "27.1Jan 1 to Mar 31, 2027",
      "27.2Apr 1 to Jun 30, 2027",
      "27.3Jul 1 to Sep 30, 2027",
    ]);
  });

  it("makes cycles of weeks once the unit is changed", async () => {
    show((handlers) => <PatternDialog stream={empty} {...handlers} />);
    await userEvent.type(box("First cycle starts"), "20270104");
    await userEvent.click(screen.getByText("Weeks"));
    expect(cyclesIn("First cycles")[0]).toBe("27.1Jan 4 to Jan 24, 2027");
  });

  it("makes cycles of months again once the unit is changed back", async () => {
    show((handlers) => (
      <PatternDialog
        stream={stream}
        pattern={fictionalPattern({ unit: "weeks", length: 2 })}
        {...handlers}
      />
    ));
    await userEvent.click(screen.getByText("Months"));
    expect(cyclesIn("First cycles")[0]).toBe("27.1Jan 1 to Feb 28, 2027");
  });

  it("shows no cycles until a whole day is typed", async () => {
    show((handlers) => <PatternDialog stream={empty} {...handlers} />);
    await userEvent.type(box("First cycle starts"), "2027");
    expect(screen.queryByRole("table", { name: "First cycles" })).toBeNull();
  });

  it("asks for the day the first cycle starts before saving", async () => {
    const fetch = serverAnswers({});
    show((handlers) => <PatternDialog stream={empty} {...handlers} />);
    await userEvent.click(
      screen.getByRole("button", { name: "Set up cycles" }),
    );
    expect([screen.getByText(dayNeeded), fetch.mock.calls]).toEqual([
      expect.anything(),
      [],
    ]);
  });

  it("refuses cycles longer than two years", async () => {
    const fetch = serverAnswers({});
    show((handlers) => (
      <PatternDialog
        stream={stream}
        pattern={fictionalPattern({ unit: "weeks", length: 30 })}
        {...handlers}
      />
    ));
    await userEvent.click(screen.getByText("Months"));
    await userEvent.click(screen.getByRole("button", { name: "Save" }));
    expect([screen.getByText("From 1 to two years"), fetch.mock.calls]).toEqual(
      [expect.anything(), []],
    );
  });

  it("refuses a pattern for the names that is too long", async () => {
    const fetch = serverAnswers({});
    show((handlers) => (
      <PatternDialog
        stream={stream}
        pattern={fictionalPattern()}
        {...handlers}
      />
    ));
    await userEvent.clear(box("Names"));
    await userEvent.type(box("Names"), "Q".repeat(releaseLengths.naming + 1));
    await userEvent.click(screen.getByRole("button", { name: "Save" }));
    expect([screen.getByText("Too long"), fetch.mock.calls]).toEqual([
      expect.anything(),
      [],
    ]);
  });

  it("asks for a pattern for the names before saving", async () => {
    const fetch = serverAnswers({});
    show((handlers) => (
      <PatternDialog
        stream={stream}
        pattern={fictionalPattern()}
        {...handlers}
      />
    ));
    await userEvent.clear(box("Names"));
    await userEvent.click(screen.getByRole("button", { name: "Save" }));
    expect([screen.getByText("Names needed"), fetch.mock.calls]).toEqual([
      expect.anything(),
      [],
    ]);
  });

  it("changes a change of cycles by its id", async () => {
    const pattern = fictionalPattern();
    const fetch = serverAnswers({
      [`PUT ${streamPath}/patterns/${pattern.id}`]: savedStream,
    });
    const { onSaved } = show((handlers) => (
      <PatternDialog stream={stream} pattern={pattern} {...handlers} />
    ));
    await userEvent.clear(box("Names"));
    await userEvent.type(box("Names"), "Q{{N}");
    await userEvent.click(screen.getByRole("button", { name: "Save" }));
    await waitFor(() => {
      expect(onSaved).toHaveBeenCalled();
    });
    expect(bodiesOf(fetch)).toEqual([
      { startsOn: "2027-01-01", length: 3, unit: "months", naming: "Q{N}" },
    ]);
  });

  // A stream whose cycles change from 2027-07-01 to cycles of one month.
  const second = fictionalPattern({
    id: "20000000-0000-4000-8000-000000000002",
    startsOn: "2027-07-01",
    length: 1,
  });
  const changing = fictionalStream({
    patterns: [fictionalPattern(), second],
  });

  it("changes the cycles from the start of the last cycle, unless another is chosen", async () => {
    const fetch = serverAnswers({
      [`POST ${streamPath}/patterns`]: savedStream,
    });
    const { onSaved } = show((handlers) => (
      <PatternDialog stream={changing} {...handlers} />
    ));
    await userEvent.click(
      screen.getByRole("button", { name: "Change cycles" }),
    );
    await waitFor(() => {
      expect(onSaved).toHaveBeenCalled();
    });
    expect(bodiesOf(fetch)).toEqual([
      { startsOn: "2027-12-01", length: 3, unit: "months", naming: "{YY}.{N}" },
    ]);
  });

  it("names the first cycles of a change as the stream will, counting the cycles before it", async () => {
    show((handlers) => <PatternDialog stream={changing} {...handlers} />);
    await choose("From the start of", "Apr 1, 2027 (27.2)");
    expect(cyclesIn("First cycles")).toEqual([
      "27.2Apr 1 to Jun 30, 2027",
      "27.3Jul 1 to Jul 31, 2027",
      "27.4Aug 1 to Aug 31, 2027",
    ]);
  });

  it("changes the cycles from the start of the cycle chosen", async () => {
    const fetch = serverAnswers({
      [`POST ${streamPath}/patterns`]: savedStream,
    });
    const { onSaved } = show((handlers) => (
      <PatternDialog stream={changing} {...handlers} />
    ));
    await choose("From the start of", "Apr 1, 2027 (27.2)");
    await userEvent.click(
      screen.getByRole("button", { name: "Change cycles" }),
    );
    await waitFor(() => {
      expect(onSaved).toHaveBeenCalled();
    });
    expect(bodiesOf(fetch)).toEqual([
      expect.objectContaining({ startsOn: "2027-04-01" }),
    ]);
  });

  it("offers the starts of the cycles the other changes make, for a later change", () => {
    show((handlers) => (
      <PatternDialog stream={changing} pattern={second} {...handlers} />
    ));
    expect(picker("From the start of").value).toBe("Jul 1, 2027 (27.3)");
  });

  it("lets the earliest change start on any day", () => {
    show((handlers) => (
      <PatternDialog
        stream={changing}
        pattern={fictionalPattern()}
        {...handlers}
      />
    ));
    expect(box("First cycle starts").value).toBe("2027-01-01");
  });

  it("lets a change start on any day once the others are drafted to be removed", () => {
    const removing = fictionalStream({
      patterns: [
        fictionalPattern({ draft: recordDraft({ action: "deleted" }) }),
      ],
    });
    show((handlers) => <PatternDialog stream={removing} {...handlers} />);
    expect([
      box("First cycle starts"),
      screen.getByRole("button", { name: "Change cycles" }),
    ]).toEqual([expect.anything(), expect.anything()]);
  });

  it("asks for a cycle when the other changes make none to choose from", async () => {
    // The only change kept starts after the stream's cycles end.
    const fetch = serverAnswers({});
    const later = fictionalStream({
      patterns: [
        fictionalPattern({ draft: recordDraft({ action: "deleted" }) }),
        { ...second, startsOn: "2029-01-01" },
      ],
    });
    show((handlers) => <PatternDialog stream={later} {...handlers} />);
    await userEvent.click(
      screen.getByRole("button", { name: "Change cycles" }),
    );
    expect([screen.getByText("Choose a cycle"), fetch.mock.calls]).toEqual([
      expect.anything(),
      [],
    ]);
  });
});

describe("the dialog changing one cycle's length", () => {
  const second = stream.cycles[1] as (typeof stream.cycles)[number];
  const withLater = fictionalStream({
    releases: [
      fictionalRelease({
        name: "Fictional Later",
        firstCycle: "2027-07-01",
        lastCycle: "2027-10-01",
      }),
    ],
  });
  const lengthBox = () =>
    screen.getByRole<HTMLInputElement>("textbox", { name: "Length" });

  async function typeLength(length: string) {
    await userEvent.clear(lengthBox());
    await userEvent.type(lengthBox(), length);
  }

  it("shows the cycles it makes, and the releases that move with them", async () => {
    show((handlers) => (
      <CycleLengthDialog stream={withLater} cycle={second} {...handlers} />
    ));
    expect(lengthBox().value).toBe("3");
    expect(cyclesIn("New dates")).toEqual([
      "27.2Apr 1 to Jun 30, 2027",
      "27.3Jul 1 to Sep 30, 2027",
      "27.4Oct 1 to Dec 31, 2027",
    ]);
    await typeLength("2");
    expect(cyclesIn("New dates")).toEqual([
      "27.2Apr 1 to May 31, 2027",
      "27.3Jun 1 to Aug 31, 2027",
      "27.4Sep 1 to Nov 30, 2027",
    ]);
    expect(screen.queryByText("Releases that move")).not.toBeNull();
    expect(screen.queryByText("Fictional Later")).not.toBeNull();
    expect(screen.queryByText("Features that move")).toBeNull();
    expect(
      screen.queryByText("Fictional Later ships 2027-11-30."),
    ).not.toBeNull();
  });

  it("names the features that move with their cycles", async () => {
    const featureOf = (name: string, more: object) => ({
      id: name,
      keyNumber: 1,
      name,
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
      estimateHours: null,
      featureTeamId: null,
      description: null,
      targetStreamId: streamId,
      targetCycle: "2027-07-01",
      ...more,
    });
    serverAnswers({
      "GET /api/projects": () =>
        Response.json({
          customers: [],
          projects: [],
          proposals: [],
          features: [
            featureOf("Fictional Moved", {}),
            featureOf("Fictional Elsewhere", { targetStreamId: "other" }),
            featureOf("Fictional Removed", {
              draft: featureDraft({ action: "deleted" }),
            }),
          ],
          canEdit: false,
          canEditFeatures: false,
          featureColumns: noFeatureColumns,
          activities: [],
          activityColumns: noFeatureColumns,
        }),
    });
    show((handlers) => (
      <CycleLengthDialog stream={stream} cycle={second} {...handlers} />
    ));
    await waitFor(() => {
      expect(lengthBox().value).toBe("3");
    });
    await typeLength("2");
    expect(await screen.findByText("Features that move")).not.toBeNull();
    expect(screen.queryByText("Fictional Moved")).not.toBeNull();
  });

  it("names no features to one the server refuses the plan", async () => {
    serverAnswers({
      "GET /api/projects": () => new Response(null, { status: 403 }),
    });
    show((handlers) => (
      <CycleLengthDialog stream={withLater} cycle={second} {...handlers} />
    ));
    await typeLength("2");
    expect(await screen.findByText("Releases that move")).not.toBeNull();
    expect(screen.queryByText("Features that move")).toBeNull();
    expect(screen.queryByRole("alert")).toBeNull();
  });

  it("keeps the next cycle's end date when asked, moving no release after it", async () => {
    const lastOnly = fictionalStream({
      releases: [
        fictionalRelease({
          name: "Fictional Last",
          firstCycle: "2027-10-01",
          lastCycle: "2027-10-01",
        }),
      ],
    });
    show((handlers) => (
      <CycleLengthDialog stream={lastOnly} cycle={second} {...handlers} />
    ));
    await typeLength("2");
    await userEvent.click(
      screen.getByRole("radio", { name: "Keep their dates" }),
    );
    expect(cyclesIn("New dates")).toEqual([
      "27.2Apr 1 to May 31, 2027",
      "27.3Jun 1 to Sep 30, 2027",
      "27.4Oct 1 to Dec 31, 2027",
    ]);
    expect(screen.queryByText(/with its cycles|ships/)).toBeNull();
  });

  it("sends the length and what happens to later cycles", async () => {
    const fetch = serverAnswers({
      [`PUT ${streamPath}/cycles/2027-04-01/length`]: savedStream,
    });
    const { onSaved } = show((handlers) => (
      <CycleLengthDialog stream={stream} cycle={second} {...handlers} />
    ));
    await typeLength("4");
    await userEvent.click(
      screen.getByRole("button", { name: "Change length" }),
    );
    await waitFor(() => {
      expect(onSaved).toHaveBeenCalled();
    });
    expect(bodiesOf(fetch)).toEqual([{ length: 4, later: "move" }]);
  });

  it("refuses the length the cycle has now, once asked to save", async () => {
    const fetch = serverAnswers({});
    show((handlers) => (
      <CycleLengthDialog stream={stream} cycle={second} {...handlers} />
    ));
    expect(screen.queryByRole("alert")).toBeNull();
    await userEvent.click(
      screen.getByRole("button", { name: "Change length" }),
    );
    expect(screen.getByRole("alert").textContent).toBe("Choose a new length.");
    expect(bodiesOf(fetch)).toEqual([]);
  });

  it("names every release that moves", async () => {
    const both = fictionalStream({
      releases: [
        fictionalRelease({
          name: "Fictional Third",
          firstCycle: "2027-07-01",
          lastCycle: "2027-07-01",
        }),
        fictionalRelease({
          id: "30000000-0000-4000-8000-000000000002",
          name: "Fictional Fourth",
          firstCycle: "2027-10-01",
          lastCycle: "2027-10-01",
        }),
      ],
    });
    show((handlers) => (
      <CycleLengthDialog stream={both} cycle={second} {...handlers} />
    ));
    await typeLength("2");
    expect(
      screen.queryByText("Fictional Third and Fictional Fourth"),
    ).not.toBeNull();
  });

  it("counts in the unit of the pattern that makes the cycle", async () => {
    const sprints = fictionalStream({
      patterns: [fictionalPattern({ length: 2, unit: "weeks" })],
      cycles: [
        {
          startsOn: "2027-01-01",
          endsOn: "2027-01-14",
          name: "27.1",
          months: [],
        },
      ],
    });
    show((handlers) => (
      <CycleLengthDialog
        stream={sprints}
        cycle={sprints.cycles[0] as (typeof sprints.cycles)[number]}
        {...handlers}
      />
    ));
    expect(screen.getByText("weeks")).not.toBeNull();
    await typeLength("1");
    expect(screen.getByText("week")).not.toBeNull();
    expect(cyclesIn("New dates")[0]).toBe("27.1Jan 1 to Jan 7, 2027");
  });

  it("asks for a length from one cycle to two years", async () => {
    const fetch = serverAnswers({});
    show((handlers) => (
      <CycleLengthDialog stream={stream} cycle={second} {...handlers} />
    ));
    await userEvent.clear(lengthBox());
    await userEvent.click(
      screen.getByRole("button", { name: "Change length" }),
    );
    expect(screen.getByText("From 1 to two years")).not.toBeNull();
    expect(bodiesOf(fetch)).toEqual([]);
  });

  it("refuses moving a release's first cycle after its Ships on day", async () => {
    const shipping = fictionalStream({
      releases: [
        fictionalRelease({
          name: "Fictional Later",
          firstCycle: "2027-07-01",
          lastCycle: "2027-10-01",
          shipsOn: "2027-07-15",
        }),
      ],
    });
    show((handlers) => (
      <CycleLengthDialog stream={shipping} cycle={second} {...handlers} />
    ));
    await typeLength("4");
    expect(screen.getByRole("alert").textContent).toBe(
      "Fictional Later would start after it ships on 2027-07-15.",
    );
  });

  it("names no release in a refusal until it knows the role sees them", async () => {
    serverAnswers({ "GET /api/session": signedOut });
    const shipping = fictionalStream({
      releases: [
        fictionalRelease({
          name: "Fictional Later",
          firstCycle: "2027-07-01",
          lastCycle: "2027-10-01",
          shipsOn: "2027-07-15",
        }),
      ],
    });
    show(
      (handlers) => (
        <CycleLengthDialog stream={shipping} cycle={second} {...handlers} />
      ),
      { signedIn: false },
    );

    await typeLength("4");

    expect(screen.getByRole("alert").textContent).toBe(
      "Work planned on these cycles would start after the day it ships.",
    );
  });
});
