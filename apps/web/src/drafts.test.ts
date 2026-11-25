// SPDX-License-Identifier: Apache-2.0

// Tests for working out, as the server does, which other drafts approving or rejecting a selection
// includes, how they are named, and whether the approver's role approves drafts of their areas, and
// for grouping the user's own changes the server links.

import { type Field, type List, type Person, draftKinds } from "@fathom/shared";
import { describe, expect, it } from "vitest";
import { decisionFor, needsOtherApproval } from "./draft-decisions.ts";
import {
  creditedBy,
  decidable,
  differingKeys,
  draftNames,
  draftSentAgain,
  draftTotal,
  heldBack,
  joined,
  linkedGroups,
  mayDecide,
  noDrafts,
  rejectedAmong,
  usedDrafts,
  unseenDetails,
  unseenPeople,
  usingDrafts,
  without,
} from "./drafts.ts";
import { type RecordNode, recordNode } from "./record-drafts.ts";
import {
  bothLists as lists,
  draftToDecide as waiting,
  recordDraft,
  sitesList as sites,
  teamsList as teams,
} from "./test-support.tsx";

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

describe("who changed each value several drafts change", () => {
  it("is whoever last changed a draft changing it, and nobody where no draft does", () => {
    // Given a value two drafts change, and one none does
    const earlier = {
      madeBy: "Earlier Editor",
      madeAt: "2027-01-01T09:00:00Z",
    };
    const later = { madeBy: "Later Editor", madeAt: "2027-01-02T09:00:00Z" };

    // Then the first is credited to the later draft's maker, and the second to nobody
    expect(
      creditedBy([
        { key: "name", drafts: [later, earlier] },
        { key: "colour", drafts: [] },
      ]),
    ).toEqual({ name: "Later Editor" });
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

describe("drafts of features that use drafts of columns", () => {
  // A number column drafted to be added to Features.
  const score: Field = {
    id: "f4",
    keyNumber: 1,
    name: "Fictional Score",
    type: "number" as const,
    listId: null,
    visibility: "general",
    multiple: false,
    required: false,
    onPlannedHires: false,
    draft: { ...waiting, action: "created", changed: [], live: {} },
  };
  const feature = (
    id: string,
    values: Record<string, string[]>,
    draft: Partial<NonNullable<RecordNode["draft"]>> = {},
  ) =>
    recordNode(
      "feature",
      {
        id,
        values,
        draft: {
          ...waiting,
          action: "changed",
          changed: Object.keys(values),
          live: {},
          uses: [],
          ...draft,
        },
      },
      `the feature ${id}`,
    );
  // Given features scored in the new column, one published and one not, and one given a new choice;
  // a number is no choice, so the draft names the column only among what it changes
  const scored = feature("scored", {}, { changed: ["f4"] });
  const mine = feature("mine", {}, { changed: ["f4"], unpublished: true });
  const chosen = feature("chosen", { f3: ["e"] });
  const columns = { fields: [score], records: [scored, mine, chosen] };
  const records = (...ids: string[]) =>
    ids.map((id) => ({ type: "feature" as const, id }));

  it("approves the new column or choice a feature is given with it", () => {
    expect(
      usedDrafts(
        { ...noDrafts(), records: records("scored", "chosen") },
        lists,
        columns,
      ),
    ).toEqual({ ...noDrafts(), choices: ["e"], columns: ["f4"] });
  });

  it("rejects the published features given a column with it", () => {
    expect(
      usingDrafts({ ...noDrafts(), columns: ["f4"] }, lists, columns),
    ).toEqual({ ...noDrafts(), records: records("scored") });
  });

  it("leaves approving a feature and its column to another approver for a role that approves features alone", () => {
    const decision = decisionFor(
      "approve",
      { ...noDrafts(), records: records("scored") },
      ["feature"],
      lists,
      columns,
    );
    expect(decision.beyondRole).toEqual(["the column Fictional Score"]);
  });

  it("rejects the feature alone, leaving its column waiting, as a person's draft leaves its column", () => {
    const decision = decisionFor(
      "reject",
      { ...noDrafts(), records: records("scored") },
      ["feature"],
      lists,
      columns,
    );
    expect(decision.named).toEqual(["the feature scored"]);
    expect(decision.included).toBeUndefined();
    expect(decision.beyondRole).toBeUndefined();
  });

  it("marks the feature for another approver only for a role that can't approve its column", () => {
    const scoredOnly = { ...noDrafts(), records: records("scored") };
    expect(needsOtherApproval(scoredOnly, ["feature"], lists, columns)).toBe(
      true,
    );
    expect(
      needsOtherApproval(scoredOnly, ["feature", "field"], lists, columns),
    ).toBe(false);
  });

  it("marks the feature for another approver when this account changed its column", () => {
    const mineToo = {
      ...columns,
      fields: [
        {
          ...score,
          draft: { ...waiting, ...score.draft, needsOtherApprover: true },
        } as Field,
      ],
    };
    expect(
      needsOtherApproval(
        { ...noDrafts(), records: records("scored") },
        ["feature", "field"],
        lists,
        mineToo,
      ),
    ).toBe(true);
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

describe("the user's own changes that go together", () => {
  it("groups changes linked either way, the whole way along, each alone otherwise", () => {
    // Given a choice linked to its list, a person linked to the choice, and a change linked to none
    const groups = linkedGroups(
      new Map([
        ["list-item c", ["list l"]],
        ["person p", ["list-item c"]],
        ["list l", []],
        ["field f", []],
      ]),
    );

    // Then the first three are one group, whichever is asked about, and the last is alone
    expect([...(groups.get("list l") ?? [])].sort()).toEqual([
      "list l",
      "list-item c",
      "person p",
    ]);
    expect(groups.get("person p")).toBe(groups.get("list l"));
    expect(groups.get("field f")).toEqual(["field f"]);
  });
});

describe("a person's draft holding details the role can't see", () => {
  const waiting = { state: "waiting" };
  it("can't be decided, as the server would refuse it", () => {
    expect(decidable({ draft: waiting })).toBe(true);
    expect(decidable({ draft: { ...waiting, holdsUnseen: true } })).toBe(false);
  });

  it("is why another approver must decide any drafts holding it", () => {
    const people = [
      { id: "p1", draft: { holdsUnseen: true as const } },
      { id: "p2", draft: {} },
      { id: "p3" },
    ];
    expect(unseenPeople({ people: ["p2", "p1"] }, people)).toBe(unseenDetails);
    expect(unseenPeople({ people: ["p2", "p3"] }, people)).toBeUndefined();
    expect(unseenPeople({ people: [] }, people)).toBeUndefined();
  });
});
