// SPDX-License-Identifier: Apache-2.0

// Access control tests for the check on publishing private changes: a conflict shows both values,
// and who made the other, only to a role that sees the record's kind, the column's table and the
// field, as the change history would show them; a field or record the role no longer sees is given
// up, never asked about.

import { drafts, rolePermissions, userRoles, valueField } from "@fathom/db";
import {
  type Field,
  type Permission,
  type PrivateConflicts,
} from "@fathom/shared";
import { and, eq, inArray } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { unique } from "./test-app.ts";
import {
  alice,
  closeUnpublishedTests,
  discard,
  keepingSide,
  liveList,
  livePeople,
  publish,
  saved,
  north,
  send,
  siteColumn,
  siteList,
  startUnpublishedTests,
  test,
  user,
  type User,
} from "./test-unpublished.ts";

beforeAll(startUnpublishedTests);

afterAll(closeUnpublishedTests);

const conflictsOf = async (who: User) => {
  const response = await send(who, "POST", "/api/unpublished/publish");
  expect(response.statusCode, response.body).toBe(409);
  return response.json<PrivateConflicts>().conflicts;
};

const publishedOf = async (recordType: string, id: string) =>
  (
    await test.connection
      .select({ fields: drafts.fields })
      .from(drafts)
      .where(and(eq(drafts.recordType, recordType), eq(drafts.recordId, id)))
  )[0]?.fields;

// Takes permissions from the role a user holds, as an administrator changing the role would.
const withdrawn = (who: User, permissions: readonly Permission[]) =>
  test.connection
    .delete(rolePermissions)
    .where(
      and(
        inArray(
          rolePermissions.roleId,
          test.connection
            .select({ id: userRoles.roleId })
            .from(userRoles)
            .where(eq(userRoles.userId, who.id)),
        ),
        inArray(rolePermissions.permission, [...permissions]),
      ),
    );

const rename = (who: User, listId: string, name: string) =>
  saved(who, "PUT", `/api/lists/${listId}`, { name });

// A list Ana and another user each rename privately, Ana publishing hers first.
async function bothRename(
  who: User,
): Promise<{ listId: string; was: string; theirs: string; mine: string }> {
  const { list } = await liveList([]);
  const theirs = unique("Fictional Theirs");
  const mine = unique("Fictional Mine");
  await rename(alice, list.id, theirs);
  await rename(who, list.id, mine);
  await publish(alice);
  return { listId: list.id, was: list.name, theirs, mine };
}

describe("a conflict's values", () => {
  it("are shown to a role that sees configuration without people", async () => {
    // Given a role that renamed a list, then lost seeing people
    const dora = await user(["people:view", "configuration:edit"]);
    const { listId, was, theirs, mine } = await bothRename(dora);
    await withdrawn(dora, ["people:view"]);

    // When it publishes, then both names are shown, with who made the other
    expect(await conflictsOf(dora)).toEqual([
      {
        recordType: "list",
        recordId: listId,
        subject: `the list ${mine}`,
        field: "name",
        mine: { field: "name", oldValue: was, newValue: mine },
        theirs: { field: "name", oldValue: was, newValue: theirs },
        state: "waiting",
        by: alice.name,
        token: expect.any(String) as string,
      },
    ]);
    await discard(dora);
  });

  it("are given up, keeping the other, for a role that no longer sees the record's kind", async () => {
    // Given a role that renamed a list, then lost seeing configuration
    const configuration: Permission[] = [
      "configuration:view",
      "configuration:edit",
    ];
    const carol = await user(["people:edit", ...configuration]);
    const { listId, theirs } = await bothRename(carol);
    await withdrawn(carol, configuration);

    // When it publishes
    const response = await send(carol, "POST", "/api/unpublished/publish");

    // Then the field is given up, named alone, and the other name stays
    expect(response.statusCode, response.body).toBe(200);
    expect(response.json()).toEqual({
      total: 0,
      left: 0,
      givenUp: [
        {
          recordType: "list",
          recordId: listId,
          subject: "a list",
          field: "name",
        },
      ],
    });
    expect(await publishedOf("list", listId)).toMatchObject({ name: theirs });
  });

  it("are given up, keeping the other, for a role that doesn't see the field's class", async () => {
    // Given Ana's and Ben's End dates for Kai, a Personal detail, and names, a General one
    const ben = await user("workforce-administrator");
    const [person = ""] = await livePeople(1);
    const changing = (who: User, endDate: string) =>
      saved(who, "PATCH", `/api/people/${person}`, {
        endDate,
        preferredName: unique("Fictional Named"),
      });
    await changing(alice, "2031-01-31");
    await changing(ben, "2031-02-28");
    await publish(alice);
    const endDate = {
      recordType: "person",
      recordId: person,
      subject: expect.any(String) as string,
      field: "endDate",
    };

    // When Ben publishes as a role that doesn't see Personal details
    await test.holdOnly(ben.id, ["people:view", "people:edit"]);
    const asked = await send(ben, "POST", "/api/unpublished/publish");

    // Then he is asked about the name alone, and told the End date will be given up
    expect(asked.statusCode, asked.body).toBe(409);
    expect(asked.json<PrivateConflicts>()).toMatchObject({
      conflicts: [{ field: "preferredName" }],
      givenUp: [endDate],
    });
    const response = await send(ben, "POST", "/api/unpublished/publish", {
      resolutions: [
        {
          recordType: "person",
          recordId: person,
          field: "preferredName",
          keep: "mine",
          token: asked.json<PrivateConflicts>().conflicts[0]?.token,
        },
      ],
    });
    expect(response.statusCode, response.body).toBe(200);
    expect(response.json<{ givenUp: unknown[] }>().givenUp).toEqual([endDate]);
    expect(await publishedOf("person", person)).toMatchObject({
      endDate: "2031-01-31",
    });
  });

  it("are given up, keeping the removal, for a record removed since whose kind the role no longer sees", async () => {
    // Given a role that renamed a list Ana then removed, and lost seeing configuration
    const configuration: Permission[] = [
      "configuration:view",
      "configuration:edit",
    ];
    const gus = await user(["people:edit", ...configuration]);
    const { list } = await liveList([]);
    await rename(gus, list.id, unique("Fictional Mine"));
    await saved(alice, "DELETE", `/api/lists/${list.id}`);
    await publish(alice);
    await withdrawn(gus, configuration);

    // When it publishes
    const response = await send(gus, "POST", "/api/unpublished/publish");

    // Then the whole change is given up, named alone, and the removal stays
    expect(response.statusCode, response.body).toBe(200);
    expect(response.json<{ givenUp: unknown[] }>().givenUp).toEqual([
      { recordType: "list", recordId: list.id, subject: "a list" },
    ]);
    const [removal] = await test.connection
      .select({ action: drafts.action })
      .from(drafts)
      .where(and(eq(drafts.recordType, "list"), eq(drafts.recordId, list.id)));
    expect(removal?.action).toBe("deleted");
  });
});

// A People column Ana and another user each rename privately, Ana publishing hers first.
async function bothRenameColumn(who: User): Promise<string> {
  const { field } = await saved<{ field: Field }>(
    alice,
    "POST",
    "/api/people/columns",
    { name: unique("Fictional Column"), listId: siteList.id },
  );
  await publish(alice);
  await test.approveLists();
  const renaming = (by: User) =>
    saved(by, "PUT", `/api/people/columns/${field.id}`, {
      name: unique("Fictional Renamed"),
      listId: siteList.id,
    });
  await renaming(alice);
  await renaming(who);
  await publish(alice);
  return field.id;
}

describe("a column's conflict values", () => {
  it("are shown to a role that sees the column's table without configuration", async () => {
    const eve = await user(["people:edit"]);
    const columnId = await bothRenameColumn(eve);

    expect(await conflictsOf(eve)).toEqual([
      expect.objectContaining({
        recordType: "field",
        recordId: columnId,
        subject: expect.stringMatching(/^the column /) as unknown,
        field: "name",
        mine: expect.objectContaining({ field: "name" }) as unknown,
        theirs: expect.objectContaining({ field: "name" }) as unknown,
        by: alice.name,
      }),
    ]);
    await discard(eve);
  });

  it("are given up for a role that sees configuration but not the column's table", async () => {
    // Given a role that renamed a People column, then lost seeing people
    const fay = await user(["people:edit", "configuration:edit"]);
    const columnId = await bothRenameColumn(fay);
    await withdrawn(fay, ["people:edit", "people:view"]);

    // When it publishes, then the name is given up
    const response = await send(fay, "POST", "/api/unpublished/publish");
    expect(response.statusCode, response.body).toBe(200);
    expect(response.json<{ givenUp: unknown[] }>().givenUp).toEqual([
      {
        recordType: "field",
        recordId: columnId,
        subject: "a column",
        field: "name",
      },
    ]);
  });
});

describe("a clash's token", () => {
  it("changes when the side the role sees changes, and not when a field it doesn't see does", async () => {
    // Given Ben's private name for Kai, made before his role stopped seeing Personal details
    const ben = await user("workforce-administrator");
    const [person = ""] = await livePeople(1);
    await saved(ben, "PATCH", `/api/people/${person}`, {
      preferredName: unique("Fictional Mine"),
    });
    await test.holdOnly(ben.id, ["people:view", "people:edit"]);
    const publishing = (fields: object) =>
      saved(alice, "PATCH", `/api/people/${person}`, fields).then(() =>
        publish(alice),
      );
    const tokenNow = async () => (await conflictsOf(ben))[0]?.token;

    // When Ana changes Kai's name, then his End date, a Personal detail, then his name again
    await publishing({ preferredName: unique("Fictional Named") });
    const named = await tokenNow();
    await publishing({ endDate: "2031-01-31" });
    const ended = await tokenNow();
    await publishing({ preferredName: unique("Fictional Renamed") });
    const renamed = await tokenNow();

    // Then only the change Ben sees changes the token
    expect(ended).toBe(named);
    expect(renamed).not.toBe(named);
    await discard(ben);
  });
});

describe("keeping a private change over a removal", () => {
  it("publishes the fields the role sees, giving up those it no longer sees", async () => {
    // Given Ben's private Site and End date for Kai, Ana's published removal of Kai, and Ben's role
    // no longer seeing Personal details
    const ben = await user("workforce-administrator");
    const [person = ""] = await livePeople(1);
    await saved(ben, "PATCH", `/api/people/${person}`, {
      endDate: "2031-02-28",
      values: { [siteColumn.id]: [north.id] },
    });
    await saved(alice, "DELETE", `/api/people/${person}`);
    await publish(alice);
    await test.holdOnly(ben.id, ["people:view", "people:edit"]);

    // When Ben keeps his change
    const response = await keepingSide(ben, "mine");

    // Then his Site replaces the removal, without his End date
    expect(response.statusCode, response.body).toBe(200);
    expect(await publishedOf("person", person)).toEqual({
      [valueField(siteColumn.id)]: [north.id],
    });
  });
});

describe("a side kept for a clash the role doesn't see", () => {
  const forged = (recordType: string, recordId: string, field?: string) => ({
    resolutions: [
      {
        recordType,
        recordId,
        ...(field === undefined ? {} : { field }),
        keep: "mine",
        token: "none",
      },
    ],
  });

  it("is ignored for a field, which is given up", async () => {
    // Given Ana's and Ben's End dates for Kai, and Ben's role no longer seeing Personal details
    const ben = await user("workforce-administrator");
    const [person = ""] = await livePeople(1);
    const ending = (who: User, endDate: string) =>
      saved(who, "PATCH", `/api/people/${person}`, { endDate });
    await ending(alice, "2031-01-31");
    await ending(ben, "2031-02-28");
    await publish(alice);
    await test.holdOnly(ben.id, ["people:view", "people:edit"]);

    // When Ben sends his own End date as kept
    const response = await send(
      ben,
      "POST",
      "/api/unpublished/publish",
      forged("person", person, "endDate"),
    );

    // Then Ana's stays
    expect(response.statusCode, response.body).toBe(200);
    expect(await publishedOf("person", person)).toMatchObject({
      endDate: "2031-01-31",
    });
  });

  it("is ignored for the user's own removal of a record of a kind the role no longer sees", async () => {
    // Given a role that removed a list privately, Ana's rename published since, and the role no
    // longer seeing configuration
    const configuration: Permission[] = [
      "configuration:view",
      "configuration:edit",
    ];
    const hal = await user(["people:edit", ...configuration]);
    const { list } = await liveList([]);
    await saved(hal, "DELETE", `/api/lists/${list.id}`);
    const theirs = unique("Fictional Theirs");
    await rename(alice, list.id, theirs);
    await publish(alice);
    await withdrawn(hal, configuration);

    // When it sends its removal as kept
    const response = await send(
      hal,
      "POST",
      "/api/unpublished/publish",
      forged("list", list.id),
    );

    // Then Ana's rename stays
    expect(response.statusCode, response.body).toBe(200);
    expect(await publishedOf("list", list.id)).toMatchObject({ name: theirs });
  });
});

describe("a private removal over a field the role doesn't see", () => {
  it("is given up, keeping the other change, whatever side is sent", async () => {
    // Given Ben's private removal of Kai, Ana's End date for Kai published since, and Ben's role no
    // longer seeing Personal details
    const ben = await user("workforce-administrator");
    const [person = ""] = await livePeople(1);
    await saved(ben, "DELETE", `/api/people/${person}`);
    await saved(alice, "PATCH", `/api/people/${person}`, {
      endDate: "2031-01-31",
    });
    await publish(alice);
    await test.holdOnly(ben.id, ["people:view", "people:edit"]);

    // When Ben sends his removal as kept
    const response = await send(ben, "POST", "/api/unpublished/publish", {
      resolutions: [
        { recordType: "person", recordId: person, keep: "mine", token: "none" },
      ],
    });

    // Then the removal is given up, named alone, and Ana's End date stays
    expect(response.statusCode, response.body).toBe(200);
    expect(response.json<{ givenUp: unknown[] }>().givenUp).toEqual([
      {
        recordType: "person",
        recordId: person,
        subject: expect.any(String) as string,
      },
    ]);
    expect(await publishedOf("person", person)).toMatchObject({
      endDate: "2031-01-31",
    });
  });
});
