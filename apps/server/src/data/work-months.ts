// SPDX-License-Identifier: Apache-2.0

// The last month of a feature or activity, which the hours its allocations give it are counted to.

import { cyclesOf, monthOf, projectDates } from "@fathom/shared";
import type { Recorded } from "./draft-records.ts";
import { milestoneDays } from "./project-kinds.ts";
import { type RecordsState, stateOf, versionOf } from "./record-state.ts";
import { text } from "./reporting.ts";
import { endsOnIn, livePatterns, streamPatterns } from "./stream-cycles.ts";

// Approved, or as drafts make them.
export type Side = "live" | "drafted";

const recordIn = (
  state: RecordsState,
  type: "release" | "release-stream",
  id: string,
  side: Side,
): Recorded | undefined =>
  side === "live"
    ? stateOf(state, type).live.get(id)
    : versionOf(state, type, id);

const monthIn = (day: string | null): string | null =>
  day === null ? null : monthOf(day);

// The month the last day of a cycle of a schedule falls in; none when the schedule has no such
// cycle.
function cycleEndMonth(
  state: RecordsState,
  streamId: string | null,
  cycle: string | null,
  side: Side,
): string | null {
  if (streamId === null || cycle === null) return null;
  const patterns =
    side === "live"
      ? livePatterns(state, streamId)
      : streamPatterns(state, streamId).map(({ pattern }) => pattern);
  const endsOn = endsOnIn(
    recordIn(state, "release-stream", streamId, side) ?? {},
  );
  return monthIn(
    cyclesOf(patterns, cycle, endsOn).find(({ startsOn }) => startsOn === cycle)
      ?.endsOn ?? null,
  );
}

// The month of a project's last milestone; none without one.
function projectEndMonth(
  state: RecordsState,
  projectId: string,
  side: Side,
  today: string,
): string | null {
  const { live, drafted } = milestoneDays(state, projectId);
  return monthIn(projectDates(side === "live" ? live : drafted, today).last);
}

// A feature's last month: its target cycle's, else the month it is needed by; none with neither,
// or for one with no approved version, drafted to be added.
export const featureLastMonth = (
  state: RecordsState,
  feature: Recorded | undefined,
  side: Side,
): string | null =>
  cycleEndMonth(
    state,
    text(feature?.targetStreamId),
    text(feature?.targetCycle),
    side,
  ) ?? text(feature?.neededBy);

// An activity's last month: the month it is needed by, else its project's last milestone, for a
// reader who reads projects, or its release's last cycle; none with neither, or for one with no
// approved version, drafted to be added.
export function activityLastMonth(
  state: RecordsState,
  activity: Recorded | undefined,
  side: Side,
  { readsProjects, today }: { readsProjects: boolean; today: string },
): string | null {
  const own = text(activity?.neededBy);
  if (own !== null) return own;
  const projectId = text(activity?.projectId);
  if (projectId !== null) {
    return readsProjects
      ? projectEndMonth(state, projectId, side, today)
      : null;
  }
  const releaseId = text(activity?.releaseId);
  const release =
    releaseId === null
      ? undefined
      : recordIn(state, "release", releaseId, side);
  return cycleEndMonth(
    state,
    text(release?.streamId),
    text(release?.lastCycle),
    side,
  );
}

// A work's effort approved, and as drafts make it where they change it: by a waiting draft of the
// work, or by drafts of what its last month is read from, such as its project's milestones.
export const effortSides = <Effort extends { lastMonth: string | null }>(
  live: Effort,
  drafted: Effort,
  waiting: boolean,
): { live: Effort; drafted?: Effort } =>
  waiting || drafted.lastMonth !== live.lastMonth
    ? { live, drafted }
    : { live };
