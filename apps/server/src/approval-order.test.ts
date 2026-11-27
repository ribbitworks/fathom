// SPDX-License-Identifier: Apache-2.0

// Integration tests that publishing stamps when a private change could first be seen, which who
// changed a draft and the draft's time read; the order's cases are unit tests of inCountedOrder.

import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { unique } from "./test-app.ts";
import {
  alice,
  closeUnpublishedTests,
  decide,
  discard,
  history,
  livePeople,
  personOf,
  publish,
  saved,
  send,
  siteColumn,
  south,
  startUnpublishedTests,
  user,
  type User,
} from "./test-unpublished.ts";

beforeAll(startUnpublishedTests);

afterAll(closeUnpublishedTests);

const setSite = (who: User, person: string) =>
  saved(who, "PATCH", `/api/people/${person}`, {
    values: { [siteColumn.id]: [south.id] },
  });

const rename = (who: User, person: string) =>
  saved(who, "PATCH", `/api/people/${person}`, {
    preferredName: unique("Fictional Renamed"),
  });

const dan = () => user(["people:edit", "people:approve"]);

async function approvingAlone(who: User, person: string) {
  const response = await send(who, "POST", "/api/drafts/approval", {
    people: [person],
  });
  return `${String(response.statusCode)} ${response.body}`;
}

const refusal =
  '403 {"error":"Drafts changed by the approver need another approver"}';

describe("a private change saved before an approval of its record and published after it", () => {
  it("leaves its maker needing another approver, after an approval of a field they didn't change", async () => {
    // Given Ana's published rename of live Kai, then Dan's private Site for Kai, and his rename of
    // live Lee, with no draft, discarded by choice, published with it
    const maker = await dan();
    const [kai = "", lee = ""] = await livePeople(2);
    await rename(alice, kai);
    await publish(alice);
    await setSite(maker, kai);
    await rename(maker, lee);
    expect(await discard(maker, { people: [lee] })).toBe(1);

    // When the Approver approves the rename, then Dan publishes his Site
    const approval = await decide("approval", { people: [kai] });
    expect(approval.statusCode).toBe(200);
    expect(await publish(maker)).toBe(1);

    // Then Dan may not approve Kai alone, and the draft is dated when he published, after the approval
    expect(await approvingAlone(maker, kai)).toBe(refusal);
    const { changeSetId } = approval.json<{ changeSetId: string }>();
    const approvedAt = (await history(alice)).find(
      ({ id }) => id === changeSetId,
    )?.madeAt;
    const draftAt = (await personOf(alice, kai))?.draft?.madeAt;
    expect(Date.parse(String(draftAt))).toBeGreaterThan(
      Date.parse(String(approvedAt)),
    );

    // And his discard, published with his rename of Lee, covers it: once Ana drafts Lee, only she
    // changed Lee's draft
    await rename(alice, lee);
    await publish(alice);
    expect((await personOf(alice, lee))?.draft?.editors).toEqual([alice.name]);
  });
});
