// SPDX-License-Identifier: Apache-2.0

// Integration tests for drafts of people as each user sees them, against a PostgreSQL server of
// their own: changing drafts, who last changed one, and drafts of people no longer live.

import {
  drafts,
  people,
  rolePermissions,
  roles,
  userRoles,
  users,
} from "@fathom/db";
import { type Person, startingRoles } from "@fathom/shared";
import { eq } from "drizzle-orm";
import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { generalReader, type Method, testPosition } from "./test-app.ts";
import {
  test,
  editor,
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
  startDraftTests,
  closeDraftTests,
} from "./test-drafts.ts";

beforeAll(startDraftTests);

afterAll(closeDraftTests);

describe("drafts as people see them", () => {
  it("shows a drafted person, a change, and a removal in place, with the live values", async () => {
    const { choices, field } = await columnWith(["North", "South"]);
    const [north = "", south = ""] = choices.map(({ id }) => id);
    const added = await draftPerson({ values: { [field.id]: [north] } });
    const changed = await livePerson({
      preferredName: "Fictional Before",
      values: { [field.id]: [north] },
    });
    await saved("PATCH", `/api/people/${changed.id}`, {
      preferredName: "Fictional After",
      values: { [field.id]: [south] },
    });
    const removed = await livePerson();
    await saved("DELETE", `/api/people/${removed.id}`);

    const planner = await test.signedIn(generalReader);
    expect((await seen(planner.cookie, added.id))?.draft).toMatchObject({
      action: "created",
      changed: ["preferredName", "employeeId", "positionId", field.id],
      live: { values: {} },
      state: "waiting",
      madeBy: "Fictional User 1",
    });
    expect(await seen(planner.cookie, changed.id)).toMatchObject({
      preferredName: "Fictional After",
      values: { [field.id]: [south] },
      draft: {
        action: "changed",
        changed: ["preferredName", field.id],
        live: {
          preferredName: "Fictional Before",
          values: { [field.id]: [north] },
        },
      },
    });
    // A removal shows the person as they are.
    const gone = await seen(planner.cookie, removed.id);
    expect(gone?.draft?.action).toBe("deleted");
    expect(gone?.preferredName).toBe((await live(removed.id))?.preferredName);
    // Nothing reached the live people.
    expect(await live(added.id)).toBeUndefined();
    expect((await live(changed.id))?.preferredName).toBe("Fictional Before");
  });

  it("hides drafts, and reasons, that change only what a reader may not see", async () => {
    const personalColumn = await columnWith(["Secret"], "personal");
    const person = await livePerson({ startDate: "2020-01-01" });
    await saved("PATCH", `/api/people/${person.id}`, {
      endDate: "2031-01-01",
    });
    const planner = await test.signedIn(generalReader);
    const manager = await test.signedIn("engineering-manager");
    expect((await seen(planner.cookie, person.id))?.draft).toBeUndefined();
    expect((await seen(manager.cookie, person.id))?.draft).toMatchObject({
      changed: ["endDate"],
      live: { endDate: null },
    });
    // A rejection's reason is as sensitive as the draft.
    const other = await livePerson();
    await saved("PATCH", `/api/people/${other.id}`, {
      preferredName: unique("Fictional Renamed"),
      values: {
        [personalColumn.field.id]: [String(personalColumn.choices[0]?.id)],
      },
    });
    expect((await reject([other.id], "Fictional reason")).statusCode).toBe(200);
    expect((await seen(planner.cookie, other.id))?.draft).toMatchObject({
      state: "rejected",
      changed: ["preferredName"],
    });
    expect(
      (await seen(planner.cookie, other.id))?.draft?.reason,
    ).toBeUndefined();
    expect((await seen(manager.cookie, other.id))?.draft?.reason).toBe(
      "Fictional reason",
    );
  });

  it("lists people by name, and those with the same name in a fixed order, with each draft's columns in order", async () => {
    const first = await columnWith(["A"]);
    const second = await columnWith(["B"]);
    const values = {
      [first.field.id]: [String(first.choices[0]?.id)],
      [second.field.id]: [String(second.choices[0]?.id)],
    };
    const name = unique("Fictional Twin");
    const twins = [
      await draftPerson({ preferredName: name, values }),
      await draftPerson({
        preferredName: name,
        values,
        employeeId: unique("E"),
        positionId: testPosition,
      }),
    ];
    const response = await send(editor.cookie, "GET", "/api/people");
    const listed = response
      .json<{ people: Person[] }>()
      .people.filter(({ preferredName }) => preferredName === name);
    expect(listed.map(({ id }) => id)).toEqual(
      twins.map(({ id }) => id).sort(),
    );
    // Details a draft adding someone leaves empty are not among what it changes.
    expect(listed[0]?.draft?.changed.slice(3)).toEqual(
      [first.field.id, second.field.id].sort(),
    );
    // A column with nothing chosen is left out.
    const empty = await draftPerson({ values: { [first.field.id]: [] } });
    expect((await draftRow(empty.id))?.fields).not.toHaveProperty(
      `value:${first.field.id}`,
    );
  });

  it("shows readers without Personal details only people current today, as live dates say while a draft waits", async () => {
    const starting = await draftPerson({ startDate: "2099-01-01" });
    const future = await livePerson({ startDate: "2099-02-01" });
    const leaving = await livePerson({ startDate: "2020-01-01" });
    await saved("PATCH", `/api/people/${leaving.id}`, {
      endDate: "2021-01-01",
    });
    const planner = await test.signedIn(generalReader);
    expect(await seen(planner.cookie, starting.id)).toBeUndefined();
    expect(await seen(planner.cookie, future.id)).toBeUndefined();
    // A draft changing only Personal dates shows no draft before it is approved.
    const left = await seen(planner.cookie, leaving.id);
    expect(left).toBeDefined();
    expect(left?.draft).toBeUndefined();
    const former = await livePerson({
      startDate: "2010-01-01",
      endDate: "2011-01-01",
    });
    await saved("PATCH", `/api/people/${former.id}`, { endDate: null });
    expect(await seen(planner.cookie, former.id)).toBeUndefined();
    expect(await seen(editor.cookie, starting.id)).toBeDefined();
    await approve([leaving.id]);
    expect(await seen(planner.cookie, leaving.id)).toBeUndefined();
  });

  it("names Fathom as who made a draft the history does not hold", async () => {
    const id = randomUUID();
    await test.connection.insert(drafts).values({
      recordType: "person",
      recordId: id,
      action: "created",
      fields: {
        preferredName: "Fictional Unrecorded",
        employeeId: unique("E"),
        positionId: testPosition,
      },
    });
    expect((await seen(editor.cookie, id))?.draft).toMatchObject({
      madeBy: null,
      madeAs: null,
      madeAt: null,
    });
    await saved("DELETE", `/api/people/${id}/draft`);
  });
});

describe("changing drafts", () => {
  it("keeps one draft per person, which further changes by anyone update", async () => {
    const person = await livePerson({ preferredName: "Fictional One" });
    await saved("PATCH", `/api/people/${person.id}`, {
      preferredName: "Fictional Two",
    });
    const other = await test.signedIn("workforce-administrator");
    await send(other.cookie, "PATCH", `/api/people/${person.id}`, {
      preferredName: "Fictional Three",
    });
    expect(await draftRow(person.id)).toMatchObject({
      action: "changed",
      fields: { preferredName: "Fictional Three" },
    });
    expect((await seen(editor.cookie, person.id))?.draft?.madeBy).toMatch(
      /^Fictional User \d+$/,
    );
    expect((await seen(editor.cookie, person.id))?.draft?.madeBy).not.toBe(
      "Fictional User 1",
    );
    // Changed back to the live value, the draft is gone.
    await saved("PATCH", `/api/people/${person.id}`, {
      preferredName: "Fictional One",
    });
    expect(await draftRow(person.id)).toBeUndefined();
    expect(
      await saved("PATCH", `/api/people/${person.id}`, {
        preferredName: "Fictional One",
      }),
    ).toBeNull();
  });

  it("refuses to change a person drafted to be removed, and removes them only once", async () => {
    const person = await livePerson();
    const removed = await saved("DELETE", `/api/people/${person.id}`);
    expect(removed).not.toBeNull();
    expect(await saved("DELETE", `/api/people/${person.id}`)).toBeNull();
    const change = await send(
      editor.cookie,
      "PATCH",
      `/api/people/${person.id}`,
      {
        preferredName: "Fictional",
      },
    );
    expect(change.statusCode).toBe(409);
    expect(change.json()).toEqual({
      error:
        "This person's draft removes them; discard the draft to change them",
    });
    for (const [method, url] of [
      ["PATCH", `/api/people/${randomUUID()}`],
      ["DELETE", `/api/people/${randomUUID()}`],
      ["DELETE", `/api/people/${randomUUID()}/draft`],
    ] as [Method, string][]) {
      const response = await send(editor.cookie, method, url, {});
      expect(response.statusCode).toBe(404);
    }
  });

  it("discards drafts that add, change, and remove people, recording each", async () => {
    const added = await draftPerson();
    const removedAdded = await saved("DELETE", `/api/people/${added.id}`);
    expect(await draftRow(added.id)).toBeUndefined();
    expect((await entry(editor.cookie, removedAdded))?.kind).toBe("discard");

    const changed = await livePerson();
    await saved("PATCH", `/api/people/${changed.id}`, {
      endDate: "2030-01-01",
    });
    const discarded = await saved("DELETE", `/api/people/${changed.id}/draft`);
    expect(await draftRow(changed.id)).toBeUndefined();
    expect(await entry(editor.cookie, discarded)).toMatchObject({
      kind: "discard",
      records: [
        {
          action: "changed",
          draft: true,
          fields: [
            { field: "endDate", oldValue: "2030-01-01", newValue: null },
          ],
        },
      ],
    });

    const removed = await livePerson();
    await saved("DELETE", `/api/people/${removed.id}`);
    expect(
      (
        await entry(
          editor.cookie,
          await saved("DELETE", `/api/people/${removed.id}/draft`),
        )
      )?.records[0]?.action,
    ).toBe("created");
    const another = await draftPerson();
    expect(
      (
        await entry(
          editor.cookie,
          await saved("DELETE", `/api/people/${another.id}/draft`),
        )
      )?.records[0]?.action,
    ).toBe("deleted");
    const none = await send(
      editor.cookie,
      "DELETE",
      `/api/people/${removed.id}/draft`,
    );
    expect(none.json()).toEqual({ error: "This person has no draft" });
  });

  it("refuses an Employee ID someone has, live or in a draft, or that two people asked for share", async () => {
    const employeeId = unique("E-Taken");
    const holder = await livePerson({ employeeId });
    await saved("PATCH", `/api/people/${holder.id}`, {
      employeeId: unique("E-New"),
    });
    const drafted = await draftPerson();
    const draftedId = (await draftRow(drafted.id))?.fields.employeeId as string;
    for (const people of [
      [
        {
          preferredName: "Fictional",
          employeeId: employeeId.toLowerCase(),
          positionId: testPosition,
        },
      ],
      [
        {
          preferredName: "Fictional",
          employeeId: draftedId,
          positionId: testPosition,
        },
      ],
      [
        {
          preferredName: "Fictional",
          employeeId: "E-Twin",
          positionId: testPosition,
        },
        {
          preferredName: "Fictional",
          employeeId: "e-twin",
          positionId: testPosition,
        },
      ],
    ]) {
      const response = await send(editor.cookie, "POST", "/api/people", {
        people,
      });
      expect(response.statusCode).toBe(409);
      expect(response.json()).toEqual({
        error: "Someone already has that ID",
        field: "employeeId",
      });
    }
    // A person may keep, or go back to, their own.
    expect(
      await saved("PATCH", `/api/people/${holder.id}`, { employeeId }),
    ).not.toBeNull();
  });
});

describe("drafts of people no longer live", () => {
  it("leaves out a change to someone removed another way, refuses changing it, and discards it", async () => {
    const person = await livePerson();
    await saved("PATCH", `/api/people/${person.id}`, {
      preferredName: unique("Fictional"),
    });
    // Removed without a draft, as removing the seed data does.
    await test.connection.delete(people).where(eq(people.id, person.id));
    expect(await seen(editor.cookie, person.id)).toBeUndefined();
    const change = await send(
      editor.cookie,
      "PATCH",
      `/api/people/${person.id}`,
      { preferredName: "Fictional" },
    );
    expect(change.statusCode).toBe(404);
    expect(await saved("DELETE", `/api/people/${person.id}`)).toBeNull();
    await saved("DELETE", `/api/people/${person.id}/draft`);
    expect(await draftRow(person.id)).toBeUndefined();
  });
});

describe("who last changed a draft", () => {
  it("is who made the latest change the reader may see", async () => {
    const person = await livePerson({ startDate: "2020-01-01" });
    await saved("PATCH", `/api/people/${person.id}`, {
      preferredName: unique("Fictional"),
    });
    const other = await test.signedIn("workforce-administrator");
    await send(other.cookie, "PATCH", `/api/people/${person.id}`, {
      endDate: "2033-01-01",
    });
    const planner = await test.signedIn(generalReader);
    expect((await seen(planner.cookie, person.id))?.draft?.madeBy).toBe(
      "Fictional User 1",
    );
    const manager = await test.signedIn("engineering-manager");
    const [otherUser] = await test.connection
      .select({ name: users.name })
      .from(users)
      .where(eq(users.id, other.id));
    expect((await seen(manager.cookie, person.id))?.draft?.madeBy).toBe(
      otherUser?.name,
    );
    expect((await seen(planner.cookie, person.id))?.draft?.madeAs).toBe(
      startingRoles["workforce-administrator"].name,
    );
  });

  it("names the role its maker acted as, which a switch of role changes", async () => {
    const person = await livePerson({ startDate: "2020-01-01" });
    const maker = await test.signedIn("workforce-administrator");
    const name = unique("Fictional Editing Role");
    const [editing] = await test.connection
      .insert(roles)
      .values({ name })
      .returning({ id: roles.id });
    const editingId = String(editing?.id);
    await test.connection
      .insert(rolePermissions)
      .values(
        startingRoles["workforce-administrator"].permissions.map(
          (permission) => ({ roleId: editingId, permission }),
        ),
      );
    await test.connection
      .insert(userRoles)
      .values({ userId: maker.id, roleId: editingId });
    const planner = await test.signedIn(generalReader);
    await send(maker.cookie, "PATCH", `/api/people/${person.id}`, {
      preferredName: unique("Fictional"),
    });
    expect((await seen(planner.cookie, person.id))?.draft?.madeAs).toBe(
      startingRoles["workforce-administrator"].name,
    );
    const switched = await test.request(
      maker.cookie,
      "PUT",
      "/api/session/role",
      { roleId: editingId },
      { publish: false },
    );
    expect(switched.statusCode, switched.body).toBe(204);
    await send(maker.cookie, "PATCH", `/api/people/${person.id}`, {
      preferredName: unique("Fictional"),
    });
    expect((await seen(planner.cookie, person.id))?.draft?.madeAs).toBe(name);
  });
});
