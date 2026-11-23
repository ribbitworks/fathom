// SPDX-License-Identifier: Apache-2.0

// Integration tests for the features routes against a PostgreSQL server: features' target cycles,
// and what happens to them when their schedule's cycles change or the schedule is retired.

import { cyclePatterns, releaseStreams } from "@fathom/db";
import { type ReleaseStream } from "@fathom/shared";
import { eq } from "drizzle-orm";
import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { errorOf, missingRecord, unique } from "./test-app.ts";
import {
  test,
  featureLead,
  configurer,
  post,
  put,
  decide,
  featureRecords,
  draftFeature,
  liveFeature,
  shown,
  closeFeatureTests,
  startFeatureTests,
} from "./test-features.ts";

const cycle = {
  first: "2027-01-01",
  second: "2027-04-01",
  third: "2027-07-01",
  fourth: "2027-10-01",
};

// A live schedule of quarters from the start of 2027, ending on the day given, if any.
async function liveStream(endsOn: string | null = null): Promise<string> {
  const id = randomUUID();
  await test.connection.insert(releaseStreams).values({
    id,
    name: unique("Fictional Stream"),
    endsOn,
  });
  await test.connection.insert(cyclePatterns).values({
    streamId: id,
    startsOn: cycle.first,
    length: 3,
    unit: "months",
    naming: "{YY}.{N}",
  });
  return id;
}

const target = (streamId: string, day = cycle.third) => ({
  target: { streamId, cycle: day },
});

beforeAll(startFeatureTests);
afterAll(closeFeatureTests);

describe("target cycles", () => {
  it("targets one of its stream's cycles", async () => {
    const streamId = await liveStream();
    expect(await draftFeature(target(streamId))).toMatchObject({
      targetStreamId: streamId,
      targetCycle: cycle.third,
    });
  });

  it("refuses a day that starts none of the schedule's cycles", async () => {
    const response = await post({
      name: unique("Fictional Feature"),
      ...target(await liveStream(), "2027-02-01"),
    });
    expect(response.statusCode).toBe(409);
    expect(errorOf(response)).toBe("Choose a cycle of the feature's schedule");
  });

  it("refuses a stream that does not exist", async () => {
    const response = await post({
      name: unique("Fictional Feature"),
      ...target(missingRecord),
    });
    expect(response.statusCode).toBe(404);
  });

  it("shows the live stream and cycle together when only the cycle changes", async () => {
    const streamId = await liveStream();
    const feature = await liveFeature(target(streamId));
    await put(feature.id, {
      name: feature.name,
      ...target(streamId, cycle.fourth),
    });
    expect((await shown(feature.id)).draft).toMatchObject({
      changed: ["targetStreamId", "targetCycle"],
      live: { targetStreamId: streamId, targetCycle: cycle.third },
    });
    const { draft } = await shown(feature.id);
    expect(draft?.changedBy?.targetStreamId).toBe(
      draft?.changedBy?.targetCycle,
    );
    expect(draft?.changedBy?.targetStreamId).not.toBeNull();
  });

  it("goes back to Later when its target is cleared", async () => {
    const feature = await liveFeature(target(await liveStream()));
    await put(feature.id, { name: feature.name, target: null });
    expect(await shown(feature.id)).toMatchObject({
      targetStreamId: null,
      targetCycle: null,
    });
  });
});

describe("when a stream's cycles change", () => {
  const changeLength = (streamId: string, startsOn: string, length: number) =>
    test.request(
      configurer.cookie,
      "PUT",
      `/api/release-streams/${streamId}/cycles/${startsOn}/length`,
      { length, later: "move" },
    );

  const patternDrafts = async (streamId: string) =>
    (
      (await test.request(configurer.cookie, "GET", "/api/release-streams"))
        .json<{ streams: ReleaseStream[] }>()
        .streams.find(({ id }) => id === streamId) as ReleaseStream
    ).patterns.flatMap(({ id, draft }) =>
      draft === undefined ? [] : [{ type: "cycle-pattern", id }],
    );

  it("moves features on the cycles that move, in the same drafts", async () => {
    const streamId = await liveStream();
    const feature = await liveFeature(target(streamId));
    expect((await changeLength(streamId, cycle.second, 2)).statusCode).toBe(
      200,
    );
    expect((await shown(feature.id)).targetCycle).toBe("2027-06-01");
    expect((await shown(feature.id)).draft?.uses).toEqual(
      await patternDrafts(streamId),
    );
  });

  it("approves the moved features with the cycles' drafts", async () => {
    const streamId = await liveStream();
    const feature = await liveFeature(target(streamId));
    await changeLength(streamId, cycle.second, 2);
    const response = await decide("approval", {
      records: await patternDrafts(streamId),
    });
    expect(response.statusCode).toBe(200);
    const after = await shown(feature.id);
    expect(after.targetCycle).toBe("2027-06-01");
    expect(after.draft).toBeUndefined();
  });

  it("refuses rejecting a moved feature's cycles without the feature", async () => {
    const streamId = await liveStream();
    await liveFeature(target(streamId));
    await changeLength(streamId, cycle.second, 2);
    const response = await decide("rejection", {
      records: await patternDrafts(streamId),
      reason: "Fictional reason",
    });
    expect(response.statusCode).toBe(409);
  });

  it("refuses a change that would push a feature past the day its schedule ends", async () => {
    const streamId = await liveStream("2027-10-15");
    const feature = await liveFeature(target(streamId, cycle.fourth));
    const response = await changeLength(streamId, cycle.second, 6);
    expect(response.statusCode).toBe(409);
    expect(errorOf(response)).toContain(`${feature.name} would move past`);
  });

  it("names no feature a new pattern would leave off a cycle to one who doesn't see features", async () => {
    const streamId = await liveStream();
    await liveFeature(target(streamId, cycle.third));
    const editor = await test.signedIn([
      "configuration:view",
      "configuration:edit",
    ]);

    const response = await test.request(
      editor.cookie,
      "POST",
      `/api/release-streams/${streamId}/patterns`,
      { startsOn: cycle.second, length: 2, unit: "months", naming: "{YY}.{N}" },
    );

    expect(response.statusCode).toBe(409);
    expect(errorOf(response)).toBe(
      "Work planned on these cycles would no longer fit the schedule's cycles",
    );
  });

  it("names no feature it moves among the unpublished changes of one who doesn't see features", async () => {
    const streamId = await liveStream();
    const feature = await liveFeature(target(streamId, cycle.third));
    const editor = await test.signedIn([
      "configuration:view",
      "configuration:edit",
    ]);
    await test.request(
      editor.cookie,
      "PUT",
      `/api/release-streams/${streamId}/cycles/${cycle.second}/length`,
      { length: 2, later: "move" },
      { publish: false },
    );

    const response = await test.request(
      editor.cookie,
      "GET",
      "/api/unpublished",
    );

    const subjects = response
      .json<{ changes: { subject: string }[] }>()
      .changes.map(({ subject }) => subject);
    expect(subjects).toContain("a feature");
    expect(subjects.join(" ")).not.toContain(feature.name);
  });

  const movedFeature = async () => {
    const streamId = await liveStream();
    const feature = await liveFeature(target(streamId));
    await changeLength(streamId, cycle.second, 2);
    return { streamId, feature };
  };

  const discardDraft = (id: string, cookie: string) =>
    test.request(cookie, "DELETE", `/api/records/feature/${id}/draft`);

  it("refuses discarding a moved feature to one who cannot change cycles", async () => {
    const { feature } = await movedFeature();
    const response = await discardDraft(feature.id, featureLead.cookie);
    expect(response.statusCode).toBe(403);
    expect((await shown(feature.id)).draft).toBeDefined();
  });

  it("discards a moved feature together with the cycles' drafts", async () => {
    const { streamId, feature } = await movedFeature();
    const editor = await test.signedIn("engineering-director");
    expect((await discardDraft(feature.id, editor.cookie)).statusCode).toBe(
      200,
    );
    expect((await shown(feature.id)).draft).toBeUndefined();
    expect(await patternDrafts(streamId)).toEqual([]);
  });

  it.each([
    ["Approve Plan", ["plan:approve", "plan:view", "features:view"]],
    [
      "Approve Configuration",
      ["configuration:approve", "configuration:view", "features:view"],
    ],
    ["Approve Features", ["features:approve", "features:view"]],
  ] as const)(
    "refuses approving a moved feature with %s alone, leaving it and the cycles drafts",
    async (_name, permissions) => {
      const { streamId, feature } = await movedFeature();
      const decider = await test.signedIn([...permissions]);
      const response = await test.request(
        decider.cookie,
        "POST",
        "/api/drafts/approval",
        { records: featureRecords(feature.id) },
      );
      expect(response.statusCode).toBe(403);
      expect((await shown(feature.id)).draft).toBeDefined();
      expect(await patternDrafts(streamId)).not.toEqual([]);
    },
  );
});

describe("a retired stream's cycles", () => {
  const retireStream = (streamId: string) =>
    test.connection
      .update(releaseStreams)
      .set({ retired: true })
      .where(eq(releaseStreams.id, streamId));

  it("refuses a feature onto a retired stream's cycle", async () => {
    const streamId = await liveStream();
    await retireStream(streamId);
    const [stream] = await test.connection
      .select()
      .from(releaseStreams)
      .where(eq(releaseStreams.id, streamId));
    const response = await post({
      name: unique("Fictional Feature"),
      ...target(streamId),
    });
    expect(response.statusCode).toBe(409);
    expect(errorOf(response)).toBe(
      `${String(stream?.name)} is retired, so its cycles take no new features`,
    );
  });
});
