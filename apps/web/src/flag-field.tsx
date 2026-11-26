// SPDX-License-Identifier: Apache-2.0

// A checkbox in a table cell, shown checked or not; the table checks and clears it in one step.

import { VisuallyHidden } from "@mantine/core";
import classes from "./flag-field.module.css";

export function FlagCell({ checked }: { checked: boolean }) {
  return (
    <span className={[classes.flag, classes.textBaseline].join(" ")}>
      <input
        type="checkbox"
        className={classes.box}
        checked={checked}
        readOnly
        tabIndex={-1}
        aria-hidden
      />
      <VisuallyHidden>{checked ? "Yes" : "No"}</VisuallyHidden>
    </span>
  );
}
