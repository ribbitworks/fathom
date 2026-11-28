// SPDX-License-Identifier: Apache-2.0

// The box on a planned hire's card saying who fills it and the day they start, in at most two lines:
// the name cut short where it doesn't fit, with the whole name in a tip, and the day kept whole.

import { Tooltip } from "@mantine/core";
import { useCutTip } from "./cut-tip.ts";
import { filledByWords } from "./feature-teams.ts";
import { type FillerWords } from "./org-chart.ts";
import classes from "./org-chart.module.css";
import marks from "./status-mark.module.css";
import { FactBox } from "./status-mark.tsx";

export function FillerBox({
  filled: { name, starts },
}: {
  filled: FillerWords;
}) {
  const { words, shown, target } = useCutTip();
  return (
    <FactBox alone wraps>
      <span data-filler>
        <Tooltip label={name} opened={shown}>
          <span className={classes.fillerLine} {...target}>
            {filledByWords}{" "}
            <span ref={words} className={classes.fillerName}>
              {name}
            </span>
            {starts !== undefined && ","}
          </span>
        </Tooltip>
        {starts !== undefined && (
          <>
            {" "}
            <span className={marks.fromDay}>{starts}</span>
          </>
        )}
      </span>
    </FactBox>
  );
}
