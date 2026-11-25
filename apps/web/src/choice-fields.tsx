// SPDX-License-Identifier: Apache-2.0

// The fields a choice is typed into, in its row and in the list's empty row.

import {
  listLengths,
  type Meaning,
  meaningName,
  meaningSchema,
} from "@fathom/shared";
import type { ClipboardEvent, KeyboardEvent } from "react";
import { cellClasses, listClasses } from "./page-styles.ts";
import { Count } from "./list-dialog.tsx";

export interface Draft {
  label: string;
  description: string;
  // In a list with meanings; null in any other.
  meaning: Meaning | null;
  // As typed, in feature sizes; empty in any other list.
  weight: string;
}

export type Field = "label" | "description" | "meaning" | "weight";

export const emptyDraft = (meanings: readonly Meaning[]): Draft => ({
  label: "",
  description: "",
  meaning: meanings[0] ?? null,
  weight: "",
});

export function Fields({
  idPrefix,
  draft,
  problem,
  label,
  meanings,
  meaningKept,
  weighed,
  weightProblem: weightWrong,
  onChange,
  onKeyDown,
  onFocus,
  onPaste,
}: {
  idPrefix: "choice-entry" | "choice-edit";
  draft: Draft;
  problem: string | undefined;
  label: string;
  // The list's meanings, none unless it is a list with meanings.
  meanings: readonly Meaning[];
  // The meaning a choice must keep, as the last one offered for it.
  meaningKept?: Meaning | undefined;
  weighed: boolean;
  weightProblem: string | undefined;
  onChange: (draft: Draft) => void;
  onKeyDown: (event: KeyboardEvent, field: Field) => void;
  onFocus?: () => void;
  onPaste?: (event: ClipboardEvent<HTMLInputElement>) => void;
}) {
  const entry = idPrefix === "choice-entry";
  // A refused weight's reason is under the row's first cell, as any refused value's is.
  const shownProblem = problem ?? weightWrong;
  return (
    <>
      <span className={listClasses.choiceName} role="gridcell">
        <input
          id={`${idPrefix}-name`}
          className={cellClasses.cellInput}
          value={draft.label}
          aria-label={`${label}name`}
          aria-invalid={problem !== undefined}
          aria-describedby={problem ? `${idPrefix}-problem` : undefined}
          placeholder={entry ? "Name" : undefined}
          autoComplete="off"
          onChange={(event) => {
            onChange({ ...draft, label: event.currentTarget.value });
          }}
          onKeyDown={(event) => {
            onKeyDown(event, "label");
          }}
          onFocus={onFocus}
          onPaste={onPaste}
        />
        {(shownProblem ?? draft.label.length >= listLengths.choice - 5) && (
          <span className={cellClasses.cellBelow}>
            {shownProblem && (
              <span
                className={cellClasses.problem}
                id={`${idPrefix}-problem`}
                role="alert"
              >
                {shownProblem}
              </span>
            )}
            <Count
              length={draft.label.trim().length}
              maximum={listLengths.choice}
            />
          </span>
        )}
      </span>
      <span className={listClasses.choiceDescription} role="gridcell">
        <textarea
          id={`${idPrefix}-description`}
          className={cellClasses.cellInput}
          rows={1}
          value={draft.description}
          aria-label={`${label}description`}
          placeholder={entry ? "Description" : undefined}
          onChange={(event) => {
            onChange({ ...draft, description: event.currentTarget.value });
          }}
          onKeyDown={(event) => {
            onKeyDown(event, "description");
          }}
          onFocus={onFocus}
        />
      </span>
      {meanings.length > 0 && (
        <span className={listClasses.choiceMeaning} role="gridcell">
          <select
            id={`${idPrefix}-meaning`}
            className={cellClasses.cellInput}
            value={draft.meaning ?? ""}
            aria-label={`${label}meaning`}
            aria-describedby={
              meaningKept === undefined ? undefined : `${idPrefix}-meaning-kept`
            }
            disabled={meaningKept !== undefined}
            onChange={(event) => {
              onChange({
                ...draft,
                // The menu offers only the list's meanings.
                meaning: meaningSchema.parse(event.currentTarget.value),
              });
            }}
            onKeyDown={(event) => {
              onKeyDown(event, "meaning");
            }}
            onFocus={onFocus}
          >
            {draft.meaning === null && (
              <option value="" disabled>
                Choose a meaning
              </option>
            )}
            {meanings.map((meaning) => (
              <option key={meaning} value={meaning}>
                {meaningName(meaning)}
              </option>
            ))}
          </select>
          {meaningKept !== undefined && (
            <span
              className={cellClasses.cellBelow}
              id={`${idPrefix}-meaning-kept`}
            >
              Needed for {meaningName(meaningKept)}
            </span>
          )}
        </span>
      )}
      {weighed && (
        <span className={listClasses.choiceWeight} role="gridcell">
          <input
            id={`${idPrefix}-weight`}
            className={cellClasses.cellInput}
            value={draft.weight}
            inputMode="decimal"
            aria-label={`${label}weight`}
            aria-invalid={weightWrong !== undefined}
            aria-describedby={weightWrong ? `${idPrefix}-problem` : undefined}
            placeholder={entry ? "Weight" : undefined}
            autoComplete="off"
            onChange={(event) => {
              onChange({ ...draft, weight: event.currentTarget.value });
            }}
            onKeyDown={(event) => {
              onKeyDown(event, "weight");
            }}
            onFocus={onFocus}
          />
        </span>
      )}
    </>
  );
}
