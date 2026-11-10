// SPDX-License-Identifier: Apache-2.0

// Labels naming feature teams, each in its team's colour, and the one tooltip that gives a label's
// whole name, since a tooltip for each of thousands of labels would slow a large table down.

import type { PaletteColour } from "@fathom/shared";
import { Tooltip, VisuallyHidden } from "@mantine/core";
import { type MouseEvent, type ReactNode, useState } from "react";
import { colourVariable } from "./colours.ts";
import pages from "./pages.module.css";
import { DraftDot, type DraftLike } from "./status-mark.tsx";
import styles from "./team-labels.module.css";

const tipAttribute = "data-label-tip";

// Whether a draft adds someone to a team or takes them off it, when it does either.
export type DraftedLabel = "added" | "removed";

const draftedWords = new Map<DraftedLabel, string>([
  ["added", ", added"],
  ["removed", ", removed"],
]);

export function TeamLabels({
  teams,
}: {
  teams: readonly {
    id: string;
    name: string;
    colour: PaletteColour | null;
    drafted?: DraftedLabel | undefined;
    // The draft adding the team, whose dot the label shows.
    addedBy?: DraftLike | undefined;
  }[];
}) {
  return (
    <div className={styles.labels}>
      {teams.map(({ id, name, colour, drafted, addedBy }) => (
        <span
          key={id}
          className={[
            styles.label,
            colour === null ? styles.labelNoColour : "",
            drafted === "removed" ? pages.struck : "",
          ].join(" ")}
          {...{ [tipAttribute]: name }}
          style={
            colour === null
              ? undefined
              : {
                  background: colourVariable(colour, "light"),
                  color: colourVariable(colour, "light-color"),
                }
          }
        >
          {addedBy !== undefined && <DraftDot draft={addedBy} />}
          {name}
          {drafted !== undefined && (
            <VisuallyHidden>{draftedWords.get(drafted)}</VisuallyHidden>
          )}
        </span>
      ))}
    </div>
  );
}

export function TeamLabelTips({ children }: { children: ReactNode }) {
  const [tip, setTip] = useState<{ element: HTMLElement; text: string }>();
  const showTip = (event: MouseEvent<HTMLElement>) => {
    const element = (event.target as HTMLElement).closest<HTMLElement>(
      `[${tipAttribute}]`,
    );
    setTip((current) =>
      element === null
        ? undefined
        : current?.element === element
          ? current
          : { element, text: element.getAttribute(tipAttribute) as string },
    );
  };
  return (
    <div
      className={styles.tips}
      onMouseOver={showTip}
      onMouseLeave={() => {
        setTip(undefined);
      }}
    >
      {tip !== undefined && (
        <Tooltip
          opened
          label={tip.text}
          target={tip.element}
          className={styles.tip}
        />
      )}
      {children}
    </div>
  );
}
