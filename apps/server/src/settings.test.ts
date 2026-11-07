// SPDX-License-Identifier: Apache-2.0

// Tests for Fathom's settings through the API: every signed-in user receives the time zone with
// their session, only those who may edit settings change it, and each change is recorded in the
// access history. Today, wherever the server needs it, is the day in that time zone, and views
// recorded once a day start again at midnight there.

import { accessHistory, appInfo } from "@fathom/db";
import { dayIn, roleSchema } from "@fathom/shared";
import { and, count, eq } from "drizzle-orm";
import { randomUUID } from "node:crypto";
import {
  afterAll,
  afterEach,
  beforeAll,
  describe,
  expect,
  it,
  vi,
} from "vitest";
import { recordRestrictedView } from "./data/history.ts";
import { changeTimeZone, readTimeZone, readToday } from "./data/settings.ts";
import { actorFor } from "./access.ts";
import { startTestApp, type TestApp } from "./test-app.ts";

let test: TestApp;
let cookie: string;
let editorId: string;

beforeAll(async () => {
  test = await startTestApp();
  ({ cookie, id: editorId } = await test.signedIn("administrator"));
});

afterAll(async () => {
  await test.close();
});

afterEach(async () => {
  vi.useRealTimers();
  await changeTo("America/Vancouver");
});

const changeTo = (timeZone: string, as = cookie) =>
  test.request(as, "PUT", "/api/settings/time-zone", { timeZone });

async function sessionTimeZone(as = cookie): Promise<string> {
  return (await test.request(as, "GET", "/api/session")).json<{
    settings: { timeZone: string };
  }>().settings.timeZone;
}

async function latestEntry() {
  const [entry] = (
    await test.request(cookie, "GET", "/api/access-history")
  ).json<{
    entries: { action: string; details: object; actor: { id: string } }[];
  }>().entries;
  return entry;
}

describe("the time zone", () => {
  it("is America/Vancouver until changed, for everyone signed in", async () => {
    const viewer = await test.signedIn("team-member");
    expect(await sessionTimeZone(viewer.cookie)).toBe("America/Vancouver");
  });

  it.each(roleSchema.options.filter((role) => role !== "administrator"))(
    "refuses a change from %s, which cannot edit settings",
    async (role) => {
      const other = await test.signedIn(role);
      expect((await changeTo("Asia/Tokyo", other.cookie)).statusCode).toBe(403);
      expect(await sessionTimeZone()).toBe("America/Vancouver");
    },
  );

  it("is changed for everyone by an Administrator, in its own spelling, and recorded", async () => {
    const viewer = await test.signedIn("team-member");
    const response = await changeTo("asia/tokyo");
    expect([response.statusCode, response.json()]).toEqual([
      200,
      { timeZone: "Asia/Tokyo" },
    ]);
    expect(await sessionTimeZone(viewer.cookie)).toBe("Asia/Tokyo");
    expect(await latestEntry()).toMatchObject({
      action: "time-zone-changed",
      actor: { id: editorId },
      details: {
        timeZone: "Asia/Tokyo",
        previousTimeZone: "America/Vancouver",
      },
    });
  });

  it("records nothing when it is already the time zone given", async () => {
    const before = await latestEntry();
    expect((await changeTo("America/Vancouver")).statusCode).toBe(200);
    expect(await latestEntry()).toEqual(before);
  });

  it("keeps an unlisted name typed in another case in PostgreSQL's spelling", async () => {
    expect((await changeTo("asia/kolkata")).json()).toEqual({
      timeZone: "Asia/Kolkata",
    });
  });

  it("accepts a current name Node lists by an older one, as browsers offer it", async () => {
    expect((await changeTo("Asia/Kolkata")).json()).toEqual({
      timeZone: "Asia/Kolkata",
    });
    expect(await sessionTimeZone()).toBe("Asia/Kolkata");
  });

  it.each(["Middle/Earth", "+05:00"])(
    "refuses %s, which is not a time zone Fathom offers",
    async (timeZone) => {
      expect((await changeTo(timeZone)).statusCode).toBe(400);
      expect(await sessionTimeZone()).toBe("America/Vancouver");
    },
  );

  it("refuses a time zone PostgreSQL does not know, changing nothing", async () => {
    const before = await latestEntry();
    await expect(
      changeTimeZone(
        test.connection,
        actorFor({ id: editorId, name: "", email: "" }, "administrator"),
        "Fictional/Nowhere",
      ),
    ).rejects.toThrow("Fathom does not know that time zone.");
    expect([await sessionTimeZone(), await latestEntry()]).toEqual([
      "America/Vancouver",
      before,
    ]);
  });
});

describe("today", () => {
  it("is the day in Fathom's time zone, not in UTC", async () => {
    // Still the evening of 4 November in Vancouver, and already the 5th in Tokyo.
    vi.useFakeTimers({
      toFake: ["Date"],
      now: new Date("2026-11-05T03:30:00Z"),
    });
    const vancouver = await readToday(test.connection);
    await changeTo("Asia/Tokyo");
    expect([vancouver, await readToday(test.connection)]).toEqual([
      "2026-11-04",
      "2026-11-05",
    ]);
  });
});

// Time zones without daylight saving time, so the start of today is known from the offset alone.
describe.each([
  ["Asia/Tokyo", "+09:00"],
  ["Asia/Kolkata", "+05:30"],
  ["America/Phoenix", "-07:00"],
])("views recorded once a day in %s", (timeZone, offset) => {
  const startOfToday = () => new Date(`${dayIn(timeZone)}T00:00:00${offset}`);

  async function viewsAfterOneAt(occurredAt: Date): Promise<number> {
    const actorId = randomUUID();
    await test.connection.insert(accessHistory).values({
      actorId,
      action: "restricted-viewed",
      subjectId: null,
      occurredAt,
    });
    await recordRestrictedView(test.connection, actorId, timeZone);
    const [row] = await test.connection
      .select({ views: count() })
      .from(accessHistory)
      .where(
        and(
          eq(accessHistory.actorId, actorId),
          eq(accessHistory.action, "restricted-viewed"),
        ),
      );
    return Number(row?.views);
  }

  it("records another view when the last was before midnight there", async () => {
    expect(
      await viewsAfterOneAt(new Date(startOfToday().getTime() - 60_000)),
    ).toBe(2);
  });

  it("records nothing more when the last was at or after midnight there", async () => {
    expect(await viewsAfterOneAt(startOfToday())).toBe(1);
  });
});

describe("a database the migrations have not given a time zone", () => {
  it("fails clearly", async () => {
    await test.connection.delete(appInfo).where(eq(appInfo.key, "time-zone"));
    try {
      await expect(readTimeZone(test.connection)).rejects.toThrow(
        "The time zone is missing; apply the migrations",
      );
    } finally {
      await test.connection
        .insert(appInfo)
        .values({ key: "time-zone", value: "America/Vancouver" });
    }
  });
});
