// SPDX-License-Identifier: Apache-2.0

// Integration tests for the release streams routes against a PostgreSQL server: discarding,
// resubmitting and deciding drafts of the plan's records, and their unpublished changes.

import { cyclePatterns } from "@fathom/db";
import { type ReleaseStream, type Unpublished } from "@fathom/shared";
import { eq } from "drizzle-orm";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import {
  type Method,
  missingRecord as missing,
  ok,
  unique,
} from "./test-app.ts";
import {
  test,
  configurer,
  planner,
  quarters,
  readStream,
  draftStream,
  draftPattern,
  draftRelease,
  decide,
  liveStream,
  firstHalf,
  closeReleaseTests,
  startReleaseTests,
} from "./test-releases.ts";

beforeAll(startReleaseTests);
afterAll(closeReleaseTests);

describe("discarding and resubmitting drafts of the plan's records", () => {
  const discard = (type: string, id: string) =>
    test.request(
      configurer.cookie,
      "DELETE",
      `/api/records/${type}/${id}/draft`,
    );
  const resubmit = (type: string, id: string) =>
    test.request(
      configurer.cookie,
      "DELETE",
      `/api/records/${type}/${id}/draft/rejection`,
    );

  it("refuses discarding the draft of a record that does not exist", async () => {
    expect((await discard("release-stream", missing)).statusCode).toBe(404);
  });

  it("refuses discarding a draft a record does not have", async () => {
    const stream = await liveStream();
    expect((await discard("release-stream", stream.id)).statusCode).toBe(404);
  });

  it("discards a change to a live record, leaving it as it is", async () => {
    const stream = await liveStream();
    await test.request(
      configurer.cookie,
      "PUT",
      `/api/release-streams/${stream.id}`,
      { name: `${stream.name} Changed` },
    );
    await discard("release-stream", stream.id);
    expect((await readStream(stream.id))?.name).toBe(stream.name);
  });

  it("discards a rejected draft, clearing its rejection", async () => {
    const stream = await draftStream();
    await decide("rejection", {
      records: [{ type: "release-stream", id: stream.id }],
      reason: "Fictional",
    });
    expect((await discard("release-stream", stream.id)).statusCode).toBe(200);
    expect(await readStream(stream.id)).toBeUndefined();
  });

  it("refuses discarding a pattern that a release's draft uses", async () => {
    const stream = await liveStream();
    const added = await draftPattern(stream.id, {
      ...quarters,
      startsOn: "2027-07-01",
      length: 1,
    });
    const pattern = added
      .json<{ stream: ReleaseStream }>()
      .stream.patterns.find(({ startsOn }) => startsOn === "2027-07-01");
    await draftRelease(stream.id, {
      name: "Fictional Monthly",
      firstCycle: "2027-08-01",
      lastCycle: "2027-08-01",
    });
    expect(
      (await discard("cycle-pattern", String(pattern?.id))).statusCode,
    ).toBe(409);
  });

  it("refuses discarding a stream that someone else's unpublished release belongs to", async () => {
    const stream = await draftStream();
    await draftPattern(stream.id);
    await test.request(
      planner.cookie,
      "POST",
      `/api/release-streams/${stream.id}/releases`,
      { name: "Fictional Held", ...firstHalf },
      { publish: false },
    );
    expect((await discard("release-stream", stream.id)).statusCode).toBe(409);
    await test.request(planner.cookie, "POST", "/api/unpublished/discard");
  });

  it("refuses resubmitting the draft of a record that does not exist", async () => {
    expect((await resubmit("release-stream", missing)).statusCode).toBe(404);
  });

  it("refuses resubmitting a draft a record does not have", async () => {
    const stream = await liveStream();
    expect((await resubmit("release-stream", stream.id)).statusCode).toBe(404);
  });

  it("refuses resubmitting a draft that was not rejected", async () => {
    const stream = await draftStream();
    expect((await resubmit("release-stream", stream.id)).statusCode).toBe(409);
  });
});

describe("deciding drafts of the plan's records", () => {
  it("refuses approving a release that no longer starts on a cycle of its stream", async () => {
    const stream = await liveStream();
    const response = await draftRelease(stream.id, {
      name: "Fictional Unfit",
      firstCycle: "2027-07-01",
      lastCycle: "2027-07-01",
    });
    const release = response.json<{ stream: ReleaseStream }>().stream
      .releases[0];
    // The stream's cycles change some other way than through drafts, as by a fix to the data.
    await test.connection
      .update(cyclePatterns)
      .set({ length: 4 })
      .where(eq(cyclePatterns.id, String(stream.patterns[0]?.id)));
    const approved = await decide("approval", {
      records: [{ type: "release", id: String(release?.id) }],
    });
    expect(approved.statusCode).toBe(409);
  });

  it("refuses approving a draft that no longer exists", async () => {
    const response = await decide("approval", {
      records: [{ type: "release", id: missing }],
    });
    expect(response.statusCode).toBe(404);
  });

  it("records a new reason for a draft rejected again, and nothing for the same reason", async () => {
    const stream = await draftStream();
    const reject = (reason: string) =>
      decide("rejection", {
        records: [{ type: "release-stream", id: stream.id }],
        reason,
      });
    await reject("Fictional first");
    await reject("Fictional second");
    const same = await reject("Fictional second");
    expect(same.json<{ changeSetId: string | null }>().changeSetId).toBe(null);
    expect(
      (await test.historyOf(stream.id)).filter(
        ({ field }) => field === "rejected",
      ),
    ).toMatchObject([
      { oldValue: null, newValue: "Fictional first" },
      { oldValue: "Fictional first", newValue: "Fictional second" },
    ]);
  });

  it("clears a rejection when the draft is changed", async () => {
    const stream = await draftStream();
    await decide("rejection", {
      records: [{ type: "release-stream", id: stream.id }],
      reason: "Fictional",
    });
    await test.request(
      configurer.cookie,
      "PUT",
      `/api/release-streams/${stream.id}`,
      { name: `${stream.name} Again` },
    );
    expect((await readStream(stream.id))?.draft?.state).toBe("waiting");
  });
});

describe("unpublished changes to the plan's records", () => {
  let maker: { id: string; cookie: string };

  beforeAll(async () => {
    maker = await test.signedIn(["features:edit", "configuration:edit"]);
  });

  afterEach(async () => {
    await test.request(maker.cookie, "POST", "/api/unpublished/discard");
  });

  const quietly = (method: Method, url: string, payload?: object) =>
    test.request(maker.cookie, method, url, payload, { publish: false });

  const subjects = async () =>
    (await test.request(maker.cookie, "GET", "/api/unpublished"))
      .json<Unpublished>()
      .changes.map(({ subject }) => subject);

  it("are named as the Drafts page names drafts", async () => {
    const stream = await liveStream();
    await quietly("POST", `/api/release-streams/${stream.id}/patterns`, {
      ...quarters,
      startsOn: "2027-07-01",
    });
    await quietly("POST", `/api/release-streams/${stream.id}/releases`, {
      name: "Fictional Subject",
      ...firstHalf,
    });
    await quietly("PUT", `/api/release-streams/${stream.id}`, {
      name: `${stream.name} Subject`,
    });
    expect(await subjects()).toEqual([
      `the schedule ${stream.name} Subject`,
      `the release Fictional Subject in ${stream.name} Subject`,
      `the cycles of ${stream.name} Subject from 2027-07-01`,
    ]);
  });

  it("name a record only drafted to be added by its published draft once the user discards it", async () => {
    const name = unique("Fictional Stream");
    const { stream } = await ok<{ stream: ReleaseStream }>(
      await test.request(maker.cookie, "POST", "/api/release-streams", {
        name,
      }),
      201,
    );
    await quietly("DELETE", `/api/records/release-stream/${stream.id}/draft`);
    expect(await subjects()).toEqual([`the schedule ${name}`]);
  });

  it("are taken back, all at once, recording what that changes", async () => {
    const stream = await liveStream();
    await quietly("PUT", `/api/release-streams/${stream.id}`, {
      name: `${stream.name} Taken Back`,
    });
    await test.request(maker.cookie, "POST", "/api/unpublished/discard");
    expect((await test.historyOf(stream.id)).at(-1)).toMatchObject({
      field: "name",
      oldValue: `${stream.name} Taken Back`,
      newValue: stream.name,
    });
  });

  it("publish a removal that still fits", async () => {
    const stream = await liveStream();
    await quietly(
      "DELETE",
      `/api/release-streams/${stream.id}/patterns/${String(stream.patterns[0]?.id)}`,
    );
    const response = await test.request(
      maker.cookie,
      "POST",
      "/api/unpublished/publish",
    );
    expect(response.statusCode).toBe(200);
  });
});
