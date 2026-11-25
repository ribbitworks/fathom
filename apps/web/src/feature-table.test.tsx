// SPDX-License-Identifier: Apache-2.0

// Tests for Features' table: its columns, the groups its rows go in, and its drafts in words.

import type { Feature } from "@fathom/shared";
import { describe, expect, it } from "vitest";
import {
  featureColumnGroups,
  featureColumns,
  featureTable,
} from "./feature-table.tsx";
import { staffedChoices } from "./planning-columns.tsx";
import { livePlanRecords } from "./plan-table.tsx";
import { planDraftFields } from "./project-grids.tsx";
import { cycleChoices, releaseOfCycle } from "./projects.ts";
import {
  fictionalCycle,
  fictionalRelease,
  fictionalStream,
} from "./test-releases.ts";
import {
  choices,
  cycleChoice,
  feature,
  featureDraft,
  recordDraft,
} from "./test-support.tsx";

const cycles = [
  cycleChoice("s1 2027-01-01", "Fictional Stream: 27.1"),
  cycleChoice("s1 2027-04-01", "Fictional Stream: 27.2"),
];

describe("the Features table", () => {
  const columns = featureColumns(choices({ cycles }));
  const target = columns.find(({ key }) => key === "targetCycle");
  const team = columns.find(({ key }) => key === "featureTeamId");
  const status = columns.find(({ key }) => key === "statusId");
  const neededBy = columns.find(({ key }) => key === "neededBy");
  const note = columns.find(({ key }) => key === "note");
  const groupingOf = (key: string, more: Partial<Feature>) =>
    featureTable(choices({ cycles }))
      .groupings?.find((grouping) => grouping.key === key)
      ?.of(feature(more))[0];
  const groupOf = (more: Partial<Feature>) => groupingOf("targetCycle", more);
  const monthGroupOf = (more: Partial<Feature>) => groupingOf("neededBy", more);

  it("shows a feature's target as its stream and cycle together", () => {
    expect(
      target?.value(
        feature({ targetStreamId: "s1", targetCycle: "2027-01-01" }),
      ),
    ).toEqual(["s1 2027-01-01"]);
  });

  it("shows a feature with no target as having none", () => {
    expect(target?.value(feature())).toEqual([]);
  });

  it("saves a target as its stream and cycle", () => {
    expect(target?.change(["s1 2027-04-01"])).toEqual({
      targetStreamId: "s1",
      targetCycle: "2027-04-01",
    });
  });

  it("saves no target as Later", () => {
    expect(target?.change([])).toEqual({
      targetStreamId: null,
      targetCycle: null,
    });
  });

  it("reads a draft's live target", () => {
    expect(
      target?.live(
        featureDraft({
          changed: ["targetCycle"],
          live: { targetStreamId: "s1", targetCycle: "2027-01-01" },
        }),
      ),
    ).toEqual(["s1 2027-01-01"]);
  });

  it("makes one request from the values of a new row", () => {
    expect(
      featureTable(choices({ cycles })).request(
        [{ name: "Fictional" }, { status: "planned" }],
        "",
      ),
    ).toEqual({ name: "Fictional", status: "planned", values: {}, links: {} });
  });

  it("names a cycle only live, kept from being picked, in date order", () => {
    const offered = cycleChoices([
      fictionalStream({
        cycles: [fictionalCycle("New", "2027-06-01", "2027-08-31")],
        liveCycles: [
          fictionalCycle("Old", "2027-07-01", "2027-09-30"),
          fictionalCycle("New", "2027-06-01", "2027-08-31"),
        ],
      }),
    ]);
    expect(offered.map(({ label, retired }) => [label, retired])).toEqual([
      ["Fictional Majors: New", false],
      ["Fictional Majors: Old", true],
    ]);
  });

  it("marks a planned feature with no feature team", () => {
    expect(team?.status?.(feature({ featureTeamId: null }))).toEqual({
      words: "No feature team",
      spoken: "it needs a feature team to own it",
    });
  });

  it("does not mark a possible feature with no feature team", () => {
    expect(
      team?.status?.(
        feature({ statusId: "possible-first", featureTeamId: null }),
      ),
    ).toBeUndefined();
  });

  it("starts its columns in the order a feature's details group them", () => {
    expect(columns.map(({ key }) => key)).toEqual(
      featureColumnGroups.flatMap(({ keys }) => keys),
    );
    expect(columns.map(({ key }) => key)).toEqual([
      "name",
      "statusId",
      "description",
      "note",
      "customerIds",
      "projectIds",
      "proposalIds",
      "priorityId",
      "neededBy",
      "estimateHours",
      "sizeId",
      "riskId",
      "release",
      "targetCycle",
      "featureTeamId",
      "staffed",
    ]);
  });

  it("offers a priority, size and risk from their lists, none of them required", () => {
    const offered = featureColumns(
      choices({
        priorities: [cycleChoice("high", "High")],
        sizes: [cycleChoice("medium", "M")],
        risks: [cycleChoice("low", "Low")],
      }),
    );
    for (const [key, id] of [
      ["priorityId", "high"],
      ["sizeId", "medium"],
      ["riskId", "low"],
    ] as const) {
      const column = offered.find((one) => one.key === key);
      expect(column?.required).toBe(false);
      expect(column?.choices.map((offer) => offer.id)).toEqual([id]);
      expect(column?.change([id])).toEqual({ [key]: id });
      expect(column?.change([])).toEqual({ [key]: null });
    }
  });

  it("starts a new feature in the first status offered that means Possible", () => {
    expect(status?.newRowValue?.("")).toEqual(["possible-first"]);
  });

  it("starts a new feature with no status when none means Possible", () => {
    const none = featureColumns(choices({ featureStatuses: [] }));
    expect(
      none.find(({ key }) => key === "statusId")?.newRowValue?.(""),
    ).toEqual([]);
  });

  it("saves a month typed as digits laid out as a month", () => {
    expect(neededBy?.change("202703")).toEqual({ neededBy: "2027-03" });
  });

  it("saves an emptied month as none", () => {
    expect(neededBy?.change("")).toEqual({ neededBy: null });
  });

  it("reads and saves a note held as the feature's own field", () => {
    expect(note?.value(feature({ note: "**Fictional**" }))).toBe(
      "**Fictional**",
    );
    expect(note?.value(feature())).toBe("");
    expect(note?.change("**Fictional**")).toEqual({ note: "**Fictional**" });
    expect(note?.change("")).toEqual({ note: null });
  });

  it("groups a feature under the month it is needed by, earlier months first", () => {
    const march = monthGroupOf({ neededBy: "2027-03" });
    expect(march).toMatchObject({ key: "2027-03", label: "Mar 2027" });
    expect(Number(march?.rank)).toBeLessThan(
      Number(monthGroupOf({ neededBy: "2027-11" })?.rank),
    );
  });

  it("groups a feature needed by no month last, under No date", () => {
    const none = monthGroupOf({});
    expect(none).toMatchObject({ key: "no-date", label: "No date" });
    expect(Number(none?.rank)).toBeGreaterThan(
      Number(monthGroupOf({ neededBy: "2099-12" })?.rank),
    );
  });

  it("groups a feature under its cycle, in the cycles' order", () => {
    expect(
      groupOf({ targetStreamId: "s1", targetCycle: "2027-04-01" }),
    ).toEqual({
      key: "s1 2027-04-01",
      label: "Fictional Stream: 27.2",
      rank: 1,
    });
  });

  it("groups a feature with no target in Later, after every cycle", () => {
    expect(groupOf({})).toEqual({
      key: "later",
      label: "Later",
      rank: Number.MAX_SAFE_INTEGER,
    });
  });

  it("groups a feature on a cycle no longer offered in Later", () => {
    expect(
      groupOf({ targetStreamId: "gone", targetCycle: "2030-01-01" })?.key,
    ).toBe("later");
  });

  it("describes a changed target in words in a draft", () => {
    const fields = planDraftFields(
      "feature",
      feature({
        targetStreamId: "s1",
        targetCycle: "2027-04-01",
        draft: featureDraft({
          changed: ["targetCycle", "targetStreamId"],
          live: { targetStreamId: "s1", targetCycle: "2027-01-01" },
        }),
      }),
      choices({ cycles }),
    );
    expect(fields.map(({ field }) => field)).toEqual([
      {
        field: "Target cycle",
        oldValue: ["Fictional Stream: 27.1"],
        newValue: ["Fictional Stream: 27.2"],
      },
    ]);
  });
});

describe("a feature's estimate in a draft", () => {
  it("is given in hours, as kept, whatever unit the table shows", () => {
    const fields = planDraftFields(
      "feature",
      feature({
        estimateHours: 16,
        draft: featureDraft({
          changed: ["estimateHours"],
          live: { estimateHours: 8 },
        }),
      }),
      choices(),
    );
    expect(fields.map(({ field }) => field)).toEqual([
      { field: "Effort", oldValue: "8 hours", newValue: "16 hours" },
    ]);
  });

  it("is given as none when there is none", () => {
    const fields = planDraftFields(
      "feature",
      feature({
        estimateHours: null,
        draft: featureDraft({
          changed: ["estimateHours"],
          live: { estimateHours: 8 },
        }),
      }),
      choices(),
    );
    expect(fields.map(({ field }) => field.newValue)).toEqual([""]);
  });
});

describe("columns added to Features", () => {
  const sizes = {
    id: "sizes",
    keyNumber: 1,
    name: "Fictional Sizes",
    description: "",
    visibility: "general" as const,
    retired: false,
    choices: [cycleChoice("small", "Small"), cycleChoice("large", "Large")],
  };
  const size = {
    id: "size",
    keyNumber: 1,
    name: "Fictional Size",
    type: "choice" as const,
    listId: "sizes",
    visibility: null,
    multiple: false,
    required: true,
    onPlannedHires: false,
  };
  const score = {
    ...size,
    id: "score",
    keyNumber: 1,
    name: "Fictional Score",
    type: "number" as const,
    listId: null,
    visibility: "general" as const,
    required: false,
  };
  const added = choices({
    featureColumns: {
      fields: [size, score],
      order: ["name", "size", "score"],
      lists: [sizes],
    },
  });
  const column = (key: string) =>
    featureColumns(added).find((one) => one.key === key);

  it("come after the built-in columns, in the order given", () => {
    const keys = featureColumns(
      choices({
        featureColumns: {
          fields: [size, score],
          order: ["score", "name", "size"],
          lists: [sizes],
        },
      }),
    ).map(({ key }) => key);
    expect(keys.slice(0, 2)).toEqual(["name", "statusId"]);
    expect(keys.slice(-2)).toEqual(["score", "size"]);
  });

  it("offer their list's choices and say whether they are required", () => {
    expect(column("size")).toMatchObject({
      label: "Fictional Size",
      required: true,
      choices: sizes.choices,
    });
  });

  it("take a value while only drafted to be added", () => {
    const drafted = featureColumns(
      choices({
        featureColumns: {
          fields: [
            {
              ...size,
              draft: { ...recordDraft({ action: "created" }), live: {} },
            },
          ],
          order: ["size", "name"],
          lists: [sizes],
        },
      }),
    ).find(({ key }) => key === "size");
    expect(drafted?.readOnly).toBeFalsy();
    expect(drafted?.change(["large"])).toEqual({ values: { size: ["large"] } });
  });

  it("save a value by its column", () => {
    expect(column("size")?.change(["large"])).toEqual({
      values: { size: ["large"] },
    });
  });

  it("make one request from several columns' values in a new row", () => {
    const request = featureTable(added).request(
      [
        { name: "Fictional Feature" },
        { values: { size: ["small"] } },
        { numbers: { score: 4 } },
        { links: { gone: null } },
      ],
      "",
    );
    expect(request).toMatchObject({
      name: "Fictional Feature",
      values: { size: ["small"] },
      numbers: { score: 4 },
      links: {},
    });
  });

  it("put a value a draft changes back as it is live", () => {
    const [live] = livePlanRecords([
      feature({
        values: { size: ["large"], other: ["kept"] },
        description: "Now",
        draft: featureDraft({
          changed: ["size", "description"],
          live: { values: { size: ["small"] }, description: "Before" },
        }),
      }),
    ]);
    expect(live).toMatchObject({
      values: { size: ["small"], other: ["kept"] },
      description: "Before",
    });
    expect(live?.draft).toBeUndefined();
  });

  it("are named in words in a draft", () => {
    const fields = planDraftFields(
      "feature",
      feature({
        values: { size: ["large"] },
        draft: featureDraft({
          changed: ["size"],
          live: { values: { size: ["small"] } },
        }),
      }),
      added,
    );
    expect(fields.map(({ field }) => field)).toEqual([
      { field: "Fictional Size", oldValue: ["Small"], newValue: ["Large"] },
    ]);
  });
});

describe("features by release", () => {
  const streams = [
    fictionalStream({
      releases: [fictionalRelease({ lastCycle: "2027-04-01" })],
    }),
  ];
  const offered = choices({
    cycles: cycleChoices(streams),
    releaseOfCycle: releaseOfCycle(streams),
  });
  const release = featureColumns(offered).find(({ key }) => key === "release");
  const releaseGroupOf = (more: Partial<Feature>) =>
    featureTable(offered)
      .groupings?.find(({ key }) => key === "release")
      ?.of(feature(more))[0];
  const targeting = (targetCycle: string) => ({
    targetStreamId: fictionalStream().id,
    targetCycle,
  });

  it("groups a feature under the release its target cycle is in", () => {
    expect(releaseGroupOf(targeting("2027-04-01"))?.label).toMatch(
      /^Fictional Majors: Fictional One, ships /,
    );
  });

  it("groups a feature on a cycle in no release under its stream's Not released yet", () => {
    expect(releaseGroupOf(targeting("2027-07-01"))?.label).toBe(
      "Fictional Majors: Not released yet",
    );
  });

  it("groups a feature with no target in Later, after every release", () => {
    expect(releaseGroupOf({})).toMatchObject({
      label: "Later",
      rank: Number.MAX_SAFE_INTEGER,
    });
  });

  it("names the release in its column, and the live one under a draft", () => {
    const moved = feature({
      ...targeting("2027-07-01"),
      draft: featureDraft({
        changed: ["targetCycle"],
        live: targeting("2027-01-01"),
      }),
    });
    const named = (ids: unknown) =>
      (ids as string[]).map(
        (id) => release?.choices.find((offer) => offer.id === id)?.label,
      );
    expect(named(release?.value(moved))).toEqual([
      "Fictional Majors: Not released yet",
    ]);
    expect(named(release?.live(moved.draft as never))).toEqual([
      "Fictional Majors: Fictional One",
    ]);
  });

  it("leaves the column empty for a feature in Later, and read only", () => {
    expect(release?.value(feature())).toEqual([]);
    expect(release?.readOnly).toBe(true);
    expect(release?.change(["anything"])).toEqual({});
    expect(release?.emptyLabel).toBe("Later");
  });

  it("leaves the column empty for a feature on a cycle no longer offered", () => {
    expect(
      release?.value(
        feature({ targetStreamId: "gone", targetCycle: "2030-01-01" }),
      ),
    ).toEqual([]);
  });

  it("offers the releases, then the cycles in none, by name", () => {
    expect(release?.choices.map(({ label }) => label)).toEqual([
      "Fictional Majors: Fictional One",
      "Fictional Majors: Not released yet",
    ]);
  });
});

describe("the Staffed column", () => {
  const offered = choices({
    featureStatuses: [
      { ...cycleChoice("idea", "Idea"), meaning: "possible" },
      { ...cycleChoice("planned", "Planned"), meaning: "planned" },
      { ...cycleChoice("building", "Building"), meaning: "in-progress" },
      { ...cycleChoice("shipped", "Shipped"), meaning: "done" },
    ],
  });
  const staffed = featureColumns(offered).find(({ key }) => key === "staffed");

  it.each(["planned", "building"])(
    "says No for a %s feature with no one allocated",
    (statusId) => {
      expect(staffed?.value(feature({ statusId }))).toEqual([
        staffedChoices.no,
      ]);
    },
  );

  it("says Yes for a committed feature someone is allocated to", () => {
    expect(staffed?.value(feature({ staffed: true }))).toEqual([
      staffedChoices.yes,
    ]);
  });

  it.each(["idea", "shipped"])(
    "is empty for a %s feature, which isn't committed",
    (statusId) => {
      expect(staffed?.value(feature({ statusId, staffed: true }))).toEqual([]);
    },
  );

  it("calls a feature that isn't committed Not committed when grouped", () => {
    const group = featureTable(offered)
      .groupings?.find(({ key }) => key === "staffed")
      ?.of(feature({ statusId: "idea" }))[0];

    expect(group?.label).toBe("Not committed");
  });

  it("is read only, offering Yes and No", () => {
    expect(staffed?.readOnly).toBe(true);
    expect(staffed?.live(featureDraft() as never)).toEqual([]);
    expect(staffed?.change(["yes"])).toEqual({});
    expect(staffed?.choices.map(({ label }) => label)).toEqual(["Yes", "No"]);
  });

  it("shows a feature staffed as its allocations are live, without drafts", () => {
    const [live] = livePlanRecords([
      feature({ staffed: true, staffedLive: false }),
    ]);

    expect(staffed?.value(live as Feature)).toEqual([staffedChoices.no]);
  });

  it("follows the details' Planning group, after Feature team", () => {
    const planning = featureColumnGroups.find(
      ({ title }) => title === "Planning",
    );
    expect(planning?.keys.slice(-2)).toEqual(["featureTeamId", "staffed"]);
  });
});
