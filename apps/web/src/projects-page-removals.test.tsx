// SPDX-License-Identifier: Apache-2.0

// Tests for Remove in a record's menu: turned off, before it is chosen, while another record names
// the record, with a line naming the first that does, which describes the item.

import { within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { allocatedFeatureWords } from "./feature-table.tsx";
import { turnedOffItem } from "./test-menus.tsx";
import {
  activity,
  answers,
  featurePlan,
  first,
  openPage,
  plan,
  planEditor,
  project,
  proposal,
  proposalId,
  rowMenu,
} from "./test-projects-page.tsx";

const openFeatures = (shown: Parameters<typeof featurePlan>[0]) =>
  openPage("/features", featurePlan(shown), answers, planEditor);

describe("removing a record another names", () => {
  it("is turned off for a proposal while a project names it, the line describing it", async () => {
    // Given a project naming the proposal
    await openPage(
      "/projects?tab=proposals",
      plan({ projects: [project({ proposalIds: [proposalId] })] }),
    );

    // Then Remove proposal is turned off, described by the project it names
    expect(
      turnedOffItem(
        await rowMenu("Fictional Proposal"),
        "Remove proposal",
        "FP-1 Fictional Project names this proposal.",
      ),
    ).toBeDefined();
  });

  it("is offered for a proposal no project names", async () => {
    await openPage(
      "/projects?tab=proposals",
      plan({ projects: [project({ proposalIds: [] })] }),
    );

    const item = within(await rowMenu("Fictional Proposal")).getByRole(
      "menuitem",
      { name: "Remove proposal" },
    );
    expect(item.hasAttribute("aria-disabled")).toBe(false);
    expect(item.hasAttribute("aria-describedby")).toBe(false);
  });

  it("is turned off for a project while an activity names it", async () => {
    await openPage(
      "/projects?tab=projects",
      plan({
        proposals: [proposal()],
        projects: [project({ proposalIds: [] })],
        activities: [activity()],
      }),
    );

    expect(
      turnedOffItem(
        await rowMenu("Fictional Project"),
        "Remove project",
        "Fictional Migration names this project.",
      ),
    ).toBeDefined();
  });

  it("is turned off for a feature while a project needs it", async () => {
    await openFeatures({
      features: [first],
      projects: [project({ featureIds: [first.id] })],
    });

    expect(
      turnedOffItem(
        await rowMenu("Fictional First"),
        "Remove feature",
        "FP-1 Fictional Project names this feature.",
      ),
    ).toBeDefined();
  });

  it("is turned off for a feature with allocations, before any project naming it", async () => {
    await openFeatures({
      features: [{ ...first, staffed: true }],
      projects: [project({ featureIds: [first.id] })],
    });

    expect(
      turnedOffItem(
        await rowMenu("Fictional First"),
        "Remove feature",
        allocatedFeatureWords,
      ),
    ).toBeDefined();
  });
});
