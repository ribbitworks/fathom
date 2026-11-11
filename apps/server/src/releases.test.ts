// SPDX-License-Identifier: Apache-2.0

// Tests for release streams, their cycle patterns, and their releases, against a PostgreSQL server
// of their own: who may read and change them, their cycles, the rules for patterns and releases,
// and their drafts, approved with the drafts they use, rejected only together with the drafts that
// use them, discarded with the drafts that belong to them, and named in the change history.

import {
  changes,
  cyclePatterns,
  drafts,
  releases,
  releaseStreams,
} from "@fathom/db";
import {
  defaultClasses,
  type ChangeHistory,
  dayIn,
  defaultTimeZone,
  horizonFrom,
  type ReleaseStream,
  type ReleaseStreams,
  type Unpublished,
} from "@fathom/shared";
import { eq, inArray } from "drizzle-orm";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import { readChangeHistory } from "./data/change-history.ts";
import {
  type Method,
  startTestApp,
  type TestApp,
  missingRecord as missing,
  unique,
} from "./test-app.ts";

let test: TestApp;
let configurer: { id: string; cookie: string };
let planner: { id: string; cookie: string };
let viewer: { id: string; cookie: string };
let approver: { id: string; cookie: string };

beforeAll(async () => {
  test = await startTestApp();
  configurer = await test.signedIn("workforce-administrator");
  planner = await test.signedIn("product-manager");
  viewer = await test.signedIn("team-member");
  approver = await test.signedIn("project-manager");
});

afterAll(async () => {
  await test.close();
});

const quarters = {
  startsOn: "2027-01-01",
  length: 3,
  unit: "months",
  naming: "{YY}.{N}",
};

async function readStreams(cookie = configurer.cookie) {
  const response = await test.request(cookie, "GET", "/api/release-streams");
  return response.json<ReleaseStreams>();
}

async function readStream(id: string, cookie = configurer.cookie) {
  return (await readStreams(cookie)).streams.find((stream) => stream.id === id);
}

async function draftStream(name = unique("Fictional Stream")) {
  const response = await test.request(
    configurer.cookie,
    "POST",
    "/api/release-streams",
    { name },
  );
  expect(response.statusCode).toBe(201);
  return response.json<{ stream: ReleaseStream }>().stream;
}

async function draftPattern(streamId: string, pattern: object = quarters) {
  return test.request(
    configurer.cookie,
    "POST",
    `/api/release-streams/${streamId}/patterns`,
    pattern,
  );
}

async function draftRelease(
  streamId: string,
  release: object,
  cookie = planner.cookie,
) {
  return test.request(
    cookie,
    "POST",
    `/api/release-streams/${streamId}/releases`,
    release,
  );
}

const decide = (asking: "approval" | "rejection", body: object) =>
  test.request(approver.cookie, "POST", `/api/drafts/${asking}`, body);

const approveAll = async (stream: ReleaseStream) => {
  const records = [
    ...(stream.draft ? [{ type: "release-stream", id: stream.id }] : []),
    ...stream.patterns
      .filter(({ draft }) => draft !== undefined)
      .map(({ id }) => ({ type: "cycle-pattern", id })),
    ...stream.releases
      .filter(({ draft }) => draft !== undefined)
      .map(({ id }) => ({ type: "release", id })),
  ];
  const response = await decide("approval", { records });
  expect(response.statusCode).toBe(200);
};

// A live stream of quarterly cycles from 2027.
async function liveStream(): Promise<ReleaseStream> {
  const stream = await draftStream();
  await draftPattern(stream.id);
  await approveAll((await readStream(stream.id)) as ReleaseStream);
  return (await readStream(stream.id)) as ReleaseStream;
}

const firstHalf = { firstCycle: "2027-01-01", lastCycle: "2027-04-01" };

// Today in Fathom's time zone, which the tests leave as it starts.
const today = () => dayIn(defaultTimeZone);

const changeCyclesUntil = (streamId: string, cyclesUntil: string) =>
  test.request(
    configurer.cookie,
    "PUT",
    `/api/release-streams/${streamId}/cycles-until`,
    { cyclesUntil },
  );

describe("reading release streams", () => {
  it("is open to those who see the plan, without changing anything", async () => {
    const response = await test.request(
      viewer.cookie,
      "GET",
      "/api/release-streams",
    );
    expect(response.statusCode).toBe(200);
    expect(response.json<ReleaseStreams>()).toMatchObject({
      canEditStreams: false,
      canEditReleases: false,
    });
  });

  it("shows each stream's cycles, worked out from its patterns, up to the day they are made until", async () => {
    const stream = await liveStream();
    expect(stream.cycles.slice(0, 2)).toEqual([
      expect.objectContaining({
        startsOn: "2027-01-01",
        endsOn: "2027-03-31",
        name: "27.1",
      }),
      expect.objectContaining({ startsOn: "2027-04-01", name: "27.2" }),
    ]);
    const last = stream.cycles.at(-1);
    expect(String(last?.startsOn) <= stream.cyclesUntil).toBe(true);
    expect(String(last?.endsOn) >= stream.cyclesUntil).toBe(true);
  });
});

describe("who may change what", () => {
  let stream: ReleaseStream;
  let pattern: string;
  let release: string;

  beforeAll(async () => {
    stream = await liveStream();
    pattern = String(stream.patterns[0]?.id);
    await draftRelease(stream.id, {
      name: unique("Fictional Guarded"),
      ...firstHalf,
    });
    await approveAll(
      (await readStream(stream.id, planner.cookie)) as ReleaseStream,
    );
    release = String((await readStream(stream.id))?.releases[0]?.id);
  });

  const path = () => `/api/release-streams/${stream.id}`;

  it("refuses reading streams to those who see neither the plan nor planning configuration", async () => {
    const reader = await test.signedIn("administrator");
    const response = await test.request(
      reader.cookie,
      "GET",
      "/api/release-streams",
    );
    expect(response.statusCode).toBe(403);
  });

  it.each([
    ["renaming a stream", "PUT", "", { name: "Fictional Renamed" }],
    ["retiring a stream", "PUT", "/retired", { retired: true }],
    [
      "changing when its cycles end",
      "PUT",
      "/cycles-until",
      { cyclesUntil: "2031-12-31" },
    ],
    ["adding a change of cycles", "POST", "/patterns", quarters],
  ] as const)(
    "refuses %s to those who do not edit planning configuration",
    async (_name, method, tail, body) => {
      const response = await test.request(
        planner.cookie,
        method,
        `${path()}${tail}`,
        body,
      );
      expect(response.statusCode).toBe(403);
    },
  );

  it.each([
    ["changing", "PUT"],
    ["removing", "DELETE"],
  ] as const)(
    "refuses %s a change of cycles to those who do not edit planning configuration",
    async (_name, method) => {
      const response = await test.request(
        planner.cookie,
        method,
        `${path()}/patterns/${pattern}`,
        method === "PUT" ? quarters : undefined,
      );
      expect(response.statusCode).toBe(403);
    },
  );

  it.each([
    ["changing", "PUT"],
    ["removing", "DELETE"],
  ] as const)(
    "refuses %s a release to those who do not edit the plan",
    async (_name, method) => {
      const response = await test.request(
        configurer.cookie,
        method,
        `${path()}/releases/${release}`,
        method === "PUT" ? { name: "Fictional", ...firstHalf } : undefined,
      );
      expect(response.statusCode).toBe(403);
    },
  );

  it.each([
    ["discarding", "/draft"],
    ["resubmitting", "/draft/rejection"],
  ])(
    "refuses %s a stream's draft to those who do not edit planning configuration",
    async (_name, tail) => {
      const response = await test.request(
        planner.cookie,
        "DELETE",
        `/api/records/release-stream/${stream.id}${tail}`,
      );
      expect(response.statusCode).toBe(403);
    },
  );

  it.each([
    ["discarding", "/draft"],
    ["resubmitting", "/draft/rejection"],
  ])(
    "refuses %s a release's draft to those who do not edit the plan",
    async (_name, tail) => {
      const response = await test.request(
        configurer.cookie,
        "DELETE",
        `/api/records/release/${release}${tail}`,
      );
      expect(response.statusCode).toBe(403);
    },
  );
});

describe("changing release streams", () => {
  it("is refused to those who do not edit planning configuration", async () => {
    const response = await test.request(
      planner.cookie,
      "POST",
      "/api/release-streams",
      { name: unique("Fictional Refused") },
    );
    expect(response.statusCode).toBe(403);
  });

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

  it("makes a new stream's cycles until two years from the day it is drafted", async () => {
    const before = today();
    const stream = await draftStream();
    // Either day, should the day change while the stream is drafted.
    expect([horizonFrom(before), horizonFrom(today())]).toContain(
      stream.cyclesUntil,
    );
  });

  it("drafts making a stream's cycles until a later day, which makes more cycles", async () => {
    const stream = await liveStream();
    const response = await changeCyclesUntil(stream.id, "2059-12-31");
    expect(response.statusCode).toBe(200);
    const changed = response.json<{ stream: ReleaseStream }>().stream;
    expect(changed.cyclesUntil).toBe("2059-12-31");
    expect(changed.cycles.at(-1)?.startsOn).toBe("2059-10-01");
  });

  it("refuses making a stream's cycles until a day before a release's last cycle starts", async () => {
    const stream = await liveStream();
    await draftRelease(stream.id, {
      name: "Fictional Late",
      firstCycle: "2027-10-01",
      lastCycle: "2027-10-01",
    });
    await approveAll(
      (await readStream(stream.id, planner.cookie)) as ReleaseStream,
    );
    const response = await changeCyclesUntil(stream.id, "2027-09-30");
    expect(response.statusCode).toBe(409);
    expect(response.json<{ error: string }>().error).toBe(
      "The release Fictional Late includes cycles after that day; change it first",
    );
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
  it("may change the cycles from the start of one of the stream's cycles", async () => {
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

  it("ship at the end of their last cycle unless given another day", async () => {
    const stream = await liveStream();
    const response = await draftRelease(stream.id, {
      name: "Fictional Late Ship",
      ...firstHalf,
      shipsOn: "2027-07-31",
    });
    expect(response.statusCode).toBe(201);
    expect(
      response.json<{ stream: ReleaseStream }>().stream.releases[0]?.shipsOn,
    ).toBe("2027-07-31");
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

  it("show a colour the palette no longer has as the default", async () => {
    const stream = await liveStream();
    await draftRelease(stream.id, { name: "Fictional Faded", ...firstHalf });
    await approveAll((await readStream(stream.id)) as ReleaseStream);
    await test.connection
      .update(releases)
      .set({ colour: "beige" })
      .where(eq(releases.streamId, stream.id));
    expect((await readStream(stream.id))?.releases[0]?.colour).toBeNull();
  });

  it("may not ship before their first cycle starts", async () => {
    const stream = await liveStream();
    const response = await draftRelease(stream.id, {
      name: "Fictional Early Ship",
      ...firstHalf,
      shipsOn: "2026-12-31",
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
  });

  it("may not include a cycle another release includes", async () => {
    const stream = await liveStream();
    await draftRelease(stream.id, { name: "Fictional One", ...firstHalf });
    const response = await draftRelease(stream.id, {
      name: "Fictional Two",
      firstCycle: "2027-04-01",
      lastCycle: "2027-07-01",
    });
    expect(response.statusCode).toBe(409);
  });

  it("must be named uniquely within their stream", async () => {
    const stream = await liveStream();
    await draftRelease(stream.id, { name: "Fictional Named", ...firstHalf });
    const response = await draftRelease(stream.id, {
      name: "fictional named",
      firstCycle: "2027-07-01",
      lastCycle: "2027-07-01",
    });
    expect(response.statusCode).toBe(409);
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

  it("are removed by an empty note", async () => {
    const { stream, release } = await liveRelease(noted);
    await writeNote(stream.id, release.id, "  ");
    expect((await readStream(stream.id))?.releases[0]?.note).toBeNull();
    await approveAll((await readStream(stream.id)) as ReleaseStream);
    const [row] = await test.connection
      .select({ note: releases.note })
      .from(releases)
      .where(eq(releases.id, release.id));
    expect(row?.note).toBeNull();
  });

  it("are kept when the release is changed", async () => {
    const { stream, release } = await liveRelease(noted);
    await test.request(
      planner.cookie,
      "PUT",
      `/api/release-streams/${stream.id}/releases/${release.id}`,
      { name: release.name, ...firstHalf, colour: "teal" },
    );
    const [changed] = (await readStream(stream.id))?.releases ?? [];
    expect([changed?.colour, changed?.note, changed?.draft?.changed]).toEqual([
      "teal",
      noted,
      ["colour"],
    ]);
  });

  it.each([
    ["HTML", "<script>alert(1)</script>"],
    ["an image", "![Fictional](https://example.com/a.png)"],
    ["a link to something but a web address", "[Run](javascript:alert(1))"],
    ["a numbered list", "1. First"],
    ["a colour off the palette", '<span data-colour="beige">Beige</span>'],
    ["more than notes may hold", "a".repeat(10_001)],
  ])("refuse a note holding %s, drafting nothing", async (_what, note) => {
    const { stream, release } = await liveRelease();
    const response = await writeNote(stream.id, release.id, note);
    expect(response.statusCode).toBe(400);
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

  it("keeps the note of a release it moves", async () => {
    const stream = await withRelease();
    const release = stream.releases[0] as ReleaseStream["releases"][number];
    await test.request(
      planner.cookie,
      "PUT",
      `/api/release-streams/${stream.id}/releases/${release.id}/note`,
      { note: "Fictional *moved*" },
    );
    await approveAll((await readStream(stream.id)) as ReleaseStream);
    const response = await changeLength(stream.id, "2027-04-01", {
      length: 2,
      later: "move",
    });
    const [moved] = response.json<{ stream: ReleaseStream }>().stream.releases;
    expect([moved?.firstCycle, moved?.note]).toEqual([
      "2027-06-01",
      "Fictional *moved*",
    ]);
    await approveAll((await readStream(stream.id)) as ReleaseStream);
    const [row] = await test.connection
      .select({ note: releases.note })
      .from(releases)
      .where(eq(releases.id, release.id));
    expect(row?.note).toBe("Fictional *moved*");
  });

  it("keeps the next cycle's end date, leaving the releases after it as they are", async () => {
    const stream = await withRelease();
    const response = await changeLength(stream.id, "2027-01-01", {
      length: 2,
      later: "keep",
    });
    const drafted = response.json<{ stream: ReleaseStream }>().stream;
    expect(spans(drafted)?.slice(0, 3)).toEqual([
      "2027-01-01 to 2027-02-28",
      "2027-03-01 to 2027-06-30",
      "2027-07-01 to 2027-09-30",
    ]);
    expect(drafted.releases[0]?.draft).toBeUndefined();
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

  it("binds a release that moves by whole cycles to the change", async () => {
    const stream = await draftStream();
    await draftPattern(stream.id, { ...quarters, length: 2, unit: "weeks" });
    await draftRelease(stream.id, {
      name: "Fictional Sprint",
      firstCycle: "2027-02-12",
      lastCycle: "2027-02-12",
    });
    await approveAll((await readStream(stream.id)) as ReleaseStream);
    const drafted = (
      await changeLength(stream.id, "2027-01-15", { length: 4, later: "move" })
    ).json<{ stream: ReleaseStream }>().stream;
    const release = drafted.releases[0];
    expect(release?.firstCycle).toBe("2027-02-26");
    const approved = await decide("approval", {
      records: [{ type: "release", id: release?.id }],
    });
    expect(approved.statusCode).toBe(200);
    expect(
      (await readStream(stream.id))?.patterns.filter(
        ({ draft }) => draft !== undefined,
      ),
    ).toEqual([]);
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

  it("leaves a release changed on the same cycles apart from a change of cycles", async () => {
    const stream = await withRelease();
    const releaseId = String(stream.releases[0]?.id);
    await test.request(
      planner.cookie,
      "PUT",
      `/api/release-streams/${stream.id}/releases/${releaseId}`,
      {
        name: "Fictional Later",
        firstCycle: "2027-07-01",
        lastCycle: "2027-10-01",
        colour: "teal",
      },
    );
    const changed = await changeLength(stream.id, "2027-10-01", {
      length: 2,
      later: "move",
    });
    expect(
      changed
        .json<{ stream: ReleaseStream }>()
        .stream.patterns.flatMap(({ draft }) => draft?.uses ?? []),
    ).not.toContainEqual({ type: "release", id: releaseId });
  });

  it("refuses discarding it to someone who may not change cycles", async () => {
    const { release } = await draftedChange();
    const response = await test.request(
      planner.cookie,
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

  it("drafts removing the patterns a change back no longer needs", async () => {
    const stream = await liveStream();
    const changed = (
      await changeLength(stream.id, "2027-04-01", { length: 2, later: "move" })
    ).json<{ stream: ReleaseStream }>().stream;
    await approveAll(changed);
    const back = (
      await changeLength(stream.id, "2027-04-01", { length: 3, later: "move" })
    ).json<{ stream: ReleaseStream }>().stream;
    expect(spans(back)).toEqual(spans(stream));
    expect(
      back.patterns
        .filter(({ draft }) => draft?.action === "deleted")
        .map(({ startsOn }) => startsOn),
    ).toEqual(["2027-04-01", "2027-06-01"]);
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

  it("is refused to those who do not edit planning configuration", async () => {
    const stream = await liveStream();
    const response = await changeLength(
      stream.id,
      "2027-04-01",
      { length: 2, later: "move" },
      planner.cookie,
    );
    expect(response.statusCode).toBe(403);
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

  it("counts the longest cycle in the unit of the pattern that makes it", async () => {
    const stream = await draftStream();
    await draftPattern(stream.id, { ...quarters, length: 2, unit: "weeks" });
    await approveAll((await readStream(stream.id)) as ReleaseStream);
    const response = await changeLength(stream.id, "2027-01-15", {
      length: 104,
      later: "move",
    });
    expect(response.statusCode).toBe(200);
  });

  it("refuses a cycle longer than two years", async () => {
    const stream = await liveStream();
    const response = await changeLength(stream.id, "2027-04-01", {
      length: 25,
      later: "move",
    });
    expect(response.statusCode).toBe(409);
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
    const reader = await test.signedIn(["plan:view", "changes:view"]);
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
      permissions: ["changes:view" as const],
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
    maker = await test.signedIn([
      "plan:edit",
      "drafts:submit",
      "configuration:edit",
    ]);
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
      `the release stream ${stream.name} Subject`,
      `the release Fictional Subject in ${stream.name} Subject`,
      `the cycles of ${stream.name} Subject from 2027-07-01`,
    ]);
  });

  it("name a record only drafted to be added by its published draft once the user discards it", async () => {
    const stream = await draftStream();
    await quietly("DELETE", `/api/records/release-stream/${stream.id}/draft`);
    expect(await subjects()).toEqual([`the release stream ${stream.name}`]);
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
