// SPDX-License-Identifier: Apache-2.0

// Tests for what the Releases page's tabs share about features: those targeting the cycles given,
// as drafts make them or as they are live, and a row's Features column naming them.

import { MantineProvider } from "@mantine/core";
import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { cycleChoiceId } from "./projects.ts";
import type { GridDraft, GridRecord } from "./record-table.ts";
import { featuresColumn, plannedFeatures } from "./release-tabs.ts";
import {
  featureDraft,
  fictionalFeature,
  streamId,
  testTheme,
} from "./test-support.tsx";

const otherStream = "10000000-0000-4000-8000-000000000009";
const first = cycleChoiceId(streamId, "2027-01-01");
const second = cycleChoiceId(streamId, "2027-04-01");
const target = (targetStreamId: string, targetCycle: string) => ({
  targetStreamId,
  targetCycle,
});

const features = [
  fictionalFeature({
    id: "60000000-0000-4000-8000-000000000001",
    name: "Fictional Sync",
    ...target(streamId, "2027-04-01"),
  }),
  fictionalFeature({
    id: "60000000-0000-4000-8000-000000000002",
    name: "Fictional Export",
    ...target(streamId, "2027-01-01"),
  }),
  fictionalFeature({
    id: "60000000-0000-4000-8000-000000000003",
    name: "Fictional Maps",
    ...target(otherStream, "2027-01-01"),
  }),
  fictionalFeature({
    id: "60000000-0000-4000-8000-000000000004",
    name: "Fictional Later",
  }),
  fictionalFeature({
    id: "60000000-0000-4000-8000-000000000005",
    name: "Fictional Moved",
    ...target(streamId, "2027-04-01"),
    draft: featureDraft({
      action: "changed",
      changed: ["targetCycle"],
      live: { targetCycle: "2027-01-01" },
    }),
  }),
  fictionalFeature({
    id: "60000000-0000-4000-8000-000000000006",
    name: "Fictional Removed",
    ...target(streamId, "2027-01-01"),
    draft: featureDraft({ action: "deleted" }),
  }),
  fictionalFeature({
    id: "60000000-0000-4000-8000-000000000007",
    name: "Fictional Added",
    ...target(streamId, "2027-01-01"),
    draft: featureDraft({ action: "created" }),
  }),
];

const planned = plannedFeatures(features);
const named = (listed: readonly { name: string }[]) =>
  listed.map(({ name }) => name);

describe("the plan's features as the tabs show them", () => {
  it("finds those targeting the cycles given, in the plan's order, as drafts make them", () => {
    expect([
      named(planned.in([first, second], false)),
      named(planned.in([cycleChoiceId(otherStream, "2027-01-01")], false)),
      named(planned.in([cycleChoiceId(streamId, "2027-07-01")], false)),
    ]).toEqual([
      [
        "Fictional Sync",
        "Fictional Export",
        "Fictional Moved",
        "Fictional Added",
      ],
      ["Fictional Maps"],
      [],
    ]);
  });

  it("finds them as they are live, where a draft moved, removed or added one", () => {
    expect([
      named(planned.in([first], true)),
      named(planned.in([second], true)),
    ]).toEqual([
      ["Fictional Export", "Fictional Moved", "Fictional Removed"],
      ["Fictional Sync"],
    ]);
  });
});

describe("a row's Features column", () => {
  interface Values {
    cycles: string[];
  }
  type Row = Values &
    GridRecord & {
      live: boolean;
      draft?: (GridDraft & { live: Values }) | undefined;
    };
  const column = featuresColumn<Values, Row>(
    "Features",
    planned,
    ({ cycles }) => cycles,
    "cycles",
  );

  it("names a row's features as drafts make them, or as they are live in a live row, read only", () => {
    expect([
      column.value({ id: "a", cycles: [second], live: false }),
      column.value({ id: "a", cycles: [second], live: true }),
      column.value({ id: "b", cycles: [], live: false }),
      column.readOnly,
      column.changesWith,
    ]).toEqual([
      [
        "60000000-0000-4000-8000-000000000001",
        "60000000-0000-4000-8000-000000000005",
      ],
      ["60000000-0000-4000-8000-000000000001"],
      [],
      true,
      "cycles",
    ]);
  });

  it("names the features of the cycles a draft's live values hold, as they are live", () => {
    expect(column.live({ live: { cycles: [second] } } as never)).toEqual([
      "60000000-0000-4000-8000-000000000001",
    ]);
  });

  it("leaves changesWith out when none is given", () => {
    expect(
      "changesWith" in
        featuresColumn<Values, Row>(
          "Features",
          planned,
          ({ cycles }) => cycles,
        ),
    ).toBe(false);
  });

  it("names them in one line", () => {
    const { container } = render(
      <MantineProvider theme={testTheme}>
        {column.content?.({ id: "a", cycles: [first, second], live: false })}
      </MantineProvider>,
    );

    expect(container.querySelector("[data-tip]")?.textContent).toBe(
      "Fictional Sync, Fictional Export, Fictional Moved, Fictional Added",
    );
  });
});
