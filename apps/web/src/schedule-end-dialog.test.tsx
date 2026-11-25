// SPDX-License-Identifier: Apache-2.0

// Tests for the dialog ending a schedule, with the server's answers simulated: the cycles a day
// leaves, the days it refuses before saving, and what it sends.

import { screen, waitFor } from "@testing-library/react";
import { userEvent } from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { dayProblem } from "./day-input.tsx";
import { EndsDialog } from "./schedule-end-dialog.tsx";
import {
  bodiesOf,
  box,
  cyclesIn,
  savedStream,
  show,
  stream,
  streamPath,
} from "./test-release-dialogs.tsx";
import {
  fictionalFeature,
  fictionalPattern,
  fictionalRelease,
  fictionalStream,
  planAnswers,
  recordDraft,
  serverAnswers,
  streamId,
} from "./test-support.tsx";

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("the dialog ending a schedule", () => {
  it("ends the schedule on the day typed", async () => {
    const fetch = serverAnswers({ [`PUT ${streamPath}/ends-on`]: savedStream });
    const { onSaved } = show((handlers) => (
      <EndsDialog stream={stream} {...handlers} />
    ));
    await userEvent.type(box("Schedule ends"), "20270515");
    await userEvent.click(screen.getByRole("button", { name: "Save" }));
    await waitFor(() => {
      expect(onSaved).toHaveBeenCalled();
    });
    expect(bodiesOf(fetch)).toEqual([{ endsOn: "2027-05-15" }]);
  });

  it("shows how many cycles the day leaves, and the last cut to end on it", async () => {
    show((handlers) => <EndsDialog stream={stream} {...handlers} />);
    await userEvent.type(box("Schedule ends"), "20270515");
    expect([
      screen.getByText("2 cycles in all"),
      cyclesIn("Last cycles"),
    ]).toEqual([
      expect.anything(),
      ["27.1Jan 1 to Mar 31, 2027", "27.2Apr 1 to May 15, 2027"],
    ]);
  });

  it.each([
    ["several", "20280630", "6 cycles in all"],
    ["one", "20270201", "1 cycle in all"],
  ])("counts the cycles a day leaves: %s", async (_case, typed, count) => {
    show((handlers) => <EndsDialog stream={stream} {...handlers} />);
    await userEvent.type(box("Schedule ends"), typed);
    expect(screen.getByText(count)).toBeDefined();
  });

  it("shows no cycles while the schedule keeps going", () => {
    show((handlers) => <EndsDialog stream={stream} {...handlers} />);
    expect([
      screen.queryByText(/in all/),
      screen.queryByRole("table", { name: "Last cycles" }),
    ]).toEqual([null, null]);
  });

  it("counts no cycles from changes of cycles drafted to be removed", async () => {
    const removing = fictionalStream({
      patterns: [
        fictionalPattern({ draft: recordDraft({ action: "deleted" }) }),
      ],
    });
    show((handlers) => <EndsDialog stream={removing} {...handlers} />);
    await userEvent.type(box("Schedule ends"), "20270515");
    expect(screen.queryByText(/in all/)).toBeNull();
  });

  it("keeps a schedule going once its day is emptied", async () => {
    const fetch = serverAnswers({ [`PUT ${streamPath}/ends-on`]: savedStream });
    const ending = fictionalStream({ endsOn: "2027-05-15" });
    const { onSaved } = show((handlers) => (
      <EndsDialog stream={ending} {...handlers} />
    ));
    expect(box("Schedule ends")).toHaveProperty("value", "2027-05-15");
    await userEvent.clear(box("Schedule ends"));
    await userEvent.click(screen.getByRole("button", { name: "Save" }));
    await waitFor(() => {
      expect(onSaved).toHaveBeenCalled();
    });
    expect(bodiesOf(fetch)).toEqual([{ endsOn: null }]);
  });

  it("refuses a day half typed", async () => {
    const fetch = serverAnswers({});
    show((handlers) => <EndsDialog stream={stream} {...handlers} />);
    await userEvent.type(box("Schedule ends"), "202612");
    await userEvent.click(screen.getByRole("button", { name: "Save" }));
    expect([screen.getByText(dayProblem), bodiesOf(fetch)]).toEqual([
      expect.anything(),
      [],
    ]);
    await waitFor(() => {
      expect(document.activeElement).toBe(box("Schedule ends"));
    });
  });

  it("refuses a day before the schedule's first cycle starts", async () => {
    const fetch = serverAnswers({});
    show((handlers) => <EndsDialog stream={stream} {...handlers} />);
    await userEvent.type(box("Schedule ends"), "20261231");
    await userEvent.click(screen.getByRole("button", { name: "Save" }));
    expect([
      screen.getByText("The schedule can't end before its first cycle starts"),
      bodiesOf(fetch),
    ]).toEqual([expect.anything(), []]);
  });

  it("refuses a day before the last cycle a release includes", async () => {
    const fetch = serverAnswers({});
    const releasing = fictionalStream({
      releases: [fictionalRelease({ lastCycle: "2027-07-01" })],
    });
    show((handlers) => <EndsDialog stream={releasing} {...handlers} />);
    await userEvent.type(box("Schedule ends"), "20270501");
    await userEvent.click(screen.getByRole("button", { name: "Save" }));
    expect([
      screen.getByText(
        "The release Fictional One includes cycles after that day; change it first",
      ),
      bodiesOf(fetch),
    ]).toEqual([expect.anything(), []]);
  });

  it("refuses a day before the cycle a feature targets", async () => {
    const fetch = serverAnswers(
      planAnswers([
        fictionalFeature({
          targetStreamId: streamId,
          targetCycle: "2027-07-01",
        }),
      ]),
    );
    show((handlers) => <EndsDialog stream={stream} {...handlers} />);
    await waitFor(() => {
      expect(fetch).toHaveBeenCalled();
    });
    await userEvent.type(box("Schedule ends"), "20270501");
    await userEvent.click(screen.getByRole("button", { name: "Save" }));
    const reason =
      "The feature Fictional Feature targets a cycle after that day; change it first";
    expect(await screen.findByText(reason)).toBeDefined();
    // The day stays in its field, outlined as refused, with the reason under it.
    expect([
      box("Schedule ends").getAttribute("aria-invalid"),
      box("Schedule ends").getAttribute("value"),
      box("Schedule ends")
        .getAttribute("aria-describedby")
        ?.split(" ")
        .map((id) => document.getElementById(id)?.textContent)
        .includes(reason),
      bodiesOf(fetch),
    ]).toEqual(["true", "2027-05-01", true, []]);
  });

  it("names no release to one whose role isn't known yet", async () => {
    const fetch = serverAnswers({});
    const releasing = fictionalStream({
      releases: [fictionalRelease({ lastCycle: "2027-07-01" })],
    });
    show((handlers) => <EndsDialog stream={releasing} {...handlers} />, {
      signedIn: false,
    });
    await userEvent.type(box("Schedule ends"), "20270501");
    await userEvent.click(screen.getByRole("button", { name: "Save" }));
    expect([
      screen.getByText("Work is planned on cycles after that day"),
      bodiesOf(fetch),
    ]).toEqual([expect.anything(), []]);
  });

  it("lets the day come before a release drafted to be removed", async () => {
    serverAnswers({ [`PUT ${streamPath}/ends-on`]: savedStream });
    const releasing = fictionalStream({
      releases: [
        fictionalRelease({
          lastCycle: "2027-07-01",
          draft: recordDraft({ action: "deleted" }),
        }),
      ],
    });
    const { onSaved } = show((handlers) => (
      <EndsDialog stream={releasing} {...handlers} />
    ));
    await userEvent.type(box("Schedule ends"), "20270501");
    await userEvent.click(screen.getByRole("button", { name: "Save" }));
    await waitFor(() => {
      expect(onSaved).toHaveBeenCalled();
    });
  });
});
