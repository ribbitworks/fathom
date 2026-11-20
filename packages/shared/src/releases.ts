// SPDX-License-Identifier: Apache-2.0

// Release streams, their cycle patterns and their releases, with their drafts.

import { z } from "zod";
import type { Permission } from "./access.ts";
import {
  type Cycle,
  cycleUnitSchema,
  laterCyclesSchema,
  longestCycle,
  type ScheduleEnd,
} from "./cycles.ts";
import { daySchema } from "./days.ts";
import { heldBySchema, recordDraftSchema } from "./drafts.ts";
import { paletteColourSchema } from "./palette.ts";
import { keyNumberSchema } from "./record-keys.ts";

export const releaseLengths = {
  name: 40,
  naming: 40,
} as const;

// How drafts and decisions name a stream, a change of its cycles, and a release, in the server and
// the browser alike.
export const planSubjects = {
  stream: (stream: string) => `the schedule ${stream}`,
  pattern: (stream: string, startsOn: string) =>
    `the cycles of ${stream} from ${startsOn}`,
  release: (release: string, stream: string) =>
    `the release ${release} in ${stream}`,
};

export const shipsBeforeStart =
  "A release cannot ship before its first cycle starts";

const day = daySchema;

export const cycleSchema: z.ZodType<Cycle> = z.object({
  startsOn: z.string(),
  endsOn: z.string(),
  name: z.string(),
  months: z.array(z.object({ month: z.string(), share: z.number() })),
});

export const cyclePatternSchema = z.object({
  id: z.string(),
  startsOn: z.string(),
  length: z.number().int(),
  unit: cycleUnitSchema,
  naming: z.string(),
  draft: recordDraftSchema.optional(),
  heldBy: heldBySchema,
});

export type CyclePattern = z.infer<typeof cyclePatternSchema>;

export const releaseSchema = z.object({
  id: z.string(),
  keyNumber: keyNumberSchema,
  name: z.string(),
  // The days the release's first and last cycles start.
  firstCycle: z.string(),
  lastCycle: z.string(),
  // Null when the release ships at the end of its last cycle.
  shipsOn: z.string().nullable(),
  // Null when the release is shown in the default colour.
  colour: paletteColourSchema.nullable(),
  // The release's note, as Markdown, or null when it has none.
  note: z.string().nullable(),
  draft: recordDraftSchema.optional(),
  heldBy: heldBySchema,
});

export type Release = z.infer<typeof releaseSchema>;

// A stream as its draft, if any, makes it, with its patterns, its cycles as those patterns make
// them, and its releases, each as its draft makes it, by the day it starts. A draft that removes a
// record shows it as it is.
export const releaseStreamSchema = z.object({
  id: z.string(),
  keyNumber: keyNumberSchema,
  name: z.string(),
  retired: z.boolean(),
  // How far the server lays the cycles out: two years from today, or further where a record reaches.
  cyclesUntil: z.string(),
  // The stream's last day, which cuts its last cycle short, or null while it keeps going.
  endsOn: z.string().nullable(),
  patterns: z.array(cyclePatternSchema),
  cycles: z.array(cycleSchema),
  // Its cycles as they are live, where drafts of its patterns or plan change them.
  liveCycles: z.array(cycleSchema).optional(),
  releases: z.array(releaseSchema),
  draft: recordDraftSchema.optional(),
  heldBy: heldBySchema,
});

export type ReleaseStream = z.infer<typeof releaseStreamSchema>;

// Every stream, in order, with whether the user may change streams and their patterns, and
// releases.
export const releaseStreamsSchema = z.object({
  streams: z.array(releaseStreamSchema),
  canEditStreams: z.boolean(),
  canEditReleases: z.boolean(),
});

export type ReleaseStreams = z.infer<typeof releaseStreamsSchema>;

export const releaseStreamRequestSchema = z.object({
  name: z.string().trim().min(1).max(releaseLengths.name),
});

export type ReleaseStreamRequest = z.infer<typeof releaseStreamRequestSchema>;

// A schedule's last day, or null to keep going.
export const scheduleEndRequestSchema = z.object({
  endsOn: day.nullable(),
}) satisfies z.ZodType<ScheduleEnd>;

export const cyclePatternRequestSchema = z
  .object({
    startsOn: day,
    length: z.number().int().min(1),
    unit: cycleUnitSchema,
    naming: z.string().trim().min(1).max(releaseLengths.naming),
  })
  .refine(
    ({ length, unit }) =>
      length <= (unit === "weeks" ? longestCycle.weeks : longestCycle.months),
    "A cycle can be at most two years long",
  );

export type CyclePatternRequest = z.infer<typeof cyclePatternRequestSchema>;

export const releaseRequestSchema = z
  .object({
    name: z.string().trim().min(1).max(releaseLengths.name),
    firstCycle: day,
    lastCycle: day,
    shipsOn: day.nullable().default(null),
    colour: paletteColourSchema.nullable().default(null),
  })
  .refine(
    ({ firstCycle, lastCycle }) => lastCycle >= firstCycle,
    "A release's last cycle cannot come before its first",
  )
  .refine(
    ({ firstCycle, shipsOn }) => shipsOn === null || shipsOn >= firstCycle,
    shipsBeforeStart,
  );

export type ReleaseRequest = z.infer<typeof releaseRequestSchema>;

// A release's note, as Markdown, which the server checks; null or an empty note removes it.
export const releaseNoteRequestSchema = z.object({
  note: z.string().nullable(),
});

export type ReleaseNoteRequest = z.infer<typeof releaseNoteRequestSchema>;

// A new length for one cycle, in the unit of the pattern that makes it, which the server checks
// against that unit's longest cycle.
export const cycleLengthRequestSchema = z.object({
  length: z.number().int().min(1).max(longestCycle.weeks),
  later: laterCyclesSchema,
});

export type CycleLengthRequest = z.infer<typeof cycleLengthRequestSchema>;

// What a release's place among its stream's cycles depends on.
export interface ReleaseCycles {
  name: string;
  firstCycle: string;
  lastCycle: string;
  shipsOn: string | null;
}

export interface ReleaseMove<Moved extends ReleaseCycles> {
  release: Moved;
  firstCycle: string;
  lastCycle: string;
}

// Whether a refusal of a change of cycles may name the releases and features it is about, which are
// seen with View Features alone; to anyone else it says what's wrong without naming them.
export const namesPlannedWork = (permissions: readonly Permission[]) =>
  permissions.includes("features:view");

// The releases that move with their cycles when a stream's cycles change, given where each cycle
// now starts, each with the cycles it moves to; or why the change cannot be made: a release would
// include a cycle no longer made, or start after its Ships on day.
export function movedReleases<Moved extends ReleaseCycles>(
  releases: readonly Moved[],
  moved: ReadonlyMap<string, string | undefined>,
  until: string,
  stream: string,
  permissions: readonly Permission[],
): { moves: ReleaseMove<Moved>[] } | { problem: string } {
  const named = namesPlannedWork(permissions);
  const moves: ReleaseMove<Moved>[] = [];
  for (const release of releases) {
    const firstCycle = moved.get(release.firstCycle);
    const lastCycle = moved.get(release.lastCycle);
    if (firstCycle === release.firstCycle && lastCycle === release.lastCycle) {
      continue;
    }
    if (firstCycle === undefined || lastCycle === undefined) {
      return {
        problem: `${named ? release.name : "Work planned on these cycles"} would move past ${until}, the day ${stream} ends.`,
      };
    }
    if (release.shipsOn !== null && firstCycle > release.shipsOn) {
      return {
        problem: named
          ? `${release.name} would start after it ships on ${release.shipsOn}.`
          : "Work planned on these cycles would start after the day it ships.",
      };
    }
    moves.push({ release, firstCycle, lastCycle });
  }
  return { moves };
}
