// SPDX-License-Identifier: Apache-2.0

// Release streams, their cycle patterns and their releases with their activities: reading them as
// the viewer sees them, and drafting changes to them. Part of the data access layer; the caller
// checks the actor's permissions.

import type { Database } from "@fathom/db";
import {
  type ActivityRequest,
  cycleLengthMoves,
  cyclesOf,
  longestCycle,
  type CycleLengthRequest,
  type CyclePatternLike,
  type CyclePatternRequest,
  type ReleaseMove,
  type ReleaseRequest,
  type ReleaseStream,
  type ReleaseStreamRequest,
  type RecordRef,
  type RecordType,
} from "@fathom/shared";
import { randomUUID } from "node:crypto";
import type { Actor } from "../access.ts";
import { ConflictError, NotFoundError } from "../errors.ts";
import type { Saved } from "./changes.ts";
import type { Recorded } from "./draft-records.ts";
import { type RecordsState, shownVersion } from "./record-state.ts";
import {
  changeableRecord,
  drafting,
  saveRecordDraft,
  saveRecordDrafts,
  type Wanted,
} from "./record-drafting.ts";
import { removingWith } from "./record-decisions.ts";
import { activitiesOf } from "./activity-kinds.ts";
import { activityRecord } from "./activity-records.ts";
import { keptNote, readRecordMakers, readRecordsState } from "./records.ts";
import { streamAsSeen, streamOut, streamsOut } from "./release-stream-view.ts";
import { readToday } from "./settings.ts";
import {
  endsOnOf,
  laidOutUntil,
  type Planned,
  planned,
  streamPatterns,
} from "./stream-cycles.ts";

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
        await readToday(transaction),
      ).map(streamAsSeen(viewer.permissions));
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
      result: streamAsSeen(editor.permissions)(
        streamOut(
          now,
          await readRecordMakers(transaction, now, editor),
          streamId,
          await readToday(transaction),
        ),
      ),
      changeSetId,
    };
  });
}

// Drafts a schedule, which keeps going until given a last day.
export async function createStream(
  database: Database,
  maker: Actor,
  request: ReleaseStreamRequest,
): Promise<Saved<ReleaseStream>> {
  const id = randomUUID();
  return changingStream(database, maker, id, (transaction, state) =>
    saveRecordDraft(transaction, maker, state, "release-stream", id, {
      name: request.name,
      retired: false,
      endsOn: null,
    }),
  );
}

export async function updateStream(
  database: Database,
  maker: Actor,
  id: string,
  change: Partial<{ name: string; retired: boolean; endsOn: string | null }>,
): Promise<Saved<ReleaseStream>> {
  return changingStream(database, maker, id, (transaction, state) => {
    const stream = changeableRecord(state, "release-stream", id);
    return saveRecordDraft(transaction, maker, state, "release-stream", id, {
      ...stream,
      ...change,
    });
  });
}

// Drafts a schedule's last day, or null to keep going.
export const setStreamEnd = (
  database: Database,
  maker: Actor,
  id: string,
  endsOn: string | null,
): Promise<Saved<ReleaseStream>> =>
  updateStream(database, maker, id, { endsOn });

// A record of a stream to change, refusing one that is not in the stream.
function inStreamRecord(
  state: RecordsState,
  type: RecordType,
  streamId: string,
  id: string,
): Recorded {
  const record = changeableRecord(state, type, id);
  if (record.streamId !== streamId) {
    throw new NotFoundError("There is no such record in this schedule");
  }
  return record;
}

export const patternRecord = (
  streamId: string,
  request: CyclePatternRequest,
) => ({
  streamId,
  startsOn: request.startsOn,
  length: request.length,
  unit: request.unit,
  naming: request.naming,
});

export const releaseRecord = (streamId: string, request: ReleaseRequest) => ({
  streamId,
  name: request.name,
  firstCycle: request.firstCycle,
  lastCycle: request.lastCycle,
  shipsOn: request.shipsOn,
  colour: request.colour,
});

// A pattern or release as changed, keeping what the request does not hold, such as a release's note.
export const changedInStream = (
  kept: Recorded,
  changed: Recorded,
): Recorded => ({ ...kept, ...changed });

// A release with the note given, kept as it is otherwise.
export const notedRelease = (
  release: Recorded,
  note: string | null,
): Recorded => ({ ...release, note });

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
    return saveRecordDraft(
      transaction,
      maker,
      state,
      changed.type,
      id,
      changedInStream(kept, record),
    );
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
    return saveRecordDraft(
      transaction,
      maker,
      state,
      "release",
      id,
      notedRelease(release, kept),
    );
  });
}

// Drafts removing a pattern or release of a stream, a release with its activities.
export const removeFromStream = (
  database: Database,
  maker: Actor,
  streamId: string,
  type: "cycle-pattern" | "release",
  id: string,
): Promise<string | null> =>
  removingWith(
    database,
    maker,
    type,
    id,
    (state) => {
      inStreamRecord(state, type, streamId, id);
    },
    (state) =>
      type === "release"
        ? activitiesOf(state, "release", id).map((activity): RecordRef => ({
            type: "release-activity",
            id: activity,
          }))
        : [],
  );

// A release's activity to change, refusing one of another release, or a release of another stream.
export function releaseActivity(
  state: RecordsState,
  streamId: string,
  releaseId: string,
  id: string,
): Recorded {
  inStreamRecord(state, "release", streamId, releaseId);
  const activity = changeableRecord(state, "release-activity", id);
  if (activity.releaseId !== releaseId) {
    throw new NotFoundError("There is no such activity in this release");
  }
  return activity;
}

// Drafts a release's activity: a new one, or a change to one of its own.
export const draftReleaseActivity = (
  database: Database,
  maker: Actor,
  streamId: string,
  releaseId: string,
  id: string | undefined,
  request: ActivityRequest,
): Promise<Saved<ReleaseStream>> =>
  changingStream(database, maker, streamId, (transaction, state) => {
    if (id === undefined) inStreamRecord(state, "release", streamId, releaseId);
    else releaseActivity(state, streamId, releaseId, id);
    return saveRecordDraft(
      transaction,
      maker,
      state,
      "release-activity",
      id ?? randomUUID(),
      activityRecord("release", releaseId, request),
    );
  });

export const removeReleaseActivity = (
  database: Database,
  maker: Actor,
  streamId: string,
  releaseId: string,
  id: string,
): Promise<string | null> =>
  removingWith(
    database,
    maker,
    "release-activity",
    id,
    (state) => {
      releaseActivity(state, streamId, releaseId, id);
    },
    () => [],
  );

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

// The drafts that move releases and features with their cycles.
const movingDrafts = (
  state: RecordsState,
  moves: readonly ReleaseMove<Planned>[],
): Wanted[] =>
  moves.map(({ release: { type, id, record }, ...to }) => {
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

const nameOf = (state: RecordsState, streamId: string): string =>
  String(shownVersion(state, "release-stream", streamId)?.name);

// Drafts one cycle's new length, with the patterns that give it, and the releases and features on
// cycles that move, moved with them, all in one change set.
export async function changeCycleLength(
  database: Database,
  maker: Actor,
  streamId: string,
  startsOn: string,
  request: CycleLengthRequest,
): Promise<Saved<ReleaseStream>> {
  return changingStream(
    database,
    maker,
    streamId,
    async (transaction, state) => {
      changeableRecord(state, "release-stream", streamId);
      const kept = streamPatterns(state, streamId);
      const patterns = kept.map(({ pattern }) => pattern);
      const endsOn = endsOnOf(state, streamId);
      const until = laidOutUntil(state, streamId, await readToday(transaction));
      const before = cyclesOf(patterns, until, endsOn);
      if (!before.some((cycle) => cycle.startsOn === startsOn)) {
        throw new NotFoundError("There is no such cycle in this schedule");
      }
      const { unit } = patterns
        .filter((pattern) => pattern.startsOn <= startsOn)
        .sort((a, b) => a.startsOn.localeCompare(b.startsOn))
        // A cycle starts on that day, so a pattern makes it.
        .at(-1) as CyclePatternLike;
      if (
        request.length > longestCycle[unit === "weeks" ? "weeks" : "months"]
      ) {
        throw new ConflictError("A cycle can be at most two years long.");
      }
      const change = cycleLengthMoves(
        {
          name: nameOf(state, streamId),
          patterns,
          cycles: before,
          until,
          endsOn,
        },
        { startsOn, ...request },
        planned(state, streamId),
        maker.permissions,
      );
      if ("problem" in change) throw new ConflictError(change.problem);
      return saveRecordDrafts(transaction, maker, state, [
        ...patternDrafts(state, streamId, kept, change.patterns),
        ...movingDrafts(state, change.moves),
      ]);
    },
  );
}
