// SPDX-License-Identifier: Apache-2.0

// Release streams, their cycle patterns, and their releases: reading them as the viewer sees them,
// each stream with its cycles worked out from its patterns, and drafting streams added, renamed,
// retired, and restored, patterns and releases added, changed, and removed, and a release's note.
// Part of the data access layer; the caller checks the actor's permissions. Every change is a draft
// of a plan record, as records.ts sets out, with the rules release-kinds.ts sets.

import type { Database } from "@fathom/db";
import {
  cyclesOf,
  type StreamSpan,
  horizonFrom,
  lastStartOf,
  knownColour,
  longestCycle,
  movedCycles,
  movedReleases,
  patternsForLength,
  type CycleLengthRequest,
  type CyclePattern,
  type CyclePatternLike,
  type CyclePatternRequest,
  type Permission,
  type Release,
  type ReleaseRequest,
  type ReleaseStream,
  type ReleaseStreamRequest,
  type RecordType,
} from "@fathom/shared";
import { randomUUID } from "node:crypto";
import type { Actor } from "../access.ts";
import { ConflictError, NotFoundError } from "../errors.ts";
import type { Saved } from "./changes.ts";
import type { Recorded } from "./drafts.ts";
import {
  addedOnly,
  readsKind,
  type RecordsState,
  shownIds,
  shownVersion,
  stateOf,
} from "./record-state.ts";
import {
  changeableRecord,
  discardRecordDraft,
  drafting,
  keptNote,
  kindOf,
  type Makers,
  readRecordMakers,
  readRecordsState,
  recordDraftOut,
  recordHeldBy,
  saveRecordDraft,
  saveRecordDrafts,
  type Wanted,
} from "./records.ts";
import {
  spanOf,
  streamPatterns,
  streamSpanOf,
  livePatterns,
  releaseKind,
  streamFeatures,
  streamReleases,
} from "./release-kinds.ts";
import { readToday } from "./settings.ts";

// The records of a kind in a stream, as shown, in order of the day given by a field.
function inStream(
  state: RecordsState,
  type: RecordType,
  streamId: string,
  by: string,
): { id: string; record: Recorded }[] {
  return shownIds(state, type)
    .flatMap((id) => {
      const record = shownVersion(state, type, id);
      return record?.streamId === streamId ? [{ id, record }] : [];
    })
    .sort((a, b) =>
      // The field is one of the kind's own, named by the caller.
      // eslint-disable-next-line security/detect-object-injection
      String(a.record[by]).localeCompare(String(b.record[by])),
    );
}

const extras = (
  state: RecordsState,
  makers: Makers,
  type: RecordType,
  id: string,
) => {
  const draft = recordDraftOut(kindOf(type), state, makers, id);
  return {
    ...(draft === undefined ? {} : { draft }),
    ...recordHeldBy(state, type, id),
  };
};

function streamOut(
  state: RecordsState,
  makers: Makers,
  id: string,
): ReleaseStream {
  const stream = shownVersion(state, "release-stream", id) as Recorded;
  const patterns = inStream(state, "cycle-pattern", id, "startsOn").map(
    ({ id: patternId, record }): CyclePattern => ({
      id: patternId,
      startsOn: String(record.startsOn),
      length: Number(record.length),
      unit: record.unit === "weeks" ? "weeks" : "months",
      naming: String(record.naming),
      ...extras(state, makers, "cycle-pattern", patternId),
    }),
  );
  const releases = inStream(state, "release", id, "firstCycle").map(
    ({ id: releaseId, record }): Release => ({
      id: releaseId,
      name: String(record.name),
      firstCycle: String(record.firstCycle),
      lastCycle: String(record.lastCycle),
      shipsOn: typeof record.shipsOn === "string" ? record.shipsOn : null,
      colour: knownColour(record.colour),
      note: typeof record.note === "string" ? record.note : null,
      ...extras(state, makers, "release", releaseId),
    }),
  );
  const span = spanOf(stream);
  const cycles = cyclesOf(
    streamPatterns(state, id).map(({ pattern }) => pattern),
    span.cyclesUntil,
    span.endsOn,
  );
  const liveSpan = spanOf(
    stateOf(state, "release-stream").live.get(id) ?? stream,
  );
  const liveCycles = cyclesOf(
    livePatterns(state, id),
    liveSpan.cyclesUntil,
    liveSpan.endsOn,
  );
  return {
    id,
    name: String(stream.name),
    retired: stream.retired === true,
    ...span,
    patterns,
    cycles,
    ...(JSON.stringify(liveCycles) === JSON.stringify(cycles)
      ? {}
      : { liveCycles }),
    releases,
    ...extras(state, makers, "release-stream", id),
  };
}

// Every stream, in their order, then those drafted to be added, in the order drafted.
export function streamsOut(
  state: RecordsState,
  makers: Makers,
): ReleaseStream[] {
  const { rows } = stateOf(state, "release-stream");
  const placeOf = (id: string) =>
    Number(rows.get(id)?.position ?? Number.MAX_SAFE_INTEGER);
  return shownIds(state, "release-stream")
    .map((id, drafted) => ({ id, place: placeOf(id), drafted }))
    .sort((a, b) => a.place - b.place || a.drafted - b.drafted)
    .map(({ id }) => streamOut(state, makers, id));
}

// A stream as the viewer may see it, its releases only to those who may read releases, as the
// release kind sets out.
const asSeenBy =
  (viewer: Actor) =>
  (stream: ReleaseStream): ReleaseStream =>
    readsKind(releaseKind, viewer.permissions)
      ? stream
      : { ...stream, releases: [] };

// Every stream as the viewer sees it, with its patterns, cycles, and releases.
export async function readReleaseStreams(
  database: Database,
  viewer: Actor,
): Promise<ReleaseStream[]> {
  // Read as of one moment, so an approval saved meanwhile is seen whole or not at all.
  return database.transaction(
    async (transaction) => {
      const state = await readRecordsState(transaction, viewer.user.id);
      return streamsOut(
        state,
        await readRecordMakers(transaction, state, viewer),
      ).map(asSeenBy(viewer));
    },
    { isolationLevel: "repeatable read", accessMode: "read only" },
  );
}

// Runs a change to a stream or what belongs to it, and answers with the stream as the editor now
// sees it.
async function changingStream(
  database: Database,
  editor: Actor,
  streamId: string,
  change: (
    transaction: Parameters<Parameters<typeof drafting>[2]>[0],
    state: RecordsState,
  ) => Promise<string | null>,
): Promise<Saved<ReleaseStream>> {
  return drafting(database, editor.user.id, async (transaction, state) => {
    const changeSetId = await change(transaction, state);
    const now = await readRecordsState(transaction, editor.user.id);
    return {
      result: asSeenBy(editor)(
        streamOut(
          now,
          await readRecordMakers(transaction, now, editor),
          streamId,
        ),
      ),
      changeSetId,
    };
  });
}

// A stream's cycles are made until two years from the day it is drafted.
export async function createStream(
  database: Database,
  maker: Actor,
  request: ReleaseStreamRequest,
  asOf?: string,
): Promise<Saved<ReleaseStream>> {
  const today = asOf ?? (await readToday(database));
  const id = randomUUID();
  return changingStream(database, maker, id, (transaction, state) =>
    saveRecordDraft(transaction, maker, state, "release-stream", id, {
      name: request.name,
      retired: false,
      cyclesUntil: horizonFrom(today),
      endsOn: null,
    }),
  );
}

export async function updateStream(
  database: Database,
  maker: Actor,
  id: string,
  change: Partial<{ name: string; retired: boolean } & StreamSpan>,
): Promise<Saved<ReleaseStream>> {
  return changingStream(database, maker, id, (transaction, state) => {
    const stream = changeableRecord(state, "release-stream", id);
    return saveRecordDraft(transaction, maker, state, "release-stream", id, {
      ...stream,
      ...change,
    });
  });
}

// Drafts how far a stream's cycles go: the day they are made until, and its last day, if any.
export const changeStreamSpan = (
  database: Database,
  maker: Actor,
  id: string,
  span: StreamSpan,
): Promise<Saved<ReleaseStream>> => updateStream(database, maker, id, span);

// A record of a stream to change, refusing one that is not in the stream.
function inStreamRecord(
  state: RecordsState,
  type: RecordType,
  streamId: string,
  id: string,
): Recorded {
  const record = changeableRecord(state, type, id);
  if (record.streamId !== streamId) {
    throw new NotFoundError("There is no such record in this stream");
  }
  return record;
}

const patternRecord = (streamId: string, request: CyclePatternRequest) => ({
  streamId,
  startsOn: request.startsOn,
  length: request.length,
  unit: request.unit,
  naming: request.naming,
});

const releaseRecord = (streamId: string, request: ReleaseRequest) => ({
  streamId,
  name: request.name,
  firstCycle: request.firstCycle,
  lastCycle: request.lastCycle,
  shipsOn: request.shipsOn,
  colour: request.colour,
});

// Drafts adding a pattern or release to a stream.
export async function addToStream(
  database: Database,
  maker: Actor,
  streamId: string,
  added:
    | { type: "cycle-pattern"; request: CyclePatternRequest }
    | { type: "release"; request: ReleaseRequest },
): Promise<Saved<ReleaseStream>> {
  // Saving refuses a stream that does not exist, as it does any link to a record.
  return changingStream(database, maker, streamId, (transaction, state) => {
    const record =
      added.type === "cycle-pattern"
        ? patternRecord(streamId, added.request)
        : releaseRecord(streamId, added.request);
    return saveRecordDraft(
      transaction,
      maker,
      state,
      added.type,
      randomUUID(),
      record,
    );
  });
}

// Drafts a change to a pattern or release of a stream, keeping what the request does not hold, such
// as a release's note.
export async function changeInStream(
  database: Database,
  maker: Actor,
  streamId: string,
  id: string,
  changed:
    | { type: "cycle-pattern"; request: CyclePatternRequest }
    | { type: "release"; request: ReleaseRequest },
): Promise<Saved<ReleaseStream>> {
  return changingStream(database, maker, streamId, (transaction, state) => {
    const kept = inStreamRecord(state, changed.type, streamId, id);
    const record =
      changed.type === "cycle-pattern"
        ? patternRecord(streamId, changed.request)
        : releaseRecord(streamId, changed.request);
    return saveRecordDraft(transaction, maker, state, changed.type, id, {
      ...kept,
      ...record,
    });
  });
}

// Drafts a release's note, kept exactly as sent, or removed when empty. A note holding anything
// notes do not allow is refused rather than cleaned, so what is kept is what the editor showed.
export async function changeReleaseNote(
  database: Database,
  maker: Actor,
  streamId: string,
  id: string,
  note: string | null,
): Promise<Saved<ReleaseStream>> {
  const kept = keptNote(note);
  return changingStream(database, maker, streamId, (transaction, state) => {
    const release = inStreamRecord(state, "release", streamId, id);
    return saveRecordDraft(transaction, maker, state, "release", id, {
      ...release,
      note: kept,
    });
  });
}

// Drafts removing a pattern or release of a stream; removing one only drafted to be added discards
// its draft, as records.ts discards drafts.
export async function removeFromStream(
  database: Database,
  maker: Actor,
  streamId: string,
  type: "cycle-pattern" | "release",
  id: string,
  mayChangeCycles: boolean,
): Promise<string | null> {
  const discards = await drafting(
    database,
    maker.user.id,
    (_transaction, state) => {
      inStreamRecord(state, type, streamId, id);
      return Promise.resolve(addedOnly(state, type, id));
    },
  );
  if (discards) {
    return discardRecordDraft(database, maker, type, id, mayChangeCycles);
  }
  return (
    await changingStream(database, maker, streamId, (transaction, state) => {
      inStreamRecord(state, type, streamId, id);
      return saveRecordDraft(transaction, maker, state, type, id, undefined);
    })
  ).changeSetId;
}

type Kept = ReturnType<typeof streamPatterns>;

const samePattern = (first: CyclePatternLike, second: CyclePatternLike) =>
  first.startsOn === second.startsOn &&
  first.length === second.length &&
  first.unit === second.unit &&
  first.naming === second.naming;

// The drafts that take a stream's patterns to those wanted: each record keeps its start day, so no
// record takes a day another still holds; the rest are removed, and new days added.
function patternDrafts(
  state: RecordsState,
  streamId: string,
  kept: Kept,
  wanted: readonly CyclePatternLike[],
): Wanted[] {
  const drafts: Wanted[] = [];
  for (const { id, pattern } of kept) {
    const same = wanted.find(({ startsOn }) => startsOn === pattern.startsOn);
    if (same !== undefined && samePattern(same, pattern)) continue;
    const record = changeableRecord(state, "cycle-pattern", id);
    drafts.push({
      type: "cycle-pattern",
      id,
      record: same === undefined ? undefined : { ...record, ...same },
    });
  }
  for (const pattern of wanted) {
    if (kept.some((old) => old.pattern.startsOn === pattern.startsOn)) continue;
    drafts.push({
      type: "cycle-pattern",
      id: randomUUID(),
      record: { streamId, ...pattern },
    });
  }
  return drafts;
}

// The drafts that move a stream's releases and features with their cycles, a feature as a release
// on its one cycle, refusing one that would be on a cycle no longer made, or a release that would
// start after its Ships on day.
function movingDrafts(
  state: RecordsState,
  streamId: string,
  moved: ReadonlyMap<string, string | undefined>,
  permissions: readonly Permission[],
): Wanted[] {
  const found = [
    ...streamReleases(state, streamId).map(({ id, release }) => ({
      type: "release" as const,
      id,
      record: release,
      name: String(release.name),
      firstCycle: String(release.firstCycle),
      lastCycle: String(release.lastCycle),
      shipsOn: typeof release.shipsOn === "string" ? release.shipsOn : null,
    })),
    ...streamFeatures(state, streamId).map(({ id, record }) => ({
      type: "feature" as const,
      id,
      record,
      name: String(record.name),
      firstCycle: String(record.targetCycle),
      lastCycle: String(record.targetCycle),
      shipsOn: null,
    })),
  ];
  const moving = movedReleases(
    found,
    moved,
    lastStartOf(streamSpanOf(state, streamId)),
    nameOf(state, streamId),
    permissions,
  );
  if ("problem" in moving) throw new ConflictError(moving.problem);
  return moving.moves.map(({ release: { type, id, record }, ...to }) => {
    changeableRecord(state, type, id);
    return {
      type,
      id,
      record:
        type === "release"
          ? { ...record, ...to }
          : { ...record, targetCycle: to.firstCycle },
    };
  });
}

const nameOf = (state: RecordsState, streamId: string): string =>
  String(shownVersion(state, "release-stream", streamId)?.name);

// Drafts one cycle's new length, with the patterns that give it, and the releases and features on
// cycles that move, moved with them, all in one change set, as the Decisions Log sets out.
export async function changeCycleLength(
  database: Database,
  maker: Actor,
  streamId: string,
  startsOn: string,
  request: CycleLengthRequest,
): Promise<Saved<ReleaseStream>> {
  return changingStream(database, maker, streamId, (transaction, state) => {
    changeableRecord(state, "release-stream", streamId);
    const kept = streamPatterns(state, streamId);
    const patterns = kept.map(({ pattern }) => pattern);
    const { cyclesUntil, endsOn } = streamSpanOf(state, streamId);
    const before = cyclesOf(patterns, cyclesUntil, endsOn);
    if (!before.some((cycle) => cycle.startsOn === startsOn)) {
      throw new NotFoundError("There is no such cycle in this stream");
    }
    const { unit } = patterns
      .filter((pattern) => pattern.startsOn <= startsOn)
      .sort((a, b) => a.startsOn.localeCompare(b.startsOn))
      // A cycle starts on that day, so a pattern makes it.
      .at(-1) as CyclePatternLike;
    if (request.length > longestCycle[unit === "weeks" ? "weeks" : "months"]) {
      throw new ConflictError("A cycle can be at most two years long.");
    }
    const made = patternsForLength(patterns, { startsOn, ...request });
    if ("problem" in made) throw new ConflictError(made.problem);
    const moved = movedCycles(
      before,
      cyclesOf(made.patterns, cyclesUntil, endsOn),
    );
    return saveRecordDrafts(transaction, maker, state, [
      ...patternDrafts(state, streamId, kept, made.patterns),
      ...movingDrafts(state, streamId, moved, maker.permissions),
    ]);
  });
}
