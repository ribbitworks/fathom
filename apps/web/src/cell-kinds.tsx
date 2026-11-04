// SPDX-License-Identifier: Apache-2.0

// What each kind of cell on the People table holds and how it behaves, so a new kind of column is
// added in one place: text, such as a name; a date; choices from a list; and a web link. Each kind
// says how a person's value is read, live or as drafted, what clears it, how it reads in words, what
// a pasted cell gives, the change that saves it, how wide its column is, and whether its column is
// worth breaking down by. A kind with an editor, cell, or menu item of its own names it; the rest
// are edited as text and shown in words.

import {
  type ChangeValue,
  type Choice,
  isLink,
  type Link,
  linkInWords,
  linkLabel,
  type PersonChange,
  type PersonDraft,
  personLengths,
  webAddress,
} from "@fathom/shared";
import type { ReactNode } from "react";
import { ChoicePicker, type Finish } from "./choice-picker.tsx";
import { LinkCell, LinkEditor, LinkMenuItem } from "./link-field.tsx";
import { offered, sameName } from "./lists.ts";
import {
  type CellValue,
  formatDay,
  isDay,
  type Kind,
  type TableColumn,
} from "./table-view.ts";

type AnyColumn = Pick<TableColumn<never>, "key" | "label" | "multiple"> & {
  choices: readonly Choice[];
  required: boolean;
};

// The choices a column's values may name.
type Choices = Pick<AnyColumn, "choices">;

// A person's details and values, as they are or as their draft shows them live.
type Source = PersonDraft["live"];

export interface EditorProps {
  id: string;
  column: AnyColumn;
  value: CellValue;
  // What was typed to start editing.
  typed: string;
  onDone: (value: CellValue, how: Finish) => void;
  onCancel: () => void;
}

export interface CellKind {
  // What clears a cell.
  empty: CellValue;
  read: (source: Source, key: string) => CellValue;
  inWords: (column: Choices, value: CellValue) => string;
  // A value as a draft's details show it, beside the change history, when it differs from the cell:
  // choices as their names, and a link's address whole.
  inDetail?: (column: Choices, value: CellValue) => ChangeValue;
  // What is wrong with a value besides its being needed, if anything.
  problem: (column: AnyColumn, value: CellValue) => string | undefined;
  // What a cell's pasted text gives, or what is wrong with it.
  pasted: (
    column: AnyColumn,
    content: string,
  ) => { value: CellValue } | { problem: string };
  // The change that saves a person's value.
  change: (key: string, value: CellValue) => PersonChange;
  // How many characters the column's cells fit, given the longest text it held when the page opened.
  width: (column: AnyColumn, longestText: number) => number;
  // Whether the column's longest text sets its width.
  measured: boolean;
  // Whether a required column is still worth breaking down by: required text, such as names, is
  // always filled in, so is not.
  breaksDownWhenRequired: boolean;
  Editor?: (props: EditorProps) => ReactNode;
  Cell?: (props: { value: CellValue }) => ReactNode;
  MenuItem?: (props: { name: string; value: CellValue }) => ReactNode;
}

// The key is one of the person's own details.
const detail = (source: Source, key: string): string =>
  source[key as "preferredName"] ?? "";

// Text and dates are held as text.
const asText = (value: CellValue) => value as string;

const text: CellKind = {
  empty: "",
  read: detail,
  inWords: (_column, value) => asText(value),
  problem: (column, value) => {
    const limit =
      column.key === "employeeId"
        ? personLengths.employeeId
        : personLengths.preferredName;
    return asText(value).trim().length > limit
      ? `${column.label} too long`
      : undefined;
  },
  pasted: (_column, content) => ({ value: content }),
  change: (key, value) => ({ [key]: asText(value).trim() }),
  width: (_column, longestText) => longestText,
  measured: true,
  breaksDownWhenRequired: false,
};

// The 28th is in every month, so this tries each month's name.
const longestDay = Math.max(
  ...Array.from(
    { length: 12 },
    (_, month) =>
      formatDay(`2026-${String(month + 1).padStart(2, "0")}-28`).length,
  ),
);

const date: CellKind = {
  ...text,
  inWords: (_column, value) =>
    isDay(asText(value)) ? formatDay(asText(value)) : asText(value),
  problem: (column, value) =>
    asText(value) !== "" && !isDay(asText(value))
      ? `${column.label}: use a date such as 2026-10-31`
      : undefined,
  change: (key, value) => ({ [key]: value === "" ? null : value }),
  width: () => longestDay,
  measured: false,
  breaksDownWhenRequired: false,
};

// The choices a cell offers: those offered in its list, and any retired ones it already has.
const choicesFor = (column: AnyColumn, value: readonly string[]) =>
  column.choices
    .filter((option) => offered(option) || value.includes(option.id))
    .map((option) => ({ value: option.id, label: option.label }));

const chosen = (value: CellValue) => value as string[];

// The names of the choices a value holds, leaving out any no longer known.
const labels = (column: Choices, value: CellValue): string[] =>
  chosen(value).flatMap((id) => {
    const label = column.choices.find((option) => option.id === id)?.label;
    return label === undefined ? [] : [label];
  });

const choice: CellKind = {
  empty: [],
  // The key is a column's own.
  // eslint-disable-next-line security/detect-object-injection
  read: (source, key) => source.values[key] ?? [],
  inWords: (column, value) => labels(column, value).join(", "),
  inDetail: labels,
  problem: () => undefined,
  pasted: (column, content) => {
    const found = column.choices.find(
      (option) => offered(option) && sameName(option.label, content),
    );
    return found === undefined
      ? { problem: `No ${column.label} called ${content}` }
      : { value: [found.id] };
  },
  change: (key, value) => ({ values: { [key]: chosen(value) } }),
  width: (column) =>
    column.choices.reduce(
      (longest, { label }) => Math.max(longest, label.length),
      0,
    ),
  measured: false,
  breaksDownWhenRequired: true,
  Editor: ({ id, column, value, typed, onDone, onCancel }) => (
    <ChoicePicker
      id={id}
      label={column.label}
      options={choicesFor(column, chosen(value))}
      multiple={column.multiple}
      initial={chosen(value)}
      typed={typed}
      onDone={onDone}
      onCancel={onCancel}
    />
  ),
};

const linkOf = (value: CellValue): Link | null =>
  isLink(value) ? value : null;

const link: CellKind = {
  empty: null,
  // The key is a column's own.
  // eslint-disable-next-line security/detect-object-injection
  read: (source, key) => source.links[key] ?? null,
  inWords: (_column, value) => {
    const held = linkOf(value);
    return held === null ? "" : linkLabel(held);
  },
  inDetail: (_column, value) => {
    const held = linkOf(value);
    return held === null ? "" : linkInWords(held);
  },
  problem: () => undefined,
  pasted: (column, content) => {
    const address = webAddress(content);
    return address === null
      ? { problem: `${column.label}: ${content} is not a web address` }
      : { value: { address, text: "" } };
  },
  change: (key, value) => ({ links: { [key]: linkOf(value) } }),
  width: (_column, longestText) => longestText,
  measured: true,
  breaksDownWhenRequired: false,
  Editor: ({ id, column, value, typed, onDone, onCancel }) => (
    <LinkEditor
      id={id}
      name={column.label}
      initial={linkOf(value) ?? undefined}
      typed={typed === "" ? undefined : typed}
      onDone={onDone}
      onCancel={onCancel}
    />
  ),
  Cell: ({ value }) => {
    const held = linkOf(value);
    return held === null ? "" : <LinkCell link={held} />;
  },
  MenuItem: ({ name, value }) => {
    const held = linkOf(value);
    return held === null ? null : <LinkMenuItem name={name} link={held} />;
  },
};

export const cellKinds: Readonly<Record<Kind, CellKind>> = {
  text,
  date,
  choice,
  link,
};
