// SPDX-License-Identifier: Apache-2.0

// Tests for the Schedules tab's table: what each schedule's row shows, the draft its row is marked
// with, from the schedule's own and its parts', the schedules as they are live, the drafts a row
// names, how rows are grouped, the next release's colour, and Ended after a schedule's name.

import type { ReleaseStream, Show } from "@fathom/shared";
import { MantineProvider } from "@mantine/core";
import { cleanup, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import {
  shownUnlessRetired,
  streamColumnOrder,
  streamRows,
  streamTable,
} from "./stream-table.tsx";
import {
  fictionalCycle,
  fictionalPattern,
  fictionalRelease,
  fictionalStream,
  quarters,
  streamId,
} from "./test-releases.ts";
import { recordDraft, fictionalFeature } from "./test-support.tsx";
import { plannedFeatures } from "./release-tabs.ts";

const day = "2027-02-15";
const releaseId = (at: number) =>
  `30000000-0000-4000-8000-00000000000${String(at)}`;
const rowOf = (stream: ReleaseStream, show: Show = "both") => {
  const [row] = streamRows([stream], show, day);
  return row as NonNullable<typeof row>;
};
const table = (streams: ReleaseStream[] = []) =>
  streamTable({ streams, day, onOpen: vi.fn() });
const columnOf = (key: string) =>
  table()
    .columnsFor([], [], [], [])
    .find((column) => column.key === key);

describe("a schedule's row", () => {
  it("shows its name, current cycle and its days, next release and its day, length now and end", () => {
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
    expect([
      row.name,
      row.currentCycle,
      row.cycleStarts,
      row.cycleEnds,
      row.nextRelease,
      row.releaseDate,
      row.lengthNow,
      row.endsOn,
    ]).toEqual([
      "Fictional Majors",
      "27.1",
      "2027-01-01",
      "2027-03-31",
      "Fictional One",
      "2027-03-31",
      "3 months",
      "",
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
    expect([row.nextRelease, row.releaseDate]).toEqual([
      "Fictional Sooner",
      "2027-03-31",
    ]);
  });

  it("is blank for a schedule with no cycles yet", () => {
    const row = rowOf(fictionalStream({ patterns: [], cycles: [] }));
    expect([
      row.currentCycle,
      row.cycleStarts,
      row.nextRelease,
      row.releaseDate,
      row.lengthNow,
    ]).toEqual(["", "", "", "", ""]);
  });

  it("has no draft when nothing in its schedule has one", () => {
    expect(rowOf(fictionalStream()).draft).toBeUndefined();
  });

  it("marks Next release when a draft changes the next release's colour", () => {
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
    expect(row.draft?.changed).toEqual(["nextRelease"]);
  });

  it("has no draft when its parts' drafts change nothing it shows, such as a later release's colour", () => {
    const row = rowOf(
      fictionalStream({
        releases: [
          fictionalRelease(),
          fictionalRelease({
            id: releaseId(2),
            name: "Fictional Later",
            firstCycle: "2027-04-01",
            lastCycle: "2027-04-01",
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
      changed: ["lengthNow", "nextRelease"],
      madeBy: "Fictional Later",
      madeAs: undefined,
      changedBy: {
        lengthNow: "Fictional Editor",
        nextRelease: "Fictional Later",
      },
      unpublished: false,
      needsOtherApprover: true,
      live: {
        name: "Fictional Majors",
        currentCycle: "27.1",
        currentCycleId: `${streamId} 2027-01-01`,
        cycleStarts: "2027-01-01",
        cycleEnds: "2027-03-31",
        nextRelease: "Fictional One",
        nextReleaseColour: "",
        nextReleaseId: "30000000-0000-4000-8000-000000000001",
        releaseDate: "2027-03-31",
        lengthNow: "",
        endsOn: "",
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

  it("adds the columns its parts' drafts change to the schedule's own draft, saying it retires the schedule", () => {
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
      ["retired", "nextRelease", "releaseDate"],
      true,
    ]);
  });
});

describe("a schedule's row with its drafts applied", () => {
  it("leaves out what a waiting draft removes and takes back rejected drafts", () => {
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
    expect([row.nextRelease, row.draft?.changed]).toEqual([
      "Fictional Kept",
      ["nextRelease"],
    ]);
  });
});

describe("the row's draft standing for every draft it shows", () => {
  it("keeps the state of the schedule's own draft, while the row can still be decided for its parts", () => {
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

  it("marks each value its parts' drafts change by those drafts, whatever the schedule's own draft's state", () => {
    // Given a schedule whose own rename was rejected, while removing its next release waits
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

    // Then the row is rejected, but the next release it shows is marked waiting
    const row = rowOf(stream);
    expect([
      row.draft?.state,
      row.cellDrafts?.get("nextRelease")?.state,
      row.cellDrafts?.has("name"),
    ]).toEqual(["rejected", "waiting", false]);
  });

  it("leaves its values unmarked as it is live", () => {
    const stream = fictionalStream({
      releases: [
        fictionalRelease({ draft: recordDraft({ action: "deleted" }) }),
      ],
    });
    const row = rowOf(stream);
    expect([
      row.cellDrafts?.size,
      table([stream])
        .liveRecords([row])
        .map(({ cellDrafts }) => cellDrafts),
    ]).toEqual([2, [undefined]]);
  });

  it("marks each value only by the schedule's own draft where its parts' drafts change none", () => {
    expect(
      rowOf(
        fictionalStream({
          draft: recordDraft({
            changed: ["name"],
            live: { name: "Fictional Before" },
          }),
        }),
      ).cellDrafts,
    ).toBeUndefined();
  });

  it("leaves out the schedule's own rejected draft with drafts applied", () => {
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
      ["nextRelease", "releaseDate"],
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

  it("marks the current cycle and next release as changed when a draft of the day it ends changes them", () => {
    const row = rowOf(
      fictionalStream({
        endsOn: "2026-12-31",
        cycles: [],
        draft: recordDraft({
          changed: ["endsOn"],
          live: { endsOn: null },
        }),
        releases: [fictionalRelease()],
        liveCycles: fictionalStream().cycles,
      }),
    );
    expect(row.draft?.changed).toEqual([
      "endsOn",
      "currentCycle",
      "cycleStarts",
      "cycleEnds",
      "lengthNow",
      "nextRelease",
      "releaseDate",
    ]);
  });

  it("marks the current cycle and next release as changed when a cycle change moves them", () => {
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
    expect(row.draft?.changed).toEqual([
      "currentCycle",
      "cycleStarts",
      "cycleEnds",
      "nextRelease",
      "releaseDate",
    ]);
  });
});

describe("the schedules as they are live", () => {
  it("are each schedule without its drafts", () => {
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

  it("leave out a schedule only drafted to be added", () => {
    const added = fictionalStream({
      draft: recordDraft({ action: "created" }),
    });
    expect(
      table([added]).liveRecords(streamRows([added], "both", day)),
    ).toEqual([]);
  });
});

describe("the table of schedules", () => {
  it("names the drafts of each schedule named that can be decided, its own and its parts'", () => {
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

  it("words what a schedule's draft changes, as the table shows it", () => {
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
          field: "Schedule",
          oldValue: ["Fictional Majors"],
          newValue: ["Fictional New Name"],
        },
      },
    ]);
  });

  it("groups schedules by whether they are retired, as they are live, or else ended", () => {
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

  it("shows Ended after the name of a schedule whose last day has passed", () => {
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

  it("colours the next release by its own colour, sea when it has none, and nothing when none is to come", () => {
    const colourOf = (stream: ReleaseStream) =>
      columnOf("nextRelease")?.colour?.(rowOf(stream));
    expect([
      colourOf(
        fictionalStream({ releases: [fictionalRelease({ colour: "grape" })] }),
      ),
      colourOf(fictionalStream({ releases: [fictionalRelease()] })),
      colourOf(fictionalStream()),
    ]).toEqual(["grape", "sea", null]);
  });

  it("offers what a schedule's menu adds", () => {
    const retire = vi.fn(() => "Retire");
    const withMenu = streamTable({
      streams: [],
      day,
      onOpen: vi.fn(),
      menuItems: retire,
    });
    const row = rowOf(fictionalStream());
    expect([withMenu.menuItems?.(row), table().menuItems]).toEqual([
      "Retire",
      undefined,
    ]);
  });

  it("names the features of the current cycle as drafted, and as live in its Live row, marked where a draft moves the cycle", () => {
    // Given a pattern drafted to start a month later, moving the current cycle
    const drafted = fictionalCycle("27.1", "2027-02-01", "2027-04-30");
    const stream = fictionalStream({
      patterns: [
        fictionalPattern({
          startsOn: "2027-02-01",
          draft: recordDraft({
            changed: ["startsOn"],
            live: { startsOn: "2027-01-01" },
          }),
        }),
      ],
      cycles: [drafted],
      liveCycles: quarters(1),
    });
    const inCycle = (id: string, targetCycle: string) =>
      fictionalFeature({ id, targetStreamId: streamId, targetCycle });
    const planned = plannedFeatures([
      inCycle("60000000-0000-4000-8000-000000000001", "2027-01-01"),
      inCycle("60000000-0000-4000-8000-000000000002", "2027-02-01"),
    ]);
    const schedules = streamTable({
      streams: [stream],
      day,
      onOpen: vi.fn(),
      planned,
    });
    const row = rowOf(stream);
    const [liveRow] = schedules.liveRecords([row]);
    const column = schedules
      .columnsFor([], [], [], [row])
      .find(({ key }) => key === "features");

    expect([
      column?.value(row),
      liveRow === undefined ? undefined : column?.value(liveRow),
      row.draft?.changed.includes(column?.changesWith ?? ""),
    ]).toEqual([
      ["60000000-0000-4000-8000-000000000002"],
      ["60000000-0000-4000-8000-000000000001"],
      true,
    ]);
  });

  it("has its columns in its own order, and names each stream", () => {
    const streams = streamTable({
      streams: [],
      day,
      onOpen: vi.fn(),
      planned: plannedFeatures([]),
    });
    expect([
      streams.columnsFor([], [], [], []).map(({ key }) => key),
      streams.nameOf(rowOf(fictionalStream())),
    ]).toEqual([streamColumnOrder, "Fictional Majors"]);
  });
});

describe("schedules shown while retired ones are hidden", () => {
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
