// SPDX-License-Identifier: Apache-2.0

// Tests for the releases the cycles a feature can target are in, as features are grouped under them.

import { describe, expect, it } from "vitest";
import { formatDay } from "./day-formats.ts";
import { releaseOfCycle, streamOfReleaseGroup } from "./feature-cycles.ts";
import {
  fictionalRelease,
  fictionalStream,
  quarters,
  recordDraft,
} from "./test-support.tsx";

describe("the release each cycle is in", () => {
  const majors = fictionalStream({
    // 27.1 to 27.4, then a cycle only as it is live.
    liveCycles: [
      {
        startsOn: "2028-01-01",
        endsOn: "2028-03-31",
        name: "28.1",
        months: [],
      },
    ],
    releases: [
      fictionalRelease({
        id: "later-release",
        name: "Fictional Two",
        firstCycle: "2027-07-01",
        lastCycle: "2027-07-01",
        shipsOn: "2027-10-15",
      }),
      fictionalRelease({
        id: "first-release",
        firstCycle: "2027-01-01",
        lastCycle: "2027-04-01",
      }),
      fictionalRelease({
        id: "removed-release",
        name: "Fictional Removed",
        firstCycle: "2027-10-01",
        lastCycle: "2027-10-01",
        draft: recordDraft({ action: "deleted" }),
      }),
    ],
  });
  const patches = fictionalStream({
    id: "patches",
    name: "Fictional Patches",
    cycles: quarters(1),
    releases: [
      fictionalRelease({
        id: "patch",
        name: "Fictional Patch",
        // No cycle starts on this day, so the day it ships is not known.
        lastCycle: "2027-02-01",
      }),
    ],
  });
  const groups = releaseOfCycle([majors, patches]);
  const of = (streamId: string, startsOn: string) =>
    groups.get(`${streamId} ${startsOn}`);

  it("names a release with its stream and the end of its last cycle, when it has no day of its own", () => {
    expect(of(majors.id, "2027-04-01")).toMatchObject({
      label: `Fictional Majors: Fictional One, ships ${formatDay("2027-06-30")}`,
      name: "Fictional Majors: Fictional One",
    });
  });

  it("names a release with the day it ships, when it has one of its own", () => {
    expect(of(majors.id, "2027-07-01")?.label).toBe(
      `Fictional Majors: Fictional Two, ships ${formatDay("2027-10-15")}`,
    );
  });

  it("names a release whose ship day is not known without one", () => {
    expect(of("patches", "2027-01-01")?.label).toBe(
      "Fictional Patches: Fictional Patch",
    );
  });

  it("places the cycles in no release, those only live too, under their stream", () => {
    expect([of(majors.id, "2027-10-01"), of(majors.id, "2028-01-01")]).toEqual([
      expect.objectContaining({ label: "Fictional Majors: Not released yet" }),
      expect.objectContaining({ label: "Fictional Majors: Not released yet" }),
    ]);
  });

  it("places the cycles of a release a draft removes under its stream's Not released yet", () => {
    expect(of(majors.id, "2027-10-01")?.label).toBe(
      "Fictional Majors: Not released yet",
    );
  });

  it("ranks releases by stream and date, then each stream's cycles in none", () => {
    const ranked = [
      of(majors.id, "2027-01-01"),
      of(majors.id, "2027-07-01"),
      of("patches", "2027-01-01"),
      of(majors.id, "2027-10-01"),
    ].map((group) => group?.rank);
    expect(ranked).toEqual([0, 1, 2, 3]);
  });

  it("keys each group by its stream", () => {
    expect(
      [of(majors.id, "2027-01-01"), of(majors.id, "2027-10-01")].map((group) =>
        streamOfReleaseGroup(group?.key ?? ""),
      ),
    ).toEqual([majors.id, majors.id]);
  });
});
