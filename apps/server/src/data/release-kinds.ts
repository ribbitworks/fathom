// SPDX-License-Identifier: Apache-2.0

// Release streams, their cycle patterns, their releases and the features that target their cycles,
// as kinds of the plan's records with rules of their own. Part of the data access layer.

import { cyclePatterns, features, releases, releaseStreams } from "@fathom/db";
import {
  cyclesOf,
  planSubjects,
  projectSubjects,
  type RecordRef,
} from "@fathom/shared";
import {
  type RecordKind,
  type RecordsState,
  removedByDraft,
  shownVersion,
  shownWhere,
  stateOf,
  versionOf,
} from "./record-state.ts";
import {
  cyclesChanged,
  draftsOfCycles,
  onCycles,
  patternDrafts,
  releaseFits,
  streamPatterns,
  targetAsCycles,
} from "./stream-cycles.ts";

const nameIn = (state: RecordsState, id: string): string =>
  // A stream is never removed, so what belongs to it always has one.
  String(shownVersion(state, "release-stream", id)?.name);

// A release's name, and its stream's, as shown.
export function releaseCalled(
  state: RecordsState,
  id: string,
): { name: string; stream: string } {
  const release = shownVersion(state, "release", id);
  return {
    name: String(release?.name),
    stream: nameIn(state, String(release?.streamId)),
  };
}

// Release streams and cycles are seen with features and releases, and with planning configuration.
const featuresOrConfiguration = [
  "features:view",
  "configuration:view",
] as const;

export const streamKind: RecordKind = {
  type: "release-stream",
  table: releaseStreams,
  fields: ["name", "retired", "endsOn"],
  links: {},
  unique: [
    {
      field: "name",
      message: "There is already a schedule with that name",
    },
  ],
  readWith: featuresOrConfiguration,
  unseenSubject: "a schedule",
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
      message: "This schedule already has cycles that change on that day",
    },
  ],
  readWith: featuresOrConfiguration,
  unseenSubject: "a change of a schedule's cycles",
  subject: (state, id) => {
    const pattern = shownVersion(state, "cycle-pattern", id);
    return planSubjects.pattern(
      nameIn(state, String(pattern?.streamId)),
      String(pattern?.startsOn),
    );
  },
  // A stream's drafts of its cycles, and of its releases' cycles, are decided together, so a
  // pattern's draft uses the others' in its stream, and the drafts that move its live releases and
  // features to other cycles, or remove one its drafted cycles no longer make.
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
      message: "This schedule already has a release with that name",
    },
  ],
  // Releases themselves are seen with features, not with planning configuration, as Roles sets out.
  readWith: ["features:view"],
  unseenSubject: "a release",
  subject: (state, id) => {
    const { name, stream } = releaseCalled(state, id);
    return planSubjects.release(name, stream);
  },
  // A release drafted onto other cycles, or onto cycles only the stream's drafted patterns make,
  // uses those patterns' drafts.
  // A release drafted to be removed uses the removals of its activities, which go with it.
  alsoUses: (state, id) => {
    const release = versionOf(state, "release", id);
    if (release === undefined) {
      return shownWhere(state, "release-activity", "releaseId", id)
        .filter((activity) =>
          removedByDraft(state, "release-activity", activity),
        )
        .map((activity): RecordRef => ({
          type: "release-activity",
          id: activity,
        }));
    }
    return draftsOfCycles(
      state,
      release,
      stateOf(state, "release").live.get(id),
    );
  },
};

export const featureCalled = (state: RecordsState, id: string): string =>
  String(shownVersion(state, "feature", id)?.name);

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
  addedColumns: { owner: "feature", table: "features" },
  changedTogether: ["targetStreamId", "targetCycle"],
  unique: [
    { field: "name", message: "There is already a feature with that name" },
  ],
  readWith: ["features:view"],
  unseenSubject: "a feature",
  subject: (state, id) => projectSubjects.feature(featureCalled(state, id)),
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
