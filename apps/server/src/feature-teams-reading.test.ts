// SPDX-License-Identifier: Apache-2.0

// Integration tests for reading feature teams: what each role sees of teams and their drafts, today,
// on a chosen day and on People, with their members' names and the month a team disbands.

import { drafts, featureTeams } from "@fathom/db";
import { type FeatureTeams, type Person } from "@fathom/shared";
import { eq } from "drizzle-orm";
import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  errorOf,
  ok,
  personalReader,
  testPosition,
  unique,
  type User,
} from "./test-app.ts";
import {
  test,
  editor,
  approver,
  proposer,
  planner,
  chartOnly,
  startFeatureTeamTests,
  closeFeatureTeamTests,
  send,
  approved,
  reject,
  person,
  endDated,
  accessRecords,
  drafted,
  liveTeam,
  change,
  changed,
  discard,
  teamsSeen,
  teamSeen,
  moveTeamDates,
  sorted,
} from "./test-feature-teams.ts";

beforeAll(startFeatureTeamTests);

afterAll(closeFeatureTeamTests);

describe("reading feature teams", () => {
  it("shows each team, with its lead and members, to everyone who sees feature teams", async () => {
    const lead = await person();
    const member = await person();
    const name = unique("Fictional Feature Team");
    const id = await liveTeam({ name, leadId: lead, members: [member] });

    for (const who of [editor, planner, proposer]) {
      expect(await teamSeen(id, who)).toMatchObject({
        id,
        name,
        leadId: lead,
        colour: null,
        members: sorted(lead, member),
      });
    }
  });

  it("is refused to those who do not see feature teams", async () => {
    const outsider = await test.signedIn("administrator");
    expect((await send(outsider, "GET", "/api/feature-teams")).statusCode).toBe(
      403,
    );
  });

  it("sends a dated draft, with its days, only to readers who see Personal details, and records that they saw them", async () => {
    const member = await person();
    const { id } = await drafted({ members: [member], from: "2025-02-03" });
    const reader = await test.signedIn("engineering-director");

    expect((await teamSeen(id, reader))?.draft?.days).toEqual({
      [member]: "2025-02-03",
    });
    expect(await accessRecords("personal-viewed", reader.id)).not.toEqual([]);
    expect((await teamSeen(id, planner))?.draft).toBeUndefined();
  });

  describe("a reader who sees feature teams with Personal details but not people", () => {
    it("sees members who have not started yet too, as Personal details allow", async () => {
      const starting = await person({ startDate: "2099-01-01" });
      const started = await person();
      const id = await liveTeam({ leadId: starting, members: [started] });

      expect(await teamSeen(id, chartOnly)).toMatchObject({
        leadId: starting,
        members: expect.arrayContaining([started, starting]) as string[],
      });
    });

    it("gets teams as approved, with no drafts, no holder, and no team only drafted", async () => {
      const member = await person();
      const name = unique("Fictional Feature Team");
      const id = await liveTeam({ name, members: [member] });
      const { id: drafting } = await drafted();
      await changed(id, { name: unique("Fictional Renamed Team") });
      const other = await test.signedIn("workforce-administrator");
      await ok(
        await change(id, { name: unique("Fictional Held") }, other, {
          publish: false,
        }),
      );

      const seen = await teamSeen(id, chartOnly);
      expect(seen).toMatchObject({ name });
      expect(seen).not.toHaveProperty("draft");
      expect(seen).not.toHaveProperty("heldBy");
      expect(await teamSeen(drafting, chartOnly)).toBeUndefined();
      await ok(await send(other, "POST", "/api/unpublished/discard"));
    });
  });

  it("leaves out members and a lead who have not started for readers who do not see Personal details", async () => {
    const starting = await person({ startDate: "2099-01-01" });
    const started = await person();
    const id = await liveTeam({ leadId: starting, members: [started] });

    expect(await teamSeen(id, planner)).toMatchObject({
      leadId: null,
      members: [started],
    });
    expect(await teamSeen(id, editor)).toMatchObject({
      leadId: starting,
      members: sorted(starting, started),
    });
  });

  it("shows a team as its draft makes it, with the fields it changes and their live values", async () => {
    const lead = await person();
    const joining = await person();
    const name = unique("Fictional Feature Team");
    const id = await liveTeam({ name, leadId: lead });
    const renamed = unique("Fictional Renamed Team");
    await changed(id, { name: renamed, leadId: joining });

    const shown = await teamSeen(id, planner);

    expect(shown).toMatchObject({
      name: renamed,
      leadId: joining,
      members: sorted(lead, joining),
    });
    expect(shown?.draft).toMatchObject({
      action: "changed",
      live: { name, leadId: lead, members: [lead] },
      state: "waiting",
    });
    expect(shown?.draft?.changed.sort()).toEqual(
      ["leadId", "members", "name"].sort(),
    );
    const madeBy = shown?.draft?.madeBy;
    expect(madeBy).toMatch(/^Fictional User \d+$/);
    expect(shown?.draft).toMatchObject({
      madeAs: "Workforce Administrator",
      changedBy: { name: madeBy, leadId: madeBy, members: madeBy },
    });
  });

  it("does not show why a draft of someone who has not started was rejected, to readers who do not see Personal details", async () => {
    const starting = await person({ startDate: "2099-01-01" });
    const id = await liveTeam();
    await changed(id, {
      add: [starting],
      name: unique("Fictional Renamed Team"),
    });
    await ok(await reject(id));

    const seen = (await teamSeen(id, planner))?.draft;
    expect(seen?.state).toBe("rejected");
    expect(seen).not.toHaveProperty("reason");
    expect((await teamSeen(id, editor))?.draft?.reason).toBe(
      "Fictional reason",
    );
  });

  it("shows why a dated draft was rejected only to readers who see its days", async () => {
    const member = await person();
    const id = await liveTeam();
    await changed(id, { add: [member], from: "2025-05-05" });
    await ok(await reject(id));

    expect((await teamSeen(id, editor))?.draft).toMatchObject({
      state: "rejected",
      reason: "Fictional reason",
    });
    expect((await teamSeen(id, planner))?.draft).toBeUndefined();
  });

  it("shows who else is changing a team, and the maker's unpublished draft as theirs", async () => {
    const id = await liveTeam();
    const other = await test.signedIn("workforce-administrator");
    await ok(
      await change(id, { name: unique("Fictional Held Team") }, other, {
        publish: false,
      }),
    );

    expect((await teamSeen(id, editor))?.heldBy).toBeDefined();
    expect((await teamSeen(id, other))?.draft?.unpublished).toBe(true);
    await ok(await send(other, "POST", "/api/unpublished/discard"));
  });

  it("shows no colour for a team whose colour is no longer on the palette", async () => {
    const id = await liveTeam();
    await test.connection
      .update(featureTeams)
      .set({ colour: "fictional-retired-colour" })
      .where(eq(featureTeams.id, id));
    expect((await teamSeen(id))?.colour).toBeNull();
  });

  it("lists teams by name, ignoring letter case", async () => {
    const prefix = unique("Fictional Sorting");
    const later = await liveTeam({ name: `${prefix} b` });
    const earlier = await liveTeam({ name: `${prefix} A` });
    const ids = (await teamsSeen()).map(({ id }) => id);
    expect(ids.indexOf(earlier)).toBeLessThan(ids.indexOf(later));
  });
});

describe("the names of those on a team", () => {
  it("names members and leads, drafted or live, to readers who see them, including someone who has not started", async () => {
    // Given a team with a lead, and a draft adding someone who has not started
    const leadName = unique("Fictional Lead");
    const lead = await person({ preferredName: leadName });
    const startingName = unique("Fictional Starter");
    const starting = await person({
      preferredName: startingName,
      startDate: "2099-01-01",
    });
    const id = await liveTeam({ leadId: lead });
    await changed(id, { add: [starting] });

    // Then those who see Personal details are told both names
    expect((await teamSeen(id, approver))?.names).toEqual({
      [lead]: leadName,
      [starting]: startingName,
    });

    // And those who do not are told only the lead's
    expect((await teamSeen(id, planner))?.names).toEqual({ [lead]: leadName });
  });
});

describe("teams on a chosen day", () => {
  const teamsOn = async (day: string, who = editor) =>
    (
      await ok<FeatureTeams>(
        await send(who, "GET", `/api/feature-teams?on=${day}`),
      )
    ).teams;

  const teamOn = async (id: string, day: string, who = editor) =>
    (await teamsOn(day, who)).find((team) => team.id === id);

  it("is refused, saying why, to readers who do not see Personal details", async () => {
    const response = await send(
      planner,
      "GET",
      "/api/feature-teams?on=2025-03-01",
    );
    expect(response.statusCode).toBe(403);
    expect(errorOf(response)).toBe("Other dates need Personal access.");
  });

  it("shows no lead on a day its lead, since removed from People, led the team", async () => {
    // Given a team whose first lead, who led it only in the past, is then removed from People
    const past = await person();
    const next = await person();
    const id = await liveTeam({
      leadId: past,
      members: [next],
      from: "2025-01-01",
    });
    await changed(id, { leadId: next, from: "2025-06-01" });
    await approved(id);
    await ok(await send(editor, "DELETE", `/api/people/${past}`));
    await ok(
      await send(approver, "POST", "/api/drafts/approval", { people: [past] }),
    );

    // When the team is read on a day the removed lead led it
    const team = await teamOn(id, "2025-03-01");

    // Then the team has no lead, and its other member as they were then
    expect(team).toMatchObject({
      leadId: null,
      members: [next],
    });
  });

  it("is given to readers who see Personal details without seeing people", async () => {
    const reader = await test.signedIn(["feature-teams:view", "personal:view"]);
    const response = await send(
      reader,
      "GET",
      "/api/feature-teams?on=2025-03-01",
    );
    expect(response.statusCode).toBe(200);
  });

  it("shows the members and lead of that day, as approved", async () => {
    const lead = await person();
    const joinsLater = await person();
    const id = await liveTeam({ leadId: lead, from: "2025-01-15" });
    await changed(id, { add: [joinsLater], from: "2099-02-01" });
    await approved(id);

    const before = await teamOn(id, "2099-01-31");
    const after = await teamOn(id, "2099-02-01");

    expect(before).toMatchObject({ leadId: lead, members: [lead] });
    expect(after?.members).toEqual(sorted(lead, joinsLater));
  });

  it("lays a draft's changes over the team of that day, with that day's team as live", async () => {
    // Given a team with someone approved to join later, and a draft renaming it and adding someone
    const lead = await person();
    const joinsLater = await person();
    const newcomer = await person();
    const id = await liveTeam({ leadId: lead, from: "2025-01-15" });
    await changed(id, { add: [joinsLater], from: "2099-02-01" });
    await approved(id);
    const name = unique("Fictional Renamed Team");
    await changed(id, { name, add: [newcomer], from: "2099-03-01" });

    // When the team is read on a day after the approved change
    const team = await teamOn(id, "2099-02-01");

    // Then the draft's changes are laid over that day's team
    expect(team).toMatchObject({
      name,
      leadId: lead,
      members: sorted(lead, joinsLater, newcomer),
    });
    expect(team?.draft).toMatchObject({
      live: { members: sorted(lead, joinsLater) },
      days: { [newcomer]: "2099-03-01" },
    });
  });

  it("lists a team with no members that day while it has a draft", async () => {
    const member = await person();
    const id = await liveTeam({ members: [member], from: "2099-02-01" });
    await changed(id, { name: unique("Fictional Renamed Team") });

    expect(await teamOn(id, "2099-01-31")).toMatchObject({ members: [] });
  });

  it("shows people as they are today on a later day to readers who do not see Confidential data", async () => {
    const current = await person();
    const starter = await person({ startDate: "2098-06-01" });
    const id = await liveTeam({ members: [current, starter] });
    const manager = await test.signedIn(personalReader);

    expect((await teamOn(id, "2099-01-01"))?.members).toEqual(
      [current, starter].sort(),
    );
    expect((await teamOn(id, "2099-01-01", manager))?.members).toEqual([
      current,
    ]);
  });

  it("keeps a draft dated from a later day from readers who do not see Personal details", async () => {
    const member = await person();
    const id = await liveTeam();
    await changed(id, { add: [member], from: "2099-03-01" });

    expect((await teamSeen(id))?.draft).toBeDefined();
    const seen = await teamSeen(id, planner);
    expect(seen?.draft).toBeUndefined();
    expect(seen?.members).not.toContain(member);
  });

  it("hides why a draft was rejected from readers who do not see Personal details, when it holds someone who has not started", async () => {
    const starter = await person({ startDate: "2098-01-01" });
    const id = await liveTeam({
      members: [await person()],
      from: "2025-01-15",
    });
    await changed(id, { add: [starter], name: unique("Fictional Renamed") });
    await ok(await reject(id));

    const seen = (await teamSeen(id, planner))?.draft;

    expect(seen?.state).toBe("rejected");
    expect(seen).not.toHaveProperty("reason");
  });

  it("leaves out a change drafted for a team that is not live", async () => {
    const id = randomUUID();
    await test.connection.insert(drafts).values({
      recordType: "feature-team",
      recordId: id,
      action: "changed",
      fields: { name: unique("Fictional Lost Team") },
    });

    expect(await teamOn(id, "2099-01-31")).toBeUndefined();
    await test.connection.delete(drafts).where(eq(drafts.recordId, id));
  });

  it("shows who led the team that day", async () => {
    const first = await person();
    const second = await person();
    const id = await liveTeam({
      leadId: first,
      members: [second],
      from: "2025-01-15",
    });
    await changed(id, { leadId: second, from: "2099-03-01" });
    await approved(id);

    expect((await teamOn(id, "2099-02-28"))?.leadId).toBe(first);
    expect((await teamOn(id, "2099-03-01"))?.leadId).toBe(second);
  });

  it("shows no lead on a day the lead is not a member", async () => {
    // Given someone planned to lead a team, then planned to leave it before that day
    const first = await person();
    const second = await person();
    const id = await liveTeam({
      leadId: first,
      members: [second],
      from: "2025-01-15",
    });
    await changed(id, { leadId: second, from: "2099-03-01" });
    await approved(id);
    await changed(id, { remove: [second], from: "2099-02-01" });
    await approved(id);

    // Then the team has no lead that day
    expect(await teamOn(id, "2099-03-01")).toMatchObject({
      leadId: null,
      members: [first],
    });
  });

  it("leaves out a team with no members that day", async () => {
    const member = await person();
    const id = await liveTeam({ members: [member], from: "2099-02-01" });

    expect(await teamOn(id, "2099-01-31")).toBeUndefined();
  });

  it("lists teams by name, ignoring letter case", async () => {
    const member = await person();
    const prefix = unique("Fictional Ordered");
    const later = await liveTeam({
      name: `${prefix} b`,
      members: [member],
      from: "2025-01-15",
    });
    const earlier = await liveTeam({
      name: `${prefix} A`,
      members: [member],
      from: "2025-01-15",
    });

    const ids = (await teamsOn("2025-02-01")).map(({ id }) => id);

    expect(ids.indexOf(earlier)).toBeLessThan(ids.indexOf(later));
  });

  it("is refused to those who do not see feature teams", async () => {
    const noChart = await test.signedIn(["plan:view"]);

    expect(
      (await send(noChart, "GET", "/api/feature-teams?on=2025-02-01"))
        .statusCode,
    ).toBe(403);
  });

  it("is refused a day that does not exist", async () => {
    expect(
      (await send(editor, "GET", "/api/feature-teams?on=2025-02-30"))
        .statusCode,
    ).toBe(400);
  });

  it("records a view of Personal details by a reader who sees them", async () => {
    const reader = await test.signedIn("engineering-director");

    await teamsOn("2025-02-11", reader);

    expect(await accessRecords("personal-viewed", reader.id)).toHaveLength(1);
  });
});

describe("a team disbanding", () => {
  async function disbandedFrom(id: string, who = editor) {
    return (await teamSeen(id, who))?.disbandedFrom;
  }

  async function teamWhoseMemberLeaves(from: string) {
    const member = await person();
    const id = await liveTeam({ members: [member], from: "2025-01-15" });
    await changed(id, { remove: [member], from });
    await approved(id);
    return id;
  }

  it("has not happened to a team that has never had a member", async () => {
    expect(await disbandedFrom(await liveTeam())).toBeUndefined();
  });

  it("has not happened while someone stays on the team", async () => {
    const member = await person();
    const id = await liveTeam({ members: [member], from: "2025-01-15" });

    expect(await disbandedFrom(id)).toBeUndefined();
  });

  it("is from the next month when the last member leaves during a month", async () => {
    expect(await disbandedFrom(await teamWhoseMemberLeaves("2025-03-15"))).toBe(
      "2025-04",
    );
  });

  it("is from that month when the last member leaves on its first day", async () => {
    expect(await disbandedFrom(await teamWhoseMemberLeaves("2025-04-01"))).toBe(
      "2025-04",
    );
  });

  it("is shown ahead of time when the last member is planned to leave", async () => {
    expect(await disbandedFrom(await teamWhoseMemberLeaves("2099-03-15"))).toBe(
      "2099-04",
    );
  });

  it("is not shown once the days members leave move out of the reader's sight", async () => {
    // Given
    const id = await teamWhoseMemberLeaves("2025-03-15");
    const reader = await test.signedIn([
      "people:view",
      "feature-teams:view",
      "personal:view",
    ]);
    expect(await disbandedFrom(id, reader)).toBe("2025-04");
    // When
    await moveTeamDates("confidential");
    // Then
    try {
      expect(await disbandedFrom(id, reader)).toBeUndefined();
      expect(await disbandedFrom(id, approver)).toBe("2025-04");
    } finally {
      await moveTeamDates("personal");
    }
  });

  it("is on the teams of a chosen day too", async () => {
    const id = await teamWhoseMemberLeaves("2099-03-15");

    const team = (
      await ok<FeatureTeams>(
        await send(editor, "GET", "/api/feature-teams?on=2099-02-01"),
      )
    ).teams.find((one) => one.id === id);

    expect(team?.disbandedFrom).toBe("2099-04");
  });

  it("does not happen when another member stays on past the one who leaves", async () => {
    const leaving = await person();
    const staying = await person();
    const id = await liveTeam({
      members: [leaving, staying],
      from: "2025-01-15",
    });
    await changed(id, { remove: [leaving], from: "2025-03-15" });
    await approved(id);

    expect(await disbandedFrom(id)).toBeUndefined();
  });

  it("counts a member's end date, the day after being the first without them", async () => {
    const member = await person();
    const id = await liveTeam({ members: [member], from: "2025-01-15" });
    await endDated(member, "2025-03-31");

    expect(await disbandedFrom(id)).toBe("2025-04");
  });

  it("tells a reader who does not see Personal details nothing from a past end date", async () => {
    const member = await person();
    const id = await liveTeam({ members: [member], from: "2025-01-15" });
    await endDated(member, "2025-03-31");

    expect(await disbandedFrom(id, planner)).toBeUndefined();
  });

  it("is told only to readers who see Personal details", async () => {
    const id = await teamWhoseMemberLeaves("2025-03-15");

    expect(await disbandedFrom(id)).toBe("2025-04");
    expect(await disbandedFrom(id, planner)).toBeUndefined();
  });

  it("records a view of Personal details by a reader who sees when a team disbands", async () => {
    await teamWhoseMemberLeaves("2099-03-15");
    const reader = await test.signedIn("engineering-director");

    await teamsSeen(reader);

    expect(await accessRecords("personal-viewed", reader.id)).not.toEqual([]);
  });

  it("counts an end date still to come", async () => {
    const member = await person({ endDate: "2098-06-15" });
    const id = await liveTeam({ members: [member], from: "2025-01-15" });

    expect(await disbandedFrom(id)).toBe("2098-07");
  });
});

describe("each person's feature teams on People", () => {
  const peopleSeen = async (who: User, on?: string) =>
    (
      await ok<{ people: Person[] }>(
        await send(
          who,
          "GET",
          on === undefined ? "/api/people" : `/api/people?on=${on}`,
        ),
      )
    ).people;

  const teamsOf = async (personId: string, who = editor, on?: string) =>
    (await peopleSeen(who, on)).find(({ id }) => id === personId)?.featureTeams;

  it("names each live team someone is on, by name, to readers who see feature teams", async () => {
    // Given someone on two teams, named so the second comes first
    const member = await person();
    const later = await liveTeam({ name: unique("Fictional Zeta Team") });
    const earlier = await liveTeam({ name: unique("Fictional Alpha Team") });
    await changed(later, { add: [member] });
    await approved(later);
    await changed(earlier, { add: [member] });
    await approved(earlier);

    // When People is read by a reader without Personal details
    const teams = await teamsOf(member, planner);

    // Then both teams are named, in order of name
    expect(teams?.map(({ id }) => id)).toEqual([earlier, later]);
    expect(teams?.[0]?.name).toMatch(/^Fictional Alpha Team/);
  });

  it("names no team for someone on none", async () => {
    const loner = await person();

    expect(await teamsOf(loner, planner)).toEqual([]);
  });

  it("gives each team its colour, for its square", async () => {
    const lead = await person();
    const name = unique("Fictional Coloured Team");
    const id = await liveTeam({ name, leadId: lead });
    await test.connection
      .update(featureTeams)
      .set({ colour: "teal" })
      .where(eq(featureTeams.id, id));
    const everyone = await peopleSeen(editor);
    expect(everyone.find((one) => one.id === lead)?.featureTeams).toEqual([
      { id, name, colour: "teal" },
    ]);
  });

  it("leaves out a team's drafts: a member not yet approved, and a new name", async () => {
    // Given a live team, with a draft renaming it and adding someone
    const lead = await person();
    const newcomer = await person();
    const name = unique("Fictional Live Team");
    const id = await liveTeam({ name, leadId: lead });
    await changed(id, { name: unique("Fictional Renamed"), add: [newcomer] });

    // When People is read
    const everyone = await peopleSeen(editor);

    // Then the team shows as live: by its live name, without the newcomer
    expect(everyone.find((one) => one.id === lead)?.featureTeams).toEqual([
      { id, name, colour: null },
    ]);
    expect(everyone.find((one) => one.id === newcomer)?.featureTeams).toEqual(
      [],
    );
    await ok(await discard(id));
  });

  it("names no team for a planned hire", async () => {
    // Given a planned hire, drafted and approved, so it is live
    const { ids } = await ok<{ ids: string[] }>(
      await send(editor, "POST", "/api/planned-hires", {
        hires: [{ positionId: testPosition, targetDate: "2027-03-15" }],
      }),
      201,
    );
    const hire = String(ids[0]);
    await ok(
      await send(approver, "POST", "/api/drafts/approval", {
        plannedHires: [hire],
      }),
    );

    // When People is read, its planned hires among its rows
    const row = (await peopleSeen(editor)).find(({ id }) => id === hire);

    // Then the hire is on no team
    expect(row?.kind).toBe("planned-hire");
    expect(row?.featureTeams).toEqual([]);
  });

  it("names the teams of the day People shows", async () => {
    // Given someone approved to join a team from a later day
    const lead = await person();
    const joinsLater = await person();
    const id = await liveTeam({ leadId: lead, from: "2025-01-15" });
    await changed(id, { add: [joinsLater], from: "2099-02-01" });
    await approved(id);

    // When People is read on the day before and the day itself
    const before = await teamsOf(joinsLater, editor, "2099-01-31");
    const after = await teamsOf(joinsLater, editor, "2099-02-01");

    // Then they are on it only from that day
    expect(before).toEqual([]);
    expect(after?.map((team) => team.id)).toEqual([id]);
  });

  it("is sent to no reader who doesn't see feature teams", async () => {
    // Given someone on a team, and a reader who sees people but not feature teams
    const lead = await person();
    await liveTeam({ leadId: lead });
    const peopleOnly = await test.signedIn(["people:view"]);

    // When that reader reads People
    const read = await ok<{ people: Person[]; order: string[] }>(
      await send(peopleOnly, "GET", "/api/people"),
    );

    // Then no one's feature teams are sent, nor the column in the order
    expect(read.people.some(({ id }) => id === lead)).toBe(true);
    expect(read.people.every((one) => !("featureTeams" in one))).toBe(true);
    expect(read.order).not.toContain("featureTeams");
    expect(
      (await ok<{ order: string[] }>(await send(planner, "GET", "/api/people")))
        .order,
    ).toContain("featureTeams");
  });
});
