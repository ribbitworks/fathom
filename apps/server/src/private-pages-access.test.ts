// SPDX-License-Identifier: Apache-2.0

// Tests for who changes a person's own pages, against a PostgreSQL server of their own: only their
// maker, while their role may make private pages; anyone else is answered as for a page nobody made.

import type { Permission, PrivatePage, Role } from "@fathom/shared";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  errorOf,
  missingRecord,
  ok,
  startTestApp,
  type TestApp,
  type TestUser,
  unique,
} from "./test-app.ts";

let test: TestApp;
let maker: TestUser;

beforeAll(async () => {
  test = await startTestApp();
  maker = await test.signedIn("workforce-administrator");
});

afterAll(async () => {
  await test.close();
});

interface SavedPage {
  page: PrivatePage;
  changeSetId: string | null;
}

const numberColumn = (name: string) => ({
  name,
  type: "number",
  visibility: "general",
});

async function makePage(
  as: TestUser = maker,
  columns: object[] = [numberColumn("Number"), numberColumn("Pages")],
): Promise<SavedPage> {
  return ok<SavedPage>(
    await test.request(as.cookie, "POST", "/api/private-pages", {
      name: unique("Fictional Page"),
      columns,
    }),
    201,
  );
}

// Every request changing a page, a column or a row on it, as anyone may send it.
function requestsOn(page: PrivatePage) {
  const url = `/api/private-pages/${page.id}`;
  const row = page.rows[0]?.id ?? "";
  return [
    ["PATCH", url, { name: "Taken over" }],
    ["PUT", `${url}/position`, { position: 0 }],
    ["DELETE", url, undefined],
    ["POST", `${url}/rows`, { numbers: { [String(page.firstFieldId)]: 1 } }],
    [
      "PATCH",
      `${url}/rows/${row}`,
      { numbers: { [String(page.firstFieldId)]: 2 } },
    ],
    ["DELETE", `${url}/rows/${row}`, undefined],
  ] as const;
}

async function pageWithRow(as: TestUser = maker): Promise<PrivatePage> {
  const { page } = await makePage(as);
  return (
    await ok<SavedPage>(
      await test.request(
        as.cookie,
        "POST",
        `/api/private-pages/${page.id}/rows`,
        { numbers: { [String(page.firstFieldId)]: 9 } },
      ),
      201,
    )
  ).page;
}

describe("who reaches a page", () => {
  it.each<[string, Role | Permission[]]>([
    ["another maker of pages", "feature-lead"],
    ["an Administrator", "administrator"],
    ["a Team Member", "team-member"],
  ])(
    "answers %s, for every request on it, as for a page nobody made",
    async (_who, role) => {
      // Given the maker's page with a row
      const page = await pageWithRow();
      const other = await test.signedIn(role);

      // When anyone else sends any request naming it
      for (const [method, url, body] of requestsOn(page)) {
        const response = await test.request(other.cookie, method, url, body);

        // Then it is not there, as a page nobody made is not
        expect(response.statusCode, `${method} ${url}`).toBe(404);
        expect(errorOf(response)).toBe("There is no such page");
      }
      const missing = await test.request(
        other.cookie,
        "GET",
        `/api/private-pages/${missingRecord}`,
      );
      expect(missing.statusCode).toBe(404);
      expect(errorOf(missing)).toBe("There is no such page");
      // And the page is as it was
      expect(
        await ok<PrivatePage>(
          await test.request(
            maker.cookie,
            "GET",
            `/api/private-pages/${page.id}`,
          ),
        ),
      ).toEqual(page);
    },
  );

  it("answers its maker, once their role may no longer make pages, as for a page nobody made", async () => {
    const lead = await test.signedIn("feature-lead");
    const page = await pageWithRow(lead);
    await test.holdOnly(lead.id, ["features:view"]);
    for (const [method, url, body] of requestsOn(page)) {
      const response = await test.request(lead.cookie, method, url, body);
      expect(response.statusCode, `${method} ${url}`).toBe(404);
    }
  });

  it("refuses making pages to a role that may not make them, and to anyone signed out", async () => {
    const member = await test.signedIn("team-member");
    const body = { name: "Mine", columns: [numberColumn("Number")] };
    expect(
      (await test.request(member.cookie, "POST", "/api/private-pages", body))
        .statusCode,
    ).toBe(403);
    expect(
      (await test.request("", "POST", "/api/private-pages", body)).statusCode,
    ).toBe(401);
  });

  it("leaves out, for its maker, a column of a class their role no longer sees, and its values", async () => {
    // Given a page whose first column is Personal, with a row
    const lead = await test.signedIn("engineering-manager");
    const { page } = await makePage(lead, [
      { name: "Number", type: "number", visibility: "personal" },
      numberColumn("Pages"),
    ]);
    const url = `/api/private-pages/${page.id}`;
    await ok(
      await test.request(lead.cookie, "POST", `${url}/rows`, {
        numbers: { [String(page.firstFieldId)]: 1 },
      }),
      201,
    );

    // When the role no longer sees Personal details
    await test.holdOnly(lead.id, ["private-pages:make"]);

    // Then the column and its values are left out, and can't be written
    const read = await ok<PrivatePage>(
      await test.request(lead.cookie, "GET", url),
    );
    expect(read.columns.map(({ name }) => name)).toEqual(["Pages"]);
    expect(read.rows[0]?.numbers).toEqual({});
    const written = await test.request(
      lead.cookie,
      "PATCH",
      `${url}/rows/${String(read.rows[0]?.id)}`,
      { numbers: { [String(page.firstFieldId)]: 2 } },
    );
    expect(written.statusCode).toBe(400);
    expect(errorOf(written)).toBe("There is no such column");
  });
});
