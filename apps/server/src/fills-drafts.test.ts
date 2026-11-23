// SPDX-License-Identifier: Apache-2.0

// Integration tests for a fill's draft, against a migrated PostgreSQL server: approving,
// rejecting, discarding, resubmitting and undoing it as one draft, a fill waiting for approval, other
// users' changes, and a hire with a rejected draft.

import { type ChangeHistory } from "@fathom/shared";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { generalApprover, testPosition } from "./test-app.ts";
import {
  type User,
  test,
  editor,
  proposed,
  unique,
  send,
  ok,
  partOfFill,
  refusal,
  approve,
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
      "personal:view",
      "personal:edit",
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

  it("is not discarded through its person by a role that doesn't change the hiring plan's class", async () => {
    const id = await hire();
    const body = newPerson();
    await filled(id, body);
    const added = String((await rowNamed(body.preferredName))?.id);
    const withoutClass = await test.signedIn([
      "people:view",
      "people:edit",
      "personal:view",
      "personal:edit",
      "hiring-plan:view",
      "hiring-plan:edit",
    ]);

    const response = await send(
      withoutClass,
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
      "personal:view",
      "people:approve",
    ]);

    const response = await approve({ people: [added] }, peopleApprover);

    expect(response.statusCode).toBe(403);
    expect(refusal(response)).toBe(
      "This draft is part of filling a planned hire, which this role can't decide",
    );
    expect((await liveHire(id))?.filledBy).toBeNull();
  });

  it("names a new person a fill adds in the change history only to those who see Personal details", async () => {
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
    const withoutPersonal = await test.signedIn(generalApprover);

    // Then the editor sees the person, who fills the hire and manages its report
    const edited = await recordsSeen(editor);
    expect(edited.some(({ name }) => name === body.preferredName)).toBe(true);
    expect(value(edited, "filledBy")).toBe(body.preferredName);
    expect(value(edited, "managerId")).toBe(body.preferredName);
    // And the Project Manager sees the hires changed, but nobody named
    const seen = await recordsSeen(withoutPersonal);
    expect(seen.some(({ name }) => name === body.preferredName)).toBe(false);
    expect(value(seen, "filledBy")).toBeNull();
    expect(value(seen, "managerId")).toBeNull();
  });

  it("names someone already in Fathom who fills a hire in the change history only to those who see Personal details", async () => {
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
    const withoutPersonal = await test.signedIn(generalApprover);

    expect(await filler(editor)).not.toBeNull();
    expect(await filler(withoutPersonal)).toBeNull();
  });

  it("is not rejected by an Approver who does not see Personal details", async () => {
    const id = await hire();
    await filled(id, newPerson());
    const withoutPersonal = await test.signedIn(generalApprover);

    const response = await send(
      withoutPersonal,
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

  it("needs an Approver who sees start and end dates, since it holds a start date or a reporting line", async () => {
    const id = await hire();
    await filled(id, newPerson());
    const withoutPersonal = await test.signedIn(generalApprover);

    const response = await approve({ plannedHires: [id] }, withoutPersonal);

    expect(response.statusCode).toBe(403);
    expect(refusal(response)).toBe(
      "A fill names who fills the hire, so an Approver who sees start and end dates must decide it",
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
      "personal:view",
      "hiring-plan:view",
      "confidential:view",
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
