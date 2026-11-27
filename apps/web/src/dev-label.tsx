// SPDX-License-Identifier: Apache-2.0

// Which copy of the repository and which branch 'pnpm dev' runs from, shown in the top bar and the
// browser tab's title so copies running at once can be told apart. Builds and tests have none.

import { Badge, Tooltip } from "@mantine/core";
import { useCutTip } from "./cut-tip.ts";
import classes from "./layout.module.css";

export interface DevLabel {
  clone: string;
  branch: string;
}

// Set by vite.config.ts.
declare const FATHOM_DEV_LABEL: DevLabel | null;

export const devLabel: DevLabel | null = FATHOM_DEV_LABEL;

export function devTitle(title: string, label: DevLabel | null): string {
  return label === null ? title : `[${label.clone}] ${title}`;
}

export function DevBadge({ label }: { label: DevLabel | null }) {
  const { words: wordsRef, shown, target } = useCutTip();
  if (label === null) return null;
  const words = `Clone ${label.clone} · ${label.branch}`;
  return (
    <Tooltip label={words} opened={shown}>
      <Badge
        variant="light"
        color="orange"
        tt="none"
        visibleFrom="xs"
        className={classes.devLabel}
        {...target}
      >
        <span ref={wordsRef} className={classes.cutShort}>
          {words}
        </span>
      </Badge>
    </Tooltip>
  );
}
