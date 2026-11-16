// SPDX-License-Identifier: Apache-2.0

// A release's, cycle's or schedule's features as its details' Features row lists them, one to a
// line, each a link opening the feature's details on Features, as a panel lists several records;
// folded past the first five. Then Show on Features and Show on the Board, which open them there.

import type { Feature } from "@fathom/shared";
import { Button, Group, Stack } from "@mantine/core";
import { FoldedList } from "./folded-list.tsx";
import { RecordLinkList } from "./record-details.tsx";
import type { Column, GridRecord } from "./record-grid.tsx";
import {
  type FeaturesAt,
  featuresColumnKey,
  type PlannedFeatures,
} from "./release-tabs.ts";

const shownFirst = 5;

// Where a record's features are seen on Features: by its filter there, and, on the Board, the
// schedule and the cycle the board starts from.
type FeaturesOf = Exclude<FeaturesAt, { feature: string }>;

export function FeatureList({
  features,
  at,
  onFeatures,
}: {
  features: readonly Feature[];
  at: Required<FeaturesOf>;
  onFeatures: (at: FeaturesAt) => void;
}) {
  return (
    <Stack gap="xs" align="flex-start">
      <FoldedList items={features} first={shownFirst} noun="features">
        {(shown) => (
          <RecordLinkList
            links={shown.map(({ id, name }) => ({
              id,
              name,
              onShow: () => {
                onFeatures({ feature: id });
              },
            }))}
          />
        )}
      </FoldedList>
      <Group gap="xs">
        <Button
          variant="default"
          onClick={() => {
            onFeatures({ filter: at.filter });
          }}
        >
          Show on Features
        </Button>
        <Button
          variant="default"
          onClick={() => {
            onFeatures(at);
          }}
        >
          Show on the Board
        </Button>
      </Group>
    </Stack>
  );
}

// A record's details' columns, for those who see features, its Features row listing them one to a
// line rather than in one, as the record shows: as drafts make it, or as it is live. A record with
// none names none, so its row says None.
export const listingFeatures = <
  Rec extends GridRecord & {
    live: boolean;
    draft?: { live: object } | undefined;
  },
>(
  columns: readonly Column<Rec, never>[],
  planned: PlannedFeatures | undefined,
  {
    cyclesOf,
    at,
    onFeatures,
  }: {
    cyclesOf: (row: Rec) => readonly string[];
    at: (row: Rec) => Required<FeaturesOf>;
    onFeatures: (at: FeaturesAt) => void;
  },
): Column<Rec, never>[] =>
  planned === undefined
    ? [...columns]
    : columns.map((column) =>
        column.key === featuresColumnKey
          ? {
              ...column,
              content: (row: Rec) => (
                <FeatureList
                  features={planned.in(cyclesOf(row), row.live)}
                  at={at(row)}
                  onFeatures={onFeatures}
                />
              ),
            }
          : column,
      );
