// SPDX-License-Identifier: Apache-2.0

// Unit tests for a release stream as a reader sees it: its patterns, releases with their activities,
// cycles, the order of streams, and what a reader who may not read releases receives.

import type { Permission, ReleaseStream } from "@fathom/shared";
import { describe, expect, it } from "vitest";
import type { Draft, Recorded } from "./draft-records.ts";
import type { RecordsState } from "./record-state.ts";
import { streamAsSeen, streamOut, streamsOut } from "./release-stream-view.ts";
import {
  draft,
  kindState,
  otherStream,
  pattern,
  patternId,
  recordsState,
  release,
  schedule,
  stream,
  twoStreams,
} from "./test-records-state.ts";

const today = "2026-06-15";
const twoYearsOn = "2028-06-15";

const shown = (state: RecordsState, id = stream): ReleaseStream =>
  streamOut(state, new Map(), id, today);

// Two live streams with cycles in quarters from 2027, the first ending on the day given, with the
// pattern drafts and releases given.
const plan = ({
  endsOn = null,
  patternDrafts = [],
  releases = [],
}: {
  endsOn?: string | null;
  patternDrafts?: [string, Draft][];
  releases?: [string, Recorded][];
} = {}): RecordsState =>
  recordsState({
    ...twoStreams({ endsOn, patternDrafts }),
    release: kindState(releases),
  });

const alpha = release("Fictional Alpha", "2027-01-01", "2027-04-01");

describe("a stream as shown", () => {
  it("has its name, whether it is retired, its key number and its draft", () => {
    // Given a live stream drafted to be retired
    const state = recordsState({
      "release-stream": kindState(
        [[stream, schedule()]],
        [[stream, draft("changed", { retired: true })]],
      ),
    });

    // When it is shown
    const out = shown(state);

    // Then it is shown as its draft makes it, with the draft
    expect(out).toMatchObject({
      id: stream,
      keyNumber: 1,
      name: "Fictional Stream",
      retired: true,
      draft: { action: "changed", changed: ["retired"] },
    });
  });

  it("has its patterns in order of their start, as drafts make them, with their drafts", () => {
    // Given a pattern drafted to be added before the live one, and the live one drafted to change
    const state = plan({
      patternDrafts: [
        ["pattern-3", draft("created", pattern({ startsOn: "2026-10-01" }))],
        [patternId, draft("changed", { length: 6 })],
      ],
    });

    // When the stream is shown
    const { patterns } = shown(state);

    // Then the added pattern comes first, and the changed one is as its draft makes it
    expect(patterns).toEqual([
      expect.objectContaining({
        id: "pattern-3",
        startsOn: "2026-10-01",
        draft: expect.objectContaining({ action: "created" }) as unknown,
      }),
      expect.objectContaining({
        id: patternId,
        startsOn: "2027-01-01",
        length: 6,
        unit: "months",
        naming: "{YY}.{N}",
        draft: expect.objectContaining({
          action: "changed",
          changed: ["length"],
        }) as unknown,
      }),
    ]);
  });

  it.each([
    ["weeks", "weeks"],
    ["months", "months"],
    ["fortnights", "months"],
  ])("has a pattern kept in %s shown in %s", (kept, unit) => {
    const state = recordsState({
      "release-stream": kindState([[stream, schedule()]]),
      "cycle-pattern": kindState([[patternId, pattern({ unit: kept })]]),
    });

    expect(shown(state).patterns[0]?.unit).toBe(unit);
  });

  it("has only its own releases, in order of their first cycle, each with its ship day, colour and note", () => {
    // Given two releases on the stream, out of order, and one on another stream
    const state = plan({
      releases: [
        ["later", release("Fictional Later", "2027-07-01")],
        [
          "alpha",
          {
            ...alpha,
            shipsOn: "2027-07-31",
            colour: "grape",
            note: "Fictional note",
          },
        ],
        [
          "elsewhere",
          release("Fictional Other", "2027-01-01", "2027-01-01", otherStream),
        ],
      ],
    });

    // When the stream is shown
    const { releases } = shown(state);

    // Then its own releases are shown, the earlier first
    expect(releases).toEqual([
      {
        id: "alpha",
        keyNumber: 2,
        name: "Fictional Alpha",
        firstCycle: "2027-01-01",
        lastCycle: "2027-04-01",
        shipsOn: "2027-07-31",
        colour: "grape",
        note: "Fictional note",
        activities: [],
      },
      expect.objectContaining({ id: "later" }),
    ]);
  });

  it("gives each release its own activities, drafts included", () => {
    // Given two releases, one with a live activity and one drafted to be added
    const state = {
      ...plan({
        releases: [
          ["alpha", alpha],
          ["later", release("Fictional Later", "2027-07-01")],
        ],
      }),
      "release-activity": kindState(
        [["testing", { releaseId: "alpha", name: "Release testing" }]],
        [
          [
            "notes",
            draft("created", { releaseId: "later", name: "Release notes" }),
          ],
        ],
      ),
    };

    // When the stream is shown
    const { releases } = shown(state);

    // Then each release holds only its own
    const named = (id: string) =>
      releases
        .find((one) => one.id === id)
        ?.activities?.map(({ name, draft: drafted }) => ({
          name,
          action: drafted?.action,
        }));
    expect(named("alpha")).toEqual([
      { name: "Release testing", action: undefined },
    ]);
    expect(named("later")).toEqual([
      { name: "Release notes", action: "created" },
    ]);
  });

  it("shows no ship day or note a release doesn't hold, and a colour off the palette as the default", () => {
    const state = plan({
      releases: [
        ["alpha", { ...alpha, shipsOn: null, colour: "beige", note: null }],
      ],
    });

    expect(shown(state).releases[0]).toMatchObject({
      shipsOn: null,
      colour: null,
      note: null,
    });
  });
});

describe("a stream's cycles as shown", () => {
  it("are laid out until two years from today when nothing reaches further", () => {
    const out = shown(plan({ releases: [["alpha", alpha]] }));

    expect([out.cyclesUntil, out.endsOn, out.cycles.at(-1)?.startsOn]).toEqual([
      twoYearsOn,
      null,
      "2028-04-01",
    ]);
  });

  it("are laid out as far as a release reaches past two years from today", () => {
    const out = shown(
      plan({
        releases: [["far", release("Fictional Far", "2029-01-01")]],
      }),
    );

    expect([out.cyclesUntil, out.cycles.at(-1)?.startsOn]).toEqual([
      "2029-01-01",
      "2029-01-01",
    ]);
  });

  it("are laid out to the schedule's last day, however far ahead, the last cut on that day", () => {
    const out = shown(plan({ endsOn: "2059-12-31" }));

    expect([out.cyclesUntil, out.endsOn, out.cycles.at(-1)]).toEqual([
      twoYearsOn,
      "2059-12-31",
      expect.objectContaining({
        startsOn: "2059-10-01",
        endsOn: "2059-12-31",
      }),
    ]);
  });

  it("are laid out two years from today once a draft clears the last day, beside the live ones", () => {
    // Given a schedule ending in May 2027, drafted to keep going
    const state = recordsState({
      ...twoStreams(),
      "release-stream": kindState(
        [[stream, schedule({ endsOn: "2027-05-15" })]],
        [[stream, draft("changed", { endsOn: null })]],
      ),
    });

    // When it is shown
    const out = shown(state);

    // Then its cycles keep going, and its live cycles still end in May
    expect([
      out.endsOn,
      out.cycles.at(-1)?.startsOn,
      out.liveCycles?.at(-1),
    ]).toEqual([
      null,
      "2028-04-01",
      expect.objectContaining({
        startsOn: "2027-04-01",
        endsOn: "2027-05-15",
      }),
    ]);
  });

  it("come with no live cycles when drafts change none", () => {
    expect(shown(plan())).not.toHaveProperty("liveCycles");
  });

  it("come with the live cycles beside those a drafted pattern makes", () => {
    const out = shown(
      plan({ patternDrafts: [[patternId, draft("changed", { length: 2 })]] }),
    );

    expect(
      [out.cycles, out.liveCycles].map((cycles) =>
        cycles?.slice(0, 3).map(({ startsOn }) => startsOn),
      ),
    ).toEqual([
      ["2027-01-01", "2027-03-01", "2027-05-01"],
      ["2027-01-01", "2027-04-01", "2027-07-01"],
    ]);
  });

  it("come with no live cycles at all for a stream only drafted, with its cycles", () => {
    const state = recordsState({
      "release-stream": kindState([], [[stream, draft("created", schedule())]]),
      "cycle-pattern": kindState(
        [],
        [[patternId, draft("created", pattern())]],
      ),
    });

    expect(shown(state).liveCycles).toEqual([]);
  });
});

describe("every stream as shown", () => {
  it("is in the streams' order, then those drafted to be added, in the order drafted", () => {
    // Given two live streams listed out of their order, and two drafted to be added
    const state = recordsState({
      "release-stream": kindState(
        [
          ["second", schedule({ name: "Fictional Second", position: 2 })],
          ["first", schedule({ name: "Fictional First", position: 1 })],
        ],
        [
          [
            "drafted",
            draft("created", schedule({ name: "Fictional Drafted" })),
          ],
          ["next", draft("created", schedule({ name: "Fictional Next" }))],
        ],
      ),
    });

    // When every stream is shown
    const shownIds = streamsOut(state, new Map(), today).map(({ id }) => id);

    // Then the live ones come in their order, then the drafted ones as drafted
    expect(shownIds).toEqual(["first", "second", "drafted", "next"]);
  });
});

describe("a stream as a reader sees it", () => {
  const out = shown(plan({ releases: [["alpha", alpha]] }));

  it.each<[string, Permission[]]>([
    ["planning configuration", ["configuration:view", "configuration:edit"]],
    ["the plan", ["plan:view"]],
  ])(
    "has no releases for a reader of %s alone, and is otherwise the same",
    (_, permissions) => {
      expect(streamAsSeen(permissions)(out)).toEqual({ ...out, releases: [] });
    },
  );

  it("has its releases for a reader who reads features", () => {
    expect(streamAsSeen(["features:view"])(out).releases).toEqual(out.releases);
  });
});
