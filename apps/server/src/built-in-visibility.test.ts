// SPDX-License-Identifier: Apache-2.0

// Tests for the visibility of the built-in lists, against a PostgreSQL server of their own: it can
// be changed like any list's, and the Position and State columns take it, so those who cannot see
// a list's tier do not see the column's values, and cannot add people without a position.

import { accessHistory, listItems, lists } from "@fathom/db";
import type {
  ChangeEntry,
  Hire,
  Hires,
  Permission,
  Person,
  Unpublished,
} from "@fathom/shared";
import { and, eq } from "drizzle-orm";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import {
  errorOf,
  generalReader,
  otherTestPosition,
  sender,
  startTestApp,
  type TestApp,
  testPosition,
  unique,
  type User,
} from "./test-app.ts";

let test: TestApp;
let editor: User;
let approver: User;

beforeAll(async () => {
  test = await startTestApp();
  editor = await test.signedIn("workforce-administrator");
  approver = await test.signedIn("engineering-director");
});

afterAll(async () => {
  await test.close();
});

afterEach(async () => {
  await setVisibility("positions", "general");
  await setVisibility("hiring-states", "general");
});

const send = sender(() => test);

async function setVisibility(key: string, visibility: string) {
  await test.connection
    .update(lists)
    .set({ visibility })
    .where(eq(lists.builtIn, key));
}

async function builtInList(key: string) {
  const [list] = await test.connection
    .select({ id: lists.id, name: lists.name, visibility: lists.visibility })
    .from(lists)
    .where(eq(lists.builtIn, key));
  return list as { id: string; name: string; visibility: string };
}

// An account holding only the permissions given, through a role of its own.
async function grantedOnly(permissions: Permission[]): Promise<User> {
  return test.signedIn(permissions);
}

async function livePerson(): Promise<string> {
  const response = await send(editor, "POST", "/api/people", {
    people: [
      {
        preferredName: unique("Fictional Person"),
        employeeId: unique("BV"),
        positionId: testPosition,
      },
    ],
  });
  expect(response.statusCode, response.body).toBe(201);
  const [id = ""] = response.json<{ ids: string[] }>().ids;
  const approved = await send(approver, "POST", "/api/drafts/approval", {
    people: [id],
  });
  expect(approved.statusCode, approved.body).toBe(200);
  return id;
}

async function liveHire(): Promise<string> {
  const response = await send(editor, "POST", "/api/planned-hires", {
    hires: [{ positionId: testPosition, targetDate: "2027-03-15" }],
  });
  expect(response.statusCode, response.body).toBe(201);
  const [id = ""] = response.json<{ ids: string[] }>().ids;
  const approved = await send(approver, "POST", "/api/drafts/approval", {
    plannedHires: [id],
  });
  expect(approved.statusCode, approved.body).toBe(200);
  return id;
}

async function personSeen(who: User, id: string): Promise<Person | undefined> {
  const response = await send(who, "GET", "/api/people");
  expect(response.statusCode).toBe(200);
  return response
    .json<{ people: Person[] }>()
    .people.find((person) => person.id === id);
}

async function hireSeen(who: User, id: string): Promise<Hire | undefined> {
  const response = await send(who, "GET", "/api/planned-hires");
  expect(response.statusCode).toBe(200);
  return response.json<Hires>().hires.find((hire) => hire.id === id);
}

const entryFor = async (who: User, changeSetId: string | null) =>
  (await send(who, "GET", "/api/changes"))
    .json<{ entries: ChangeEntry[] }>()
    .entries.find((entry) => entry.id === changeSetId);

async function openState(): Promise<string> {
  const [state] = await test.connection
    .select({ id: listItems.id })
    .from(listItems)
    .innerJoin(lists, eq(lists.id, listItems.listId))
    .where(
      and(eq(lists.builtIn, "hiring-states"), eq(listItems.meaning, "open")),
    );
  return String(state?.id);
}

const viewsRecorded = async (who: User) =>
  (
    await test.connection
      .select({ action: accessHistory.action })
      .from(accessHistory)
      .where(eq(accessHistory.actorId, who.id))
  ).filter(({ action }) => action === "personal-viewed").length;

describe("the visibility of a built-in list", () => {
  it("is moved to another class like any list's", async () => {
    for (const key of ["positions", "hiring-states"]) {
      const list = await builtInList(key);
      const moved = await send(editor, "PUT", `/api/lists/${list.id}/class`, {
        dataClass: "personal",
      });
      expect(moved.statusCode, moved.body).toBe(200);
      expect((await builtInList(key)).visibility).toBe("personal");
    }
  });

  it("starts General for both built-in lists", async () => {
    expect((await builtInList("positions")).visibility).toBe("general");
    expect((await builtInList("hiring-states")).visibility).toBe("general");
  });
});

describe("the Position column", () => {
  it("shows a person's position only to those who see the Positions list's tier", async () => {
    const id = await livePerson();
    const reader = await grantedOnly(["people:view"]);
    expect((await personSeen(reader, id))?.positionId).toBe(testPosition);
    await setVisibility("positions", "personal");
    const unseen = await personSeen(reader, id);
    expect(unseen).toBeDefined();
    expect(unseen?.positionId).toBeUndefined();
    const people = (await send(reader, "GET", "/api/people")).json<{
      order: string[];
      positionHidden?: true;
    }>();
    expect(people.order).not.toContain("positionId");
    expect(people.positionHidden).toBe(true);
    const editors = (await send(editor, "GET", "/api/people")).json<{
      positionHidden?: true;
    }>();
    expect(editors.positionHidden).toBeUndefined();
    expect((await personSeen(editor, id))?.positionId).toBe(testPosition);
  });

  it("hides a person's drafted position from those who cannot see it", async () => {
    const id = await livePerson();
    const drafted = await send(editor, "PATCH", `/api/people/${id}`, {
      positionId: otherTestPosition,
    });
    expect(drafted.statusCode, drafted.body).toBe(200);
    const reader = await grantedOnly(["people:view"]);
    expect((await personSeen(reader, id))?.draft?.live.positionId).toBe(
      testPosition,
    );
    await setVisibility("positions", "personal");
    const unseen = await personSeen(reader, id);
    expect(unseen?.positionId).toBeUndefined();
    expect(unseen?.draft).toBeUndefined();
    const seen = await personSeen(editor, id);
    expect(seen?.positionId).toBe(otherTestPosition);
    expect(seen?.draft?.live.positionId).toBe(testPosition);
    await send(editor, "DELETE", `/api/people/${id}/draft`);
  });

  it("refuses adding people to those who cannot see positions", async () => {
    const adder = await grantedOnly(["people:view", "people:edit"]);
    const add = () =>
      send(adder, "POST", "/api/people", {
        people: [
          {
            preferredName: unique("Fictional Person"),
            employeeId: unique("BV"),
            positionId: testPosition,
          },
        ],
      });
    expect((await add()).statusCode).toBe(201);
    await setVisibility("positions", "confidential");
    const response = await add();
    expect(response.statusCode).toBe(403);
    expect(errorOf(response)).toBe(
      "Every person needs a position, and this role can't see positions",
    );
  });

  it("refuses a saved view using the position to those who cannot see it", async () => {
    const saver = await grantedOnly(["people:view"]);
    const save = () =>
      send(saver, "POST", "/api/views/people", {
        name: unique("Fictional View"),
        scope: "personal",
        definition: { sort: ["positionId"] },
      });
    expect((await save()).statusCode).toBe(201);
    await setVisibility("positions", "personal");
    const response = await save();
    expect(response.statusCode).toBe(400);
    expect(errorOf(response)).toBe("Choose only columns this role can see");
  });

  it("shows a placeholder's position only to those who see the Positions list's tier", async () => {
    const id = await liveHire();
    const generalViewer = await test.signedIn(generalReader);
    expect((await hireSeen(generalViewer, id))?.positionId).toBe(testPosition);
    await setVisibility("positions", "personal");
    const unseen = await hireSeen(generalViewer, id);
    expect(unseen).toBeDefined();
    expect(unseen?.positionId).toBeUndefined();
  });
});

describe("the State column", () => {
  it("refuses a saved view using State to those who cannot see the Hiring states list's tier", async () => {
    const saver = await grantedOnly(["people:view"]);
    const save = () =>
      send(saver, "POST", "/api/views/people", {
        name: unique("Fictional View"),
        scope: "personal",
        definition: { filters: { stateId: { empty: true } } },
      });
    expect((await save()).statusCode).toBe(201);
    await setVisibility("hiring-states", "personal");
    const response = await save();
    expect(response.statusCode).toBe(400);
    expect(errorOf(response)).toBe("Choose only columns this role can see");
  });

  it("shows a placeholder's state to those who see the Hiring states list's tier", async () => {
    const id = await liveHire();
    const generalViewer = await test.signedIn(generalReader);
    expect((await hireSeen(generalViewer, id))?.stateId).toBeDefined();
    await setVisibility("hiring-states", "personal");
    expect((await hireSeen(generalViewer, id))?.stateId).toBeUndefined();
  });

  it("leaves State, and a hire row's position and state, off People for those who cannot see their lists' tier", async () => {
    const id = await liveHire();
    const someone = await livePerson();
    const generalViewer = await test.signedIn(generalReader);
    await setVisibility("positions", "personal");
    await setVisibility("hiring-states", "personal");
    const read = await send(generalViewer, "GET", "/api/people");
    const { people, order } = read.json<{
      people: Person[];
      order: string[];
    }>();
    const row = people.find((person) => person.id === id);
    expect(row).toMatchObject({ kind: "planned-hire" });
    expect(row).not.toHaveProperty("positionId");
    expect(row).not.toHaveProperty("stateId");
    expect(people.find((person) => person.id === someone)).not.toHaveProperty(
      "stateId",
    );
    expect(order).not.toContain("stateId");
  });

  it("leaves a hire's drafted position and state out for those who see the plan but not their lists' tier", async () => {
    const id = await liveHire();
    const drafted = await send(editor, "PATCH", `/api/planned-hires/${id}`, {
      positionId: otherTestPosition,
      targetDate: "2027-04-15",
      stateId: await openState(),
    });
    expect(drafted.statusCode, drafted.body).toBe(200);
    const plan = await grantedOnly([
      "people:view",
      "hiring-plan:view",
      "confidential:view",
    ]);
    expect((await hireSeen(plan, id))?.draft?.changed.toSorted()).toEqual([
      "positionId",
      "stateId",
      "targetDate",
    ]);
    await setVisibility("positions", "personal");
    await setVisibility("hiring-states", "personal");
    const seen = await hireSeen(plan, id);
    expect(seen?.positionId).toBeUndefined();
    expect(seen?.stateId).toBeUndefined();
    expect(seen?.draft?.changed).toEqual(["targetDate"]);
    const onlyPosition = await liveHire();
    await setVisibility("positions", "general");
    await send(editor, "PATCH", `/api/planned-hires/${onlyPosition}`, {
      positionId: otherTestPosition,
    });
    expect((await hireSeen(plan, onlyPosition))?.draft).toBeDefined();
    await setVisibility("positions", "personal");
    expect((await hireSeen(plan, onlyPosition))?.draft).toBeUndefined();
    expect((await hireSeen(editor, id))?.draft?.changed.toSorted()).toEqual([
      "positionId",
      "stateId",
      "targetDate",
    ]);
  });
});

describe("changes to positions and states", () => {
  it("are hidden in the change history from those who cannot see their list's tier now", async () => {
    const id = await livePerson();
    const changed = await send(editor, "PATCH", `/api/people/${id}`, {
      positionId: otherTestPosition,
    });
    const { changeSetId } = changed.json<{ changeSetId: string }>();
    const reader = await grantedOnly(["people:view"]);
    // Seeing Confidential data does not give Personal, though Confidential is more sensitive.
    const confidential = await grantedOnly([
      "people:view",
      "confidential:view",
    ]);
    expect(await entryFor(reader, changeSetId)).toBeDefined();
    expect(await entryFor(confidential, changeSetId)).toBeDefined();
    await setVisibility("positions", "personal");
    expect(await entryFor(reader, changeSetId)).toBeUndefined();
    expect(await entryFor(confidential, changeSetId)).toBeUndefined();
    expect(await entryFor(editor, changeSetId)).toBeDefined();
    await send(editor, "DELETE", `/api/people/${id}/draft`);
  });

  it("name a hire by its ID alone in the change history to those who cannot see positions", async () => {
    const id = await liveHire();
    const changed = await send(editor, "PATCH", `/api/planned-hires/${id}`, {
      targetDate: "2027-05-15",
    });
    const { changeSetId } = changed.json<{ changeSetId: string }>();
    const plan = await grantedOnly([
      "people:view",
      "hiring-plan:view",
      "confidential:view",
    ]);
    const name = async () =>
      (await entryFor(plan, changeSetId))?.records[0]?.name;
    expect(await name()).toMatch(/^.+, TBD-\d+$/);
    await setVisibility("positions", "personal");
    expect(await name()).toMatch(/^TBD-\d+$/);
    await send(editor, "DELETE", `/api/planned-hires/${id}/draft`);
  });

  it("cannot be undone by those who cannot change their list's tier now", async () => {
    const adder = await grantedOnly([
      "people:view",
      "people:edit",
      "confidential:view",
      "confidential:edit",
    ]);
    const response = await send(adder, "POST", "/api/people", {
      people: [
        {
          preferredName: unique("Fictional Person"),
          employeeId: unique("BV"),
          positionId: testPosition,
        },
      ],
    });
    const { changeSetId } = response.json<{ changeSetId: string }>();
    await setVisibility("positions", "personal");
    const undone = await send(adder, "POST", `/api/undo/${changeSetId}`, {});
    expect(undone.statusCode).toBe(403);
    await setVisibility("positions", "general");
    expect(
      (await send(adder, "POST", `/api/undo/${changeSetId}`, {})).statusCode,
    ).toBe(200);
  });

  it("on a hire need the right to change their list's tier", async () => {
    const hireEditor = await grantedOnly([
      "people:view",
      "people:edit",
      "hiring-plan:view",
      "confidential:view",
      "hiring-plan:edit",
      "confidential:edit",
    ]);
    const id = await liveHire();
    const add = () =>
      send(hireEditor, "POST", "/api/planned-hires", {
        hires: [{ positionId: testPosition }],
      });
    const added = await add();
    expect(added.statusCode, added.body).toBe(201);
    await setVisibility("hiring-states", "personal");
    const unseenState = await add();
    expect(unseenState.statusCode).toBe(403);
    expect(errorOf(unseenState)).toBe(
      "Every planned hire needs a state, and this role can't see hiring states",
    );
    await setVisibility("hiring-states", "general");
    // A hire added while its state could be seen can still be taken back.
    const [addedId = ""] = added.json<{ ids: string[] }>().ids;
    expect(
      (await send(hireEditor, "DELETE", `/api/planned-hires/${addedId}/draft`))
        .statusCode,
    ).toBe(200);
    await setVisibility("positions", "personal");
    const unseenPosition = await add();
    expect(errorOf(unseenPosition)).toBe(
      "Every planned hire needs a position, and this role can't see positions",
    );
    const moved = await send(hireEditor, "PATCH", `/api/planned-hires/${id}`, {
      positionId: otherTestPosition,
    });
    expect(moved.statusCode).toBe(403);
    await setVisibility("positions", "general");
    const movedSeen = await send(
      hireEditor,
      "PATCH",
      `/api/planned-hires/${id}`,
      { positionId: otherTestPosition },
    );
    expect(movedSeen.statusCode, movedSeen.body).toBe(200);
    await send(hireEditor, "DELETE", `/api/planned-hires/${id}/draft`);
    await setVisibility("positions", "personal");
    const dated = await send(hireEditor, "PATCH", `/api/planned-hires/${id}`, {
      targetDate: "2027-06-15",
    });
    expect(dated.statusCode, dated.body).toBe(200);
    expect(
      (await send(hireEditor, "DELETE", `/api/planned-hires/${id}/draft`))
        .statusCode,
    ).toBe(200);
    const removed = await send(
      hireEditor,
      "DELETE",
      `/api/planned-hires/${id}`,
    );
    expect(removed.statusCode).toBe(403);
  });

  it("on a hire are decided only by Approvers who see their list's tier", async () => {
    const id = await liveHire();
    const drafted = await send(editor, "PATCH", `/api/planned-hires/${id}`, {
      positionId: otherTestPosition,
    });
    expect(drafted.statusCode, drafted.body).toBe(200);
    await setVisibility("positions", "personal");
    const unseeing = await grantedOnly([
      "people:view",
      "hiring-plan:view",
      "confidential:view",
      "hiring-plan:approve",
    ]);
    const refused = await send(unseeing, "POST", "/api/drafts/approval", {
      plannedHires: [id],
    });
    expect(refused.statusCode).toBe(403);
    expect(errorOf(refused)).toBe(
      "One of these drafts holds details this role can't see, so an Approver who sees them must decide it",
    );
    const approved = await send(approver, "POST", "/api/drafts/approval", {
      plannedHires: [id],
    });
    expect(approved.statusCode, approved.body).toBe(200);
  });

  it("name a hire by its ID alone among unpublished changes to those who cannot see positions", async () => {
    const hireEditor = await grantedOnly([
      "people:view",
      "people:edit",
      "hiring-plan:view",
      "confidential:view",
      "hiring-plan:edit",
      "confidential:edit",
    ]);
    const made = await test.request(
      hireEditor.cookie,
      "POST",
      "/api/planned-hires",
      { hires: [{ positionId: testPosition }] },
      { publish: false },
    );
    expect(made.statusCode, made.body).toBe(201);
    const subjects = async () =>
      (await send(hireEditor, "GET", "/api/unpublished"))
        .json<Unpublished>()
        .changes.map(({ subject }) => subject);
    expect(await subjects()).toEqual([
      expect.stringMatching(/^the planned hire .+, TBD-\d+$/),
    ]);
    await setVisibility("positions", "personal");
    expect(await subjects()).toEqual([
      expect.stringMatching(/^the planned hire TBD-\d+$/),
    ]);
  });
});

describe("reading positions and states more sensitive than General", () => {
  it("is recorded in the access history, for people and for placeholders", async () => {
    await livePerson();
    await liveHire();
    const confidentialReader = await grantedOnly([
      "people:view",
      "confidential:view",
    ]);
    await send(confidentialReader, "GET", "/api/people");
    await send(confidentialReader, "GET", "/api/planned-hires");
    const before = await viewsRecorded(confidentialReader);
    await setVisibility("positions", "confidential");
    await send(confidentialReader, "GET", "/api/people");
    expect(await viewsRecorded(confidentialReader)).toBe(before + 1);
    const placeholders = await grantedOnly(["people:view", "personal:view"]);
    await setVisibility("positions", "general");
    await send(placeholders, "GET", "/api/planned-hires");
    expect(await viewsRecorded(placeholders)).toBe(0);
    await setVisibility("hiring-states", "personal");
    await send(placeholders, "GET", "/api/planned-hires");
    expect(await viewsRecorded(placeholders)).toBe(1);
  });

  it("is recorded for people's State once the Hiring states list is above General", async () => {
    await livePerson();
    const reader = await grantedOnly(["people:view", "confidential:view"]);
    await send(reader, "GET", "/api/people");
    const before = await viewsRecorded(reader);
    await setVisibility("hiring-states", "confidential");
    await send(reader, "GET", "/api/people");
    expect(await viewsRecorded(reader)).toBe(before + 1);
  });
});

describe("changing a position", () => {
  it("is refused to those who see the Positions list's tier but cannot change it", async () => {
    const id = await livePerson();
    const viewer = await grantedOnly([
      "people:view",
      "people:edit",
      "personal:view",
    ]);
    const change = () =>
      send(viewer, "PATCH", `/api/people/${id}`, {
        positionId: otherTestPosition,
      });
    const allowed = await change();
    expect(allowed.statusCode, allowed.body).toBe(200);
    await send(viewer, "DELETE", `/api/people/${id}/draft`);
    await setVisibility("positions", "personal");
    expect((await personSeen(viewer, id))?.positionId).toBe(testPosition);
    expect((await change()).statusCode).toBe(403);
  });

  it("in a rejected hire draft is resubmitted only by those who may change it now", async () => {
    const id = await liveHire();
    const hireEditor = await grantedOnly([
      "people:view",
      "people:edit",
      "hiring-plan:view",
      "confidential:view",
      "hiring-plan:edit",
      "confidential:edit",
    ]);
    const drafted = await send(
      hireEditor,
      "PATCH",
      `/api/planned-hires/${id}`,
      {
        positionId: otherTestPosition,
      },
    );
    expect(drafted.statusCode, drafted.body).toBe(200);
    const rejected = await send(approver, "POST", "/api/drafts/rejection", {
      plannedHires: [id],
      reason: "Fictional reason",
    });
    expect(rejected.statusCode, rejected.body).toBe(200);
    await setVisibility("positions", "personal");
    const resubmit = () =>
      send(hireEditor, "DELETE", `/api/planned-hires/${id}/draft/rejection`);
    expect((await resubmit()).statusCode).toBe(403);
    await setVisibility("positions", "general");
    expect((await resubmit()).statusCode).toBe(200);
  });
});
