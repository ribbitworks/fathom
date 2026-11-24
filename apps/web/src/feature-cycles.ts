// SPDX-License-Identifier: Apache-2.0

// The cycles a feature can target, as a table's cells hold them, and the releases those cycles are
// in, as features are grouped under them.

import type { Choice, ReleaseStream } from "@fathom/shared";
import { formatDay } from "./day-formats.ts";
import { choice } from "./lists.ts";
import {
  includesCycle,
  keptReleases,
  releaseDate,
  withSchedule,
} from "./releases.ts";

// A cycle a feature targets, as a value in a cell.
export const cycleChoiceId = (streamId: string, startsOn: string) =>
  `${streamId} ${startsOn}`;

// The stream and first day of the cycle a cell holds, each null for a feature in Later.
export function targetOf(chosen: string | undefined): {
  targetStreamId: string | null;
  targetCycle: string | null;
} {
  const [targetStreamId = null, targetCycle = null] = chosen?.split(" ") ?? [];
  return { targetStreamId, targetCycle };
}

// A stream's cycles a feature can name, by date: those of a retired stream are kept to name what
// targets them, and offered to nothing new.
function namedCycles(stream: ReleaseStream) {
  const drafted = new Set(stream.cycles.map(({ startsOn }) => startsOn));
  return [
    ...stream.cycles.map((cycle) => ({ cycle, retired: stream.retired })),
    // Cycles only as they are live are kept to name what is on them until a draft is approved.
    ...(stream.liveCycles ?? [])
      .filter(({ startsOn }) => !drafted.has(startsOn))
      .map((cycle) => ({ cycle, retired: true })),
  ].sort((a, b) => a.cycle.startsOn.localeCompare(b.cycle.startsOn));
}

// Every stream's cycles, each named with its stream, streams in their order and cycles by date.
export const cycleChoices = (streams: readonly ReleaseStream[]): Choice[] =>
  streams.flatMap((stream) =>
    namedCycles(stream).map(({ cycle, retired }) =>
      choice(
        cycleChoiceId(stream.id, cycle.startsOn),
        withSchedule(stream, cycle.name),
        retired,
      ),
    ),
  );

// Every stream's cycles' own names, by their choices.
export const cycleNames = (
  streams: readonly ReleaseStream[],
): ReadonlyMap<string, string> =>
  new Map(
    streams.flatMap((stream) =>
      namedCycles(stream).map(({ cycle }) => [
        cycleChoiceId(stream.id, cycle.startsOn),
        cycle.name,
      ]),
    ),
  );

// The release, or a stream's cycles in none, that features are grouped under, in order of rank: its
// key, which starts with its stream's, its heading, and its name.
export interface ReleaseGroup {
  key: string;
  label: string;
  rank: number;
  name: string;
}

export const releaseGroupKey = (streamId: string, releaseId: string | null) =>
  `${streamId} ${releaseId ?? "unreleased"}`;

// The stream whose release, or cycles in none, a release group's key names.
export const streamOfReleaseGroup = (key: string): string =>
  key.slice(0, key.indexOf(" "));

// The release each cycle a feature can target is in, by the cycle's choice: every stream's
// releases, streams in their order and releases by date, each named with its stream and the day it
// ships, then each stream's cycles in no release, as Not released yet.
export function releaseOfCycle(
  streams: readonly ReleaseStream[],
): Map<string, ReleaseGroup> {
  const releases = streams.flatMap((stream) =>
    keptReleases(stream)
      .sort((a, b) => a.firstCycle.localeCompare(b.firstCycle))
      .map((release) => ({ stream, release })),
  );
  const groups = new Map<string, ReleaseGroup>();
  const place = (
    stream: ReleaseStream,
    group: ReleaseGroup,
    holds: (startsOn: string) => boolean,
  ) => {
    for (const { cycle } of namedCycles(stream)) {
      const id = cycleChoiceId(stream.id, cycle.startsOn);
      if (!groups.has(id) && holds(cycle.startsOn)) groups.set(id, group);
    }
  };
  releases.forEach(({ stream, release }, rank) => {
    const shipsOn = releaseDate(stream, release);
    const name = withSchedule(stream, release.name);
    place(
      stream,
      {
        key: releaseGroupKey(stream.id, release.id),
        label:
          shipsOn === undefined ? name : `${name}, ships ${formatDay(shipsOn)}`,
        rank,
        name,
      },
      (startsOn) => includesCycle(release, startsOn),
    );
  });
  streams.forEach((stream, order) => {
    const name = withSchedule(stream, "Not released yet");
    place(
      stream,
      {
        key: releaseGroupKey(stream.id, null),
        label: name,
        rank: releases.length + order,
        name,
      },
      () => true,
    );
  });
  return groups;
}
