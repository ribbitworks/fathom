// SPDX-License-Identifier: Apache-2.0

// Release streams, their cycle patterns, and their releases through the server's API: reading them,
// with their cycles and drafts, every change to them, each a draft, and discarding the drafts of
// the plan's records or sending rejected ones for approval again; with each record as decisions on
// its draft name it.

import {
  changeSetIdSchema,
  type CyclePatternRequest,
  planSubjects,
  type RecordRef,
  type RecordType,
  type ReleaseRequest,
  type ReleaseStream,
  releaseStreamSchema,
  releaseStreamsSchema,
  savedSchema,
} from "@fathom/shared";
import { queryOptions } from "@tanstack/react-query";
import { z } from "zod";
import { getJson, sendDeleteFor, sendJsonFor } from "./api.ts";
import type { RecordNode } from "./record-drafts.ts";

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

// Drafts removing a pattern or release; removing one only drafted to be added discards it.
export async function removeFromStream(
  streamId: string,
  member: Member,
  id: string,
): Promise<string | null> {
  return (await sendDeleteFor(memberPath(streamId, member, id), savedSchema))
    .changeSetId;
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

const daysBetween = (from: string, to: string): number =>
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

const node = (
  type: RecordType,
  record: {
    id: string;
    draft?: RecordNode["draft"] | undefined;
    heldBy?: string | undefined;
  },
  subject: string,
): RecordNode => ({
  ref: { type, id: record.id },
  subject,
  draft: record.draft,
  heldBy: record.heldBy,
});

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
    node("release-stream", stream, recordSubjects.stream(stream)),
    ...stream.patterns.map((pattern) =>
      node("cycle-pattern", pattern, recordSubjects.pattern(stream, pattern)),
    ),
    ...stream.releases.map((release) =>
      node("release", release, recordSubjects.release(stream, release)),
    ),
  ]);
}
