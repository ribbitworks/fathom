// SPDX-License-Identifier: Apache-2.0

// Tests for the Projects page's tables: what their columns save from what is typed into a cell.

import type { RecordDraft } from "@fathom/shared";
import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { cellKinds, flagChoice } from "./cell-kinds.tsx";
import {
  milestoneColumns,
  noColumnActions,
  planDraftFields,
  projectColumns,
  proposalColumns,
} from "./project-grids.tsx";
import { planNodes } from "./projects.ts";
import { usedRecords } from "./record-drafts.ts";
import {
  choices,
  feature,
  featureDraft,
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

describe("a date typed into a cell", () => {
  it("is refused when laying it out would drop a digit", () => {
    expect(cellKinds.date.problem(milestoneColumn("date"), "2026-101-08")).toBe(
      "Type a date for Date, such as 2026-10-31",
    );
  });

  it("is saved laid out when only a dash is out of place", () => {
    expect(
      cellKinds.date.problem(milestoneColumn("date"), "202611-08"),
    ).toBeUndefined();
    expect(milestoneColumn("date").change("202611-08")).toEqual({
      date: "2026-11-08",
    });
  });
});

describe("a date in a draft's details", () => {
  it("is given in words, and as typed when it is no date", () => {
    const column = milestoneColumn("date");
    expect([
      cellKinds.date.inDetail?.(column, "2027-03-26"),
      cellKinds.date.inDetail?.(column, "soon"),
    ]).toEqual(["Mar 26, 2027", "soon"]);
  });
});

describe("a date pasted into a cell", () => {
  it("is laid out as a day", () => {
    expect(cellKinds.date.pasted(milestoneColumn("date"), "20300901")).toEqual({
      value: "2030-09-01",
    });
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
    keyNumber: 1,
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
    for (const ids of [[], ["gone"]]) {
      const { container, unmount } = render(<>{column()(proposal(ids))}</>);
      expect(container.textContent).toBe("");
      unmount();
    }
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
    keyNumber: 1,
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

  it("shows a proposal's features nowhere where the page can't show them", () => {
    expect(
      proposalColumn("featureIds").showOn?.({
        ...proposal,
        link: null,
        featureIds: ["f1"],
      }),
    ).toBeUndefined();
  });

  it("starts a proposal with no status when none is offered", () => {
    expect(proposalColumn("statusId").newRowValue?.("")).toEqual([]);
  });

  it("reads a milestone's delivery as a tick and its live project", () => {
    expect(
      milestoneColumn("customerDelivery").value({
        id: "m1",
        keyNumber: 1,
        projectId: "p1",
        name: "One",
        date: "2030-01-01",
        customerDelivery: true,
      }),
    ).toEqual([flagChoice]);
    expect(
      milestoneColumn("customerDelivery").value({
        id: "m1",
        keyNumber: 1,
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
          keyNumber: 1,
          name: "Fictional Customer",
          description: null,
          note: null,
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
          keyNumber: 1,
          name: "After",
          description: null,
          note: null,
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

  it("names a customer's changed description and notes", () => {
    expect(
      planDraftFields(
        "customer",
        {
          id: "c",
          keyNumber: 1,
          name: "Fictional",
          description: "After",
          note: "**Pilot** first",
          draft: recordDraft({
            changed: ["description", "note"],
            live: { description: "Before", note: null },
          }),
        },
        choices(),
      ),
    ).toEqual([
      {
        key: "description",
        field: { field: "Description", oldValue: "Before", newValue: "After" },
      },
      {
        key: "note",
        field: { field: "Notes", oldValue: "", newValue: "Pilot first" },
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
          keyNumber: 1,
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
          keyNumber: 1,
          name: "One",
          externalId: null,
          ownerId: "o1",
          customerIds: [],
          proposalIds: [],
          featureIds: [],
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
          keyNumber: 1,
          name: "One",
          externalId: null,
          link: "https://example.test/new",
          ownerId: null,
          customerIds: [],
          statusId: "s1",
          featureIds: [],
          removalReasons: {},
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
        {
          id: "c1",
          keyNumber: 1,
          name: "New",
          description: null,
          note: null,
          draft: draft(["name"], { name: "Old" }),
        },
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
          keyNumber: 1,
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
    const customer = {
      id: "c1",
      keyNumber: 1,
      name: "One",
      description: null,
      note: null,
    };
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
      "Type a month for Needed by, such as 2027-03",
    );
  });

  it("finds nothing wrong with a month, or with none", () => {
    expect(month.problem(column, "202703")).toBeUndefined();
    expect(month.problem(column, "")).toBeUndefined();
  });

  it("lays out digits as they are typed, ignoring anything else", () => {
    expect(month.asTyped?.({ text: "2027a03", cursor: 7 })).toEqual({
      text: "2027-03",
      cursor: 7,
    });
  });

  it("takes a pasted month", () => {
    expect(month.pasted(column, " 202703 ")).toEqual({ value: "2027-03" });
  });
});
