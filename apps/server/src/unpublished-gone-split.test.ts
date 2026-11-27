// SPDX-License-Identifier: Apache-2.0

// Integration tests for a private change set that changed a record gone and others too, which its
// withdrawal parts into a copy of each side: the copies keep the original's place, the original is
// shown to nobody, and nobody but its maker sees what went.

import { type ChangeEntry, type Choice, type List } from "@fathom/shared";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { testPosition, unique } from "./test-app.ts";
import {
  alice,
  approver,
  closeUnpublishedTests,
  decide,
  discard,
  history,
  livePeople,
  personOf,
  publish,
  saved,
  send,
  startUnpublishedTests,
  test,
  undo,
  unpublished,
  user,
  type User,
} from "./test-unpublished.ts";

beforeAll(startUnpublishedTests);

afterAll(closeUnpublishedTests);

const editing = ["people:edit", "people:view", "personal:view"] as const;

const rename = async (who: User, id: string) => {
  const name = unique("Fictional Named");
  await saved(who, "PATCH", `/api/people/${id}`, { preferredName: name });
  return name;
};

const nameOf = async (id: string) =>
  String((await personOf(alice, id))?.preferredName);

// Approves the removal of a live person, which takes them away.
async function removing(id: string) {
  await saved(alice, "DELETE", `/api/people/${id}`);
  await publish(alice);
  expect((await decide("approval", { people: [id] })).statusCode).toBe(200);
}

const namesOf = (entry: ChangeEntry) => entry.records.map(({ name }) => name);

// The entries of the history a user reads that someone made, newest first.
const madeBy = async (reader: User, maker: User) =>
  (await history(reader)).filter((entry) => entry.madeBy === maker.name);

// Ben's changes to live people discarded together by choice, as one change set published with his
// next changes, then his change again to each of those to go, so he holds them when they go.
async function benDiscardsTogether(ben: User, total: number, going: number) {
  const ids = await livePeople(total);
  const names = new Map<string, string>();
  for (const id of ids) {
    names.set(id, await nameOf(id));
    await rename(ben, id);
  }
  expect(await discard(ben, { people: ids })).toBe(total);
  for (const id of ids.slice(1, 1 + going)) await rename(ben, id);
  return { ids, names };
}

// Ben's undo of his published addition of Kai and Mo: one private change set changing both.
async function benUndoesKaiAndMo(ben: User) {
  const added = await saved<{ ids: string[]; changeSetId: string }>(
    ben,
    "POST",
    "/api/people",
    {
      people: ["Fictional Kai", "Fictional Mo"].map((name) => ({
        preferredName: unique(name),
        employeeId: unique("E"),
        positionId: testPosition,
      })),
    },
  );
  await publish(ben);
  const undone = await saved<{ changeSetId: string }>(
    ben,
    "POST",
    `/api/undo/${added.changeSetId}`,
  );
  const [kai = "", mo = ""] = added.ids;
  return { kai, mo, undone: undone.changeSetId };
}

// Alice's discard of the draft that added a record, published, which takes it away.
async function discardingAdded(id: string) {
  await saved(alice, "DELETE", `/api/people/${id}/draft`);
  await publish(alice);
}

describe("the copy of a split change set", () => {
  it("can't be undone over another user's change made after the original", async () => {
    // Given Ben's discard of Kai and Mo, Alice's published change to Kai after it, and Mo gone
    const ben = await user([...editing]);
    const {
      ids: [kai = "", mo = ""],
    } = await benDiscardsTogether(ben, 2, 1);
    await rename(alice, kai);
    await publish(alice);
    await removing(mo);
    const [withdrawal, ...rest] = (await madeBy(ben, ben)).filter(
      ({ kind }) => kind === "discard",
    );
    const copy = rest.find(
      (entry) => withdrawal && namesOf(entry)[0] !== namesOf(withdrawal)[0],
    );

    // When Ben undoes the copy of his discard of Kai
    const response = await undo(ben, String(copy?.id));

    // Then it is refused, as the original would have been
    expect(response.statusCode, response.body).toBe(409);
    expect(response.json()).toEqual({
      error: "This has been changed since, so it can no longer be undone",
    });
  });

  it("keeps its place among its maker's unpublished changes", async () => {
    // Given Ben's undo of his addition of Kai and Mo, then his change to Lee, and Mo gone
    const ben = await user([...editing]);
    const [lee = ""] = await livePeople(1);
    const { mo } = await benUndoesKaiAndMo(ben);
    const leeName = await rename(ben, lee);
    await discardingAdded(mo);

    // Then Lee's change is still listed first
    expect((await unpublished(ben)).map(({ subject }) => subject)[0]).toBe(
      leeName,
    );
  });

  it("starts the draft's history again where its original did, once published", async () => {
    // Given Ben's discard of Kai and Mo, an approver's published change to Kai after it, Mo gone, and
    // Ben's next publish
    const ben = await user([...editing]);
    const checker = await user([...editing, "people:approve"]);
    const {
      ids: [kai = "", mo = ""],
    } = await benDiscardsTogether(ben, 2, 1);
    await rename(checker, kai);
    await publish(checker);
    await removing(mo);
    const [lee = ""] = await livePeople(1);
    await rename(ben, lee);
    await publish(ben);

    // When the approver approves Kai's draft alone
    const approving = await send(checker, "POST", "/api/drafts/approval", {
      people: [kai],
    });

    // Then they are refused, and still shown as its editor
    expect(approving.statusCode, approving.body).toBe(403);
    expect((await personOf(alice, kai))?.draft?.editors).toContain(
      checker.name,
    );
  });

  it("leaves others naming the record by changes made after its original", async () => {
    // Given Ben's discard of Kai and Mo, an approver's published rename of Kai after it, Mo gone, and
    // Ben's next publish
    const ben = await user([...editing]);
    const checker = await user([...editing, "people:approve"]);
    const {
      ids: [kai = "", mo = ""],
    } = await benDiscardsTogether(ben, 2, 1);
    const renamed = await rename(checker, kai);
    await publish(checker);
    await removing(mo);
    const [lee = ""] = await livePeople(1);
    await rename(ben, lee);
    await publish(ben);

    // When Alice reads Ben's changes
    const named = (await madeBy(alice, ben)).flatMap(namesOf);

    // Then Kai is named by the approver's rename
    expect(named).toContain(renamed);
  });

  it("leaves a later withdrawal made as the role of its maker's later change", async () => {
    // Given Ben's discard of Kai and Mo as one role, then his change to Kai as another, and Mo gone
    const ben = await user([...editing]);
    const {
      ids: [kai = "", mo = ""],
    } = await benDiscardsTogether(ben, 2, 1);
    await test.holdOnly(ben.id, [...editing, "personal:edit"]);
    await rename(ben, kai);
    await removing(mo);

    // When Kai goes too
    await removing(kai);

    // Then Ben's withdrawal of Kai is made as the role of his later change
    const [withdrawal, ...earlier] = await madeBy(ben, ben);
    const later = earlier.find(({ kind }) => kind === "edit");
    expect(withdrawal?.kind).toBe("discard");
    expect(withdrawal?.madeAs).toBe(later?.madeAs);
  });
});

describe("a split change set", () => {
  it("is parted when an approval takes a record away, showing others only the rest", async () => {
    // Given Ben's discard of Kai and Mo, and Mo's removal approved
    const ben = await user([...editing]);
    const {
      ids: [kai = "", mo = ""],
      names,
    } = await benDiscardsTogether(ben, 2, 1);
    await removing(mo);

    // When Ben publishes his next changes
    const [lee = ""] = await livePeople(1);
    await rename(ben, lee);
    await publish(ben);

    // Then others see his discard of Kai, and nothing of Mo
    for (const other of [alice, approver]) {
      const seen = await madeBy(other, ben);
      expect(
        seen.filter(({ kind }) => kind === "discard").map(namesOf),
      ).toEqual([[await nameOf(kai)]]);
      expect(seen.flatMap(namesOf)).not.toContain(names.get(mo));
    }
  });

  it("parted twice, shows others only what stays, and its maker each part", async () => {
    // Given Ben's discard of Kai, Mo and Lee, then Mo and Lee gone in turn
    const ben = await user([...editing]);
    const {
      ids: [, mo = "", lee = ""],
      names,
    } = await benDiscardsTogether(ben, 3, 2);
    await removing(mo);
    await removing(lee);

    // When Ben publishes his next changes
    const [zed = ""] = await livePeople(1);
    await rename(ben, zed);
    await publish(ben);

    // Then others see nothing of Mo or Lee, and Ben sees both
    const gone = [names.get(mo), names.get(lee)];
    for (const other of [alice, approver]) {
      const seen = (await madeBy(other, ben)).flatMap(namesOf);
      expect(seen.filter((name) => gone.includes(name ?? ""))).toEqual([]);
    }
    const own = (await madeBy(ben, ben)).flatMap(namesOf);
    expect(own).toEqual(expect.arrayContaining(gone));
  });

  it("then discarded with everything, shows others none of it", async () => {
    // Given Ben's discard of Kai and Mo, Mo gone, then his change to Kai and all his changes discarded
    const ben = await user([...editing]);
    const {
      ids: [kai = "", mo = ""],
    } = await benDiscardsTogether(ben, 2, 1);
    await removing(mo);
    await rename(ben, kai);
    expect(await discard(ben)).toBe(1);

    // When Ben publishes his next changes
    const [lee = ""] = await livePeople(1);
    const leeName = await rename(ben, lee);
    await publish(ben);

    // Then others see only his change to Lee, and Ben still sees his discard of Kai
    expect((await madeBy(alice, ben)).map(namesOf)).toEqual([[leeName]]);
    expect((await madeBy(ben, ben)).flatMap(namesOf)).toContain(
      await nameOf(kai),
    );
  });

  it("hides its original even from its maker, who can't undo it", async () => {
    // Given Ben's undo of his addition of Kai and Mo, and Mo gone
    const ben = await user([...editing]);
    const { mo, undone } = await benUndoesKaiAndMo(ben);
    await discardingAdded(mo);

    // When Ben undoes the original
    const response = await undo(ben, undone);

    // Then it isn't there
    expect(response.statusCode).toBe(404);
    expect((await history(ben)).map(({ id }) => id)).not.toContain(undone);
  });
});

describe("a withdrawal with nothing to take back", () => {
  it("still keeps its maker's change to the record gone from everyone else", async () => {
    // Given Ben's private order of a list Alice added, the same order Alice then published
    const ben = await user(["configuration:edit", "people:edit"]);
    const list = (
      await saved<{ list: List }>(alice, "POST", "/api/lists", {
        name: unique("Fictional Added List"),
      })
    ).list;
    const [, second] = (
      await saved<{ choices: Choice[] }>(
        alice,
        "POST",
        `/api/lists/${list.id}/choices`,
        { choices: [{ label: "First" }, { label: "Second" }] },
      )
    ).choices as [Choice, Choice];
    await publish(alice);
    const moving = `/api/lists/${list.id}/choices/${second.id}/position`;
    await saved(ben, "PUT", moving, { after: null });
    await saved(alice, "PUT", moving, { after: null });
    await publish(alice);

    // When Alice discards the list's draft and publishes, then Ben publishes his next changes
    await saved(alice, "DELETE", `/api/lists/${list.id}/draft`);
    await publish(alice);
    const [lee = ""] = await livePeople(1);
    const leeName = await rename(ben, lee);
    await publish(ben);

    // Then others see only his change to Lee
    expect((await madeBy(alice, ben)).map(namesOf)).toEqual([[leeName]]);
  });
});
