// SPDX-License-Identifier: Apache-2.0

// Tests for the Releases page's release dialogs, with the server's answers simulated: making or
// changing a release, in a schedule given or chosen, and one of its values, each with what it
// refuses before saving, what it sends, and what it does while and once it saves.

import { shipsBeforeStart } from "@fathom/shared";
import { screen, waitFor } from "@testing-library/react";
import { userEvent } from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { dayProblem } from "./day-input.tsx";
import { ReleaseDialog } from "./release-dialogs.tsx";
import {
  bodiesOf,
  box,
  choose,
  picker,
  savedStream,
  show,
  stream,
  streamPath,
} from "./test-release-dialogs.tsx";
import {
  fictionalRelease,
  fictionalStream,
  quarters,
} from "./test-releases.ts";
import { recordDraft, serverAnswers } from "./test-support.tsx";

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("the dialog making or changing a release", () => {
  // A stream of four cycles, the third of which another release includes.
  const other = fictionalRelease({
    id: "30000000-0000-4000-8000-000000000002",
    name: "Fictional Other",
    firstCycle: "2027-07-01",
    lastCycle: "2027-07-01",
  });
  const releasing = fictionalStream({ releases: [other] });

  it("makes a release of the cycle chosen, shipping at its end", async () => {
    const fetch = serverAnswers({
      [`POST ${streamPath}/releases`]: savedStream,
    });
    const { onSaved } = show((handlers) => (
      <ReleaseDialog stream={releasing} {...handlers} />
    ));
    await userEvent.type(box("Name"), "Fictional Two");
    await choose("First cycle", "27.2 (Apr 1 to Jun 30, 2027)");
    await userEvent.click(screen.getByRole("button", { name: "Make release" }));
    await waitFor(() => {
      expect(onSaved).toHaveBeenCalled();
    });
    expect(bodiesOf(fetch)).toEqual([
      {
        name: "Fictional Two",
        firstCycle: "2027-04-01",
        lastCycle: "2027-04-01",
        shipsOn: null,
        colour: null,
      },
    ]);
  });

  it("makes a release in the colour chosen", async () => {
    const fetch = serverAnswers({
      [`POST ${streamPath}/releases`]: savedStream,
    });
    const { onSaved } = show((handlers) => (
      <ReleaseDialog stream={releasing} {...handlers} />
    ));
    await userEvent.type(box("Name"), "Fictional Two");
    await choose("First cycle", "27.2 (Apr 1 to Jun 30, 2027)");
    expect(picker("Colour").value).toBe("Sea (default)");
    await choose("Colour", "Grape");
    await userEvent.click(screen.getByRole("button", { name: "Make release" }));
    await waitFor(() => {
      expect(onSaved).toHaveBeenCalled();
    });
    expect(bodiesOf(fetch)).toMatchObject([{ colour: "grape" }]);
  });

  it("gives a release the default colour again once Sea is chosen", async () => {
    const release = fictionalRelease({ colour: "teal" });
    const fetch = serverAnswers({
      [`PUT ${streamPath}/releases/${release.id}`]: savedStream,
    });
    const { onSaved } = show((handlers) => (
      <ReleaseDialog
        stream={fictionalStream({ releases: [release] })}
        release={release}
        {...handlers}
      />
    ));
    expect(picker("Colour").value).toBe("Teal");
    await choose("Colour", "Sea (default)");
    await userEvent.click(screen.getByRole("button", { name: "Save" }));
    await waitFor(() => {
      expect(onSaved).toHaveBeenCalled();
    });
    expect(bodiesOf(fetch)).toMatchObject([{ colour: null }]);
  });

  it("shows the day an empty Ships on falls back to, the end of the last cycle by name", async () => {
    show((handlers) => <ReleaseDialog stream={releasing} {...handlers} />);
    expect(box("Ships on").placeholder).toBe("");
    await choose("First cycle", "27.2 (Apr 1 to Jun 30, 2027)");
    expect([
      box("Ships on").placeholder,
      screen.queryByText(/Leave empty/),
    ]).toEqual(["Jun 30, 2027 (end of 27.2)", null]);
  });

  it("offers only the cycles no other release includes", async () => {
    show((handlers) => <ReleaseDialog stream={releasing} {...handlers} />);
    await userEvent.click(picker("First cycle"));
    expect(
      (await screen.findAllByRole("option")).map(
        ({ textContent }) => textContent,
      ),
    ).toEqual([
      "27.1 (Jan 1 to Mar 31, 2027)",
      "27.2 (Apr 1 to Jun 30, 2027)",
      "27.4 (Oct 1 to Dec 31, 2027)",
    ]);
  });

  it("offers the cycles of another release drafted to be removed", async () => {
    const removing = fictionalStream({
      releases: [{ ...other, draft: recordDraft({ action: "deleted" }) }],
    });
    show((handlers) => <ReleaseDialog stream={removing} {...handlers} />);
    await userEvent.click(picker("First cycle"));
    expect(await screen.findAllByRole("option")).toHaveLength(4);
  });

  it("moves the last cycle to the first when the first is chosen after it", async () => {
    show((handlers) => (
      <ReleaseDialog
        stream={stream}
        release={fictionalRelease()}
        {...handlers}
      />
    ));
    await choose("First cycle", "27.3 (Jul 1 to Sep 30, 2027)");
    expect(picker("Last cycle").value).toBe("27.3 (Jul 1 to Sep 30, 2027)");
  });

  it("keeps the last cycle when the first is chosen before it", async () => {
    show((handlers) => (
      <ReleaseDialog
        stream={stream}
        release={fictionalRelease({
          firstCycle: "2027-04-01",
          lastCycle: "2027-07-01",
        })}
        {...handlers}
      />
    ));
    await choose("First cycle", "27.1 (Jan 1 to Mar 31, 2027)");
    expect(picker("Last cycle").value).toBe("27.3 (Jul 1 to Sep 30, 2027)");
  });

  it("refuses cycles with one between them that another release includes", async () => {
    const fetch = serverAnswers({});
    show((handlers) => <ReleaseDialog stream={releasing} {...handlers} />);
    await userEvent.type(box("Name"), "Fictional Two");
    await choose("First cycle", "27.2 (Apr 1 to Jun 30, 2027)");
    await choose("Last cycle", "27.4 (Oct 1 to Dec 31, 2027)");
    await userEvent.click(screen.getByRole("button", { name: "Make release" }));
    expect([
      screen.getByText("Choose cycles no other release includes"),
      box("Ships on").placeholder,
      fetch.mock.calls,
    ]).toEqual([expect.anything(), "", []]);
  });

  it("asks for the cycles again once both are deselected", async () => {
    const fetch = serverAnswers({});
    show((handlers) => <ReleaseDialog stream={releasing} {...handlers} />);
    await userEvent.type(box("Name"), "Fictional Two");
    await choose("First cycle", "27.2 (Apr 1 to Jun 30, 2027)");
    await choose("Last cycle", "27.2 (Apr 1 to Jun 30, 2027)");
    await choose("First cycle", "27.2 (Apr 1 to Jun 30, 2027)");
    await userEvent.click(screen.getByRole("button", { name: "Make release" }));
    expect([
      picker("First cycle").value,
      picker("Last cycle").value,
      screen.getByText("Choose a cycle"),
      fetch.mock.calls,
    ]).toEqual(["", "", expect.anything(), []]);
  });

  it("asks for a first cycle once it is deselected, keeping the last", async () => {
    const fetch = serverAnswers({});
    show((handlers) => (
      <ReleaseDialog
        stream={stream}
        release={fictionalRelease()}
        {...handlers}
      />
    ));
    await choose("First cycle", "27.1 (Jan 1 to Mar 31, 2027)");
    await userEvent.click(screen.getByRole("button", { name: "Save" }));
    expect([
      picker("First cycle").value,
      picker("Last cycle").value,
      screen.getByText("Choose a cycle"),
      fetch.mock.calls,
    ]).toEqual(["", "27.1 (Jan 1 to Mar 31, 2027)", expect.anything(), []]);
  });

  it("asks for a last cycle once it is deselected", async () => {
    const fetch = serverAnswers({});
    show((handlers) => (
      <ReleaseDialog
        stream={stream}
        release={fictionalRelease()}
        {...handlers}
      />
    ));
    await choose("Last cycle", "27.1 (Jan 1 to Mar 31, 2027)");
    await userEvent.click(screen.getByRole("button", { name: "Save" }));
    expect([
      picker("Last cycle").value,
      screen.getByText("Choose a cycle"),
      fetch.mock.calls,
    ]).toEqual(["", expect.anything(), []]);
  });

  it("asks for a first cycle before saving", async () => {
    const fetch = serverAnswers({});
    show((handlers) => <ReleaseDialog stream={releasing} {...handlers} />);
    await userEvent.type(box("Name"), "Fictional Two");
    await userEvent.click(screen.getByRole("button", { name: "Make release" }));
    expect([screen.getByText("Choose a cycle"), fetch.mock.calls]).toEqual([
      expect.anything(),
      [],
    ]);
  });

  it("asks for a name before saving", async () => {
    const fetch = serverAnswers({});
    show((handlers) => (
      <ReleaseDialog
        stream={stream}
        release={fictionalRelease({ name: "" })}
        {...handlers}
      />
    ));
    await userEvent.click(screen.getByRole("button", { name: "Save" }));
    expect([screen.getByText("Name needed"), fetch.mock.calls]).toEqual([
      expect.anything(),
      [],
    ]);
  });

  it("refuses the name of another release in the stream", async () => {
    show((handlers) => <ReleaseDialog stream={releasing} {...handlers} />);
    await userEvent.type(box("Name"), "Fictional Other");
    expect(screen.getByText("Already used")).toBeDefined();
  });

  it("says how far the day typed in Ships on is from the end of the last cycle", async () => {
    const release = fictionalRelease();
    show((handlers) => (
      <ReleaseDialog
        stream={fictionalStream({ releases: [release] })}
        release={release}
        {...handlers}
      />
    ));
    await userEvent.type(box("Ships on"), "20270430");
    expect(screen.getByText("Ships 30 days after 27.1 ends")).toBeDefined();
  });

  it("says nothing more when the day typed in Ships on is the end of the last cycle", async () => {
    const release = fictionalRelease();
    show((handlers) => (
      <ReleaseDialog
        stream={fictionalStream({ releases: [release] })}
        release={release}
        {...handlers}
      />
    ));
    await userEvent.type(box("Ships on"), "20270331");
    expect(screen.queryByText(/ (before|after) 27\.1 ends/)).toBeNull();
  });

  it("changes a release by its id, shipping on the day typed", async () => {
    const release = fictionalRelease();
    const fetch = serverAnswers({
      [`PUT ${streamPath}/releases/${release.id}`]: savedStream,
    });
    const { onSaved } = show((handlers) => (
      <ReleaseDialog
        stream={fictionalStream({ releases: [release] })}
        release={release}
        {...handlers}
      />
    ));
    await userEvent.type(box("Ships on"), "20270415");
    await userEvent.click(screen.getByRole("button", { name: "Save" }));
    await waitFor(() => {
      expect(onSaved).toHaveBeenCalled();
    });
    expect(bodiesOf(fetch)).toEqual([
      {
        name: "Fictional One",
        firstCycle: "2027-01-01",
        lastCycle: "2027-01-01",
        shipsOn: "2027-04-15",
        colour: null,
      },
    ]);
  });

  it("ships at the end of the last cycle again once its own day is cleared", async () => {
    const release = fictionalRelease({ shipsOn: "2027-04-15" });
    const fetch = serverAnswers({
      [`PUT ${streamPath}/releases/${release.id}`]: savedStream,
    });
    const { onSaved } = show((handlers) => (
      <ReleaseDialog stream={stream} release={release} {...handlers} />
    ));
    await userEvent.clear(box("Ships on"));
    await userEvent.click(screen.getByRole("button", { name: "Save" }));
    await waitFor(() => {
      expect(onSaved).toHaveBeenCalled();
    });
    expect(bodiesOf(fetch)).toEqual([
      expect.objectContaining({ shipsOn: null }),
    ]);
  });

  it("refuses to ship before the first cycle starts", async () => {
    const fetch = serverAnswers({});
    show((handlers) => (
      <ReleaseDialog
        stream={stream}
        release={fictionalRelease({
          firstCycle: "2027-04-01",
          lastCycle: "2027-04-01",
        })}
        {...handlers}
      />
    ));
    await userEvent.type(box("Ships on"), "20270301");
    await userEvent.click(screen.getByRole("button", { name: "Save" }));
    expect([screen.getByText(shipsBeforeStart), fetch.mock.calls]).toEqual([
      expect.anything(),
      [],
    ]);
  });

  it("refuses a day to ship on that is not finished", async () => {
    const fetch = serverAnswers({});
    show((handlers) => (
      <ReleaseDialog
        stream={stream}
        release={fictionalRelease()}
        {...handlers}
      />
    ));
    await userEvent.type(box("Ships on"), "202704");
    await userEvent.click(screen.getByRole("button", { name: "Save" }));
    expect([screen.getByText(dayProblem), fetch.mock.calls]).toEqual([
      expect.anything(),
      [],
    ]);
  });
});

describe("the dialog making a release in a schedule chosen", () => {
  const minorsId = "10000000-0000-4000-8000-000000000002";
  const minors = fictionalStream({
    id: minorsId,
    name: "Fictional Minors",
    cycles: quarters(2).map((cycle) => ({
      ...cycle,
      name: `Minor ${cycle.name}`,
    })),
  });
  const schedules = [stream, minors];

  it("asks for a schedule before making a release", async () => {
    const fetch = serverAnswers({});
    show((handlers) => <ReleaseDialog streams={schedules} {...handlers} />);
    await userEvent.type(box("Name"), "Fictional Two");
    await userEvent.click(screen.getByRole("button", { name: "Make release" }));
    expect([screen.getByText("Choose a schedule"), fetch.mock.calls]).toEqual([
      expect.anything(),
      [],
    ]);
  });

  it("offers the cycles of the schedule chosen", async () => {
    show((handlers) => <ReleaseDialog streams={schedules} {...handlers} />);
    await choose("Schedule", "Fictional Minors");
    await userEvent.click(picker("First cycle"));
    expect(
      (await screen.findAllByRole("option")).map(
        ({ textContent }) => textContent,
      ),
    ).toEqual([
      "Minor 27.1 (Jan 1 to Mar 31, 2027)",
      "Minor 27.2 (Apr 1 to Jun 30, 2027)",
    ]);
  });

  it("empties the cycles chosen once another schedule is chosen", async () => {
    show((handlers) => <ReleaseDialog streams={schedules} {...handlers} />);
    await choose("Schedule", "Fictional Majors");
    await choose("First cycle", "27.2 (Apr 1 to Jun 30, 2027)");
    await choose("Schedule", "Fictional Minors");
    expect([picker("First cycle").value, picker("Last cycle").value]).toEqual([
      "",
      "",
    ]);
  });

  it("keeps the cycles chosen when the same schedule is chosen again", async () => {
    show((handlers) => <ReleaseDialog streams={schedules} {...handlers} />);
    await choose("Schedule", "Fictional Majors");
    await choose("First cycle", "27.2 (Apr 1 to Jun 30, 2027)");
    await choose("Schedule", "Fictional Majors");
    expect(picker("First cycle").value).toBe("27.2 (Apr 1 to Jun 30, 2027)");
  });

  it("makes the release in the schedule chosen", async () => {
    const fetch = serverAnswers({
      [`POST /api/release-streams/${minorsId}/releases`]: savedStream,
    });
    const { onSaved } = show((handlers) => (
      <ReleaseDialog streams={schedules} {...handlers} />
    ));
    await choose("Schedule", "Fictional Minors");
    await userEvent.type(box("Name"), "Fictional Two");
    await choose("First cycle", "Minor 27.2 (Apr 1 to Jun 30, 2027)");
    await userEvent.click(screen.getByRole("button", { name: "Make release" }));
    await waitFor(() => {
      expect(onSaved).toHaveBeenCalled();
    });
    expect(fetch.mock.calls.map(([url]) => url)).toEqual([
      `/api/release-streams/${minorsId}/releases`,
    ]);
  });
});

describe("the dialog changing one of a release's values", () => {
  const release = fictionalRelease({ shipsOn: "2027-03-15" });
  const releasing = fictionalStream({ releases: [release] });

  it("saves the value changed with the release's others as they are", async () => {
    const fetch = serverAnswers({
      [`PUT ${streamPath}/releases/${release.id}`]: savedStream,
    });
    const { onSaved } = show((handlers) => (
      <ReleaseDialog
        stream={releasing}
        release={release}
        part="colour"
        {...handlers}
      />
    ));
    await choose("Colour", "Grape");
    await userEvent.click(screen.getByRole("button", { name: "Save" }));
    await waitFor(() => {
      expect(onSaved).toHaveBeenCalled();
    });
    expect(bodiesOf(fetch)).toEqual([
      {
        name: "Fictional One",
        firstCycle: "2027-01-01",
        lastCycle: "2027-01-01",
        shipsOn: "2027-03-15",
        colour: "grape",
      },
    ]);
  });

  it("says under First cycle when the cycles chosen would ship the release before it starts", async () => {
    const fetch = serverAnswers({});
    show((handlers) => (
      <ReleaseDialog
        stream={releasing}
        release={release}
        part="cycles"
        {...handlers}
      />
    ));
    await choose("First cycle", "27.2 (Apr 1 to Jun 30, 2027)");
    await userEvent.click(screen.getByRole("button", { name: "Save" }));
    expect([screen.getByText(shipsBeforeStart), fetch.mock.calls]).toEqual([
      expect.anything(),
      [],
    ]);
  });
});
