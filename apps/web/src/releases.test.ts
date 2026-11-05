// SPDX-License-Identifier: Apache-2.0

// Tests for release streams through the server's API, with its answers simulated: where each change
// is sent and what it says, and how streams, their cycles, and their releases are named and dated.

import { afterEach, describe, expect, it, vi } from "vitest";
import {
  createStream,
  cycleNamed,
  discardRecordDraft,
  lastCycleEnd,
  recordNodes,
  releaseDate,
  removeFromStream,
  renameStream,
  resubmitRecordDraft,
  savePattern,
  saveRelease,
  setCyclesUntil,
  setStreamRetired,
  shipsOffCycle,
} from "./releases.ts";
import {
  fictionalPattern,
  fictionalRelease,
  fictionalStream,
  recordDraft,
  serverAnswers,
  streamId,
} from "./test-support.tsx";

const changeSetId = "00000000-0000-4000-8000-000000000001";
const stream = fictionalStream();
const streamPath = `/api/release-streams/${streamId}`;
const patternId = fictionalPattern().id;
const releaseId = fictionalRelease().id;

afterEach(() => {
  vi.unstubAllGlobals();
});

// Answers one request with the stream saved, and gives what was sent.
async function sent(
  key: string,
  send: () => Promise<unknown>,
): Promise<{ answer: unknown; body: unknown }> {
  const fetch = serverAnswers({
    [key]: () => Response.json({ stream, changeSetId }),
  });
  const answer = await send();
  const init = fetch.mock.calls[0]?.[1];
  return { answer, body: JSON.parse(init?.body as string) as unknown };
}

describe("changes to release streams sent to the server", () => {
  it("adds a stream by its name", async () => {
    expect(
      await sent("POST /api/release-streams", () =>
        createStream("Fictional Minors"),
      ),
    ).toEqual({
      answer: { stream, changeSetId },
      body: { name: "Fictional Minors" },
    });
  });

  it("renames a stream", async () => {
    expect(
      (
        await sent(`PUT ${streamPath}`, () =>
          renameStream(streamId, "Fictional Minors"),
        )
      ).body,
    ).toEqual({ name: "Fictional Minors" });
  });

  it("retires or restores a stream", async () => {
    expect(
      (
        await sent(`PUT ${streamPath}/retired`, () =>
          setStreamRetired(streamId, true),
        )
      ).body,
    ).toEqual({ retired: true });
  });

  it("changes the day a stream's cycles are made until", async () => {
    expect(
      (
        await sent(`PUT ${streamPath}/cycles-until`, () =>
          setCyclesUntil(streamId, "2028-06-30"),
        )
      ).body,
    ).toEqual({ cyclesUntil: "2028-06-30" });
  });

  const pattern = {
    startsOn: "2027-01-01",
    length: 2,
    unit: "weeks" as const,
    naming: "{#}",
  };

  it("adds a change of cycles to a stream", async () => {
    expect(
      (
        await sent(`POST ${streamPath}/patterns`, () =>
          savePattern(streamId, pattern),
        )
      ).body,
    ).toEqual(pattern);
  });

  it("changes a change of cycles by its id", async () => {
    expect(
      (
        await sent(`PUT ${streamPath}/patterns/${patternId}`, () =>
          savePattern(streamId, pattern, patternId),
        )
      ).body,
    ).toEqual(pattern);
  });

  const release = {
    name: "Fictional Two",
    firstCycle: "2027-04-01",
    lastCycle: "2027-07-01",
    shipsOn: null,
    colour: "grape" as const,
  };

  it("adds a release to a stream", async () => {
    expect(
      (
        await sent(`POST ${streamPath}/releases`, () =>
          saveRelease(streamId, release),
        )
      ).body,
    ).toEqual(release);
  });

  it("changes a release by its id", async () => {
    expect(
      (
        await sent(`PUT ${streamPath}/releases/${releaseId}`, () =>
          saveRelease(streamId, release, releaseId),
        )
      ).body,
    ).toEqual(release);
  });
});

describe("removing from release streams and handling drafts", () => {
  it("removes a release from a stream, giving the change set", async () => {
    const fetch = serverAnswers({
      [`DELETE ${streamPath}/releases/${releaseId}`]: () =>
        Response.json({ changeSetId }),
    });
    expect(await removeFromStream(streamId, "releases", releaseId)).toBe(
      changeSetId,
    );
    expect(fetch).toHaveBeenCalledTimes(1);
  });

  it("discards a record's draft", async () => {
    serverAnswers({
      [`DELETE /api/records/release/${releaseId}/draft`]: () =>
        Response.json({ changeSetId: null }),
    });
    expect(
      await discardRecordDraft({ type: "release", id: releaseId }),
    ).toBeNull();
  });

  it("sends a rejected draft for approval again", async () => {
    serverAnswers({
      [`DELETE /api/records/cycle-pattern/${patternId}/draft/rejection`]: () =>
        Response.json({ changeSetId }),
    });
    expect(
      await resubmitRecordDraft({ type: "cycle-pattern", id: patternId }),
    ).toBe(changeSetId);
  });
});

describe("cycles and releases by name and day", () => {
  it("names a cycle by the day it starts", () => {
    expect(cycleNamed(stream, "2027-04-01")).toBe("27.2");
  });

  it("gives the day itself when no cycle starts on it", () => {
    expect(cycleNamed(stream, "2031-01-01")).toBe("2031-01-01");
  });

  it("ships a release at the end of its last cycle unless given a day", () => {
    expect(
      releaseDate(stream, { lastCycle: "2027-04-01", shipsOn: null }),
    ).toBe("2027-06-30");
  });

  it("ships a release on its own day when it has one", () => {
    expect(
      releaseDate(stream, { lastCycle: "2027-04-01", shipsOn: "2027-05-15" }),
    ).toBe("2027-05-15");
  });

  it("says how many days after its last cycle ends a release ships", () => {
    expect(
      shipsOffCycle(stream, { lastCycle: "2027-04-01", shipsOn: "2027-07-31" }),
    ).toBe("31 days after 27.2 ends");
  });

  it("says a release ships a day before its last cycle ends", () => {
    expect(
      shipsOffCycle(stream, { lastCycle: "2027-04-01", shipsOn: "2027-06-29" }),
    ).toBe("1 day before 27.2 ends");
  });

  it("says nothing of a release that ships when its last cycle ends", () => {
    expect(
      [null, "2027-06-30"].map((shipsOn) =>
        shipsOffCycle(stream, { lastCycle: "2027-04-01", shipsOn }),
      ),
    ).toEqual([undefined, undefined]);
  });

  it("says nothing of a release whose last cycle the stream does not have", () => {
    expect(
      shipsOffCycle(stream, { lastCycle: "2031-01-01", shipsOn: "2031-02-01" }),
    ).toBeUndefined();
  });

  it("knows no end for a last cycle the stream does not have", () => {
    expect(lastCycleEnd(stream, "2031-01-01")).toBeUndefined();
  });
});

describe("the records of release streams", () => {
  it("names every stream, change of cycles, and release as the Drafts page does", () => {
    const draft = recordDraft({ action: "created" });
    const nodes = recordNodes([
      fictionalStream({
        draft,
        heldBy: "Fictional Colleague",
        releases: [fictionalRelease()],
      }),
    ]);
    expect(nodes).toEqual([
      {
        ref: { type: "release-stream", id: streamId },
        subject: "the release stream Fictional Majors",
        draft,
        heldBy: "Fictional Colleague",
      },
      {
        ref: { type: "cycle-pattern", id: patternId },
        subject: "the cycles of Fictional Majors from 2027-01-01",
        draft: undefined,
        heldBy: undefined,
      },
      {
        ref: { type: "release", id: releaseId },
        subject: "the release Fictional One in Fictional Majors",
        draft: undefined,
        heldBy: undefined,
      },
    ]);
  });
});
