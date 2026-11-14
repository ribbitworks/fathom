// SPDX-License-Identifier: Apache-2.0

// Release streams, their cycle patterns, their releases, and the features that target their cycles,
// as kinds of the plan's records, with the rules the Decisions Log sets for them: a stream's later
// patterns start on the start of one of its cycles, so the cycles before keep their names and
// dates; a release includes consecutive cycles of its stream, from its first to its last, which no
// other release in the stream includes, and none starting after the stream's cycles-until date; and
// a feature targets one of its stream's cycles. Part of the data access layer; records.ts checks
// the rules when a change is drafted or published, against the records as the editor sees them, and
// when drafts are approved, against the live records.

import { cyclePatterns, features, releases, releaseStreams } from "@fathom/db";
import {
  type Cycle,
  type CyclePatternLike,
  cycleUnitSchema,
  cyclesOf,
  patternStartFits,
  planSubjects,
  projectSubjects,
  type RecordRef,
} from "@fathom/shared";
import type { Recorded } from "./drafts.ts";
import {
  type RecordKind,
  type RecordsState,
  type Touched,
  shownIds,
  shownVersion,
  stateOf,
  versionOf,
} from "./record-state.ts";

const nameIn = (state: RecordsState, id: string): string =>
  // A stream is never removed, so what belongs to it always has one.
  String(shownVersion(state, "release-stream", id)?.name);

// A feature's target as a release on that one cycle, so a release's rules for cycles hold for it.
const targetAsCycles = (feature: Recorded): Recorded => ({
  streamId: feature.targetStreamId,
  firstCycle: feature.targetCycle,
  lastCycle: feature.targetCycle,
});

// The kinds of record on a stream's cycles, each as a release's cycles, with how each is refused:
// when it is past the stream's plan, when a change of the stream's cycles leaves it off them, and
// when the cycles asked for are not the stream's.
const onCycles = [
  {
    type: "release",
    cycles: (release: Recorded) => release,
    afterPlan: (name: string) =>
      `The release ${name} includes cycles after that day; change it first`,
    offCycles: (name: string) =>
      `The release ${name} would no longer start and end with cycles of its stream; change it first`,
    notOfStream: "Choose a first and last cycle of the release's stream",
  },
  {
    type: "feature",
    cycles: targetAsCycles,
    afterPlan: (name: string) =>
      `The feature ${name} targets a cycle after that day; change it first`,
    offCycles: (name: string) =>
      `The feature ${name} would no longer target a cycle of its stream; change it first`,
    notOfStream: "Choose a cycle of the feature's stream",
  },
] as const;

// Release streams and cycles are seen with features and releases, and with planning configuration.
const featuresOrConfiguration = [
  "features:view",
  "configuration:view",
] as const;

export const streamKind: RecordKind = {
  type: "release-stream",
  table: releaseStreams,
  fields: ["name", "retired", "cyclesUntil"],
  links: {},
  unique: [
    {
      field: "name",
      message: "There is already a release stream with that name",
    },
  ],
  readWith: featuresOrConfiguration,
  subject: (state, id) => planSubjects.stream(nameIn(state, id)),
  // A stream added goes at the end of the order.
  added: (rows) => ({
    position:
      Math.max(
        0,
        ...[...rows.values()].map(({ position }) => Number(position)),
      ) + 1,
  }),
};

export const patternKind: RecordKind = {
  type: "cycle-pattern",
  table: cyclePatterns,
  fields: ["streamId", "startsOn", "length", "unit", "naming"],
  links: { streamId: "release-stream" },
  belongsTo: "streamId",
  unique: [
    {
      field: "startsOn",
      within: "streamId",
      message: "This stream already has cycles that change on that day",
    },
  ],
  readWith: featuresOrConfiguration,
  subject: (state, id) => {
    const pattern = shownVersion(state, "cycle-pattern", id);
    return planSubjects.pattern(
      nameIn(state, String(pattern?.streamId)),
      String(pattern?.startsOn),
    );
  },
  // A stream's drafts of its cycles, and of its releases' cycles, are decided together, as the
  // Decisions Log sets out, so a pattern's draft uses the others' in its stream, and the drafts
  // that move its live releases and features to other cycles, or remove one its drafted cycles no
  // longer make.
  alsoUses: (state, id) => {
    const streamId = String(shownVersion(state, "cycle-pattern", id)?.streamId);
    const drafted = streamPatterns(state, streamId).map(
      ({ pattern }) => pattern,
    );
    const moved = onCycles.flatMap(({ type, cycles }) =>
      [...stateOf(state, type).drafts.keys()].flatMap(
        (recordId): RecordRef[] => {
          const liveRecord = stateOf(state, type).live.get(recordId);
          if (liveRecord === undefined) return [];
          const live = cycles(liveRecord);
          const version = versionOf(state, type, recordId);
          const staying =
            version !== undefined && cycles(version).streamId === streamId;
          const bound = staying
            ? cyclesChanged(cycles(version), live)
            : live.streamId === streamId &&
              !releaseFits(cyclesOf(drafted, String(live.lastCycle)), live);
          return bound ? [{ type, id: recordId }] : [];
        },
      ),
    );
    return [
      ...patternDrafts(state, streamId).filter((pattern) => pattern.id !== id),
      ...moved,
    ];
  },
};

export const releaseKind: RecordKind = {
  type: "release",
  table: releases,
  fields: [
    "streamId",
    "name",
    "firstCycle",
    "lastCycle",
    "shipsOn",
    "colour",
    "note",
  ],
  links: { streamId: "release-stream" },
  belongsTo: "streamId",
  unique: [
    {
      field: "name",
      within: "streamId",
      message: "This stream already has a release with that name",
    },
  ],
  // Releases themselves are seen with features, not with planning configuration, as Roles sets out.
  readWith: ["features:view"],
  subject: (state, id) => {
    const release = shownVersion(state, "release", id);
    return planSubjects.release(
      String(release?.name),
      nameIn(state, String(release?.streamId)),
    );
  },
  // A release drafted onto other cycles, or onto cycles only the stream's drafted patterns make,
  // uses those patterns' drafts.
  alsoUses: (state, id) => {
    const release = versionOf(state, "release", id);
    if (release === undefined) return [];
    return draftsOfCycles(
      state,
      release,
      stateOf(state, "release").live.get(id),
    );
  },
};

// Whether a feature is a project's general feature, which exists only live, made and removed as
// its project is approved, and stays off every roadmap.
const generalForProject = (state: RecordsState, id: string): unknown =>
  stateOf(state, "feature").rows.get(id)?.generalForProjectId;

export const isGeneralFeature = (state: RecordsState, id: string): boolean =>
  typeof generalForProject(state, id) === "string";

// A feature's name as shown, a project's general feature taking its project's.
export function featureCalled(state: RecordsState, id: string): string {
  const project = generalForProject(state, id);
  return String(
    typeof project === "string"
      ? shownVersion(state, "project", project)?.name
      : shownVersion(state, "feature", id)?.name,
  );
}

export const projectSubject = (state: RecordsState, id: string): string =>
  projectSubjects.project(String(shownVersion(state, "project", id)?.name));

// A feature's stream is the one it targets, so a target cycle's stream cannot be removed.
export const featureKind: RecordKind = {
  type: "feature",
  table: features,
  fields: [
    "name",
    "statusId",
    "priorityId",
    "sizeId",
    "riskId",
    "neededBy",
    "customerIds",
    "targetStreamId",
    "targetCycle",
    "estimateHours",
    "featureTeamId",
    "description",
    "note",
  ],
  links: { targetStreamId: "release-stream", customerIds: "customer" },
  refers: {
    featureTeamId: "feature-team",
    statusId: "choice",
    priorityId: "choice",
    sizeId: "choice",
    riskId: "choice",
  },
  keptByFathom: (state, id) => isGeneralFeature(state, id),
  addedColumns: { owner: "feature", table: "features" },
  changedTogether: ["targetStreamId", "targetCycle"],
  unique: [
    { field: "name", message: "There is already a feature with that name" },
  ],
  readWith: ["features:view"],
  subject: (state, id) =>
    (isGeneralFeature(state, id)
      ? projectSubjects.project
      : projectSubjects.feature)(featureCalled(state, id)),
  // A feature drafted onto another cycle, or onto one only the stream's drafted patterns make, uses
  // those patterns' drafts, as a release does.
  alsoUses: (state, id) => {
    const feature = versionOf(state, "feature", id);
    if (feature === undefined || feature.targetStreamId === null) return [];
    const live = stateOf(state, "feature").live.get(id);
    return draftsOfCycles(
      state,
      targetAsCycles(feature),
      live === undefined ? undefined : targetAsCycles(live),
    );
  },
};

export const releaseKinds = [streamKind, patternKind, releaseKind] as const;

// A pattern as the cycles are worked out from it.
const asPattern = (record: Recorded): CyclePatternLike => ({
  startsOn: String(record.startsOn),
  length: Number(record.length),
  unit: cycleUnitSchema.catch("months").parse(record.unit),
  naming: String(record.naming),
});

const patternIds = (state: RecordsState, streamId: string) =>
  shownIds(state, "cycle-pattern").filter(
    (id) => shownVersion(state, "cycle-pattern", id)?.streamId === streamId,
  );

const patternDrafts = (state: RecordsState, streamId: string): RecordRef[] =>
  patternIds(state, streamId)
    .filter((id) => stateOf(state, "cycle-pattern").drafts.has(id))
    .map((id) => ({ type: "cycle-pattern", id }));

// A stream's patterns as their drafts make them, those drafted to be removed left out.
export function streamPatterns(
  state: RecordsState,
  streamId: string,
): { id: string; pattern: CyclePatternLike }[] {
  return patternIds(state, streamId).flatMap((id) => {
    const version = versionOf(state, "cycle-pattern", id);
    return version === undefined ? [] : [{ id, pattern: asPattern(version) }];
  });
}

export function livePatterns(
  state: RecordsState,
  streamId: string,
): CyclePatternLike[] {
  return [...state["cycle-pattern"].live.values()]
    .filter((pattern) => pattern.streamId === streamId)
    .map(asPattern);
}

// The records of a kind on a stream's cycles as their drafts make them, those drafted to be removed
// left out.
const onStream = (
  state: RecordsState,
  type: (typeof onCycles)[number]["type"],
  streamId: string,
  cycles: (record: Recorded) => Recorded,
): { id: string; record: Recorded }[] =>
  shownIds(state, type).flatMap((id) => {
    const record = versionOf(state, type, id);
    return record !== undefined && cycles(record).streamId === streamId
      ? [{ id, record }]
      : [];
  });

// The features that target a stream's cycles, as their drafts make them.
export const streamFeatures = (state: RecordsState, streamId: string) =>
  onStream(state, "feature", streamId, targetAsCycles);

// A stream's releases as their drafts make them, in the order of their cycles, those drafted to be
// removed left out.
export function streamReleases(
  state: RecordsState,
  streamId: string,
): { id: string; release: Recorded }[] {
  return onStream(state, "release", streamId, (release) => release)
    .map(({ id, record }) => ({ id, release: record }))
    .sort((a, b) =>
      String(a.release.firstCycle).localeCompare(String(b.release.firstCycle)),
    );
}

// The day a stream's cycles are made until, as its draft, if any, makes it.
export const cyclesUntilOf = (state: RecordsState, streamId: string): string =>
  // A stream is never removed, so what belongs to it always has one.
  String(versionOf(state, "release-stream", streamId)?.cyclesUntil);

// Whether a release's first and last cycles are cycles of its stream, in order.
function releaseFits(cycles: readonly Cycle[], release: Recorded): boolean {
  const starts = new Set(cycles.map(({ startsOn }) => startsOn));
  return (
    starts.has(String(release.firstCycle)) &&
    starts.has(String(release.lastCycle)) &&
    String(release.firstCycle) <= String(release.lastCycle)
  );
}

const cyclesChanged = (version: Recorded, live: Recorded) =>
  version.streamId !== live.streamId ||
  version.firstCycle !== live.firstCycle ||
  version.lastCycle !== live.lastCycle;

// The drafts of a stream's cycles that a record's draft uses: those of its stream when it moves to
// other cycles, or, when added, is on a cycle only those drafts make.
function draftsOfCycles(
  state: RecordsState,
  version: Recorded,
  live: Recorded | undefined,
): RecordRef[] {
  const streamId = String(version.streamId);
  const bound =
    live === undefined
      ? !releaseFits(
          cyclesOf(livePatterns(state, streamId), String(version.lastCycle)),
          version,
        )
      : cyclesChanged(version, live);
  return bound ? patternDrafts(state, streamId) : [];
}

const overlaps = (first: Recorded, second: Recorded) =>
  String(first.firstCycle) <= String(second.lastCycle) &&
  String(second.firstCycle) <= String(first.lastCycle);

// The stream a touched record belongs to, or is.
const streamOf = ({ type, id, record }: Touched): string =>
  type === "release-stream"
    ? id
    : String(record.streamId ?? record.targetStreamId);

// The first way the records break the rules for streams' cycles and releases, in the streams the
// touched records belong to, or undefined when they keep them. A release breaks them only if it is
// touched, or a pattern in its stream is, so a change is not refused for a problem it did not make.
export function releaseProblem(
  state: RecordsState,
  touched: readonly Touched[],
): string | undefined {
  const streams = new Set(touched.map(streamOf));
  for (const streamId of streams) {
    const patterns = streamPatterns(state, streamId);
    const patternTouched = touched.some(
      (ref) => ref.type === "cycle-pattern" && streamOf(ref) === streamId,
    );
    const streamTouched = touched.some(
      (ref) => ref.type === "release-stream" && ref.id === streamId,
    );
    for (const [at, { pattern }] of patterns.entries()) {
      const others = patterns
        .filter((_, index) => index !== at)
        .map((other) => other.pattern);
      const earliest = others.every(
        (other) => pattern.startsOn < other.startsOn,
      );
      if (!earliest && !patternStartFits(others, pattern.startsOn)) {
        return "Cycles can change only from the start of one of the stream's cycles";
      }
    }
    const found = streamReleases(state, streamId);
    const until = cyclesUntilOf(state, streamId);
    const cycles = cyclesOf(
      patterns.map(({ pattern }) => pattern),
      until,
    );
    for (const { type, cycles: asCycles, ...refusals } of onCycles) {
      for (const { id, record } of onStream(state, type, streamId, asCycles)) {
        const recordTouched = touched.some(
          (ref) => ref.type === type && ref.id === id,
        );
        if (!patternTouched && !streamTouched && !recordTouched) continue;
        const name = String(record.name);
        const own = asCycles(record);
        if (streamTouched && String(own.lastCycle) > until) {
          return refusals.afterPlan(name);
        }
        if (!releaseFits(cycles, own)) {
          return patternTouched
            ? refusals.offCycles(name)
            : refusals.notOfStream;
        }
        if (type !== "release") continue;
        const clash = found.find(
          (other) => other.id !== id && overlaps(record, other.release),
        );
        if (clash !== undefined) {
          return `The release ${String(clash.release.name)} already includes some of those cycles`;
        }
      }
    }
  }
  return undefined;
}
