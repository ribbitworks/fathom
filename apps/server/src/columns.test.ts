// SPDX-License-Identifier: Apache-2.0

// Tests for required columns on the People table, against a PostgreSQL server of their own, since
// whether a column can be required depends on everyone in Fathom: a column can be added as required
// only while there is no one yet, made required once everyone has a value, and then every person
// needs one, including a person brought back by undoing their deletion.

import type { Choice, Field, List } from "@fathom/shared";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { startTestApp, type TestApp } from "./test-app.ts";

let test: TestApp;

beforeAll(async () => {
  test = await startTestApp();
});

afterAll(async () => {
  await test.close();
});

describe("required columns", () => {
  it("can be added while there is no one, made required once everyone has a value, and then must be filled in", async () => {
    const { cookie } = await test.signedIn([
      "workforce-administrator",
      "viewer",
    ]);
    const list = (
      await test.request(cookie, "POST", "/api/lists", {
        name: "Fictional Sites",
      })
    ).json<{ list: List }>().list;
    const [choice] = (
      await test.request(cookie, "POST", `/api/lists/${list.id}/choices`, {
        choices: [{ label: "Fictional Harbour" }],
      })
    ).json<{ choices: Choice[] }>().choices;
    const addColumn = async (name: string, required: boolean) =>
      test.request(cookie, "POST", "/api/people/columns", {
        name,
        listId: list.id,
        required,
      });

    const site = await addColumn("Site", true);
    expect(site.statusCode).toBe(201);
    const siteId = site.json<{ field: Field }>().field.id;
    const optional = (await addColumn("Office", false)).json<{ field: Field }>()
      .field;

    const person = {
      preferredName: "Fictional Person",
      employeeId: "E-1",
      values: {
        [siteId]: [String(choice?.id)],
        [optional.id]: [String(choice?.id)],
      },
    };
    expect(
      (await test.request(cookie, "POST", "/api/people", { people: [person] }))
        .statusCode,
    ).toBe(201);
    const missing = await test.request(cookie, "POST", "/api/people", {
      people: [{ ...person, employeeId: "E-2", values: {} }],
    });
    expect(missing.statusCode).toBe(400);
    expect(missing.json()).toEqual({ error: "Site must be filled in" });

    const made = await test.request(
      cookie,
      "PUT",
      `/api/people/columns/${optional.id}`,
      { name: "Office", listId: list.id, required: true },
    );
    expect(made.statusCode).toBe(200);
    expect(made.json<{ field: Field }>().field.required).toBe(true);
    expect((await addColumn("Desk", true)).json()).toEqual({
      error: "1 person has no Desk, so it cannot be required yet",
    });

    // A person deleted before a column became required cannot come back without its value.
    const desk = (await addColumn("Desk", false)).json<{ field: Field }>()
      .field;
    const added = await test.request(cookie, "POST", "/api/people", {
      people: [{ ...person, employeeId: "E-3" }],
    });
    const [deskless] = added.json<{ ids: string[] }>().ids;
    const deleted = await test.request(
      cookie,
      "DELETE",
      `/api/people/${String(deskless)}`,
    );
    const [first] = (await test.request(cookie, "GET", "/api/people")).json<{
      people: { id: string }[];
    }>().people;
    await test.request(cookie, "PATCH", `/api/people/${String(first?.id)}`, {
      values: { [desk.id]: [String(choice?.id)] },
    });
    await test.request(cookie, "PUT", `/api/people/columns/${desk.id}`, {
      name: "Desk",
      listId: list.id,
      required: true,
    });
    const undone = await test.request(
      cookie,
      "POST",
      `/api/undo/${deleted.json<{ changeSetId: string }>().changeSetId}`,
    );
    expect(undone.statusCode).toBe(409);
  });
});
