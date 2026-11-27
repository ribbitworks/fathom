// SPDX-License-Identifier: Apache-2.0

// Integration tests for the release streams routes against a PostgreSQL server: changing one
// cycle's length, and what moves with it.

import { changes, releaseStreams } from "@fathom/db";
import { type ReleaseStream } from "@fathom/shared";
import { eq } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  test,
  configurer,
  planner,
  featureLead,
  quarters,
  readStream,
  draftStream,
  draftPattern,
  draftRelease,
  decide,
  approveAll,
  liveStream,
  closeReleaseTests,
  startReleaseTests,
} from "./test-releases.ts";

beforeAll(startReleaseTests);
afterAll(closeReleaseTests);

describe("changing one cycle's length", () => {
  const changeLength = (
    streamId: string,
    startsOn: string,
    body: object,
    cookie = configurer.cookie,
  ) =>
    test.request(
      cookie,
      "PUT",
      `/api/release-streams/${streamId}/cycles/${startsOn}/length`,
      body,
    );

  const spans = (stream: ReleaseStream | undefined) =>
    stream?.cycles
      .slice(0, 5)
      .map(({ startsOn, endsOn }) => `${startsOn} to ${endsOn}`);

  // A live stream of quarters from 2027, with a live release on its third and fourth cycles.
  async function withRelease(shipsOn: string | null = null) {
    const stream = await liveStream();
    await draftRelease(stream.id, {
      name: "Fictional Later",
      firstCycle: "2027-07-01",
      lastCycle: "2027-10-01",
      shipsOn,
    });
    await approveAll((await readStream(stream.id)) as ReleaseStream);
    return (await readStream(stream.id)) as ReleaseStream;
  }

  it("moves the cycles after it, and the releases on them, in one change set", async () => {
    const stream = await withRelease();
    const response = await changeLength(stream.id, "2027-04-01", {
      length: 2,
      later: "move",
    });
    expect(response.statusCode).toBe(200);
    const { stream: drafted, changeSetId } = response.json<{
      stream: ReleaseStream;
      changeSetId: string;
    }>();
    expect(spans(drafted)).toEqual([
      "2027-01-01 to 2027-03-31",
      "2027-04-01 to 2027-05-31",
      "2027-06-01 to 2027-08-31",
      "2027-09-01 to 2027-11-30",
      "2027-12-01 to 2028-02-29",
    ]);
    expect(drafted.releases[0]).toMatchObject({
      firstCycle: "2027-06-01",
      lastCycle: "2027-09-01",
    });
    const recorded = await test.connection
      .selectDistinct({ type: changes.recordType })
      .from(changes)
      .where(eq(changes.changeSetId, changeSetId));
    expect(recorded.map(({ type }) => type).sort()).toEqual([
      "cycle-pattern",
      "release",
    ]);
  });

  it("publishes the releases it moves with the cycles, as the role that changed them, without Edit Features", async () => {
    // Given a release on the cycles a Workforce Administrator moves, unpublished
    const stream = await withRelease();
    const response = await test.request(
      configurer.cookie,
      "PUT",
      `/api/release-streams/${stream.id}/cycles/2027-04-01/length`,
      { length: 2, later: "move" },
      { publish: false },
    );
    expect(response.statusCode).toBe(200);

    // When they publish it
    const published = await test.request(
      configurer.cookie,
      "POST",
      "/api/unpublished/publish",
      undefined,
      { publish: false },
    );

    // Then the cycles and the release go together, none left
    const { total, left } = published.json<{ total: number; left: number }>();
    expect([total > 1, left]).toEqual([true, 0]);
  });

  it("is approved whole when any of its drafts is", async () => {
    const stream = await withRelease();
    const drafted = (
      await changeLength(stream.id, "2027-04-01", { length: 2, later: "move" })
    ).json<{ stream: ReleaseStream }>().stream;
    const approved = await decide("approval", {
      records: [{ type: "release", id: drafted.releases[0]?.id }],
    });
    expect(approved.statusCode).toBe(200);
    const live = await readStream(stream.id);
    expect(spans(live)).toEqual(spans(drafted));
    expect(
      [...(live?.patterns ?? []), ...(live?.releases ?? [])].filter(
        ({ draft }) => draft !== undefined,
      ),
    ).toEqual([]);
  });

  // The drafts of a new length for the second cycle of a stream with a release after it.
  async function draftedChange() {
    const stream = await withRelease();
    const drafted = (
      await changeLength(stream.id, "2027-04-01", { length: 2, later: "move" })
    ).json<{ stream: ReleaseStream }>().stream;
    return {
      stream,
      patterns: drafted.patterns
        .filter(({ draft }) => draft !== undefined)
        .map(({ id }) => ({ type: "cycle-pattern", id })),
      release: { type: "release", id: String(drafted.releases[0]?.id) },
    };
  }

  it.each([
    ["Approve Plan", ["plan:approve", "features:view"]],
    ["Approve Configuration", ["configuration:approve", "configuration:view"]],
  ] as const)(
    "refuses one holding %s alone approving it while it moves a release, leaving it a draft",
    async (_name, permissions) => {
      const { stream, patterns, release } = await draftedChange();
      const decider = await test.signedIn([...permissions]);

      const response = await test.request(
        decider.cookie,
        "POST",
        "/api/drafts/approval",
        { records: [...patterns, release] },
      );

      expect(response.statusCode).toBe(403);
      const waiting = await readStream(stream.id);
      expect(waiting?.patterns.some(({ draft }) => draft !== undefined)).toBe(
        true,
      );
      expect(waiting?.releases[0]?.draft).toBeDefined();
    },
  );

  it("refuses rejecting part of it", async () => {
    const { patterns, release } = await draftedChange();
    const reason = "Not yet";
    expect([
      (await decide("rejection", { records: patterns, reason })).statusCode,
      (await decide("rejection", { records: [release], reason })).statusCode,
    ]).toEqual([409, 409]);
  });

  it("is rejected whole", async () => {
    const { patterns, release } = await draftedChange();
    const response = await decide("rejection", {
      records: [...patterns, release],
      reason: "Not yet",
    });
    expect(response.statusCode).toBe(200);
  });

  it("may start a pattern on the day a later one moves away from", async () => {
    const stream = await draftStream();
    await draftPattern(stream.id);
    await draftPattern(stream.id, {
      ...quarters,
      startsOn: "2027-07-01",
      length: 6,
    });
    await approveAll((await readStream(stream.id)) as ReleaseStream);
    const response = await changeLength(stream.id, "2027-01-01", {
      length: 6,
      later: "move",
    });
    expect(response.statusCode).toBe(200);
    expect(
      spans(response.json<{ stream: ReleaseStream }>().stream)?.slice(0, 3),
    ).toEqual([
      "2027-01-01 to 2027-06-30",
      "2027-07-01 to 2027-09-30",
      "2027-10-01 to 2028-03-31",
    ]);
  });

  it("binds a change of cycles to removing a release they no longer make", async () => {
    const stream = await withRelease();
    const releaseId = String(stream.releases[0]?.id);
    await test.request(
      planner.cookie,
      "DELETE",
      `/api/release-streams/${stream.id}/releases/${releaseId}`,
    );
    const changed = await test.request(
      configurer.cookie,
      "PUT",
      `/api/release-streams/${stream.id}/patterns/${String(stream.patterns[0]?.id)}`,
      { ...quarters, length: 2 },
    );
    expect(
      changed.json<{ stream: ReleaseStream }>().stream.patterns[0]?.draft?.uses,
    ).toContainEqual({ type: "release", id: releaseId });
  });

  it("refuses discarding it to someone who may not change cycles", async () => {
    const { release } = await draftedChange();
    const response = await test.request(
      featureLead.cookie,
      "DELETE",
      `/api/records/release/${release.id}/draft`,
    );
    expect(response.statusCode).toBe(403);
    expect(response.json<{ error: string }>().error).toBe(
      "Only someone who changes cycles can discard this.",
    );
  });

  it("refuses moving a release someone else is changing", async () => {
    const stream = await withRelease();
    await test.request(
      planner.cookie,
      "PUT",
      `/api/release-streams/${stream.id}/releases/${String(stream.releases[0]?.id)}`,
      {
        name: "Fictional Renamed",
        firstCycle: "2027-07-01",
        lastCycle: "2027-10-01",
      },
      { publish: false },
    );
    const response = await changeLength(stream.id, "2027-04-01", {
      length: 2,
      later: "move",
    });
    expect(response.statusCode).toBe(409);
  });

  it("is discarded whole from any of its drafts", async () => {
    const stream = await withRelease();
    const drafted = (
      await changeLength(stream.id, "2027-04-01", { length: 2, later: "move" })
    ).json<{ stream: ReleaseStream }>().stream;
    const response = await test.request(
      configurer.cookie,
      "DELETE",
      `/api/records/cycle-pattern/${String(drafted.patterns.find(({ draft }) => draft !== undefined)?.id)}/draft`,
    );
    expect(response.statusCode).toBe(200);
    const after = await readStream(stream.id);
    expect(spans(after)).toEqual(spans(stream));
    expect(
      [...(after?.patterns ?? []), ...(after?.releases ?? [])].filter(
        ({ draft }) => draft !== undefined,
      ),
    ).toEqual([]);
  });

  it("lets another role that changes cycles discard it, though they didn't change it", async () => {
    // Given a change of one cycle's length a Workforce Administrator made
    const stream = await withRelease();
    const drafted = (
      await changeLength(stream.id, "2027-04-01", { length: 2, later: "move" })
    ).json<{ stream: ReleaseStream }>().stream;

    // When a Product Manager, who changes cycles too, discards it
    const response = await test.request(
      planner.cookie,
      "DELETE",
      `/api/records/cycle-pattern/${String(drafted.patterns.find(({ draft }) => draft !== undefined)?.id)}/draft`,
    );

    // Then it is discarded
    expect(response.statusCode).toBe(200);
  });

  it("refuses moving a release's first cycle after its Ships on day", async () => {
    const stream = await withRelease("2027-07-15");
    const response = await changeLength(stream.id, "2027-04-01", {
      length: 4,
      later: "move",
    });
    expect(response.statusCode).toBe(409);
    expect(response.json<{ error: string }>().error).toBe(
      "Fictional Later would start after it ships on 2027-07-15.",
    );
  });

  it("names no release when refusing a move after its Ships on day to one who doesn't see features", async () => {
    const stream = await withRelease("2027-07-15");
    const editor = await test.signedIn([
      "configuration:view",
      "configuration:edit",
    ]);

    const response = await changeLength(
      stream.id,
      "2027-04-01",
      { length: 4, later: "move" },
      editor.cookie,
    );

    expect(response.statusCode).toBe(409);
    expect(response.json<{ error: string }>().error).toBe(
      "Work planned on these cycles would start after the day it ships.",
    );
  });

  it("names no release it moves among the unpublished changes of one who doesn't see features", async () => {
    const stream = await withRelease();
    const editor = await test.signedIn([
      "configuration:view",
      "configuration:edit",
    ]);

    await test.request(
      editor.cookie,
      "PUT",
      `/api/release-streams/${stream.id}/cycles/2027-04-01/length`,
      { length: 2, later: "move" },
      { publish: false },
    );
    const unpublished = await test.request(
      editor.cookie,
      "GET",
      "/api/unpublished",
    );

    const subjects = unpublished
      .json<{ changes: { subject: string }[] }>()
      .changes.map(({ subject }) => subject);
    expect(subjects).toContain("a release");
    expect(subjects.join(" ")).not.toContain("Fictional Later");
  });

  it("names no release it moves when refusing to publish the change to one who doesn't see features", async () => {
    const stream = await withRelease();
    const editor = await test.signedIn([
      "configuration:view",
      "configuration:edit",
    ]);
    await test.request(
      editor.cookie,
      "PUT",
      `/api/release-streams/${stream.id}/cycles/2027-04-01/length`,
      { length: 2, later: "move" },
      { publish: false },
    );
    await test.connection
      .update(releaseStreams)
      .set({ endsOn: "2027-05-31" })
      .where(eq(releaseStreams.id, stream.id));

    const response = await test.request(
      editor.cookie,
      "POST",
      "/api/unpublished/publish",
    );

    expect(response.statusCode).toBe(409);
    expect(response.json<{ error: string }>().error).toBe(
      `The change to the cycles of ${stream.name} from 2027-04-01 no longer fits the data; change or discard it, then publish again`,
    );
  });

  it("refuses a day no cycle of the stream starts on", async () => {
    const stream = await liveStream();
    const response = await changeLength(stream.id, "2027-04-02", {
      length: 2,
      later: "move",
    });
    expect(response.statusCode).toBe(404);
  });

  it("refuses the length the cycle has now", async () => {
    const stream = await liveStream();
    const response = await changeLength(stream.id, "2027-04-01", {
      length: 3,
      later: "move",
    });
    expect(response.statusCode).toBe(409);
    expect(response.json<{ error: string }>().error).toBe(
      "Choose a new length.",
    );
  });

  it("refuses a cycle longer than two years", async () => {
    const stream = await liveStream();
    const response = await changeLength(stream.id, "2027-04-01", {
      length: 25,
      later: "move",
    });
    expect(response.statusCode).toBe(409);
    expect(response.json<{ error: string }>().error).toBe(
      "A cycle can be at most two years long.",
    );
  });
});
