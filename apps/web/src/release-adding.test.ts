// SPDX-License-Identifier: Apache-2.0

// Tests for what the Releases page offers for adding: which schedules take new releases, why New
// release is turned off, and when Make a schedule first is offered.

import { describe, expect, it } from "vitest";
import {
  newReleaseReason,
  offersFirstSchedule,
  takesReleases,
} from "./release-adding.ts";
import { fictionalStream } from "./test-releases.ts";
import { recordDraft } from "./test-support.tsx";

const open = fictionalStream();
const retired = fictionalStream({ retired: true });
const beingRemoved = fictionalStream({
  draft: recordDraft({ action: "deleted" }),
});
const noCycles = fictionalStream({ cycles: [] });

describe("a schedule taking new releases", () => {
  it("takes them while it has cycles to put them in", () => {
    expect(takesReleases(open)).toBe(true);
  });

  it("takes none once retired", () => {
    expect(takesReleases(retired)).toBe(false);
  });

  it("takes none while drafted to be removed", () => {
    expect(takesReleases(beingRemoved)).toBe(false);
  });

  it("takes none without cycles", () => {
    expect(takesReleases(noCycles)).toBe(false);
  });
});

describe("why New release is turned off", () => {
  it("gives no reason while any schedule takes new releases", () => {
    expect(newReleaseReason([retired, open])).toBeUndefined();
  });

  it("says no schedule takes them while none does", () => {
    expect(newReleaseReason([retired, beingRemoved, noCycles])).toBe(
      "No schedule takes new releases now",
    );
  });

  it("says so while there is no schedule at all", () => {
    expect(newReleaseReason([])).toBe("No schedule takes new releases now");
  });
});

describe("Make a schedule first", () => {
  it("is offered while there are no schedules, to a role that adds them", () => {
    expect(offersFirstSchedule([], true, "both")).toBe(true);
  });

  it("is not offered once there is a schedule, even a retired one", () => {
    expect(offersFirstSchedule([retired], true, "both")).toBe(false);
  });

  it("is not offered to a role that can't add schedules", () => {
    expect(offersFirstSchedule([], false, "both")).toBe(false);
  });

  it("is not offered under Live only, where nothing made would show", () => {
    expect(offersFirstSchedule([], true, "live")).toBe(false);
  });
});
