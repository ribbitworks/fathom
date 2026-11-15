// SPDX-License-Identifier: Apache-2.0

// Tests for the Releases tab's table: what each release's row shows, the draft its row is marked
// with, the rows as each Draft view shows them, a release's rows for its details, how rows are
// grouped, and what the table names, colours and decides.

import type { Release, ReleaseStream, Show } from "@fathom/shared";
import { describe, expect, it, vi } from "vitest";
import { cellKinds } from "./cell-kinds.tsx";
import {
  releaseColumnOrder,
  releaseDetailColumns,
  releaseDetailRows,
  type ReleaseRow,
  releaseRows,
  releaseTable,
} from "./release-table.tsx";
import {
  fictionalRelease,
  fictionalStream,
  recordDraft,
  streamId,
} from "./test-support.tsx";

const day = "2027-02-15";
const secondId = "30000000-0000-4000-8000-000000000002";

const inStream = (...releases: Release[]) => fictionalStream({ releases });
const rowsOf = (stream: ReleaseStream, show: Show = "both") =>
  releaseRows([stream], show, day);
const rowOf = (release: Release) => {
  const [row] = rowsOf(inStream(release), "both");
  return row as ReleaseRow;
};
const table = (
  streams: readonly ReleaseStream[] = [],
  changes: Partial<Parameters<typeof releaseTable>[0]> = {},
) =>
  releaseTable({
    streams,
    day,
    changeable: () => true,
    onOpen: vi.fn(),
    menuItems: () => null,
    ...changes,
  });

describe("a release's row", () => {
  it("shows its name, schedule, the day it ships, its cycles, colour and note", () => {
    const row = rowOf(
      fictionalRelease({
        lastCycle: "2027-04-01",
        colour: "grape",
        note: "Fictional words",
      }),
    );
    expect([
      row.name,
      row.schedule,
      row.shipsOn,
      row.cycles,
      row.status,
      row.colour,
      row.note,
    ]).toEqual([
      "Fictional One",
      streamId,
      "2027-06-30",
      [`${streamId} 2027-01-01`, `${streamId} 2027-04-01`],
      "",
      "Grape",
      "Fictional words",
    ]);
  });

  it("is shipped once the day it ships has passed", () => {
    expect(rowOf(fictionalRelease({ shipsOn: "2027-02-14" })).status).toBe(
      "shipped",
    );
  });

  it("ships on no day when its last cycle isn't made", () => {
    const row = rowOf(
      fictionalRelease({ firstCycle: "2031-01-01", lastCycle: "2031-01-01" }),
    );
    expect([row.shipsOn, row.status]).toEqual(["", ""]);
  });

  it("has no draft when its release has none", () => {
    expect(rowOf(fictionalRelease()).draft).toBeUndefined();
  });

  it("marks what its release's draft changes, with the value as it is live", () => {
    const row = rowOf(
      fictionalRelease({
        name: "Fictional Renamed",
        draft: recordDraft({
          changed: ["name"],
          live: { name: "Fictional One" },
        }),
      }),
    );
    expect([row.draft?.changed, row.draft?.live.name]).toEqual([
      ["name"],
      "Fictional One",
    ]);
  });

  it("marks the day it ships and its cycles when a draft moves its last cycle", () => {
    const row = rowOf(
      fictionalRelease({
        lastCycle: "2027-04-01",
        draft: recordDraft({
          changed: ["lastCycle"],
          live: { lastCycle: "2027-01-01" },
        }),
      }),
    );
    expect(row.draft?.changed).toEqual(["shipsOn", "cycles"]);
  });

  it("marks its note when a draft changes it", () => {
    const row = rowOf(
      fictionalRelease({
        note: "Fictional words",
        draft: recordDraft({ changed: ["note"], live: { note: null } }),
      }),
    );
    expect(row.draft?.changed).toEqual(["note"]);
  });
});

describe("the releases with their drafts applied", () => {
  it("leave out what a waiting draft removes, and take back rejected drafts", () => {
    const stream = inStream(
      fictionalRelease({ draft: recordDraft({ action: "deleted" }) }),
      fictionalRelease({
        id: secondId,
        name: "Fictional Renamed",
        firstCycle: "2027-04-01",
        lastCycle: "2027-04-01",
        draft: recordDraft({
          changed: ["name"],
          live: { name: "Fictional Two" },
          state: "rejected",
        }),
      }),
    );
    expect(
      rowsOf(stream, "drafts").map(({ name, draft }) => [name, draft]),
    ).toEqual([["Fictional Two", undefined]]);
  });
});

describe("the releases as they are live", () => {
  it("are each release without its draft", () => {
    const stream = inStream(
      fictionalRelease({
        name: "Fictional Renamed",
        draft: recordDraft({
          changed: ["name"],
          live: { name: "Fictional One" },
        }),
      }),
    );
    const [live] = table([stream]).liveRecords(rowsOf(stream));
    expect([live?.name, live?.live, live?.draft]).toEqual([
      "Fictional One",
      true,
      undefined,
    ]);
  });

  it("leave out a release only drafted to be added", () => {
    const stream = inStream(
      fictionalRelease({ draft: recordDraft({ action: "created" }) }),
    );
    expect(table([stream]).liveRecords(rowsOf(stream))).toEqual([]);
  });
});

describe("a release's rows for its details", () => {
  const renamed = fictionalRelease({
    name: "Fictional Renamed",
    draft: recordDraft({ changed: ["name"], live: { name: "Fictional One" } }),
  });
  const detailOf = (release: Release, show: Show) =>
    releaseDetailRows(inStream(release), release.id, show, day);

  it("show the release as each Draft view does, with its draft and as it is live", () => {
    const names = (show: Show) => {
      const rows = detailOf(renamed, show);
      return [rows?.shown.name, rows?.drafted.name, rows?.live.name];
    };
    expect([names("both"), names("drafts"), names("live")]).toEqual([
      ["Fictional Renamed", "Fictional Renamed", "Fictional One"],
      ["Fictional Renamed", "Fictional Renamed", "Fictional One"],
      ["Fictional One", "Fictional Renamed", "Fictional One"],
    ]);
  });

  it("show a release drafted to be removed as drafted, with its drafts applied", () => {
    const removing = fictionalRelease({
      draft: recordDraft({ action: "deleted" }),
    });
    expect(detailOf(removing, "drafts")?.shown.draft?.action).toBe("deleted");
  });

  it("show a release only drafted to be added as drafted, while it isn't live", () => {
    const added = fictionalRelease({
      draft: recordDraft({ action: "created" }),
    });
    expect(detailOf(added, "live")?.shown.live).toBe(false);
  });

  it("are none for a release its schedule doesn't hold", () => {
    expect(
      releaseDetailRows(inStream(), fictionalRelease().id, "both", day),
    ).toBeUndefined();
  });
});

describe("the table of releases", () => {
  it("groups releases by schedule, in the schedules' order", () => {
    const later = fictionalStream({ id: "s2", name: "Fictional Minors" });
    const stream = inStream(fictionalRelease());
    const [schedule] = table([stream, later]).groupings ?? [];
    const [row] = releaseRows(
      [later, stream].map((each) =>
        each.id === "s2"
          ? { ...each, releases: [fictionalRelease({ id: secondId })] }
          : each,
      ),
      "both",
      day,
    );
    expect([schedule?.label, schedule?.of(row as ReleaseRow)]).toEqual([
      "Schedule",
      [{ key: "s2", label: "Fictional Minors", rank: 1 }],
    ]);
  });

  it("heads its columns, listing the releases given, their cycles in order, and every schedule, with no filter on Status", () => {
    const later = fictionalStream({ id: "s2", name: "Fictional Minors" });
    const releases = releaseRows(
      [
        inStream(
          fictionalRelease({
            firstCycle: "2027-04-01",
            lastCycle: "2027-04-01",
          }),
          fictionalRelease({
            id: secondId,
            name: "Fictional Earlier",
            lastCycle: "2027-04-01",
          }),
        ),
        later,
      ],
      "both",
      day,
    );
    const columns = table([fictionalStream(), later]).columnsFor(
      [],
      [],
      [],
      releases,
    );
    expect(
      columns.map(
        ({ label, kind, choices, required, multiple, filterable }) => [
          label,
          kind,
          choices.map((choice) => choice.label),
          required,
          multiple,
          filterable === false,
        ],
      ),
    ).toEqual([
      [
        "Release",
        "choice",
        ["Fictional Earlier", "Fictional One"],
        true,
        false,
        false,
      ],
      [
        "Schedule",
        "choice",
        ["Fictional Majors", "Fictional Minors"],
        true,
        false,
        false,
      ],
      ["Ships on", "date", [], false, false, false],
      [
        "Cycles",
        "choice",
        ["Fictional Majors: 27.1", "Fictional Majors: 27.2"],
        false,
        true,
        false,
      ],
      ["Status", "choice", ["Shipped"], false, false, true],
    ]);
  });

  it("words a release's cycles as a run, in its cell and its draft, not as its filter names them", () => {
    const row = rowOf(
      fictionalRelease({
        lastCycle: "2027-04-01",
        draft: recordDraft({
          changed: ["lastCycle"],
          live: { lastCycle: "2027-01-01" },
        }),
      }),
    );
    const releases = table([fictionalStream()]);
    const cycles = releases
      .columnsFor([], [], [], [row])
      .find(({ key }) => key === "cycles") as NonNullable<
      ReturnType<typeof releases.columnsFor>[number]
    >;
    const draft = row.draft as NonNullable<typeof row.draft>;
    expect([
      cellKinds.choice.inWords(cycles, cycles.value(row)),
      cellKinds.choice.inWords(cycles, cycles.live(draft)),
      cellKinds.choice.inWords(cycles, []),
      cellKinds.choice.inWords(cycles, ["Fictional Gone"]),
      releases
        .draftFields(row, draft, [], [])
        .find(({ key }) => key === "cycles")?.field,
    ]).toEqual([
      "27.1 to 27.2",
      "27.1",
      "",
      "Fictional Gone",
      { field: "Cycles", oldValue: "27.1", newValue: "27.1 to 27.2" },
    ]);
  });

  it("lists each release by itself, named with its schedule only where two in the data share a name, its cell reading its name alone", () => {
    const minors = fictionalStream({
      id: "s2",
      name: "Fictional Minors",
      releases: [
        fictionalRelease({ id: "r2", name: "Fictional One" }),
        fictionalRelease({ id: "r3", name: "Fictional Lone" }),
      ],
    });
    const majors = inStream(fictionalRelease());
    // Only the Minors' releases are listed, but Majors' shares a name with one.
    const rows = releaseRows([minors], "both", day);
    const [name] = table([majors, minors]).columnsFor([], [], [], rows);
    const column = name as NonNullable<typeof name>;
    expect([
      column.choices.map(({ id, label }) => [id, label]),
      rows.map((row) => column.value(row)),
      cellKinds.choice.inWords(column, ["r2"]),
      cellKinds.choice.inWords(column, ["Fictional Gone"]),
    ]).toEqual([
      [
        ["r3", "Fictional Lone"],
        ["r2", "Fictional Minors: Fictional One"],
      ],
      [["r2"], ["r3"]],
      "Fictional One",
      "Fictional Gone",
    ]);
  });

  it("shows a release's schedule and whether it has shipped by their choices", () => {
    const columns = table([fictionalStream()]).columnsFor([], [], [], []);
    const row = rowOf(fictionalRelease({ shipsOn: "2027-02-14" }));
    expect(
      ["schedule", "status"].map((key) =>
        columns.find((column) => column.key === key)?.value(row),
      ),
    ).toEqual([[streamId], ["shipped"]]);
  });

  it("shows the table's columns in a release's details, then its colour", () => {
    expect(releaseDetailColumns([], []).map(({ key }) => key)).toEqual([
      ...releaseColumnOrder,
      "colour",
    ]);
  });

  it("names the drafts of each release named that can be decided", () => {
    const stream = inStream(
      fictionalRelease({ draft: recordDraft() }),
      fictionalRelease({
        id: secondId,
        draft: recordDraft({ state: "rejected" }),
      }),
      fictionalRelease({ id: "r3" }),
    );
    expect(
      table([stream]).drafts([fictionalRelease().id, secondId, "r3"]).records,
    ).toEqual([{ type: "release", id: fictionalRelease().id }]);
  });

  it("words what a release's draft changes, those only its details show included", () => {
    const row = rowOf(
      fictionalRelease({
        colour: "grape",
        note: "Fictional words",
        draft: recordDraft({
          changed: ["colour", "note"],
          live: { colour: null, note: null },
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
        key: "colour",
        field: { field: "Colour", oldValue: "Sea", newValue: "Grape" },
      },
      {
        key: "note",
        field: { field: "Note", oldValue: "", newValue: "Fictional words" },
      },
    ]);
  });

  it("colours a release's name, and its Colour in its details, by its colour, or sea when it has none", () => {
    const [name] = table().columnsFor([], [], [], []);
    const colour = releaseDetailColumns([], []).find(
      ({ key }) => key === "colour",
    );
    const grape = rowOf(fictionalRelease({ colour: "grape" }));
    expect([
      name?.colour?.(grape),
      name?.colour?.(rowOf(fictionalRelease())),
      colour?.colour?.(grape),
    ]).toEqual(["grape", "sea", "grape"]);
  });

  it("opens a release's details, and is read only for a release that can't be changed now", () => {
    const onOpen = vi.fn();
    const release = fictionalRelease();
    const releases = table([], { onOpen, changeable: () => false });
    releases.showDetails?.(rowOf(release));
    expect([
      onOpen.mock.calls,
      releases.readOnlyRecord?.(rowOf(release)),
    ]).toEqual([[[release]], true]);
  });

  it("has its columns in its own order, offers what a release's menu adds, and refuses to add a record itself", () => {
    const releases = table([], { menuItems: () => "Add note…" });
    const row = rowOf(fictionalRelease());
    expect([
      releases.columnsFor([], [], [], []).map(({ key }) => key),
      releases.nameOf(row),
      releases.menuItems?.(row),
      releases.newRowLabel(""),
      releases.removeLabel(row),
      releases.recordProblem({}, () => []),
    ]).toEqual([
      releaseColumnOrder,
      "Fictional One",
      "Add note…",
      "New release",
      "Remove release",
      undefined,
    ]);
    expect(() => {
      releases.request([], "");
    }).toThrow("A read-only table adds no records");
  });
});
