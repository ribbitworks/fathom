// SPDX-License-Identifier: Apache-2.0

// Integration tests for who may discard a draft, for every kind of record: only someone who changed
// it since it was last approved or discarded, whatever else their role may change; others reject
// it instead.

import type { Choice, Field, List, Person, ProjectPlan } from "@fathom/shared";
import { type Role } from "@fathom/shared";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  addingOne,
  errorOf,
  ok,
  startTestApp,
  type TestApp,
  testPosition,
  unique,
  type User,
} from "./test-app.ts";

const refusal = "Only someone who changed this draft can discard it.";

let test: TestApp;
const users = new Map<Role, { maker: User; other: User }>();

beforeAll(async () => {
  test = await startTestApp();
  for (const role of ["workforce-administrator", "product-manager"] as const) {
    users.set(role, {
      maker: await test.signedIn(role),
      other: await test.signedIn(role),
    });
  }
});
afterAll(async () => {
  await test.close();
});

const send = (
  who: User,
  method: "GET" | "POST" | "PUT" | "PATCH" | "DELETE",
  url: string,
  payload?: object,
  options?: { publish?: boolean },
) => test.request(who.cookie, method, url, payload, options);

// A live list of two choices, made and approved as the user given.
async function liveList(who: User): Promise<{ list: List; choices: Choice[] }> {
  const { list } = await ok<{ list: List }>(
    await send(who, "POST", "/api/lists", { name: unique("Fictional List") }),
    201,
  );
  const { choices } = await ok<{ choices: Choice[] }>(
    await send(who, "POST", `/api/lists/${list.id}/choices`, {
      choices: [{ label: "Fictional North" }, { label: "Fictional South" }],
    }),
    201,
  );
  await test.approveLists();
  return { list, choices };
}

const column = { type: "note", visibility: "general" };

// A draft of each kind, made by the user given: where discarding it is sent, and, for a record only
// drafted to be added, where removing it, which discards its draft, is sent.
interface Drafted {
  discard: string;
  remove?: string;
}

const kinds: [string, Role, (who: User) => Promise<Drafted>][] = [
  [
    "a person",
    "workforce-administrator",
    async (who) => {
      const { ids } = await ok<{ ids: string[] }>(
        await send(who, "POST", "/api/people", {
          people: [
            {
              preferredName: unique("Fictional Person"),
              employeeId: unique("FP"),
              positionId: testPosition,
            },
          ],
        }),
        201,
      );
      const id = String(ids[0]);
      return {
        discard: `/api/people/${id}/draft`,
        remove: `/api/people/${id}`,
      };
    },
  ],
  [
    "a planned hire",
    "workforce-administrator",
    async (who) => {
      const { ids } = await ok<{ ids: string[] }>(
        await send(who, "POST", "/api/planned-hires", {
          hires: [{ positionId: testPosition, targetDate: "2027-03-15" }],
        }),
        201,
      );
      const id = String(ids[0]);
      return {
        discard: `/api/planned-hires/${id}/draft`,
        remove: `/api/planned-hires/${id}`,
      };
    },
  ],
  [
    "a feature team",
    "workforce-administrator",
    async (who) => {
      const { id } = await ok<{ id: string }>(
        await send(who, "POST", "/api/feature-teams", {
          name: unique("Fictional Feature Team"),
        }),
        201,
      );
      return {
        discard: `/api/feature-teams/${id}/draft`,
        remove: `/api/feature-teams/${id}`,
      };
    },
  ],
  [
    "a plan record",
    "product-manager",
    async (who) => {
      const name = unique("Fictional Customer");
      const { plan } = await ok<{ plan: ProjectPlan }>(
        await send(who, "POST", "/api/customers", addingOne({ name })),
        201,
      );
      const id = String(plan.customers.find((one) => one.name === name)?.id);
      return {
        discard: `/api/records/customer/${id}/draft`,
        remove: `/api/customers/${id}`,
      };
    },
  ],
  [
    "a list",
    "workforce-administrator",
    async (who) => {
      const { list } = await ok<{ list: List }>(
        await send(who, "POST", "/api/lists", {
          name: unique("Fictional List"),
        }),
        201,
      );
      return {
        discard: `/api/lists/${list.id}/draft`,
        remove: `/api/lists/${list.id}`,
      };
    },
  ],
  [
    "a list's choice",
    "workforce-administrator",
    async (who) => {
      const { list } = await liveList(who);
      const { choices } = await ok<{ choices: Choice[] }>(
        await send(who, "POST", `/api/lists/${list.id}/choices`, {
          choices: [{ label: "Fictional East" }],
        }),
        201,
      );
      const path = `/api/lists/${list.id}/choices/${String(choices[0]?.id)}`;
      return { discard: `${path}/draft`, remove: path };
    },
  ],
  [
    "a list's order",
    "workforce-administrator",
    async (who) => {
      const { list, choices } = await liveList(who);
      await ok(
        await send(
          who,
          "PUT",
          `/api/lists/${list.id}/choices/${String(choices[1]?.id)}/position`,
          { after: null },
        ),
      );
      return { discard: `/api/lists/${list.id}/order/draft` };
    },
  ],
  [
    "a People column",
    "workforce-administrator",
    async (who) => {
      const { field } = await ok<{ field: Field }>(
        await send(who, "POST", "/api/people/columns", {
          name: unique("Fictional Column"),
          ...column,
        }),
        201,
      );
      return {
        discard: `/api/people/columns/${field.id}/draft`,
        remove: `/api/people/columns/${field.id}`,
      };
    },
  ],
  [
    "a Features column",
    "product-manager",
    async (who) => {
      const { field } = await ok<{ field: Field }>(
        await send(who, "POST", "/api/features/columns", {
          name: unique("Fictional Column"),
          ...column,
        }),
        201,
      );
      return {
        discard: `/api/features/columns/${field.id}/draft`,
        remove: `/api/features/columns/${field.id}`,
      };
    },
  ],
];

const pair = (role: Role) => users.get(role) as { maker: User; other: User };

describe.each(kinds)("discarding %s's draft", (_kind, role, draft) => {
  it("is refused to someone who may change it but didn't change the draft", async () => {
    // Given a draft someone else made
    const { maker, other } = pair(role);
    const { discard } = await draft(maker);

    // When another who may change it discards it
    const response = await send(other, "DELETE", discard);

    // Then they are refused, and the draft stays
    expect([response.statusCode, errorOf(response)]).toEqual([403, refusal]);
    expect((await send(maker, "DELETE", discard)).statusCode).toBe(200);
  });
});

// A list's order is never only drafted to be added, so is never removed.
describe.each(kinds.filter(([kind]) => kind !== "a list's order"))(
  "removing %s only drafted to be added",
  (_kind, role, draft) => {
    it("is refused to someone who didn't change its draft, since it discards it", async () => {
      const { maker, other } = pair(role);
      const { remove } = await draft(maker);

      const response = await send(other, "DELETE", String(remove));

      expect([response.statusCode, errorOf(response)]).toEqual([403, refusal]);
    });
  },
);

describe("a draft's makers", () => {
  const madePerson = async (who: User, options?: { publish?: boolean }) => {
    const { ids } = await ok<{ ids: string[] }>(
      await send(
        who,
        "POST",
        "/api/people",
        {
          people: [
            {
              preferredName: unique("Fictional Person"),
              employeeId: unique("FP"),
              positionId: testPosition,
            },
          ],
        },
        options,
      ),
      201,
    );
    return String(ids[0]);
  };

  const draftOf = async (who: User, id: string) =>
    (
      await ok<{ people: Person[] }>(await send(who, "GET", "/api/people"))
    ).people.find((one) => one.id === id)?.draft;

  it("may each discard it, once they have changed it too", async () => {
    // Given a person drafted by one, then changed by another
    const { maker, other } = pair("workforce-administrator");
    const id = await madePerson(maker);
    await ok(
      await send(other, "PATCH", `/api/people/${id}`, {
        preferredName: unique("Fictional Renamed"),
      }),
    );

    // When the other discards the draft
    const response = await send(other, "DELETE", `/api/people/${id}/draft`);

    // Then it is discarded
    expect(response.statusCode).toBe(200);
  });

  it("include the user with unpublished changes to it", async () => {
    const { maker } = pair("workforce-administrator");
    const id = await madePerson(maker, { publish: false });

    const response = await send(
      maker,
      "DELETE",
      `/api/people/${id}/draft`,
      undefined,
      { publish: false },
    );

    expect(response.statusCode).toBe(200);
  });

  it("are marked on the draft for the user who changed it, and not for others", async () => {
    const { maker, other } = pair("workforce-administrator");
    const id = await madePerson(maker);

    expect([
      (await draftOf(maker, id))?.changedByUser,
      (await draftOf(other, id))?.changedByUser,
    ]).toEqual([true, undefined]);
  });
});
