// SPDX-License-Identifier: Apache-2.0

// Integration tests for planned hires' values in People's columns, against a migrated PostgreSQL
// server.

import { changes, fields, plannedHires } from "@fathom/db";
import {
  type ChangeHistory,
  type Choice,
  type Field,
  type List,
  type Person,
} from "@fathom/shared";
import { and, eq } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { errorOf, generalApprover, ok, unique } from "./test-app.ts";
import {
  test,
  editor,
  approver,
  planner,
  open,
  send,
  approve,
  approved,
  person,
  hireRequest,
  draftHire,
  liveHire,
  hiresSeen,
  hireSeen,
  changed,
  startHireTests,
  closeHireTests,
} from "./test-hires.ts";

beforeAll(startHireTests);

afterAll(closeHireTests);

describe("values in People's columns", () => {
  const link = (address: string) => ({ address, text: "" });

  // A web link column, approved so it is live, offered on planned hires unless told otherwise.
  async function linkColumn(
    settings: { visibility?: string; onPlannedHires?: boolean } = {},
  ): Promise<Field> {
    const response = await send(editor, "POST", "/api/people/columns", {
      name: unique("Fictional Profile"),
      type: "link",
      visibility: settings.visibility ?? "general",
      onPlannedHires: settings.onPlannedHires ?? true,
    });
    expect(response.statusCode, response.body).toBe(201);
    await test.approveLists();
    return response.json<{ field: Field }>().field;
  }

  const switchOff = (column: Field) =>
    send(editor, "PUT", `/api/people/columns/${column.id}`, {
      name: column.name,
      type: column.type,
      visibility: column.visibility,
      onPlannedHires: false,
    });

  it("offers every new column on planned hires unless switched off", async () => {
    const response = await send(editor, "POST", "/api/people/columns", {
      name: unique("Fictional Profile"),
      type: "link",
      visibility: "general",
    });
    expect(response.json<{ field: Field }>().field.onPlannedHires).toBe(true);
  });

  it("shows those who see the hiring plan but not Personal data the whole plan and its history, without values in Personal columns", async () => {
    const manager = await test.signedIn(generalApprover);
    const secret = await linkColumn({ visibility: "personal" });
    const requisition = unique("Fictional-Managed");
    const id = await liveHire({
      requisition,
      links: { [secret.id]: link("https://example.test/managed-secret") },
    });
    await changed(id, { stateId: open });
    const { hires, wholePlan } = await hiresSeen(manager);
    expect(wholePlan).toBe(true);
    const seen = hires.find((hire) => hire.id === id);
    expect(seen?.targetDate).toBe("2027-03-15");
    expect(seen?.draft?.changed).toEqual(["stateId"]);
    expect(seen?.links[secret.id]).toBeUndefined();
    const history = JSON.stringify(
      (await ok<ChangeHistory>(await send(manager, "GET", "/api/changes")))
        .entries,
    );
    expect(history).toContain(requisition);
    expect(history).not.toContain("managed-secret");
  });

  it("lets an Approver who sees the hiring plan, but not Personal data, decide a hire's draft only when it changes nothing in a Personal column", async () => {
    const deciding = await test.signedIn([
      "hiring-plan:approve",
      "people:view",
      "hiring-plan:view",
      "confidential:view",
    ]);
    const secret = await linkColumn({ visibility: "personal" });
    const reason = unique("Fictional reason");
    const own = await draftHire({ requisition: unique("Fictional-Own") });
    await ok(
      await send(deciding, "POST", "/api/drafts/rejection", {
        plannedHires: [own.id],
        reason,
      }),
    );
    expect(
      JSON.stringify(
        (await ok<ChangeHistory>(await send(deciding, "GET", "/api/changes")))
          .entries,
      ),
    ).toContain(reason);
    const withSecret = await draftHire({
      links: { [secret.id]: link("https://example.test/undecided") },
    });
    expect(
      (
        await send(deciding, "POST", "/api/drafts/rejection", {
          plannedHires: [withSecret.id],
          reason,
        })
      ).statusCode,
    ).toBe(403);
  });

  it("keeps a hire's values, drafted and then live, and shows each at its column's tier", async () => {
    const general = await linkColumn();
    const secret = await linkColumn({ visibility: "confidential" });
    const { id } = await draftHire({
      links: {
        [general.id]: link("https://example.test/general"),
        [secret.id]: link("https://example.test/secret"),
      },
    });
    const drafted = await hireSeen(id);
    expect(drafted?.links[general.id]?.address).toBe(
      "https://example.test/general",
    );
    expect(drafted?.draft?.changed).toContain(general.id);
    // Placeholders show only what is live.
    expect(await hireSeen(id, planner)).toBeUndefined();
    await approved({ plannedHires: [id] });
    const placeholder = await hireSeen(id, planner);
    expect(placeholder?.links[general.id]?.address).toBe(
      "https://example.test/general",
    );
    expect(placeholder?.links[secret.id]).toBeUndefined();
    expect(Object.keys((await hireSeen(id))?.links ?? {})).toHaveLength(2);
  });

  it("shows a hire's values on its row of People, with the live value its draft changes", async () => {
    const column = await linkColumn();
    const id = await liveHire({
      links: { [column.id]: link("https://example.test/before") },
    });
    await changed(id, {
      links: { [column.id]: link("https://example.test/after") },
    });
    const { people: rows } = await ok<{ people: Person[] }>(
      await send(editor, "GET", "/api/people"),
    );
    const row = rows.find((one) => one.id === id);
    expect(row?.links[column.id]?.address).toBe("https://example.test/after");
    expect(row?.draft?.changed).toContain(column.id);
    expect(row?.draft?.live.links[column.id]?.address).toBe(
      "https://example.test/before",
    );
  });

  it("refuses values in a column switched off for planned hires", async () => {
    const column = await linkColumn({ onPlannedHires: false });
    const response = await send(
      editor,
      "POST",
      "/api/planned-hires",
      hireRequest({ links: { [column.id]: link("https://example.test/") } }),
    );
    expect(response.statusCode).toBe(400);
    expect(errorOf(response)).toBe(
      `${column.name} is switched off for planned hires`,
    );
  });

  it("refuses switching a column off while a live hire has a value in it, until it is cleared", async () => {
    const column = await linkColumn();
    const id = await liveHire({
      links: { [column.id]: link("https://example.test/") },
    });
    const refused = await switchOff(column);
    expect(refused.statusCode).toBe(409);
    expect(errorOf(refused)).toBe(
      `1 planned hire has values in ${column.name}, so it cannot be switched off for planned hires yet. Clear them first.`,
    );
    await changed(id, { links: { [column.id]: null } });
    await approved({ plannedHires: [id] });
    const cleared = await switchOff(column);
    expect(cleared.statusCode, cleared.body).toBe(200);
  });

  it("lets a column be switched off while only filled hires, which have left People, have values in it", async () => {
    const column = await linkColumn();
    const id = await liveHire({
      links: { [column.id]: link("https://example.test/") },
    });
    // Filling a hire is not built yet, so the hire is filled behind Fathom's back.
    await test.connection
      .update(plannedHires)
      .set({ filledBy: await person() })
      .where(eq(plannedHires.id, id));
    const response = await switchOff(column);
    expect(response.statusCode, response.body).toBe(200);
  });

  it("refuses switching a column off while a hire's draft gives a value in it", async () => {
    const column = await linkColumn();
    const { id } = await draftHire({
      links: { [column.id]: link("https://example.test/") },
    });
    const refused = await switchOff(column);
    expect(refused.statusCode).toBe(409);
    expect(errorOf(refused)).toBe(
      `Drafts give planned hires values in ${column.name}, so it cannot be switched off for planned hires yet`,
    );
    await ok(await send(editor, "DELETE", `/api/planned-hires/${id}/draft`));
  });

  it("puts a hire's values back when undoing its draft", async () => {
    const column = await linkColumn();
    const id = await liveHire({
      links: { [column.id]: link("https://example.test/before") },
    });
    const changeSetId = await changed(id, {
      links: { [column.id]: link("https://example.test/after") },
    });
    await ok(await send(editor, "POST", `/api/undo/${String(changeSetId)}`));
    expect((await hireSeen(id))?.links[column.id]?.address).toBe(
      "https://example.test/before",
    );
  });

  // A column taking several choices from a new list of two, approved so both are live.
  async function choiceColumn(): Promise<{ column: Field; choices: string[] }> {
    const { list } = await ok<{ list: List }>(
      await send(editor, "POST", "/api/lists", {
        name: unique("Fictional Skills"),
      }),
      201,
    );
    const { choices } = await ok<{ choices: Choice[] }>(
      await send(editor, "POST", `/api/lists/${list.id}/choices`, {
        choices: [{ label: "Fictional Rust" }, { label: "Fictional Go" }],
      }),
      201,
    );
    await test.approveLists();
    const response = await send(editor, "POST", "/api/people/columns", {
      name: unique("Fictional Skills"),
      listId: list.id,
      multiple: true,
    });
    expect(response.statusCode, response.body).toBe(201);
    await test.approveLists();
    return {
      column: response.json<{ field: Field }>().field,
      choices: choices.map(({ id }) => id),
    };
  }

  it("keeps a hire's choices, and keeps a column taking several while a hire has several", async () => {
    const { column, choices } = await choiceColumn();
    const id = await liveHire({ values: { [column.id]: choices } });
    expect((await hireSeen(id))?.values[column.id]).toEqual(choices);
    const single = {
      name: column.name,
      listId: column.listId,
      multiple: false,
    };
    const refused = await send(
      editor,
      "PUT",
      `/api/people/columns/${column.id}`,
      single,
    );
    expect(refused.statusCode).toBe(409);
    expect(errorOf(refused)).toBe(
      `1 planned hire has several choices for ${column.name}, so it cannot take only one yet`,
    );
    await changed(id, { values: { [column.id]: [String(choices[0])] } });
    await approved({ plannedHires: [id] });
    expect((await hireSeen(id))?.values[column.id]).toEqual([choices[0]]);
  });

  it("lets a column take one choice while only a filled hire has several", async () => {
    const { column, choices } = await choiceColumn();
    const id = await liveHire({ values: { [column.id]: choices } });
    await test.connection
      .update(plannedHires)
      .set({ filledBy: await person() })
      .where(eq(plannedHires.id, id));
    const response = await send(
      editor,
      "PUT",
      `/api/people/columns/${column.id}`,
      { name: column.name, listId: column.listId, multiple: false },
    );
    expect(response.statusCode, response.body).toBe(200);
  });

  it("records a hire's values removed with their column", async () => {
    const column = await linkColumn();
    const id = await liveHire({
      links: { [column.id]: link("https://example.test/") },
    });
    await ok(await send(editor, "DELETE", `/api/people/columns/${column.id}`));
    await test.approveLists();
    const recorded = await test.connection
      .select({ action: changes.action, oldValue: changes.oldValue })
      .from(changes)
      .where(
        and(
          eq(changes.recordType, "planned-hire"),
          eq(changes.recordId, id),
          eq(changes.field, `value:${column.id}`),
          eq(changes.draft, false),
        ),
      );
    expect(recorded.map(({ oldValue }) => oldValue)).toContainEqual(
      link("https://example.test/"),
    );
    expect((await hireSeen(id))?.links).toEqual({});
  });

  it("shows changes to a hire's values in the change history to those who see the plan", async () => {
    const column = await linkColumn();
    const requisition = unique("Fictional-Linked");
    const id = await liveHire({ requisition });
    await changed(id, {
      links: { [column.id]: link("https://example.test/history") },
    });
    const { entries } = await ok<ChangeHistory>(
      await send(approver, "GET", "/api/changes"),
    );
    const seen = JSON.stringify(
      entries.filter((entry) => JSON.stringify(entry).includes(requisition)),
    );
    expect(seen).toContain("https://example.test/history");
  });

  it("refuses approving a hire's draft whose values no longer fit the columns offered", async () => {
    const column = await linkColumn();
    const { id } = await draftHire({
      links: { [column.id]: link("https://example.test/") },
    });
    // Drafting refuses switching the column off, so only a change behind Fathom's back gets here.
    await test.connection
      .update(fields)
      .set({ onPlannedHires: false })
      .where(eq(fields.id, column.id));
    const response = await approve({ plannedHires: [id] });
    expect(response.statusCode).toBe(409);
    expect(errorOf(response)).toBe(
      "A planned hire's draft no longer fits the columns; change it, then approve it",
    );
  });
});
