// SPDX-License-Identifier: Apache-2.0

// Integration tests for undoing changes to feature teams and for their change history, including
// undoing the discard of a removal while a feature names the team.

import { features } from "@fathom/db";
import { type ChangeHistory } from "@fathom/shared";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { builtInChoice } from "./test-app.ts";
import {
  type User,
  test,
  editor,
  datedProposer,
  planner,
  chartOnly,
  startFeatureTeamTests,
  closeFeatureTeamTests,
  unique,
  send,
  ok,
  refusal,
  approved,
  reject,
  person,
  personChanged,
  accessRecords,
  drafted,
  liveTeam,
  changed,
  remove,
  discard,
  resubmit,
  teamSeen,
  moveTeamDates,
} from "./test-feature-teams.ts";

beforeAll(startFeatureTeamTests);

afterAll(closeFeatureTeamTests);

describe("a team a feature names", () => {
  it.each([
    ["names the feature to a role that sees features", ["features:view"], true],
    ["names no feature to a role that can't see features", [], false],
  ] as const)(
    "is not drafted to be removed again by undoing the discard of its removal, and %s",
    async (_case, more, named) => {
      const maker = await test.signedIn([
        "people:view",
        "feature-teams:edit",
        ...more,
      ]);
      const team = await liveTeam();
      await ok(await remove(team, maker));
      const { changeSetId } = await ok<{ changeSetId: string }>(
        await send(maker, "DELETE", `/api/feature-teams/${team}/draft`),
      );
      const feature = unique("Fictional Feature");
      await test.connection.insert(features).values({
        name: feature,
        featureTeamId: team,
        statusId: await builtInChoice(test.connection, "feature-statuses"),
      });
      const undone = await send(maker, "POST", `/api/undo/${changeSetId}`);
      expect(undone.statusCode).toBe(409);
      expect(refusal(undone)).toBe(
        `This feature team is named by ${named ? `the feature ${feature}` : "a feature"}; change that first`,
      );
    },
  );
});

describe("undoing a change to a team", () => {
  const undo = (changeSetId: string | null, who = editor) =>
    send(who, "POST", `/api/undo/${String(changeSetId)}`);

  it("takes out a team its change drafted to add", async () => {
    const { id, changeSetId } = await drafted();
    await ok(await undo(changeSetId));
    expect(await teamSeen(id)).toBeUndefined();
  });

  it("puts back the members a change drafted", async () => {
    const member = await person();
    const joining = await person();
    const id = await liveTeam({ members: [member] });
    const changeSetId = await changed(id, {
      add: [joining],
      remove: [member],
    });

    await ok(await undo(changeSetId));

    expect(await teamSeen(id)).toMatchObject({ members: [member] });
    expect((await teamSeen(id))?.draft).toBeUndefined();
  });

  it("puts back a team its change drafted to remove", async () => {
    const id = await liveTeam();
    const { changeSetId } = await ok<{ changeSetId: string }>(await remove(id));
    await ok(await undo(changeSetId));
    expect((await teamSeen(id))?.draft).toBeUndefined();
  });

  it("is refused once the name it puts back is another team's", async () => {
    // Given a team only drafted to be added, discarded, and its name then taken
    const name = unique("Fictional Feature Team");
    const { id } = await drafted({ name });
    const { changeSetId } = await ok<{ changeSetId: string }>(
      await discard(id),
    );
    await liveTeam({ name: name.toLowerCase() });

    // When the discard is undone
    const response = await undo(changeSetId);

    // Then it is refused, and the team stays gone
    expect(response.statusCode).toBe(409);
    expect(await teamSeen(id)).toBeUndefined();
  });

  it("is refused once a member it puts back is no longer someone the actor may see", async () => {
    const member = await person();
    const maker = await test.signedIn("feature-lead");
    const id = await liveTeam();
    await changed(id, { add: [member] }, maker);
    const { changeSetId } = await ok<{ changeSetId: string }>(
      await discard(id, maker),
    );
    await personChanged(member, { startDate: "2099-01-01" });

    expect((await undo(changeSetId, maker)).statusCode).toBe(409);
  });

  it("is made by a proposer to bring back a discarded draft adding a team", async () => {
    const maker = await test.signedIn("feature-lead");
    const { id } = await drafted({}, maker);
    const { changeSetId } = await ok<{ changeSetId: string }>(
      await discard(id, maker),
    );
    expect(await teamSeen(id)).toBeUndefined();

    await ok(await undo(changeSetId, maker));

    expect((await teamSeen(id, maker))?.draft?.action).toBe("created");
  });

  it("is made by a proposer for a change of members", async () => {
    const member = await person();
    const maker = await test.signedIn("feature-lead");
    const id = await liveTeam({ members: [member] });
    const removed = await changed(id, { remove: [member] }, maker);

    await ok(await undo(removed, maker));

    expect((await teamSeen(id))?.draft).toBeUndefined();
  });

  it("is made by a proposer for a change of members from a later month", async () => {
    const member = await person();
    const maker = datedProposer;
    const id = await liveTeam();
    const added = await changed(
      id,
      { add: [member], from: "2026-08-01" },
      maker,
    );

    await ok(await undo(added, maker));

    expect((await teamSeen(id))?.draft).toBeUndefined();
  });

  it("is made by a proposer for a change of lead from a later month", async () => {
    const member = await person();
    const maker = datedProposer;
    const id = await liveTeam({ members: [member] });
    const led = await changed(
      id,
      { leadId: member, from: "2026-08-01" },
      maker,
    );

    await ok(await undo(led, maker));

    expect((await teamSeen(id))?.draft).toBeUndefined();
  });

  // Any answer that turned on the day would say something of it to someone who may not see it.
  it.each(["2026-03-01", "2026-08-01", "2026-08-15"])(
    "is refused to a proposer who doesn't see the days, putting back any day, %s",
    async (day) => {
      const member = await person({ startDate: "2026-01-01" });
      const maker = await test.signedIn("feature-lead");
      const id = await liveTeam();
      await changed(id, { add: [member], from: day });
      const removed = await changed(id, { remove: [member] }, maker);

      expect((await undo(removed, maker)).statusCode).toBe(403);
    },
  );

  it("records the access history of people whose days it puts back", async () => {
    const member = await person();
    const id = await liveTeam();
    const dated = await changed(id, { add: [member], from: "2025-01-01" });
    const before = await accessRecords("personal-changed", editor.id, member);

    await ok(await undo(dated));

    expect(
      await accessRecords("personal-changed", editor.id, member),
    ).toHaveLength(before.length + 1);
  });

  it("is refused to its maker once they no longer edit feature teams", async () => {
    const maker = await test.signedIn("feature-lead");
    const { changeSetId } = await drafted({}, maker);
    await test.holdOnly(maker.id, ["people:view", "feature-teams:view"]);
    expect((await undo(changeSetId, maker)).statusCode).toBe(403);
  });
});

describe("the change history of a team", () => {
  async function recordOf(changeSetId: string | null, who: User) {
    const { entries } = await ok<ChangeHistory>(
      await send(who, "GET", "/api/changes"),
    );
    return entries
      .find((entry) => entry.id === changeSetId)
      ?.records.find((record) => record.kind === "feature-team");
  }

  const valueOf = (
    record: Awaited<ReturnType<typeof recordOf>>,
    field: string,
  ) => record?.fields.find((one) => one.field === field)?.newValue;

  it("names the team, its members, and its lead", async () => {
    const lead = await person({ preferredName: unique("Fictional Lead") });
    const id = await liveTeam();
    const name = String((await teamSeen(id))?.name);
    const changeSetId = await changed(id, { leadId: lead });
    const leadName = (
      await ok<{ people: { id: string; preferredName: string }[] }>(
        await send(editor, "GET", "/api/people"),
      )
    ).people.find((one) => one.id === lead)?.preferredName;

    const record = await recordOf(changeSetId, planner);

    expect(record?.name).toBe(name);
    expect(valueOf(record, "members")).toEqual([leadName]);
    expect(valueOf(record, "leadId")).toBe(leadName);
  });

  it("hides the days members joined from readers once those days move out of their sight", async () => {
    const holdsDays = async (changeSetId: string | null) =>
      (await recordOf(changeSetId, planner))?.fields.some(
        ({ field }) => field === "memberFrom",
      ) === true;
    // Given
    const member = await person();
    const id = await liveTeam();
    await moveTeamDates("general");
    let changeSetId: string | null;
    try {
      changeSetId = await changed(id, { add: [member], from: "2025-02-03" });
      expect(await holdsDays(changeSetId)).toBe(true);
    } finally {
      // When
      await moveTeamDates("personal");
    }
    // Then
    expect(await holdsDays(changeSetId)).toBe(false);
  });

  it("shows nothing of a draft adding someone who has not started to readers who do not see Personal details", async () => {
    const starting = await person({ startDate: "2099-01-01" });
    const started = await person();
    const id = await liveTeam({ members: [started] });
    const changeSetId = await changed(id, { leadId: starting });

    expect(await recordOf(changeSetId, planner)).toBeUndefined();
    const edited = await recordOf(changeSetId, editor);
    expect(valueOf(edited, "members")).toHaveLength(2);
    expect(valueOf(edited, "leadId")).toEqual(expect.any(String));
  });

  it("keeps a member's change someone sees, with those not started taken out", async () => {
    const starting = await person({ startDate: "2099-01-01" });
    const started = await person();
    const id = await liveTeam();
    const changeSetId = await changed(id, { add: [starting, started] });

    const seen = await recordOf(changeSetId, planner);

    expect(valueOf(seen, "members")).toHaveLength(1);
  });

  it("drops only the lead field when members are also changed, to readers who do not see Personal details", async () => {
    const starting = await person({ startDate: "2099-01-01" });
    const started = await person();
    const id = await liveTeam();
    const changeSetId = await changed(id, {
      leadId: starting,
      add: [started],
    });

    const seen = await recordOf(changeSetId, planner);

    expect(seen?.fields.map(({ field }) => field)).toEqual(["members"]);
  });

  it("hides a resubmission of a draft that only adds someone who has not started, whose rejection was recorded as Personal, and a change clearing it", async () => {
    const starting = await person({ startDate: "2099-01-01" });
    const id = await liveTeam();
    await changed(id, { add: [starting] });
    await ok(await reject(id));

    const resent = (await ok<{ changeSetId: string }>(await resubmit(id)))
      .changeSetId;

    expect(await recordOf(resent, planner)).toBeUndefined();
  });

  it("shows nothing of a change adding only someone not started, with the rejection it clears, to readers who do not see Personal details", async () => {
    // Given a rejected draft of someone everyone sees
    const member = await person();
    const starting = await person({ startDate: "2099-01-01" });
    const id = await liveTeam();
    await changed(id, { add: [member] });
    await ok(await reject(id));

    // When someone not started is added too, clearing the rejection
    const adding = await changed(id, { add: [starting] });

    // Then those who do not see Personal details see nothing of that change
    expect(await recordOf(adding, planner)).toBeUndefined();
    expect(await recordOf(adding, editor)).toBeDefined();
  });

  it("shows a reader who does not see people only approved changes", async () => {
    const member = await person();
    const name = unique("Fictional Feature Team");
    const { id, changeSetId } = await drafted({
      name,
      members: [member],
      from: "2025-01-01",
    });

    expect(await recordOf(changeSetId, chartOnly)).toBeUndefined();
    await approved(id);
    const { entries } = await ok<ChangeHistory>(
      await send(chartOnly, "GET", "/api/changes"),
    );
    const record = entries
      .flatMap((entry) => entry.records)
      .find((one) => one.name === name);
    expect(record).toBeDefined();
    expect(record?.draft).toBe(false);
  });

  it("names nobody who has not started to a reader who sees feature teams but not People", async () => {
    const preferredName = unique("Fictional Starter");
    const starting = await person({ preferredName, startDate: "2099-01-01" });
    const id = await liveTeam();
    const changeSetId = await changed(id, { leadId: starting });
    const reader = await test.signedIn("product-manager");

    const seen = await recordOf(changeSetId, reader);

    expect(JSON.stringify(seen ?? null)).not.toContain(preferredName);
  });

  it("labels a team with its approved name, not a name only drafted, for a reader who does not see people", async () => {
    const name = unique("Fictional Feature Team");
    const id = await liveTeam({ name });
    const renamed = unique("Fictional Renamed Team");
    await changed(id, { name: renamed });

    const { entries } = await ok<ChangeHistory>(
      await send(chartOnly, "GET", "/api/changes"),
    );
    const names = entries
      .flatMap((entry) => entry.records)
      .map((record) => record.name);

    expect(names).toContain(name);
    expect(names).not.toContain(renamed);
  });

  it("is seen with the org chart", async () => {
    const { changeSetId } = await drafted();
    const reader = await test.signedIn(["plan:view"]);
    expect(await recordOf(changeSetId, reader)).toBeUndefined();
    expect(await recordOf(changeSetId, planner)).toBeDefined();
  });
});
