// SPDX-License-Identifier: Apache-2.0

// The dimmed live copy of a choice a draft changes or moves, shown in a list's panel beside the
// choice as drafted.

import type { Choice, Meaning } from "@fathom/shared";
import { listClasses, recordTableClasses } from "./page-styles.ts";
import { choiceRowFields, meaningText, weightText } from "./choice-row.tsx";
import { recordMark } from "./draft-marks.ts";
import { LiveRowMarks, LiveValue } from "./status-mark.tsx";

// The moved choices grouped by the choice their live place is just after, or by null for the top,
// as the live order has them.
export function movedLiveAfter(
  offered: readonly Choice[],
  liveOrder: readonly string[],
  moved: ReadonlyMap<string, number>,
): Map<string | null, Choice[]> {
  const offeredIds = new Set(offered.map(({ id }) => id));
  const liveOffered = liveOrder.filter((id) => offeredIds.has(id));
  const after = new Map<string | null, Choice[]>();
  for (const choice of offered) {
    if (!moved.has(choice.id)) continue;
    const previous = liveOffered[liveOffered.indexOf(choice.id) - 1] ?? null;
    after.set(previous, [...(after.get(previous) ?? []), choice]);
  }
  return after;
}

export function LiveChoiceRow({
  choice,
  moved,
  shape,
  meanings,
  weighed,
}: {
  choice: Choice;
  moved: boolean;
  shape: readonly (string | undefined)[];
  meanings: readonly Meaning[];
  weighed: boolean;
}) {
  const liveMeaning = choice.draft?.live.meaning ?? choice.meaning;
  const liveWeight = choice.draft?.live.weight ?? choice.weight;
  return (
    <div
      className={[...shape, recordTableClasses.choiceLive].join(" ")}
      aria-hidden="true"
    >
      <span className={listClasses.choiceName}>
        <LiveRowMarks
          marked={
            moved || recordMark(choice.draft, choiceRowFields) !== undefined
          }
        >
          <LiveValue draft={choice.draft} fields={["label"]}>
            {choice.draft?.live.label ?? choice.label}
          </LiveValue>
        </LiveRowMarks>
      </span>
      <span className={listClasses.choiceDescription}>
        <LiveValue
          draft={choice.draft}
          fields={["description"]}
          emptied={
            (choice.draft?.live.description ?? choice.description) === ""
              ? "Description"
              : undefined
          }
        >
          {choice.draft?.live.description ?? choice.description}
        </LiveValue>
      </span>
      {meanings.length > 0 && (
        <span className={listClasses.choiceMeaning}>
          {meaningText(liveMeaning)}
        </span>
      )}
      {weighed && (
        <span className={listClasses.choiceWeight}>
          {weightText(liveWeight)}
        </span>
      )}
    </div>
  );
}
