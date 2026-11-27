// SPDX-License-Identifier: Apache-2.0

// What the tests of each type of added column share, against a migrated PostgreSQL server: adding a
// column of the type and giving people its values, and who sees a Personal or Confidential column of
// it, live, in drafts, on planned hires, in the change history, the access history and exports.

import { accessHistory, fieldValues } from "@fathom/db";
import {
  type Activity,
  type ChangeHistory,
  type ColumnValueMap,
  type Feature,
  type FieldType,
  type Field,
  type Hire,
  type Permission,
  type Person,
  type ProjectPlan,
  startingRoles,
} from "@fathom/shared";
import { and, eq } from "drizzle-orm";
import { beforeAll, describe, expect, it } from "vitest";
import { rolesGranting } from "./access.ts";
import {
  errorOf,
  generalReader,
  ok,
  sender,
  type TestApp,
  testPosition,
  unique,
} from "./test-app.ts";

// A type of added column, the map its values are sent and read in, and two values of it.
export interface ColumnKind {
  type: FieldType;
  map: ColumnValueMap;
  // A name for its columns, made unique for each.
  name: string;
  value: unknown;
  // A value a draft changes it to, or null for one emptying it.
  changed: unknown;
  // The value, and none, as the change history shows them.
  inHistory: unknown;
  noneInHistory: unknown;
}

export interface ColumnSettings {
  visibility?: string;
  table?: string;
  multiline?: boolean;
  onPlannedHires?: boolean;
}

// What every type of column holding one value does with its values, beyond People: planned hires'
// values, refused on a column not offered on them, features' and activities' values, and each
// person's value recorded as removed when its column is deleted.
export function describeColumnValues(test: () => TestApp, kind: ColumnKind) {
  const {
    send,
    editor,
    valued,
    column,
    addedId,
    newHire,
    addedHireId,
    approve,
    readPerson,
    readHire,
    valuesOf,
  } = addedColumnTests(test, kind);
  const editsPlan = () =>
    test().signedIn([
      ...startingRoles["workforce-administrator"].permissions,
      "features:edit",
    ]);

  describe(`${kind.type} columns' values`, () => {
    it("are refused in a column of another type", async () => {
      const { cookie } = await editor();
      const { field } = await ok<{ field: Field }>(
        await send(cookie, "POST", "/api/people/columns", {
          name: unique("Fictional Notes"),
          type: "note",
          visibility: "general",
        }),
        201,
      );
      await test().approveLists();
      const id = await addedId(cookie);
      const response = await send(
        cookie,
        "PATCH",
        `/api/people/${id}`,
        valued({ [field.id]: kind.value }),
      );
      expect(errorOf(response)).toBe("There is no such column");
    });

    it("come back when a change to them is undone", async () => {
      const { cookie } = await editor();
      const { id: fieldId } = await column(cookie);
      const id = await addedId(cookie, { [fieldId]: kind.value });
      await approve({ people: [id] });
      const { changeSetId } = await ok<{ changeSetId: string }>(
        await send(
          cookie,
          "PATCH",
          `/api/people/${id}`,
          valued({ [fieldId]: kind.changed }),
        ),
      );
      await ok(await send(cookie, "POST", `/api/undo/${changeSetId}`));
      const person = await readPerson(cookie, id);
      expect(valuesOf(person)).toEqual({ [fieldId]: kind.value });
      expect(person?.draft).toBeUndefined();
    });

    it("are kept for a planned hire, and shown live beside its draft", async () => {
      const { cookie } = await editor();
      const { id: fieldId } = await column(cookie);
      const id = await addedHireId(cookie, { [fieldId]: kind.value });
      await approve({ plannedHires: [id] });
      await send(
        cookie,
        "PATCH",
        `/api/planned-hires/${id}`,
        valued({ [fieldId]: kind.changed }),
      );
      const hire = await readHire(cookie, id);
      expect(valuesOf(hire)).toEqual(
        kind.changed === null ? {} : { [fieldId]: kind.changed },
      );
      expect(valuesOf(hire?.draft?.live)).toEqual({ [fieldId]: kind.value });
    });

    it("are refused on a planned hire for a column not offered on planned hires", async () => {
      const { cookie } = await editor();
      const field = await column(cookie, { onPlannedHires: false });
      const response = await send(
        cookie,
        "POST",
        "/api/planned-hires",
        newHire({ [field.id]: kind.value }),
      );
      expect(errorOf(response)).toBe(
        `${field.name} is switched off for planned hires`,
      );
    });

    it("are kept with a feature, and shown live beside its draft", async () => {
      const { id: fieldId } = await column((await editsPlan()).cookie, {
        table: "features",
      });
      const planner = await test().signedIn("product-manager");
      const name = unique("Fictional Feature");
      const { plan } = await ok<{ plan: ProjectPlan }>(
        await send(planner.cookie, "POST", "/api/features", {
          records: [{ name, ...valued({ [fieldId]: kind.value }) }],
        }),
        201,
      );
      const feature = plan.features.find((one) => one.name === name) as Feature;
      expect(valuesOf(feature)).toEqual({ [fieldId]: kind.value });
      expect(valuesOf(feature.draft?.live)).toEqual({});
    });

    it("are kept with an activity", async () => {
      const { id: fieldId } = await column((await editsPlan()).cookie, {
        table: "activities",
      });
      const planner = await test().signedIn("product-manager");
      const project = unique("Fictional Project");
      const made = await ok<{ plan: ProjectPlan }>(
        await send(planner.cookie, "POST", "/api/projects", {
          records: [{ name: project }],
        }),
        201,
      );
      const projectId = made.plan.projects.find(
        (one) => one.name === project,
      )?.id;
      const name = unique("Fictional Activity");
      const { plan } = await ok<{ plan: ProjectPlan }>(
        await send(planner.cookie, "POST", "/api/activities", {
          records: [{ name, projectId, ...valued({ [fieldId]: kind.value }) }],
        }),
        201,
      );
      const activity = plan.activities.find(
        (one) => one.name === name,
      ) as Activity;
      expect(valuesOf(activity)).toEqual({ [fieldId]: kind.value });
    });

    it("are recorded as removed when their column is deleted, leaving no row", async () => {
      const { cookie } = await editor();
      const field = await column(cookie);
      const id = await addedId(cookie, { [field.id]: kind.value });
      await approve({ people: [id] });
      await ok(await send(cookie, "DELETE", `/api/people/columns/${field.id}`));
      await test().approveLists();
      const history = await ok<ChangeHistory>(
        await send(cookie, "GET", "/api/changes"),
      );
      const removed = history.entries[0]?.records.find(
        ({ kind: recordKind }) => recordKind === "person",
      );
      expect(removed?.fields).toEqual([
        {
          field: "value",
          column: field.name,
          oldValue: kind.inHistory,
          newValue: kind.noneInHistory,
        },
      ]);
      expect(
        await test()
          .connection.select({ fieldId: fieldValues.fieldId })
          .from(fieldValues)
          .where(eq(fieldValues.fieldId, field.id)),
      ).toEqual([]);
    });
  });
}

// The requests the tests of a type of column make, as the Workforce Administrator unless told
// otherwise.
export function addedColumnTests(test: () => TestApp, kind: ColumnKind) {
  const send = sender(test);
  const editor = () => test().signedIn("workforce-administrator");
  const valued = (values: object) => ({ [kind.map]: values });

  async function column(
    cookie: string,
    settings: ColumnSettings = {},
  ): Promise<Field> {
    const { field } = await ok<{ field: Field }>(
      await send(cookie, "POST", `/api/${settings.table ?? "people"}/columns`, {
        name: unique(kind.name),
        type: kind.type,
        visibility: settings.visibility ?? "general",
        onPlannedHires: settings.onPlannedHires ?? settings.table === undefined,
        ...(settings.multiline === undefined
          ? {}
          : { multiline: settings.multiline }),
      }),
      201,
    );
    await test().approveLists();
    return field;
  }

  const newPerson = (values: object = {}) => ({
    people: [
      {
        preferredName: unique("Fictional Person"),
        employeeId: unique("F"),
        positionId: testPosition,
        ...valued(values),
      },
    ],
  });

  async function addedId(cookie: string, values: object = {}) {
    const { ids } = await ok<{ ids: string[] }>(
      await send(cookie, "POST", "/api/people", newPerson(values)),
      201,
    );
    return String(ids[0]);
  }

  const newHire = (values: object) => ({
    hires: [
      {
        positionId: testPosition,
        targetDate: "2099-03-15",
        ...valued(values),
      },
    ],
  });

  async function addedHireId(cookie: string, values: object) {
    const { ids } = await ok<{ ids: string[] }>(
      await send(cookie, "POST", "/api/planned-hires", newHire(values)),
      201,
    );
    return String(ids[0]);
  }

  async function approve(body: object) {
    const { cookie } = await test().signedIn("engineering-director");
    await ok(await send(cookie, "POST", "/api/drafts/approval", body));
  }

  async function readPerson(cookie: string, id: string) {
    const { people } = await ok<{ people: Person[] }>(
      await send(cookie, "GET", "/api/people"),
    );
    return people.find((person) => person.id === id);
  }

  async function readHire(cookie: string, id: string) {
    const { hires } = await ok<{ hires: Hire[] }>(
      await send(cookie, "GET", "/api/planned-hires"),
    );
    return hires.find((hire) => hire.id === id);
  }

  // A record's values in the type's map.
  const valuesOf = (record: object | undefined): Record<string, unknown> =>
    (new Map(Object.entries(record ?? {})).get(kind.map) ?? {}) as Record<
      string,
      unknown
    >;

  async function historyFields(cookie: string) {
    const history = await ok<ChangeHistory>(
      await send(cookie, "GET", "/api/changes"),
    );
    return history.entries.flatMap((entry) =>
      entry.records.flatMap((record) => record.fields),
    );
  }

  return {
    send,
    editor,
    valued,
    column,
    newPerson,
    addedId,
    newHire,
    addedHireId,
    approve,
    readPerson,
    readHire,
    valuesOf,
    historyFields,
  };
}

const classes = {
  personal: { sees: "personal:view", exported: "personalColumns" },
  confidential: { sees: "confidential:view", exported: "confidentialColumns" },
} as const satisfies Record<string, { sees: Permission; exported: string }>;

// Who sees a column of the type in a class beyond General: every role that sees people, live and in
// drafts, a planned hire's placeholder, the change history, the access history, an export, and who
// may change or send its values.
export function describeClassedColumn(
  test: () => TestApp,
  kind: ColumnKind,
  visibility: keyof typeof classes,
) {
  // The class is always one of the fixed classes.
  // eslint-disable-next-line security/detect-object-injection
  const { sees, exported } = classes[visibility];
  const {
    send,
    editor,
    valued,
    column,
    addedId,
    addedHireId,
    approve,
    readPerson,
    readHire,
    valuesOf,
    historyFields,
  } = addedColumnTests(test, kind);

  describe(`who sees a ${visibility} ${kind.type} column`, () => {
    let field: Field;
    let personId = "";
    let draftedId = "";
    let hireId = "";

    // A person with a value, one whose draft changes it, and a planned hire with one.
    beforeAll(async () => {
      const { cookie } = await editor();
      field = await column(cookie, { visibility });
      personId = await addedId(cookie, { [field.id]: kind.value });
      draftedId = await addedId(cookie, { [field.id]: kind.value });
      hireId = await addedHireId(cookie, { [field.id]: kind.value });
      await approve({ people: [personId, draftedId], plannedHires: [hireId] });
      await send(cookie, "PATCH", `/api/people/${draftedId}`, {
        ...valued({ [field.id]: kind.changed }),
      });
      await send(cookie, "POST", "/api/unpublished/publish", {});
    });

    it.each(rolesGranting("people:view"))(
      `a %s, a role that sees people, sees its values, live and in a draft, only if the role sees ${visibility} data`,
      async (role) => {
        const { cookie } = await test().signedIn(role);
        const shown = rolesGranting(sees).includes(role);
        const person = await readPerson(cookie, personId);
        const drafted = await readPerson(cookie, draftedId);
        expect(field.id in valuesOf(person)).toBe(shown);
        expect(field.id in valuesOf(drafted?.draft?.live)).toBe(shown);
      },
    );

    it("leaves a planned hire's value out of the placeholder a role without the class sees", async () => {
      const { cookie: planner } = await test().signedIn(generalReader);
      expect(valuesOf(await readHire(planner, hireId))).toEqual({});
      const { cookie } = await editor();
      expect(valuesOf(await readHire(cookie, hireId))).toEqual({
        [field.id]: kind.value,
      });
    });

    it.each(rolesGranting("plan:view"))(
      `a %s, a role that sees the change history, sees changes to its values only if the role sees ${visibility} data`,
      async (role) => {
        const { cookie } = await test().signedIn(role);
        const columns = (await historyFields(cookie)).map(
          ({ column: name }) => name,
        );
        expect(columns.includes(field.name)).toBe(
          rolesGranting(sees).includes(role),
        );
      },
    );

    it("records a reader's view of its changes in the access history", async () => {
      // Only the column's own class, so no Personal value elsewhere in the history can answer.
      const reader = await test().signedIn(["plan:view", "people:view", sees]);
      await ok(await send(reader.cookie, "GET", "/api/changes"));
      const viewed = await test()
        .connection.select({ action: accessHistory.action })
        .from(accessHistory)
        .where(eq(accessHistory.actorId, reader.id));
      expect(viewed.map(({ action }) => action)).toContain("personal-viewed");
    });

    it(`is named as ${visibility} when exported`, async () => {
      const reader = await test().signedIn([
        ...new Set<Permission>(["people:view", "personal:view", sees]),
      ]);
      await ok(
        await send(reader.cookie, "POST", "/api/exports", {
          table: "people",
          columns: ["preferredName", field.id],
        }),
      );
      const [entry] = await test()
        .connection.select({ details: accessHistory.details })
        .from(accessHistory)
        .where(
          and(
            eq(accessHistory.actorId, reader.id),
            eq(accessHistory.action, "data-exported"),
          ),
        );
      expect(entry?.details).toEqual({
        exported: "People",
        [exported]: [field.name],
      });
    });

    it(`refuses a value from someone who may change people but not ${visibility} data`, async () => {
      const who = await test().signedIn(["people:edit", "people:view"]);
      const response = await send(
        who.cookie,
        "PATCH",
        `/api/people/${personId}`,
        valued({ [field.id]: kind.changed }),
      );
      expect(response.statusCode).toBe(403);
    });

    it("refuses a value from someone signed out", async () => {
      const response = await test().app.inject({
        method: "PATCH",
        url: `/api/people/${personId}`,
        headers: { origin: "https://fathom.example.test" },
        payload: valued({ [field.id]: kind.changed }),
      });
      expect(response.statusCode).toBe(401);
    });
  });
}
