// SPDX-License-Identifier: Apache-2.0

// Integration tests for who reads a rejected person draft's reason in the change history: those who
// see the changes its draft held, as sensitive as they are now, however the draft came to hold them.

import { afterAll, beforeAll, expect, it } from "vitest";
import { generalReader } from "./test-app.ts";
import {
  admin,
  approve,
  closeChangeTests,
  entryFor,
  makePersonWithColumn,
  send,
  startChangeTests,
  test,
} from "./test-changes.ts";

beforeAll(startChangeTests);
afterAll(closeChangeTests);

type Made = Awaited<ReturnType<typeof makePersonWithColumn>>;

// A live person's draft giving the second choice of their column, published.
async function drafted(name: string): Promise<Made> {
  const made = await makePersonWithColumn(name);
  await approve(made.personId);
  await send("PATCH", `/api/people/${made.personId}`, {
    values: { [made.field.id]: [made.south.id] },
  });
  return made;
}

async function rejected(made: Made): Promise<string> {
  const director = await test.signedIn("engineering-director");
  const response = await test.request(
    director.cookie,
    "POST",
    "/api/drafts/rejection",
    { people: [made.personId], reason: "Fictional reason: not the south" },
  );
  expect(response.statusCode, response.body).toBe(200);
  return response.json<{ changeSetId: string }>().changeSetId;
}

const madeConfidential = (made: Made) =>
  send("PUT", `/api/lists/${made.list.id}/class`, {
    dataClass: "confidential",
  });

const seenByGeneralReader = async (changeSetId: string) =>
  (await entryFor((await test.signedIn(generalReader)).cookie, changeSetId)) !==
  undefined;

it("hides a reason once the list of the choices its draft gave has become more sensitive", async () => {
  // Given a person's draft giving a choice, rejected with a reason naming it
  const made = await drafted("Rho");
  const changeSetId = await rejected(made);
  expect(await seenByGeneralReader(changeSetId)).toBe(true);

  // When the choices' list becomes Confidential
  await madeConfidential(made);

  // Then the reason is seen only by those who see Confidential data
  expect(await seenByGeneralReader(changeSetId)).toBe(false);
  const leader = await test.signedIn("executive");
  expect(await entryFor(leader.cookie, changeSetId)).toBeDefined();
});

it("hides a reason by its draft's choices though another column was removed meanwhile", async () => {
  // Given a person with a live value in a second column, and a draft giving a choice in the first
  const made = await makePersonWithColumn("Sigma");
  const other = await makePersonWithColumn("Tau");
  await send("PATCH", `/api/people/${made.personId}`, {
    values: { [other.field.id]: [other.north.id] },
  });
  await approve(made.personId);
  await approve(other.personId);
  await send("PATCH", `/api/people/${made.personId}`, {
    values: { [made.field.id]: [made.south.id] },
  });

  // When the second column's removal is approved, then the draft rejected, and then the first
  // column's list becomes Confidential
  await send("DELETE", `/api/people/columns/${other.field.id}`);
  const director = await test.signedIn("engineering-director");
  const removed = await test.request(
    director.cookie,
    "POST",
    "/api/drafts/approval",
    { columns: [other.field.id] },
  );
  expect(removed.statusCode, removed.body).toBe(200);
  const changeSetId = await rejected(made);
  expect(await seenByGeneralReader(changeSetId)).toBe(true);
  await madeConfidential(made);

  // Then the reason is hidden from those who don't see Confidential data
  expect(await seenByGeneralReader(changeSetId)).toBe(false);
});

it("hides a reason by its draft's choices though unpublished changes to them were discarded", async () => {
  // Given a published draft giving a choice, changed again but not published, and those unpublished
  // changes all discarded
  const made = await drafted("Upsilon");
  const again = await test.request(
    admin.cookie,
    "PATCH",
    `/api/people/${made.personId}`,
    { values: { [made.field.id]: [made.north.id] } },
    { publish: false },
  );
  expect(again.statusCode, again.body).toBe(200);
  await send("POST", "/api/unpublished/discard");

  // When the draft is rejected, and its choices' list becomes Confidential
  const changeSetId = await rejected(made);
  expect(await seenByGeneralReader(changeSetId)).toBe(true);
  await madeConfidential(made);

  // Then the reason is hidden from those who don't see Confidential data
  expect(await seenByGeneralReader(changeSetId)).toBe(false);
});

it("hides a reason restored by undoing its draft's discard", async () => {
  // Given a rejected draft, discarded, and the discard undone
  const made = await drafted("Phi");
  await rejected(made);
  const discarded = await send("DELETE", `/api/people/${made.personId}/draft`);
  const undone = await send(
    "POST",
    `/api/undo/${String(discarded.changeSetId)}`,
  );
  expect(undone.changeSetId).toEqual(expect.any(String));
  expect(await seenByGeneralReader(String(undone.changeSetId))).toBe(true);

  // When its choices' list becomes Confidential
  await madeConfidential(made);

  // Then the undoing, which restores the reason, is hidden from those who don't see Confidential data
  expect(await seenByGeneralReader(String(undone.changeSetId))).toBe(false);
});
