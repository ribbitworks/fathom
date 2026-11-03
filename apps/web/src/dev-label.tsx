// SPDX-License-Identifier: Apache-2.0

// Which copy of the repository and which branch 'pnpm dev' runs from, shown in the top bar and the
// browser tab's title so copies running at once can be told apart. Builds and tests have none.

import { Badge } from "@mantine/core";

export interface DevLabel {
  clone: string;
  branch: string;
}

// Wide enough for most branch names; longer ones are cut short.
const badgeWidth = 360;

// Set by vite.config.ts.
declare const FATHOM_DEV_LABEL: DevLabel | null;

export const devLabel: DevLabel | null = FATHOM_DEV_LABEL;

export function devTitle(title: string, label: DevLabel | null): string {
  return label === null ? title : `[${label.clone}] ${title}`;
}

export function DevBadge({ label }: { label: DevLabel | null }) {
  if (label === null) return null;
  return (
    <Badge
      variant="light"
      color="orange"
      tt="none"
      maw={badgeWidth}
      visibleFrom="xs"
    >
      Clone {label.clone} · {label.branch}
    </Badge>
  );
}
