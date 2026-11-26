// SPDX-License-Identifier: Apache-2.0

// Tests for what Metrics on Features breaks features down by.

import { screen, within } from "@testing-library/react";
import { userEvent } from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import {
  featurePlan,
  first,
  later,
  open,
  second,
} from "./test-projects-page.tsx";

const breakdown = (keys: string[]) =>
  `breakdown=${encodeURIComponent(JSON.stringify(keys))}`;

const metrics = () => screen.findByRole("region", { name: "Metrics" });

describe("Metrics on Features", () => {
  it("counts the features needed by each month, in date order, then those needed by none", async () => {
    // Given two features needed by different months, the later one listed first, and one by none
    await open(
      featurePlan({
        features: [
          { ...later, neededBy: null },
          { ...second, neededBy: "2027-06" },
          { ...first, neededBy: "2027-03" },
        ],
      }),
      {},
      `/features?${breakdown(["neededBy"])}`,
    );

    // Then each month has its row, in date order, then Empty
    const panel = await metrics();
    expect(
      within(panel)
        .getAllByRole("rowheader")
        .map(({ textContent }) => textContent),
    ).toEqual(["Mar 2027", "Jun 2027", "Empty", "All features"]);
  });

  it("never breaks features down by Effort, in whatever unit it's shown", async () => {
    // Given Effort shown in person-days, with Metrics open
    await open(
      featurePlan(),
      {},
      `/features?units=${encodeURIComponent(
        JSON.stringify({ estimateHours: "person-days" }),
      )}&${breakdown([])}`,
    );

    // Then Break down by offers Status, and not Effort
    await userEvent.click(
      within(await metrics()).getByRole("combobox", { name: "Break down by" }),
    );
    const offered = (await screen.findAllByRole("option")).map(
      ({ textContent }) => textContent,
    );
    expect(offered).toContain("Status");
    expect(offered).not.toContain("Effort");
  });
});
