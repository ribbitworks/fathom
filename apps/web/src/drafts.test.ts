// SPDX-License-Identifier: Apache-2.0

// Tests for working out, as the server does, which other drafts approving or rejecting a selection
// includes, how they are named, and whether the approver's role approves drafts of their areas.

import {
  type Choice,
  draftKinds,
  type Field,
  type List,
  type Person,
} from "@fathom/shared";
import { describe, expect, it } from "vitest";
import { recordDraft } from "./test-support.tsx";
import {
  type Columns,
  decisionFor,
  differingKeys,
  draftSentAgain,
  draftNames,
  draftTotal,
  heldBack,
  joined,
  mayDecide,
  noDrafts,
  rejectedAmong,
  usedDrafts,
  usingDrafts,
  without,
} from "./drafts.ts";

const waiting = { state: "waiting" as const, madeBy: null, madeAt: null };

const added = (id: string): Choice => ({
  id,
  label: id.toUpperCase(),
  description: "",
  retired: false,
  draft: { ...waiting, action: "created", changed: [], live: {} },
});

const live = (id: string): Choice => ({
  id,
  label: id.toUpperCase(),
  description: "",
  retired: false,
});

// A list drafted to be added, whose order places one choice drafted to be added before a live one,
// and leaves another at the end, where it would go anyway.
const teams: List = {
  id: "l1",
  keyNumber: 1,
  name: "Teams",
  description: "",
  visibility: "general",
  retired: false,
  choices: [added("b"), live("a"), added("c")],
  draft: { ...waiting, action: "created", changed: [], live: {} },
  orderDraft: { ...waiting, live: ["a"], uses: ["b"] },
};

// A live list whose order puts a choice drafted to be added first.
const sites: List = {
  id: "l2",
  keyNumber: 1,
  name: "Sites",
  description: "",
  visibility: "general",
  retired: false,
  choices: [added("f"), live("d"), added("e")],
  orderDraft: { ...waiting, live: ["d"], uses: ["f"] },
};

const lists = [teams, sites];

describe("the values a draft changes", () => {
  it("are those that differ from live, a list only where its items or their order do", () => {
    expect(
      differingKeys(
        { name: "B", cycles: ["1", "2"], moved: ["1", "2"], cut: ["1"] },
        { name: "A", cycles: ["1", "2"], moved: ["2", "1"], cut: ["1", "2"] },
        ["name", "cycles", "moved", "cut"],
      ),
    ).toEqual(["name", "moved", "cut"]);
  });
});

describe("drafts an approval includes", () => {
  it("approves the choices an order places, and the lists they are added to", () => {
    expect(usedDrafts({ ...noDrafts(), orders: ["l1"] }, lists)).toEqual({
      ...noDrafts(),
      lists: ["l1"],
      choices: ["b"],
    });
    expect(usedDrafts({ ...noDrafts(), orders: ["l2"] }, lists)).toEqual({
      ...noDrafts(),
      choices: ["f"],
    });
  });

  it("adds nothing already chosen, or for an order that is gone", () => {
    expect(
      usedDrafts(
        { ...noDrafts(), lists: ["l1"], choices: ["b"], orders: ["l1", "l9"] },
        lists,
      ),
    ).toEqual(noDrafts());
  });

  it("rejects a list's choices and order with it, and an order with the choices it places", () => {
    expect(usingDrafts({ ...noDrafts(), lists: ["l1"] }, lists)).toEqual({
      ...noDrafts(),
      choices: ["b", "c"],
      orders: ["l1"],
      columns: [],
    });
    expect(
      usingDrafts({ ...noDrafts(), choices: ["f"], orders: ["l2"] }, lists),
    ).toEqual(noDrafts());
  });

  it("joins selections once each, counts them, and names them", () => {
    const both = joined(
      { ...noDrafts(), people: ["p1"], lists: ["l1"] },
      { ...noDrafts(), people: ["p1"], choices: ["b"], orders: ["l2"] },
    );
    expect(both).toEqual({
      people: ["p1"],
      plannedHires: [],
      featureTeams: [],
      lists: ["l1"],
      choices: ["b"],
      orders: ["l2"],
      columns: [],
      records: [],
    });
    expect(draftTotal(both)).toBe(4);
    expect(draftNames(both, lists)).toEqual([
      "the list Teams",
      "the choice B in Teams",
      "the new order for Sites",
    ]);
  });
});

describe("planned hires an approval includes", () => {
  const hire: Person = {
    id: "h1",
    keyNumber: 1,
    kind: "planned-hire",
    preferredName: "",
    employeeId: "TBD-7",
    values: {},
    links: {},
  };

  it("names them, and takes them out of another selection", () => {
    const chosen = { ...noDrafts(), plannedHires: ["h1", "h2"] };
    expect(draftNames(chosen, lists, [], [hire])).toEqual([
      "the planned hire TBD-7",
    ]);
    expect(
      without(chosen, { ...noDrafts(), plannedHires: ["h2"] }).plannedHires,
    ).toEqual(["h1"]);
  });
});

describe("feature teams an approval includes", () => {
  it("joins them once each, counts them, and takes them out of another selection", () => {
    const chosen = joined(
      { ...noDrafts(), featureTeams: ["t1", "t2"] },
      { ...noDrafts(), featureTeams: ["t2"] },
    );
    expect([
      chosen.featureTeams,
      draftTotal(chosen),
      without(chosen, { ...noDrafts(), featureTeams: ["t2"] }).featureTeams,
    ]).toEqual([["t1", "t2"], 2, ["t1"]]);
  });
});

describe("drafts of columns an approval or rejection includes", () => {
  const columns = {
    fields: [
      {
        id: "f1",
        keyNumber: 1,
        name: "Previous site",
        type: "choice" as const,
        listId: "l1",
        visibility: null,
        multiple: false,
        required: false,
        onPlannedHires: true,
      },
    ],
  };
  it("names the drafts a decision covers whose areas the approver's role does not approve", () => {
    const column = { ...noDrafts(), columns: ["f1"] };
    expect(mayDecide(["field"], column)).toBe(true);
    expect(mayDecide(["list"], column)).toBe(false);
    expect(
      decisionFor("approve", column, ["list"], [], columns).beyondRole,
    ).toEqual(["the column Previous site"]);
    expect(
      decisionFor("approve", column, draftKinds, [], columns).beyondRole,
    ).toBeUndefined();
  });
});

describe("drafts that wait on rejected ones", () => {
  const rejected = {
    ...waiting,
    state: "rejected" as const,
    reason: "Not yet",
  };
  // Teams' addition and Sites' choice F are rejected; Teams' order places its waiting choice B,
  // so uses the rejected list only through B.
  const withRejected = [
    {
      ...teams,
      draft: { ...rejected, action: "created" as const, changed: [], live: {} },
    },
    {
      ...sites,
      choices: sites.choices.map((choice) =>
        choice.id === "f"
          ? {
              ...choice,
              draft: {
                ...rejected,
                action: "created" as const,
                changed: [],
                live: {},
              },
            }
          : choice,
      ),
    },
  ];
  const columns = {
    fields: [
      {
        id: "f1",
        keyNumber: 1,
        name: "Previous site",
        type: "choice" as const,
        listId: "l2",
        visibility: null,
        multiple: false,
        required: false,
        onPlannedHires: true,
        draft: {
          ...rejected,
          action: "created" as const,
          changed: [],
          live: {},
        },
      },
    ],
  };
  const everything = {
    people: ["p1"],
    plannedHires: [],
    featureTeams: [],
    lists: ["l1"],
    choices: ["b", "e", "f"],
    orders: ["l1", "l2"],
    columns: ["f1"],
    records: [],
  };

  it("finds the rejected drafts among those chosen", () => {
    expect(rejectedAmong(everything, withRejected, columns)).toEqual({
      ...noDrafts(),
      lists: ["l1"],
      choices: ["f"],
      columns: ["f1"],
    });
    expect(rejectedAmong(everything, withRejected)).toEqual({
      ...noDrafts(),
      lists: ["l1"],
      choices: ["f"],
    });
  });

  it("holds back what uses a rejected draft, even through a waiting one, and only that", () => {
    const held = heldBack(everything, withRejected, columns);
    expect(held).toEqual({
      ...noDrafts(),
      choices: ["b"],
      orders: ["l1", "l2"],
    });
    expect(heldBack(everything, lists)).toEqual(noDrafts());
    expect(without(everything, held)).toEqual({
      people: ["p1"],
      plannedHires: [],
      featureTeams: [],
      lists: ["l1"],
      choices: ["e", "f"],
      orders: [],
      columns: ["f1"],
      records: [],
    });
  });
});

describe("drafts of people and columns that use drafts of another kind", () => {
  // A column drafted to be added, drawing on the list Teams, itself drafted to be added.
  const squad: Field = {
    id: "f2",
    keyNumber: 1,
    name: "Squad",
    type: "choice" as const,
    listId: "l1",
    visibility: null,
    multiple: false,
    required: false,
    onPlannedHires: true,
    draft: { ...waiting, action: "created", changed: [], live: {} },
  };
  // A live column on the live list Sites.
  const site: Field = {
    id: "f3",
    keyNumber: 1,
    name: "Site",
    type: "choice" as const,
    listId: "l2",
    visibility: null,
    multiple: false,
    required: false,
    onPlannedHires: true,
  };
  const person = (
    id: string,
    values: Record<string, string[]>,
    draft: Partial<NonNullable<Person["draft"]>> = {},
  ): Person => ({
    id,
    keyNumber: 1,
    preferredName: id.toUpperCase(),
    employeeId: id,
    positionId: "position-1",
    values,
    links: {},
    draft: {
      ...waiting,
      action: "changed",
      changed: Object.keys(values),
      live: { values: {}, links: {} },
      ...draft,
    },
  });
  // Given a new squad, B, and a new site, E; given a live site, D; given nothing new.
  const ada = person("ada", { f2: ["b"], f3: ["e"] });
  const bo = person("bo", { f3: ["d"] });
  const cy = person("cy", { f2: ["b"] }, { unpublished: true });
  const columns = { fields: [squad, site], people: [ada, bo, cy] };

  it("approves the new columns and choices a person is given, and the new lists they belong to", () => {
    expect(
      usedDrafts({ ...noDrafts(), people: ["ada"] }, lists, columns),
    ).toEqual({
      ...noDrafts(),
      lists: ["l1"],
      choices: ["b", "e"],
      columns: ["f2"],
    });
    expect(
      usedDrafts({ ...noDrafts(), people: ["bo"] }, lists, columns),
    ).toEqual(noDrafts());
  });

  it("approves a new list with a column drawing on it", () => {
    expect(
      usedDrafts({ ...noDrafts(), columns: ["f2"] }, lists, columns),
    ).toEqual({ ...noDrafts(), lists: ["l1"] });
  });

  it("rejects the columns drawing on a new list, and the people given what is rejected, with it", () => {
    expect(
      usingDrafts({ ...noDrafts(), lists: ["l1"] }, lists, columns),
    ).toEqual({
      ...noDrafts(),
      people: ["ada"],
      choices: ["b", "c"],
      orders: ["l1"],
      columns: ["f2"],
    });
    expect(
      usingDrafts({ ...noDrafts(), choices: ["e"] }, lists, columns),
    ).toEqual({ ...noDrafts(), people: ["ada"], orders: [] });
    expect(
      usingDrafts({ ...noDrafts(), choices: ["d"] }, lists, columns).people,
    ).toEqual([]);
  });

  it("finds nothing used by a person with no draft", () => {
    const plain: Person = { ...bo, draft: undefined };
    expect(
      usedDrafts({ ...noDrafts(), people: ["bo"] }, lists, {
        ...columns,
        people: [plain],
      }),
    ).toEqual(noDrafts());
  });

  it("holds back a person and a column that use a rejected draft", () => {
    const rejectedTeams: List = {
      ...teams,
      draft: {
        ...waiting,
        state: "rejected",
        action: "created",
        changed: [],
        live: {},
      },
    };
    expect(
      heldBack(
        { ...noDrafts(), people: ["ada", "bo"], columns: ["f2"] },
        [rejectedTeams, sites],
        columns,
      ),
    ).toEqual({ ...noDrafts(), people: ["ada"], columns: ["f2"] });
  });

  it("names people first", () => {
    expect(
      draftNames(
        { ...noDrafts(), people: ["ada"], columns: ["f2"], lists: ["l1"] },
        lists,
        columns.fields,
        columns.people,
      ),
    ).toEqual(["ADA", "the column Squad", "the list Teams"]);
  });
});

describe("drafts the approver changed", () => {
  const person = (id: string, needsOtherApprover?: true): Person => ({
    id,
    keyNumber: 1,
    kind: "person",
    preferredName: `Fictional ${id}`,
    employeeId: `E-${id}`,
    values: {},
    links: {},
    draft: {
      ...waiting,
      action: "changed",
      changed: ["preferredName"],
      live: { values: {}, links: {} },
      ...(needsOtherApprover ? { needsOtherApprover } : {}),
    },
  });

  it("are named, and no approval is offered, when the approver may not approve their own", () => {
    const people = [person("p1", true), person("p2")];
    const chosen = { ...noDrafts(), people: ["p1", "p2"] };
    expect(
      decisionFor("approve", chosen, draftKinds, lists, {
        fields: [],
        people,
      }),
    ).toMatchObject({ othersApprove: ["Fictional p1"] });
    expect(
      decisionFor("reject", chosen, draftKinds, lists, {
        fields: [],
        people,
      }).othersApprove,
    ).toBeUndefined();
    expect(
      decisionFor(
        "approve",
        { ...noDrafts(), people: ["p2"] },
        draftKinds,
        lists,
        { fields: [], people },
      ).othersApprove,
    ).toBeUndefined();
  });

  it("are found among every kind of draft an approval takes", () => {
    const marked = { ...waiting, needsOtherApprover: true as const };
    const ownList: List = {
      id: "l9",
      keyNumber: 1,
      name: "Own",
      description: "",
      visibility: "general",
      retired: false,
      choices: [
        {
          ...live("z"),
          draft: { ...marked, action: "changed", changed: ["label"], live: {} },
        },
      ],
      draft: { ...marked, action: "changed", changed: ["name"], live: {} },
      orderDraft: { ...marked, live: ["z"], uses: [] },
    };
    const field = {
      id: "f9",
      keyNumber: 1,
      name: "Own column",
      listId: "l9",
      multiple: false,
      required: false,
      draft: { ...marked, action: "changed", changed: ["name"], live: {} },
    } as unknown as Field;
    const hire = {
      ...person("h9", true),
      kind: "planned-hire",
    } as unknown as Person;
    const ref = {
      type: "release" as const,
      id: "00000000-0000-4000-8000-000000000009",
    };
    const columns: Columns = {
      fields: [field],
      people: [hire],
      records: [
        {
          ref,
          subject: "the release Own",
          draft: {
            ...marked,
            action: "changed",
            changed: ["name"],
            live: {},
            uses: [],
          },
          heldBy: undefined,
        },
      ],
    };
    const chosen = {
      ...noDrafts(),
      plannedHires: ["h9"],
      lists: ["l9"],
      choices: ["z"],
      orders: ["l9"],
      columns: ["f9"],
      records: [ref],
    };
    expect(
      decisionFor("approve", chosen, draftKinds, [ownList], columns)
        .othersApprove,
    ).toEqual([
      "the planned hire Fictional h9",
      "the column Own column",
      "the list Own",
      "the choice Z in Own",
      "the new order for Own",
      "the release Own",
    ]);
  });
});

describe("a draft sent for approval again", () => {
  it("is waiting again, without its reason, and a record with no draft stays as it is", () => {
    const rejected = recordDraft({ state: "rejected", reason: "No" });
    expect(draftSentAgain({ draft: rejected }).draft).toEqual(
      recordDraft({ state: "waiting" }),
    );
    expect(draftSentAgain({})).toEqual({});
  });
});

describe("the drafts of a fill", () => {
  const draft = {
    action: "changed" as const,
    changed: ["managerId"],
    live: { managerId: "filled", values: {}, links: {} },
    state: "waiting" as const,
    madeBy: null,
    madeAt: null,
  };
  const row = (id: string, details: object) =>
    ({
      id,
      keyNumber: 1,
      preferredName: id,
      employeeId: id,
      values: {},
      links: {},
      ...details,
    }) as Person;
  const hire = (id: string, details: object) =>
    row(id, { kind: "planned-hire", ...details });
  const people = [
    hire("filled", { filler: "starter", draft }),
    row("starter", { draft: { ...draft, action: "created" } }),
    hire("moved", {
      manager: { id: "starter", preferredName: "starter" },
      draft,
    }),
    row("kept", {
      manager: { id: "starter", preferredName: "starter" },
      draft,
    }),
    hire("other", { filler: "someone", draft }),
    row("someone", {}),
  ];
  const columns = { fields: [], people };

  it("approves the rest of a fill with the hire chosen", () => {
    expect(
      decisionFor(
        "approve",
        { ...noDrafts(), plannedHires: ["filled"] },
        draftKinds,
        [],
        columns,
      ).selection,
    ).toMatchObject({ people: ["starter"], plannedHires: ["filled", "moved"] });
  });

  it("rejects the rest of a fill with the person chosen, naming them", () => {
    const decision = decisionFor(
      "reject",
      { ...noDrafts(), people: ["starter"] },
      draftKinds,
      [],
      columns,
    );
    expect(decision.selection).toMatchObject({
      people: ["starter"],
      plannedHires: ["filled", "moved"],
    });
    expect(decision.included?.length).toBeGreaterThan(0);
  });

  it("leaves out a hire drafted to report to the filler that the fill does not move", () => {
    const withOther = [
      ...people,
      hire("elsewhere", {
        manager: { id: "starter", preferredName: "starter" },
        draft: { ...draft, live: { ...draft.live, managerId: "another" } },
      }),
    ];

    expect(
      decisionFor(
        "approve",
        { ...noDrafts(), plannedHires: ["filled"] },
        draftKinds,
        [],
        { fields: [], people: withOther },
      ).selection.plannedHires,
    ).not.toContain("elsewhere");
  });

  it("leaves out a filler whose only draft is of their own", () => {
    const own = [
      hire("filled", { filler: "starter", draft }),
      row("starter", { draft: { ...draft, changed: ["preferredName"] } }),
    ];

    expect(
      decisionFor(
        "approve",
        { ...noDrafts(), plannedHires: ["filled"] },
        draftKinds,
        [],
        { fields: [], people: own },
      ).selection.people,
    ).toEqual([]);
  });

  it("adds no one who has no draft of their own, and leaves other fills out", () => {
    expect(
      decisionFor(
        "approve",
        { ...noDrafts(), plannedHires: ["other"] },
        draftKinds,
        [],
        columns,
      ).selection,
    ).toMatchObject({ people: [], plannedHires: ["other"] });
  });
});
