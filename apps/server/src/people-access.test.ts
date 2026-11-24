// SPDX-License-Identifier: Apache-2.0

// Integration tests for who may see people, against a migrated PostgreSQL server: which roles may
// read and change them, signed-out requests, who sees Confidential values, who is listed and which
// details each user receives, and the access history.

import { dayIn, defaultTimeZone, roleSchema } from "@fathom/shared";
import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { rolesGranting } from "./access.ts";
import { generalReader, type Method, unique } from "./test-app.ts";
import {
  test,
  editor,
  send,
  columnWith,
  personRequest,
  addPeople,
  addPerson,
  addLivePerson,
  readPeople,
  accessOf,
  startPeopleTests,
  closePeopleTests,
} from "./test-people.ts";

beforeAll(startPeopleTests);

afterAll(closePeopleTests);

describe("who may read and change people", () => {
  it.each(roleSchema.options)(
    "a %s may read people only if the role lets them see people",
    async (role) => {
      const { cookie } = await test.signedIn(role);
      const response = await send(cookie, "GET", "/api/people");
      expect(response.statusCode).toBe(
        rolesGranting("people:view").includes(role) ? 200 : 403,
      );
    },
  );

  const person = `/api/people/${randomUUID()}`;
  const column = `/api/people/columns/${randomUUID()}`;
  const peopleChanges: [Method, string, object | undefined][] = [
    ["POST", "/api/people", { people: [personRequest()] }],
    ["PATCH", person, { preferredName: "Fictional" }],
    ["DELETE", person, undefined],
    ["DELETE", `${person}/draft`, undefined],
    ["DELETE", `${person}/draft/rejection`, undefined],
  ];
  const columnChanges: [Method, string, object | undefined][] = [
    [
      "POST",
      "/api/people/columns",
      { name: "Fictional", listId: randomUUID() },
    ],
    ["PUT", column, { name: "Fictional", listId: randomUUID() }],
    ["DELETE", column, undefined],
  ];
  const refused = (permission: "people:edit" | "configuration:edit") =>
    roleSchema.options.filter(
      (role) => !rolesGranting(permission).includes(role),
    );

  it.each([
    ...peopleChanges.flatMap((change) =>
      refused("people:edit").map((role) => [role, ...change] as const),
    ),
    ...columnChanges.flatMap((change) =>
      refused("configuration:edit").map((role) => [role, ...change] as const),
    ),
  ])("refuses a %s %s %s", async (role, method, url, payload) => {
    const { cookie } = await test.signedIn(role);
    const response = await send(cookie, method, url, payload);
    expect(response.statusCode).toBe(403);
    expect(response.json()).toEqual({ error: "Forbidden" });
  });

  // Approving and rejecting people's drafts need people:approve, which each other role is tried
  // without.
  const decisions: [Method, string, object, string][] = [
    [
      "POST",
      "/api/drafts/approval",
      { people: [randomUUID()] },
      "This role can't approve drafts of people",
    ],
    [
      "POST",
      "/api/drafts/rejection",
      { people: [randomUUID()], reason: "Fictional" },
      "This role can't reject drafts of people",
    ],
  ];
  it.each(
    decisions.flatMap((decision) =>
      roleSchema.options
        .filter((role) => !rolesGranting("people:approve").includes(role))
        .map((role) => [role, ...decision] as const),
    ),
  )("refuses a %s %s %s", async (role, method, url, payload, error) => {
    const { cookie } = await test.signedIn(role);
    const response = await send(cookie, method, url, payload);
    expect(response.statusCode).toBe(403);
    expect(response.json()).toEqual({ error });
  });

  // Saved views need only seeing people, so each role is tried on its own.
  const view = `/api/views/people/${randomUUID()}`;
  const viewChanges: [Method, string, object | undefined][] = [
    [
      "POST",
      "/api/views/people",
      { name: "Fictional", scope: "personal", definition: {} },
    ],
    ["PUT", view, { name: "Fictional" }],
    ["DELETE", view, undefined],
  ];
  it.each(
    viewChanges.flatMap((change) =>
      roleSchema.options
        .filter((role) => !rolesGranting("people:view").includes(role))
        .map((role) => [role, ...change] as const),
    ),
  )("refuses a %s %s %s", async (role, method, url, payload) => {
    const { cookie } = await test.signedIn(role);
    const response = await send(cookie, method, url, payload);
    expect(response.statusCode).toBe(403);
    expect(response.json()).toEqual({ error: "Forbidden" });
  });
});

describe("signed-out requests", () => {
  it.each([
    ["GET", "/api/people"],
    ["GET", "/api/org-chart"],
    ["POST", "/api/people"],
    ["PATCH", `/api/people/${randomUUID()}`],
    ["DELETE", `/api/people/${randomUUID()}`],
    ["DELETE", `/api/people/${randomUUID()}/draft`],
    ["DELETE", `/api/people/${randomUUID()}/draft/rejection`],
    ["POST", "/api/drafts/approval"],
    ["POST", "/api/drafts/rejection"],
    ["POST", "/api/people/columns"],
    ["PUT", `/api/people/columns/${randomUUID()}`],
    ["DELETE", `/api/people/columns/${randomUUID()}`],
    ["POST", "/api/views/people"],
    ["PUT", `/api/views/people/${randomUUID()}`],
    ["DELETE", `/api/views/people/${randomUUID()}`],
    ["POST", `/api/undo/${randomUUID()}`],
  ] as [Method, string][])(
    "refuses %s %s without a session",
    async (method, url) => {
      const response = await test.app.inject({
        method,
        url,
        headers: { origin: "https://fathom.example.test" },
        ...(method === "GET" ? {} : { payload: {} }),
      });
      expect(response.statusCode).toBe(401);
    },
  );
});

describe("who sees Confidential values", () => {
  let fieldId = "";
  let personId = "";

  beforeAll(async () => {
    const { cookie } = await editor();
    const { field, choices } = await columnWith(cookie, ["Secret"], {
      visibility: "confidential",
    });
    fieldId = field.id;
    personId = (
      await addPerson(cookie, {
        values: { [field.id]: [String(choices[0]?.id)] },
      })
    ).id;
  });

  it.each(rolesGranting("people:view"))(
    "a %s, a role that sees people, sees a Confidential column's values only if the role lets them see Confidential data",
    async (role) => {
      const { cookie } = await test.signedIn(role);
      const read = await readPeople(cookie);
      const sees = rolesGranting("confidential:view").includes(role);
      expect(read.fields.some(({ id }) => id === fieldId)).toBe(sees);
      const person = read.people.find(({ id }) => id === personId);
      expect(Object.keys(person?.values ?? {}).includes(fieldId)).toBe(sees);
    },
  );
});

describe("who is listed and what each user sees", () => {
  // Today in Fathom's time zone, which decides who is current.
  const today = () => dayIn(defaultTimeZone);

  it("shows users who cannot see Personal details only people current today, without dates or Personal values", async () => {
    const { cookie } = await editor();
    const general = await columnWith(cookie, ["Fictional General"]);
    const personalColumn = await columnWith(cookie, ["Fictional Personal"], {
      visibility: "personal",
    });
    const values = {
      [general.field.id]: [String(general.choices[0]?.id)],
      [personalColumn.field.id]: [String(personalColumn.choices[0]?.id)],
    };
    const { ids } = await addPeople(cookie, [
      { startDate: "2020-01-01", values },
      { startDate: null, values },
      { startDate: "2020-01-01", endDate: today() },
      { startDate: "2020-01-01", endDate: "2021-01-01" },
      { startDate: "2999-01-01" },
    ]);
    const viewer = await test.signedIn(generalReader);
    const seen = await readPeople(viewer.cookie);
    const listed = seen.people.filter((person) => ids.includes(person.id));
    expect(listed.map((person) => ids.indexOf(person.id)).sort()).toEqual([
      0, 1, 2,
    ]);
    expect(listed[0]).not.toHaveProperty("startDate");
    expect(listed.find(({ id }) => id === ids[2])).not.toHaveProperty(
      "endDate",
    );
    expect(listed.find(({ id }) => id === ids[0])?.values).toEqual({
      [general.field.id]: values[general.field.id],
    });
    expect(seen.fields.map(({ id }) => id)).toContain(general.field.id);
    expect(seen.fields.map(({ id }) => id)).not.toContain(
      personalColumn.field.id,
    );
    expect(await accessOf(viewer.id)).toEqual([]);

    const manager = await test.signedIn("engineering-manager");
    const all = await readPeople(manager.cookie);
    const managed = all.people.filter((person) => ids.includes(person.id));
    expect(managed).toHaveLength(5);
    expect(managed.find(({ id }) => id === ids[0])).toMatchObject({
      startDate: "2020-01-01",
      endDate: null,
      values,
    });
    expect(await accessOf(manager.id)).toEqual([
      { action: "personal-viewed", subjectId: null },
    ]);
  });

  it("records a view when the only Personal details are in a column, and not when there is no one", async () => {
    const leadership = await test.signedIn("executive");
    const { cookie } = await editor();
    await columnWith(cookie, ["Fictional Confidential"], {
      visibility: "confidential",
    });
    await addPerson(cookie);
    const read = await readPeople(leadership.cookie);
    expect(read.people.length).toBeGreaterThan(0);
    expect(await accessOf(leadership.id)).toHaveLength(1);
  });

  it("orders people by preferred name, ignoring letter case", async () => {
    const { cookie } = await editor();
    const prefix = unique("Ordered");
    const { ids } = await addPeople(cookie, [
      { preferredName: `${prefix} b` },
      { preferredName: `${prefix} A` },
    ]);
    const names = (await readPeople(cookie)).people
      .filter(({ id }) => ids.includes(id))
      .map(({ preferredName }) => preferredName);
    expect(names).toEqual([`${prefix} A`, `${prefix} b`]);
  });
});

describe("access history", () => {
  // The entries an account's history reader sees for one actor.
  async function entriesBy(reader: string, actorId: string) {
    const response = await send(reader, "GET", "/api/access-history");
    return response
      .json<{
        entries: {
          action: string;
          actor: { id: string } | null;
          subject: { id: string; name: string | null } | null;
        }[];
      }>()
      .entries.filter(
        // Reading People also reads the planned hires other tests add, which hires.test.ts covers.
        ({ actor, action }) =>
          actor?.id === actorId &&
          action !== "hiring-plan-viewed" &&
          action !== "signed-in",
      )
      .map(({ action, subject }) => [action, subject]);
  }

  it("records a view of Personal details once a day, and names whose details changed only to readers who may see people", async () => {
    const { cookie, id: editorId } = await editor();
    const name = unique("Fictional Named");
    const { id } = await addLivePerson(cookie, {
      preferredName: name,
      startDate: "2023-01-01",
    });
    await readPeople(cookie);
    await readPeople(cookie);
    const administrator = await test.signedIn("administrator");
    expect(await entriesBy(administrator.cookie, editorId)).toEqual([
      ["personal-viewed", null],
      // A person has no account, so no email address.
      ["personal-changed", { id, name: null, email: null }],
    ]);
    const seesPeople = await test.signedIn([
      "administration:view",
      "people:view",
    ]);
    expect(await entriesBy(seesPeople.cookie, editorId)).toEqual([
      ["personal-viewed", null],
      ["personal-changed", { id, name, email: null }],
    ]);
  });
});
