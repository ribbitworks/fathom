// SPDX-License-Identifier: Apache-2.0

// Integration tests for private changes to records that go away, against a PostgreSQL server of
// their own: each is discarded as its maker's own withdrawal, seen only by them, whether an
// approval or a publish takes the record away.

import {
  accessHistory,
  allocations,
  features,
  privateChanges,
} from "@fathom/db";
import { type Choice, type List, monthOf } from "@fathom/shared";
import { and, count, eq } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { randomUUID } from "node:crypto";
import { readToday } from "./data/settings.ts";
import {
  builtInChoice,
  generalReader,
  testPosition,
  unique,
} from "./test-app.ts";
import {
  test,
  alice,
  bob,
  approver,
  type User,
  user,
  saved,
  changeSetOf,
  unpublished,
  publish,
  discard,
  history,
  undo,
  decide,
  draftPeople,
  livePeople,
  liveList,
  startUnpublishedTests,
  closeUnpublishedTests,
} from "./test-unpublished.ts";

beforeAll(startUnpublishedTests);

afterAll(closeUnpublishedTests);

const rowsOf = (who: User, recordId: string) =>
  test.connection
    .select()
    .from(privateChanges)
    .where(
      and(
        eq(privateChanges.userId, who.id),
        eq(privateChanges.recordId, recordId),
      ),
    );

// The maker's latest withdrawal as records went, which their history shows as drafts discarded.
const withdrawal = async (who: User) =>
  (await history(who)).find(
    ({ kind, madeBy }) => kind === "discard" && madeBy === who.name,
  );

const personalChanges = async (who: User, subjectId: string) =>
  (
    await test.connection
      .select({ total: count() })
      .from(accessHistory)
      .where(
        and(
          eq(accessHistory.actorId, who.id),
          eq(accessHistory.action, "personal-changed"),
          eq(accessHistory.subjectId, subjectId),
        ),
      )
  )[0]?.total;

describe("everyone's private changes to a record an approval removes", () => {
  it("are discarded as a withdrawal of their own fields, with its access history", async () => {
    // Given Bob's private changes to a person a published draft removes, a person a published draft
    // changes, a person no draft touches, and a person only he adds
    const [removed = "", changed = "", untouched = ""] = await livePeople(3);
    const changedName = unique("Fictional Staying");
    const untouchedName = unique("Fictional Unrelated");
    const ownName = unique("Fictional Own");
    const edit = await changeSetOf(bob, "PATCH", `/api/people/${removed}`, {
      preferredName: unique("Fictional Leaving"),
      endDate: "2031-06-30",
    });
    await saved(bob, "PATCH", `/api/people/${changed}`, {
      preferredName: changedName,
    });
    await saved(bob, "PATCH", `/api/people/${untouched}`, {
      preferredName: untouchedName,
    });
    await draftPeople(bob, [ownName]);
    await saved(alice, "DELETE", `/api/people/${removed}`);
    await saved(alice, "PATCH", `/api/people/${changed}`, {
      preferredName: unique("Fictional Published"),
    });
    await publish(alice);
    const personalBefore = await personalChanges(bob, removed);

    // When the Approver approves both drafts
    const response = await decide("approval", { people: [removed, changed] });

    // Then only Bob's changes to the person removed are discarded, as his own withdrawal of the
    // fields he changed, made as the role he changed them as
    expect(response.statusCode, response.body).toBe(200);
    expect(await rowsOf(bob, removed)).toEqual([]);
    expect(
      new Set((await unpublished(bob)).map(({ subject }) => subject)),
    ).toEqual(new Set([changedName, untouchedName, ownName]));
    const withdrawn = await withdrawal(bob);
    expect(
      withdrawn?.records.map(({ action, draft, fields }) => ({
        action,
        draft,
        fields: fields.map(({ field }) => field).sort(),
      })),
    ).toEqual([
      { action: "changed", draft: true, fields: ["endDate", "preferredName"] },
    ]);
    const made = (await history(bob)).find(({ id }) => id === edit);
    expect(withdrawn?.madeAs).toBe(made?.madeAs);
    expect(await personalChanges(bob, removed)).toBe(
      Number(personalBefore) + 1,
    );
    expect(await discard(bob)).toBe(3);
  });

  it("are seen in no one else's change history", async () => {
    // Given Bob's private change to a person whose removal is approved
    const [removed = ""] = await livePeople(1);
    await saved(bob, "PATCH", `/api/people/${removed}`, {
      preferredName: unique("Fictional Leaving"),
    });
    await saved(alice, "DELETE", `/api/people/${removed}`);
    await publish(alice);
    expect((await decide("approval", { people: [removed] })).statusCode).toBe(
      200,
    );

    // When the others read the change history
    const changeSetId = (await withdrawal(bob))?.id;

    // Then neither sees his withdrawal
    for (const other of [alice, approver]) {
      expect((await history(other)).map(({ id }) => id)).not.toContain(
        changeSetId,
      );
    }
  });

  it("are discarded for a list's choices and order, which go with the list, and no one else's", async () => {
    // Given Alice's published drafts removing a list and another list's choice, Bob's private
    // changes, made before, to a choice and the order of the list and to the choice, and Alice's
    // private change to a third list's choice
    const { list, choices } = await liveList(["Kept", "Other"]);
    const [kept, other] = choices as [Choice, Choice];
    const { list: second, choices: secondChoices } = await liveList([
      "Leaving",
      "Staying",
    ]);
    const [leaving] = secondChoices as [Choice];
    const { list: third, choices: thirdChoices } = await liveList(["Third"]);
    const [thirdChoice] = thirdChoices as [Choice];
    await saved(alice, "DELETE", `/api/lists/${list.id}`);
    await saved(
      alice,
      "DELETE",
      `/api/lists/${second.id}/choices/${leaving.id}`,
    );
    await saved(bob, "PUT", `/api/lists/${list.id}/choices/${kept.id}`, {
      label: unique("Fictional Kept"),
    });
    await saved(
      bob,
      "PUT",
      `/api/lists/${list.id}/choices/${other.id}/position`,
      { after: null },
    );
    await saved(bob, "PUT", `/api/lists/${second.id}/choices/${leaving.id}`, {
      label: unique("Fictional Leaving"),
    });
    await publish(alice);
    await saved(
      alice,
      "PUT",
      `/api/lists/${third.id}/choices/${thirdChoice.id}`,
      {
        label: unique("Fictional Third"),
      },
    );

    // When the Approver approves the list's removal and the choice's
    const response = await decide("approval", {
      lists: [list.id],
      choices: [leaving.id],
    });

    // Then each of Bob's changes is withdrawn, and Alice's change is kept
    expect(response.statusCode, response.body).toBe(200);
    expect(await unpublished(bob)).toEqual([]);
    expect(
      (await withdrawal(bob))?.records.map(({ kind }) => kind).sort(),
    ).toEqual(["choice-order", "list-item", "list-item"]);
    expect(await discard(alice)).toBe(1);
  });
  it("are discarded for an allocation of a person removed", async () => {
    // Given a planner's private change to a live allocation of a person a published draft removes
    const planner = await user([...generalReader, "personal:view"]);
    const [removed = ""] = await livePeople(1);
    const featureId = randomUUID();
    await test.connection.insert(features).values({
      id: featureId,
      name: unique("Fictional Feature"),
      statusId: await builtInChoice(
        test.connection,
        "feature-statuses",
        "in-progress",
      ),
    });
    const month = monthOf(await readToday(test.connection));
    const [allocation] = await test.connection
      .insert(allocations)
      .values({ personId: removed, featureId, months: { [month]: 50 } })
      .returning({ id: allocations.id });
    const allocationId = String(allocation?.id);
    await saved(planner, "POST", "/api/allocations/changes", {
      personId: removed,
      featureId,
      percentage: 25,
      from: month,
    });
    expect(await rowsOf(planner, allocationId)).not.toEqual([]);
    await saved(alice, "DELETE", `/api/people/${removed}`);
    await publish(alice);

    // When the Approver approves the removal
    const response = await decide("approval", { people: [removed] });

    // Then the planner's change goes with the allocation, as their withdrawal
    expect(response.statusCode, response.body).toBe(200);
    expect(await rowsOf(planner, allocationId)).toEqual([]);
    expect(
      (await withdrawal(planner))?.records.map(({ kind }) => kind),
    ).toContain("allocation");
  });
});

describe("everyone's private changes to a record whose added draft goes", () => {
  it("are discarded when the discard of the draft is published, withdrawing only their own fields", async () => {
    // Given Bob's private change to a person a published draft adds
    const [added = ""] = await draftPeople(alice, ["Fictional Arrival"]);
    await publish(alice);
    await saved(bob, "PATCH", `/api/people/${added}`, {
      preferredName: unique("Fictional Renamed Arrival"),
    });

    // When Alice discards the draft and publishes the discard
    await saved(alice, "DELETE", `/api/people/${added}/draft`);
    await publish(alice);

    // Then Bob's change is withdrawn, as a change of the name he gave back to the one added
    expect(await rowsOf(bob, added)).toEqual([]);
    expect(await unpublished(bob)).toEqual([]);
    expect(
      (await withdrawal(bob))?.records.map(({ action, fields }) => ({
        action,
        fields: fields.map(({ field }) => field),
      })),
    ).toEqual([{ action: "changed", fields: ["preferredName"] }]);
  });

  it("leave none of the publisher's own changes to the choices and order of a list whose added draft they discard", async () => {
    // Given Alice's published list, added with two choices, and her own private changes to a choice
    // and the order
    const list = (
      await saved<{ list: List }>(alice, "POST", "/api/lists", {
        name: unique("Fictional Added List"),
      })
    ).list;
    const [first, second] = (
      await saved<{ choices: Choice[] }>(
        alice,
        "POST",
        `/api/lists/${list.id}/choices`,
        { choices: [{ label: "First" }, { label: "Second" }] },
      )
    ).choices as [Choice, Choice];
    await publish(alice);
    await saved(alice, "PUT", `/api/lists/${list.id}/choices/${first.id}`, {
      label: unique("Fictional First"),
    });
    await saved(
      alice,
      "PUT",
      `/api/lists/${list.id}/choices/${second.id}/position`,
      { after: null },
    );

    // When she discards the list's draft and publishes only that
    await saved(alice, "DELETE", `/api/lists/${list.id}/draft`);
    await publish(alice, { lists: [list.id] });

    // Then none of her changes is left
    expect(await unpublished(alice)).toEqual([]);
  });
});

// Ben's private changes to Kai, then Mo, whose removal is approved, then Lee, with the names he
// gave them.
async function benAfterMoGoes() {
  const ben = await user(["people:edit", "people:approve"]);
  const [kai = "", mo = "", lee = ""] = await livePeople(3);
  const renaming = async (id: string) => {
    const name = unique("Fictional Named");
    const changeSetId = await changeSetOf(ben, "PATCH", `/api/people/${id}`, {
      preferredName: name,
    });
    return { name, changeSetId };
  };
  const kaiChange = await renaming(kai);
  const moChange = await renaming(mo);
  await saved(alice, "DELETE", `/api/people/${mo}`);
  await publish(alice);
  expect((await decide("approval", { people: [mo] })).statusCode).toBe(200);
  const leeChange = await renaming(lee);
  return { ben, kai, kaiChange, moChange, leeChange };
}

const goneUndoRefused =
  "Changes withdrawn because their record is gone can't be undone";

const entryIds = async (who: User) => (await history(who)).map(({ id }) => id);

describe("a private change withdrawn with nothing left to take back", () => {
  it("records no change to Personal details in the access history", async () => {
    // Given Ben's private end date for Nia, added by Alice, which Alice then publishes too
    const [nia = ""] = await draftPeople(alice, ["Fictional Nia"]);
    await publish(alice);
    await saved(bob, "PATCH", `/api/people/${nia}`, { endDate: "2031-06-30" });
    await saved(alice, "PATCH", `/api/people/${nia}`, {
      endDate: "2031-06-30",
    });
    await publish(alice);
    const before = await personalChanges(bob, nia);

    // When Alice discards the draft adding Nia, and publishes that
    await saved(alice, "DELETE", `/api/people/${nia}/draft`);
    await publish(alice);

    // Then Bob's withdrawal records nothing in the access history
    expect(await rowsOf(bob, nia)).toEqual([]);
    expect(await personalChanges(bob, nia)).toBe(before);
  });
});

describe("a maker's other private changes, after one is withdrawn as its record goes", () => {
  it("are listed newest first", async () => {
    const { ben, kaiChange, leeChange } = await benAfterMoGoes();

    expect((await unpublished(ben)).map(({ subject }) => subject)).toEqual([
      leeChange.name,
      kaiChange.name,
    ]);
  });

  it("are held for a role that may publish them", async () => {
    const { ben } = await benAfterMoGoes();

    await test.holdOnly(ben.id, ["configuration:edit"]);
    const published = await test.request(
      ben.cookie,
      "POST",
      "/api/unpublished/publish",
    );

    expect(published.json()).toEqual({ total: 0, left: 2 });
  });

  it("count once published, so their maker may not approve them alone", async () => {
    const { ben, kai } = await benAfterMoGoes();

    expect(await publish(ben)).toBe(2);
    const approving = await test.request(
      ben.cookie,
      "POST",
      "/api/drafts/approval",
      { people: [kai] },
    );

    expect(approving.statusCode, approving.body).toBe(403);
  });

  it("are published without the change withdrawn, which only its maker sees, with its withdrawal", async () => {
    // Given Ben's change to Mo withdrawn as Mo's removal is approved
    const { ben, kaiChange, moChange } = await benAfterMoGoes();
    const goneSet = String((await withdrawal(ben))?.id);

    // When Ben publishes his other changes
    expect(await publish(ben)).toBe(2);

    // Then others see his change to Kai and nothing of Mo's, and Ben sees all three
    for (const other of [alice, approver]) {
      const seen = await entryIds(other);
      expect(seen).toContain(kaiChange.changeSetId);
      expect(seen).not.toContain(moChange.changeSetId);
      expect(seen).not.toContain(goneSet);
    }
    expect(await entryIds(ben)).toEqual(
      expect.arrayContaining([
        kaiChange.changeSetId,
        moChange.changeSetId,
        goneSet,
      ]),
    );
  });

  it("saved with a change withdrawn, are published alone, while its maker sees that change and its withdrawal", async () => {
    // Given Ben's private undo of his published addition of Kai and Mo, and Alice's discard of Mo's
    // draft, published
    const ben = await user(["people:edit", "people:view", "personal:view"]);
    const kaiName = unique("Fictional Kai");
    const moName = unique("Fictional Mo");
    const added = await saved<{ ids: string[]; changeSetId: string }>(
      ben,
      "POST",
      "/api/people",
      {
        people: [kaiName, moName].map((preferredName) => ({
          preferredName,
          employeeId: unique("E"),
          positionId: testPosition,
        })),
      },
    );
    const [, mo = ""] = added.ids;
    await publish(ben);
    const undone = await undo(ben, added.changeSetId);
    expect(undone.statusCode, undone.body).toBe(200);
    await saved(alice, "DELETE", `/api/people/${mo}/draft`);
    await publish(alice);
    expect(await unpublished(ben)).toHaveLength(1);

    // When Ben publishes the rest of his undo
    expect(await publish(ben)).toBe(1);

    // Then others see his undo for Kai alone, and Ben sees his undo for Mo too, and its withdrawal
    const namesSeenBy = async (who: User) =>
      (await history(who))
        .filter(({ madeBy }) => madeBy === ben.name)
        .map(({ kind, records }) => [
          kind,
          records.map(({ name }) => name).sort(),
        ]);
    for (const other of [alice, approver]) {
      expect(await namesSeenBy(other)).toEqual([
        ["edit", [kaiName]],
        ["edit", [kaiName, moName].sort()],
      ]);
    }
    const seenByBen = await namesSeenBy(ben);
    expect(seenByBen).toHaveLength(4);
    expect(seenByBen).toEqual(
      expect.arrayContaining([
        ["discard", [moName]],
        ["edit", [kaiName]],
        ["edit", [moName]],
        ["edit", [kaiName, moName].sort()],
      ]),
    );
  });
});

describe("a withdrawal of private changes as their record goes", () => {
  it("can't be undone when an approval removed the record", async () => {
    const { ben } = await benAfterMoGoes();
    const changeSetId = String((await withdrawal(ben))?.id);

    const response = await undo(ben, changeSetId);

    expect(response.statusCode).toBe(409);
    expect(response.json()).toEqual({ error: goneUndoRefused });
  });

  it("can't be undone when a published discard removed the record", async () => {
    // Given Bob's private change to a person whose added draft Alice discards and publishes
    const [added = ""] = await draftPeople(alice, ["Fictional Arrival"]);
    await publish(alice);
    await saved(bob, "PATCH", `/api/people/${added}`, {
      preferredName: unique("Fictional Renamed Arrival"),
    });
    await saved(alice, "DELETE", `/api/people/${added}/draft`);
    await publish(alice);
    const changeSetId = String((await withdrawal(bob))?.id);

    // When Bob undoes his withdrawal
    const response = await undo(bob, changeSetId);

    // Then it is refused
    expect(response.statusCode).toBe(409);
    expect(response.json()).toEqual({ error: goneUndoRefused });
  });
});
