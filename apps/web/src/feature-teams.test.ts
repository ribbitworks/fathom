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
  teamCardId,
} from "./feature-teams.ts";

const person = (id: string, preferredName: string): OrgChartPerson => ({
  id,
  preferredName,
  employeeId: `E-${id}`,
  position: "Fictional Engineer",
  teamName: "Fictional reporting team",
  teamColour: "teal",
  managerId: "someone",
});

const everyone = [
  person("lead", "Quinn Fictional"),
  person("m1", "Avery Fictional"),
  person("m2", "Blake Fictional"),
  person("m3", "Casey Fictional"),
];

const team = (fields: Partial<FeatureTeam> = {}): FeatureTeam => ({
  id: "t1",
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
    ({ id, preferredName, managerId, moved, liveCopyOf }) => ({
      id,
      preferredName,
      managerId,
      ...(moved === undefined ? {} : { moved }),
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
      preferredName: "Fictional Harbour",
      employeeId: null,
      position: "No feature lead",
      teamName: "Fictional Harbour",
      teamColour: "grape",
      managerId: null,
      approvedTeamName: "Fictional Harbour",
      featureTeam: "Fictional Harbour",
      featureTeamId: "t1",
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
          moved: {
            managerId: memberCardId("t1", "lead"),
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
      expect(added?.moved).toEqual({
        managerId: memberCardId("t1", "lead"),
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
      expect([own?.approvedTeamName, member?.moved?.state]).toEqual([
        null,
        "waiting",
      ]);
    });
  });

  it("draws the drafts applied, with nothing marked", () => {
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
      },
    ]);
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
