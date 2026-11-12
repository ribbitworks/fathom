// SPDX-License-Identifier: Apache-2.0

// Tests for the Projects page's tables: what their columns save from what is typed into a cell.

import type { Customer, Feature, RecordDraft } from "@fathom/shared";
import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { cellKinds, flagChoice } from "./cell-kinds.tsx";
import {
  featureColumnGroups,
  featureColumns,
  featureTable,
  livePlanRecords,
  milestoneColumns,
  noColumnActions,
  planDraftFields,
  projectColumns,
  proposalColumns,
} from "./project-grids.tsx";
import type { TableChoices } from "./projects.ts";
import { cycleChoices, planNodes, releaseOfCycle } from "./projects.ts";
import { usedRecords } from "./record-drafts.ts";
import {
  featureDraft,
  fictionalRelease,
  fictionalStream,
  noFeatureColumns,
  recordDraft,
} from "./test-support.tsx";

function milestoneColumn(key: string) {
  const column = milestoneColumns([]).find((each) => each.key === key);
  if (column === undefined) throw new Error(`No ${key} column`);
  return column;
}

describe("the milestone table's columns", () => {
  it("saves a date typed as digits alone in the form the server takes", () => {
    expect(milestoneColumn("date").change("20300901")).toEqual({
      date: "2030-09-01",
    });
  });

  it("saves a name without the spaces around it", () => {
    expect(milestoneColumn("name").change("  Handover ")).toEqual({
      name: "Handover",
    });
  });
});

const choices = (more: Partial<TableChoices> = {}): TableChoices => ({
  people: [],
  customers: [],
  proposals: [],
  projects: [],
  features: [],
  statuses: [],
  featureStatuses: [
    { ...cycleChoice("possible-first", "Long shot"), meaning: "possible" },
    { ...cycleChoice("planned", "Planned"), meaning: "planned" },
  ],
  featureTeams: [],
  cycles: [],
  releaseOfCycle: new Map(),
  featureColumns: noFeatureColumns,
  ...more,
});

const feature = (more: Partial<Feature> = {}): Feature => ({
  id: "f1",
  name: "Fictional Feature",
  statusId: "planned",
  neededBy: null,
  customerIds: [],
  targetStreamId: null,
  targetCycle: null,
  estimateHours: null,
  featureTeamId: "t1",
  description: null,
  note: null,
  values: {},
  links: {},
  ...more,
});

const cycleChoice = (id: string, label: string) => ({
  id,
  label,
  description: "",
  retired: false,
});

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
      ?.of(feature(more));
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
        cycles: [
          {
            startsOn: "2027-06-01",
            endsOn: "2027-08-31",
            name: "New",
            months: [],
          },
        ],
        liveCycles: [
          {
            startsOn: "2027-07-01",
            endsOn: "2027-09-30",
            name: "Old",
            months: [],
          },
          {
            startsOn: "2027-06-01",
            endsOn: "2027-08-31",
            name: "New",
            months: [],
          },
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
      words: "No team",
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
      "neededBy",
      "estimateHours",
      "release",
      "targetCycle",
      "featureTeamId",
    ]);
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

describe("a date pasted into a cell", () => {
  it("is laid out as a day", () => {
    expect(cellKinds.date.pasted(milestoneColumn("date"), "20300901")).toEqual({
      value: "2030-09-01",
    });
  });
});

describe("the plan's records as they are live", () => {
  const record = (more: object) =>
    ({ id: "c1", name: "Now", ...more }) as Customer;

  it("leaves out those only drafted to be added, and undoes a draft's other changes", () => {
    expect(
      livePlanRecords([
        record({}),
        record({ id: "c2", draft: recordDraft({ action: "created" }) }),
        record({ id: "c3", draft: recordDraft({ action: "deleted" }) }),
        record({
          id: "c4",
          draft: recordDraft({ changed: ["name"], live: { name: "Before" } }),
        }),
      ]).map(({ id, name, draft }) => ({ id, name, draft })),
    ).toEqual([
      { id: "c1", name: "Now", draft: undefined },
      { id: "c3", name: "Now", draft: undefined },
      { id: "c4", name: "Before", draft: undefined },
    ]);
  });
});

describe("a column of features picked", () => {
  const named = (id: string, name: string) => ({ ...feature({ id }), name });
  const column = () => {
    const found = proposalColumns(
      choices({
        features: [named("f1", "Fictional One"), named("f2", "Fictional Two")],
      }),
    ).find(({ key }) => key === "featureIds");
    if (found?.content === undefined) throw new Error("No Features column");
    return found.content;
  };
  const proposal = (featureIds: string[]) => ({
    id: "p1",
    name: "Proposal",
    externalId: null,
    link: null,
    ownerId: null,
    customerIds: [],
    statusId: "s1",
    featureIds,
    removalReasons: {},
  });

  it("names every feature in one line, with each on a line of its tip", () => {
    const { container } = render(<>{column()(proposal(["f1", "f2"]))}</>);
    const cell = container.querySelector("[data-tip]");
    expect(cell?.textContent).toBe("Fictional One, Fictional Two");
    expect(cell?.getAttribute("data-tip")).toBe("Fictional One\nFictional Two");
  });

  it("shows nothing for no features, or only those it cannot name", () => {
    expect(column()(proposal([]))).toBeNull();
    expect(column()(proposal(["gone"]))).toBeNull();
  });
});

describe("the columns' values", () => {
  const proposalColumn = (key: string, given = choices()) => {
    const column = proposalColumns(given).find((each) => each.key === key);
    if (column === undefined) throw new Error(`No ${key} column`);
    return column;
  };
  const proposal = {
    id: "p1",
    name: "Proposal",
    externalId: null,
    ownerId: null,
    customerIds: [],
    statusId: "s1",
    featureIds: [],
    removalReasons: {},
  };

  it("reads and saves a web link by its address, and none as nothing", () => {
    const link = proposalColumn("link");
    expect(link.value({ ...proposal, link: "https://example.test" })).toEqual({
      address: "https://example.test",
      text: "",
    });
    expect(link.value({ ...proposal, link: null })).toBeNull();
    expect(link.change({ address: "https://example.test", text: "" })).toEqual({
      link: "https://example.test",
    });
    expect(link.change(null)).toEqual({ link: null });
  });

  it("starts a proposal with no status when none is offered", () => {
    expect(proposalColumn("statusId").newRowValue?.("")).toEqual([]);
  });

  it("reads a milestone's delivery as a tick and its live project", () => {
    expect(
      milestoneColumn("customerDelivery").value({
        id: "m1",
        projectId: "p1",
        name: "One",
        date: "2030-01-01",
        customerDelivery: true,
      }),
    ).toEqual([flagChoice]);
    expect(
      milestoneColumn("customerDelivery").value({
        id: "m1",
        projectId: "p1",
        name: "One",
        date: "2030-01-01",
        customerDelivery: false,
      }),
    ).toEqual([]);
    expect(
      milestoneColumn("projectId").live(
        recordDraft({ live: { projectId: "p1" } }),
      ),
    ).toEqual(["p1"]);
  });

  it("works out a project's dates, with nothing to save or compare", () => {
    const first = projectColumns(choices()).find(({ key }) => key === "first");
    expect(first?.live(recordDraft())).toBe("");
    expect(first?.change("2030-01-01")).toEqual({});
  });
});

describe("the records a draft uses", () => {
  it("finds a drafted customer a feature's draft uses", () => {
    const drafted = { type: "customer", id: "c" } as const;
    const nodes = planNodes({
      customers: [
        {
          id: "c",
          name: "Fictional Customer",
          draft: recordDraft({ action: "created" }),
        },
      ],
      projects: [],
      proposals: [],
      features: [
        feature({ id: "f", draft: featureDraft({ uses: [drafted] }) }),
      ],
    });
    expect(usedRecords([{ type: "feature", id: "f" }], nodes)).toEqual([
      drafted,
    ]);
  });
});

describe("what a draft changes, in words", () => {
  it("names a customer's changed name", () => {
    expect(
      planDraftFields(
        "customer",
        {
          id: "c",
          name: "After",
          draft: recordDraft({ changed: ["name"], live: { name: "Before" } }),
        },
        choices(),
      ),
    ).toEqual([
      {
        key: "name",
        field: { field: "Name", oldValue: "Before", newValue: "After" },
      },
    ]);
  });

  const given = choices({
    people: [{ id: "o1", label: "Owner One", description: "", retired: false }],
    statuses: [{ id: "s1", label: "Open", description: "", retired: false }],
  });
  const draft = (changed: string[], live: RecordDraft["live"]) =>
    recordDraft({ changed, live });

  it("names a checkbox's change as Yes and No", () => {
    expect(
      planDraftFields(
        "milestone",
        {
          id: "m1",
          projectId: "p1",
          name: "One",
          date: "2030-01-01",
          customerDelivery: true,
          draft: draft(["customerDelivery"], { customerDelivery: false }),
        },
        given,
      ),
    ).toEqual([
      {
        key: "customerDelivery",
        field: { field: "Customer delivery", oldValue: "No", newValue: "Yes" },
      },
    ]);
  });

  it("names choices, leaving out one it cannot name", () => {
    expect(
      planDraftFields(
        "project",
        {
          id: "p1",
          name: "One",
          externalId: null,
          ownerId: "o1",
          customerIds: [],
          proposalIds: [],
          milestones: [],
          dates: { first: null, last: null, nextDelivery: null },
          draft: draft(["ownerId"], { ownerId: "gone" }),
        },
        given,
      ),
    ).toEqual([
      {
        key: "ownerId",
        field: { field: "Owner", oldValue: [], newValue: ["Owner One"] },
      },
    ]);
  });

  it("names a web link by its address", () => {
    expect(
      planDraftFields(
        "proposal",
        {
          id: "p1",
          name: "One",
          externalId: null,
          link: "https://example.test/new",
          ownerId: null,
          customerIds: [],
          statusId: "s1",
          draft: draft(["link"], { link: "https://example.test/old" }),
        },
        given,
      ),
    ).toEqual([
      {
        key: "link",
        field: {
          field: "Link",
          oldValue: "https://example.test/old",
          newValue: "https://example.test/new",
        },
      },
    ]);
  });

  it("names a customer's and a milestone's changes, and takes the live value as none when missing", () => {
    expect(
      planDraftFields(
        "customer",
        { id: "c1", name: "New", draft: draft(["name"], { name: "Old" }) },
        given,
      ),
    ).toEqual([
      {
        key: "name",
        field: { field: "Name", oldValue: "Old", newValue: "New" },
      },
    ]);
    expect(
      planDraftFields(
        "milestone",
        {
          id: "m1",
          projectId: "p1",
          name: "One",
          date: "2030-01-01",
          customerDelivery: false,
          draft: draft(["date"], { date: "2029-01-01" }),
        },
        given,
      ).map(({ key }) => key),
    ).toEqual(["date"]);
  });

  it("says nothing for a record without a draft, or one added", () => {
    const customer = { id: "c1", name: "One" };
    expect(planDraftFields("customer", customer, given)).toEqual([]);
    expect(
      planDraftFields(
        "customer",
        { ...customer, draft: recordDraft({ action: "created" }) },
        given,
      ),
    ).toEqual([]);
  });
});

describe("the plan's tables' columns", () => {
  it("ignores editing one", () => {
    expect(() => {
      noColumnActions.editColumn();
    }).not.toThrow();
  });
});

describe("a month cell", () => {
  const { month } = cellKinds;
  const column = { label: "Needed by" } as never;

  it("shows a month by its name, and anything else as it is", () => {
    expect(month.inWords(column, "2027-03")).toBe("Mar 2027");
    expect(month.inWords(column, "soon")).toBe("soon");
  });

  it("says what to type for what is not a month", () => {
    expect(month.problem(column, "2027-13")).toBe(
      "Needed by: use a month such as 2027-03",
    );
  });

  it("finds nothing wrong with a month, or with none", () => {
    expect(month.problem(column, "202703")).toBeUndefined();
    expect(month.problem(column, "")).toBeUndefined();
  });

  it("lays out digits as they are typed, ignoring anything else", () => {
    expect(month.asTyped?.("2027a03")).toBe("2027-03");
  });

  it("takes a pasted month", () => {
    expect(month.pasted(column, " 202703 ")).toEqual({ value: "2027-03" });
  });
});

describe("columns added to Features", () => {
  const sizes = {
    id: "sizes",
    name: "Fictional Sizes",
    description: "",
    visibility: "general" as const,
    retired: false,
    choices: [cycleChoice("small", "Small"), cycleChoice("large", "Large")],
  };
  const size = {
    id: "size",
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

  it("come in the order given, after the built-in columns it does not name", () => {
    expect(
      featureColumns(added)
        .map(({ key }) => key)
        .slice(0, 3),
    ).toEqual(["name", "size", "score"]);
  });

  it("offer their list's choices and say whether they are required", () => {
    expect(column("size")).toMatchObject({
      label: "Fictional Size",
      required: true,
      choices: sizes.choices,
    });
  });

  it("hold no value while only drafted to be added", () => {
    const [column] = featureColumns(
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
    );
    expect(column?.readOnly).toBe(true);
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
      ?.of(feature(more));
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
