// SPDX-License-Identifier: Apache-2.0

// Integration tests for feature teams month by month: changing the teams someone is on from a month,
// and the monthly grid of teams as approved and as drafts would make them.

import { monthOf, type TeamMonths } from "@fathom/shared";
import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { personalReader } from "./test-app.ts";
import {
  test,
  editor,
  proposer,
  datedProposer,
  planner,
  chartOnly,
  today,
  startFeatureTeamTests,
  closeFeatureTeamTests,
  unique,
  send,
  ok,
  refusal,
  approved,
  person,
  endDated,
  accessRecords,
  liveTeam,
  change,
  changed,
  remove,
  teamSeen,
  liveRow,
  memberships,
} from "./test-feature-teams.ts";

beforeAll(startFeatureTeamTests);

afterAll(closeFeatureTeamTests);

describe("changing the teams someone is on from a month", () => {
  const changeTeams = (personId: string, body: object, who = editor) =>
    send(who, "PATCH", `/api/feature-teams/members/${personId}`, body);

  async function teamsChanged(personId: string, body: object, who = editor) {
    return (
      await ok<{ changeSetId: string | null }>(
        await changeTeams(personId, body, who),
      )
    ).changeSetId;
  }

  // A fictional person with a known name.
  async function named(): Promise<{ id: string; name: string }> {
    const name = unique("Fictional Person");
    return { id: await person({ preferredName: name }), name };
  }

  async function namedTeam(body: object = {}) {
    const name = unique("Fictional Feature Team");
    return { id: await liveTeam({ name, ...body }), name };
  }

  it("drafts joining the teams added and leaving those removed, from the day given, undone together", async () => {
    // Given
    const member = await person();
    const leaving = await liveTeam({ members: [member], from: "2025-01-01" });
    const joining = await liveTeam();

    // When
    const changeSetId = await teamsChanged(member, {
      add: [joining],
      remove: [leaving],
      from: "2026-08-01",
    });

    // Then
    expect((await teamSeen(joining))?.draft?.days).toEqual({
      [member]: "2026-08-01",
    });
    expect((await teamSeen(leaving))?.draft?.days).toEqual({
      [member]: "2026-08-01",
    });
    await ok(await send(editor, "POST", `/api/undo/${String(changeSetId)}`));
    expect((await teamSeen(joining))?.draft).toBeUndefined();
    expect((await teamSeen(leaving))?.draft).toBeUndefined();
  });

  it("drafts a change from today when no day is given", async () => {
    const member = await person();
    const id = await liveTeam();

    await teamsChanged(member, { add: [id] });
    await approved(id);

    expect(await memberships(id)).toEqual([
      { personId: member, member: true, fromDate: today },
    ]);
  });

  it("is refused taking back a change the draft makes from another month", async () => {
    const { id: member, name } = await named();
    const team = await namedTeam({ from: "2025-01-01" });
    await changed(team.id, { add: [member], from: "2026-08-01" });

    const response = await changeTeams(member, {
      remove: [team.id],
      from: "2026-10-01",
    });

    expect(response.statusCode).toBe(400);
    expect(refusal(response)).toBe(
      `The draft of ${team.name} already changes ${name} from another month. Approve or discard that draft first.`,
    );
  });

  it("is refused a month in or before an approved change", async () => {
    const { id: member, name } = await named();
    const team = await namedTeam({ from: "2025-01-01" });
    await changed(team.id, { add: [member], from: "2026-09-01" });
    await approved(team.id);

    const response = await changeTeams(member, {
      add: [team.id],
      from: "2026-09-01",
    });

    expect(response.statusCode).toBe(400);
    expect(refusal(response)).toBe(
      `${name} has an approved change on ${team.name} in this month or later, so this month can't change here.`,
    );
  });

  it("changes a past month for a role that may change Personal details, and refuses one for a role that may not", async () => {
    const member = await person();
    const id = await liveTeam({ members: [member], from: "2025-01-01" });

    const response = await changeTeams(
      member,
      { remove: [id], from: "2026-03-01" },
      proposer,
    );
    await teamsChanged(member, { remove: [id], from: "2026-03-01" });

    expect(response.statusCode).toBe(403);
    expect((await teamSeen(id))?.draft?.days).toEqual({
      [member]: "2026-03-01",
    });
  });

  it("lets a proposer change a later month", async () => {
    const member = await person();
    const id = await liveTeam();

    await teamsChanged(
      member,
      { add: [id], from: "2026-08-01" },
      datedProposer,
    );

    expect((await teamSeen(id, datedProposer))?.members).toContain(member);
  });

  it("is refused for someone who is not a person, or has left", async () => {
    const id = await liveTeam();
    const gone = await person();
    await endDated(gone, "2026-01-31");

    const missing = await changeTeams(randomUUID(), { add: [id] });
    const left = await changeTeams(gone, { add: [id] });

    expect(missing.statusCode).toBe(404);
    expect(refusal(missing)).toBe("There is no such person");
    expect(left.statusCode).toBe(400);
    expect(refusal(left)).toBe(
      "Someone who has left can't join or leave a team",
    );
  });

  it("is refused for a team its draft removes", async () => {
    const member = await person();
    const id = await liveTeam({ members: [member], from: "2025-01-01" });
    await ok(await remove(id));

    const response = await changeTeams(member, { remove: [id] });

    expect(response.statusCode).toBe(409);
  });

  it("saves nothing when it adds someone already on the team", async () => {
    const member = await person();
    const id = await liveTeam({ members: [member] });

    expect(
      await teamsChanged(member, { add: [id], from: "2026-08-01" }),
    ).toBeNull();
    expect((await teamSeen(id))?.draft).toBeUndefined();
  });

  it("saves nothing when it changes nothing", async () => {
    expect(await teamsChanged(await person(), {})).toBeNull();
  });
});

describe("feature teams month by month", () => {
  const monthsOf = async (from: string, to: string, who = editor) =>
    ok<TeamMonths>(
      await send(who, "GET", `/api/feature-teams/months?from=${from}&to=${to}`),
    );

  const rowOf = async (id: string, from: string, to: string, who = editor) =>
    (await monthsOf(from, to, who)).people.find((one) => one.id === id);

  it("sends each month's managers only to those who see Confidential data, since later lines are future reorganizations", async () => {
    const manager = await test.signedIn(personalReader);
    const read = await monthsOf("2026-05", "2026-07", manager);
    expect(read.people.length).toBeGreaterThan(0);
    expect(read.people.every((one) => one.managers === undefined)).toBe(true);
    expect(
      (await monthsOf("2026-05", "2026-07")).people.every(
        (one) => one.managers !== undefined,
      ),
    ).toBe(true);
  });

  it("is refused, saying why, to readers who do not see Personal details", async () => {
    const response = await send(
      planner,
      "GET",
      "/api/feature-teams/months?from=2025-01&to=2025-03",
    );
    expect(response.statusCode).toBe(403);
    expect(refusal(response)).toBe(
      "Feature assignments needs Personal access.",
    );
  });

  it("is given to readers who see Personal details without seeing people", async () => {
    const reader = await test.signedIn(["feature-teams:view", "personal:view"]);
    const response = await send(
      reader,
      "GET",
      "/api/feature-teams/months?from=2025-01&to=2025-03",
    );
    expect(response.statusCode).toBe(200);
  });

  it("lists the months asked for and the live teams, with their colours", async () => {
    const id = await liveTeam();
    const coloured = await send(
      editor,
      "PUT",
      `/api/feature-teams/${id}/colour`,
      { colour: "teal" },
    );
    expect(coloured.statusCode).toBe(204);

    const read = await monthsOf("2025-01", "2025-03");

    expect(read.months).toEqual(["2025-01", "2025-02", "2025-03"]);
    expect(read.teams.find((team) => team.id === id)).toEqual({
      id,
      name: (await liveRow(id))?.name,
      colour: "teal",
    });
  });

  it("reads each month as of its first day", async () => {
    const member = await person();
    const id = await liveTeam({ members: [member], from: "2025-01-15" });

    expect((await rowOf(member, "2025-01", "2025-03"))?.teams).toEqual({
      "2025-02": [id],
      "2025-03": [id],
    });
  });

  it("names each person's manager today, and none for someone without one", async () => {
    const preferredName = unique("Fictional Manager");
    const manager = await person({ preferredName, isManager: true });
    const report = await person({ managerId: manager });
    const top = await person();

    const read = await monthsOf("2025-01", "2025-01");
    const find = (id: string) => read.people.find((one) => one.id === id);

    expect(find(report)?.manager).toEqual({
      id: manager,
      name: preferredName,
    });
    expect(find(top)?.manager).toBeNull();
  });

  describe("for readers who see Personal details", () => {
    it("records viewing them in the access history", async () => {
      const reader = await test.signedIn("workforce-administrator");

      await monthsOf("2025-01", "2025-01", reader);

      expect(await accessRecords("personal-viewed", reader.id)).toHaveLength(1);
    });
  });

  describe("as drafts would make them", () => {
    it("shows a draft's change from the month it reaches, naming its team and draft", async () => {
      const member = await person();
      const id = await liveTeam({ from: "2025-01-15" });
      await changed(id, { add: [member], from: "2025-02-15" });

      const read = await monthsOf("2025-02", "2025-03");
      const row = read.people.find((one) => one.id === member);

      expect(row?.teams).toEqual({});
      expect(row?.drafted).toEqual({ teams: { "2025-03": [id] }, by: [id] });
      expect(read.drafts).toContainEqual({
        teamId: id,
        action: "changed",
        state: "waiting",
      });
    });

    it("takes a team drafted to be removed out of every month", async () => {
      const member = await person();
      const id = await liveTeam({ members: [member], from: "2025-01-15" });
      await ok(await remove(id));

      const read = await monthsOf("2025-02", "2025-03");

      expect(
        read.people.find((one) => one.id === member)?.drafted?.teams,
      ).toEqual({ "2025-02": [], "2025-03": [] });
      expect(read.drafts).toContainEqual({
        teamId: id,
        action: "deleted",
        state: "waiting",
      });
    });

    it("leaves drafts out for readers who do not see people", async () => {
      const member = await person();
      const id = await liveTeam({ from: "2025-01-15" });
      await changed(id, { add: [member], from: "2025-02-15" });

      const read = await monthsOf("2025-02", "2025-03", chartOnly);

      expect(
        read.people.find((one) => one.id === member)?.drafted,
      ).toBeUndefined();
      expect(read.drafts).toEqual([]);
    });

    it("takes effect from today when the draft gives no day", async () => {
      const member = await person();
      const id = await liveTeam();
      await changed(id, { add: [member] });
      const month = monthOf(today);

      expect((await rowOf(member, month, month))?.drafted?.teams).toEqual({
        [month]: [id],
      });
    });

    it("shows unpublished changes only to their maker, marked as theirs", async () => {
      const maker = await test.signedIn("workforce-administrator");
      const member = await person();
      const id = await liveTeam({ from: "2025-01-15" });
      await ok(
        await change(id, { add: [member], from: "2025-02-15" }, maker, {
          publish: false,
        }),
      );

      expect(
        (await monthsOf("2025-03", "2025-03", maker)).drafts.find(
          ({ teamId }) => teamId === id,
        ),
      ).toEqual({
        teamId: id,
        action: "changed",
        state: "waiting",
        unpublished: true,
      });
      expect(
        (await rowOf(member, "2025-03", "2025-03"))?.drafted,
      ).toBeUndefined();
      await ok(await send(maker, "POST", "/api/unpublished/discard"));
    });

    it("leaves out someone in a draft who has since left, as approving does", async () => {
      const member = await person();
      const id = await liveTeam({ from: "2025-01-10" });
      await changed(id, { add: [member], from: "2025-01-15" });
      await endDated(member, "2025-06-30");

      expect(
        (await rowOf(member, "2025-02", "2025-03"))?.drafted,
      ).toBeUndefined();
    });
  });

  it("refuses a range of months the query does not allow", async () => {
    expect(
      (
        await send(
          editor,
          "GET",
          "/api/feature-teams/months?from=2025-03&to=2025-01",
        )
      ).statusCode,
    ).toBe(400);
  });
});
