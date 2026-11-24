// SPDX-License-Identifier: Apache-2.0

// Fictional release streams for the front-end tests: their cycle patterns, cycles and releases,
// with ids as the server gives them, and the server's answer listing them.

import type {
  Cycle,
  CyclePattern,
  Release,
  ReleaseStream,
  ReleaseStreams,
} from "@fathom/shared";

export const streamId = "10000000-0000-4000-8000-000000000001";
export const minorsId = "10000000-0000-4000-8000-000000000002";

export const fictionalPattern = (
  fields: Partial<CyclePattern> = {},
): CyclePattern => ({
  id: "20000000-0000-4000-8000-000000000001",
  startsOn: "2027-01-01",
  length: 3,
  unit: "months",
  naming: "{YY}.{N}",
  ...fields,
});

export const fictionalRelease = (fields: Partial<Release> = {}): Release => ({
  id: "30000000-0000-4000-8000-000000000001",
  keyNumber: 1,
  name: "Fictional One",
  firstCycle: "2027-01-01",
  lastCycle: "2027-01-01",
  shipsOn: null,
  colour: null,
  note: null,
  ...fields,
});

export const fictionalCycle = (
  name: string,
  startsOn: string,
  endsOn: string,
): Cycle => ({ startsOn, endsOn, name, months: [] });

// Cycles of three months from 2027-01-01, named 27.1 to 27.4 and so on.
export const quarters = (count: number): Cycle[] =>
  Array.from({ length: count }, (_, at) => {
    const year = 2027 + Math.floor(at / 4);
    const quarter = at % 4;
    const month = (offset: number) =>
      `${String(year)}-${String(quarter * 3 + offset + 1).padStart(2, "0")}`;
    // Day 0 of the month after the quarter is the quarter's last day.
    const endsOn = new Date(Date.UTC(year, quarter * 3 + 3, 0))
      .toISOString()
      .slice(0, 10);
    return {
      startsOn: `${month(0)}-01`,
      endsOn,
      name: `${String(year).slice(2)}.${String(quarter + 1)}`,
      months: [0, 1, 2].map((offset) => ({ month: month(offset), share: 1 })),
    };
  });

export const fictionalStream = (
  fields: Partial<ReleaseStream> = {},
): ReleaseStream => ({
  id: streamId,
  keyNumber: 1,
  name: "Fictional Majors",
  retired: false,
  cyclesUntil: "2027-12-31",
  endsOn: null,
  patterns: [fictionalPattern()],
  cycles: quarters(4),
  releases: [],
  ...fields,
});

export const fictionalMinors = (
  fields: Partial<ReleaseStream> = {},
): ReleaseStream =>
  fictionalStream({ id: minorsId, name: "Fictional Minors", ...fields });

export const streamsAnswer =
  (
    streams: ReleaseStream[],
    can: Partial<
      Pick<ReleaseStreams, "canEditStreams" | "canEditReleases">
    > = {},
  ) =>
  () =>
    Response.json({
      streams,
      canEditStreams: false,
      canEditReleases: false,
      ...can,
    } satisfies ReleaseStreams);
