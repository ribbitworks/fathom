// SPDX-License-Identifier: Apache-2.0

// Tests for filling planned hires, against a migrated PostgreSQL server: filling with a new person,
// who takes the hire's position, manager or one given, values, and target date, or with someone
// already in Fathom, who takes its position and moves to that manager; a planned manager's hires
// moving to the person who fills it; the fills refused; and approving, rejecting, discarding, resubmitting, and undoing a fill as
// one draft. Who may fill a hire is checked with every other route in permissions.test.ts.

import { listItems, lists, people, plannedHires } from "@fathom/db";
import {
  type ChangeHistory,
  type Field,
  type Hire,
  type Person,
} from "@fathom/shared";
import { eq } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { startTestApp, type TestApp, testPosition } from "./test-app.ts";

interface User {
  id: string;
  cookie: string;
}

let test: TestApp;
// A Workforce Administrator, who changes people and the hiring plan.
let editor: User;
// An Engineering Director, who approves drafts of people and planned hires and sees Restricted data.
let approver: User;
let proposed: string;
let open: string;

beforeAll(async () => {
  test = await startTestApp();
  editor = await test.signedIn("workforce-administrator");
  approver = await test.signedIn("engineering-director");
  const states = await test.connection
    .select({ id: listItems.id, label: listItems.label })
    .from(listItems)
    .innerJoin(lists, eq(lists.id, listItems.listId))
    .where(eq(lists.builtIn, "hiring-states"));
  proposed = String(
    states.find(({ label }) => label === "Request to hire")?.id,
  );
  open = String(states.find(({ label }) => label === "Approved to hire")?.id);
});

afterAll(async () => {
  await test.close();
});

let count = 0;

// A name or ID no other test uses, so tests sharing the database do not collide.
function unique(prefix: string): string {
  count += 1;
  return `${prefix} ${String(count)}`;
}

const send = (
  who: User,
  method: "GET" | "POST" | "PUT" | "PATCH" | "DELETE",
  url: string,
  payload?: object,
  options?: { publish?: boolean },
) => test.request(who.cookie, method, url, payload, options);

async function ok<T>(
  response: Awaited<ReturnType<typeof send>>,
  status = 200,
): Promise<T> {
  expect(response.statusCode, response.body).toBe(status);
  return Promise.resolve(response.json<T>());
}

const partOfFill =
  "This is part of filling a planned hire; discard the fill to change it";

const refusal = (response: Awaited<ReturnType<typeof send>>) =>
  response.json<{ error: string }>().error;

type Records = { people?: string[]; plannedHires?: string[] };

const approve = (ids: Records, who = approver) =>
  send(who, "POST", "/api/drafts/approval", ids);

async function approved(ids: Records) {
  await ok(await approve(ids));
}

const reject = (ids: Records) =>
  send(approver, "POST", "/api/drafts/rejection", {
    ...ids,
    reason: "Fictional reason",
  });

// A fictional person, approved so they are live, started in 2020 and marked as a manager unless
// told otherwise.
async function person(details: object = {}): Promise<string> {
  const { ids } = await ok<{ ids: string[] }>(
    await send(editor, "POST", "/api/people", {
      people: [
        {
          preferredName: unique("Fictional Person"),
          employeeId: unique("FP"),
          positionId: testPosition,
          startDate: "2020-01-01",
          isManager: true,
          ...details,
        },
      ],
    }),
    201,
  );
  const id = String(ids[0]);
  await approved({ people: [id] });
  return id;
}

// A live planned hire, approved to hire, with a target date, unless told otherwise.
async function hire(details: object = {}): Promise<string> {
  const { ids } = await ok<{ ids: string[] }>(
    await send(editor, "POST", "/api/planned-hires", {
      hires: [
        {
          positionId: testPosition,
          targetDate: "2099-03-15",
          stateId: open,
          ...details,
        },
      ],
    }),
    201,
  );
  const id = String(ids[0]);
  await approved({ plannedHires: [id] });
  return id;
}

const fill = (
  id: string,
  body: object,
  who = editor,
  options?: { publish?: boolean },
) => send(who, "POST", `/api/planned-hires/${id}/fill`, body, options);

const newPerson = (details: object = {}) => ({
  by: "new person",
  preferredName: unique("Fictional Starter"),
  employeeId: unique("FS"),
  startDate: "2099-04-01",
  ...details,
});

const existing = (personId: string, details: object = {}) => ({
  by: "existing person",
  personId,
  ...details,
});

async function filled(id: string, body: object): Promise<string> {
  const { changeSetId } = await ok<{ changeSetId: string }>(
    await fill(id, body),
  );
  return changeSetId;
}

async function peopleSeen(who = editor): Promise<Person[]> {
  return (await ok<{ people: Person[] }>(await send(who, "GET", "/api/people")))
    .people;
}

async function rowOf(id: string, who = editor): Promise<Person | undefined> {
  return (await peopleSeen(who)).find((row) => row.id === id);
}

async function rowNamed(name: string): Promise<Person | undefined> {
  return (await peopleSeen()).find((row) => row.preferredName === name);
}

async function hireOf(id: string): Promise<Hire | undefined> {
  const { hires } = await ok<{ hires: Hire[] }>(
    await send(editor, "GET", "/api/planned-hires"),
  );
  return hires.find((one) => one.id === id);
}

async function liveHire(id: string) {
  const [row] = await test.connection
    .select()
    .from(plannedHires)
    .where(eq(plannedHires.id, id));
  return row;
}

async function livePerson(name: string) {
  const [row] = await test.connection
    .select()
    .from(people)
    .where(eq(people.preferredName, name));
  return row;
}

describe("filling a planned hire with a new person", () => {
  it("drafts the person with the hire's position, manager, values, and the start date given, and the hire as filled by them", async () => {
    // Given a hire under a manager, with a link in a column offered on planned hires
    const manager = await person();
    const column = await ok<{ field: Field }>(
      await send(editor, "POST", "/api/people/columns", {
        name: unique("Fictional Profile"),
        type: "link",
        visibility: "general",
        onPlannedHires: true,
      }),
      201,
    );
    await test.approveLists();
    const link = { address: "https://example.test/fictional", text: "" };
    const id = await hire({
      managerId: manager,
      links: { [column.field.id]: link },
    });
    const body = newPerson();

    // When it is filled with a new person
    await filled(id, body);

    // Then the person is drafted to be added, and the hire as filled by them
    const added = await rowNamed(body.preferredName);
    expect(added).toMatchObject({
      employeeId: body.employeeId,
      positionId: testPosition,
      startDate: "2099-04-01",
      manager: { id: manager },
      managerFrom: "2099-04-01",
      links: { [column.field.id]: link },
      draft: { action: "created" },
    });
    expect(await hireOf(id)).toMatchObject({
      filler: added?.id,
      draft: { changed: ["filledBy"] },
    });
  });

  it("names the person a draft fills a hire with only to those who see Restricted details", async () => {
    const id = await hire();
    await filled(id, newPerson());
    const projectManager = await test.signedIn("project-manager");

    const { hires } = await ok<{ hires: Hire[] }>(
      await send(projectManager, "GET", "/api/planned-hires"),
    );

    expect(hires.find((one) => one.id === id)?.filler).toBeNull();
  });

  it("adds the person and fills the hire when either draft is approved", async () => {
    const id = await hire({ managerId: await person() });
    const body = newPerson();
    await filled(id, body);

    await approved({ plannedHires: [id] });

    const added = await livePerson(body.preferredName);
    expect(added?.startDate).toBe("2099-04-01");
    expect((await liveHire(id))?.filledBy).toBe(added?.id);
    expect(await rowOf(id)).toBeUndefined();
  });

  it("flags the person as a manager and moves a planned manager's hires to them", async () => {
    // Given a planned manager with a hire reporting to it
    const id = await hire({ isManager: true, managerId: await person() });
    const report = await hire({ managerId: id });
    const body = newPerson();

    // When it is filled, and the person's draft approved
    await filled(id, body);
    expect((await hireOf(report))?.draft?.changed).toContain("managerId");
    const added = await rowNamed(body.preferredName);
    await approved({ people: [String(added?.id)] });

    // Then the person is a manager, and the hire reports to them
    expect((await livePerson(body.preferredName))?.isManager).toBe(true);
    expect((await liveHire(id))?.filledBy).toBe(added?.id);
    expect(await liveHire(report)).toMatchObject({
      managerId: added?.id,
      managerHireId: null,
    });
  });

  it("is refused with an Employee ID someone already has", async () => {
    const id = await hire();
    const taken = unique("FP");
    await person({ employeeId: taken });

    const response = await fill(id, newPerson({ employeeId: taken }));

    expect(response.statusCode).toBe(409);
    expect((await hireOf(id))?.draft).toBeUndefined();
  });
});

describe("filling a planned hire with someone already in Fathom", () => {
  it("drafts them moving to the hire's manager from the day given, approved with the hire", async () => {
    const manager = await person();
    const id = await hire({ managerId: manager });
    const transfer = await person({ isManager: false });

    await filled(id, existing(transfer, { managerFrom: "2026-01-05" }));
    expect(await rowOf(transfer)).toMatchObject({
      manager: { id: manager },
      managerFrom: "2026-01-05",
      draft: { action: "changed" },
    });
    await approved({ plannedHires: [id] });

    expect((await liveHire(id))?.filledBy).toBe(transfer);
    const moved = await rowOf(transfer);
    expect(moved?.manager?.id).toBe(manager);
    expect(moved?.draft).toBeUndefined();
  });

  it("moves a planned manager's hires to them and flags them as a manager", async () => {
    const id = await hire({ isManager: true, managerId: await person() });
    const report = await hire({ managerId: id });
    const transfer = await person({ isManager: false });

    await filled(id, existing(transfer));
    await approved({ plannedHires: [report] });

    expect((await liveHire(id))?.filledBy).toBe(transfer);
    expect((await liveHire(report))?.managerId).toBe(transfer);
    expect(await rowOf(transfer)).toMatchObject({ isManager: true });
  });

  it("lets someone who has not started yet, and fills no other hire, fill one", async () => {
    const starter = await person({ startDate: "2099-01-01", isManager: false });

    const response = await fill(await hire(), existing(starter));

    expect(response.statusCode, response.body).toBe(200);
  });

  it("answers someone who does not exist as not found", async () => {
    const response = await fill(
      await hire(),
      existing("00000000-0000-4000-8000-0000000fa11e"),
    );

    expect(response.statusCode).toBe(404);
  });

  it("keeps their manager when the hire has none", async () => {
    const manager = await person();
    const transfer = await person({ isManager: false, managerId: manager });
    const id = await hire();

    await filled(id, existing(transfer));

    const kept = await rowOf(transfer);
    expect(kept?.manager?.id).toBe(manager);
    expect(kept?.draft).toBeUndefined();
  });

  it("moves someone who has not started yet from their start date by default", async () => {
    const id = await hire({ managerId: await person() });
    const starter = await person({ startDate: "2099-01-01", isManager: false });

    await filled(id, existing(starter));

    expect((await rowOf(starter))?.managerFrom).toBe("2099-01-01");
  });

  it("answers someone who has not started as no one to an actor who does not see Restricted details", async () => {
    const id = await hire();
    const starter = await person({ startDate: "2099-01-01", isManager: false });
    const actor = await test.signedIn([
      "people:view",
      "people:edit",
      "hiring-plan:view",
      "hiring-plan:edit",
    ]);

    const response = await fill(id, existing(starter), actor);

    expect(response.statusCode).toBe(404);
    expect(refusal(response)).toBe("There is no such person");
  });

  it("is refused for someone another user's unpublished draft is filling a hire with", async () => {
    const transfer = await person({ isManager: false });
    const other = await test.signedIn("workforce-administrator");
    const first = await ok(
      await fill(await hire(), existing(transfer), other, { publish: false }),
    );
    expect(first).toBeDefined();

    const response = await fill(await hire(), existing(transfer));

    expect(response.statusCode).toBe(409);
    expect(refusal(response)).toMatch(/already filling a planned hire/u);
  });

  it("is refused for someone with a draft of their own", async () => {
    const transfer = await person({ isManager: false });
    await ok(
      await send(editor, "PATCH", `/api/people/${transfer}`, {
        preferredName: unique("Fictional Renamed"),
      }),
    );

    const response = await fill(await hire(), existing(transfer));

    expect(response.statusCode).toBe(409);
    expect(refusal(response)).toMatch(
      /has a draft; approve or discard it before they fill a planned hire$/u,
    );
  });

  it("leaves a transfer's later draft out of a fill that drafted nothing on them", async () => {
    // Given a hire with no manager, filled by a transfer, who is then renamed
    const transfer = await person({ isManager: false });
    const id = await hire();
    await filled(id, existing(transfer));
    await ok(
      await send(editor, "PATCH", `/api/people/${transfer}`, {
        preferredName: unique("Fictional Renamed"),
      }),
    );

    // When the fill is approved
    await approved({ plannedHires: [id] });

    // Then the rename still waits
    expect((await rowOf(transfer))?.draft?.changed).toEqual(["preferredName"]);
  });

  it("is refused for someone who has left", async () => {
    const id = await hire();
    const left = await person({ endDate: "2021-01-01" });

    const response = await fill(id, existing(left));

    expect(response.statusCode).toBe(409);
    expect(refusal(response)).toMatch(/has left/u);
  });

  it("is refused for someone already filling another hire in a draft", async () => {
    const transfer = await person({ isManager: false });
    await filled(await hire(), existing(transfer));

    const response = await fill(await hire(), existing(transfer));

    expect(response.statusCode).toBe(409);
    expect(refusal(response)).toMatch(/already filling a planned hire/u);
  });

  it("is refused for someone who has not started the hire they filled", async () => {
    const id = await hire();
    const body = newPerson();
    await filled(id, body);
    await approved({ plannedHires: [id] });
    const starter = String((await livePerson(body.preferredName))?.id);

    const response = await fill(await hire(), existing(starter));

    expect(response.statusCode).toBe(409);
    expect(refusal(response)).toMatch(/hasn't started it yet/u);
  });

  it("lets someone who has started fill another hire", async () => {
    const transfer = await person({ isManager: false });
    const first = await hire();
    await filled(first, existing(transfer));
    await approved({ plannedHires: [first] });

    const response = await fill(await hire(), existing(transfer));

    expect(response.statusCode, response.body).toBe(200);
  });
});

describe("the hires that can be filled", () => {
  it("refuses one whose headcount is not yet approved", async () => {
    const id = await hire({ stateId: proposed });

    const response = await fill(id, newPerson());

    expect(response.statusCode).toBe(409);
    expect(refusal(response)).toBe(
      "This planned hire's headcount isn't approved yet; move it to an approved state before filling it",
    );
  });

  it("refuses one whose manager is a planned hire", async () => {
    const manager = await hire({ isManager: true });
    const id = await hire({ managerId: manager });

    const response = await fill(id, newPerson());

    expect(response.statusCode).toBe(409);
    expect(refusal(response)).toBe("Choose a manager from People");
  });

  it("refuses one already filled, in a draft or live", async () => {
    const id = await hire();
    await filled(id, newPerson());

    const response = await fill(id, newPerson());

    expect(response.statusCode).toBe(409);
    expect(refusal(response)).toBe("This planned hire is already filled");
  });

  it("refuses one only drafted to be added", async () => {
    const { ids } = await ok<{ ids: string[] }>(
      await send(editor, "POST", "/api/planned-hires", {
        hires: [{ positionId: testPosition, stateId: open }],
      }),
      201,
    );

    const response = await fill(String(ids[0]), newPerson());

    expect(response.statusCode).toBe(409);
    expect(refusal(response)).toBe(
      "This planned hire is only drafted to be added; approve it before filling it",
    );
  });

  it("refuses a planned manager a hire with a draft reports to, live or in a draft", async () => {
    const reportsToIt =
      "A planned hire reporting to this one has a draft; approve or discard it before filling this one";
    // A hire only drafted to be added under it
    const added = await hire({ isManager: true });
    await ok(
      await send(editor, "POST", "/api/planned-hires", {
        hires: [{ positionId: testPosition, managerId: added }],
      }),
      201,
    );
    // A live hire drafted to move under it
    const joined = await hire({ isManager: true });
    const mover = await hire();
    await ok(
      await send(editor, "PATCH", `/api/planned-hires/${mover}`, {
        managerId: joined,
      }),
    );
    // A hire under it whose draft changes something else
    const changed = await hire({ isManager: true });
    const report = await hire({ managerId: changed });
    await ok(
      await send(editor, "PATCH", `/api/planned-hires/${report}`, {
        targetDate: "2099-08-01",
      }),
    );

    for (const id of [added, joined, changed]) {
      const response = await fill(id, newPerson());
      expect(response.statusCode).toBe(409);
      expect(refusal(response)).toBe(reportsToIt);
    }
  });

  it("refuses one whose draft changes its manager", async () => {
    const id = await hire();
    await ok(
      await send(editor, "PATCH", `/api/planned-hires/${id}`, {
        managerId: await person(),
      }),
    );

    const response = await fill(id, newPerson());

    expect(response.statusCode).toBe(409);
    expect(refusal(response)).toBe(
      "This planned hire's draft changes its manager; approve or discard that draft before filling it",
    );
  });

  it("refuses one drafted to be removed", async () => {
    const id = await hire();
    await ok(await send(editor, "DELETE", `/api/planned-hires/${id}`));

    const response = await fill(id, newPerson());

    expect(response.statusCode).toBe(409);
  });

  it("answers a hire that does not exist as not found", async () => {
    const response = await fill(
      "00000000-0000-4000-8000-0000000fa11d",
      newPerson(),
    );

    expect(response.statusCode).toBe(404);
  });
});

describe("a fill's draft", () => {
  it("is rejected whole when any part of it is rejected", async () => {
    const id = await hire({ isManager: true, managerId: await person() });
    const report = await hire({ managerId: id });
    const body = newPerson();
    await filled(id, body);
    const added = String((await rowNamed(body.preferredName))?.id);

    await ok(await reject({ people: [added] }));

    expect((await hireOf(id))?.draft?.state).toBe("rejected");
    expect((await hireOf(report))?.draft?.state).toBe("rejected");
    expect((await rowOf(added))?.draft?.state).toBe("rejected");
  });

  it("is resubmitted whole from any part of it", async () => {
    const id = await hire();
    const body = newPerson();
    await filled(id, body);
    await ok(await reject({ plannedHires: [id] }));
    const added = String((await rowNamed(body.preferredName))?.id);

    await ok(
      await send(editor, "DELETE", `/api/people/${added}/draft/rejection`),
    );

    expect((await hireOf(id))?.draft?.state).toBe("waiting");
    expect((await rowOf(added))?.draft?.state).toBe("waiting");
  });

  it("is taken out of the rest of the fill's drafts when any part is discarded, keeping their other changes", async () => {
    // Given a planned manager whose own draft moves its target date, filled by a transfer
    const transfer = await person({ isManager: false });
    const id = await hire({ isManager: true, managerId: await person() });
    const report = await hire({ managerId: id });
    await ok(
      await send(editor, "PATCH", `/api/planned-hires/${id}`, {
        targetDate: "2099-06-01",
      }),
    );
    await filled(id, existing(transfer));

    // When the transfer's draft is discarded
    await ok(await send(editor, "DELETE", `/api/people/${transfer}/draft`));

    // Then the hire keeps its new target date but is no longer filled, and its hire is back under it
    const kept = await hireOf(id);
    expect(kept?.filler).toBeUndefined();
    expect(kept?.draft?.changed).toEqual(["targetDate"]);
    expect((await hireOf(report))?.draft).toBeUndefined();
    expect((await rowOf(transfer))?.draft).toBeUndefined();
  });

  it("puts a transfer's manager back when discarded from the hire, keeping their other changes", async () => {
    // Given a transfer filling a hire under another manager, then renamed in the same draft
    const before = await person();
    const transfer = await person({ isManager: false, managerId: before });
    const id = await hire({ managerId: await person() });
    await filled(id, existing(transfer));
    const renamed = unique("Fictional Renamed");
    await ok(
      await send(editor, "PATCH", `/api/people/${transfer}`, {
        preferredName: renamed,
      }),
    );

    // When the hire's draft is discarded
    await ok(await send(editor, "DELETE", `/api/planned-hires/${id}/draft`));

    // Then the transfer keeps their new name, under their manager as before
    const kept = await rowOf(transfer);
    expect(kept?.preferredName).toBe(renamed);
    expect(kept?.manager?.id).toBe(before);
    expect(kept?.draft?.changed).toEqual(["preferredName"]);
  });

  it("discards the whole draft of the record asked for, and a person the fill adds", async () => {
    const id = await hire({ managerId: await person() });
    const body = newPerson();
    await filled(id, body);

    await ok(await send(editor, "DELETE", `/api/planned-hires/${id}/draft`));

    expect((await hireOf(id))?.draft).toBeUndefined();
    expect(await rowNamed(body.preferredName)).toBeUndefined();
  });

  it("is not discarded while someone else is changing part of it", async () => {
    const id = await hire({ isManager: true });
    const report = await hire({ managerId: id });
    await filled(id, newPerson());
    const other = await test.signedIn("workforce-administrator");
    await ok(
      await send(
        other,
        "PATCH",
        `/api/planned-hires/${report}`,
        { targetDate: "2099-07-01" },
        { publish: false },
      ),
    );

    const response = await send(
      editor,
      "DELETE",
      `/api/planned-hires/${id}/draft`,
    );

    expect(response.statusCode).toBe(409);
    expect(refusal(response)).toMatch(
      /is changing part of this fill of a planned hire/u,
    );
    expect((await hireOf(id))?.filler).toBeDefined();
  });

  it("is not discarded or resent through its person by a role that may not change the hiring plan", async () => {
    const id = await hire();
    const body = newPerson();
    await filled(id, body);
    const added = String((await rowNamed(body.preferredName))?.id);
    const peopleOnly = await test.signedIn([
      "people:view",
      "people:edit",
      "restricted:view",
      "restricted:edit",
    ]);

    const response = await send(
      peopleOnly,
      "DELETE",
      `/api/people/${added}/draft`,
    );

    expect(response.statusCode).toBe(403);
    expect(refusal(response)).toBe(
      "This draft is part of filling a planned hire, which this role can't change",
    );
  });

  it("is not approved through its person by an Approver who approves people but not planned hires", async () => {
    const id = await hire();
    const body = newPerson();
    await filled(id, body);
    const added = String((await rowNamed(body.preferredName))?.id);
    const peopleApprover = await test.signedIn([
      "people:view",
      "restricted:view",
      "people:approve",
    ]);

    const response = await approve({ people: [added] }, peopleApprover);

    expect(response.statusCode).toBe(403);
    expect(refusal(response)).toBe(
      "This draft is part of filling a planned hire, which this role can't decide",
    );
    expect((await liveHire(id))?.filledBy).toBeNull();
  });

  it("names a new person a fill adds in the change history only to those who see Restricted details", async () => {
    // Given a planned manager, with a hire reporting to it, filled with someone who starts later
    const id = await hire({ isManager: true });
    await hire({ managerId: id });
    const body = newPerson();
    const changeSetId = await filled(id, body);
    const recordsSeen = async (who: User) => {
      const { entries } = await ok<ChangeHistory>(
        await send(who, "GET", "/api/changes"),
      );
      return entries.find((entry) => entry.id === changeSetId)?.records ?? [];
    };
    // Only the hire filled changes who fills it, and only its report its manager.
    const value = (
      records: Awaited<ReturnType<typeof recordsSeen>>,
      field: string,
    ) =>
      records
        .flatMap((record) =>
          record.kind === "planned-hire" ? record.fields : [],
        )
        .find((one) => one.field === field)?.newValue;
    const projectManager = await test.signedIn("project-manager");

    // Then the editor sees the person, who fills the hire and manages its report
    const edited = await recordsSeen(editor);
    expect(edited.some(({ name }) => name === body.preferredName)).toBe(true);
    expect(value(edited, "filledBy")).toBe(body.preferredName);
    expect(value(edited, "managerId")).toBe(body.preferredName);
    // And the Project Manager sees the hires changed, but nobody named
    const seen = await recordsSeen(projectManager);
    expect(seen.some(({ name }) => name === body.preferredName)).toBe(false);
    expect(value(seen, "filledBy")).toBeNull();
    expect(value(seen, "managerId")).toBeNull();
  });

  it("names someone already in Fathom who fills a hire in the change history only to those who see Restricted details", async () => {
    const transfer = await person({ isManager: false });
    const changeSetId = await filled(await hire(), existing(transfer));
    const filler = async (who: User) => {
      const { entries } = await ok<ChangeHistory>(
        await send(who, "GET", "/api/changes"),
      );
      return entries
        .find((entry) => entry.id === changeSetId)
        ?.records.flatMap(({ fields }) => fields)
        .find(({ field }) => field === "filledBy")?.newValue;
    };
    const projectManager = await test.signedIn("project-manager");

    expect(await filler(editor)).not.toBeNull();
    expect(await filler(projectManager)).toBeNull();
  });

  it("is not rejected by an Approver who does not see Restricted details", async () => {
    const id = await hire();
    await filled(id, newPerson());
    const projectManager = await test.signedIn("project-manager");

    const response = await send(
      projectManager,
      "POST",
      "/api/drafts/rejection",
      {
        plannedHires: [id],
        reason: "Fictional reason",
      },
    );

    expect(response.statusCode).toBe(403);
    expect((await hireOf(id))?.draft?.state).toBe("waiting");
  });

  it("is undone whole for a planned manager filled by a transfer", async () => {
    const transfer = await person({ isManager: false });
    const id = await hire({ isManager: true, managerId: await person() });
    const report = await hire({ managerId: id });
    const changeSetId = await filled(id, existing(transfer));

    await ok(await send(editor, "POST", `/api/undo/${changeSetId}`));

    expect((await hireOf(id))?.draft).toBeUndefined();
    expect((await hireOf(report))?.draft).toBeUndefined();
    expect((await rowOf(transfer))?.draft).toBeUndefined();
  });

  it("is undone whole", async () => {
    const id = await hire();
    const body = newPerson();
    const changeSetId = await filled(id, body);

    await ok(await send(editor, "POST", `/api/undo/${changeSetId}`));

    expect((await hireOf(id))?.draft).toBeUndefined();
    expect(await rowNamed(body.preferredName)).toBeUndefined();
  });

  it("needs an Approver who sees Restricted details, since it holds a start date or a reporting line", async () => {
    const id = await hire();
    await filled(id, newPerson());
    const projectManager = await test.signedIn("project-manager");

    const response = await approve({ plannedHires: [id] }, projectManager);

    expect(response.statusCode).toBe(403);
    expect(refusal(response)).toBe(
      "A fill names who fills the hire, so an Approver who sees Restricted details must decide it",
    );
    expect((await liveHire(id))?.filledBy).toBeNull();
  });
});

describe("a fill waiting for approval", () => {
  it("keeps the hire's state, manager, and Manager? as the fill has them", async () => {
    const id = await hire({ isManager: true, managerId: await person() });
    await filled(id, newPerson());

    for (const body of [
      { stateId: proposed },
      { managerId: await person() },
      { isManager: false },
    ]) {
      const response = await send(
        editor,
        "PATCH",
        `/api/planned-hires/${id}`,
        body,
      );
      expect(response.statusCode).toBe(409);
      expect(refusal(response)).toBe(partOfFill);
    }
    await ok(
      await send(editor, "PATCH", `/api/planned-hires/${id}`, {
        targetDate: "2099-09-01",
      }),
    );
  });

  it("keeps the manager of a hire it moves, and its person's manager and Manager?", async () => {
    const transfer = await person({ isManager: false });
    const id = await hire({ isManager: true, managerId: await person() });
    const report = await hire({ managerId: id });
    await filled(id, existing(transfer));

    const moved = await send(editor, "PATCH", `/api/planned-hires/${report}`, {
      managerId: await person(),
    });
    const managed = await send(editor, "PATCH", `/api/people/${transfer}`, {
      managerId: await person(),
    });
    const unmarked = await send(editor, "PATCH", `/api/people/${transfer}`, {
      isManager: false,
    });

    for (const response of [moved, managed, unmarked]) {
      expect(response.statusCode).toBe(409);
      expect(refusal(response)).toBe(partOfFill);
    }
  });

  it("leaves a hire drafted to a new manager outside any fill free to change it again", async () => {
    const planned = await hire({ isManager: true });
    const id = await hire({ managerId: planned });
    await ok(
      await send(editor, "PATCH", `/api/planned-hires/${id}`, {
        managerId: await person(),
      }),
    );

    const response = await send(editor, "PATCH", `/api/planned-hires/${id}`, {
      managerId: await person(),
    });

    expect(response.statusCode, response.body).toBe(200);
  });

  it("cannot be named as another hire's manager", async () => {
    const id = await hire({ isManager: true });
    await filled(id, newPerson());
    const other = await hire();

    const added = await send(editor, "POST", "/api/planned-hires", {
      hires: [{ positionId: testPosition, managerId: id }],
    });
    const changed = await send(editor, "PATCH", `/api/planned-hires/${other}`, {
      managerId: id,
    });

    for (const response of [added, changed]) {
      expect(response.statusCode).toBe(400);
      expect(refusal(response)).toBe(
        "That planned hire is being filled, so it can't be a manager; once the fill is approved, choose the person who fills it",
      );
    }
  });

  it("keeps a hire it moves from being removed", async () => {
    const id = await hire({ isManager: true });
    const report = await hire({ managerId: id });
    await filled(id, newPerson());

    const response = await send(
      editor,
      "DELETE",
      `/api/planned-hires/${report}`,
    );

    expect(response.statusCode).toBe(409);
    expect(refusal(response)).toBe(partOfFill);
  });

  it("keeps its person's line date", async () => {
    const transfer = await person({ isManager: false });
    await filled(await hire({ managerId: await person() }), existing(transfer));

    const response = await send(editor, "PATCH", `/api/people/${transfer}`, {
      managerFrom: "2026-01-05",
    });

    expect(response.statusCode).toBe(409);
    expect(refusal(response)).toBe(partOfFill);
  });

  it("keeps an undo from putting back a manager change on its person", async () => {
    // Given a transfer whose own manager change was discarded, then a fill that sets nothing on them
    const transfer = await person({ isManager: false });
    await ok(
      await send(editor, "PATCH", `/api/people/${transfer}`, {
        managerId: await person(),
      }),
    );
    const discarded = await ok<{ changeSetId: string }>(
      await send(editor, "DELETE", `/api/people/${transfer}/draft`),
    );
    await filled(await hire(), existing(transfer));

    // When the discard is undone
    const response = await send(
      editor,
      "POST",
      `/api/undo/${discarded.changeSetId}`,
    );

    // Then it is refused, as changing the manager would be
    expect(response.statusCode).toBe(409);
    expect(refusal(response)).toBe(partOfFill);
  });

  it("is not approved once its person has left", async () => {
    const transfer = await person({ isManager: false });
    const id = await hire();
    await filled(id, existing(transfer));
    await ok(
      await send(editor, "PATCH", `/api/people/${transfer}`, {
        endDate: "2021-01-01",
      }),
    );
    await approved({ people: [transfer] });

    const response = await approve({ plannedHires: [id] });

    expect(response.statusCode).toBe(409);
    expect(refusal(response)).toMatch(
      /has left, so can't fill a planned hire$/u,
    );
  });
});

describe("a fill and other users' changes", () => {
  it("is refused while another user is changing a hire that reports to the planned manager", async () => {
    const id = await hire({ isManager: true });
    const report = await hire({ managerId: id });
    const other = await test.signedIn("workforce-administrator");
    await ok(
      await send(
        other,
        "PATCH",
        `/api/planned-hires/${report}`,
        { targetDate: "2099-10-01" },
        { publish: false },
      ),
    );

    const response = await fill(id, newPerson());

    expect(response.statusCode).toBe(409);
    expect(refusal(response)).toBe(
      "A planned hire reporting to this one has a draft; approve or discard it before filling this one",
    );
  });

  it("is refused while another user is changing the person filling it", async () => {
    const transfer = await person({ isManager: false });
    const other = await test.signedIn("workforce-administrator");
    await ok(
      await send(
        other,
        "PATCH",
        `/api/people/${transfer}`,
        { preferredName: unique("Fictional Renamed") },
        { publish: false },
      ),
    );

    const response = await fill(await hire(), existing(transfer));

    expect(response.statusCode).toBe(409);
    expect(refusal(response)).toMatch(/has a draft; approve or discard it/u);
  });

  it("is not decided by an Approver who approves planned hires but not people", async () => {
    const id = await hire();
    await filled(id, newPerson());
    const hiresApprover = await test.signedIn([
      "people:view",
      "restricted:view",
      "hiring-plan:view",
      "hiring-plan:approve",
    ]);

    const approving = await approve({ plannedHires: [id] }, hiresApprover);
    const rejecting = await send(
      hiresApprover,
      "POST",
      "/api/drafts/rejection",
      { plannedHires: [id], reason: "Fictional reason" },
    );

    for (const response of [approving, rejecting]) {
      expect(response.statusCode).toBe(403);
      expect(refusal(response)).toBe(
        "This draft is part of filling a planned hire, which this role can't decide",
      );
    }
  });
});

async function otherPosition(): Promise<string> {
  const [positions] = await test.connection
    .select({ id: lists.id })
    .from(lists)
    .where(eq(lists.builtIn, "positions"));
  const [added] = await test.connection
    .insert(listItems)
    .values({
      listId: String(positions?.id),
      label: unique("Fictional Position"),
      position: 100 + count,
    })
    .returning({ id: listItems.id });
  return String(added?.id);
}

describe("a fill given a manager", () => {
  it("has a new person report to them, and drafts the hire to them too, approved together", async () => {
    const id = await hire({ managerId: await person() });
    const manager = await person();
    const name = unique("Fictional Starter");

    await filled(id, newPerson({ preferredName: name, managerId: manager }));
    expect((await rowNamed(name))?.manager?.id).toBe(manager);
    expect((await hireOf(id))?.managerId).toBe(manager);
    const added = String((await rowNamed(name))?.id);
    await approved({ people: [added] });

    expect((await liveHire(id))?.managerId).toBe(manager);
    expect((await rowOf(added))?.manager?.id).toBe(manager);
  });

  it("puts the hire's own manager back when discarded", async () => {
    const own = await person();
    const id = await hire({ managerId: own });

    await filled(id, newPerson({ managerId: await person() }));
    await ok(await send(editor, "DELETE", `/api/planned-hires/${id}/draft`));

    expect((await hireOf(id))?.managerId).toBe(own);
    expect((await hireOf(id))?.draft).toBeUndefined();
  });

  it("adds a new person with no manager when none is given in place of the hire's", async () => {
    const id = await hire({ managerId: await person() });
    const name = unique("Fictional Starter");

    await filled(id, newPerson({ preferredName: name, managerId: null }));

    expect((await rowNamed(name))?.manager ?? null).toBeNull();
  });

  it("moves someone already in Fathom to them from the day given", async () => {
    const id = await hire({ managerId: await person() });
    const manager = await person();
    const transfer = await person({ isManager: false });

    await filled(
      id,
      existing(transfer, { managerId: manager, managerFrom: "2026-01-05" }),
    );

    expect(await rowOf(transfer)).toMatchObject({
      manager: { id: manager },
      managerFrom: "2026-01-05",
    });
  });

  it("is refused when the manager is a planned hire", async () => {
    const id = await hire();
    const planned = await hire({ isManager: true });

    const response = await fill(id, newPerson({ managerId: planned }));

    expect(response.statusCode).toBe(400);
    expect(refusal(response)).toBe("Choose a manager from People");
  });
});

describe("a hire under a planned manager", () => {
  it("is filled by a new person given a manager", async () => {
    const id = await hire({ managerId: await hire({ isManager: true }) });
    const manager = await person();
    const name = unique("Fictional Starter");

    await filled(id, newPerson({ preferredName: name, managerId: manager }));

    expect((await rowNamed(name))?.manager?.id).toBe(manager);
  });

  it("is refused for a new person given no manager", async () => {
    const id = await hire({ managerId: await hire({ isManager: true }) });

    const response = await fill(id, newPerson({ managerId: null }));

    expect(response.statusCode).toBe(409);
    expect(refusal(response)).toBe("Choose a manager from People");
  });

  it("leaves someone already in Fathom given no manager with the one they have", async () => {
    const id = await hire({ managerId: await hire({ isManager: true }) });
    const manager = await person();
    const transfer = await person({
      isManager: false,
      managerId: manager,
      managerFrom: "2020-01-01",
    });

    await filled(id, existing(transfer, { managerId: null }));

    expect((await rowOf(transfer))?.manager?.id).toBe(manager);
  });
});

describe("a hire with a rejected draft", () => {
  it("is refused until the draft is discarded", async () => {
    const id = await hire();
    await ok(
      await send(editor, "PATCH", `/api/planned-hires/${id}`, {
        targetDate: "2099-06-01",
      }),
    );
    await ok(await reject({ plannedHires: [id] }));

    const response = await fill(id, newPerson());

    expect(response.statusCode).toBe(409);
    expect(refusal(response)).toBe(
      "This planned hire has a rejected draft; discard it or send it for approval again before filling it",
    );
    await ok(await send(editor, "DELETE", `/api/planned-hires/${id}/draft`));
    expect((await fill(id, newPerson())).statusCode).toBe(200);
  });
});

describe("the position of someone already in Fathom who fills a hire", () => {
  it("becomes the hire's, approved with the fill", async () => {
    const position = await otherPosition();
    const id = await hire({ positionId: position });
    const transfer = await person({ isManager: false });

    await filled(id, existing(transfer));
    expect((await rowOf(transfer))?.draft?.changed).toContain("positionId");
    await approved({ plannedHires: [id] });

    expect((await rowOf(transfer))?.positionId).toBe(position);
  });

  it("goes back when the fill is discarded, and is kept while it waits", async () => {
    const id = await hire({ positionId: await otherPosition() });
    const transfer = await person({ isManager: false });
    await filled(id, existing(transfer));

    const changing = await send(editor, "PATCH", `/api/people/${transfer}`, {
      positionId: testPosition,
    });
    expect(changing.statusCode).toBe(409);

    await ok(await send(editor, "DELETE", `/api/planned-hires/${id}/draft`));
    const after = await rowOf(transfer);
    expect(after?.positionId).toBe(testPosition);
    expect(after?.draft).toBeUndefined();
  });

  it("drafts nothing about it when they already hold it", async () => {
    const id = await hire();
    const transfer = await person({ isManager: false });

    await filled(id, existing(transfer));

    expect((await rowOf(transfer))?.draft?.changed ?? []).not.toContain(
      "positionId",
    );
  });
});

describe("a new person's values", () => {
  it("adds those the fill gives to the ones the hire has", async () => {
    const { field } = await ok<{ field: Field }>(
      await send(editor, "POST", "/api/people/columns", {
        name: unique("Fictional Link"),
        type: "link",
        visibility: "general",
        required: false,
      }),
      201,
    );
    await test.approveLists();
    const id = await hire();
    const name = unique("Fictional Starter");
    const link = { address: "https://example.test/fill", text: "" };

    await filled(
      id,
      newPerson({ preferredName: name, links: { [field.id]: link } }),
    );

    expect((await rowNamed(name))?.links[field.id]).toEqual(link);
  });
});

describe("what a fill is given", () => {
  const someColumn = "00000000-0000-4000-8000-00000000f0aa";

  it.each([
    [
      "a link that is not a web address",
      { links: { [someColumn]: { address: "javascript:alert(1)", text: "" } } },
    ],
    [
      "a value for something that is not a column",
      { values: { "not-a-column": ["a"] } },
    ],
    [
      "a note for something that is not a column",
      { notes: { "not-a-column": "a" } },
    ],
  ])("refuses %s", async (_name, given) => {
    expect((await fill(await hire(), newPerson(given))).statusCode).toBe(400);
  });

  it("carries a hire's number to the new person, 0 included, and keeps one the fill gives", async () => {
    const column = async () =>
      (
        await ok<{ field: Field }>(
          await send(editor, "POST", "/api/people/columns", {
            name: unique("Fictional Score"),
            type: "number",
            visibility: "general",
            onPlannedHires: true,
          }),
          201,
        )
      ).field.id;
    const held = await column();
    const given = await column();
    await test.approveLists();
    const id = await hire({ numbers: { [held]: 0 } });
    const name = unique("Fictional Starter");

    await filled(
      id,
      newPerson({
        preferredName: name,
        numbers: { [held]: 7, [given]: 3 },
      }),
    );

    expect((await rowNamed(name))?.numbers).toEqual({
      [held]: 0,
      [given]: 3,
    });
  });

  it("does not let a value the fill gives replace one the hire has", async () => {
    const { field } = await ok<{ field: Field }>(
      await send(editor, "POST", "/api/people/columns", {
        name: unique("Fictional Link"),
        type: "link",
        visibility: "general",
      }),
      201,
    );
    await test.approveLists();
    const own = { address: "https://example.test/hire", text: "" };
    const id = await hire({ links: { [field.id]: own } });
    const name = unique("Fictional Starter");

    await filled(
      id,
      newPerson({
        preferredName: name,
        links: {
          [field.id]: { address: "https://example.test/fill", text: "" },
        },
      }),
    );

    expect((await rowNamed(name))?.links[field.id]).toEqual(own);
  });
});

describe("a manager given to a fill", () => {
  const unknown = "00000000-0000-4000-8000-00000000f0bb";

  it("is refused when no one has that ID", async () => {
    const response = await fill(
      await hire(),
      newPerson({ managerId: unknown }),
    );
    expect(response.statusCode).toBe(400);
    expect(refusal(response)).toBe("Choose a manager from People");
  });

  it("is refused when not marked as a manager, even if the line would not move", async () => {
    const unmarked = await person({ isManager: false });
    const id = await hire({ managerId: await person() });

    const response = await fill(id, newPerson({ managerId: unmarked }));

    expect(response.statusCode).toBe(409);
    expect(refusal(response)).toContain("is not a manager yet");
  });

  it("is refused when drafted to be removed", async () => {
    const leaving = await person();
    await ok(await send(editor, "DELETE", `/api/people/${leaving}`));

    const response = await fill(
      await hire(),
      newPerson({ managerId: leaving }),
    );

    expect(response.statusCode).toBe(400);
    expect(refusal(response)).toBe("Choose a manager from People");
  });

  it("is refused when it is a planned hire being filled", async () => {
    const planned = await hire({ isManager: true });
    await filled(planned, newPerson());

    const response = await fill(
      await hire(),
      newPerson({ managerId: planned }),
    );

    expect(response.statusCode).toBe(400);
    expect(refusal(response)).toContain("is being filled");
  });

  it("is refused when it is the person filling the hire", async () => {
    const transfer = await person();

    const response = await fill(
      await hire(),
      existing(transfer, { managerId: transfer }),
    );

    expect(response.statusCode).toBeGreaterThanOrEqual(400);
    expect((await rowOf(transfer))?.draft).toBeUndefined();
  });

  it("drafts the hire to them when the person already reports to them", async () => {
    const manager = await person();
    const transfer = await person({
      isManager: false,
      managerId: manager,
      managerFrom: "2020-01-01",
    });
    const id = await hire({ managerId: await person() });

    await filled(id, existing(transfer, { managerId: manager }));

    expect((await hireOf(id))?.managerId).toBe(manager);
    expect((await rowOf(transfer))?.draft?.changed ?? []).not.toContain(
      "managerId",
    );
  });
});

describe("a fill with a manager or position, changed later", () => {
  it("keeps the hire's position while it waits", async () => {
    const id = await hire();
    await filled(id, newPerson());

    const response = await send(editor, "PATCH", `/api/planned-hires/${id}`, {
      positionId: await otherPosition(),
    });

    expect(response.statusCode).toBe(409);
    expect(refusal(response)).toBe(partOfFill);
  });

  it("is undone whole, manager and position with it", async () => {
    const own = await person();
    const id = await hire({
      managerId: own,
      positionId: await otherPosition(),
    });
    const transfer = await person({ isManager: false });
    const changeSetId = await filled(
      id,
      existing(transfer, { managerId: await person() }),
    );

    await ok(await send(editor, "POST", `/api/undo/${changeSetId}`));

    expect((await hireOf(id))?.managerId).toBe(own);
    expect((await rowOf(transfer))?.draft).toBeUndefined();
    expect((await rowOf(transfer))?.positionId).toBe(testPosition);
  });

  it("is sent for approval again with its manager and position", async () => {
    const position = await otherPosition();
    const id = await hire({ positionId: position });
    const manager = await person();
    const transfer = await person({ isManager: false });
    await filled(id, existing(transfer, { managerId: manager }));
    await ok(await reject({ plannedHires: [id] }));

    await ok(
      await send(editor, "DELETE", `/api/planned-hires/${id}/draft/rejection`),
    );

    expect((await hireOf(id))?.draft?.state).toBe("waiting");
    expect(await rowOf(transfer)).toMatchObject({
      positionId: position,
      manager: { id: manager },
    });
  });

  it("comes back when a discard of a fill that changed only the position is undone", async () => {
    const position = await otherPosition();
    const id = await hire({ positionId: position });
    const transfer = await person({ isManager: false });
    await filled(id, existing(transfer));
    const discarded = await ok<{ changeSetId: string }>(
      await send(editor, "DELETE", `/api/planned-hires/${id}/draft`),
    );

    await ok(await send(editor, "POST", `/api/undo/${discarded.changeSetId}`));

    expect((await rowOf(transfer))?.positionId).toBe(position);
  });

  it("stops an undo putting back a position on someone another fill now holds", async () => {
    const transfer = await person({ isManager: false });
    await ok(
      await send(editor, "PATCH", `/api/people/${transfer}`, {
        positionId: await otherPosition(),
      }),
    );
    const discarded = await ok<{ changeSetId: string }>(
      await send(editor, "DELETE", `/api/people/${transfer}/draft`),
    );
    await filled(await hire(), existing(transfer));

    const response = await send(
      editor,
      "POST",
      `/api/undo/${discarded.changeSetId}`,
    );

    expect(response.statusCode).toBe(409);
    expect(refusal(response)).toBe(partOfFill);
  });
});
