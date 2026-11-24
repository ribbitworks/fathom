// SPDX-License-Identifier: Apache-2.0

// Tests for the row of the Releases page's tabs marked as the record whose details are open beside
// the tab's table, with the server's responses simulated.

import type { ReleaseStream } from "@fathom/shared";
import { screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, it, vi } from "vitest";
import {
  fictionalRelease,
  fictionalStream,
  renderApp,
  serverAnswers,
  signedIn,
  streamId,
} from "./test-support.tsx";
import { markedUntilClosed } from "./test-open-row.tsx";

// Which cycles the tables show depends on the day, here in Fictional Majors' second cycle, 27.2.
beforeEach(() => {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(new Date("2027-05-15T12:00:00Z"));
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

const release = fictionalRelease({
  firstCycle: "2027-04-01",
  lastCycle: "2027-04-01",
});

// Opens the page at the address given, with the schedules given, once the named table shows.
async function openPage(path: string, table: string, shown: ReleaseStream[]) {
  serverAnswers({
    "GET /api/session": signedIn,
    "GET /api/release-streams": () =>
      Response.json({
        streams: shown,
        canEditStreams: false,
        canEditReleases: false,
      }),
  });
  renderApp(path);
  await screen.findByRole("grid", { name: table });
}

describe("the row of the record whose details are open", () => {
  it("is marked on Releases, until they close", async () => {
    // Given a release's details open beside a table of two releases
    await openPage(`/releases?open=${release.id}`, "Releases", [
      fictionalStream({
        releases: [
          release,
          fictionalRelease({
            id: "30000000-0000-4000-8000-000000000002",
            keyNumber: 2,
            name: "Fictional Two",
            firstCycle: "2027-07-01",
            lastCycle: "2027-07-01",
          }),
        ],
      }),
    ]);
    // Then its row alone is marked, until the details close
    await markedUntilClosed("Fictional One");
  });

  it("is marked on Cycles, until they close", async () => {
    // Given the details of Fictional Majors' second cycle open beside its four
    await openPage(
      `/releases?tab=cycles&open=${encodeURIComponent(`${streamId} 2027-04-01`)}`,
      "Cycles",
      [fictionalStream()],
    );
    // Then its row alone is marked, until the details close
    await markedUntilClosed("27.2");
  });

  it("is marked on Schedules, until they close", async () => {
    // Given a schedule's details open beside a table of two schedules
    await openPage(`/releases?tab=schedules&open=${streamId}`, "Schedules", [
      fictionalStream(),
      fictionalStream({
        id: "10000000-0000-4000-8000-000000000002",
        keyNumber: 2,
        name: "Fictional Minors",
      }),
    ]);
    // Then its row alone is marked, until the details close
    await markedUntilClosed("Fictional Majors");
  });
});
