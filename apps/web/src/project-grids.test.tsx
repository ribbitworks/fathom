// SPDX-License-Identifier: Apache-2.0

// Tests for the Projects page's tables: what their columns save from what is typed into a cell.

import type { Customer, Feature, RecordDraft } from "@fathom/shared";
import { describe, expect, it } from "vitest";
import { cellKinds, flagChoice } from "./cell-kinds.tsx";
import {
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
import { cycleChoices } from "./projects.ts";
import { fictionalStream, recordDraft } from "./test-support.tsx";

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
  statuses: [],
  featureStatuses: [
    { ...cycleChoice("possible-first", "Long shot"), meaning: "possible" },
    { ...cycleChoice("planned", "Planned"), meaning: "planned" },
  ],
  featureTeams: [],
  cycles: [],
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
  const groupOf = (more: Partial<Feature>) =>
    featureTable(choices({ cycles })).groupings?.at(0)?.of(feature(more));
  const monthGroupOf = (more: Partial<Feature>) =>
    featureTable(choices({ cycles })).groupings?.at(1)?.of(feature(more));

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
        recordDraft({
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
    ).toEqual({ name: "Fictional", status: "planned" });
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
    expect(team?.mark?.(feature({ featureTeamId: null }))).toBeTruthy();
  });

  it("does not mark a possible feature with no feature team", () => {
    expect(
      team?.mark?.(
        feature({ statusId: "possible-first", featureTeamId: null }),
      ),
    ).toBe(false);
  });

  it("puts the columns entered first ahead of those of planning", () => {
    expect(columns.map(({ key }) => key)).toEqual([
      "name",
      "statusId",
      "neededBy",
      "customerIds",
      "description",
      "note",
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
    expect(groupOf({})).toEqual({ key: "later", label: "Later", rank: 2 });
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
        draft: recordDraft({
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

describe("what a draft changes, in words", () => {
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
