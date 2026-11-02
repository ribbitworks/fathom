// SPDX-License-Identifier: Apache-2.0

// Tests for required columns on the People table, against a PostgreSQL server of their own, since
// whether a column can be required depends on everyone in Fathom: a column can be added as required
// only while there is no one yet, made required once everyone has a value, live and in drafts, and
// then every person needs one, including a person brought back by undoing a draft's discarding.

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

// Approves the drafts of the people given, as an Approver who sees every tier.
async function approve(ids: readonly string[]) {
  const { cookie } = await test.signedIn(["approver", "leadership"]);
  const response = await test.request(cookie, "POST", "/api/drafts/approval", {
    people: ids,
  });
  expect(response.statusCode).toBe(200);
}

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
    await test.approveLists();
    const addColumn = async (name: string, required: boolean) => {
      const response = await test.request(
        cookie,
        "POST",
        "/api/people/columns",
        {
          name,
          listId: list.id,
          required,
        },
      );
      await test.approveLists();
      return response;
    };

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
    const first = await test.request(cookie, "POST", "/api/people", {
      people: [person],
    });
    expect(first.statusCode).toBe(201);
    const [firstId = ""] = first.json<{ ids: string[] }>().ids;
    const missing = await test.request(cookie, "POST", "/api/people", {
      people: [{ ...person, employeeId: "E-2", values: {} }],
    });
    expect(missing.statusCode).toBe(400);
    expect(missing.json()).toEqual({ error: "Site must be filled in" });

    // A draft that adds someone without a value keeps a column from becoming required.
    expect((await addColumn("Desk", true)).json()).toEqual({
      error: "Drafts leave Desk empty, so it cannot be required yet",
    });
    await approve([firstId]);
    const made = await test.request(
      cookie,
      "PUT",
      `/api/people/columns/${optional.id}`,
      { name: "Office", listId: list.id, required: true },
    );
    expect(made.statusCode).toBe(200);
    expect(made.json<{ field: Field }>().field.required).toBe(true);
    await test.approveLists();
    expect((await addColumn("Desk", true)).json()).toEqual({
      error: "1 person has no Desk, so it cannot be required yet",
    });

    // So does a draft that clears someone's value.
    const desk = (await addColumn("Desk", false)).json<{ field: Field }>()
      .field;
    const deskRequest = { name: "Desk", listId: list.id, required: true };
    const given = await test.request(
      cookie,
      "PATCH",
      `/api/people/${firstId}`,
      {
        values: { [desk.id]: [String(choice?.id)] },
      },
    );
    expect(given.statusCode).toBe(200);
    await approve([firstId]);
    await test.request(cookie, "PATCH", `/api/people/${firstId}`, {
      values: { [desk.id]: [] },
    });
    expect(
      (
        await test.request(
          cookie,
          "PUT",
          `/api/people/columns/${desk.id}`,
          deskRequest,
        )
      ).json(),
    ).toEqual({
      error: "Drafts leave Desk empty, so it cannot be required yet",
    });
    await test.request(cookie, "DELETE", `/api/people/${firstId}/draft`);

    // A person whose draft was discarded before a column became required cannot come back without
    // its value.
    const added = await test.request(cookie, "POST", "/api/people", {
      people: [{ ...person, employeeId: "E-3" }],
    });
    const [deskless] = added.json<{ ids: string[] }>().ids;
    const deleted = await test.request(
      cookie,
      "DELETE",
      `/api/people/${String(deskless)}`,
    );
    expect(
      (
        await test.request(
          cookie,
          "PUT",
          `/api/people/columns/${desk.id}`,
          deskRequest,
        )
      ).statusCode,
    ).toBe(200);
    await test.approveLists();
    const undone = await test.request(
      cookie,
      "POST",
      `/api/undo/${deleted.json<{ changeSetId: string }>().changeSetId}`,
    );
    expect(undone.statusCode).toBe(409);
  });
});
