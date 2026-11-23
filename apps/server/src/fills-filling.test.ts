// SPDX-License-Identifier: Apache-2.0

// Integration tests for filling planned hires, against a migrated PostgreSQL server: with a new
// person or someone already in Fathom, and which hires can be filled. Who may fill a hire is checked
// with every other route in permissions.test.ts.

import { type Field, type Hire } from "@fathom/shared";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { generalApprover, testPosition } from "./test-app.ts";
import {
  test,
  editor,
  proposed,
  open,
  unique,
  send,
  ok,
  refusal,
  approved,
  person,
  hire,
  fill,
  newPerson,
  existing,
  filled,
  rowOf,
  rowNamed,
  hireOf,
  liveHire,
  livePerson,
  startFillTests,
  closeFillTests,
} from "./test-fills.ts";

beforeAll(startFillTests);

afterAll(closeFillTests);

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

  it("names the person a draft fills a hire with only to those who see Personal details", async () => {
    const id = await hire();
    await filled(id, newPerson());
    const withoutPersonal = await test.signedIn(generalApprover);

    const { hires } = await ok<{ hires: Hire[] }>(
      await send(withoutPersonal, "GET", "/api/planned-hires"),
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

  it("answers someone who has left as no one to an actor who does not see Personal details", async () => {
    const id = await hire();
    const former = await person({
      startDate: "2020-01-01",
      endDate: "2021-01-01",
      isManager: false,
    });
    const actor = await test.signedIn([
      "people:view",
      "people:edit",
      "hiring-plan:view",
      "confidential:view",
      "hiring-plan:edit",
      "confidential:edit",
    ]);

    const response = await fill(id, existing(former), actor);

    expect(response.statusCode).toBe(404);
    expect(refusal(response)).toBe("There is no such person");
  });

  it("answers someone who has not started as no one to an actor who does not see Personal details", async () => {
    const id = await hire();
    const starter = await person({ startDate: "2099-01-01", isManager: false });
    const actor = await test.signedIn([
      "people:view",
      "people:edit",
      "hiring-plan:view",
      "confidential:view",
      "hiring-plan:edit",
      "confidential:edit",
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
