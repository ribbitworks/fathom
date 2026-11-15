// SPDX-License-Identifier: Apache-2.0

// Tests for the table of release streams: what each stream's row shows, the draft its row is marked
// with, from the stream's own and its parts', the streams as they are live, the drafts a row names,
// how rows are grouped, and Ended after a stream's name.

import type { ReleaseStream, Show } from "@fathom/shared";
import { MantineProvider } from "@mantine/core";
import { cleanup, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import {
  patternOn,
  shownUnlessRetired,
  streamColumnOrder,
  streamRows,
  streamTable,
} from "./stream-table.tsx";
import {
  fictionalPattern,
  fictionalRelease,
  fictionalStream,
  recordDraft,
} from "./test-support.tsx";

const day = "2027-02-15";
const releaseId = (at: number) =>
  `30000000-0000-4000-8000-00000000000${String(at)}`;
const rowOf = (stream: ReleaseStream, show: Show = "both") => {
  const [row] = streamRows([stream], show, day);
  return row as NonNullable<typeof row>;
};
const table = (streams: ReleaseStream[] = []) =>
  streamTable({ streams, day, onOpen: vi.fn() });

describe("a stream's row", () => {
  it("shows its name, cycles in force, releases kept, and how far its cycles are made", () => {
    const row = rowOf(
      fictionalStream({
        releases: [
          fictionalRelease(),
          fictionalRelease({
            id: releaseId(2),
            name: "Fictional Gone",
            draft: recordDraft({ action: "deleted" }),
          }),
        ],
      }),
    );
    expect([row.name, row.schedule, row.releases, row.cyclesUntil]).toEqual([
      "Fictional Majors",
      "Every 3 months, named {YY}.{N}",
      "Fictional One",
      "2027-12-31",
    ]);
  });

  it("names the release that ships next, of those whose cycles are made, with its day", () => {
    const row = rowOf(
      fictionalStream({
        releases: [
          fictionalRelease({
            id: releaseId(1),
            name: "Fictional Later",
            firstCycle: "2027-04-01",
            lastCycle: "2027-04-01",
          }),
          fictionalRelease({ id: releaseId(2), name: "Fictional Sooner" }),
          fictionalRelease({
            id: releaseId(3),
            name: "Fictional Shipped",
            shipsOn: "2027-01-15",
          }),
          fictionalRelease({
            id: releaseId(4),
            name: "Fictional Unmade",
            firstCycle: "2031-01-01",
            lastCycle: "2031-01-01",
          }),
        ],
      }),
    );
    expect(row.nextRelease).toBe("Fictional Sooner, ships Mar 31, 2027");
  });

  it("names no release when none is to come, and no cycles when it has none", () => {
    const row = rowOf(fictionalStream({ patterns: [] }));
    expect([row.nextRelease, row.schedule]).toEqual(["", ""]);
  });

  it("has no draft when nothing in its stream has one", () => {
    expect(rowOf(fictionalStream()).draft).toBeUndefined();
  });

  it("has no draft when its parts' drafts change nothing it shows, such as a release's colour", () => {
    const row = rowOf(
      fictionalStream({
        releases: [
          fictionalRelease({
            colour: "grape",
            draft: recordDraft({ changed: ["colour"], live: { colour: null } }),
          }),
        ],
      }),
    );
    expect(row.draft).toBeUndefined();
  });

  it("stands for its parts' drafts that change what it shows, credited to whoever changed them last", () => {
    const row = rowOf(
      fictionalStream({
        patterns: [
          fictionalPattern({
            draft: recordDraft({ action: "created", madeAt: null }),
          }),
        ],
        releases: [
          fictionalRelease({
            draft: recordDraft({
              action: "deleted",
              madeBy: "Fictional Later",
              madeAt: "2026-11-02T09:00:00.000Z",
              unpublished: true,
            }),
          }),
          fictionalRelease({
            id: releaseId(2),
            name: "Fictional Two",
            draft: recordDraft({
              changed: ["name"],
              live: { name: "Fictional Was" },
              madeAt: null,
              needsOtherApprover: true,
            }),
          }),
        ],
      }),
    );
    expect(row.draft).toEqual({
      action: "changed",
      state: "waiting",
      changed: ["schedule", "releases", "nextRelease"],
      madeBy: "Fictional Later",
      madeAs: undefined,
      changedBy: {
        schedule: "Fictional Editor",
        releases: "Fictional Later",
        nextRelease: "Fictional Later",
      },
      unpublished: false,
      needsOtherApprover: true,
      live: {
        name: "Fictional Majors",
        schedule: "",
        releases: "Fictional One, Fictional Was",
        nextRelease: "Fictional One, ships Mar 31, 2027",
        cyclesUntil: "2027-12-31",
      },
    });
  });

  it("is rejected only once every part's draft that changes it was", () => {
    const rejected = recordDraft({ action: "deleted", state: "rejected" });
    const stream = (second: "waiting" | "rejected") =>
      fictionalStream({
        releases: [
          fictionalRelease({ draft: rejected }),
          fictionalRelease({
            id: releaseId(2),
            draft: recordDraft({ action: "deleted", state: second }),
          }),
        ],
      });
    expect([
      rowOf(stream("waiting")).draft?.state,
      rowOf(stream("rejected")).draft?.state,
    ]).toEqual(["waiting", "rejected"]);
  });

  it("adds the columns its parts' drafts change to the stream's own draft, saying it retires the stream", () => {
    const row = rowOf(
      fictionalStream({
        retired: true,
        draft: recordDraft({ changed: ["retired"], live: { retired: false } }),
        releases: [
          fictionalRelease({ draft: recordDraft({ action: "created" }) }),
        ],
      }),
    );
    expect([row.draft?.changed, row.draft?.retiring]).toEqual([
      ["retired", "releases", "nextRelease"],
      true,
    ]);
  });
});

describe("a stream's row with its drafts applied", () => {
  it("still marks a release a waiting draft removes, struck through, and leaves out rejected drafts", () => {
    const row = rowOf(
      fictionalStream({
        releases: [
          fictionalRelease({ draft: recordDraft({ action: "deleted" }) }),
          fictionalRelease({
            id: releaseId(2),
            name: "Fictional Kept",
            draft: recordDraft({ action: "deleted", state: "rejected" }),
          }),
        ],
        patterns: [
          fictionalPattern({
            draft: recordDraft({ action: "deleted", state: "rejected" }),
          }),
        ],
      }),
      "drafts",
    );
    expect([
      row.releases,
      row.releasesMark?.state,
      row.scheduleMark,
      row.parts.map(({ name, removed }) => `${name} ${String(removed)}`),
      row.draft?.changed,
    ]).toEqual([
      "Fictional Kept",
      "waiting",
      undefined,
      ["Fictional One true", "Fictional Kept false"],
      ["releases", "nextRelease"],
    ]);
  });
});

describe("the row's draft standing for every draft it shows", () => {
  it("keeps the state of the stream's own draft, while the row can still be decided for its parts", () => {
    const stream = fictionalStream({
      name: "Fictional New Name",
      draft: recordDraft({
        changed: ["name"],
        live: { name: "Fictional Majors" },
        state: "rejected",
      }),
      releases: [
        fictionalRelease({ draft: recordDraft({ action: "deleted" }) }),
      ],
    });
    const row = rowOf(stream);
    expect([row.draft?.state, table([stream]).decidable?.(row)]).toEqual([
      "rejected",
      true,
    ]);
  });

  it("leaves out the stream's own rejected draft with drafts applied", () => {
    const row = rowOf(
      fictionalStream({
        draft: recordDraft({ changed: ["name"], state: "rejected" }),
        releases: [
          fictionalRelease({ draft: recordDraft({ action: "deleted" }) }),
        ],
      }),
      "drafts",
    );
    expect([row.draft?.state, row.draft?.changed]).toEqual([
      "waiting",
      ["releases", "nextRelease"],
    ]);
  });

  it("can be decided only while one of its drafts can, such as a release's colour", () => {
    const releaseDraft = (fields: object) =>
      fictionalRelease({ draft: recordDraft(fields) });
    const decides = (stream: ReleaseStream) =>
      table([stream]).decidable?.(rowOf(stream));
    expect([
      decides(
        fictionalStream({ releases: [releaseDraft({ changed: ["colour"] })] }),
      ),
      decides(
        fictionalStream({
          releases: [
            releaseDraft({ action: "deleted", unpublished: true }),
            fictionalRelease({
              id: releaseId(2),
              draft: recordDraft({ action: "deleted", state: "rejected" }),
            }),
          ],
        }),
      ),
    ]).toEqual([true, false]);
  });

  it("is unpublished only while every part's draft it stands for is", () => {
    const releases = (second: boolean) =>
      fictionalStream({
        releases: [
          fictionalRelease({
            draft: recordDraft({ action: "deleted", unpublished: true }),
          }),
          fictionalRelease({
            id: releaseId(2),
            draft: recordDraft({ action: "deleted", unpublished: second }),
          }),
        ],
      });
    expect([
      rowOf(releases(false)).draft?.unpublished,
      rowOf(releases(true)).draft?.unpublished,
    ]).toEqual([false, true]);
  });

  it("marks the next release as changed when a draft of how far the cycles are made changes it", () => {
    const row = rowOf(
      fictionalStream({
        cyclesUntil: "2026-12-31",
        cycles: [],
        draft: recordDraft({
          changed: ["cyclesUntil"],
          live: { cyclesUntil: "2027-12-31" },
        }),
        releases: [fictionalRelease()],
        liveCycles: fictionalStream().cycles,
      }),
    );
    expect(row.draft?.changed).toEqual(["cyclesUntil", "nextRelease"]);
  });

  it("marks the next release as changed when a cycle change moves it", () => {
    const row = rowOf(
      fictionalStream({
        patterns: [
          fictionalPattern({ draft: recordDraft({ changed: ["naming"] }) }),
        ],
        cycles: [],
        liveCycles: fictionalStream().cycles,
        releases: [fictionalRelease()],
      }),
    );
    expect(row.draft?.changed).toEqual(["nextRelease"]);
  });
});

describe("the streams as they are live", () => {
  it("are each stream without its drafts, its parts' marks still worked out from its drafts", () => {
    const drafted = fictionalStream({
      name: "Fictional New Name",
      draft: recordDraft({
        changed: ["name"],
        live: { name: "Fictional Majors" },
      }),
    });
    const [live] = table([drafted]).liveRecords(
      streamRows([drafted], "both", day),
    );
    expect([live?.name, live?.live, live?.draft]).toEqual([
      "Fictional Majors",
      true,
      undefined,
    ]);
  });

  it("leave out a stream only drafted to be added", () => {
    const added = fictionalStream({
      draft: recordDraft({ action: "created" }),
    });
    expect(
      table([added]).liveRecords(streamRows([added], "both", day)),
    ).toEqual([]);
  });
});

describe("the table of streams", () => {
  it("names the drafts of each stream named that can be decided, its own and its parts'", () => {
    const drafted = recordDraft();
    const streams = [
      fictionalStream({
        draft: drafted,
        patterns: [
          fictionalPattern({ draft: drafted }),
          fictionalPattern({ id: "p2" }),
          fictionalPattern({
            id: "p3",
            draft: recordDraft({ state: "rejected" }),
          }),
          fictionalPattern({
            id: "p4",
            draft: recordDraft({ unpublished: true }),
          }),
          fictionalPattern({ id: "p5", draft: drafted, heldBy: "Someone" }),
        ],
        releases: [fictionalRelease({ draft: drafted })],
      }),
      fictionalStream({ id: "s2", releases: [fictionalRelease()] }),
    ];
    expect(table(streams).drafts([streams[0]?.id ?? "", "s2"]).records).toEqual(
      [
        { type: "release-stream", id: streams[0]?.id },
        { type: "cycle-pattern", id: fictionalPattern().id },
        { type: "release", id: fictionalRelease().id },
      ],
    );
  });

  it("words what a stream's draft changes, as the table shows it", () => {
    const row = rowOf(
      fictionalStream({
        name: "Fictional New Name",
        draft: recordDraft({
          changed: ["name"],
          live: { name: "Fictional Majors" },
        }),
      }),
    );
    expect(
      table().draftFields(
        row,
        row.draft as NonNullable<typeof row.draft>,
        [],
        [],
      ),
    ).toEqual([
      {
        key: "name",
        field: {
          field: "Stream",
          oldValue: "Fictional Majors",
          newValue: "Fictional New Name",
        },
      },
    ]);
  });

  it("groups streams by whether they are retired, as they are live, or else ended", () => {
    const [status] = table().groupings ?? [];
    const groupOf = (stream: ReleaseStream) =>
      status?.of(rowOf(stream))[0]?.label;
    expect([
      groupOf(fictionalStream()),
      groupOf(fictionalStream({ retired: true })),
      groupOf(
        fictionalStream({
          retired: true,
          draft: recordDraft({ changed: ["retired"] }),
        }),
      ),
      groupOf(fictionalStream({ endsOn: "2027-02-14" })),
      groupOf(fictionalStream({ endsOn: day })),
      groupOf(fictionalStream({ endsOn: "2027-02-14", retired: true })),
    ]).toEqual([
      "Current",
      "Retired",
      "Current",
      "Ended",
      "Current",
      "Retired",
    ]);
  });

  it("shows Ended after the name of a stream whose last day has passed", () => {
    const [name] = table().columnsFor([], [], [], []);
    const markOf = (stream: ReleaseStream) => {
      render(<MantineProvider>{name?.mark?.(rowOf(stream))}</MantineProvider>);
      const shown = screen.queryByText("Ended") !== null;
      cleanup();
      return shown;
    };
    expect([
      markOf(fictionalStream({ endsOn: "2027-02-14" })),
      markOf(fictionalStream({ endsOn: day })),
      markOf(fictionalStream()),
    ]).toEqual([true, false, false]);
  });

  it("groups streams by their cycle schedule, those with none last", () => {
    const [, schedule] = table().groupings ?? [];
    const groupOf = (stream: ReleaseStream) => schedule?.of(rowOf(stream))[0];
    expect([
      groupOf(fictionalStream()),
      groupOf(fictionalStream({ patterns: [] })),
    ]).toEqual([
      {
        key: "Every 3 months, named {YY}.{N}",
        label: "Every 3 months, named {YY}.{N}",
        rank: 0,
      },
      { key: "", label: "None", rank: 1 },
    ]);
  });

  it("has its columns in its own order, and adds, removes and refuses nothing itself", () => {
    const streams = table();
    expect([
      streams.columnsFor([], [], [], []).map(({ key }) => key),
      streams.nameOf(rowOf(fictionalStream())),
      streams.newRowLabel(""),
      streams.removeLabel(rowOf(fictionalStream())),
      streams.recordProblem({}, () => []),
    ]).toEqual([
      streamColumnOrder,
      "Fictional Majors",
      "New release stream",
      "Remove release stream",
      undefined,
    ]);
    expect(() => {
      streams.request([], "");
    }).not.toThrow();
  });
});

describe("the cycles in force", () => {
  it("are the pattern started last by the day, or the first when none has started", () => {
    const later = fictionalPattern({ id: "p2", startsOn: "2027-07-01" });
    const stream = fictionalStream({ patterns: [fictionalPattern(), later] });
    expect([
      patternOn(stream, "2027-08-01")?.id,
      patternOn(stream, "2026-01-01")?.id,
    ]).toEqual(["p2", fictionalPattern().id]);
  });
});

describe("streams shown while retired streams are hidden", () => {
  it("are those not retired, or retired only by a draft", () => {
    expect([
      shownUnlessRetired(fictionalStream()),
      shownUnlessRetired(fictionalStream({ retired: true })),
      shownUnlessRetired(
        fictionalStream({
          retired: true,
          draft: recordDraft({ changed: ["retired"] }),
        }),
      ),
    ]).toEqual([true, false, true]);
  });
});
