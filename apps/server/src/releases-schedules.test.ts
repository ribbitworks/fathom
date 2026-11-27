// SPDX-License-Identifier: Apache-2.0

// Integration tests for the release streams routes against a PostgreSQL server: changing release
// streams and their cycle patterns, and changes across streams, patterns and releases.

import { cyclePatterns, drafts, releaseStreams } from "@fathom/db";
import { type ChangeHistory, type ReleaseStream } from "@fathom/shared";
import { eq } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { missingRecord as missing, unique } from "./test-app.ts";
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
  approveAll,
  liveStream,
  firstHalf,
  changeEnd,
  closeReleaseTests,
  startReleaseTests,
} from "./test-releases.ts";

beforeAll(startReleaseTests);
afterAll(closeReleaseTests);

describe("changing release streams", () => {
  it("drafts a stream, which reaches the live streams once approved", async () => {
    const stream = await draftStream();
    expect(stream.draft).toMatchObject({ action: "created" });
    expect(
      await test.connection
        .select()
        .from(releaseStreams)
        .where(eq(releaseStreams.id, stream.id)),
    ).toHaveLength(0);
    await decide("approval", {
      records: [{ type: "release-stream", id: stream.id }],
    });
    expect((await readStream(stream.id))?.draft).toBeUndefined();
  });

  it("refuses ending a schedule before a release's last cycle starts", async () => {
    const stream = await liveStream();
    await draftRelease(stream.id, {
      name: "Fictional Late",
      firstCycle: "2027-10-01",
      lastCycle: "2027-10-01",
    });
    await approveAll(
      (await readStream(stream.id, planner.cookie)) as ReleaseStream,
    );
    const response = await changeEnd(stream.id, "2027-09-30");
    expect(response.statusCode).toBe(409);
    expect(response.json<{ error: string }>().error).toBe(
      "The release Fictional Late includes cycles after that day; change it first",
    );
  });

  it("names no release when refusing an earlier end to one who doesn't see features", async () => {
    const stream = await liveStream();
    await draftRelease(stream.id, {
      name: "Fictional Late",
      firstCycle: "2027-10-01",
      lastCycle: "2027-10-01",
    });
    await approveAll(
      (await readStream(stream.id, planner.cookie)) as ReleaseStream,
    );
    const editor = await test.signedIn([
      "configuration:view",
      "configuration:edit",
    ]);

    const response = await test.request(
      editor.cookie,
      "PUT",
      `/api/release-streams/${stream.id}/ends-on`,
      { endsOn: "2027-09-30" },
    );

    expect(response.statusCode).toBe(409);
    expect(response.json<{ error: string }>().error).toBe(
      "Work is planned on cycles after that day",
    );
  });

  it("drafts ending a schedule, cutting its last cycle on its last day", async () => {
    const stream = await liveStream();
    const response = await changeEnd(stream.id, "2027-05-15");
    expect(response.statusCode).toBe(200);
    const changed = response.json<{ stream: ReleaseStream }>().stream;
    expect({
      cyclesUntil: changed.cyclesUntil,
      endsOn: changed.endsOn,
      last: changed.cycles.at(-1),
      draft: changed.draft?.changed,
    }).toMatchObject({
      cyclesUntil: stream.cyclesUntil,
      endsOn: "2027-05-15",
      last: { startsOn: "2027-04-01", endsOn: "2027-05-15" },
      draft: ["endsOn"],
    });
  });

  it("refuses ending a stream before its first cycle starts", async () => {
    const stream = await liveStream();
    const response = await changeEnd(stream.id, "2026-12-31");
    expect(response.statusCode).toBe(409);
    expect(response.json<{ error: string }>().error).toBe(
      "The schedule can't end before its first cycle starts",
    );
  });

  it("records ending a stream in the change history", async () => {
    const stream = await liveStream();
    await changeEnd(stream.id, "2027-05-15");
    const response = await test.request(
      configurer.cookie,
      "GET",
      "/api/changes",
    );
    const fields = response
      .json<ChangeHistory>()
      .entries.flatMap(({ records }) => records)
      .filter((record) => record.name === stream.name)
      .flatMap((record) => record.fields);
    expect(fields).toContainEqual({
      field: "endsOn",
      oldValue: null,
      newValue: "2027-05-15",
    });
  });

  it("refuses a name another stream has, ignoring letter case", async () => {
    const name = unique("Fictional Taken");
    await draftStream(name);
    const response = await test.request(
      configurer.cookie,
      "POST",
      "/api/release-streams",
      { name: name.toLowerCase() },
    );
    expect(response.statusCode).toBe(409);
    expect(response.json<{ error: string }>().error).toBe(
      "Another schedule has that name",
    );
  });

  it("drafts retiring a stream", async () => {
    const stream = await liveStream();
    const response = await test.request(
      configurer.cookie,
      "PUT",
      `/api/release-streams/${stream.id}/retired`,
      { retired: true },
    );
    expect(response.json<{ stream: ReleaseStream }>().stream).toMatchObject({
      retired: true,
      draft: {
        action: "changed",
        changed: ["retired"],
        live: { retired: false },
      },
    });
  });
});

describe("cycle patterns", () => {
  it("may change the cycles from the start of one of the schedule's cycles", async () => {
    const stream = await liveStream();
    const response = await draftPattern(stream.id, {
      ...quarters,
      startsOn: "2027-07-01",
      length: 6,
    });
    expect(response.statusCode).toBe(201);
    const { cycles } = response.json<{ stream: ReleaseStream }>().stream;
    expect(cycles.slice(1, 4).map(({ startsOn }) => startsOn)).toEqual([
      "2027-04-01",
      "2027-07-01",
      "2028-01-01",
    ]);
  });

  it("may be in weeks", async () => {
    const stream = await draftStream();
    const response = await draftPattern(stream.id, {
      ...quarters,
      length: 2,
      unit: "weeks",
    });
    const { patterns, cycles } = response.json<{ stream: ReleaseStream }>()
      .stream;
    expect([patterns[0]?.unit, cycles[1]?.startsOn]).toEqual([
      "weeks",
      "2027-01-15",
    ]);
  });

  it("may not change the cycles from within one of them", async () => {
    const stream = await liveStream();
    const response = await draftPattern(stream.id, {
      ...quarters,
      startsOn: "2027-08-01",
    });
    expect(response.statusCode).toBe(409);
    expect(response.json<{ error: string }>().error).toBe(
      "Cycles can change only from the start of one of the schedule's cycles",
    );
  });

  it("may not change so that a release no longer starts and ends with cycles of its stream", async () => {
    const stream = await liveStream();
    await draftRelease(stream.id, { name: "Fictional Kept", ...firstHalf });
    const response = await test.request(
      configurer.cookie,
      "PUT",
      `/api/release-streams/${stream.id}/patterns/${String(stream.patterns[0]?.id)}`,
      { ...quarters, length: 2 },
    );
    expect(response.statusCode).toBe(409);
    expect(response.json<{ error: string }>().error).toContain(
      "Fictional Kept",
    );
  });

  it("drafts a change to a pattern, which changes the cycles", async () => {
    const stream = await liveStream();
    const response = await test.request(
      configurer.cookie,
      "PUT",
      `/api/release-streams/${stream.id}/patterns/${String(stream.patterns[0]?.id)}`,
      { ...quarters, naming: "Q{N} {YYYY}" },
    );
    expect(
      response.json<{ stream: ReleaseStream }>().stream.cycles[0]?.name,
    ).toBe("Q1 2027");
  });

  it("drafts removing a live pattern, which leaves the stream without cycles once approved", async () => {
    const stream = await liveStream();
    const patternId = String(stream.patterns[0]?.id);
    const removed = await test.request(
      configurer.cookie,
      "DELETE",
      `/api/release-streams/${stream.id}/patterns/${patternId}`,
    );
    expect(removed.statusCode).toBe(200);
    const drafted = await readStream(stream.id);
    expect(drafted?.patterns[0]?.draft?.action).toBe("deleted");
    expect(drafted?.cycles).toEqual([]);
    await decide("approval", {
      records: [{ type: "cycle-pattern", id: patternId }],
    });
    expect((await readStream(stream.id))?.patterns).toEqual([]);
  });

  it("removing a pattern only drafted to be added discards it", async () => {
    const stream = await liveStream();
    const added = await draftPattern(stream.id, {
      ...quarters,
      startsOn: "2027-07-01",
    });
    const pattern = added
      .json<{ stream: ReleaseStream }>()
      .stream.patterns.find(({ startsOn }) => startsOn === "2027-07-01");
    await test.request(
      configurer.cookie,
      "DELETE",
      `/api/release-streams/${stream.id}/patterns/${String(pattern?.id)}`,
    );
    expect((await readStream(stream.id))?.patterns).toHaveLength(1);
  });

  it("may not be changed through another stream", async () => {
    const stream = await liveStream();
    const other = await liveStream();
    const response = await test.request(
      configurer.cookie,
      "PUT",
      `/api/release-streams/${other.id}/patterns/${String(stream.patterns[0]?.id)}`,
      quarters,
    );
    expect(response.statusCode).toBe(404);
  });
});

describe("changing streams, patterns, and releases", () => {
  let other: { id: string; cookie: string };

  beforeAll(async () => {
    other = await test.signedIn("workforce-administrator");
  });

  const rename = (id: string, name: string, cookie = configurer.cookie) =>
    test.request(
      cookie,
      "PUT",
      `/api/release-streams/${id}`,
      { name },
      { publish: cookie === configurer.cookie },
    );

  it("drafts renaming a stream", async () => {
    const stream = await liveStream();
    const response = await rename(stream.id, `${stream.name} Renamed`);
    expect(response.json<{ stream: ReleaseStream }>().stream).toMatchObject({
      name: `${stream.name} Renamed`,
      draft: { live: { name: stream.name } },
    });
  });

  it("saves nothing when a change changes nothing", async () => {
    const stream = await liveStream();
    const response = await rename(stream.id, stream.name);
    expect(response.json<{ changeSetId: string | null }>().changeSetId).toBe(
      null,
    );
  });

  it("refuses changing a record someone else has unpublished changes to", async () => {
    const stream = await liveStream();
    await rename(stream.id, `${stream.name} Held`, other.cookie);
    expect((await readStream(stream.id))?.heldBy).toMatch(/^Fictional User/);
    const response = await rename(stream.id, `${stream.name} Mine`);
    expect(response.statusCode).toBe(409);
    await test.request(other.cookie, "POST", "/api/unpublished/discard");
  });

  it("adds and publishes a release in a stream someone else is renaming", async () => {
    const stream = await liveStream();
    await rename(stream.id, `${stream.name} Held`, other.cookie);
    const response = await draftRelease(stream.id, {
      name: "Fictional Beside A Rename",
      ...firstHalf,
    });
    // Published, so others see it.
    const seen = (await readStream(stream.id))?.releases.map(
      ({ name }) => name,
    );
    expect([response.statusCode, seen]).toEqual([
      201,
      ["Fictional Beside A Rename"],
    ]);
    await test.request(other.cookie, "POST", "/api/unpublished/discard");
  });

  const discardHeld = (type: string, id: string) =>
    test.request(
      other.cookie,
      "DELETE",
      `/api/records/${type}/${id}/draft`,
      undefined,
      { publish: false },
    );

  it("refuses adding to a stream someone else is discarding, naming them", async () => {
    const stream = await draftStream();
    await draftPattern(stream.id);
    // Only someone who changed the new stream's draft may discard it.
    await test.request(
      other.cookie,
      "PUT",
      `/api/release-streams/${stream.id}`,
      {
        name: unique("Fictional Renamed"),
      },
    );
    const held = await discardHeld("release-stream", stream.id);
    expect(held.statusCode).toBe(200);
    const response = await draftRelease(stream.id, {
      name: "Fictional Orphan",
      ...firstHalf,
    });
    expect([
      response.statusCode,
      response.json<{ error: string }>().error,
    ]).toEqual([
      409,
      expect.stringMatching(
        /^This conflicts with changes Fictional User .* has not yet published/,
      ),
    ]);
    await test.request(other.cookie, "POST", "/api/unpublished/discard");
  });

  it("refuses a release on cycles that a change someone else is discarding makes", async () => {
    const stream = await liveStream();
    await draftPattern(stream.id, {
      ...quarters,
      startsOn: "2027-07-01",
      length: 1,
    });
    const pattern = (await readStream(stream.id))?.patterns.find(
      ({ startsOn }) => startsOn === "2027-07-01",
    );
    await discardHeld("cycle-pattern", String(pattern?.id));
    const response = await draftRelease(stream.id, {
      name: "Fictional Monthly",
      firstCycle: "2027-08-01",
      lastCycle: "2027-08-01",
    });
    expect([
      response.statusCode,
      response.json<{ error: string }>().error,
    ]).toEqual([
      409,
      expect.stringMatching(
        /^This conflicts with changes Fictional User .* has not yet published/,
      ),
    ]);
    await test.request(other.cookie, "POST", "/api/unpublished/discard");
  });

  it("refuses discarding a change to cycles that a release someone drafted relies on", async () => {
    const stream = await liveStream();
    const pattern = String(stream.patterns[0]?.id);
    await test.request(
      configurer.cookie,
      "PUT",
      `/api/release-streams/${stream.id}/patterns/${pattern}`,
      { ...quarters, length: 1 },
    );
    await draftRelease(stream.id, {
      name: "Fictional Relying",
      firstCycle: "2027-02-01",
      lastCycle: "2027-02-01",
    });
    const response = await test.request(
      configurer.cookie,
      "DELETE",
      `/api/records/cycle-pattern/${pattern}/draft`,
    );
    expect([
      response.statusCode,
      response.json<{ error: string }>().error,
    ]).toEqual([409, expect.stringMatching(/Fictional Relying/)]);
  });

  it("refuses changing a record that does not exist", async () => {
    const response = await rename(missing, "Fictional");
    expect(response.statusCode).toBe(404);
  });

  it("refuses adding to a stream that does not exist", async () => {
    const response = await draftPattern(missing);
    expect(response.statusCode).toBe(404);
  });

  it("refuses adding to a stream drafted to be removed", async () => {
    const stream = await liveStream();
    // Streams are retired rather than removed, so such a draft is written directly.
    await test.connection.insert(drafts).values({
      recordType: "release-stream",
      recordId: stream.id,
      action: "deleted",
    });
    // A draft written another way has no maker in the change history.
    expect((await readStream(stream.id))?.draft).toMatchObject({
      action: "deleted",
      madeBy: null,
      madeAt: null,
      editors: [],
    });
    const response = await draftRelease(stream.id, {
      name: "Fictional",
      ...firstHalf,
    });
    expect(response.statusCode).toBe(409);
    await test.connection.delete(drafts).where(eq(drafts.recordId, stream.id));
  });

  it("refuses changing a release drafted to be removed", async () => {
    const stream = await liveStream();
    await draftRelease(stream.id, { name: "Fictional", ...firstHalf });
    await approveAll((await readStream(stream.id)) as ReleaseStream);
    const releaseId = String((await readStream(stream.id))?.releases[0]?.id);
    const path = `/api/release-streams/${stream.id}/releases/${releaseId}`;
    await test.request(planner.cookie, "DELETE", path);
    const response = await test.request(planner.cookie, "PUT", path, {
      name: "Fictional Changed",
      ...firstHalf,
    });
    expect(response.statusCode).toBe(409);
  });

  it("drafts a change to a release, and its removal, which approving applies", async () => {
    const stream = await liveStream();
    await draftRelease(stream.id, { name: "Fictional", ...firstHalf });
    await approveAll((await readStream(stream.id)) as ReleaseStream);
    const releaseId = String((await readStream(stream.id))?.releases[0]?.id);
    const path = `/api/release-streams/${stream.id}/releases/${releaseId}`;
    const changed = await test.request(planner.cookie, "PUT", path, {
      name: "Fictional Longer",
      firstCycle: "2027-01-01",
      lastCycle: "2027-07-01",
    });
    expect(
      changed.json<{ stream: ReleaseStream }>().stream.releases[0]?.draft
        ?.changed,
    ).toEqual(["name", "lastCycle"]);
    await approveAll((await readStream(stream.id)) as ReleaseStream);
    await test.request(planner.cookie, "DELETE", path);
    await approveAll((await readStream(stream.id)) as ReleaseStream);
    expect((await readStream(stream.id))?.releases).toEqual([]);
  });

  it("refuses publishing a release that no longer starts on a cycle of its stream", async () => {
    const stream = await liveStream();
    const response = await test.request(
      planner.cookie,
      "POST",
      `/api/release-streams/${stream.id}/releases`,
      {
        name: "Fictional Unfit",
        firstCycle: "2027-07-01",
        lastCycle: "2027-07-01",
      },
      { publish: false },
    );
    expect(response.statusCode).toBe(201);
    // The stream's cycles change some other way than through drafts, as by a fix to the data.
    await test.connection
      .update(cyclePatterns)
      .set({ length: 4 })
      .where(eq(cyclePatterns.id, String(stream.patterns[0]?.id)));
    const published = await test.request(
      planner.cookie,
      "POST",
      "/api/unpublished/publish",
    );
    expect(published.statusCode).toBe(409);
    await test.request(planner.cookie, "POST", "/api/unpublished/discard");
  });
});
