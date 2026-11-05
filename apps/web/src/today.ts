// SPDX-License-Identifier: Apache-2.0

// Today as Fathom's time zone has it, the same day for every reader and for the server's checks.
// The time zone comes with the session, which every signed-in page reads before it opens. Pages
// work out today in plain functions as well as components, so it is kept here rather than passed
// down.

import { dayIn, defaultTimeZone, knowsTimeZone } from "@fathom/shared";

let timeZone = defaultTimeZone;

// A browser whose time zone data lacks the name, added since it was made, keeps the default.
export function setTimeZone(zone: string): void {
  timeZone = knowsTimeZone(zone) ? zone : defaultTimeZone;
}

// Today as YYYY-MM-DD.
export const today = (): string => dayIn(timeZone);
