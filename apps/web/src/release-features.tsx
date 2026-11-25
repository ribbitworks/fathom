// SPDX-License-Identifier: Apache-2.0

// The features a release's, cycle's or schedule's details list.

import type { Feature } from "@fathom/shared";
import type { Column, GridRecord } from "./record-table.ts";
import { ShortList } from "./short-list.tsx";
import {
  type FeaturesAt,
  featuresColumnKey,
  type PlannedFeatures,
} from "./release-tabs.ts";

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
    <ShortList
      items={features}
      noun="features"
      onShow={(feature) => {
        onFeatures({ feature });
      }}
      actions={[
        {
          label: "Show on Features",
          onClick: () => {
            onFeatures({ filter: at.filter });
          },
        },
        {
          label: "Show on the Board",
          onClick: () => {
            onFeatures(at);
          },
        },
      ]}
    />
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
