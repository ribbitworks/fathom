// SPDX-License-Identifier: Apache-2.0

// Integration tests for changes a user took back by hand, by discarding them by choice or undoing
// them, before a later give-up of the field: the give-up takes back only the changes since, so the
// ones taken back by hand, and their taking back, count as they would without a clash.

import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import { unique } from "./test-app.ts";
import {
  alice,
  bob,
  closeUnpublishedTests,
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
  undo,
  user,
  type User,
} from "./test-unpublished.ts";

beforeAll(startUnpublishedTests);

afterAll(closeUnpublishedTests);

afterEach(async () => {
  await discard(alice);
  await discard(bob);
});

const rename = async (who: User, id: string) => {
  const name = unique("Fictional Named");
  const { changeSetId } = await saved<{ changeSetId: string }>(
    who,
    "PATCH",
    `/api/people/${id}`,
    { preferredName: name },
  );
  return { name, changeSetId };
};

const setSite = (who: User, id: string, choiceId: string) =>
  saved(who, "PATCH", `/api/people/${id}`, {
    values: { [siteColumn.id]: [choiceId] },
  });

// Uma, who may approve people but not her own drafts, and live Mo, with no draft.
async function umaAndMo() {
  const uma = await user(["people:edit", "people:approve"]);
  const [mo = ""] = await livePeople(1);
  return { uma, mo };
}

// Ana renames Mo and publishes, then Uma publishes, keeping Ana's name, which Mo then has.
async function umaKeepsAnas(uma: User, mo: string) {
  const { name } = await rename(alice, mo);
  await publish(alice);
  expect((await keepingSide(uma, "theirs")).statusCode).toBe(200);
  expect((await personOf(alice, mo))?.preferredName).toBe(name);
}

// The fields Uma's latest change set changed, as her history shows them.
const lastOf = async (uma: User) =>
  (await history(uma))
    .find(({ madeBy }) => madeBy === uma.name)
    ?.records.flatMap(({ fields }) => fields);

async function umaStillChanged(uma: User, mo: string) {
  const approving = await send(uma, "POST", "/api/drafts/approval", {
    people: [mo],
  });
  expect(approving.statusCode, approving.body).toBe(403);
  expect((await personOf(alice, mo))?.draft?.editors).toContain(uma.name);
}

describe("a field given up after changes taken back by hand", () => {
  it("leaves a change discarded by choice, and its discard, counting", async () => {
    // Given Kai drafted to be added, Uma's rename of Kai, discarded by choice, then her rename again
    const { uma } = await umaAndMo();
    const [kai = ""] = await draftPeople(alice, [unique("Fictional Kai")]);
    await publish(alice);
    await rename(uma, kai);
    expect(await discard(uma, { people: [kai] })).toBe(1);
    await rename(uma, kai);

    // When Ana renames Kai and publishes, and Uma keeps Ana's name
    await umaKeepsAnas(uma, kai);

    // Then Uma still changed Kai's draft
    await umaStillChanged(uma, kai);
  });
});

describe("a field given up after an undo", () => {
  it("takes back the undo of a change set already published, which stands", async () => {
    // Given Ana's published Site for Mo, Uma's rename published then undone, and Bob's rename since
    const { uma, mo } = await umaAndMo();
    await setSite(alice, mo, north.id);
    await publish(alice);
    const renamed = await rename(uma, mo);
    await publish(uma);
    expect((await undo(uma, renamed.changeSetId)).statusCode).toBe(200);
    const bobs = await rename(bob, mo);
    await publish(bob);

    // When Uma publishes, keeping Bob's name
    expect((await keepingSide(uma, "theirs")).statusCode).toBe(200);

    // Then her history shows the name given up for Bob's, who last changed it
    expect(await lastOf(uma)).toEqual([
      expect.objectContaining({ field: "preferredName", newValue: bobs.name }),
    ]);
    expect((await personOf(alice, mo))?.draft?.changedBy?.preferredName).toBe(
      bob.name,
    );
  });

  it("takes back a change still standing before a private change set undone", async () => {
    // Given Uma's private Site for Mo, then her rename, undone, and Bob's Site since
    const { uma, mo } = await umaAndMo();
    await setSite(uma, mo, north.id);
    const renamed = await rename(uma, mo);
    expect((await undo(uma, renamed.changeSetId)).statusCode).toBe(200);
    await setSite(bob, mo, south.id);
    await publish(bob);

    // When Uma publishes, keeping Bob's Site
    expect((await keepingSide(uma, "theirs")).statusCode).toBe(200);

    // Then her history shows her Site given up, and Bob last changed it
    expect(await lastOf(uma)).toEqual([
      expect.objectContaining({ field: "value" }),
    ]);
    expect((await personOf(alice, mo))?.draft?.changedBy?.[siteColumn.id]).toBe(
      bob.name,
    );
  });
});
