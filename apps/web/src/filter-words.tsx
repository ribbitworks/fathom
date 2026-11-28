// SPDX-License-Identifier: Apache-2.0

// A table's filter in words, as its pill and saved views name it.

import { formatDay, formatDayRange } from "./day-formats.ts";
import { ColouredNames } from "./colour-swatch.tsx";
import { shownBound } from "./duration-cells.ts";
import { decimal } from "./numbers.ts";
import type { Filter, Kind, TableColumn } from "./table-view.ts";

type AnyColumn = Pick<
  TableColumn<never>,
  | "label"
  | "kind"
  | "choices"
  | "emptyLabel"
  | "choiceColour"
  | "lengths"
  | "places"
>;

export const noDate = "No date";

export const noDuration = "No duration";

// What a filter's choice of every value that isn't empty is called, matching its Empty box. A
// checkbox's filter offers none, since a checkbox is never empty, but an address or saved view may
// still hold one, which its pill names.
export const notEmptyLabels: Record<Kind, string> = {
  text: "Not empty",
  month: "Not empty",
  link: "Not empty",
  note: "Not empty",
  choice: "Not empty",
  flag: "Not empty",
  date: "Any date",
  number: "Any number",
  duration: "Any duration",
};

// A filter in words, such as "Site: Harbour, Northmere".
export function describeFilter(column: AnyColumn, filter: Filter): string {
  // Any value matches, so nothing else the filter holds narrows it further.
  if (filter.notEmpty === true) {
    return `${column.label}: ${notEmptyLabels[column.kind]}`;
  }
  const parts: string[] = [];
  switch (column.kind) {
    case "choice":
    case "flag":
      parts.push(
        ...column.choices
          .filter((choice) => (filter.any ?? []).includes(choice.id))
          .map((choice) => choice.label),
      );
      if (filter.empty) parts.push(column.emptyLabel ?? "Empty");
      return `${column.label}: ${parts.join(", ")}`;
    case "date": {
      const { from, to } = filter;
      if (from !== undefined && to !== undefined) {
        parts.push(formatDayRange(from, to));
      } else if (from !== undefined) {
        parts.push(`from ${formatDay(from)}`);
      } else if (to !== undefined) {
        parts.push(`until ${formatDay(to)}`);
      }
      if (filter.empty) parts.push(noDate);
      return `${column.label}: ${parts.join(" or ")}`;
    }
    case "number":
    case "duration": {
      // A length's bounds are kept in days and named in the unit shown, such as at least 2 wk.
      const shown = (bound: number) =>
        column.kind === "duration" ? shownBound(column, bound) : decimal(bound);
      const { atLeast, atMost } = filter;
      if (atLeast !== undefined && atMost !== undefined) {
        parts.push(`${shown(atLeast)} to ${shown(atMost)}`);
      } else if (atLeast !== undefined) {
        parts.push(`at least ${shown(atLeast)}`);
      } else if (atMost !== undefined) {
        parts.push(`at most ${shown(atMost)}`);
      }
      if (filter.empty) {
        parts.push(column.kind === "duration" ? noDuration : "No number");
      }
      return `${column.label}: ${parts.join(" or ")}`;
    }
    case "text":
    case "month":
    case "link":
    case "note": {
      const contains = (filter.contains ?? "").trim();
      if (contains !== "") parts.push(`contains “${contains}”`);
      if (filter.empty) parts.push("Empty");
      return `${column.label}: ${parts.join(" or ")}`;
    }
  }
}

// A filter as its pill names it: a choice column's coloured choices each after its square, others
// in words.
export function FilterWords({
  column,
  filter,
}: {
  column: AnyColumn;
  filter: Filter;
}) {
  const { choiceColour } = column;
  if (
    column.kind !== "choice" ||
    choiceColour === undefined ||
    filter.notEmpty === true
  ) {
    return describeFilter(column, filter);
  }
  const names = column.choices
    .filter((choice) => (filter.any ?? []).includes(choice.id))
    .map(({ id, label }) => ({ id, name: label, colour: choiceColour(id) }));
  return (
    <>
      {`${column.label}: `}
      <ColouredNames
        names={[
          ...names,
          ...(filter.empty === true
            ? [{ id: "", name: column.emptyLabel ?? "Empty", colour: null }]
            : []),
        ]}
      />
    </>
  );
}
