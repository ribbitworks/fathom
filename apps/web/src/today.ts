// SPDX-License-Identifier: Apache-2.0

// Today as Fathom's time zone has it, the same day for every reader and for the server's checks,
// and the day a page reads as of.
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

// The day of a moment, such as when something was made, as YYYY-MM-DD.
export const dayOf = (moment: string): string =>
  dayIn(timeZone, new Date(moment));

// The day a page should be shown as of, or undefined for today: only a day the reader's role sees
// the classes of data for.
export function shownDay(
  asked: string | undefined,
  sees: { otherDates: boolean; futureDates: boolean },
): string | undefined {
  if (asked === undefined || asked === today() || !sees.otherDates) {
    return undefined;
  }
  return asked > today() && !sees.futureDates ? undefined : asked;
}
