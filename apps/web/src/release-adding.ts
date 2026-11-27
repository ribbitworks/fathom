// SPDX-License-Identifier: Apache-2.0

// What the Releases page offers for adding: which schedules take new releases, why New release is
// turned off, and when the Releases tab offers Make a schedule first.

import type { ReleaseStream, Show } from "@fathom/shared";

// Whether a new release may be made in a schedule: one not retired, nor drafted to be removed, with
// cycles to put it in.
export const takesReleases = (stream: ReleaseStream): boolean =>
  !stream.retired &&
  stream.draft?.action !== "deleted" &&
  stream.cycles.length > 0;

export const newReleaseReason = (
  streams: readonly ReleaseStream[],
): string | undefined =>
  streams.some(takesReleases)
    ? undefined
    : "No schedule takes new releases now";

// Offered while there are no schedules, to a role that adds them, apart from under Live only, where
// a schedule made would not show.
export const offersFirstSchedule = (
  streams: readonly ReleaseStream[],
  canEditStreams: boolean,
  show: Show,
): boolean => streams.length === 0 && canEditStreams && show !== "live";
