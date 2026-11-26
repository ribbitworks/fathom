// SPDX-License-Identifier: Apache-2.0

// Tests for a feature's hours on Allocations grouped by what each is allocated to: the hours its
// allocations give it to its last month as the Draft menu shows them, its effort as the Draft menu
// shows it, and how its heading reads them.

import type { AllocatedFeature, Show } from "@fathom/shared";
import { MantineProvider } from "@mantine/core";
import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import {
  allocatedHours,
  countedTo,
  effortShown,
  WorkFacts,
} from "./allocated-work.tsx";
import { allocation, draft } from "./test-allocation-months.ts";
import { testTheme } from "./test-support.tsx";

const eighty = { full: 80, rampUp: {} };

describe("allocatedHours", () => {
  it("adds up a feature's allocations from each one's first month to the last month, at the percentage in force in each", () => {
    const allocations = [
      allocation({ months: { "2027-03": 50 }, hours: eighty }),
      allocation({
        id: "a-2",
        months: { "2027-02": 100, "2027-04": null },
        hours: eighty,
      }),
      allocation({ id: "a-3", featureId: "f-billing", hours: eighty }),
      allocation({ id: "a-4" }),
    ];

    expect(allocatedHours(allocations, "f-checkout", "2027-05", "both")).toBe(
      40 * 3 + 80 * 2,
    );
  });

  it("counts nothing of an allocation that starts after the last month", () => {
    expect(
      allocatedHours(
        [allocation({ months: { "2027-06": 50 }, hours: eighty })],
        "f-checkout",
        "2027-05",
        "both",
      ),
    ).toBe(0);
  });

  it("reads a draft's months while drafts show, but a rejected one's approved months, and none for a draft removing it", () => {
    const at = (fields: Parameters<typeof draft>[0], show: Show) =>
      allocatedHours(
        [
          allocation({
            months: { "2027-03": 50 },
            hours: eighty,
            draft: draft(fields),
          }),
        ],
        "f-checkout",
        "2027-04",
        show,
      );

    expect([
      at({ months: { "2027-03": 100 } }, "drafts"),
      at({ months: { "2027-03": 100 } }, "live"),
      at({ months: { "2027-03": 100 }, state: "rejected" }, "drafts"),
      at({ action: "deleted" }, "drafts"),
    ]).toEqual([160, 80, 80, 0]);
  });
});

describe("effortShown", () => {
  const live = { estimate: 100, needed: 120, lastMonth: "2027-06" };
  const drafted = { estimate: 50, needed: 60, lastMonth: null };

  it("reads the drafted effort while drafts show, and the approved one otherwise", () => {
    expect([
      effortShown({ live, drafted }, "drafts"),
      effortShown({ live, drafted }, "both"),
      effortShown({ live }, "drafts"),
    ]).toEqual([drafted, live, live]);
  });

  it("counts to the work's last month as shown, or the current month for work with no dates", () => {
    expect([
      countedTo({ live, drafted }, "both", "2027-01"),
      countedTo({ live, drafted }, "drafts", "2027-01"),
    ]).toEqual(["2027-06", "2027-01"]);
  });
});

describe("a feature's heading facts", () => {
  const facts = (
    feature: Pick<AllocatedFeature, "effort" | "unseen" | "meaning">,
    allocated: number,
  ) =>
    render(
      <MantineProvider theme={testTheme}>
        <p data-testid="facts">
          <WorkFacts work={feature} allocated={allocated} show="both" />
        </p>
      </MantineProvider>,
    ).container.querySelector("[data-testid=facts]") as HTMLElement;
  const effort = (estimate: number | null, needed: number | null) => ({
    live: { estimate, needed, lastMonth: null },
  });

  it("reads the estimate as Effort, and Remaining as the hours it needs, with the buffer, less those allocated", () => {
    expect(
      facts({ meaning: "in-progress", effort: effort(320, 384) }, 256)
        .textContent,
    ).toBe(" · Effort 320 h · Allocated 256 h · Remaining 128 h");
  });

  it("says what months Allocated counts", () => {
    expect(
      facts({ meaning: "in-progress", effort: effort(320, 384) }, 256)
        .querySelector("[data-tip]")
        ?.getAttribute("data-tip"),
    ).toBe(
      "From each allocation's first month to the work's end, or to this month if the work has no dates",
    );
  });

  it("reads what is over the hours it needs with a minus sign, in red", () => {
    const over = facts(
      { meaning: "in-progress", effort: effort(120, 144) },
      150,
    );
    expect(over.textContent).toBe(
      " · Effort 120 h · Allocated 150 h · Remaining −6 h",
    );
    expect(over.querySelector("[data-over]")?.textContent).toBe("\u22126 h");
  });

  it("reads Allocated alone without an estimate, and Remaining as None for a done feature", () => {
    expect([
      facts({ meaning: "in-progress", effort: effort(null, null) }, 40)
        .textContent,
      facts({ meaning: "done", effort: effort(100, 120) }, 40).textContent,
    ]).toEqual([
      " · Allocated 40 h",
      " · Effort 100 h · Allocated 40 h · Remaining None",
    ]);
  });

  it("reads nothing for a feature the reader can't read, or without the hours", () => {
    expect([
      facts({ meaning: null, unseen: true }, 0).textContent,
      facts({ meaning: "in-progress" }, 0).textContent,
    ]).toEqual(["", ""]);
  });
});
