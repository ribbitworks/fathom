// SPDX-License-Identifier: Apache-2.0

// Tests for checkbox columns, against a migrated PostgreSQL server: adding them to People and
// Features, the boxes people, planned hires and features have ticked, drafting and approving them,
// how the change history shows them, and who sees them.

import { accessHistory, fieldValues } from "@fathom/db";
import type {
  ChangeHistory,
  Feature,
  Field,
  Hire,
  Person,
  ProjectPlan,
} from "@fathom/shared";
import { startingRoles } from "@fathom/shared";
import { and, eq } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { rolesGranting } from "./access.ts";
import {
  errorOf,
  generalReader,
  ok,
  sender,
  startTestApp,
  type TestApp,
  testPosition,
  unique,
} from "./test-app.ts";

let test: TestApp;

beforeAll(async () => {
  test = await startTestApp();
});

afterAll(async () => {
  await test.close();
});

const editor = () => test.signedIn("workforce-administrator");

const send = sender(() => test);

async function checkboxColumn(
  cookie: string,
  settings: { visibility?: string; table?: string } = {},
): Promise<Field> {
  const { field } = await ok<{ field: Field }>(
    await send(cookie, "POST", `/api/${settings.table ?? "people"}/columns`, {
      name: unique("Fictional First Aider"),
      type: "flag",
      visibility: settings.visibility ?? "general",
      onPlannedHires: settings.table === undefined,
    }),
    201,
  );
  await test.approveLists();
  return field;
}

async function addedId(cookie: string, flags: object = {}) {
  const { ids } = await ok<{ ids: string[] }>(
    await send(cookie, "POST", "/api/people", {
      people: [
        {
          preferredName: unique("Fictional Person"),
          employeeId: unique("F"),
          positionId: testPosition,
          flags,
        },
      ],
    }),
    201,
  );
  return String(ids[0]);
}

async function approve(body: object) {
  const { cookie } = await test.signedIn("engineering-director");
  await ok(await send(cookie, "POST", "/api/drafts/approval", body));
}

async function readPerson(cookie: string, id: string) {
  const { people } = await ok<{ people: Person[] }>(
    await send(cookie, "GET", "/api/people"),
  );
  return people.find((person) => person.id === id);
}

const flagRows = (fieldId: string) =>
  test.connection
    .select({ flag: fieldValues.flag })
    .from(fieldValues)
    .where(eq(fieldValues.fieldId, fieldId));

describe("adding checkbox columns", () => {
  it("adds one with a class of its own, and no list", async () => {
    const { cookie } = await editor();
    const field = await checkboxColumn(cookie, { visibility: "personal" });
    expect(field).toMatchObject({
      type: "flag",
      listId: null,
      visibility: "personal",
      required: false,
    });
  });

  it("refuses one that must be filled in", async () => {
    const { cookie } = await editor();
    const response = await send(cookie, "POST", "/api/people/columns", {
      name: unique("Fictional First Aider"),
      type: "flag",
      visibility: "general",
      required: true,
    });
    expect(response.statusCode).toBe(400);
    expect(errorOf(response)).toContain("A checkbox column can't be required");
  });
});

describe("people's boxes", () => {
  it("keep a ticked box as a row of its own once approved", async () => {
    const { cookie } = await editor();
    const { id: fieldId } = await checkboxColumn(cookie);
    const id = await addedId(cookie, { [fieldId]: true });
    await approve({ people: [id] });
    expect((await readPerson(cookie, id))?.flags).toEqual({ [fieldId]: true });
    expect(await flagRows(fieldId)).toEqual([{ flag: true }]);
  });

  it("are unticked by a draft, showing the live box beside, and leave no row once approved", async () => {
    const { cookie } = await editor();
    const { id: fieldId } = await checkboxColumn(cookie);
    const id = await addedId(cookie, { [fieldId]: true });
    await approve({ people: [id] });

    await send(cookie, "PATCH", `/api/people/${id}`, {
      flags: { [fieldId]: null },
    });
    const drafted = await readPerson(cookie, id);
    expect(drafted?.flags).toEqual({});
    expect(drafted?.draft?.live.flags).toEqual({ [fieldId]: true });

    await approve({ people: [id] });
    expect(await flagRows(fieldId)).toEqual([]);
  });

  it("record nothing when an unticked box is unticked", async () => {
    const { cookie } = await editor();
    const { id: fieldId } = await checkboxColumn(cookie);
    const id = await addedId(cookie);
    await approve({ people: [id] });
    const saved = await send(cookie, "PATCH", `/api/people/${id}`, {
      flags: { [fieldId]: null },
    });
    expect(saved.json()).toEqual({ changeSetId: null });
  });

  it("refuse a box in another type of column", async () => {
    const { cookie } = await editor();
    const { field } = await ok<{ field: Field }>(
      await send(cookie, "POST", "/api/people/columns", {
        name: unique("Fictional Notes"),
        type: "note",
        visibility: "general",
      }),
      201,
    );
    await test.approveLists();
    const id = await addedId(cookie);
    const response = await send(cookie, "PATCH", `/api/people/${id}`, {
      flags: { [field.id]: true },
    });
    expect(errorOf(response)).toBe("There is no such column");
  });

  it("are recorded in the change history as ticked, then unticked", async () => {
    const { cookie } = await editor();
    const field = await checkboxColumn(cookie);
    const id = await addedId(cookie);
    await approve({ people: [id] });
    const changed = async (flags: object) => {
      await send(cookie, "PATCH", `/api/people/${id}`, { flags });
      await approve({ people: [id] });
    };
    await changed({ [field.id]: true });
    await changed({ [field.id]: null });
    const history = await ok<ChangeHistory>(
      await send(cookie, "GET", "/api/changes"),
    );
    const boxes = history.entries
      .flatMap((entry) => entry.records.flatMap((record) => record.fields))
      .filter(({ column }) => column === field.name);
    expect(boxes).toContainEqual({
      field: "value",
      column: field.name,
      oldValue: false,
      newValue: true,
    });
    expect(boxes).toContainEqual({
      field: "value",
      column: field.name,
      oldValue: true,
      newValue: false,
    });
  });

  it("come back ticked when unticking is undone", async () => {
    const { cookie } = await editor();
    const { id: fieldId } = await checkboxColumn(cookie);
    const id = await addedId(cookie, { [fieldId]: true });
    await approve({ people: [id] });
    const { changeSetId } = await ok<{ changeSetId: string }>(
      await send(cookie, "PATCH", `/api/people/${id}`, {
        flags: { [fieldId]: null },
      }),
    );
    await ok(await send(cookie, "POST", `/api/undo/${changeSetId}`));
    const person = await readPerson(cookie, id);
    expect(person?.flags).toEqual({ [fieldId]: true });
    expect(person?.draft).toBeUndefined();
  });

  it("are recorded as unticked when their column is deleted", async () => {
    const { cookie } = await editor();
    const field = await checkboxColumn(cookie);
    const id = await addedId(cookie, { [field.id]: true });
    await approve({ people: [id] });
    await ok(await send(cookie, "DELETE", `/api/people/columns/${field.id}`));
    await test.approveLists();
    const history = await ok<ChangeHistory>(
      await send(cookie, "GET", "/api/changes"),
    );
    const removed = history.entries[0]?.records.find(
      ({ kind }) => kind === "person",
    );
    expect(removed?.fields).toEqual([
      { field: "value", column: field.name, oldValue: true, newValue: false },
    ]);
    expect(await flagRows(field.id)).toEqual([]);
  });
});

describe("planned hires' boxes", () => {
  it("are kept, and shown live beside a draft", async () => {
    const { cookie } = await editor();
    const { id: fieldId } = await checkboxColumn(cookie);
    const { ids } = await ok<{ ids: string[] }>(
      await send(cookie, "POST", "/api/planned-hires", {
        hires: [
          {
            positionId: testPosition,
            targetDate: "2099-03-15",
            flags: { [fieldId]: true },
          },
        ],
      }),
      201,
    );
    const id = String(ids[0]);
    await approve({ plannedHires: [id] });
    await send(cookie, "PATCH", `/api/planned-hires/${id}`, {
      flags: { [fieldId]: null },
    });
    const { hires } = await ok<{ hires: Hire[] }>(
      await send(cookie, "GET", "/api/planned-hires"),
    );
    const hire = hires.find((one) => one.id === id);
    expect(hire?.flags).toEqual({});
    expect(hire?.draft?.live.flags).toEqual({ [fieldId]: true });
  });

  it("are refused on a column not offered on planned hires", async () => {
    const { cookie } = await editor();
    const { field } = await ok<{ field: Field }>(
      await send(cookie, "POST", "/api/people/columns", {
        name: unique("Fictional Fire Warden"),
        type: "flag",
        visibility: "general",
        onPlannedHires: false,
      }),
      201,
    );
    await test.approveLists();
    const response = await send(cookie, "POST", "/api/planned-hires", {
      hires: [
        {
          positionId: testPosition,
          targetDate: "2099-03-15",
          flags: { [field.id]: true },
        },
      ],
    });
    expect(errorOf(response)).toBe(
      `${field.name} is switched off for planned hires`,
    );
  });
});

describe("features' boxes", () => {
  it("are kept with the feature, and shown live beside its draft", async () => {
    const editsFeatures = await test.signedIn([
      ...startingRoles["workforce-administrator"].permissions,
      "features:edit",
    ]);
    const { id: fieldId } = await checkboxColumn(editsFeatures.cookie, {
      table: "features",
    });
    const planner = await test.signedIn("product-manager");
    const name = unique("Fictional Feature");
    const { plan } = await ok<{ plan: ProjectPlan }>(
      await send(planner.cookie, "POST", "/api/features", {
        records: [{ name, flags: { [fieldId]: true } }],
      }),
      201,
    );
    const feature = plan.features.find((one) => one.name === name) as Feature;
    expect(feature.flags).toEqual({ [fieldId]: true });
    expect(feature.draft?.live.flags).toEqual({});
  });
});

describe("who sees a Confidential checkbox column", () => {
  let field: Field;
  let tickedId = "";
  let untickedId = "";
  let hireId = "";

  // A person with the box ticked, one whose draft unticks it, and a planned hire with it ticked.
  beforeAll(async () => {
    const { cookie } = await editor();
    field = await checkboxColumn(cookie, { visibility: "confidential" });
    tickedId = await addedId(cookie, { [field.id]: true });
    untickedId = await addedId(cookie, { [field.id]: true });
    const { ids } = await ok<{ ids: string[] }>(
      await send(cookie, "POST", "/api/planned-hires", {
        hires: [
          {
            positionId: testPosition,
            targetDate: "2099-03-15",
            flags: { [field.id]: true },
          },
        ],
      }),
      201,
    );
    hireId = String(ids[0]);
    await approve({ people: [tickedId, untickedId], plannedHires: [hireId] });
    await send(cookie, "PATCH", `/api/people/${untickedId}`, {
      flags: { [field.id]: null },
    });
    await send(cookie, "POST", "/api/unpublished/publish", {});
  });

  it.each(rolesGranting("people:view"))(
    "a %s, a role that sees people, sees its boxes, live and in a draft, only if the role sees Confidential data",
    async (role) => {
      const { cookie } = await test.signedIn(role);
      const sees = rolesGranting("confidential:view").includes(role);
      const ticked = await readPerson(cookie, tickedId);
      const unticked = await readPerson(cookie, untickedId);
      expect(field.id in (ticked?.flags ?? {})).toBe(sees);
      expect(field.id in (unticked?.draft?.live.flags ?? {})).toBe(sees);
    },
  );

  it("leaves a planned hire's box out of the placeholder a role without the class sees", async () => {
    const { cookie: planner } = await test.signedIn(generalReader);
    const { hires } = await ok<{ hires: Hire[] }>(
      await send(planner, "GET", "/api/planned-hires"),
    );
    expect(hires.find(({ id }) => id === hireId)?.flags).toEqual({});
    const { cookie } = await editor();
    const shown = await ok<{ hires: Hire[] }>(
      await send(cookie, "GET", "/api/planned-hires"),
    );
    expect(shown.hires.find(({ id }) => id === hireId)?.flags).toEqual({
      [field.id]: true,
    });
  });

  it.each(rolesGranting("plan:view"))(
    "a %s, a role that sees the change history, sees changes to its boxes only if the role sees Confidential data",
    async (role) => {
      const { cookie } = await test.signedIn(role);
      const history = await ok<ChangeHistory>(
        await send(cookie, "GET", "/api/changes"),
      );
      const columns = history.entries.flatMap((entry) =>
        entry.records.flatMap((record) =>
          record.fields.map(({ column }) => column),
        ),
      );
      expect(columns.includes(field.name)).toBe(
        rolesGranting("confidential:view").includes(role),
      );
    },
  );

  it("records a Confidential reader's view of its changes in the access history", async () => {
    const reader = await test.signedIn([
      "plan:view",
      "people:view",
      "confidential:view",
    ]);
    await ok(await send(reader.cookie, "GET", "/api/changes"));
    const viewed = await test.connection
      .select({ action: accessHistory.action })
      .from(accessHistory)
      .where(eq(accessHistory.actorId, reader.id));
    expect(viewed.map(({ action }) => action)).toContain("personal-viewed");
  });

  it("is named as Confidential when exported", async () => {
    const reader = await test.signedIn(["people:view", "confidential:view"]);
    await ok(
      await send(reader.cookie, "POST", "/api/exports", {
        table: "people",
        columns: ["preferredName", field.id],
      }),
    );
    const [entry] = await test.connection
      .select({ details: accessHistory.details })
      .from(accessHistory)
      .where(
        and(
          eq(accessHistory.actorId, reader.id),
          eq(accessHistory.action, "data-exported"),
        ),
      );
    expect(entry?.details).toEqual({
      exported: "People",
      confidentialColumns: [field.name],
    });
  });

  it("refuses a box from someone who may change people but not Confidential data", async () => {
    const who = await test.signedIn(["people:edit", "people:view"]);
    const response = await send(
      who.cookie,
      "PATCH",
      `/api/people/${tickedId}`,
      {
        flags: { [field.id]: null },
      },
    );
    expect(response.statusCode).toBe(403);
  });

  it("refuses a box from someone signed out", async () => {
    const response = await test.app.inject({
      method: "PATCH",
      url: `/api/people/${tickedId}`,
      headers: { origin: "https://fathom.example.test" },
      payload: { flags: { [field.id]: null } },
    });
    expect(response.statusCode).toBe(401);
  });
});
