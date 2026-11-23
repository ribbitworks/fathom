// SPDX-License-Identifier: Apache-2.0

// Tests for deciding drafts: the fills a decision takes along, and the drafts approving leaves for
// another approver.

import {
  type FeatureTeam,
  type Field,
  type List,
  type Person,
  draftKinds,
} from "@fathom/shared";
import { describe, expect, it } from "vitest";
import { decisionFor } from "./draft-decisions.ts";
import { type Columns, noDrafts } from "./drafts.ts";
import {
  addedChoice as added,
  bothLists as lists,
  draftToDecide as waiting,
  liveChoice as live,
  sitesList as sites,
  teamsList as teams,
} from "./test-support.tsx";

describe("drafts of lists alone", () => {
  it("are decided with no columns or people given, as on the Lists page before people load", () => {
    const decision = decisionFor(
      "approve",
      { ...noDrafts(), lists: [teams.id] },
      draftKinds,
      lists,
    );
    expect(decision.named).toEqual(["the list Teams"]);
    expect(decision.othersApprove).toBeUndefined();
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

  it("leaves a whole fill waiting, approving all, when one of it needs another approver", () => {
    // Given a fill whose new person this user changed
    const own = people.map((one) =>
      one.id === "starter"
        ? {
            ...one,
            draft: {
              ...draft,
              action: "created" as const,
              needsOtherApprover: true,
            },
          }
        : one,
    );

    // When all are approved, with another draft
    const decision = decisionFor(
      "approve",
      { ...noDrafts(), plannedHires: ["filled", "other"] },
      draftKinds,
      [],
      { fields: [], people: own },
      true,
    );

    // Then the fill's hire is left, and nothing of the fill is approved
    expect(decision.selection).toMatchObject({
      people: [],
      plannedHires: ["other"],
    });
    expect(decision.othersLeft).toEqual(["the planned hire filled"]);
  });

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

describe("approving all the drafts waiting", () => {
  const marked = { ...waiting, needsOtherApprover: true as const };
  const person = (id: string, flag = false): Person => ({
    id,
    keyNumber: 1,
    kind: "person",
    preferredName: `Fictional ${id}`,
    employeeId: `E-${id}`,
    values: {},
    links: {},
    draft: {
      ...(flag ? marked : waiting),
      action: "changed",
      changed: ["preferredName"],
      live: { values: {}, links: {} },
    },
  });
  const team = (id: string, flag = false): FeatureTeam => ({
    id,
    keyNumber: 1,
    name: `Team ${id}`,
    leadId: null,
    colour: null,
    members: [],
    names: {},
    draft: {
      ...(flag ? marked : waiting),
      action: "changed",
      changed: ["name"],
      live: {},
    },
    heldBy: undefined,
  });
  const people = [person("p1", true), person("p2"), person("p3")];
  const columns: Columns = { fields: [], people };

  it("skips the drafts another approver must approve, naming them, and approves the rest", () => {
    // Given three people's drafts, one changed by this user
    const chosen = { ...noDrafts(), people: ["p1", "p2", "p3"] };

    // When all are approved
    const decision = decisionFor(
      "approve",
      chosen,
      draftKinds,
      lists,
      columns,
      true,
    );

    // Then the other two are approved, and the one skipped is named
    expect(decision).toMatchObject({
      selection: { people: ["p2", "p3"] },
      named: ["Fictional p2", "Fictional p3"],
      othersLeft: ["Fictional p1"],
    });
    expect(decision.othersApprove).toBeUndefined();
  });

  it("skips the drafts whose kind the role does not approve", () => {
    const decision = decisionFor(
      "approve",
      { ...noDrafts(), people: ["p2"], lists: ["l1"] },
      draftKinds.filter((kind) => kind !== "list"),
      [{ ...teams, orderDraft: undefined }],
      columns,
      true,
    );
    expect(decision).toMatchObject({
      selection: { people: ["p2"], lists: [] },
      othersLeft: ["the list Teams"],
    });
    expect(decision.beyondRole).toBeUndefined();
  });

  it("skips a draft that uses one another approver must approve", () => {
    // Given a new order that places a choice this user added
    const ownSites: List = {
      ...sites,
      choices: [
        {
          ...added("f"),
          draft: { ...marked, action: "created", changed: [], live: {} },
        },
        live("d"),
      ],
    };
    const decision = decisionFor(
      "approve",
      { ...noDrafts(), people: ["p2"], orders: ["l2"] },
      draftKinds,
      [ownSites],
      columns,
      true,
    );
    expect(decision).toMatchObject({
      selection: { people: ["p2"], orders: [], choices: [] },
      othersLeft: ["the new order for Sites"],
    });
  });

  it("names those another approver must approve, approving none, when every one is", () => {
    const decision = decisionFor(
      "approve",
      { ...noDrafts(), people: ["p1"] },
      draftKinds,
      lists,
      columns,
      true,
    );
    expect(decision).toMatchObject({ othersApprove: ["Fictional p1"] });
    expect(decision.othersLeft).toBeUndefined();
  });

  it("names and checks feature teams' drafts too", () => {
    const decision = decisionFor(
      "approve",
      { ...noDrafts(), featureTeams: ["t1", "t2"] },
      draftKinds,
      lists,
      { fields: [], featureTeams: [team("t1", true), team("t2")] },
      true,
    );
    expect(decision).toMatchObject({
      named: ["the feature team Team t2"],
      othersLeft: ["the feature team Team t1"],
    });
  });

  it("names the drafts a rejection rejects", () => {
    expect(
      decisionFor(
        "reject",
        { ...noDrafts(), people: ["p1", "p2"] },
        draftKinds,
        lists,
        columns,
      ).named,
    ).toEqual(["Fictional p1", "Fictional p2"]);
  });

  it("leaves a draft waiting that uses, through another, one another approver must approve", () => {
    // Given three releases' drafts, each using the next, the last changed by this user
    const ref = (n: number) => ({
      type: "release" as const,
      id: `00000000-0000-4000-8000-00000000000${String(n)}`,
    });
    const node = (n: number, uses: number[], flag = false) => ({
      ref: ref(n),
      subject: `the release R${String(n)}`,
      draft: {
        ...(flag ? marked : waiting),
        action: "changed" as const,
        changed: ["name"],
        live: {},
        uses: uses.map(ref),
      },
      heldBy: undefined,
    });
    const decision = decisionFor(
      "approve",
      { ...noDrafts(), people: ["p2"], records: [ref(1)] },
      draftKinds,
      lists,
      {
        fields: [],
        people,
        records: [node(1, [2]), node(2, [3]), node(3, [], true)],
      },
      true,
    );
    expect(decision).toMatchObject({
      selection: { people: ["p2"], records: [] },
      othersLeft: ["the release R1"],
    });
  });

  it("leaves approving drafts one by one as it was", () => {
    expect(
      decisionFor(
        "approve",
        { ...noDrafts(), people: ["p1", "p2"] },
        draftKinds,
        lists,
        columns,
      ),
    ).toMatchObject({ othersApprove: ["Fictional p1"] });
  });
});
