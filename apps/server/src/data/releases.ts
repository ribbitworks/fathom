// SPDX-License-Identifier: Apache-2.0

// Release streams, their cycle patterns, and their releases: reading them as the viewer sees them,
// each stream with its cycles worked out from its patterns, and drafting streams added, renamed,
// retired, and restored, patterns and releases added, changed, and removed. Part of the data access
// layer; the caller checks the actor's permissions. Every change is a draft of a plan record, as
// records.ts sets out, with the rules release-kinds.ts sets.

import type { Database } from "@fathom/db";
import {
  cyclesOf,
  horizonFrom,
  type CyclePattern,
  type CyclePatternRequest,
  type Release,
  type ReleaseRequest,
  type ReleaseStream,
  type ReleaseStreamRequest,
  type RecordType,
} from "@fathom/shared";
import { randomUUID } from "node:crypto";
import { NotFoundError } from "../errors.ts";
import type { Saved } from "./changes.ts";
import type { Recorded } from "./drafts.ts";
import {
  addedOnly,
  type RecordsState,
  shownIds,
  shownVersion,
  stateOf,
} from "./record-state.ts";
import {
  changeableRecord,
  discardRecordDraft,
  drafting,
  kindOf,
  type Makers,
  readRecordMakers,
  readRecordsState,
  recordDraftOut,
  recordHeldBy,
  saveRecordDraft,
} from "./records.ts";
import { cyclesUntilOf, streamPatterns } from "./release-kinds.ts";
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
      ...extras(state, makers, "release", releaseId),
    }),
  );
  return {
    id,
    name: String(stream.name),
    retired: stream.retired === true,
    cyclesUntil: String(stream.cyclesUntil),
    patterns,
    cycles: cyclesOf(
      streamPatterns(state, id).map(({ pattern }) => pattern),
      cyclesUntilOf(state, id),
    ),
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

// Every stream as the viewer sees it, with its patterns, cycles, and releases.
export async function readReleaseStreams(
  database: Database,
  viewer: string,
): Promise<ReleaseStream[]> {
  // Read as of one moment, so an approval saved meanwhile is seen whole or not at all.
  return database.transaction(
    async (transaction) => {
      const state = await readRecordsState(transaction, viewer);
      return streamsOut(
        state,
        await readRecordMakers(transaction, state, viewer),
      );
    },
    { isolationLevel: "repeatable read", accessMode: "read only" },
  );
}

// Runs a change to a stream or what belongs to it, and answers with the stream as the editor now
// sees it.
async function changingStream(
  database: Database,
  editor: string,
  streamId: string,
  change: (
    transaction: Parameters<Parameters<typeof drafting>[2]>[0],
    state: RecordsState,
  ) => Promise<string | null>,
): Promise<Saved<ReleaseStream>> {
  return drafting(database, editor, async (transaction, state) => {
    const changeSetId = await change(transaction, state);
    const now = await readRecordsState(transaction, editor);
    return {
      result: streamOut(
        now,
        await readRecordMakers(transaction, now, editor),
        streamId,
      ),
      changeSetId,
    };
  });
}

// A stream's cycles are made until two years from the day it is drafted.
export async function createStream(
  database: Database,
  editor: string,
  request: ReleaseStreamRequest,
  asOf?: string,
): Promise<Saved<ReleaseStream>> {
  const today = asOf ?? (await readToday(database));
  const id = randomUUID();
  return changingStream(database, editor, id, (transaction, state) =>
    saveRecordDraft(transaction, editor, state, "release-stream", id, {
      name: request.name,
      retired: false,
      cyclesUntil: horizonFrom(today),
    }),
  );
}

export async function updateStream(
  database: Database,
  editor: string,
  id: string,
  change: Partial<{ name: string; retired: boolean; cyclesUntil: string }>,
): Promise<Saved<ReleaseStream>> {
  return changingStream(database, editor, id, (transaction, state) => {
    const stream = changeableRecord(state, "release-stream", id);
    return saveRecordDraft(transaction, editor, state, "release-stream", id, {
      ...stream,
      ...change,
    });
  });
}

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
});

// Drafts adding a pattern or release to a stream.
export async function addToStream(
  database: Database,
  editor: string,
  streamId: string,
  added:
    | { type: "cycle-pattern"; request: CyclePatternRequest }
    | { type: "release"; request: ReleaseRequest },
): Promise<Saved<ReleaseStream>> {
  // Saving refuses a stream that does not exist, as it does any link to a record.
  return changingStream(database, editor, streamId, (transaction, state) => {
    const record =
      added.type === "cycle-pattern"
        ? patternRecord(streamId, added.request)
        : releaseRecord(streamId, added.request);
    return saveRecordDraft(
      transaction,
      editor,
      state,
      added.type,
      randomUUID(),
      record,
    );
  });
}

// Drafts a change to a pattern or release of a stream.
export async function changeInStream(
  database: Database,
  editor: string,
  streamId: string,
  id: string,
  changed:
    | { type: "cycle-pattern"; request: CyclePatternRequest }
    | { type: "release"; request: ReleaseRequest },
): Promise<Saved<ReleaseStream>> {
  return changingStream(database, editor, streamId, (transaction, state) => {
    inStreamRecord(state, changed.type, streamId, id);
    const record =
      changed.type === "cycle-pattern"
        ? patternRecord(streamId, changed.request)
        : releaseRecord(streamId, changed.request);
    return saveRecordDraft(
      transaction,
      editor,
      state,
      changed.type,
      id,
      record,
    );
  });
}

// Drafts removing a pattern or release of a stream; removing one only drafted to be added discards
// its draft.
export async function removeFromStream(
  database: Database,
  editor: string,
  streamId: string,
  type: "cycle-pattern" | "release",
  id: string,
): Promise<string | null> {
  const discards = await drafting(database, editor, (_transaction, state) => {
    inStreamRecord(state, type, streamId, id);
    return Promise.resolve(addedOnly(state, type, id));
  });
  if (discards) return discardRecordDraft(database, editor, type, id);
  return (
    await changingStream(database, editor, streamId, (transaction, state) => {
      inStreamRecord(state, type, streamId, id);
      return saveRecordDraft(transaction, editor, state, type, id, undefined);
    })
  ).changeSetId;
}
