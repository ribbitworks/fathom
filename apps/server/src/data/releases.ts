// SPDX-License-Identifier: Apache-2.0

// Release streams, their cycle patterns and their releases: reading them as the viewer sees them,
// and drafting changes to them. Part of the data access layer; the caller checks the actor's
// permissions.

import type { Database } from "@fathom/db";
import type {
  CycleLengthRequest,
  CyclePatternRequest,
  ReleaseRequest,
  ReleaseStream,
  ReleaseStreamRequest,
  RecordType,
} from "@fathom/shared";
import { randomUUID } from "node:crypto";
import type { Actor } from "../access.ts";
import { ConflictError, NotFoundError } from "../errors.ts";
import type { Saved } from "./changes.ts";
import { cycleLengthChange } from "./cycle-length-change.ts";
import type { Recorded } from "./draft-records.ts";
import { addedOnly, type RecordsState } from "./record-state.ts";
import {
  changeableRecord,
  drafting,
  saveRecordDraft,
  saveRecordDrafts,
} from "./record-drafting.ts";
import { discardRecordDraft } from "./record-decisions.ts";
import { keptNote, readRecordMakers, readRecordsState } from "./records.ts";
import { streamAsSeen, streamOut, streamsOut } from "./release-stream-view.ts";
import { readToday } from "./settings.ts";

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
      ).map(streamAsSeen(viewer));
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
      result: streamAsSeen(editor)(
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

// Drafts removing a pattern or release of a stream; removing one only drafted to be added discards
// its draft, as records.ts discards drafts.
export async function removeFromStream(
  database: Database,
  maker: Actor,
  streamId: string,
  type: "cycle-pattern" | "release",
  id: string,
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
    return discardRecordDraft(database, maker, type, id);
  }
  return (
    await changingStream(database, maker, streamId, (transaction, state) => {
      inStreamRecord(state, type, streamId, id);
      return saveRecordDraft(transaction, maker, state, type, id, undefined);
    })
  ).changeSetId;
}

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
      const change = cycleLengthChange(state, streamId, startsOn, request, {
        today: await readToday(transaction),
        permissions: maker.permissions,
        newId: randomUUID,
      });
      if ("missing" in change) throw new NotFoundError(change.missing);
      if ("refusal" in change) throw new ConflictError(change.refusal);
      return saveRecordDrafts(transaction, maker, state, change.drafts);
    },
  );
}
