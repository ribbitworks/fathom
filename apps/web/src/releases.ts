// SPDX-License-Identifier: Apache-2.0

// Release streams, their cycle patterns, and their releases through the server's API: reading them,
// with their cycles and drafts, every change to them, each a draft, and discarding the drafts of
// the plan's records or sending rejected ones for approval again; with each record as decisions on
// its draft name it.

import {
  type Feature,
  changeSetIdSchema,
  type Cycle,
  type CycleLengthRequest,
  type CyclePatternRequest,
  cyclesOf,
  type StreamSpan,
  lastStartOf,
  movedCycles,
  movedReleases,
  patternsForLength,
  planSubjects,
  type RecordDraft,
  type RecordRef,
  type Release,
  knownColour,
  type PaletteColour,
  type Permission,
  type ReleaseRequest,
  type ReleaseStream,
  releaseStreamSchema,
  releaseStreamsSchema,
  savedSchema,
  type Show,
} from "@fathom/shared";
import { queryOptions } from "@tanstack/react-query";
import type { CSSProperties } from "react";
import { z } from "zod";
import { getJson, sendDeleteFor, sendJsonFor } from "./api.ts";
import { colourVariable, colourWords } from "./colours.ts";
import { type RecordNode, recordNode } from "./record-drafts.ts";
import { withRetiring } from "./lists.ts";
import { undoDrafts } from "./record-grid.tsx";
import { recordMark } from "./status-mark.tsx";

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

export const setStreamSpan = (
  id: string,
  span: StreamSpan,
): Promise<SavedStream> =>
  sendJsonFor("PUT", `${streamPath(id)}/cycles-until`, span, streamResponse);

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

// The names of what moves with its cycles.
export interface MovedNames {
  releases: string[];
  features: string[];
}

const nothingMoved: MovedNames = { releases: [], features: [] };

// What a new length for one cycle makes of its stream, as the server would draft it: the cycles
// from that one on, the names of the releases and features that move with their cycles, the new ship dates of
// releases that ship when their last cycle ends, and why it cannot be made, if it cannot. Cycles
// the length cannot make are shown as they are now.
export function lengthChangeOf(
  stream: ReleaseStream,
  startsOn: string,
  request: CycleLengthRequest,
  permissions: readonly Permission[],
  features: readonly Feature[] = [],
): {
  cycles: Cycle[];
  moved: MovedNames;
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
      moved: nothingMoved,
      ships: [],
      problem: made.problem,
    };
  }
  const cycles = cyclesOf(made.patterns, stream.cyclesUntil, stream.endsOn);
  const kept = keptReleases(stream);
  const moved = movedCycles(stream.cycles, cycles);
  const moving = movedReleases(
    [
      ...kept,
      ...features
        .filter(
          ({ targetStreamId, draft }) =>
            targetStreamId === stream.id && draft?.action !== "deleted",
        )
        .map(({ name, targetCycle }) => ({
          name,
          firstCycle: String(targetCycle),
          lastCycle: String(targetCycle),
          shipsOn: null,
        })),
    ],
    moved,
    lastStartOf(stream),
    stream.name,
    permissions,
  );
  if ("problem" in moving) {
    return {
      cycles: from(cycles),
      moved: nothingMoved,
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
  const { moves } = moving;
  const names = (wanted: (move: (typeof moves)[number]) => boolean) =>
    moves.filter(wanted).map(({ release }) => release.name);
  return {
    cycles: from(cycles),
    moved: {
      releases: names(({ release }) => kept.some((one) => one === release)),
      features: names(({ release }) => !kept.some((one) => one === release)),
    },
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

// What each row shows of its record, each marked by its own dot where a draft changes it.
export const streamRowFields = new Set(["name"]);
export const patternRowFields = new Set([
  "startsOn",
  "length",
  "unit",
  "naming",
]);
export const releaseRowFields = new Set([
  "name",
  "colour",
  "firstCycle",
  "lastCycle",
  "shipsOn",
]);

const movedFields = ["firstCycle", "lastCycle"];

// A record's draft as its marks show it: saying when it retires or restores a stream, as a list's
// does, or, when it changes only a release's first and last cycles, that it moves the release.
export function markedDraft(
  draft: RecordDraft | undefined,
  retired?: boolean,
): (RecordDraft & { retiring?: boolean; moved?: boolean }) | undefined {
  if (draft === undefined) return undefined;
  const moves =
    draft.action === "changed" &&
    draft.changed.length === movedFields.length &&
    movedFields.every((field) => draft.changed.includes(field));
  if (moves) return { ...draft, moved: true };
  return retired === undefined ? draft : withRetiring({ retired, draft });
}

// A record's own mark, in its row's slot: its draft, unless the draft only changes values the row
// shows, other than a release's move, which its Moved box says.
export function slotDraft(
  draft: RecordDraft | undefined,
  shown: ReadonlySet<string>,
  retired?: boolean,
) {
  const marked = markedDraft(draft, retired);
  return marked?.moved === true ? marked : recordMark(marked, shown);
}

const everyDraft = () => true;
const rejected = ({ state }: { state: string }) => state === "rejected";
const kept = <Drafted extends { draft?: { action: string } | undefined }>(
  records: readonly Drafted[],
) => records.filter(({ draft }) => draft?.action !== "deleted");

// Every stream as it is live, without drafts, as Live only shows them.
export const liveStreams = (
  streams: readonly ReleaseStream[],
): ReleaseStream[] =>
  undoDrafts(streams, everyDraft).map((stream) => ({
    ...stream,
    patterns: undoDrafts(stream.patterns, everyDraft),
    cycles: stream.liveCycles ?? stream.cycles,
    releases: undoDrafts(stream.releases, everyDraft),
  }));

// The streams as their drafts will make them once approved, as Drafts applied shows them: rejected
// drafts taken back, and what drafts remove left out.
export const draftedStreams = (
  streams: readonly ReleaseStream[],
): ReleaseStream[] =>
  kept(undoDrafts(streams, rejected)).map((stream) => ({
    ...stream,
    patterns: kept(undoDrafts(stream.patterns, rejected)),
    releases: kept(undoDrafts(stream.releases, rejected)),
  }));

// Each stream's, pattern's and release's draft, whatever the view, by its record, for its marks.
export const draftsById = (
  streams: readonly ReleaseStream[],
): ReadonlyMap<string, RecordDraft> =>
  new Map(
    streams.flatMap((stream) =>
      [stream, ...stream.patterns, ...stream.releases].flatMap(
        ({ id, draft }): [string, RecordDraft][] =>
          draft === undefined ? [] : [[id, draft]],
      ),
    ),
  );

// The fields of a release that place it on a timeline.
export const placingFields: readonly string[] = [
  "firstCycle",
  "lastCycle",
  "shipsOn",
];

// The streams as a Draft view shows them, from every stream with its drafts.
export const streamsShown = (
  streams: readonly ReleaseStream[],
  show: Show,
): readonly ReleaseStream[] =>
  show === "live"
    ? liveStreams(streams)
    : show === "drafts"
      ? draftedStreams(streams)
      : streams;

// The cycle that starts on a day, by name, or the day itself when the stream has no such cycle.
export function cycleNamed(stream: ReleaseStream, startsOn: string): string {
  return (
    stream.cycles.find((cycle) => cycle.startsOn === startsOn)?.name ?? startsOn
  );
}

// A stream's releases, leaving out those a draft removes.
export const keptReleases = (stream: Pick<ReleaseStream, "releases">) =>
  stream.releases.filter(({ draft }) => draft?.action !== "deleted");

// Whether a release includes the cycle that starts on a day.
export const includesCycle = (
  release: Pick<Release, "firstCycle" | "lastCycle">,
  startsOn: string,
): boolean => release.firstCycle <= startsOn && startsOn <= release.lastCycle;

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
