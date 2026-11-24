// SPDX-License-Identifier: Apache-2.0

// Integration tests for removing feature teams, and for refusing to remove people who lead a team or
// are named in a team's draft.

import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { errorOf, ok } from "./test-app.ts";
import {
  test,
  editor,
  approver,
  planner,
  startFeatureTeamTests,
  closeFeatureTeamTests,
  send,
  approved,
  person,
  drafted,
  liveTeam,
  changed,
  remove,
  teamSeen,
  liveRow,
  memberships,
  leads,
} from "./test-feature-teams.ts";

beforeAll(startFeatureTeamTests);

afterAll(closeFeatureTeamTests);

describe("removing a feature team", () => {
  it("drafts its removal, which approving makes", async () => {
    const member = await person();
    const id = await liveTeam({ members: [member] });

    await ok(await remove(id));
    expect((await teamSeen(id))?.draft?.action).toBe("deleted");
    await approved(id);

    expect(await teamSeen(id)).toBeUndefined();
    expect(await liveRow(id)).toBeUndefined();
    expect(await memberships(id)).toEqual([]);
  });

  it("is refused to those who see feature teams without editing them", async () => {
    const id = await liveTeam();
    expect((await remove(id, planner)).statusCode).toBe(403);
  });

  it("discards the draft of a team only drafted to be added", async () => {
    const { id } = await drafted();
    const { changeSetId } = await ok<{ changeSetId: string }>(await remove(id));
    expect(changeSetId).toEqual(expect.any(String));
    expect(await teamSeen(id)).toBeUndefined();
  });

  it("changes nothing for a team already drafted to be removed", async () => {
    const id = await liveTeam();
    await ok(await remove(id));
    expect(
      (await ok<{ changeSetId: string | null }>(await remove(id))).changeSetId,
    ).toBeNull();
  });

  it("answers a team that does not exist as not found", async () => {
    expect((await remove(randomUUID())).statusCode).toBe(404);
  });
});

describe("a person named in a team's draft", () => {
  it("cannot be removed from People while a draft names them as a member", async () => {
    const member = await person();
    await drafted({ members: [member] });

    const response = await send(editor, "DELETE", `/api/people/${member}`);

    expect(response.statusCode).toBe(409);
    expect(errorOf(response)).toBe(
      "This person is in a feature team's draft; take them out of it or discard it first",
    );
  });

  it("cannot be removed while another user's unpublished draft names them as a member", async () => {
    const member = await person();
    const other = await test.signedIn("workforce-administrator");
    await drafted({ members: [member] }, other, { publish: false });

    expect(
      (await send(editor, "DELETE", `/api/people/${member}`)).statusCode,
    ).toBe(409);
    await ok(await send(other, "POST", "/api/unpublished/discard"));
  });

  it("cannot be removed by approving a removal drafted before a draft named them", async () => {
    const member = await person();
    await ok(await send(editor, "DELETE", `/api/people/${member}`));
    await drafted({ members: [member] });

    const response = await send(approver, "POST", "/api/drafts/approval", {
      people: [member],
    });

    expect(response.statusCode).toBe(409);
  });
});

describe("a team's lead", () => {
  it("cannot be removed from People while they lead a team, live or in a draft", async () => {
    const live = await person();
    await liveTeam({ leadId: live });
    const inDraft = await person();
    await drafted({ leadId: inDraft });

    for (const id of [live, inDraft]) {
      const response = await send(editor, "DELETE", `/api/people/${id}`);
      expect(response.statusCode).toBe(409);
      expect(errorOf(response)).toBe(
        "This person leads a feature team; choose another lead first",
      );
    }
  });

  it("cannot be removed from People while another user's unpublished draft makes them a lead", async () => {
    const lead = await person();
    const other = await test.signedIn("workforce-administrator");
    await drafted({ leadId: lead }, other, { publish: false });

    expect(
      (await send(editor, "DELETE", `/api/people/${lead}`)).statusCode,
    ).toBe(409);
    await ok(await send(other, "POST", "/api/unpublished/discard"));
  });

  it("cannot be removed by approving a removal drafted before they led a team", async () => {
    const lead = await person();
    await ok(await send(editor, "DELETE", `/api/people/${lead}`));
    await liveTeam({ leadId: lead });

    const response = await send(approver, "POST", "/api/drafts/approval", {
      people: [lead],
    });

    expect(response.statusCode).toBe(409);
  });

  it("can be removed once they lead no team", async () => {
    const lead = await person();
    const id = await liveTeam({ leadId: lead });
    await changed(id, { remove: [lead] });
    await approved(id);
    expect(
      (await send(editor, "DELETE", `/api/people/${lead}`)).statusCode,
    ).toBe(200);
  });

  it("cannot be removed from People while planned to lead a team later", async () => {
    const member = await person();
    const planned = await person();
    const id = await liveTeam({ members: [member, planned] });
    await changed(id, { leadId: planned, from: "2099-03-01" });
    await approved(id);

    const response = await send(editor, "DELETE", `/api/people/${planned}`);

    expect(response.statusCode).toBe(409);
  });

  it("can be removed having led a team only in the past", async () => {
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

    expect(await leads(id)).toEqual([
      { leadId: null, fromDate: "2025-01-01" },
      { leadId: next, fromDate: "2025-06-01" },
    ]);
  });
});
