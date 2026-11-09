// SPDX-License-Identifier: Apache-2.0

// The state of a feature team panel's Takes effect from box, for those who may date changes. It
// shows the date of the team's draft, or today. A date typed moves every change in the draft to it
// when the box is left, or is refused when there is nothing to date, and a date that can't be used
// holds up other changes rather than letting them take effect today unasked.

import type { FeatureTeam } from "@fathom/shared";
import { useState } from "react";
import { focusSoon } from "./focus.ts";
import { today } from "./today.ts";

const laterDayProblem = "Use today or an earlier date";
const nothingToDateProblem = "Make a change first";
export const dateBoxId = "feature-team-takes-effect-from";

const hasChangesToDate = (team: FeatureTeam | undefined): boolean =>
  team?.draft?.changed.some(
    (field) => field === "members" || field === "leadId",
  ) === true;

export function useDraftDateBox(
  team: FeatureTeam | undefined,
  canDate: boolean,
  moveChanges: (team: FeatureTeam, from: string, onFailed: () => void) => void,
) {
  const [from, setFrom] = useState<string>();
  const [unfinished, setUnfinished] = useState(false);
  const [emptied, setEmptied] = useState(false);
  const [checked, setChecked] = useState(false);
  const [nothingToDate, setNothingToDate] = useState(false);
  const [boxCount, setBoxCount] = useState(0);
  const draftDays = new Set([
    ...Object.values(team?.draft?.days ?? {}),
    ...(team?.draft?.leadDay === undefined ? [] : [team.draft.leadDay]),
  ]);
  const severalDays = draftDays.size > 1;
  const [onlyDraftDay] = severalDays ? [] : draftDays;
  const clearTyping = () => {
    setFrom(undefined);
    setUnfinished(false);
    setEmptied(false);
    setChecked(false);
    setNothingToDate(false);
  };
  // Once the draft's day changes, by this box or by Undo, the draft says what the day is.
  const [lastDraftDay, setLastDraftDay] = useState(onlyDraftDay);
  if (onlyDraftDay !== lastDraftDay) {
    setLastDraftDay(onlyDraftDay);
    clearTyping();
  }
  const boxDay = canDate ? (from ?? onlyDraftDay) : undefined;
  const laterDay = boxDay !== undefined && boxDay > today();
  const reset = () => {
    clearTyping();
    setBoxCount((count) => count + 1);
  };
  const apply = () => {
    setChecked(true);
    if (unfinished || laterDay) return;
    if (emptied) {
      reset();
      return;
    }
    if (from === undefined) return;
    if (!hasChangesToDate(team)) {
      const typedAnotherDay = from !== today();
      reset();
      setNothingToDate(typedAnotherDay);
      return;
    }
    if (!severalDays && from === (onlyDraftDay ?? today())) return;
    // The box is only shown for a team.
    moveChanges(team as FeatureTeam, from, reset);
  };
  const problem = (): string | undefined => {
    if (laterDay) return laterDayProblem;
    return nothingToDate ? nothingToDateProblem : undefined;
  };
  return {
    // A new box each time the draft's day changes or the box is started again.
    boxKey: `${onlyDraftDay ?? ""} ${String(boxCount)}`,
    // Runs a change with the box's day, unless the box holds a date that can't be used.
    withDay: (send: (day: string | undefined) => void) => {
      if (unfinished || laterDay) {
        setChecked(true);
        return;
      }
      setNothingToDate(false);
      send(boxDay === today() ? undefined : boxDay);
    },
    reset,
    box: {
      id: dateBoxId,
      shown: checked,
      value: boxDay ?? (severalDays ? undefined : today()),
      problem: problem(),
      ...(severalDays ? { placeholder: "Several dates" } : {}),
      onChange: (day: string | undefined, typed: boolean) => {
        setFrom(day);
        setUnfinished(day === undefined && typed);
        setEmptied(!typed);
        setChecked(false);
        setNothingToDate(false);
      },
      onBlur: apply,
      onKeyDown: (event: React.KeyboardEvent<HTMLInputElement>) => {
        if (event.key === "Enter") event.currentTarget.blur();
        if (event.key === "Escape") {
          event.preventDefault();
          reset();
          focusSoon(dateBoxId);
        }
      },
    },
  };
}
