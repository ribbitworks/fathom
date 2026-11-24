// SPDX-License-Identifier: Apache-2.0

// Integration tests for approving and rejecting drafts of people, against a PostgreSQL server of
// their own, and the history of who changed what.

import { drafts, recordChanges } from "@fathom/db";
import {
  type Field,
  type List,
  type Permission,
  type Role,
} from "@fathom/shared";
import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { generalApprover, testPosition } from "./test-app.ts";
import {
  test,
  editor,
  approver,
  unique,
  send,
  saved,
  columnWith,
  draftPerson,
  approve,
  reject,
  livePerson,
  seen,
  live,
  draftRow,
  entry,
  undo,
  startDraftTests,
  closeDraftTests,
} from "./test-drafts.ts";

beforeAll(startDraftTests);

afterAll(closeDraftTests);

describe("approving and rejecting", () => {
  it("applies drafts that add, change, and remove people to the live people, in one change set", async () => {
    const { choices, field } = await columnWith(["North", "South"]);
    const [north = "", south = ""] = choices.map(({ id }) => id);
    const added = await draftPerson({
      startDate: "2022-02-02",
      values: { [field.id]: [north] },
    });
    const changed = await livePerson({ values: { [field.id]: [north] } });
    await saved("PATCH", `/api/people/${changed.id}`, {
      preferredName: "Fictional Approved",
      values: { [field.id]: [south] },
    });
    const cleared = await livePerson({ values: { [field.id]: [north] } });
    await saved("PATCH", `/api/people/${cleared.id}`, {
      values: { [field.id]: [] },
    });
    const removed = await livePerson();
    await saved("DELETE", `/api/people/${removed.id}`);

    const ids = [added.id, changed.id, cleared.id, removed.id];
    const response = await approve(ids);
    expect(response.statusCode).toBe(200);
    const { changeSetId } = response.json<{ changeSetId: string }>();
    expect((await live(added.id))?.startDate).toBe("2022-02-02");
    expect((await live(changed.id))?.preferredName).toBe("Fictional Approved");
    expect(await live(removed.id)).toBeUndefined();
    expect(await seen(editor.cookie, changed.id)).toMatchObject({
      values: { [field.id]: [south] },
    });
    expect((await seen(editor.cookie, cleared.id))?.values).toEqual({});
    for (const id of ids) expect(await draftRow(id)).toBeUndefined();
    const approved = await entry(editor.cookie, changeSetId);
    expect(approved?.kind).toBe("approval");
    expect(approved?.madeBy).toBe("Fictional User 2");
    expect(
      approved?.records.map(({ action, draft }) => [action, draft]),
    ).toEqual([
      ["created", false],
      ["changed", false],
      ["changed", false],
      ["deleted", false],
    ]);
    // Approving cannot be undone, even by the Approver.
    const undone = await undo(changeSetId, approver.cookie);
    expect(undone.statusCode).toBe(409);
  });

  it("marks a draft shown only in part for an Approver who can't decide it, and no one else", async () => {
    // Given a change of a name the role sees and of an end date it doesn't
    const partly = await livePerson({ startDate: "2020-01-01" });
    await saved("PATCH", `/api/people/${partly.id}`, {
      preferredName: unique("Fictional"),
      endDate: "2032-01-01",
    });
    const markOf = async (held: Permission[]) =>
      (await seen((await test.signedIn(held)).cookie, partly.id))?.draft
        ?.holdsUnseen;

    // Then an Approver who can't see the end date is told another must decide it
    expect(await markOf(["people:approve", "people:view"])).toBe(true);
    // And neither one who doesn't approve people nor one who sees it all is
    expect(await markOf(["people:view"])).toBeUndefined();
    expect(
      await markOf(["people:approve", "people:view", "personal:view"]),
    ).toBeUndefined();
  });

  it("lets only Approvers who see every value in the drafts approve or reject them", async () => {
    const person = await livePerson({ startDate: "2020-01-01" });
    await saved("PATCH", `/api/people/${person.id}`, { endDate: "2032-01-01" });
    // Refused without approving or seeing people, and, to those not shown the draft, answered as no
    // draft at all, so asking reveals nothing.
    const roles: [Role | Permission[], number][] = [
      ["workforce-administrator", 403],
      [generalApprover, 404],
      [["people:approve", "people:view"], 404],
    ];
    for (const [held, status] of roles) {
      const { cookie } = await test.signedIn(held);
      expect(
        (await approve([person.id], cookie)).statusCode,
        String(held),
      ).toBe(status);
      expect(
        (await reject([person.id], "Fictional", cookie)).statusCode,
        String(held),
      ).toBe(status);
    }
    // A draft shown only in part is refused.
    const partly = await livePerson({ startDate: "2020-01-01" });
    await saved("PATCH", `/api/people/${partly.id}`, {
      preferredName: unique("Fictional"),
      endDate: "2032-01-01",
    });
    const planner = await test.signedIn(["people:approve", "people:view"]);
    const refused = await approve([partly.id], planner.cookie);
    expect(refused.statusCode).toBe(403);
    expect(refused.json()).toEqual({
      error:
        "One of these drafts holds details this role can't see, so an Approver who sees them must decide it",
    });
    // Neither a former employee's draft of General details nor a future starter's is decided by one
    // who sees only people current today.
    const former = await livePerson({
      startDate: "2010-01-01",
      endDate: "2011-01-01",
    });
    await saved("PATCH", `/api/people/${former.id}`, {
      preferredName: unique("Fictional"),
    });
    expect((await approve([former.id], planner.cookie)).statusCode).toBe(404);
    expect((await approve([former.id])).statusCode).toBe(200);
    const starter = await livePerson({ startDate: "2099-01-01" });
    await saved("PATCH", `/api/people/${starter.id}`, {
      preferredName: unique("Fictional"),
    });
    expect((await approve([starter.id], planner.cookie)).statusCode).toBe(404);
    expect((await approve([starter.id])).statusCode).toBe(200);
    // Someone only drafted to be added is current as their draft says.
    const added = await draftPerson();
    expect((await approve([added.id], planner.cookie)).statusCode).toBe(200);
    expect((await approve([partly.id])).statusCode).toBe(200);
    const manager = await test.signedIn([
      "people:approve",
      "people:view",
      "personal:view",
    ]);
    expect((await approve([person.id], manager.cookie)).statusCode).toBe(200);
  });

  describe("drafts the approver changed", () => {
    const maker = [
      "people:approve",
      "configuration:approve",
      "people:edit",
      "personal:edit",
      "confidential:edit",
      "configuration:edit",
    ] as const;
    const refusal = {
      error: "Drafts changed by the approver need another approver",
    };

    async function draftedBy(cookie: string): Promise<string> {
      const response = await send(cookie, "POST", "/api/people", {
        people: [
          {
            preferredName: unique("Fictional Own"),
            employeeId: unique("E"),
            positionId: testPosition,
          },
        ],
      });
      expect(response.statusCode, response.body).toBe(201);
      return response.json<{ ids: string[] }>().ids[0] ?? "";
    }

    const needsOther = async (cookie: string, id: string) =>
      (await send(cookie, "GET", "/api/people"))
        .json<{
          people: { id: string; draft?: { needsOtherApprover?: boolean } }[];
        }>()
        .people.find((one) => one.id === id)?.draft?.needsOtherApprover;

    it("are not approved by the approver, who may still reject them", async () => {
      const own = await test.signedIn([...maker]);
      const id = await draftedBy(own.cookie);
      expect(await needsOther(own.cookie, id)).toBe(true);
      expect(await needsOther(approver.cookie, id)).toBeUndefined();
      const refused = await approve([id], own.cookie);
      expect(refused.statusCode).toBe(403);
      expect(refused.json()).toEqual(refusal);
      expect(await draftRow(id)).toBeDefined();
      expect(
        (await reject([id], "Fictional reason", own.cookie)).statusCode,
      ).toBe(200);
    });

    it("count as the approver's when they changed someone else's draft", async () => {
      const own = await test.signedIn([...maker]);
      const person = await livePerson();
      await saved("PATCH", `/api/people/${person.id}`, {
        preferredName: unique("Fictional"),
      });
      const changed = await send(
        own.cookie,
        "PATCH",
        `/api/people/${person.id}`,
        {
          preferredName: unique("Fictional"),
        },
      );
      expect(changed.statusCode, changed.body).toBe(200);
      expect((await approve([person.id], own.cookie)).json()).toEqual(refusal);
      expect((await approve([person.id])).statusCode).toBe(200);
    });

    it("are the approver's only until approved, so a later draft by others is theirs to approve", async () => {
      const own = await test.signedIn([...maker]);
      const id = await draftedBy(own.cookie);
      expect((await approve([id])).statusCode).toBe(200);
      await saved("PATCH", `/api/people/${id}`, {
        preferredName: unique("Fictional"),
      });
      expect(await needsOther(own.cookie, id)).toBeUndefined();
      expect((await approve([id], own.cookie)).statusCode).toBe(200);
    });

    it("include drafts of other kinds, and those an approval takes with the drafts chosen", async () => {
      const own = await test.signedIn([...maker]);
      const list = (
        await send(own.cookie, "POST", "/api/lists", {
          name: unique("Fictional List"),
          visibility: "general",
        })
      ).json<{ list: List }>().list;
      const refused = await send(own.cookie, "POST", "/api/drafts/approval", {
        lists: [list.id],
      });
      expect(refused.json()).toEqual(refusal);
      const field = (
        await send(editor.cookie, "POST", "/api/people/columns", {
          name: unique("Fictional Column"),
          listId: list.id,
          multiple: true,
        })
      ).json<{ field: Field }>().field;
      // Approving the column approves the new list it draws on, which this approver drafted.
      const taken = await send(own.cookie, "POST", "/api/drafts/approval", {
        columns: [field.id],
      });
      expect(taken.json()).toEqual(refusal);
      expect(
        (
          await send(approver.cookie, "POST", "/api/drafts/approval", {
            columns: [field.id],
          })
        ).statusCode,
      ).toBe(200);
    });

    it("stop counting once discarded, but not once rejected or resubmitted", async () => {
      const own = await test.signedIn([...maker]);
      const discarded = await livePerson();
      await send(own.cookie, "PATCH", `/api/people/${discarded.id}`, {
        preferredName: unique("Fictional"),
      });
      const gone = await send(
        own.cookie,
        "DELETE",
        `/api/people/${discarded.id}/draft`,
      );
      expect(gone.statusCode, gone.body).toBe(200);
      await saved("PATCH", `/api/people/${discarded.id}`, {
        preferredName: unique("Fictional"),
      });
      expect((await approve([discarded.id], own.cookie)).statusCode).toBe(200);

      const rejected = await livePerson();
      await send(own.cookie, "PATCH", `/api/people/${rejected.id}`, {
        preferredName: unique("Fictional"),
      });
      expect(
        (await reject([rejected.id], "Fictional reason", own.cookie))
          .statusCode,
      ).toBe(200);
      const resent = await send(
        own.cookie,
        "DELETE",
        `/api/people/${rejected.id}/draft/rejection`,
      );
      expect(resent.statusCode, resent.body).toBe(200);
      expect((await approve([rejected.id], own.cookie)).json()).toEqual(
        refusal,
      );
    });

    it("do not block deciding other drafts that touch the same people", async () => {
      const own = await test.signedIn([...maker]);
      const { choices, field } = await columnWith(["North"]);
      const person = await livePerson({
        values: { [field.id]: [choices[0]?.id ?? ""] },
      });
      await send(own.cookie, "PATCH", `/api/people/${person.id}`, {
        preferredName: unique("Fictional"),
      });
      const removal = await send(
        editor.cookie,
        "DELETE",
        `/api/people/columns/${field.id}`,
      );
      expect(removal.statusCode, removal.body).toBe(200);
      const decided = await send(own.cookie, "POST", "/api/drafts/approval", {
        columns: [field.id],
      });
      expect(decided.statusCode, decided.body).toBe(200);
      expect(await draftRow(person.id)).toBeDefined();
    });

    it("are approved by an approver whose role lets them approve their own", async () => {
      const own = await test.signedIn([...maker, "drafts:approve-own"]);
      const id = await draftedBy(own.cookie);
      expect(await needsOther(own.cookie, id)).toBeUndefined();
      expect((await approve([id], own.cookie)).statusCode).toBe(200);
    });
  });

  it("refuses drafts that are gone, rejected, or no longer fit", async () => {
    const missing = await approve([randomUUID()]);
    expect(missing.statusCode).toBe(404);
    expect((await reject([randomUUID()], "Fictional")).statusCode).toBe(404);

    const person = await draftPerson();
    expect((await reject([person.id], "Fictional reason")).statusCode).toBe(
      200,
    );
    // A rejected draft is back with its makers, so is approved only once sent again.
    const rejected = await approve([person.id]);
    expect(rejected.statusCode).toBe(409);
    expect(rejected.json()).toEqual({
      error:
        "One of these drafts, or one it depends on, was rejected; it can be approved once that draft is resubmitted",
    });
    await send(
      editor.cookie,
      "DELETE",
      `/api/people/${person.id}/draft/rejection`,
    );
    expect((await approve([person.id])).statusCode).toBe(200);
    expect(await draftRow(person.id)).toBeUndefined();
    expect(await live(person.id)).toBeDefined();

    // Drafts written by another version of Fathom, which the database or columns refuse.
    const employeeId = unique("E-Clash");
    await livePerson({ employeeId });
    const clash = randomUUID();
    const stray = randomUUID();
    const { field } = await columnWith(["A"]);
    const elsewhere = await columnWith(["B"]);
    await test.connection.insert(drafts).values([
      {
        recordType: "person",
        recordId: clash,
        action: "created",
        fields: {
          preferredName: "Fictional Clash",
          employeeId,
          positionId: testPosition,
        },
      },
      {
        recordType: "person",
        recordId: stray,
        action: "created",
        fields: {
          preferredName: "Fictional Stray",
          employeeId: unique("E"),
          positionId: testPosition,
          [`value:${field.id}`]: [String(elsewhere.choices[0]?.id)],
        },
      },
    ]);
    const clashed = await approve([clash]);
    expect(clashed.statusCode).toBe(409);
    expect(clashed.json()).toEqual({
      error:
        "A draft no longer fits the data as it is; refresh, change it, then approve it",
    });
    const strayed = await approve([stray]);
    expect(strayed.json()).toEqual({
      error:
        "The draft of Fictional Stray no longer fits the columns; change it, then approve it",
    });
    await saved("DELETE", `/api/people/${clash}/draft`);
    await saved("DELETE", `/api/people/${stray}/draft`);
  });

  it("keeps rejected drafts with their reason, until they are changed again", async () => {
    const first = await livePerson();
    const second = await draftPerson();
    await saved("PATCH", `/api/people/${first.id}`, {
      preferredName: unique("Fictional Renamed"),
    });
    const response = await reject([first.id, second.id], "Fictional reason");
    expect(response.statusCode).toBe(200);
    const { changeSetId } = response.json<{ changeSetId: string }>();
    expect(await draftRow(first.id)).toMatchObject({
      state: "rejected",
      reason: "Fictional reason",
    });
    const rejection = await entry(editor.cookie, changeSetId);
    expect(rejection).toMatchObject({
      kind: "rejection",
      records: [
        {
          draft: true,
          fields: [
            {
              field: "rejected",
              oldValue: null,
              newValue: "Fictional reason",
            },
          ],
        },
        { draft: true },
      ],
    });
    expect((await undo(changeSetId, approver.cookie)).statusCode).toBe(409);
    // Rejecting again for the same reason changes nothing; for another, the reason changes.
    expect(
      (await reject([first.id], "Fictional reason")).json<{
        changeSetId: string | null;
      }>().changeSetId,
    ).toBeNull();
    await reject([first.id], "Another fictional reason");
    // Changing a rejected draft makes it wait again once published; undoing the change before
    // then leaves it rejected, as it was.
    const unpublished = { publish: false };
    const changed = await test.request(
      editor.cookie,
      "PATCH",
      `/api/people/${first.id}`,
      { preferredName: unique("Fictional Again") },
      unpublished,
    );
    expect(await draftRow(first.id)).toMatchObject({
      state: "rejected",
      reason: "Another fictional reason",
    });
    expect(
      (
        await test.request(
          editor.cookie,
          "POST",
          `/api/undo/${changed.json<{ changeSetId: string }>().changeSetId}`,
          undefined,
          unpublished,
        )
      ).statusCode,
    ).toBe(200);
    expect(
      (await send(editor.cookie, "GET", "/api/unpublished")).json<{
        changes: unknown[];
      }>().changes,
    ).toEqual([]);
    // Removing one waits again once published.
    await saved("DELETE", `/api/people/${first.id}`);
    expect((await draftRow(first.id))?.state).toBe("waiting");
    await saved("DELETE", `/api/people/${second.id}/draft`);
    expect(await draftRow(second.id)).toBeUndefined();
  });

  it("sends a rejected draft for approval again unchanged, which can be undone", async () => {
    const person = await livePerson();
    const name = unique("Fictional Resent");
    await saved("PATCH", `/api/people/${person.id}`, { preferredName: name });
    const waiting = await send(
      editor.cookie,
      "DELETE",
      `/api/people/${person.id}/draft/rejection`,
    );
    expect(waiting.statusCode).toBe(409);
    expect(waiting.json()).toEqual({
      error: "Only a rejected draft can be resubmitted",
    });
    await reject([person.id], "Fictional reason");
    const resent = await saved(
      "DELETE",
      `/api/people/${person.id}/draft/rejection`,
    );
    expect(await draftRow(person.id)).toMatchObject({
      state: "waiting",
      reason: null,
      fields: { preferredName: name },
    });
    expect(await entry(editor.cookie, resent)).toMatchObject({
      kind: "resubmission",
      records: [{ draft: true, fields: [] }],
    });
    expect((await undo(resent)).statusCode).toBe(200);
    expect(await draftRow(person.id)).toMatchObject({
      state: "rejected",
      reason: "Fictional reason",
    });
    const unknown = await send(
      editor.cookie,
      "DELETE",
      `/api/people/${randomUUID()}/draft/rejection`,
    );
    expect(unknown.statusCode).toBe(404);
    await saved("DELETE", `/api/people/${person.id}/draft`);
  });

  it("refuses a reason that is empty or too long", async () => {
    const person = await draftPerson();
    for (const reason of [" ", "x".repeat(501)]) {
      expect((await reject([person.id], reason)).statusCode).toBe(400);
    }
  });
});

describe("drafts and the history of who changed what", () => {
  it("records draft changes with the change set that made them", async () => {
    const changeSetId = await test.connection.transaction((transaction) =>
      recordChanges(transaction, null, [
        {
          recordType: "person",
          recordId: randomUUID(),
          action: "created",
          field: "preferredName",
          tier: "general",
          oldValue: null,
          newValue: "Fictional Drafted",
          draft: true,
        },
      ]),
    );
    expect(await entry(editor.cookie, changeSetId)).toMatchObject({
      kind: "edit",
      madeBy: null,
      records: [{ draft: true, name: "Fictional Drafted" }],
    });
  });
});
