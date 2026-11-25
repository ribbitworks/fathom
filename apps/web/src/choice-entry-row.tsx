// SPDX-License-Identifier: Apache-2.0

// The empty row at the end of a list's choices, starting with +, where a new choice is typed, or
// several pasted one to a line, for a list's panel and for a new list in a column's dialog alike.

import type { Meaning } from "@fathom/shared";
import { Fields } from "./choice-fields.tsx";
import type { useChoiceEntry } from "./choice-entry.ts";
import { Icon } from "./icons.tsx";
import classes from "./pages.module.css";

export function ChoiceEntryRow({
  entry,
  shape,
  meanings,
  weighed,
  problem,
  onFocus,
}: {
  entry: ReturnType<typeof useChoiceEntry>;
  shape: readonly (string | undefined)[];
  meanings: readonly Meaning[];
  weighed: boolean;
  // A refusal of the list as a whole, such as having no choices, shown when the typing has none.
  problem?: string | undefined;
  onFocus?: () => void;
}) {
  return (
    <div
      role="row"
      className={[...shape, classes.entry].join(" ")}
      // Leaving the empty row, by clicking or tabbing elsewhere, adds what was typed, as leaving a
      // choice being edited saves it.
      onBlur={(event) => {
        if (event.currentTarget.contains(event.relatedTarget)) return;
        entry.addEntry(false);
      }}
    >
      <span className={classes.plus} aria-hidden>
        <Icon name="plus" size={14} />
      </span>
      <Fields
        idPrefix="choice-entry"
        draft={entry.entry}
        problem={entry.entryProblem ?? problem}
        label="New choice "
        meanings={meanings}
        weighed={weighed}
        weightProblem={entry.entryWeightProblem}
        onChange={entry.change}
        onKeyDown={entry.onEntryKey}
        {...(onFocus === undefined ? {} : { onFocus })}
        onPaste={entry.paste}
        keepsEscape={`${entry.entry.label}${entry.entry.description}` !== ""}
      />
    </div>
  );
}
