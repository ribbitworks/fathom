// SPDX-License-Identifier: Apache-2.0

// A release stream as a reader sees it: its patterns, releases and cycles as drafts make them,
// laid out from today, with releases only for a reader who may read them.

import {
  cyclesOf,
  knownColour,
  type CyclePattern,
  type Permission,
  type Release,
  type ReleaseStream,
  type RecordType,
} from "@fathom/shared";
import type { Recorded } from "./draft-records.ts";
import {
  readsKind,
  type RecordsState,
  shownIds,
  shownVersion,
  stateOf,
} from "./record-state.ts";
import { type Makers, recordExtras, recordKeyNumber } from "./records.ts";
import { releaseKind } from "./release-kinds.ts";
import {
  endsOnIn,
  laidOutUntil,
  livePatterns,
  streamPatterns,
} from "./stream-cycles.ts";

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

// A schedule as the viewer sees it, its cycles laid out until two years from today, or as far as
// anything on them reaches.
export function streamOut(
  state: RecordsState,
  makers: Makers,
  id: string,
  today: string,
): ReleaseStream {
  const stream = shownVersion(state, "release-stream", id) as Recorded;
  const patterns = inStream(state, "cycle-pattern", id, "startsOn").map(
    ({ id: patternId, record }): CyclePattern => ({
      id: patternId,
      startsOn: String(record.startsOn),
      length: Number(record.length),
      unit: record.unit === "weeks" ? "weeks" : "months",
      naming: String(record.naming),
      ...recordExtras(state, makers, "cycle-pattern", patternId),
    }),
  );
  const releases = inStream(state, "release", id, "firstCycle").map(
    ({ id: releaseId, record }): Release => ({
      id: releaseId,
      keyNumber: recordKeyNumber(state, "release", releaseId),
      name: String(record.name),
      firstCycle: String(record.firstCycle),
      lastCycle: String(record.lastCycle),
      shipsOn: typeof record.shipsOn === "string" ? record.shipsOn : null,
      colour: knownColour(record.colour),
      note: typeof record.note === "string" ? record.note : null,
      ...recordExtras(state, makers, "release", releaseId),
    }),
  );
  const cyclesUntil = laidOutUntil(state, id, today);
  const endsOn = endsOnIn(stream);
  const cycles = cyclesOf(
    streamPatterns(state, id).map(({ pattern }) => pattern),
    cyclesUntil,
    endsOn,
  );
  const liveCycles = cyclesOf(
    livePatterns(state, id),
    cyclesUntil,
    endsOnIn(stateOf(state, "release-stream").live.get(id) ?? stream),
  );
  return {
    id,
    keyNumber: recordKeyNumber(state, "release-stream", id),
    name: String(stream.name),
    retired: stream.retired === true,
    cyclesUntil,
    endsOn,
    patterns,
    cycles,
    ...(JSON.stringify(liveCycles) === JSON.stringify(cycles)
      ? {}
      : { liveCycles }),
    releases,
    ...recordExtras(state, makers, "release-stream", id),
  };
}

// Every stream, in their order, then those drafted to be added, in the order drafted.
export function streamsOut(
  state: RecordsState,
  makers: Makers,
  today: string,
): ReleaseStream[] {
  const { rows } = stateOf(state, "release-stream");
  const placeOf = (id: string) =>
    Number(rows.get(id)?.position ?? Number.MAX_SAFE_INTEGER);
  return shownIds(state, "release-stream")
    .map((id, drafted) => ({ id, place: placeOf(id), drafted }))
    .sort((a, b) => a.place - b.place || a.drafted - b.drafted)
    .map(({ id }) => streamOut(state, makers, id, today));
}

// A stream as a reader may see it, its releases only to those who may read releases, as the
// release kind sets out.
export const streamAsSeen =
  (permissions: readonly Permission[]) =>
  (stream: ReleaseStream): ReleaseStream =>
    readsKind(releaseKind, permissions) ? stream : { ...stream, releases: [] };
