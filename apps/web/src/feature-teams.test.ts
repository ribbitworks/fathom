// SPDX-License-Identifier: Apache-2.0

// Tests for feature teams as the chart draws them: a team as it is live, and each team's cards,
// under its lead or its own card while it has none, with members a draft adds marked and those it
// removes drawn where they were, as each choice of the Draft menu shows them.

import type { FeatureTeam, OrgChartPerson } from "@fathom/shared";
import { describe, expect, it } from "vitest";
import {
  featureTeamPeople,
  liveTeam,
  memberCardId,
  membersChanged,
  someoneUnseen,
  takesEffect,
  teamCardId,
  teamPersonNamer,
  teamPersonOf,
} from "./feature-teams.ts";

const person = (id: string, preferredName: string): OrgChartPerson => ({
  id,
  keyNumber: 1,
  preferredName,
  employeeId: `E-${id}`,
  position: "Fictional Engineer",
  teamName: "Fictional reporting team",
  teamColour: "teal",
  managerId: "someone",
});

// A planned hire's placeholder, named by its position and ID, as it has no name of its own.
const hire = (id: string, shownId: string): OrgChartPerson => ({
  ...person(id, `Fictional Tester, ${shownId}`),
  employeeId: null,
  position: "Fictional Tester",
  teamName: null,
  teamColour: null,
  planned: { expected: "2027-02", shownId },
});

const everyone = [
  person("lead", "Quinn Fictional"),
  person("m1", "Avery Fictional"),
  person("m2", "Blake Fictional"),
  person("m3", "Casey Fictional"),
  hire("h1", "TBD-1"),
];

const team = (fields: Partial<FeatureTeam> = {}): FeatureTeam => ({
  id: "t1",
  keyNumber: 1,
  name: "Fictional Harbour",
  leadId: "lead",
  colour: "grape",
  members: ["lead", "m1"],
  names: {},
  ...fields,
});

const draft = (fields: Partial<NonNullable<FeatureTeam["draft"]>> = {}) => ({
  action: "changed" as const,
  changed: [],
  live: {},
  state: "waiting" as const,
  madeBy: "Fictional Editor",
  madeAt: "2026-10-30T15:00:00.000Z",
  ...fields,
});

const cards = (teams: FeatureTeam[], show: "both" | "drafts" | "live") =>
  featureTeamPeople(teams, everyone, show).map(
    ({ id, preferredName, managerId, added, liveCopyOf }) => ({
      id,
      preferredName,
      managerId,
      ...(added === undefined ? {} : { added }),
      ...(liveCopyOf === undefined ? {} : { liveCopyOf }),
    }),
  );

describe("a feature team as it is live", () => {
  it("is the team itself when it has no draft", () => {
    const one = team();
    expect(liveTeam(one)).toBe(one);
  });

  it("is none when its draft adds it", () => {
    expect(liveTeam(team({ draft: draft({ action: "created" }) }))).toBe(
      undefined,
    );
  });

  it("takes back the name, lead, and members its draft changes", () => {
    const live = liveTeam(
      team({
        name: "Fictional Drafted",
        leadId: null,
        members: ["m2"],
        draft: draft({
          live: { name: "Fictional Harbour", leadId: "lead", members: ["m1"] },
        }),
      }),
    );
    expect([live?.name, live?.leadId, live?.members]).toEqual([
      "Fictional Harbour",
      "lead",
      ["m1"],
    ]);
  });

  it("keeps what its draft leaves alone", () => {
    const live = liveTeam(team({ draft: draft({ action: "deleted" }) }));
    expect([live?.name, live?.leadId, live?.members]).toEqual([
      "Fictional Harbour",
      "lead",
      ["lead", "m1"],
    ]);
  });
});

describe("feature teams on the chart", () => {
  it("draws each team under its lead's card, naming the team in its colour, with its members below", () => {
    const [lead, member] = featureTeamPeople([team()], everyone, "both");
    expect(lead).toMatchObject({
      id: memberCardId("t1", "lead"),
      preferredName: "Quinn Fictional",
      teamName: "Fictional Harbour",
      teamColour: "grape",
      managerId: null,
      approvedTeamName: "Fictional Harbour",
      featureTeam: "Fictional Harbour",
      featureTeamId: "t1",
      teamKeyNumber: 1,
    });
    expect(lead?.teamCard).toBeUndefined();
    expect(member).toMatchObject({
      id: memberCardId("t1", "m1"),
      teamName: null,
      teamColour: null,
      managerId: memberCardId("t1", "lead"),
      featureTeam: "Fictional Harbour",
      featureTeamId: "t1",
    });
  });

  it("draws a team with no lead under a card naming it", () => {
    const [own, member] = featureTeamPeople(
      [team({ leadId: null })],
      everyone,
      "both",
    );
    expect(own).toEqual({
      id: teamCardId("t1"),
      keyNumber: 1,
      preferredName: "Fictional Harbour",
      employeeId: null,
      position: "No feature lead",
      teamName: "Fictional Harbour",
      teamColour: "grape",
      managerId: null,
      approvedTeamName: "Fictional Harbour",
      featureTeam: "Fictional Harbour",
      featureTeamId: "t1",
      teamKeyNumber: 1,
      teamCard: true,
    });
    expect(member?.managerId).toBe(teamCardId("t1"));
  });

  it("draws a team whose lead is not on the chart under its own card, leaving out members not on it", () => {
    expect(
      cards(
        [team({ leadId: "gone", members: ["gone", "m1", "hidden"] })],
        "both",
      ),
    ).toEqual([
      {
        id: teamCardId("t1"),
        preferredName: "Fictional Harbour",
        managerId: null,
      },
      {
        id: memberCardId("t1", "m1"),
        preferredName: "Avery Fictional",
        managerId: teamCardId("t1"),
      },
    ]);
  });

  it("draws someone on two teams under each", () => {
    const ids = cards(
      [team(), team({ id: "t2", leadId: null, members: ["m1"] })],
      "both",
    ).map(({ id }) => id);
    expect(ids).toEqual([
      memberCardId("t1", "lead"),
      memberCardId("t1", "m1"),
      teamCardId("t2"),
      memberCardId("t2", "m1"),
    ]);
  });

  it("draws a planned hire on a team under it, as a placeholder", () => {
    const [, , drawn] = featureTeamPeople(
      [team({ members: ["lead", "m1", "h1"] })],
      everyone,
      "both",
    );
    expect(drawn).toMatchObject({
      id: memberCardId("t1", "h1"),
      preferredName: "Fictional Tester, TBD-1",
      managerId: memberCardId("t1", "lead"),
      planned: { expected: "2027-02", shownId: "TBD-1" },
    });
  });

  it("draws a team a planned hire leads under the hire's card, naming the team", () => {
    const [lead, member] = featureTeamPeople(
      [team({ leadId: "h1", members: ["h1", "m1"] })],
      everyone,
      "both",
    );
    expect(lead).toMatchObject({
      id: memberCardId("t1", "h1"),
      teamName: "Fictional Harbour",
      planned: { shownId: "TBD-1" },
    });
    expect(member?.managerId).toBe(memberCardId("t1", "h1"));
  });

  it("leaves out a planned hire the chart doesn't draw, as on an earlier day, drawing a team it led under a card naming it", () => {
    expect(
      cards(
        [
          team({
            leadId: "past-hire",
            members: ["past-hire", "m1"],
            hiresFrom: { "past-hire": "2026-10-01" },
          }),
        ],
        "both",
      ).map(({ id }) => id),
    ).toEqual([teamCardId("t1"), memberCardId("t1", "m1")]);
  });

  describe("with drafts beside live", () => {
    const drafted = team({
      name: "Fictional Drafted",
      members: ["lead", "m2"],
      draft: draft({
        state: "rejected",
        unpublished: true,
        live: { name: "Fictional Harbour", members: ["lead", "m1", "gone"] },
      }),
    });

    it("marks members the draft adds, and draws those it removes where they were, marked Live", () => {
      expect(cards([drafted], "both")).toEqual([
        {
          id: memberCardId("t1", "lead"),
          preferredName: "Quinn Fictional",
          managerId: null,
        },
        {
          id: memberCardId("t1", "m2"),
          preferredName: "Blake Fictional",
          managerId: memberCardId("t1", "lead"),
          added: {
            state: "rejected",
            unpublished: true,
          },
        },
        {
          id: `${memberCardId("t1", "m1")} live`,
          preferredName: "Avery Fictional",
          managerId: memberCardId("t1", "lead"),
          liveCopyOf: memberCardId("t1", "m1"),
        },
      ]);
    });

    it("names the team as drafted, with its approved name kept", () => {
      const [lead] = featureTeamPeople([drafted], everyone, "both");
      expect([lead?.teamName, lead?.approvedTeamName]).toEqual([
        "Fictional Drafted",
        "Fictional Harbour",
      ]);
    });

    it("marks a published draft's added members as published", () => {
      const [, added] = featureTeamPeople(
        [team({ draft: draft({ live: { members: ["lead"] } }) })],
        everyone,
        "both",
      );
      expect(added?.added).toEqual({
        state: "waiting",
        unpublished: false,
      });
    });

    it("draws no Live copy of a former member the draft makes lead", () => {
      expect(
        cards(
          [
            team({
              leadId: "m1",
              members: ["m2"],
              draft: draft({ live: { leadId: "lead", members: ["m1", "m2"] } }),
            }),
          ],
          "both",
        ).map(({ id }) => id),
      ).toEqual([memberCardId("t1", "m1"), memberCardId("t1", "m2")]);
    });

    it("gives a team the draft adds no approved name, under its lead too", () => {
      const [lead] = featureTeamPeople(
        [team({ draft: draft({ action: "created" }) })],
        everyone,
        "both",
      );
      expect(lead?.approvedTeamName).toBeNull();
    });

    it("draws a team the draft adds, with no approved name, every member marked", () => {
      const [own, member] = featureTeamPeople(
        [
          team({
            leadId: null,
            members: ["m1"],
            draft: draft({ action: "created" }),
          }),
        ],
        everyone,
        "both",
      );
      expect([own?.approvedTeamName, member?.added?.state]).toEqual([
        null,
        "waiting",
      ]);
    });
  });

  describe("with a draft renaming a team", () => {
    const renamed = team({
      name: "Fictional Drafted",
      draft: draft({
        changed: ["name"],
        unpublished: true,
        live: { name: "Fictional Harbour" },
      }),
    });

    it("marks the team's card with the drafted name, and the live name beside live", () => {
      const [lead] = featureTeamPeople([renamed], everyone, "both");
      expect(lead?.renamed).toEqual({
        live: "Fictional Harbour",
        draft: {
          teamName: "Fictional Drafted",
          state: "waiting",
          unpublished: true,
        },
      });
    });

    it("marks the drafted name without the live name when the drafts are applied", () => {
      const [lead] = featureTeamPeople([renamed], everyone, "drafts");
      expect(lead?.renamed).toEqual({
        live: null,
        draft: {
          teamName: "Fictional Drafted",
          state: "waiting",
          unpublished: true,
        },
      });
    });

    it("marks a published renaming as published", () => {
      const [lead] = featureTeamPeople(
        [
          team({
            draft: draft({
              changed: ["name"],
              live: { name: "Fictional Old" },
            }),
          }),
        ],
        everyone,
        "both",
      );
      expect(lead?.renamed?.draft).toMatchObject({ unpublished: false });
    });
  });

  it("marks no renaming for a draft that changes only the members", () => {
    const [lead] = featureTeamPeople(
      [
        team({
          draft: draft({ changed: ["members"], live: { members: ["lead"] } }),
        }),
      ],
      everyone,
      "both",
    );
    expect(lead?.renamed).toBeUndefined();
  });

  it("names who holds a team on its card", () => {
    const [lead, member] = featureTeamPeople(
      [team({ heldBy: "Fictional Editor" })],
      everyone,
      "both",
    );
    expect([lead?.teamHeldBy, member?.teamHeldBy]).toEqual([
      "Fictional Editor",
      undefined,
    ]);
  });

  it("draws the drafts applied, marking who the draft adds, with no Live copies", () => {
    expect(
      cards(
        [
          team({
            members: ["lead", "m2"],
            draft: draft({ live: { members: ["lead", "m1"] } }),
          }),
        ],
        "drafts",
      ),
    ).toEqual([
      {
        id: memberCardId("t1", "lead"),
        preferredName: "Quinn Fictional",
        managerId: null,
      },
      {
        id: memberCardId("t1", "m2"),
        preferredName: "Blake Fictional",
        managerId: memberCardId("t1", "lead"),
        added: { state: "waiting", unpublished: false },
      },
    ]);
  });

  it("marks, live only, each live member a waiting draft takes off the team", () => {
    const [, leaving] = featureTeamPeople(
      [
        team({
          members: ["lead", "m2"],
          draft: draft({ live: { members: ["lead", "m1"] } }),
        }),
      ],
      everyone,
      "live",
    );
    expect(leaving).toMatchObject({
      id: memberCardId("t1", "m1"),
      leaving: { state: "waiting", unpublished: false },
    });
  });

  it("draws each team as it is live with Live only, leaving out one only drafted to be added", () => {
    expect(
      cards(
        [
          team({
            members: ["lead", "m2"],
            draft: draft({ live: { members: ["lead", "m1"] } }),
          }),
          team({ id: "t2", draft: draft({ action: "created" }) }),
        ],
        "live",
      ),
    ).toEqual([
      {
        id: memberCardId("t1", "lead"),
        preferredName: "Quinn Fictional",
        managerId: null,
      },
      {
        id: memberCardId("t1", "m1"),
        preferredName: "Avery Fictional",
        managerId: memberCardId("t1", "lead"),
      },
    ]);
  });
});

describe("a choice of a team's members", () => {
  const offered = new Set(["a", "b", "c"]);

  it("adds those chosen and takes off those unticked", () => {
    expect(membersChanged(["a", "b"], ["b", "c"], offered)).toEqual({
      add: ["c"],
      remove: ["a"],
    });
  });

  it("keeps members the picker did not offer", () => {
    expect(membersChanged(["a", "unseen"], ["a", "c"], offered)).toEqual({
      add: ["c"],
      remove: [],
    });
  });

  it("is nothing when it changes no one, in whatever order", () => {
    expect(membersChanged(["a", "b"], ["b", "a"], offered)).toBeUndefined();
  });
});

describe("when a drafted change takes effect", () => {
  it("gives a planned hire's day, held apart from people's", () => {
    const drafted = draft({ hireDays: { h1: "2027-05-01" } });

    expect(takesEffect(drafted, "h1", "2027-01-01")).toBe("May 1, 2027");
  });

  it("gives the day a planned hire becomes the lead", () => {
    const drafted = draft({ hireLeadDay: "2027-06-01" });

    expect(takesEffect(drafted, undefined, "2027-01-01")).toBe("Jun 1, 2027");
  });
});

describe("naming someone on a team", () => {
  const named = teamPersonNamer(
    team({
      members: ["lead", "h1", "starter"],
      names: {
        lead: "Quinn Fictional",
        h1: "TBD-1",
        starter: "Drew Fictional",
      },
    }),
    everyone,
  );

  it("names a planned hire on the chart by its placeholder name there", () => {
    expect(named("h1")).toBe("Fictional Tester, TBD-1");
  });

  it("names a person by the team's names, then by the chart", () => {
    expect([named("starter"), named("m2")]).toEqual([
      "Drew Fictional",
      "Blake Fictional",
    ]);
  });

  it("names someone neither gives as someone the role can't see", () => {
    expect(named("gone")).toBe(someoneUnseen);
  });
});

describe("finding someone on a team", () => {
  const personOf = teamPersonOf(
    team({
      members: ["m1", "h1", "off", "drafted"],
      names: { off: "REQ-7701", drafted: "REQ-7702" },
      hires: ["drafted", "h1", "off"],
    }),
    everyone,
  );

  it("gives a person their name alone", () => {
    expect(personOf("m1")).toEqual({ name: "Avery Fictional" });
  });

  it("gives a planned hire on the chart its made name, key and when it's planned, as its card does", () => {
    expect(personOf("h1")).toEqual({
      name: "Fictional Tester, TBD-1",
      hire: {
        madeName: true,
        keyNumber: 1,
        planned: { expected: "2027-02", shownId: "TBD-1" },
      },
    });
  });

  it("knows a planned hire the chart doesn't draw as one, as the team says", () => {
    expect(personOf("off")).toEqual({
      name: "REQ-7701",
      hire: { madeName: false },
    });
  });

  it("knows a planned hire a draft adds, which the chart doesn't draw and has no day, as one", () => {
    expect(personOf("drafted")).toEqual({
      name: "REQ-7702",
      hire: { madeName: false },
    });
  });
});
