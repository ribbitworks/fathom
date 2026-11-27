// SPDX-License-Identifier: Apache-2.0

// Integration tests for drafts of People's columns, against a PostgreSQL server of their own:
// drafting them, reading columns, orders stored before the reporting columns, and the refusals.

import { columnOrders, drafts, fieldValues, lists } from "@fathom/db";
import { defaultClasses, fieldRequestSchema, type List } from "@fathom/shared";
import { eq } from "drizzle-orm";
import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { type Actor } from "./access.ts";
import { createDataAccess } from "./data/index.ts";
import { ForbiddenError } from "./errors.ts";
import {
  generalApprover,
  generalReader,
  testPosition,
  unique,
} from "./test-app.ts";
import {
  test,
  editor,
  send,
  decide,
  readPeople,
  liveList,
  draftColumn,
  liveColumn,
  livePerson,
  liveField,
  liveOrder,
  startColumnDraftTests,
  closeColumnDraftTests,
} from "./test-column-drafts.ts";

beforeAll(startColumnDraftTests);

afterAll(closeColumnDraftTests);

describe("drafting columns", () => {
  it("drafts adding a column, shown in place at the end, and makes it live once approved", async () => {
    const { list } = await liveList(["A"]);
    const { field } = await draftColumn(list.id);
    expect(await liveField(field.id)).toBeUndefined();
    const read = await readPeople();
    expect(read.fields.find(({ id }) => id === field.id)).toMatchObject({
      draft: { action: "created", state: "waiting" },
    });
    expect(read.order.at(-1)).toBe(field.id);
    expect((await decide("approval", { columns: [field.id] })).statusCode).toBe(
      200,
    );
    expect(await liveField(field.id)).toMatchObject({ name: field.name });
    expect((await liveOrder()).at(-1)).toBe(field.id);
  });

  it("drafts changing and removing a column, which change the live column only once approved", async () => {
    const { list, choices } = await liveList(["A"]);
    const field = await liveColumn(list.id);
    const renamed = unique("Fictional Renamed");
    const changed = await send("PUT", `/api/people/columns/${field.id}`, {
      name: renamed,
      listId: list.id,
      multiple: true,
    });
    expect(changed.statusCode).toBe(200);
    expect((await liveField(field.id))?.name).toBe(field.name);
    expect(
      (await readPeople()).fields.find(({ id }) => id === field.id),
    ).toMatchObject({
      name: renamed,
      draft: {
        action: "changed",
        changed: ["name", "multiple"],
        live: { name: field.name, multiple: false },
      },
    });
    await decide("approval", { columns: [field.id] });
    expect(await liveField(field.id)).toMatchObject({
      name: renamed,
      multiple: true,
    });

    const person = await livePerson({ [field.id]: [String(choices[0]?.id)] });
    expect(
      (await send("DELETE", `/api/people/columns/${field.id}`)).statusCode,
    ).toBe(200);
    expect(
      (
        await send("PUT", `/api/people/columns/${field.id}`, {
          name: renamed,
          listId: list.id,
        })
      ).statusCode,
    ).toBe(409);
    expect((await decide("approval", { columns: [field.id] })).statusCode).toBe(
      200,
    );
    expect(await liveField(field.id)).toBeUndefined();
    expect(
      await test.connection
        .select()
        .from(fieldValues)
        .where(eq(fieldValues.personId, person)),
    ).toEqual([]);
  });

  it("takes a column's name while a draft has it, and keeps a live name taken until its rename is approved", async () => {
    const { list } = await liveList(["A"]);
    const name = unique("Fictional Taken");
    await draftColumn(list.id, { name });
    const again = await send("POST", "/api/people/columns", {
      name: name.toUpperCase(),
      listId: list.id,
    });
    expect(again.statusCode).toBe(409);
    const field = await liveColumn(list.id);
    await send("PUT", `/api/people/columns/${field.id}`, {
      name: unique("Fictional Other"),
      listId: list.id,
    });
    expect(
      (
        await send("POST", "/api/people/columns", {
          name: field.name,
          listId: list.id,
        })
      ).statusCode,
    ).toBe(409);
    expect(
      (
        await send("PUT", `/api/people/columns/${field.id}`, {
          name,
          listId: list.id,
        })
      ).statusCode,
    ).toBe(409);
  });

  it("refuses lists that are missing or retired, requiring a column while people exist, and settings values do not fit", async () => {
    const { list, choices } = await liveList(["A", "B"]);
    expect(
      (
        await send("POST", "/api/people/columns", {
          name: unique("Fictional Column"),
          listId: randomUUID(),
        })
      ).statusCode,
    ).toBe(400);
    const retired = await liveList(["C"]);
    await send("PUT", `/api/lists/${retired.list.id}/retired`, {
      retired: true,
    });
    await test.approveLists();
    expect(
      (
        await send("POST", "/api/people/columns", {
          name: unique("Fictional Column"),
          listId: retired.list.id,
        })
      ).statusCode,
    ).toBe(400);
    await livePerson();
    expect(
      (
        await send("POST", "/api/people/columns", {
          name: unique("Fictional Column"),
          listId: list.id,
          required: true,
        })
      ).statusCode,
    ).toBe(409);
    const field = await liveColumn(list.id, { multiple: true });
    await livePerson({ [field.id]: choices.map(({ id }) => id) });
    expect(
      (
        await send("PUT", `/api/people/columns/${field.id}`, {
          name: field.name,
          listId: list.id,
          multiple: false,
        })
      ).statusCode,
    ).toBe(409);
    expect(
      (
        await send("PUT", `/api/people/columns/${randomUUID()}`, {
          name: unique("Fictional Column"),
          listId: list.id,
        })
      ).statusCode,
    ).toBe(404);
  });

  it("refuses removing a column that drafts of people change, and lets only those who may change its values remove it", async () => {
    const { list, choices } = await liveList(["A"], "personal");
    const field = await liveColumn(list.id);
    const drafted = await send("POST", "/api/people", {
      people: [
        {
          preferredName: unique("Fictional Person"),
          employeeId: unique("E"),
          positionId: testPosition,
          values: { [field.id]: [String(choices[0]?.id)] },
        },
      ],
    });
    expect(
      (await send("DELETE", `/api/people/columns/${field.id}`)).statusCode,
    ).toBe(409);
    const [personId = ""] = drafted.json<{ ids: string[] }>().ids;
    await send("DELETE", `/api/people/${personId}/draft`);
    // An actor who may change people but not see Personal details, as no role grants today.
    const generalPeopleOnly: Actor = {
      user: { id: editor.id, name: "Fictional Editor", email: "" },
      roleId: null,
      dataClasses: defaultClasses,
      permissions: ["people:edit", "people:view"],
    };
    const refusal = createDataAccess(test.connection).people.deleteField(
      generalPeopleOnly,
      field.id,
    );
    await expect(refusal).rejects.toThrow(/this role can't see/);
    await expect(refusal).rejects.toBeInstanceOf(ForbiddenError);
  });

  // An actor who may change configuration and people, but not see Personal details, as no role
  // grants today. It is the editor's own user, so it sees the editor's unpublished drafts.
  const generalOnly = (): Actor => ({
    user: { id: editor.id, name: "Fictional Editor", email: "" },
    roleId: null,
    dataClasses: defaultClasses,
    permissions: [
      "configuration:edit",
      "configuration:view",
      "people:edit",
      "people:view",
    ],
  });
  const choice = (listId: string, name = unique("Fictional Column")) =>
    fieldRequestSchema.parse({ name, listId });
  const draftCount = async () =>
    (await test.connection.select({ id: drafts.recordId }).from(drafts)).length;

  it("lets only someone who sees a column's visibility give it or change it", async () => {
    const people = createDataAccess(test.connection).people;
    const personalList = (await liveList(["A"], "personal")).list;
    const general = (await liveList(["B"])).list;
    const before = await draftCount();
    const refusals = [
      choice(personalList.id),
      fieldRequestSchema.parse({
        name: unique("Fictional Column"),
        type: "link",
        visibility: "personal",
      }),
    ];
    for (const request of refusals) {
      await expect(
        people.createField(generalOnly(), request),
      ).rejects.toBeInstanceOf(ForbiddenError);
    }
    expect(await draftCount()).toBe(before);

    // A list only drafted to be added.
    const draftedOnly = (
      await send("POST", "/api/lists", {
        name: unique("Fictional List"),
        visibility: "personal",
      })
    ).json<{ list: List }>().list;
    await expect(
      people.createField(generalOnly(), choice(draftedOnly.id)),
    ).rejects.toThrow(/whose details this role can see/);
    await send("DELETE", `/api/lists/${draftedOnly.id}/draft`);

    const { result } = await people.createField(
      generalOnly(),
      choice(general.id),
    );
    await expect(
      people.updateField(
        generalOnly(),
        result.id,
        choice(personalList.id, result.name),
      ),
    ).rejects.toBeInstanceOf(ForbiddenError);
    await send("DELETE", `/api/people/columns/${result.id}/draft`);

    // Drafted to a General list, a Personal column still holds Personal values while live.
    const hidden = await liveColumn(personalList.id);
    await send("PUT", `/api/people/columns/${hidden.id}`, {
      name: hidden.name,
      listId: general.id,
    });
    await expect(
      people.updateField(
        generalOnly(),
        hidden.id,
        choice(general.id, hidden.name),
      ),
    ).rejects.toThrow(/this role can't see/);
    await send("DELETE", `/api/people/columns/${hidden.id}/draft`);
  });

  it("lets only someone who sees a list's values change its choices, order, retirement or removal", async () => {
    const lists = createDataAccess(test.connection).lists;
    const { list, choices } = await liveList(["A", "B"], "personal");
    const [first, second] = choices.map(({ id }) => id);
    const before = await draftCount();
    const refusals = [
      () =>
        lists.addChoices(generalOnly(), list.id, [
          { label: "Fictional C", description: "" },
        ]),
      () =>
        lists.updateChoice(generalOnly(), list.id, String(first), {
          label: "Fictional Renamed",
          description: "",
        }),
      () => lists.moveChoice(generalOnly(), list.id, String(second), null),
      () =>
        lists.setChoiceRetired(generalOnly(), list.id, String(first), {
          retired: true,
        }),
      () => lists.deleteChoice(generalOnly(), list.id, String(first)),
      () => lists.setRetired(generalOnly(), list.id, { retired: true }),
      () => lists.delete(generalOnly(), list.id),
    ];
    for (const refusal of refusals) {
      await expect(refusal()).rejects.toThrow(/this role can't see/);
    }
    expect(await draftCount()).toBe(before);
  });

  it("lets only someone who sees a list's values discard, resubmit or undo its drafts", async () => {
    const { list, choices } = await liveList(["A"], "personal");
    const choiceUrl = `/api/lists/${list.id}/choices/${String(choices[0]?.id)}`;
    const maker = await test.signedIn([
      "configuration:edit",
      "people:view",
      "personal:view",
    ]);
    const renamed = await test.request(maker.cookie, "PUT", choiceUrl, {
      label: unique("Fictional Renamed"),
      description: "",
    });
    const { changeSetId } = renamed.json<{ changeSetId: string }>();
    const unseen = async (method: "POST" | "DELETE", url: string) => {
      const response = await test.request(maker.cookie, method, url);
      expect(response.statusCode, `${method} ${url}`).toBe(403);
      expect(response.json<{ error: string }>().error).toMatch(
        /this role can't see/,
      );
    };
    const generalOnly = ["configuration:edit", "people:view"] as const;

    // Without Personal details, the maker can neither undo nor discard it
    await test.holdOnly(maker.id, generalOnly);
    await unseen("POST", `/api/undo/${changeSetId}`);
    await unseen("DELETE", `${choiceUrl}/draft`);

    // Nor send it again once rejected
    await decide("rejection", {
      choices: [String(choices[0]?.id)],
      reason: "No",
    });
    await unseen("DELETE", `${choiceUrl}/draft/rejection`);

    // Leave no rejected draft for later tests to meet
    await test.holdOnly(maker.id, [...generalOnly, "personal:view"]);
    expect(
      (await test.request(maker.cookie, "DELETE", `${choiceUrl}/draft`))
        .statusCode,
    ).toBe(200);
  });

  it("lets only someone who sees a list's visibility give it or change it", async () => {
    const lists = createDataAccess(test.connection).lists;
    const before = await draftCount();
    await expect(
      lists.create(generalOnly(), {
        name: unique("Fictional List"),
        description: "",
        visibility: "personal",
      }),
    ).rejects.toBeInstanceOf(ForbiddenError);
    expect(await draftCount()).toBe(before);

    const general = (await liveList(["A"])).list;
    await expect(
      lists.update(generalOnly(), general.id, {
        name: general.name,
        description: "",
        visibility: "personal",
      }),
    ).rejects.toThrow(/a visibility this role can see/);
    const personalList = (await liveList(["B"], "personal")).list;
    await expect(
      lists.update(generalOnly(), personalList.id, {
        name: personalList.name,
        description: "",
        visibility: "general",
      }),
    ).rejects.toThrow(/this role can't see/);
    expect(await draftCount()).toBe(before);

    const renamed = unique("Fictional List");
    const { result } = await lists.update(generalOnly(), general.id, {
      name: renamed,
      description: "",
      visibility: "general",
    });
    expect(result.name).toBe(renamed);
    await send("DELETE", `/api/lists/${general.id}/draft`);
  });

  it("needs an Approver who sees the values a removal deletes", async () => {
    const { list, choices } = await liveList(["A"], "personal");
    const field = await liveColumn(list.id);
    await livePerson({ [field.id]: [String(choices[0]?.id)] });
    await send("DELETE", `/api/people/columns/${field.id}`);
    const listsOnly = await test.signedIn(generalApprover);
    expect(
      (await decide("approval", { columns: [field.id] }, listsOnly.cookie))
        .statusCode,
    ).toBe(403);
    await send("DELETE", `/api/people/columns/${field.id}/draft`);
  });

  it("checks again on approval that the list is offered and the settings fit", async () => {
    const { list, choices } = await liveList(["A", "B"]);
    const { field } = await draftColumn(list.id);
    // Drafting refuses to retire a list a column draft draws on, so the list is retired another way,
    // as a change made before columns had drafts could have.
    await test.connection
      .update(lists)
      .set({ retired: true })
      .where(eq(lists.id, list.id));
    expect((await decide("approval", { columns: [field.id] })).statusCode).toBe(
      409,
    );
    await send("DELETE", `/api/people/columns/${field.id}/draft`);

    const other = await liveList(["C", "D"]);
    const several = await liveColumn(other.list.id, { multiple: true });
    await send("PUT", `/api/people/columns/${several.id}`, {
      name: several.name,
      listId: other.list.id,
      multiple: false,
    });
    await livePerson({
      [several.id]: other.choices.map(({ id }) => id),
    });
    expect(
      (await decide("approval", { columns: [several.id] })).statusCode,
    ).toBe(409);
    await send("DELETE", `/api/people/columns/${several.id}/draft`);
    expect(choices).toHaveLength(2);
  });
});

describe("reading columns", () => {
  it("leaves out a column whose values the reader may not see, with its draft", async () => {
    const { list } = await liveList(["A"], "confidential");
    const { field } = await draftColumn(list.id);
    const reader = await test.signedIn(generalReader);
    expect(
      (await readPeople(reader.cookie)).fields.some(
        ({ id }) => id === field.id,
      ),
    ).toBe(false);
    await send("DELETE", `/api/people/columns/${field.id}`);
  });
});

describe("orders stored before the reporting columns", () => {
  const before = ["preferredName", "employeeId", "startDate", "endDate"];
  const reporting = [
    "managerId",
    "isManager",
    "managerFrom",
    "team",
    "featureTeams",
    "teamName",
  ];

  it("put each built-in column an order does not name just after the one it follows", async () => {
    const stored = await liveOrder();
    const added = stored.filter(
      (key) =>
        !before.includes(key) &&
        !reporting.includes(key) &&
        !["positionId", "stateId", "expected"].includes(key),
    );
    const older = [...before, ...added];
    const write = (keys: string[]) =>
      test.connection
        .update(columnOrders)
        .set({ keys })
        .where(eq(columnOrders.tableName, "people"));
    await write(older);
    try {
      const shown = [
        "preferredName",
        "employeeId",
        "positionId",
        "stateId",
        "startDate",
        "expected",
        "endDate",
        ...reporting,
        ...added,
      ];
      expect((await readPeople()).order).toEqual(shown);
      const general = await test.signedIn(generalReader);
      const seen = await readPeople(general.cookie);
      expect(seen.order).toEqual([
        "preferredName",
        "employeeId",
        "positionId",
        "stateId",
        "expected",
        "managerId",
        "isManager",
        "team",
        "featureTeams",
        "teamName",
        ...added.filter((key) => seen.fields.some(({ id }) => id === key)),
      ]);
    } finally {
      await write(stored);
    }
  });
});

describe("more refusals", () => {
  it("refuses approving a removal while drafts of people give the column values, and lists that are missing or retired", async () => {
    const { list, choices } = await liveList(["A"]);
    const field = await liveColumn(list.id);
    await send("DELETE", `/api/people/columns/${field.id}`);
    const drafted = await send("POST", "/api/people", {
      people: [
        {
          preferredName: unique("Fictional Person"),
          employeeId: unique("E"),
          positionId: testPosition,
          values: { [field.id]: [String(choices[0]?.id)] },
        },
      ],
    });
    expect((await decide("approval", { columns: [field.id] })).statusCode).toBe(
      409,
    );
    const [personId = ""] = drafted.json<{ ids: string[] }>().ids;
    await send("DELETE", `/api/people/${personId}/draft`);
    await send("DELETE", `/api/people/columns/${field.id}/draft`);

    const other = await liveColumn(list.id);
    const retired = await liveList(["B"]);
    await send("PUT", `/api/lists/${retired.list.id}/retired`, {
      retired: true,
    });
    await decide("approval", { lists: [retired.list.id] });
    for (const listId of [randomUUID(), retired.list.id]) {
      expect(
        (
          await send("PUT", `/api/people/columns/${other.id}`, {
            name: other.name,
            listId,
          })
        ).statusCode,
      ).toBe(400);
    }
  });
});
