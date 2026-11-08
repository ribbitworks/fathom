// SPDX-License-Identifier: Apache-2.0

// Tests for the Projects page's tables: what their columns save from what is typed into a cell.

import type { Customer, RecordDraft } from "@fathom/shared";
import { describe, expect, it } from "vitest";
import { cellKinds, flagChoice } from "./cell-kinds.tsx";
import {
  livePlanRecords,
  milestoneColumns,
  noColumnActions,
  planDraftFields,
  projectColumns,
  proposalColumns,
} from "./project-grids.tsx";
import type { TableChoices } from "./projects.ts";
import { recordDraft } from "./test-support.tsx";

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
  ...more,
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
  it("ignores moving or editing one", () => {
    expect(() => {
      noColumnActions.moveColumn();
    }).not.toThrow();
  });
});
