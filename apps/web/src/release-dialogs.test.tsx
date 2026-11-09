// SPDX-License-Identifier: Apache-2.0

// Tests for the dialogs of the Releases page, with the server's answers simulated: naming a stream,
// changing its cycles, one cycle's length, the day its cycles are made until, and making or
// changing a release, each with what it refuses before saving, what it sends, and what it does
// while and once it saves.

import { shipsBeforeStart } from "@fathom/shared";
import { MantineProvider } from "@mantine/core";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor, within } from "@testing-library/react";
import { userEvent } from "@testing-library/user-event";
import type { ReactElement } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { dayNeeded, dayProblem } from "./day-input.tsx";
import {
  CycleLengthDialog,
  CyclesUntilDialog,
  PatternDialog,
  ReleaseDialog,
  StreamDialog,
} from "./release-dialogs.tsx";
import {
  fictionalPattern,
  fictionalRelease,
  fictionalStream,
  recordDraft,
  serverAnswers,
  streamId,
  testTheme,
} from "./test-support.tsx";

const changeSetId = "00000000-0000-4000-8000-000000000001";
const streamPath = `/api/release-streams/${streamId}`;
const stream = fictionalStream();
const savedStream = () => Response.json({ stream, changeSetId });

afterEach(() => {
  vi.unstubAllGlobals();
});

const saving = () => ({ onSaved: vi.fn(), onCancel: vi.fn(), onBusy: vi.fn() });

function show(dialog: (handlers: ReturnType<typeof saving>) => ReactElement) {
  const handlers = saving();
  const client = new QueryClient();
  render(
    <MantineProvider theme={testTheme}>
      <QueryClientProvider client={client}>
        {dialog(handlers)}
      </QueryClientProvider>
    </MantineProvider>,
  );
  return handlers;
}

function bodiesOf(fetch: ReturnType<typeof serverAnswers>): unknown[] {
  return fetch.mock.calls.flatMap(([, init]) =>
    init?.body === undefined
      ? []
      : [JSON.parse(init.body as string) as unknown],
  );
}

// The rows of a table of cycles, such as "First cycles", each as its text.
const cyclesIn = (name: string) =>
  within(screen.getByRole("table", { name }))
    .getAllByRole("row")
    .map(({ textContent }) => textContent);

const box = (name: string) =>
  screen.getByRole<HTMLInputElement>("textbox", { name });
const picker = (name: string) =>
  screen.getByRole<HTMLInputElement>("combobox", { name });

async function choose(label: string, option: string) {
  await userEvent.click(picker(label));
  await userEvent.click(await screen.findByRole("option", { name: option }));
}

describe("the dialog naming a release stream", () => {
  it("adds a stream with the name typed, without spaces around it", async () => {
    const fetch = serverAnswers({ "POST /api/release-streams": savedStream });
    const { onSaved } = show((handlers) => (
      <StreamDialog streams={[stream]} {...handlers} />
    ));
    await userEvent.type(box("Name"), "  Fictional Minors  ");
    await userEvent.click(screen.getByRole("button", { name: "Add stream" }));
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
    await userEvent.click(screen.getByRole("button", { name: "Add stream" }));
    expect([screen.getByText("Give a name"), fetch.mock.calls]).toEqual([
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
    await userEvent.click(screen.getByRole("button", { name: "Add stream" }));
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
    await userEvent.click(screen.getByRole("button", { name: "Add stream" }));
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

describe("the dialog of the day a stream's cycles are made until", () => {
  it("says the day makes as many cycles as now", () => {
    show((handlers) => <CyclesUntilDialog stream={stream} {...handlers} />);
    expect(screen.getByText("4 cycles in all, as now")).toBeDefined();
  });

  it("shows the last three cycles the day makes", () => {
    show((handlers) => <CyclesUntilDialog stream={stream} {...handlers} />);
    expect(cyclesIn("Last cycles")).toEqual([
      "27.22027-04-01 to 2027-06-30",
      "27.32027-07-01 to 2027-09-30",
      "27.42027-10-01 to 2027-12-31",
    ]);
  });

  it.each([
    ["more", "20280630", "6 cycles in all, 2 more than now"],
    ["fewer", "20270501", "2 cycles in all, 2 fewer than now"],
    ["one", "20270201", "1 cycle in all, 3 fewer than now"],
  ])(
    "counts the cycles a later or earlier day makes: %s",
    async (_case, typed, count) => {
      show((handlers) => <CyclesUntilDialog stream={stream} {...handlers} />);
      await userEvent.clear(box("Planned to"));
      await userEvent.type(box("Planned to"), typed);
      expect(screen.getByText(count)).toBeDefined();
    },
  );

  it("counts no cycles from changes of cycles drafted to be removed", () => {
    const removing = fictionalStream({
      patterns: [
        fictionalPattern({ draft: recordDraft({ action: "deleted" }) }),
      ],
    });
    show((handlers) => <CyclesUntilDialog stream={removing} {...handlers} />);
    expect([
      screen.queryByText(/in all/),
      screen.queryByRole("table", { name: "Last cycles" }),
    ]).toEqual([null, null]);
  });

  it("saves the day typed", async () => {
    const fetch = serverAnswers({
      [`PUT ${streamPath}/cycles-until`]: savedStream,
    });
    const { onSaved } = show((handlers) => (
      <CyclesUntilDialog stream={stream} {...handlers} />
    ));
    await userEvent.clear(box("Planned to"));
    await userEvent.type(box("Planned to"), "20280630");
    await userEvent.click(screen.getByRole("button", { name: "Save" }));
    await waitFor(() => {
      expect(onSaved).toHaveBeenCalled();
    });
    expect(bodiesOf(fetch)).toEqual([{ cyclesUntil: "2028-06-30" }]);
  });

  it("asks for a whole day before saving", async () => {
    const fetch = serverAnswers({});
    show((handlers) => <CyclesUntilDialog stream={stream} {...handlers} />);
    await userEvent.clear(box("Planned to"));
    await userEvent.click(screen.getByRole("button", { name: "Save" }));
    expect([screen.getByText(dayNeeded), fetch.mock.calls]).toEqual([
      expect.anything(),
      [],
    ]);
  });

  it("refuses a day before the last cycle a release includes", async () => {
    const fetch = serverAnswers({});
    const releasing = fictionalStream({
      releases: [fictionalRelease({ lastCycle: "2027-07-01" })],
    });
    show((handlers) => <CyclesUntilDialog stream={releasing} {...handlers} />);
    await userEvent.clear(box("Planned to"));
    await userEvent.type(box("Planned to"), "20270501");
    await userEvent.click(screen.getByRole("button", { name: "Save" }));
    expect([
      screen.getByText(
        "A release includes the cycle from 2027-07-01; choose that day or later",
      ),
      fetch.mock.calls,
    ]).toEqual([expect.anything(), []]);
  });

  it("lets the day come before a release drafted to be removed", async () => {
    serverAnswers({ [`PUT ${streamPath}/cycles-until`]: savedStream });
    const releasing = fictionalStream({
      releases: [
        fictionalRelease({
          lastCycle: "2027-07-01",
          draft: recordDraft({ action: "deleted" }),
        }),
      ],
    });
    const { onSaved } = show((handlers) => (
      <CyclesUntilDialog stream={releasing} {...handlers} />
    ));
    await userEvent.clear(box("Planned to"));
    await userEvent.type(box("Planned to"), "20270501");
    await userEvent.click(screen.getByRole("button", { name: "Save" }));
    await waitFor(() => {
      expect(onSaved).toHaveBeenCalled();
    });
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

  it("shows the first cycles the pattern makes", async () => {
    show((handlers) => <PatternDialog stream={empty} {...handlers} />);
    await userEvent.type(box("First cycle starts"), "20270101");
    expect(cyclesIn("First cycles")).toEqual([
      "27.12027-01-01 to 2027-03-31",
      "27.22027-04-01 to 2027-06-30",
      "27.32027-07-01 to 2027-09-30",
    ]);
  });

  it("makes cycles of weeks once the unit is changed", async () => {
    show((handlers) => <PatternDialog stream={empty} {...handlers} />);
    await userEvent.type(box("First cycle starts"), "20270104");
    await userEvent.click(screen.getByText("Weeks"));
    expect(cyclesIn("First cycles")[0]).toBe("27.12027-01-04 to 2027-01-24");
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
    expect(cyclesIn("First cycles")[0]).toBe("27.12027-01-01 to 2027-02-28");
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
    expect([
      screen.getByText("Give a pattern for the names"),
      fetch.mock.calls,
    ]).toEqual([expect.anything(), []]);
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
    await choose("From the start of", "2027-04-01 (27.2)");
    expect(cyclesIn("First cycles")).toEqual([
      "27.22027-04-01 to 2027-06-30",
      "27.32027-07-01 to 2027-07-31",
      "27.42027-08-01 to 2027-08-31",
    ]);
  });

  it("changes the cycles from the start of the cycle chosen", async () => {
    const fetch = serverAnswers({
      [`POST ${streamPath}/patterns`]: savedStream,
    });
    const { onSaved } = show((handlers) => (
      <PatternDialog stream={changing} {...handlers} />
    ));
    await choose("From the start of", "2027-04-01 (27.2)");
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
    expect(picker("From the start of").value).toBe("2027-07-01 (27.3)");
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
    await choose("First cycle", "27.2 (2027-04-01 to 2027-06-30)");
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
    await choose("First cycle", "27.2 (2027-04-01 to 2027-06-30)");
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

  it("says the day a release ships at the end of its last cycle", async () => {
    show((handlers) => <ReleaseDialog stream={releasing} {...handlers} />);
    await choose("First cycle", "27.2 (2027-04-01 to 2027-06-30)");
    expect(
      screen.getByText(
        "Leave empty to ship at the end of its last cycle, on 2027-06-30",
      ),
    ).toBeDefined();
  });

  it("offers only the cycles no other release includes", async () => {
    show((handlers) => <ReleaseDialog stream={releasing} {...handlers} />);
    await userEvent.click(picker("First cycle"));
    expect(
      (await screen.findAllByRole("option")).map(
        ({ textContent }) => textContent,
      ),
    ).toEqual([
      "27.1 (2027-01-01 to 2027-03-31)",
      "27.2 (2027-04-01 to 2027-06-30)",
      "27.4 (2027-10-01 to 2027-12-31)",
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
    await choose("First cycle", "27.3 (2027-07-01 to 2027-09-30)");
    expect(picker("Last cycle").value).toBe("27.3 (2027-07-01 to 2027-09-30)");
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
    await choose("First cycle", "27.1 (2027-01-01 to 2027-03-31)");
    expect(picker("Last cycle").value).toBe("27.3 (2027-07-01 to 2027-09-30)");
  });

  it("refuses cycles with one between them that another release includes", async () => {
    const fetch = serverAnswers({});
    show((handlers) => <ReleaseDialog stream={releasing} {...handlers} />);
    await userEvent.type(box("Name"), "Fictional Two");
    await choose("First cycle", "27.2 (2027-04-01 to 2027-06-30)");
    await choose("Last cycle", "27.4 (2027-10-01 to 2027-12-31)");
    await userEvent.click(screen.getByRole("button", { name: "Make release" }));
    expect([
      screen.getByText("Choose cycles no other release includes"),
      screen.getByText("Leave empty to ship at the end of its last cycle"),
      fetch.mock.calls,
    ]).toEqual([expect.anything(), expect.anything(), []]);
  });

  it("asks for the cycles again once both are deselected", async () => {
    const fetch = serverAnswers({});
    show((handlers) => <ReleaseDialog stream={releasing} {...handlers} />);
    await userEvent.type(box("Name"), "Fictional Two");
    await choose("First cycle", "27.2 (2027-04-01 to 2027-06-30)");
    await choose("Last cycle", "27.2 (2027-04-01 to 2027-06-30)");
    await choose("First cycle", "27.2 (2027-04-01 to 2027-06-30)");
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
    await choose("First cycle", "27.1 (2027-01-01 to 2027-03-31)");
    await userEvent.click(screen.getByRole("button", { name: "Save" }));
    expect([
      picker("First cycle").value,
      picker("Last cycle").value,
      screen.getByText("Choose a cycle"),
      fetch.mock.calls,
    ]).toEqual(["", "27.1 (2027-01-01 to 2027-03-31)", expect.anything(), []]);
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
    await choose("Last cycle", "27.1 (2027-01-01 to 2027-03-31)");
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
    expect([screen.getByText("Give a name"), fetch.mock.calls]).toEqual([
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
    expect(
      screen.getByText(
        "Leave empty to ship at the end of its last cycle, on 2027-03-31",
      ),
    ).toBeDefined();
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
      "27.22027-04-01 to 2027-06-30",
      "27.32027-07-01 to 2027-09-30",
      "27.42027-10-01 to 2027-12-31",
    ]);
    await typeLength("2");
    expect(cyclesIn("New dates")).toEqual([
      "27.22027-04-01 to 2027-05-31",
      "27.32027-06-01 to 2027-08-31",
      "27.42027-09-01 to 2027-11-30",
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
      name,
      statusId: "s1",
      neededBy: null,
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
              draft: recordDraft({ action: "deleted" }),
            }),
          ],
          canEdit: false,
          canEditFeatures: false,
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
      "27.22027-04-01 to 2027-05-31",
      "27.32027-06-01 to 2027-09-30",
      "27.42027-10-01 to 2027-12-31",
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
    expect(cyclesIn("New dates")[0]).toBe("27.12027-01-01 to 2027-01-07");
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
});
