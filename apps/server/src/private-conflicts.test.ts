// SPDX-License-Identifier: Apache-2.0

// Integration tests for the check on publishing private changes: a field someone else published a
// change to since a user's private change began, or a record one of them removed, is refused with
// both sides, until the user keeps theirs or the other, while fields only they changed go through
// without asking.

import { changes, changeSets, drafts, valueField } from "@fathom/db";
import { type PrivateConflicts } from "@fathom/shared";
import { and, eq } from "drizzle-orm";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import { unique } from "./test-app.ts";
import {
  alice,
  approver,
  bob,
  changeSetOf,
  closeUnpublishedTests,
  decide,
  discard,
  draftPeople,
  history,
  keepingSide,
  livePeople,
  north,
  personOf,
  publish,
  saved,
  send,
  siteColumn,
  south,
  startUnpublishedTests,
  test,
  undo,
  user,
  type User,
} from "./test-unpublished.ts";

beforeAll(startUnpublishedTests);

afterAll(closeUnpublishedTests);

// Each test starts with no private changes left by another.
afterEach(async () => {
  await discard(alice);
  await discard(bob);
});

const siteField = () => valueField(siteColumn.id);

const setSite = (who: User, person: string, choiceId: string) =>
  saved(who, "PATCH", `/api/people/${person}`, {
    values: { [siteColumn.id]: [choiceId] },
  });

const publishing = (who: User, body?: object) =>
  send(who, "POST", "/api/unpublished/publish", body);

const publishedOf = async (id: string) =>
  (
    await test.connection
      .select({ fields: drafts.fields })
      .from(drafts)
      .where(and(eq(drafts.recordType, "person"), eq(drafts.recordId, id)))
  )[0]?.fields;

// Ana (alice) and Ben (bob) each change Kai's Site privately, and Ana publishes hers first.
async function bothChangeSite(): Promise<string> {
  const [person = ""] = await livePeople(1);
  await setSite(alice, person, south.id);
  await setSite(bob, person, north.id);
  expect(await publish(alice)).toBe(1);
  return person;
}

describe("publishing a field someone else changed since", () => {
  it("is refused, saving nothing, with both values and who made the other", async () => {
    // Given Ana's published Site and Ben's private one
    const person = await bothChangeSite();
    const kai = await personOf(bob, person);

    // When Ben publishes
    const response = await publishing(bob);

    // Then he is asked which to keep, and Ana's value stays
    expect(response.statusCode, response.body).toBe(409);
    expect(response.json<PrivateConflicts>()).toEqual({
      error:
        "Someone else changed some of these since they were made; choose which to keep, then publish again",
      conflicts: [
        {
          recordType: "person",
          recordId: person,
          subject: kai?.preferredName,
          field: siteField(),
          mine: {
            field: "value",
            column: siteColumn.name,
            oldValue: null,
            newValue: ["North"],
          },
          theirs: {
            field: "value",
            column: siteColumn.name,
            oldValue: null,
            newValue: ["South"],
          },
          state: "waiting",
          by: alice.name,
          token: expect.any(String) as string,
        },
      ],
    });
    expect(await publishedOf(person)).toEqual({ [siteField()]: [south.id] });
    expect((await personOf(bob, person))?.values[siteColumn.id]).toEqual([
      north.id,
    ]);
  });

  it("keeps the other value where the user keeps it, publishing their other fields", async () => {
    // Given Ben also renamed Kai, a field nobody else changed
    const person = await bothChangeSite();
    const renamed = unique("Fictional Renamed");
    await saved(bob, "PATCH", `/api/people/${person}`, {
      preferredName: renamed,
    });

    // When he keeps Ana's Site
    const response = await keepingSide(bob, "theirs");

    // Then her Site stays, and his name goes through
    expect(response.statusCode, response.body).toBe(200);
    expect(await publishedOf(person)).toEqual({
      [siteField()]: [south.id],
      preferredName: renamed,
    });
    const changedBy = (await personOf(alice, person))?.draft?.changedBy;
    expect(Object.values(changedBy ?? {}).sort()).toEqual(
      [alice.name, bob.name].sort(),
    );
  });

  it("records a value given up in the user's own history alone, as a change of the draft", async () => {
    // Given Ben also renamed Kai, which goes through, while he keeps Ana's Site
    const person = await bothChangeSite();
    await saved(bob, "PATCH", `/api/people/${person}`, {
      preferredName: unique("Fictional Renamed"),
    });

    await keepingSide(bob, "theirs");

    const [latest] = await history(bob);
    expect(latest).toMatchObject({ kind: "edit", madeBy: bob.name });
    expect(latest?.records).toEqual([
      expect.objectContaining({
        kind: "person",
        action: "changed",
        draft: true,
        fields: [
          {
            field: "value",
            column: siteColumn.name,
            oldValue: ["North"],
            newValue: ["South"],
          },
        ],
      }),
    ]);
    const anaSees = (await history(alice)).map(({ id }) => id);
    expect(anaSees).not.toContain(latest?.id);
  });

  it("publishes a change that keeps the other value of a field its own value no longer fits", async () => {
    // Given Ben's private Employee ID for Kai, which Ana then gives Lee and publishes, with her own
    // for Kai
    const [kai = "", lee = ""] = await livePeople(2);
    const taken = unique("E-Taken");
    await saved(bob, "PATCH", `/api/people/${kai}`, { employeeId: taken });
    await saved(alice, "PATCH", `/api/people/${kai}`, {
      employeeId: unique("E-Other"),
    });
    await saved(alice, "PATCH", `/api/people/${lee}`, { employeeId: taken });
    await publish(alice);

    // When Ben keeps Ana's ID for Kai
    const response = await keepingSide(bob, "theirs");

    // Then the publish goes ahead
    expect(response.statusCode, response.body).toBe(200);
  });

  it("names nobody for a published value the history doesn't hold", async () => {
    // Given a published Site written another way, as Fathom's own drafts are, which no route makes,
    // so the test writes it directly
    const [person = ""] = await livePeople(1);
    await setSite(bob, person, north.id);
    await test.connection.insert(drafts).values({
      recordType: "person",
      recordId: person,
      action: "changed",
      fields: { [siteField()]: [south.id] },
      state: "waiting",
    });

    const [conflict] = (await publishing(bob)).json<PrivateConflicts>()
      .conflicts;

    expect(conflict).toMatchObject({ state: "waiting", by: null });
  });
});

describe("a change given up", () => {
  it("never meets a published change in a set still private, since what is saved together stays together", async () => {
    // Given Eve's new Features column drafted with a new list, in one change set, and her role
    // since able to publish only one of them
    const eve = await user(["features:edit", "people:view"]);
    await saved(eve, "POST", "/api/features/columns", {
      name: unique("Fictional Tier"),
      type: "choice",
      newList: {
        name: unique("Fictional Tiers"),
        choices: [{ label: "Fictional High" }, { label: "Fictional Low" }],
      },
    });
    await test.holdOnly(eve.id, ["configuration:edit", "people:view"]);

    // When Eve publishes
    const response = await publishing(eve);

    // Then neither is published, so the set holds nothing published that giving up could meet
    const { total, left } = response.json<{ total: number; left: number }>();
    expect(total).toBe(0);
    expect(left).toBeGreaterThan(1);
  });

  it("of a whole record reads as taking back the user's own change, not as removing or adding it", async () => {
    // Given Ben's private Site for Kai, and Ana's published removal of Kai, which Ben keeps
    const [person = ""] = await livePeople(1);
    await setSite(bob, person, north.id);
    await saved(alice, "DELETE", `/api/people/${person}`);
    await publish(alice);

    await keepingSide(bob, "theirs");

    // Then Ben's history takes his Site back, and says nothing of removing Kai
    const [latest] = await history(bob);
    expect(latest?.records).toEqual([
      expect.objectContaining({
        kind: "person",
        action: "changed",
        fields: [
          {
            field: "value",
            column: siteColumn.name,
            oldValue: ["North"],
            newValue: null,
          },
        ],
      }),
    ]);
  });

  it("of the user's own removal leaves nothing in their history that adds the record", async () => {
    // Given Ben's private removal of Kai, and Ana's published Site since, which Ben keeps
    const [person = ""] = await livePeople(1);
    await saved(bob, "DELETE", `/api/people/${person}`);
    await setSite(alice, person, south.id);
    await publish(alice);

    await keepingSide(bob, "theirs");

    const actions = (await history(bob))
      .filter(({ madeBy }) => madeBy === bob.name)
      .flatMap(({ records }) => records.map(({ action }) => action));
    expect(actions).not.toContain("created");
  });
});

describe("taking back a private removal while changing another record", () => {
  // Dan adds Kai, with a Site, and Ana adds Mo, both published; Dan may approve people, but not his
  // own drafts.
  async function kaiAndMo() {
    const dan = await user(["people:edit", "people:approve"]);
    const [kai = ""] = await draftPeople(dan, [unique("Fictional Kai")]);
    await setSite(dan, kai, south.id);
    await publish(dan);
    const [mo = ""] = await draftPeople(alice, [unique("Fictional Mo")]);
    await publish(alice);
    return { dan, kai, mo };
  }

  it("by undoing it, leaves the maker of an addition unable to approve it alone", async () => {
    // Given Bob privately removed Kai, undid that, and published with another change
    const { dan, kai, mo } = await kaiAndMo();
    const removal = await changeSetOf(bob, "DELETE", `/api/people/${kai}`);
    expect((await undo(bob, removal)).statusCode).toBe(200);
    await saved(bob, "PATCH", `/api/people/${mo}`, {
      preferredName: unique("Fictional Renamed"),
    });
    await publish(bob);

    // When Dan approves Kai
    const approving = await send(dan, "POST", "/api/drafts/approval", {
      people: [kai],
    });

    // Then he is refused
    expect(approving.statusCode, approving.body).toBe(403);
  });
});

describe("a change already given up", () => {
  // Dan adds Kai, then Uma, who may approve people but not her own drafts, renames Kai and publishes.
  async function umaRenamedKai() {
    const dan = await user(["people:edit", "people:approve"]);
    const uma = await user(["people:edit", "people:approve"]);
    const [kai = ""] = await draftPeople(dan, [unique("Fictional Kai")]);
    await publish(dan);
    await saved(uma, "PATCH", `/api/people/${kai}`, {
      preferredName: unique("Fictional Renamed"),
    });
    await publish(uma);
    return { uma, kai };
  }

  const umaStillMade = async (uma: User, kai: string) => {
    const approving = await send(uma, "POST", "/api/drafts/approval", {
      people: [kai],
    });
    expect(approving.statusCode, approving.body).toBe(403);
    expect((await personOf(alice, kai))?.draft?.editors).toContain(uma.name);
  };

  it("isn't given up again on publishing, taking back a change published before", async () => {
    // Given Uma's private removal of Kai discarded by choice, her new private name for Kai, and Ana's
    // published one since
    const { uma, kai } = await umaRenamedKai();
    await saved(uma, "DELETE", `/api/people/${kai}`);
    await discard(uma, { people: [kai] });
    await saved(uma, "PATCH", `/api/people/${kai}`, {
      preferredName: unique("Fictional Again"),
    });
    await saved(alice, "PATCH", `/api/people/${kai}`, {
      preferredName: unique("Fictional Ana's"),
    });
    await publish(alice);

    // When Uma publishes, keeping Ana's name
    expect((await keepingSide(uma, "theirs")).statusCode).toBe(200);

    // Then her published change still counts
    await umaStillMade(uma, kai);
  });
});

describe("publishing over a removal", () => {
  const draftOf = async (id: string) =>
    (
      await test.connection
        .select({ action: drafts.action })
        .from(drafts)
        .where(and(eq(drafts.recordType, "person"), eq(drafts.recordId, id)))
    )[0]?.action;

  it("is refused for a change to a record removed since, until a side is kept", async () => {
    // Given Ben's private Site for Kai, and Ana's published removal of Kai
    const [person = ""] = await livePeople(1);
    await setSite(bob, person, north.id);
    await saved(alice, "DELETE", `/api/people/${person}`);
    await publish(alice);

    // When Ben publishes, then he is asked, and keeping the removal leaves it
    const [conflict] = (await publishing(bob)).json<PrivateConflicts>()
      .conflicts;
    expect(conflict).toMatchObject({
      recordId: person,
      removedBy: "theirs",
      state: "waiting",
      by: alice.name,
    });
    expect(conflict).not.toHaveProperty("field");
    const response = await keepingSide(bob, "theirs");
    expect(response.statusCode, response.body).toBe(200);
    expect(await draftOf(person)).toBe("deleted");
  });

  // Ben privately removes Kai, then Ana's Site for Kai is published and approved.
  async function removedThenChangedLive(): Promise<string> {
    const [person = ""] = await livePeople(1);
    await saved(bob, "DELETE", `/api/people/${person}`);
    await setSite(alice, person, south.id);
    await publish(alice);
    expect((await decide("approval", { people: [person] })).statusCode).toBe(
      200,
    );
    return person;
  }

  it("is refused for the user's removal of a record changed live since, naming who approved it", async () => {
    const person = await removedThenChangedLive();

    const [conflict] = (await publishing(bob)).json<PrivateConflicts>()
      .conflicts;

    expect(conflict).toMatchObject({
      recordId: person,
      removedBy: "mine",
      state: "live",
      by: approver.name,
    });
  });

  it("removes a record changed live since where the user keeps their removal", async () => {
    const person = await removedThenChangedLive();

    const response = await keepingSide(bob, "mine");

    expect(response.statusCode, response.body).toBe(200);
    expect(await draftOf(person)).toBe("deleted");
  });

  it("leaves no draft of a record changed live since where the user keeps it", async () => {
    const person = await removedThenChangedLive();

    const response = await keepingSide(bob, "theirs");

    expect(response.statusCode, response.body).toBe(200);
    expect(await draftOf(person)).toBeUndefined();
  });
});

describe("a set of changes given up", () => {
  it("can't be undone", async () => {
    await bothChangeSite();
    await keepingSide(bob, "theirs");
    const [givenUp] = await history(bob);

    const response = await undo(bob, String(givenUp?.id));

    expect(response.statusCode, response.body).toBe(409);
  });

  it("records the opposite of a removal given up, as adding back what it removed", async () => {
    // Given Ben's private removal of Kai, and Ana's published Site since, which Ben keeps
    const [person = ""] = await livePeople(1);
    await saved(bob, "DELETE", `/api/people/${person}`);
    await setSite(alice, person, south.id);
    await publish(alice);

    await keepingSide(bob, "theirs");

    // No route shows it, since the history leaves out a record's addition or removal given up, so
    // the test reads storage
    const recorded = await test.connection
      .selectDistinct({ action: changes.action })
      .from(changes)
      .innerJoin(changeSets, eq(changeSets.id, changes.changeSetId))
      .where(
        and(eq(changeSets.kind, "given-up"), eq(changes.recordId, person)),
      );
    expect(recorded).toEqual([{ action: "created" }]);
  });
});

describe("another user's private change", () => {
  it("causes no conflict", async () => {
    // Given Ana's and Ben's private Sites for Kai, neither published
    const [person = ""] = await livePeople(1);
    await setSite(alice, person, south.id);
    await setSite(bob, person, north.id);

    // When Ben publishes, then his Site goes through
    expect(await publish(bob)).toBe(1);
    expect(await publishedOf(person)).toEqual({ [siteField()]: [north.id] });
  });

  it("is never named as who made the other value", async () => {
    // Given Ana's published Site, and Ben's and then Cleo's private ones
    const cleo = await user("workforce-administrator");
    const person = await bothChangeSite();
    await setSite(cleo, person, north.id);

    const [conflict] = (await publishing(bob)).json<PrivateConflicts>()
      .conflicts;

    expect(conflict?.by).toBe(alice.name);
    await discard(cleo);
  });
});
