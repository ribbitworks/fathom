// SPDX-License-Identifier: Apache-2.0

// Integration tests for private changes to records that go away, against a PostgreSQL server of
// their own: each is discarded as its maker's own withdrawal, seen only by them, whether an
// approval or a publish takes the record away.

import {
  accessHistory,
  allocations,
  changes,
  changeSets,
  features,
  privateChanges,
} from "@fathom/db";
import { type Choice, type List, monthOf } from "@fathom/shared";
import { and, count, eq } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { randomUUID } from "node:crypto";
import { readToday } from "./data/settings.ts";
import { builtInChoice, generalReader, unique } from "./test-app.ts";
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

// The maker's withdrawals' changes to the records given, each with its change set.
const withdrawn = async (who: User, recordIds: readonly string[]) =>
  (
    await test.connection
      .select({
        changeSetId: changeSets.id,
        private: changeSets.private,
        roleId: changeSets.madeAsRoleId,
        recordType: changes.recordType,
        recordId: changes.recordId,
        action: changes.action,
        field: changes.field,
        draft: changes.draft,
      })
      .from(changeSets)
      .innerJoin(changes, eq(changes.changeSetId, changeSets.id))
      .where(
        and(eq(changeSets.madeBy, who.id), eq(changeSets.kind, "withdrawal")),
      )
      .orderBy(changes.id)
  ).filter(({ recordId }) => recordIds.includes(recordId));

const roleOf = async (changeSetId: string) =>
  (
    await test.connection
      .select({ roleId: changeSets.madeAsRoleId })
      .from(changeSets)
      .where(eq(changeSets.id, changeSetId))
  )[0]?.roleId;

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
    const changesWithdrawn = await withdrawn(bob, [removed]);
    expect(
      new Set(
        changesWithdrawn.map(({ action, field, draft }) =>
          [action, field, draft].join(" "),
        ),
      ),
    ).toEqual(new Set(["changed preferredName true", "changed endDate true"]));
    const [first] = changesWithdrawn;
    expect(first).toMatchObject({ private: true, roleId: await roleOf(edit) });
    expect(await personalChanges(bob, removed)).toBe(
      Number(personalBefore) + 1,
    );
    expect((await history(bob)).map(({ id }) => id)).toContain(
      first?.changeSetId,
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
    const [{ changeSetId } = { changeSetId: "" }] = await withdrawn(bob, [
      removed,
    ]);

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
      new Set(
        (await withdrawn(bob, [list.id, kept.id, leaving.id])).map(
          ({ recordType, recordId }) => `${recordType} ${recordId}`,
        ),
      ),
    ).toEqual(
      new Set([
        `list-item ${kept.id}`,
        `choice-order ${list.id}`,
        `list-item ${leaving.id}`,
      ]),
    );
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
      (await withdrawn(planner, [allocationId])).map(
        ({ recordType }) => recordType,
      ),
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
      (await withdrawn(bob, [added])).map(({ action, field }) => ({
        action,
        field,
      })),
    ).toEqual([{ action: "changed", field: "preferredName" }]);
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
