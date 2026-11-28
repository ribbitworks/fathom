// SPDX-License-Identifier: Apache-2.0

// Tests for Link to another table columns, against a migrated PostgreSQL server: adding one, its
// table kept, one record or several, a record that doesn't exist refused, features linked; with
// what every type of column shares, and who sees a Personal or Confidential one.

import { type Field, type Person, startingRoles } from "@fathom/shared";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  approvedPerson,
  errorOf,
  moveClass,
  ok,
  startTestApp,
  type TestApp,
  unique,
} from "./test-app.ts";
import {
  addedColumnTests,
  type ColumnKind,
  describeClassedColumn,
  describeColumnValues,
} from "./test-added-columns.ts";

let test: TestApp;

// The people the tests link to, made before them, with their names as the history shows them.
const linked: { ids: string[]; names: string[] } = { ids: [], names: [] };

const mentor: ColumnKind = {
  type: "record",
  map: "linked",
  name: "Fictional Mentor",
  get value() {
    return [linked.ids[0]];
  },
  get changed() {
    return [linked.ids[1]];
  },
  get inHistory() {
    return [linked.names[0]];
  },
  get changedInHistory() {
    return [linked.names[1]];
  },
  noneInHistory: null,
  get stored() {
    return { column: "linkedPersonId" as const, value: linked.ids[0] };
  },
  settings: { linkedTable: "people" },
  // Features and Activities link only to Features, which their readers all see.
  onPlan: false,
};

const { send, editor, column, addedId, approve, readPerson } = addedColumnTests(
  () => test,
  mentor,
);

beforeAll(async () => {
  test = await startTestApp();
  const { cookie } = await editor();
  for (const name of ["Fictional Mentor Ada", "Fictional Mentor Bo"]) {
    const preferredName = unique(name);
    linked.names.push(preferredName);
    linked.ids.push(
      await approvedPerson(test, cookie, (id) => approve({ people: [id] }), {
        preferredName,
      }),
    );
  }
});

afterAll(async () => {
  await test.close();
});

const linkedOf = (person: Person | undefined) =>
  new Map(Object.entries(person?.linked ?? {}));

describe("adding link columns", () => {
  it("adds one linking to a table, taking several records if asked", async () => {
    const { cookie } = await editor();
    expect(
      await column(cookie, { visibility: "personal" }).then(
        ({ type, listId, visibility, linkedTable }) => ({
          type,
          listId,
          visibility,
          linkedTable,
        }),
      ),
    ).toEqual({
      type: "record",
      listId: null,
      visibility: "personal",
      linkedTable: "people",
    });
  });

  it("refuses linking People to Features, which some who see People can't see", async () => {
    const { cookie } = await editor();
    const response = await send(cookie, "POST", "/api/people/columns", {
      name: unique("Fictional Main Feature"),
      type: "record",
      visibility: "general",
      linkedTable: "features",
    });
    expect(errorOf(response)).toBe("People columns can't link to Features yet");
  });

  it("keeps its table when its class moves while it is only drafted", async () => {
    const { cookie } = await editor();
    const { field } = await ok<{ field: Field }>(
      await send(cookie, "POST", "/api/people/columns", {
        name: unique(mentor.name),
        type: "record",
        visibility: "general",
        linkedTable: "people",
      }),
      201,
    );
    await moveClass(test, `/api/columns/${field.id}/class`, "personal");
    const { fields } = await ok<{ fields: Field[] }>(
      await send(cookie, "GET", "/api/people"),
    );
    expect(fields.find(({ id }) => id === field.id)).toMatchObject({
      linkedTable: "people",
      visibility: "personal",
    });
  });

  it("keeps its table when the column is changed", async () => {
    const { cookie } = await editor();
    const field = await column(cookie);
    const response = await send(
      cookie,
      "PUT",
      `/api/people/columns/${field.id}`,
      {
        name: field.name,
        type: "record",
        visibility: "general",
        linkedTable: "features",
      },
    );
    expect(errorOf(response)).toBe("A link column's table cannot change");
  });
});

describe("a link column's records", () => {
  const severalColumn = async (cookie: string): Promise<Field> => {
    const { field } = await ok<{ field: Field }>(
      await send(cookie, "POST", "/api/people/columns", {
        name: unique("Fictional Buddies"),
        type: "record",
        visibility: "general",
        linkedTable: "people",
        multiple: true,
      }),
      201,
    );
    await test.approveLists();
    return field;
  };

  it("are several in a column taking several, kept in one order however they're asked for", async () => {
    const { cookie } = await editor();
    const field = await severalColumn(cookie);
    const ids = [...linked.ids].sort();
    const id = await addedId(cookie, { [field.id]: [...ids].reverse() });
    await approve({ people: [id] });
    expect(linkedOf(await readPerson(cookie, id)).get(field.id)).toEqual(ids);
    const saved = await send(cookie, "PATCH", `/api/people/${id}`, {
      linked: { [field.id]: [...ids].reverse() },
    });
    expect(saved.json()).toEqual({ changeSetId: null });
  });

  it("can't be made to take one record while a value links to several", async () => {
    const { cookie } = await editor();
    const field = await severalColumn(cookie);
    const id = await addedId(cookie, { [field.id]: linked.ids });
    await approve({ people: [id] });
    const response = await send(
      cookie,
      "PUT",
      `/api/people/columns/${field.id}`,
      {
        name: field.name,
        type: "record",
        visibility: "general",
        linkedTable: "people",
        multiple: false,
      },
    );
    expect(response.statusCode).toBe(409);
  });

  it("keep a linked person from being removed until the link is", async () => {
    const { cookie } = await editor();
    const field = await column(cookie);
    const target = await addedId(cookie);
    await approve({ people: [target] });
    const linking = await addedId(cookie, { [field.id]: [target] });
    await approve({ people: [linking] });
    await ok(await send(cookie, "DELETE", `/api/people/${target}`));
    const { cookie: director } = await test.signedIn("engineering-director");
    const refused = await send(director, "POST", "/api/drafts/approval", {
      people: [target],
    });
    expect(errorOf(refused)).toBe(
      `This is linked from ${field.name}; remove that link first`,
    );
  });

  it("are refused as several in a column taking one", async () => {
    const { cookie } = await editor();
    const field = await column(cookie);
    const id = await addedId(cookie);
    const response = await send(cookie, "PATCH", `/api/people/${id}`, {
      linked: { [field.id]: linked.ids },
    });
    expect(errorOf(response)).toBe(`${field.name} takes one record`);
  });

  it("are refused when one doesn't exist", async () => {
    const { cookie } = await editor();
    const field = await column(cookie);
    const id = await addedId(cookie);
    const response = await send(cookie, "PATCH", `/api/people/${id}`, {
      linked: { [field.id]: ["40000000-0000-4000-8000-000000000001"] },
    });
    expect(errorOf(response)).toBe(
      `${field.name} links to a record that no longer exists`,
    );
  });

  it("link a feature to another, kept in the values table's own column", async () => {
    const planner = await test.signedIn("product-manager");
    const { cookie: director } = await test.signedIn("engineering-director");
    const featureIdNamed = (
      features: { id: string; name: string }[],
      name: string,
    ) => String(features.find((feature) => feature.name === name)?.id);
    const linkedName = unique("Fictional Feature");
    const { plan } = await ok<{
      plan: { features: { id: string; name: string }[] };
    }>(
      await send(planner.cookie, "POST", "/api/features", {
        records: [{ name: linkedName }],
      }),
      201,
    );
    const linkedId = featureIdNamed(plan.features, linkedName);
    await ok(
      await send(director, "POST", "/api/drafts/approval", {
        records: [{ type: "feature", id: linkedId }],
      }),
    );
    const { cookie } = await test.signedIn([
      ...startingRoles["workforce-administrator"].permissions,
      "features:edit",
    ]);
    const { field } = await ok<{ field: Field }>(
      await send(cookie, "POST", "/api/features/columns", {
        name: unique("Fictional Depends On"),
        type: "record",
        visibility: "general",
        linkedTable: "features",
      }),
      201,
    );
    await test.approveLists();
    const name = unique("Fictional Feature");
    const { plan: after } = await ok<{
      plan: {
        features: {
          id: string;
          name: string;
          linked: Record<string, string[]>;
        }[];
      };
    }>(
      await send(planner.cookie, "POST", "/api/features", {
        records: [{ name, linked: { [field.id]: [linkedId] } }],
      }),
      201,
    );
    expect(
      after.features.find((feature) => feature.name === name)?.linked,
    ).toEqual({ [field.id]: [linkedId] });
  });
});

describeColumnValues(() => test, mentor);

describeClassedColumn(() => test, mentor, "personal");
describeClassedColumn(() => test, mentor, "confidential");
