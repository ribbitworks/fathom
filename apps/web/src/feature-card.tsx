// SPDX-License-Identifier: Apache-2.0

// A feature's card on the Features Board, and its dimmed Live copy.

import {
  type Feature,
  needsStaffing,
  type PlanChoices,
  type CardPart,
  shownRecordKey,
} from "@fathom/shared";
import { Menu, Text, UnstyledButton } from "@mantine/core";
import { type KeyboardEvent } from "react";
import { CardMenu } from "./card-menu.tsx";
import { focusFoundSoon } from "./focus.ts";
import { riskStep } from "./feature-board.ts";
import classes from "./feature-board-view.module.css";
import { draftRowClass } from "./list-drafts.tsx";
import { RiskMark, SizeMark } from "./planning-marks.tsx";
import { CopyLinkItem, isSaved } from "./record-key.tsx";
import { AlsoUnder } from "./grid-groups.tsx";
import {
  besideLive,
  DraftedItem,
  DraftedValue,
  MarkedItem,
  useDraftView,
} from "./status-mark.tsx";
import { type DraftLike, recordMark } from "./draft-marks.ts";
import type { OtherPlace } from "./row-groups.ts";
import { formatMonth } from "./day-formats.ts";

// The fields a card shows, so its own mark is left to drafts of what it doesn't show, such as a move.
const cardFields: ReadonlySet<string> = new Set([
  "name",
  "statusId",
  "priorityId",
  "sizeId",
  "riskId",
  "neededBy",
]);

export const cardId = (copy: string) => `card-${copy}`;
const cardAttribute = "data-card-of";

// Puts focus on a feature's card, such as once its details close: where it has a card in each of
// several rows, the one Tab reaches, which is the one last focused, or else its first.
export function focusCard(id: string): void {
  focusFoundSoon(() => {
    const cards = [
      ...document.querySelectorAll<HTMLElement>(
        `[${cardAttribute}="${CSS.escape(id)}"]`,
      ),
    ];
    return cards.find(({ tabIndex }) => tabIndex === 0) ?? cards[0];
  });
}

export function FeatureCard({
  id,
  feature,
  others,
  draft,
  choices,
  parts,
  selected,
  moves,
  tabIndex,
  onFocus,
  onKeyDown,
  onOpen,
}: {
  id: string;
  feature: Feature;
  // The other rows its feature has a card in.
  others: readonly OtherPlace[];
  // The feature's draft, whatever the view.
  draft: Feature["draft"];
  choices: PlanChoices;
  parts: ReadonlySet<CardPart>;
  selected: boolean;
  // Whether a draft moves a feature to another of the board's columns.
  moves: (feature: Pick<Feature, "draft">) => boolean;
  tabIndex: number;
  onFocus: () => void;
  onKeyDown: (event: KeyboardEvent) => void;
  onOpen: () => void;
}) {
  const show = useDraftView();
  const status = choices.featureStatuses.find(
    ({ id }) => id === feature.statusId,
  );
  const priority = choices.priorities.find(
    ({ id }) => id === feature.priorityId,
  );
  const size = choices.sizes.find(({ id }) => id === feature.sizeId);
  const risk = riskStep(choices.risks, feature.riskId);
  // Its own mark, for a draft of what it doesn't show, such as a move, which a box says.
  const marked = recordMark(draft, cardFields);
  const own: DraftLike | undefined = marked && {
    ...marked,
    moved: moves({ draft: marked }),
  };
  const value = (fields: string[], named: string) => ({
    draft,
    fields,
    named,
  });
  const notStaffed =
    parts.has("staffed") &&
    needsStaffing(
      status?.meaning,
      show === "live" ? feature.staffedLive : feature.staffed,
    );
  const record = { kind: "feature" as const, keyNumber: feature.keyNumber };
  return (
    <CardMenu
      name={feature.name}
      items={
        <>
          <Menu.Item onClick={onOpen}>Show details</Menu.Item>
          <CopyLinkItem record={record} />
        </>
      }
    >
      {({ onContextMenu, onMenuKey }) => (
        <UnstyledButton
          id={cardId(id)}
          {...{ [cardAttribute]: feature.id }}
          component="div"
          role="button"
          className={[
            classes.card,
            draftRowClass(draft, besideLive(show)),
            selected ? classes.selected : "",
          ].join(" ")}
          tabIndex={tabIndex}
          aria-current={selected || undefined}
          onFocus={onFocus}
          onContextMenu={onContextMenu}
          onKeyDown={(event: KeyboardEvent<HTMLElement>) => {
            if (onMenuKey(event)) return;
            if (event.key === "Enter" || event.key === " ") {
              event.preventDefault();
              onOpen();
            } else onKeyDown(event);
          }}
          onClick={onOpen}
        >
          <Text
            component="span"
            fw={500}
            size="sm"
            className={[classes.line, classes.name].join(" ")}
          >
            <DraftedItem draft={own} heldBy={feature.heldBy}>
              <DraftedValue {...value(["name"], "Name")}>
                {feature.name}
              </DraftedValue>
            </DraftedItem>
            <AlsoUnder others={others} />
          </Text>
          {parts.has("key") && isSaved(record) && (
            <Text component="span" size="xs" className={classes.key}>
              {shownRecordKey("feature", feature.keyNumber)}
            </Text>
          )}
          {(parts.has("status") || (parts.has("priority") && priority)) && (
            <Text component="span" size="xs" className={classes.words}>
              {parts.has("status") && status !== undefined && (
                <DraftedValue {...value(["statusId"], "Status")}>
                  <span
                    className={
                      status.meaning === "possible"
                        ? classes.possible
                        : undefined
                    }
                  >
                    {status.name}
                  </span>
                </DraftedValue>
              )}
              {parts.has("status") &&
                parts.has("priority") &&
                priority &&
                " · "}
              {parts.has("priority") && priority !== undefined && (
                <DraftedValue {...value(["priorityId"], "Priority")}>
                  {priority.name} priority
                </DraftedValue>
              )}
            </Text>
          )}
          {parts.has("size") && size !== undefined && (
            <span className={classes.line}>
              <DraftedValue {...value(["sizeId"], "Size")}>
                <SizeMark name={size.name} weight={size.weight} />
              </DraftedValue>
            </span>
          )}
          {parts.has("risk") && risk !== undefined && (
            <span className={classes.line}>
              <DraftedValue {...value(["riskId"], "Risk")}>
                <RiskMark {...risk} />
              </DraftedValue>
            </span>
          )}
          {parts.has("neededBy") && feature.neededBy !== null && (
            <Text component="span" size="xs" className={classes.line}>
              <DraftedValue {...value(["neededBy"], "Needed by")}>
                Needed by {formatMonth(feature.neededBy)}
              </DraftedValue>
            </Text>
          )}
          {notStaffed && (
            <Text component="span" size="xs" className={classes.line}>
              <MarkedItem
                tone="warning"
                words="Not staffed"
                spoken="it's planned or in progress, with nobody allocated to it"
              />
            </Text>
          )}
        </UnstyledButton>
      )}
    </CardMenu>
  );
}

export function LiveCard({ feature }: { feature: Feature }) {
  return (
    <div className={[classes.card, classes.liveCard].join(" ")}>
      <Text component="span" size="sm" className={classes.line}>
        <MarkedItem tone="live">{feature.name}</MarkedItem>
      </Text>
    </div>
  );
}
