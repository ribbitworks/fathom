// SPDX-License-Identifier: Apache-2.0

// Release streams, their cycle patterns, and their releases through the server's API: reading them,
// with their cycles and drafts, every change to them, each a draft, and discarding the drafts of
// the plan's records or sending rejected ones for approval again; with each record as decisions on
// its draft name it.

import {
  changeSetIdSchema,
  type Cycle,
  type CycleLengthRequest,
  type CyclePatternRequest,
  cyclesOf,
  movedCycles,
  movedReleases,
  patternsForLength,
  planSubjects,
  type RecordRef,
  knownColour,
  type PaletteColour,
  type ReleaseRequest,
  type ReleaseStream,
  releaseStreamSchema,
  releaseStreamsSchema,
  savedSchema,
} from "@fathom/shared";
import { queryOptions } from "@tanstack/react-query";
import type { CSSProperties } from "react";
import { z } from "zod";
import { getJson, sendDeleteFor, sendJsonFor } from "./api.ts";
import { colourVariable, colourWords } from "./colours.ts";
import { type RecordNode, recordNode } from "./record-drafts.ts";

export const releaseStreamsQuery = queryOptions({
  queryKey: ["release-streams"],
  queryFn: async () => getJson("/api/release-streams", releaseStreamsSchema),
});

const streamPath = (id: string) =>
  `/api/release-streams/${encodeURIComponent(id)}`;
const streamResponse = z.object({
  stream: releaseStreamSchema,
  changeSetId: changeSetIdSchema,
});

export type SavedStream = z.infer<typeof streamResponse>;

export const createStream = (name: string): Promise<SavedStream> =>
  sendJsonFor("POST", "/api/release-streams", { name }, streamResponse);

export const renameStream = (id: string, name: string): Promise<SavedStream> =>
  sendJsonFor("PUT", streamPath(id), { name }, streamResponse);

export const setStreamRetired = (
  id: string,
  retired: boolean,
): Promise<SavedStream> =>
  sendJsonFor("PUT", `${streamPath(id)}/retired`, { retired }, streamResponse);

export const setCyclesUntil = (
  id: string,
  cyclesUntil: string,
): Promise<SavedStream> =>
  sendJsonFor(
    "PUT",
    `${streamPath(id)}/cycles-until`,
    { cyclesUntil },
    streamResponse,
  );

type Member = "patterns" | "releases";

const memberPath = (streamId: string, member: Member, id?: string) =>
  `${streamPath(streamId)}/${member}${id === undefined ? "" : `/${encodeURIComponent(id)}`}`;

// Adds a pattern or release to a stream, or, given its id, changes it.
export function savePattern(
  streamId: string,
  request: CyclePatternRequest,
  id?: string,
): Promise<SavedStream> {
  return sendJsonFor(
    id === undefined ? "POST" : "PUT",
    memberPath(streamId, "patterns", id),
    request,
    streamResponse,
  );
}

export function saveRelease(
  streamId: string,
  request: ReleaseRequest,
  id?: string,
): Promise<SavedStream> {
  return sendJsonFor(
    id === undefined ? "POST" : "PUT",
    memberPath(streamId, "releases", id),
    request,
    streamResponse,
  );
}

// Drafts a release's note; an empty one removes it.
export const saveReleaseNote = (
  streamId: string,
  id: string,
  note: string,
): Promise<SavedStream> =>
  sendJsonFor(
    "PUT",
    `${memberPath(streamId, "releases", id)}/note`,
    { note: note === "" ? null : note },
    streamResponse,
  );

// Drafts removing a pattern or release; removing one only drafted to be added discards it.
export async function removeFromStream(
  streamId: string,
  member: Member,
  id: string,
): Promise<string | null> {
  return (await sendDeleteFor(memberPath(streamId, member, id), savedSchema))
    .changeSetId;
}

// Drafts one cycle's new length, which moves the releases on cycles that move.
export const changeCycleLength = (
  streamId: string,
  startsOn: string,
  request: CycleLengthRequest,
): Promise<SavedStream> =>
  sendJsonFor(
    "PUT",
    `${streamPath(streamId)}/cycles/${encodeURIComponent(startsOn)}/length`,
    request,
    streamResponse,
  );

// What a new length for one cycle makes of its stream, as the server would draft it: the cycles
// from that one on, the names of the releases that move with their cycles, the new ship dates of
// releases that ship when their last cycle ends, and why it cannot be made, if it cannot. Cycles
// the length cannot make are shown as they are now.
export function lengthChangeOf(
  stream: ReleaseStream,
  startsOn: string,
  request: CycleLengthRequest,
): {
  cycles: Cycle[];
  moved: string[];
  ships: { name: string; on: string }[];
  problem?: string;
} {
  const from = (cycles: readonly Cycle[]) =>
    cycles.filter((cycle) => cycle.startsOn >= startsOn);
  const made = patternsForLength(
    stream.patterns.filter(({ draft }) => draft?.action !== "deleted"),
    { startsOn, ...request },
  );
  if ("problem" in made) {
    return {
      cycles: from(stream.cycles),
      moved: [],
      ships: [],
      problem: made.problem,
    };
  }
  const cycles = cyclesOf(made.patterns, stream.cyclesUntil);
  const kept = stream.releases.filter(
    ({ draft }) => draft?.action !== "deleted",
  );
  const moved = movedCycles(stream.cycles, cycles);
  const moving = movedReleases(kept, moved, stream.cyclesUntil, stream.name);
  if ("problem" in moving) {
    return {
      cycles: from(cycles),
      moved: [],
      ships: [],
      problem: moving.problem,
    };
  }
  // Every release's last cycle is still made, or moving it would have been refused above.
  const ships = kept.flatMap(({ name, lastCycle, shipsOn }) => {
    const last = moved.get(lastCycle);
    const on = (cycles.find((cycle) => cycle.startsOn === last) as Cycle)
      .endsOn;
    return shipsOn === null && on !== lastCycleEnd(stream, lastCycle)
      ? [{ name, on }]
      : [];
  });
  return {
    cycles: from(cycles),
    moved: moving.moves.map(({ release }) => release.name),
    ships,
  };
}

const draftPath = ({ type, id }: RecordRef) =>
  `/api/records/${type}/${encodeURIComponent(id)}/draft`;

// Discards a record's draft, so the record is as it is live, or, if the draft added it, gone, with
// what was drafted to be added to it.
export async function discardRecordDraft(
  ref: RecordRef,
): Promise<string | null> {
  return (await sendDeleteFor(draftPath(ref), savedSchema)).changeSetId;
}

// Sends a rejected draft for approval again, unchanged.
export async function resubmitRecordDraft(
  ref: RecordRef,
): Promise<string | null> {
  return (await sendDeleteFor(`${draftPath(ref)}/rejection`, savedSchema))
    .changeSetId;
}

// The cycle that starts on a day, by name, or the day itself when the stream has no such cycle.
export function cycleNamed(stream: ReleaseStream, startsOn: string): string {
  return (
    stream.cycles.find((cycle) => cycle.startsOn === startsOn)?.name ?? startsOn
  );
}

// The end of a release's last cycle, when it ships unless given another day.
export const lastCycleEnd = (
  stream: ReleaseStream,
  lastCycle: string,
): string | undefined =>
  stream.cycles.find(({ startsOn }) => startsOn === lastCycle)?.endsOn;

// The day a release ships: its own, or the end of its last cycle.
export const releaseDate = (
  stream: ReleaseStream,
  release: { lastCycle: string; shipsOn: string | null },
): string | undefined =>
  release.shipsOn ?? lastCycleEnd(stream, release.lastCycle);

const dayMs = 24 * 60 * 60 * 1000;

export const daysBetween = (from: string, to: string): number =>
  Math.round((Date.parse(to) - Date.parse(from)) / dayMs);

// How far a release's own day is from the end of its last cycle, in words, such as "31 days after
// 26.4 ends", or undefined when it ships when that cycle ends.
export function shipsOffCycle(
  stream: ReleaseStream,
  release: { lastCycle: string; shipsOn: string | null },
): string | undefined {
  const end = lastCycleEnd(stream, release.lastCycle);
  if (release.shipsOn === null || end === undefined) return undefined;
  const days = daysBetween(end, release.shipsOn);
  if (days === 0) return undefined;
  const count = Math.abs(days);
  return `${String(count)} ${count === 1 ? "day" : "days"} ${days > 0 ? "after" : "before"} ${cycleNamed(stream, release.lastCycle)} ends`;
}

// The colour a release with none is shown in: the accent, which the palette leaves out.
export const defaultColour = "sea";

// A release's colour as the theme names it.
export const shownColour = (colour: PaletteColour | null): string =>
  colour ?? defaultColour;

// A colour's name in words, such as "Grape", or "Sea" for a release with none.
export const colourName = (colour: unknown): string =>
  colourWords(shownColour(knownColour(colour)));

// The style that draws a release, and its Ships on marker, in its colour.
export const releaseColourStyle = (
  colour: PaletteColour | null,
): CSSProperties =>
  ({
    "--release-filled": colourVariable(shownColour(colour), "filled"),
    "--release-light": colourVariable(shownColour(colour), "light"),
  }) as CSSProperties;

// A release's cycles, in words, such as "26.1 to 26.2", or the one cycle's name.
export function releaseCycles(
  stream: ReleaseStream,
  release: { firstCycle: string; lastCycle: string },
): string {
  const first = cycleNamed(stream, release.firstCycle);
  const last = cycleNamed(stream, release.lastCycle);
  return first === last ? first : `${first} to ${last}`;
}

// How the Drafts page and decisions name a stream, a change of its cycles, and a release.
export const recordSubjects = {
  stream: (stream: ReleaseStream) => planSubjects.stream(stream.name),
  pattern: (stream: ReleaseStream, pattern: { startsOn: string }) =>
    planSubjects.pattern(stream.name, pattern.startsOn),
  release: (stream: ReleaseStream, release: { name: string }) =>
    planSubjects.release(release.name, stream.name),
};

// Every stream, pattern, and release, named as the Drafts page names them.
export function recordNodes(streams: readonly ReleaseStream[]): RecordNode[] {
  return streams.flatMap((stream) => [
    recordNode("release-stream", stream, recordSubjects.stream(stream)),
    ...stream.patterns.map((pattern) =>
      recordNode(
        "cycle-pattern",
        pattern,
        recordSubjects.pattern(stream, pattern),
      ),
    ),
    ...stream.releases.map((release) =>
      recordNode("release", release, recordSubjects.release(stream, release)),
    ),
  ]);
}
