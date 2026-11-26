// SPDX-License-Identifier: Apache-2.0

// Tests for private pages' and rows' random keys, against a PostgreSQL server of their own: each is
// made with its record, and a link by one finds it for its maker alone; anyone else, and a key nobody
// made, are answered alike that nothing was found.

import type { Permission, PrivatePage, Role } from "@fathom/shared";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  ok,
  startTestApp,
  type TestApp,
  type TestUser,
  unique,
} from "./test-app.ts";

let test: TestApp;

beforeAll(async () => {
  test = await startTestApp();
});

afterAll(async () => {
  await test.close();
});

interface SavedPage {
  page: PrivatePage;
  changeSetId: string | null;
}

const codePattern = /^[2-9ABCDEFGHJKMNPQRSTVWXYZ]{4}$/u;

// A page of the maker's with a row, made through the server.
async function pageWithRow(maker: TestUser): Promise<PrivatePage> {
  const { page } = await ok<SavedPage>(
    await test.request(maker.cookie, "POST", "/api/private-pages", {
      name: unique("Fictional Page"),
      columns: [{ name: "Number", type: "number", visibility: "general" }],
    }),
    201,
  );
  return (
    await ok<SavedPage>(
      await test.request(
        maker.cookie,
        "POST",
        `/api/private-pages/${page.id}/rows`,
        { numbers: { [String(page.firstFieldId)]: 1 } },
      ),
      201,
    )
  ).page;
}

const go = (as: TestUser, key: string) =>
  test.request(as.cookie, "GET", `/api/go/${key}`);

// The whole answer to a link, to compare what different readers are told.
const answerTo = async (as: TestUser, key: string) => {
  const { statusCode, body } = await go(as, key);
  return { statusCode, body };
};

describe("making keys", () => {
  it("gives a page and each of its rows a key of their own when made", async () => {
    const page = await pageWithRow(await test.signedIn("feature-lead"));
    const rowKey = page.rows[0]?.key;
    expect(page.key).toMatch(codePattern);
    expect(rowKey).toMatch(codePattern);
  });
});

describe("following a key", () => {
  it("finds the maker's page, and a row with its page, in any letter case", async () => {
    const maker = await test.signedIn("feature-lead");
    const page = await pageWithRow(maker);
    const row = page.rows[0];
    expect(
      await ok(await go(maker, `PAGE-${String(page.key).toLowerCase()}`)),
    ).toEqual({ result: "found", kind: "page", id: page.id, pageId: page.id });
    expect(await ok(await go(maker, `%23ROW-${String(row?.key)}`))).toEqual({
      result: "found",
      kind: "row",
      id: row?.id,
      pageId: page.id,
    });
  });

  it.each<[string, Role | Permission[]]>([
    ["another maker of pages", "feature-lead"],
    ["an Administrator", "administrator"],
    ["a Team Member", "team-member"],
    [
      "a role with every class, Administration and People",
      [
        "private-pages:make",
        "administration:edit",
        "people:view",
        "personal:view",
        "confidential:view",
      ],
    ],
  ])(
    "answers %s for a page's and a row's keys exactly as for a key nobody made",
    async (_who, role) => {
      const page = await pageWithRow(await test.signedIn("feature-lead"));
      const other = await test.signedIn(role);
      // No five-character key is made until a tenth of the four-character ones are used.
      const nobodys = await answerTo(other, "ROW-ZZZZZ");
      expect(nobodys.statusCode).toBe(200);
      expect(JSON.parse(nobodys.body)).toEqual({ result: "nothing" });
      for (const key of [
        `PAGE-${String(page.key)}`,
        `ROW-${String(page.rows[0]?.key)}`,
      ]) {
        expect(await answerTo(other, key)).toEqual(nobodys);
      }
    },
  );

  it("answers the maker as for a key nobody made once their role may no longer make pages, the page is removed, or a row is removed from a page kept", async () => {
    const maker = await test.signedIn("feature-lead");
    const kept = await pageWithRow(maker);
    const removed = await pageWithRow(maker);
    const rowGone = await pageWithRow(maker);
    await ok(
      await test.request(
        maker.cookie,
        "DELETE",
        `/api/private-pages/${removed.id}`,
      ),
    );
    await ok(
      await test.request(
        maker.cookie,
        "DELETE",
        `/api/private-pages/${rowGone.id}/rows/${String(rowGone.rows[0]?.id)}`,
      ),
    );
    const nobodys = await answerTo(maker, "PAGE-ZZZZZ");
    expect(await answerTo(maker, `PAGE-${String(rowGone.key)}`)).not.toEqual(
      nobodys,
    );
    for (const key of [
      `PAGE-${String(removed.key)}`,
      `ROW-${String(removed.rows[0]?.key)}`,
      `ROW-${String(rowGone.rows[0]?.key)}`,
    ]) {
      expect(await answerTo(maker, key)).toEqual(nobodys);
    }
    await test.holdOnly(maker.id, ["features:view", "people:view"]);
    expect(await answerTo(maker, `PAGE-${String(kept.key)}`)).toEqual(nobodys);
  });
});
