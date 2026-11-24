// SPDX-License-Identifier: Apache-2.0

// Integration tests for what a fill gives the person, against a migrated PostgreSQL server: the
// hire's position, manager or one given, values and target date, a planned manager's hires moving to
// the person who fills it, and a manager or position changed later.

import { listItems, lists } from "@fathom/db";
import { type Field } from "@fathom/shared";
import { eq } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { errorOf, ok, testPosition, unique } from "./test-app.ts";
import {
  test,
  editor,
  send,
  partOfFill,
  approved,
  reject,
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
  startFillTests,
  closeFillTests,
} from "./test-fills.ts";

beforeAll(startFillTests);

afterAll(closeFillTests);

// Past the built-in positions, so each added one has a place of its own.
let positionsAdded = 100;

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
      position: (positionsAdded += 1),
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
    expect(errorOf(response)).toBe("Choose a manager from People");
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
    expect(errorOf(response)).toBe("Choose a manager from People");
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
    expect(errorOf(response)).toBe("Choose a manager from People");
  });

  it("is refused when not marked as a manager, even if the line would not move", async () => {
    const unmarked = await person({ isManager: false });
    const id = await hire({ managerId: await person() });

    const response = await fill(id, newPerson({ managerId: unmarked }));

    expect(response.statusCode).toBe(409);
    expect(errorOf(response)).toContain("is not a manager yet");
  });

  it("is refused when drafted to be removed", async () => {
    const leaving = await person();
    await ok(await send(editor, "DELETE", `/api/people/${leaving}`));

    const response = await fill(
      await hire(),
      newPerson({ managerId: leaving }),
    );

    expect(response.statusCode).toBe(400);
    expect(errorOf(response)).toBe("Choose a manager from People");
  });

  it("is refused when it is a planned hire being filled", async () => {
    const planned = await hire({ isManager: true });
    await filled(planned, newPerson());

    const response = await fill(
      await hire(),
      newPerson({ managerId: planned }),
    );

    expect(response.statusCode).toBe(400);
    expect(errorOf(response)).toContain("is being filled");
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
    expect(errorOf(response)).toBe(partOfFill);
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
    expect(errorOf(response)).toBe(partOfFill);
  });
});
