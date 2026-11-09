// SPDX-License-Identifier: Apache-2.0

// What each kind of cell in a table of records holds and how it behaves, so a new kind of column is
// added in one place: text, such as a name; a date; choices from a list; a web link; a note; and
// a checkbox. Each kind says how a record's value is read, live or as drafted, what clears it, how it
// reads in words, what a pasted cell gives, the change that saves it, how wide its column is, and
// whether its column is worth breaking down by. A kind with an editor, cell, or menu item of its
// own names it; the rest are edited as text and shown in words.

import {
  type ChangeValue,
  type Choice,
  isDay,
  isLink,
  type Link,
  linkInWords,
  cleanNote,
  linkLabel,
  notePlainText,
  noteProblem,
  isMonth,
  typedDay,
  typedMonth,
  webAddress,
} from "@fathom/shared";
import type { ReactNode } from "react";
import { ChoicePicker, type Finish } from "./choice-picker.tsx";
import { digitsAsTyped } from "./day-input.tsx";
import { FlagCell } from "./flag-field.tsx";
import { LinkCell, LinkEditor, LinkMenuItem } from "./link-field.tsx";
import {
  NoteCell,
  noteCellChars,
  NotePanel,
  notePreview,
} from "./note-editor.tsx";
import { offered, sameName } from "./lists.ts";
import {
  type CellValue,
  formatDay,
  formatMonth,
  type Kind,
  type TableColumn,
} from "./table-view.ts";

type AnyColumn = Pick<TableColumn<never>, "key" | "label" | "multiple"> & {
  choices: readonly Choice[];
  // Whether a choice may be put in a cell, apart from being offered in its list: any may, unless
  // told otherwise.
  pickable?: ((choice: Choice) => boolean) | undefined;
  required: boolean;
  // For text columns: the most characters a value may hold.
  maxLength?: number | undefined;
};

// The choices a column's values may name.
type Choices = Pick<AnyColumn, "choices">;

// A record's details and its values in added columns, as it is or as its draft shows it live.
export interface CellSource {
  [detail: string]: unknown;
  values: Readonly<Record<string, string[]>>;
  links: Readonly<Record<string, Link>>;
  notes?: Readonly<Record<string, string>> | undefined;
}

// The change that saves a value: a detail by its key, or an added column's choices or link.
export interface CellChange {
  [detail: string]: unknown;
  values?: Record<string, string[]> | undefined;
  links?: Record<string, Link | null> | undefined;
  notes?: Record<string, string | null> | undefined;
}

export interface EditorProps {
  id: string;
  column: AnyColumn;
  value: CellValue;
  // What was typed to start editing.
  typed: string;
  // Whether the value was refused or is wrong, and what names why, when it is shown.
  invalid: boolean;
  describedBy?: string | undefined;
  // For an editor that shows its own problem, such as a note's panel: why its value was refused.
  problem?: string | undefined;
  // Whether the cell may only be read, for a kind whose editor also shows its value whole.
  readOnly: boolean;
  // For an editor in the side panel: whether a value is being changed there, so the table waits for
  // it, rather than only read.
  onWriting?: (writing: boolean) => void;
  // For an editor in the side panel: whether the value now differs from the one it opened with.
  onChanged?: (changed: boolean) => void;
  onDone: (value: CellValue, how: Finish) => void;
  onCancel: () => void;
}

export interface CellKind {
  // What clears a cell.
  empty: CellValue;
  read: (source: CellSource, key: string) => CellValue;
  inWords: (column: Choices, value: CellValue) => string;
  // A value as a draft's details show it, beside the change history, when it differs from the cell:
  // choices as their names, and a link's address whole.
  inDetail?: (column: Choices, value: CellValue) => ChangeValue;
  // What is wrong with a value besides its being needed, if anything.
  problem: (column: AnyColumn, value: CellValue) => string | undefined;
  // For a kind that saves apart from a record's own fields: how it reads and saves when it is held
  // as a field of the record itself, as the plan's records hold theirs.
  ownField?: {
    read: (held: unknown) => CellValue;
    save: (value: CellValue, multiple: boolean) => unknown;
  };
  // What a cell's pasted text gives, or what is wrong with it.
  pasted: (
    column: AnyColumn,
    content: string,
  ) => { value: CellValue } | { problem: string };
  // The change that saves a record's value.
  change: (key: string, value: CellValue) => CellChange;
  // How many characters the column's cells fit, given the longest text it held when the page
  // opened.
  width: (column: AnyColumn, longestText: number) => number;
  // Whether the column's longest text sets its width.
  measured: boolean;
  // Whether a required column is still worth breaking down by: required text, such as names, is
  // always filled in, so is not.
  breaksDownWhenRequired: boolean;
  Editor?: (props: EditorProps) => ReactNode;
  // For a kind edited in one step, such as a checkbox: the value editing gives, in place of an
  // editor.
  toggled?: (value: CellValue) => CellValue;
  // For a kind edited as text and laid out as it is typed, such as a date: the text to show.
  asTyped?: (text: string) => string;
  // For a kind edited in the side panel beside the table, such as a note: a click opens it too,
  // read only where the cell may not change.
  inPanel?: boolean;
  Cell?: (props: { value: CellValue }) => ReactNode;
  MenuItem?: (props: { name: string; value: CellValue }) => ReactNode;
}

// The key is one of the record's own details, held as text.
const detail = (source: CellSource, key: string): string => {
  // eslint-disable-next-line security/detect-object-injection
  const held = source[key];
  return typeof held === "string" ? held : "";
};

// Text and dates are held as text.
const asText = (value: CellValue) => value as string;

const text: CellKind = {
  empty: "",
  read: detail,
  inWords: (_column, value) => asText(value),
  problem: (column, value) =>
    column.maxLength !== undefined &&
    asText(value).trim().length > column.maxLength
      ? `${column.label} too long`
      : undefined,
  pasted: (_column, content) => ({ value: content }),
  change: (key, value) => ({ [key]: asText(value).trim() }),
  width: (_column, longestText) => longestText,
  measured: true,
  breaksDownWhenRequired: false,
};

const twelveMonths = Array.from(
  { length: 12 },
  (_, month) => `2026-${String(month + 1).padStart(2, "0")}`,
);

// A cell of a calendar value, kept as text in the form typed, such as 2027-03, and shown in words.
function calendarKind({
  layOut,
  isWhole,
  inWords,
  example,
  samples,
}: {
  layOut: (typed: string) => string;
  isWhole: (typed: string) => boolean;
  inWords: (value: string) => string;
  example: string;
  // Values among which the longest in words is found.
  samples: readonly string[];
}): CellKind {
  const longest = Math.max(...samples.map((sample) => inWords(sample).length));
  return {
    ...text,
    inWords: (_column, value) =>
      isWhole(asText(value)) ? inWords(asText(value)) : asText(value),
    problem: (column, value) => {
      const typed = layOut(asText(value));
      return typed !== "" && !isWhole(typed)
        ? `${column.label}: use ${example}`
        : undefined;
    },
    change: (key, value) => {
      const typed = layOut(asText(value));
      return { [key]: typed === "" ? null : typed };
    },
    width: () => longest,
    measured: false,
    breaksDownWhenRequired: false,
    asTyped: digitsAsTyped(layOut),
    pasted: (_column, content) => ({ value: layOut(content) }),
  };
}

// The 28th is in every month, so the longest name of a month is among these.
const date = calendarKind({
  layOut: typedDay,
  isWhole: isDay,
  inWords: formatDay,
  example: "a date such as 2026-10-31",
  samples: twelveMonths.map((month) => `${month}-28`),
});

const month = calendarKind({
  layOut: typedMonth,
  isWhole: isMonth,
  inWords: formatMonth,
  example: "a month such as 2027-03",
  samples: twelveMonths,
});

// Whether a cell may be given a choice: one offered in its list that the column lets be picked.
const pickable = (column: AnyColumn, option: Choice) =>
  offered(option) && (column.pickable?.(option) ?? true);

// The choices a cell offers: those it may be given, and any others it already has.
const choicesFor = (column: AnyColumn, value: readonly string[]) =>
  column.choices
    .filter((option) => pickable(column, option) || value.includes(option.id))
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
  ownField: {
    read: (held) => {
      if (Array.isArray(held)) return held as string[];
      return typeof held === "string" ? [held] : [];
    },
    save: (value, multiple) =>
      multiple ? value : (chosen(value).at(0) ?? null),
  },
  problem: () => undefined,
  pasted: (column, content) => {
    const found = column.choices.find(
      (option) => pickable(column, option) && sameName(option.label, content),
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
  Editor: ({
    id,
    column,
    value,
    typed,
    invalid,
    describedBy,
    onDone,
    onCancel,
  }) => (
    <ChoicePicker
      id={id}
      label={column.label}
      invalid={invalid}
      describedBy={describedBy}
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
  ownField: {
    read: (held) =>
      typeof held === "string" && held !== ""
        ? { address: held, text: "" }
        : null,
    save: (value) => linkOf(value)?.address ?? null,
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
  Editor: ({
    id,
    column,
    value,
    typed,
    invalid,
    describedBy,
    onDone,
    onCancel,
  }) => (
    <LinkEditor
      id={id}
      name={column.label}
      invalid={invalid}
      describedBy={describedBy}
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

// A note column's cells always hold a note's Markdown, empty for none.
const noteOf = (value: CellValue): string => value as string;

const note: CellKind = {
  empty: "",
  // The key is a column's own.
  // eslint-disable-next-line security/detect-object-injection
  read: (source, key) => source.notes?.[key] ?? "",
  inWords: (_column, value) => notePreview(noteOf(value)),
  inDetail: (_column, value) => notePlainText(noteOf(value)),
  problem: (_column, value) => noteProblem(noteOf(value)),
  ownField: {
    read: (held) => (typeof held === "string" ? held : ""),
    save: (value) => (noteOf(value) === "" ? null : noteOf(value)),
  },
  pasted: (_column, content) => ({ value: cleanNote(content) }),
  change: (key, value) => ({
    notes: { [key]: noteOf(value) === "" ? null : noteOf(value) },
  }),
  width: () => noteCellChars,
  measured: false,
  breaksDownWhenRequired: false,
  inPanel: true,
  Editor: ({
    id,
    column,
    value,
    problem,
    readOnly,
    onWriting,
    onChanged,
    onDone,
    onCancel,
  }) => (
    <NotePanel
      id={id}
      title={column.label}
      note={noteOf(value)}
      refused={problem}
      canEdit={!readOnly}
      onWriting={onWriting}
      onChanged={onChanged}
      onSave={(saved) => {
        onDone(saved, "leave");
      }}
      onClose={onCancel}
    />
  ),
  Cell: ({ value }) => <NoteCell note={noteOf(value)} />,
};

// A checkbox, read from a detail held as true or false, checked when it holds its one choice.
export const flagChoice = "yes";

export const toggledFlag = (value: CellValue): CellValue =>
  chosen(value).length > 0 ? [] : [flagChoice];

const flag: CellKind = {
  empty: [],
  problem: () => undefined,
  measured: false,
  read: (source, key) =>
    // eslint-disable-next-line security/detect-object-injection
    source[key] === true ? [flagChoice] : [],
  inWords: (_column, value) => (chosen(value).length > 0 ? "Yes" : "No"),
  inDetail: (_column, value) => (chosen(value).length > 0 ? "Yes" : "No"),
  pasted: (column, content) => {
    const word = content.trim().toLowerCase();
    if (["yes", "y", "true", "x", "1"].includes(word)) {
      return { value: [flagChoice] };
    }
    if (["no", "n", "false", "", "0"].includes(word)) return { value: [] };
    return { problem: `${column.label}: use Yes or No` };
  },
  change: (key, value) => ({ [key]: chosen(value).length > 0 }),
  width: () => 3,
  breaksDownWhenRequired: true,
  toggled: toggledFlag,
  Cell: ({ value }) => <FlagCell checked={chosen(value).length > 0} />,
};

export const cellKinds: Readonly<Record<Kind, CellKind>> = {
  text,
  date,
  month,
  choice,
  link,
  note,
  flag,
};
