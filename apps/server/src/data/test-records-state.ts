// SPDX-License-Identifier: Apache-2.0

// The plan's records held in memory for unit tests of the rules that read them, and fictional
// streams, cycle patterns, releases and features to fill them with.

import type { Draft, Recorded } from "./draft-records.ts";
import type { KindState, RecordsState } from "./record-state.ts";

export const draft = (
  action: Draft["action"],
  fields: Recorded = {},
): Draft => ({
  action,
  fields,
  state: "waiting",
  reason: null,
  sequence: 1,
});

export const kindState = (
  live: [string, Recorded][] = [],
  drafts: [string, Draft][] = [],
  held: KindState["held"] = new Map(),
): KindState => ({
  live: new Map(live),
  rows: new Map(live),
  drafts: new Map(drafts),
  held,
  // Each record numbered in the order given, live ones first.
  keys: new Map(
    [...new Set([...live, ...drafts].map(([id]) => id))].map((id, index) => [
      id,
      index + 1,
    ]),
  ),
});

export const recordsState = (parts: Partial<RecordsState>): RecordsState => ({
  "release-stream": kindState(),
  "cycle-pattern": kindState(),
  release: kindState(),
  feature: kindState(),
  customer: kindState(),
  proposal: kindState(),
  project: kindState(),
  milestone: kindState(),
  activity: kindState(),
  allocation: kindState(),
  "planning-settings": kindState(),
  ...parts,
});

// A cycle pattern's fields for cycles in quarters, the first starting on the first of January 2027.
export const quarters = {
  startsOn: "2027-01-01",
  length: 3,
  unit: "months",
  naming: "{YY}.{N}",
} as const;

export const stream = "stream-1";
export const otherStream = "stream-2";

export const schedule = (fields: Recorded = {}): Recorded => ({
  name: "Fictional Stream",
  retired: false,
  endsOn: null,
  ...fields,
});

export const pattern = (fields: Recorded = {}): Recorded => ({
  streamId: stream,
  ...quarters,
  ...fields,
});

export const release = (
  name: string,
  firstCycle: string,
  lastCycle = firstCycle,
  streamId = stream,
): Recorded => ({ streamId, name, firstCycle, lastCycle });

// A feature targeting a cycle of a stream, or, with neither, planned for Later.
export const feature = (
  targetCycle: string | null,
  targetStreamId: string | null = stream,
): Recorded => ({ name: "Fictional Feature", targetStreamId, targetCycle });

export const patternId = "pattern-1";
export const otherPatternId = "pattern-2";

// Two live streams with cycles in quarters from 2027, the first ending on the day given, if any,
// and the drafts of their patterns given.
export const twoStreams = ({
  endsOn = null,
  patternDrafts = [],
}: {
  endsOn?: string | null;
  patternDrafts?: [string, Draft][];
} = {}): Pick<RecordsState, "release-stream" | "cycle-pattern"> => ({
  "release-stream": kindState([
    [stream, schedule({ endsOn })],
    [otherStream, schedule({ name: "Fictional Other Stream" })],
  ]),
  "cycle-pattern": kindState(
    [
      [patternId, pattern()],
      [otherPatternId, pattern({ streamId: otherStream })],
    ],
    patternDrafts,
  ),
});
