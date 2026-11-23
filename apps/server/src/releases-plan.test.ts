// SPDX-License-Identifier: Apache-2.0

// Integration tests for the release streams routes against a PostgreSQL server: releases, their
// notes, and the drafts of streams, patterns and releases.

import { releases, releaseStreams } from "@fathom/db";
import {
  type ChangeHistory,
  defaultClasses,
  type ReleaseStream,
} from "@fathom/shared";
import { eq, inArray } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { readChangeHistory } from "./data/change-history.ts";
import { unique } from "./test-app.ts";
import {
  test,
  configurer,
  planner,
  viewer,
  quarters,
  readStream,
  draftStream,
  draftPattern,
  draftRelease,
  decide,
  approveAll,
  liveStream,
  firstHalf,
  closeReleaseTests,
  startReleaseTests,
} from "./test-releases.ts";

beforeAll(startReleaseTests);
afterAll(closeReleaseTests);

describe("releases", () => {
  it("are made by Project Planners, from a stream's cycles", async () => {
    const stream = await liveStream();
    const response = await draftRelease(stream.id, {
      name: "Fictional One",
      ...firstHalf,
    });
    expect(response.statusCode).toBe(201);
    expect(response.json<{ stream: ReleaseStream }>().stream.releases).toEqual([
      expect.objectContaining({
        name: "Fictional One",
        ...firstHalf,
        draft: expect.objectContaining({ action: "created" }) as unknown,
      }),
    ]);
  });

  it("take a colour from the palette, which approving applies", async () => {
    const stream = await liveStream();
    const response = await draftRelease(stream.id, {
      name: "Fictional Coloured",
      ...firstHalf,
      colour: "grape",
    });
    expect(
      response.json<{ stream: ReleaseStream }>().stream.releases[0]?.colour,
    ).toBe("grape");
    await approveAll((await readStream(stream.id)) as ReleaseStream);
    const [approved] = (await readStream(stream.id))?.releases ?? [];
    expect([approved?.colour, approved?.draft]).toEqual(["grape", undefined]);
  });

  it("may not take a colour the palette does not have", async () => {
    const stream = await liveStream();
    const response = await draftRelease(stream.id, {
      name: "Fictional Beige",
      ...firstHalf,
      colour: "beige",
    });
    expect(response.statusCode).toBe(400);
  });

  it("are refused to those who do not edit the plan", async () => {
    const stream = await liveStream();
    const response = await draftRelease(
      stream.id,
      { name: "Fictional", ...firstHalf },
      configurer.cookie,
    );
    expect(response.statusCode).toBe(403);
  });

  it("must start and end with cycles of their stream", async () => {
    const stream = await liveStream();
    const response = await draftRelease(stream.id, {
      name: "Fictional",
      firstCycle: "2027-01-01",
      lastCycle: "2027-05-01",
    });
    expect(response.statusCode).toBe(409);
    expect(response.json<{ error: string }>().error).toBe(
      "Choose a first and last cycle of the release's schedule",
    );
  });
});

describe("release notes", () => {
  // A live release in a live stream, with the note given, if any.
  async function liveRelease(note?: string) {
    const stream = await liveStream();
    const name = unique("Fictional Noted");
    await draftRelease(stream.id, { name, ...firstHalf });
    let shown = (await readStream(stream.id)) as ReleaseStream;
    const release = shown.releases[0] as ReleaseStream["releases"][number];
    if (note !== undefined) {
      await writeNote(stream.id, release.id, note);
    }
    await approveAll((await readStream(stream.id)) as ReleaseStream);
    shown = (await readStream(stream.id)) as ReleaseStream;
    return { stream: shown, release: shown.releases[0] as typeof release };
  }

  const writeNote = (
    streamId: string,
    releaseId: string,
    note: string | null,
    cookie = planner.cookie,
  ) =>
    test.request(
      cookie,
      "PUT",
      `/api/release-streams/${streamId}/releases/${releaseId}/note`,
      { note },
    );

  const noted = "Scope **frozen**, see [the plan](https://example.com/plan).";

  it("are drafted by Project Planners, kept as written, and applied once approved", async () => {
    const { stream, release } = await liveRelease();
    expect(release.note).toBeNull();
    const response = await writeNote(stream.id, release.id, noted);
    expect(response.statusCode).toBe(200);
    const [drafted] = response.json<{ stream: ReleaseStream }>().stream
      .releases;
    expect([drafted?.note, drafted?.draft?.changed]).toEqual([noted, ["note"]]);
    await approveAll((await readStream(stream.id)) as ReleaseStream);
    const [approved] = (await readStream(stream.id))?.releases ?? [];
    expect([approved?.note, approved?.draft]).toEqual([noted, undefined]);
  });

  it("are seen by everyone who sees the plan", async () => {
    const { stream } = await liveRelease(noted);
    expect(
      (await readStream(stream.id, viewer.cookie))?.releases[0]?.note,
    ).toBe(noted);
  });

  it("refuse a note holding HTML, drafting nothing", async () => {
    const { stream, release } = await liveRelease();
    const response = await writeNote(
      stream.id,
      release.id,
      "<script>alert(1)</script>",
    );
    expect(response.statusCode).toBe(400);
    expect(response.json<{ error: string }>().error).toBe(
      "A note can't hold HTML.",
    );
    expect((await readStream(stream.id))?.releases[0]?.draft).toBeUndefined();
  });

  it("are refused to those who do not edit the plan", async () => {
    const { stream, release } = await liveRelease();
    const response = await writeNote(
      stream.id,
      release.id,
      noted,
      configurer.cookie,
    );
    expect(response.statusCode).toBe(403);
  });

  it("may not be written through another stream", async () => {
    const { release } = await liveRelease();
    const other = await liveStream();
    const response = await writeNote(other.id, release.id, noted);
    expect(response.statusCode).toBe(404);
  });

  it("are shown in the change history as their words without formatting", async () => {
    const { stream, release } = await liveRelease();
    await writeNote(stream.id, release.id, noted);
    const response = await test.request(planner.cookie, "GET", "/api/changes");
    const fields = response
      .json<ChangeHistory>()
      .entries.flatMap(({ records }) => records)
      .filter((record) => record.name === release.name)
      .flatMap((record) => record.fields);
    expect(fields).toContainEqual({
      field: "note",
      oldValue: null,
      newValue: "Scope frozen, see the plan.",
    });
  });
});

describe("drafts of streams, patterns, and releases", () => {
  it("streams approved together each take their own place at the end of the order", async () => {
    const first = await draftStream();
    const second = await draftStream();
    const response = await decide("approval", {
      records: [
        { type: "release-stream", id: first.id },
        { type: "release-stream", id: second.id },
      ],
    });
    expect(response.statusCode).toBe(200);
    const rows = await test.connection
      .select({ position: releaseStreams.position })
      .from(releaseStreams)
      .where(inArray(releaseStreams.id, [first.id, second.id]));
    expect(new Set(rows.map(({ position }) => position)).size).toBe(2);
  });

  it("approving a release in a stream drafted to be added approves the stream and the pattern that makes its cycles", async () => {
    const stream = await draftStream();
    await draftPattern(stream.id);
    const response = await draftRelease(stream.id, {
      name: "Fictional",
      ...firstHalf,
    });
    const drafted = response.json<{ stream: ReleaseStream }>().stream;
    const release = drafted.releases[0];
    expect(release?.draft?.uses).toEqual(
      expect.arrayContaining([
        { type: "release-stream", id: stream.id },
        { type: "cycle-pattern", id: drafted.patterns[0]?.id },
      ]),
    );
    const approved = await decide("approval", {
      records: [{ type: "release", id: release?.id }],
    });
    expect(approved.statusCode).toBe(200);
    const live = await readStream(stream.id);
    expect([
      live?.draft,
      live?.patterns[0]?.draft,
      live?.releases[0]?.draft,
    ]).toEqual([undefined, undefined, undefined]);
  });

  it("refuses an Approver of features and releases alone a release in a stream drafted to be added, leaving all of it a draft", async () => {
    const stream = await draftStream();
    await draftPattern(stream.id);
    const release = (
      await draftRelease(stream.id, { name: "Fictional", ...firstHalf })
    ).json<{ stream: ReleaseStream }>().stream.releases[0];
    const decider = await test.signedIn(["features:approve", "features:view"]);

    const response = await test.request(
      decider.cookie,
      "POST",
      "/api/drafts/approval",
      { records: [{ type: "release", id: release?.id }] },
    );

    expect(response.statusCode).toBe(403);
    const waiting = await readStream(stream.id);
    expect([
      waiting?.draft?.action,
      waiting?.patterns[0]?.draft?.action,
      waiting?.releases[0]?.draft?.action,
    ]).toEqual(["created", "created", "created"]);
  });

  it("rejecting a stream drafted to be added is refused unless what uses it is rejected too", async () => {
    const stream = await draftStream();
    await draftPattern(stream.id);
    const response = await decide("rejection", {
      records: [{ type: "release-stream", id: stream.id }],
      reason: "Not yet",
    });
    expect(response.statusCode).toBe(409);
  });

  it("discarding a stream drafted to be added discards its patterns and releases", async () => {
    const stream = await draftStream();
    await draftPattern(stream.id);
    await draftRelease(stream.id, { name: "Fictional", ...firstHalf });
    const response = await test.request(
      configurer.cookie,
      "DELETE",
      `/api/records/release-stream/${stream.id}/draft`,
    );
    expect(response.statusCode).toBe(200);
    expect(await readStream(stream.id)).toBeUndefined();
    expect(
      await test.connection
        .select()
        .from(releases)
        .where(eq(releases.streamId, stream.id)),
    ).toHaveLength(0);
  });

  it("a rejected draft can be sent for approval again", async () => {
    const stream = await draftStream();
    await decide("rejection", {
      records: [{ type: "release-stream", id: stream.id }],
      reason: "Fictional reason",
    });
    expect((await readStream(stream.id))?.draft).toMatchObject({
      state: "rejected",
      reason: "Fictional reason",
    });
    const response = await test.request(
      configurer.cookie,
      "DELETE",
      `/api/records/release-stream/${stream.id}/draft/rejection`,
    );
    expect(response.statusCode).toBe(200);
    expect((await readStream(stream.id))?.draft?.state).toBe("waiting");
  });

  it("a stream's unpublished draft is seen only by its maker", async () => {
    const response = await test.request(
      configurer.cookie,
      "POST",
      "/api/release-streams",
      { name: unique("Fictional Unpublished") },
      { publish: false },
    );
    const { stream } = response.json<{ stream: ReleaseStream }>();
    expect(stream.draft?.unpublished).toBe(true);
    expect(await readStream(stream.id, viewer.cookie)).toBeUndefined();
    await test.request(configurer.cookie, "POST", "/api/unpublished/publish");
    expect(await readStream(stream.id, viewer.cookie)).toBeDefined();
  });

  it("changes are named in the change history by their stream", async () => {
    const stream = await liveStream();
    await draftRelease(stream.id, {
      name: "Fictional Named Release",
      ...firstHalf,
    });
    const reader = await test.signedIn(["features:view"]);
    const response = await test.request(reader.cookie, "GET", "/api/changes");
    const { entries } = response.json<ChangeHistory>();
    expect(
      entries
        .flatMap(({ records }) => records)
        .find(({ name }) => name === "Fictional Named Release"),
    ).toMatchObject({ kind: "release", list: stream.name, draft: true });
  });

  it("a change to a pattern's length is shown in the change history as text", async () => {
    const stream = await liveStream();
    await test.request(
      configurer.cookie,
      "PUT",
      `/api/release-streams/${stream.id}/patterns/${String(stream.patterns[0]?.id)}`,
      { ...quarters, length: 5 },
    );
    const response = await test.request(
      configurer.cookie,
      "GET",
      "/api/changes",
    );
    const fields = response
      .json<ChangeHistory>()
      .entries.flatMap(({ records }) => records)
      .filter((record) => record.kind === "cycle-pattern")
      .flatMap((record) => record.fields);
    expect(fields).toContainEqual({
      field: "length",
      oldValue: "3",
      newValue: "5",
    });
  });

  it("a release's ships-on day cleared is shown in the change history as cleared", async () => {
    const stream = await liveStream();
    const name = unique("Fictional Cleared Ship");
    const drafted = await draftRelease(stream.id, {
      name,
      ...firstHalf,
      shipsOn: "2027-07-31",
    });
    const [release] = drafted.json<{ stream: ReleaseStream }>().stream.releases;
    await test.request(
      planner.cookie,
      "PUT",
      `/api/release-streams/${stream.id}/releases/${String(release?.id)}`,
      { name, ...firstHalf, shipsOn: null },
    );
    const response = await test.request(planner.cookie, "GET", "/api/changes");
    const fields = response
      .json<ChangeHistory>()
      .entries.flatMap(({ records }) => records)
      .filter((record) => record.name === name)
      .flatMap((record) => record.fields);
    expect(fields).toContainEqual({
      field: "shipsOn",
      oldValue: "2027-07-31",
      newValue: null,
    });
  });

  it("are not shown to a reader who sees neither the plan nor anything else in the history", async () => {
    const actor = {
      user: { id: viewer.id, name: "Fictional", email: "" },
      roleId: null,
      dataClasses: defaultClasses,
      permissions: ["people:view" as const],
    };
    expect(await readChangeHistory(test.connection, actor)).toEqual({
      entries: [],
      next: null,
      includedSensitive: false,
    });
  });

  it("changes cannot be undone yet", async () => {
    const response = await test.request(
      configurer.cookie,
      "POST",
      "/api/release-streams",
      { name: unique("Fictional Undone") },
    );
    const { changeSetId } = response.json<{ changeSetId: string }>();
    const undone = await test.request(
      configurer.cookie,
      "POST",
      `/api/undo/${changeSetId}`,
    );
    expect(undone.statusCode).toBe(409);
  });
});
