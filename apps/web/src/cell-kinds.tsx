// SPDX-License-Identifier: Apache-2.0

// Each kind of cell in a table of records, such as text, a date, choices or a note: how its value
// is read, shown, pasted, saved and edited.

import {
  type ChangeValue,
  type Choice,
  choiceNamed,
  type ColumnValues,
  isDay,
  layOutDropsDigits,
  isLink,
  type Link,
  linkInWords,
  cleanNote,
  linkLabel,
  notePlainText,
  noteProblem,
  isMonth,
  numberProblem,
  numberProblemFor,
  roundedUpTo,
  typedDay,
  typedInPlace,
  typedMonth,
  typedNumber,
  tidiedText,
  type OptionalColumnValueMap,
  type SomeRequestedColumnValues,
  type Typing,
  webAddress,
  webAddressSample,
  daySample,
  monthSample,
  typeFor,
  durationRefusalWords,
  durationText,
  parseDuration,
} from "@fathom/shared";
import type { ReactNode } from "react";
import { type Adding, ChoicePicker, type Finish } from "./choice-picker.tsx";
import { FlagCell } from "./flag-field.tsx";
import { LinkCell, LinkEditor, LinkMenuItem } from "./link-field.tsx";
import {
  NoteCell,
  noteCellChars,
  NotePanel,
  notePreview,
} from "./note-editor.tsx";
import { choice as choiceOf, offered } from "./lists.ts";
import { lengthUnit } from "./duration-cells.ts";
import { decimal, decimalUpTo } from "./numbers.ts";
import {
  type CellValue,
  type Kind,
  type TableColumn,
  unitAmountWords,
} from "./table-view.ts";
import { asText } from "./table-rows.ts";
import { formatDay, formatMonth } from "./day-formats.ts";

type AnyColumn = Pick<
  TableColumn<never>,
  | "key"
  | "label"
  | "multiple"
  | "unit"
  | "places"
  | "emptyLabel"
  | "choicesInWords"
  | "choiceColour"
  | "lengths"
> & {
  choices: readonly Choice[];
  // Whether a choice may be put in a cell, apart from being offered in its list: any may, unless
  // told otherwise.
  pickable?: ((choice: Choice) => boolean) | undefined;
  required: boolean;
  // For text columns: the most characters a value may hold.
  maxLength?: number | undefined;
  // For number columns: the least and most a value may be.
  least?: number | undefined;
  most?: number | undefined;
};

// The choices a column's values may name, and the unit its numbers are in.
type Choices = Pick<
  AnyColumn,
  "choices" | "unit" | "places" | "choicesInWords"
>;

type OptionalMaps = {
  [Name in OptionalColumnValueMap]?: Readonly<ColumnValues[Name]> | undefined;
};

// A record's details and its values in added columns, as it is or as its draft shows it live.
export interface CellSource extends OptionalMaps {
  [detail: string]: unknown;
  values: Readonly<Record<string, string[]>>;
  links: Readonly<ColumnValues["links"]>;
}

// The change that saves a value: a detail by its key, or an added column's choices or link.
export interface CellChange extends SomeRequestedColumnValues {
  [detail: string]: unknown;
  values?: Record<string, string[]> | undefined;
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
  // For a picker of records that may add one: its New option.
  adding?: Adding | undefined;
  onDone: (value: CellValue, how: Finish) => void;
  onCancel: () => void;
}

export interface CellKind {
  // What clears a cell.
  empty: CellValue;
  read: (source: CellSource, key: string) => CellValue;
  inWords: (column: Choices, value: CellValue) => string;
  // A value as a draft's details show it, beside the change history: choices as their names, a link's
  // address whole, a day in words.
  inDetail: (column: Choices, value: CellValue) => ChangeValue;
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
  // The change that saves a record's value, given, for a kind whose typing depends on it, such as a
  // length's bare number, the column.
  change: (
    key: string,
    value: CellValue,
    column?: Pick<AnyColumn, "lengths">,
  ) => CellChange;
  // How many characters the column's cells fit, given the longest text it held when the page
  // opened.
  width: (column: AnyColumn, longestText: number) => number;
  // Whether the column's longest text sets its width.
  measured: boolean;
  // Whether the metrics break rows down by a column of the kind, unless the table says otherwise:
  // always, by choices or months; never, for free text and what is one per record, such as names,
  // notes and web links; or only while not required, for those split into Populated and Empty,
  // since a required one is always filled in.
  breaksDown: "always" | "never" | "unless required";
  Editor?: (props: EditorProps) => ReactNode;
  // What every column of the kind offers, whatever its own settings, such as a checkbox's Yes,
  // and No for unchecked, which its filter and metrics name.
  columnDefaults?: { choices: Choice[]; emptyLabel: string };
  // For a kind edited in one step, such as a checkbox: the value editing gives, in place of an
  // editor.
  toggled?: (value: CellValue) => CellValue;
  // For a kind edited as text and laid out as it is typed, such as a date: the text to show, and
  // where its cursor goes.
  asTyped?: (typing: Typing) => Typing;
  // For a kind edited in the side panel beside the table, such as a note: a click opens it too,
  // read only where the cell may not change.
  inPanel?: boolean;
  // Whether its cells and its column's heading are centred, as a checkbox's are.
  centred?: boolean;
  Cell?: (props: { value: CellValue }) => ReactNode;
  MenuItem?: (props: { name: string; value: CellValue }) => ReactNode;
}

// The key is one of the record's own details, held as text.
const detail = (source: CellSource, key: string): string => {
  // eslint-disable-next-line security/detect-object-injection
  const held = source[key];
  return typeof held === "string" ? held : "";
};

// Text and dates are held as text, as details of the record itself, each kind saving its own way.
const detailText: Omit<CellKind, "change" | "inDetail"> = {
  empty: "",
  read: detail,
  inWords: (_column, value) => asText(value),
  problem: (column, value) =>
    column.maxLength !== undefined &&
    asText(value).trim().length > column.maxLength
      ? `${column.label} is too long`
      : undefined,
  pasted: (_column, content) => ({ value: content }),
  width: (_column, longestText) => longestText,
  measured: true,
  breaksDown: "never",
};

// A kind whose added columns hold their values as text in one of a record's maps, by column, and
// whose built-in columns hold theirs as fields of the record itself: how each is read, and saved as
// kept, or as none.
function heldAsText(
  map: "texts" | "days",
  kept: (value: CellValue) => string | null,
  savedOwn: (value: CellValue) => unknown,
): Pick<CellKind, "read" | "inDetail" | "ownField" | "change"> {
  return {
    // The map is the kind's own, and the key a column's own.
    // eslint-disable-next-line security/detect-object-injection
    read: (source, key) => source[map]?.[key] ?? "",
    inDetail: (_column, value) => asText(value),
    ownField: {
      read: (held) => (typeof held === "string" ? held : ""),
      save: savedOwn,
    },
    change: (key, value) => ({ [map]: { [key]: kept(value) } }),
  };
}

const text: CellKind = {
  ...detailText,
  ...heldAsText(
    "texts",
    (value) => {
      const kept = tidiedText(asText(value));
      return kept === "" ? null : kept;
    },
    (value) => asText(value).trim(),
  ),
  problem: (column, value) =>
    asText(value).trim().includes("\n")
      ? `${column.label}: use one line`
      : detailText.problem(column, value),
};

const twelveMonths = Array.from(
  { length: 12 },
  (_, month) => `2026-${String(month + 1).padStart(2, "0")}`,
);

// A calendar value as saved: laid out as typed, such as 2027-03, or null for none.
const laidOutOrNone = (layOut: (typed: string) => string, value: CellValue) => {
  const typed = layOut(asText(value));
  return typed === "" ? null : typed;
};

// A cell of a calendar value, kept as text in the form typed, such as 2027-03, and shown in words.
function calendarKind({
  layOut,
  isWhole,
  inWords,
  noun,
  sample,
  samples,
  breaksDown,
}: {
  layOut: (typed: string) => string;
  isWhole: (typed: string) => boolean;
  inWords: (value: string) => string;
  // What a refusal asks for, and an example of one typed.
  noun: string;
  sample: string;
  // Values among which the longest in words is found.
  samples: readonly string[];
  breaksDown: CellKind["breaksDown"];
}): CellKind {
  const longest = Math.max(...samples.map((sample) => inWords(sample).length));
  const shown = (_column: Choices, value: CellValue) =>
    isWhole(asText(value)) ? inWords(asText(value)) : asText(value);
  return {
    ...detailText,
    inWords: shown,
    // A draft's details show it in words too, rather than as kept.
    inDetail: shown,
    problem: (column, value) => {
      const typed = layOut(asText(value));
      return layOutDropsDigits(layOut, asText(value)) ||
        (typed !== "" && !isWhole(typed))
        ? typeFor(noun, column.label, sample)
        : undefined;
    },
    change: (key, value) => ({ [key]: laidOutOrNone(layOut, value) }),
    width: () => longest,
    measured: false,
    breaksDown,
    asTyped: typedInPlace(layOut),
    pasted: (_column, content) => ({ value: layOut(content) }),
  };
}

// The 28th is in every month, so the longest name of a month is among these.
const day = calendarKind({
  layOut: typedDay,
  isWhole: isDay,
  inWords: formatDay,
  noun: "date",
  sample: daySample,
  samples: twelveMonths.map((month) => `${month}-28`),
  breaksDown: "unless required",
});

const dayOrNone = (value: CellValue) => laidOutOrNone(typedDay, value);

// A day is shown in words in a draft's details too, as the built-in days are.
const date: CellKind = {
  ...day,
  ...heldAsText("days", dayOrNone, dayOrNone),
  inDetail: day.inDetail,
};

const month = calendarKind({
  layOut: typedMonth,
  isWhole: isMonth,
  inWords: formatMonth,
  noun: "month",
  sample: monthSample,
  samples: twelveMonths,
  // By each month, as a deadline's rows are wanted.
  breaksDown: "always",
});

const typedOf = (value: CellValue) => typedNumber(asText(value));

// A number as the reader's language writes it, rounded up to the column's decimal places, if any.
export const numberShown = (column: Pick<Choices, "places">, held: number) =>
  column.places === undefined
    ? decimal(held)
    : decimalUpTo(held, column.places);

// The text a cell's editor opens with: its value, or, for a number shown to fewer decimal places
// than it holds, the number as shown, which, left unchanged, keeps the value as it is.
export function startingText(column: Choices, value: string): string {
  const held = typedOf(value);
  return held === undefined || column.places === undefined
    ? value
    : String(roundedUpTo(held, column.places));
}

// A number in words, followed by its unit's code, if any.
const numberInWords = (column: Choices, held: number) =>
  column.unit === undefined
    ? numberShown(column, held)
    : `${numberShown(column, held)} ${column.unit.code}`;

const number: CellKind = {
  ...detailText,
  breaksDown: "unless required",
  read: (source, key) => {
    // The key is a column's own.
    // eslint-disable-next-line security/detect-object-injection
    const held = source.numbers?.[key];
    return held === undefined ? "" : String(held);
  },
  inWords: (column, value) => {
    const held = typedOf(value);
    return held === undefined ? asText(value) : numberInWords(column, held);
  },
  // As typed, followed by the unit's words, if any, such as 40 hours or 1 hour.
  inDetail: (column, value) =>
    column.unit === undefined || asText(value) === ""
      ? asText(value)
      : unitAmountWords(asText(value), Number(value), column.unit),
  ownField: {
    read: (held) => (typeof held === "number" ? String(held) : ""),
    save: (value) => typedOf(value) ?? null,
  },
  problem: (column, value) => {
    const problem = numberProblem(asText(value));
    if (problem !== undefined) return numberProblemFor(problem, column.label);
    const held = typedOf(value);
    if (held === undefined) return undefined;
    if (column.least !== undefined && held < column.least) {
      return `Use ${decimal(column.least)} or more for ${column.label}`;
    }
    return column.most !== undefined && held > column.most
      ? `Use ${decimal(column.most)} or less for ${column.label}`
      : undefined;
  },
  pasted: (_column, content) => ({ value: content.trim() }),
  change: (key, value) => ({ numbers: { [key]: typedOf(value) ?? null } }),
};

// A length as typed, such as 2 wk, read and saved in a record's durations; a bare number takes the
// unit the column shows, or else its own.
const duration: CellKind = {
  ...detailText,
  read: (source, key) => {
    // The key is a column's own.
    // eslint-disable-next-line security/detect-object-injection
    const held = source.durations?.[key];
    return held === undefined ? "" : durationText(held);
  },
  inDetail: (_column, value) => asText(value),
  problem: (column, value) => {
    const read = parseDuration(asText(value), lengthUnit(column));
    return "refused" in read
      ? durationRefusalWords(read.refused, column.label)
      : undefined;
  },
  pasted: (_column, content) => ({ value: content.trim() }),
  change: (key, value, column = {}) => {
    const read = parseDuration(asText(value), lengthUnit(column));
    return {
      durations: { [key]: "duration" in read ? read.duration : null },
    };
  },
};

// Whether a cell may be given a choice: one offered in its list that the column lets be picked.
const pickable = (column: AnyColumn, option: Choice) =>
  offered(option) && (column.pickable?.(option) ?? true);

// The choices a cell offers: those it may be given, and any others it already has.
const choicesFor = (column: AnyColumn, value: readonly string[]) =>
  column.choices
    .filter((option) => pickable(column, option) || value.includes(option.id))
    .map((option) => ({
      value: option.id,
      label: option.label,
      ...(option.description === "" ? {} : { description: option.description }),
      ...(column.choiceColour === undefined
        ? {}
        : { colour: column.choiceColour(option.id) }),
    }));

const chosen = (value: CellValue) => value as string[];

// The names of the choices a value holds, leaving out any no longer known.
export const labels = (column: Choices, value: CellValue): string[] =>
  chosen(value).flatMap((id) => {
    const label = column.choices.find((option) => option.id === id)?.label;
    return label === undefined ? [] : [label];
  });

// The colour of the one choice a value holds, where the column's choices have colours.
export const chosenColour = (
  column: Pick<AnyColumn, "multiple" | "choiceColour">,
  value: CellValue,
): string | null => {
  if (column.choiceColour === undefined || column.multiple) return null;
  const [id] = chosen(value);
  return id === undefined ? null : column.choiceColour(id);
};

// The choices a value of several holds, each with its colour, where the column's choices have
// colours; otherwise none, and the value is drawn in words.
export const colouredChoices = (
  column: Choices & Pick<AnyColumn, "multiple" | "choiceColour">,
  value: CellValue,
) => {
  const { choiceColour } = column;
  if (choiceColour === undefined || !column.multiple) return undefined;
  return chosen(value).flatMap((id) => {
    const name = column.choices.find((option) => option.id === id)?.label;
    return name === undefined ? [] : [{ id, name, colour: choiceColour(id) }];
  });
};

const choice: CellKind = {
  empty: [],
  // The key is a column's own.
  // eslint-disable-next-line security/detect-object-injection
  read: (source, key) => source.values[key] ?? [],
  inWords: (column, value) =>
    column.choicesInWords?.(chosen(value)) ?? labels(column, value).join(", "),
  inDetail: (column, value) =>
    column.choicesInWords?.(chosen(value)) ?? labels(column, value),
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
    const named = choiceNamed(
      column.choices.filter((option) => pickable(column, option)),
      content,
    );
    switch (named.match) {
      case "one":
        return { value: [named.choice.id] };
      case "none":
        return { problem: `No ${column.label} called ${content}` };
      case "several":
        return {
          problem: `More than one ${column.label} is called ${content}`,
        };
    }
  },
  change: (key, value) => ({ values: { [key]: chosen(value) } }),
  width: (column) =>
    column.choices.reduce(
      (longest, { label }) => Math.max(longest, label.length),
      0,
    ),
  measured: false,
  breaksDown: "always",
  Editor: ({
    id,
    column,
    value,
    typed,
    invalid,
    describedBy,
    adding,
    onDone,
    onCancel,
  }) => (
    <ChoicePicker
      id={id}
      label={column.label}
      invalid={invalid}
      describedBy={describedBy}
      options={choicesFor(column, chosen(value))}
      none={column.required ? undefined : (column.emptyLabel ?? "None")}
      multiple={column.multiple}
      initial={chosen(value)}
      typed={typed}
      adding={adding}
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
      ? { problem: typeFor("web address", column.label, webAddressSample) }
      : { value: { address, text: "" } };
  },
  change: (key, value) => ({ links: { [key]: linkOf(value) } }),
  width: (_column, longestText) => longestText,
  measured: true,
  breaksDown: "never",
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
export const noteOf = (value: CellValue): string => value as string;

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
  breaksDown: "never",
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

// A checkbox, checked when it holds its one choice: a ticked box in an added column, or a detail
// held as true or false.
export const flagChoice = "yes";

export const toggledFlag = (value: CellValue): CellValue =>
  chosen(value).length > 0 ? [] : [flagChoice];

const flagValue = (held: unknown): CellValue =>
  held === true ? [flagChoice] : [];

const flag: CellKind = {
  empty: [],
  problem: () => undefined,
  measured: false,
  // The key is a column's own.
  // eslint-disable-next-line security/detect-object-injection
  read: (source, key) => flagValue(source.flags?.[key]),
  ownField: {
    read: flagValue,
    save: (value) => chosen(value).length > 0,
  },
  inWords: (_column, value) => (chosen(value).length > 0 ? "Yes" : "No"),
  inDetail: (_column, value) => (chosen(value).length > 0 ? "Yes" : "No"),
  pasted: (column, content) => {
    const word = content.trim().toLowerCase();
    if (["yes", "y", "true", "x", "1"].includes(word)) {
      return { value: [flagChoice] };
    }
    if (["no", "n", "false", "", "0"].includes(word)) return { value: [] };
    return { problem: `Choose Yes or No for ${column.label}` };
  },
  change: (key, value) => ({
    flags: { [key]: chosen(value).length > 0 ? true : null },
  }),
  width: () => 3,
  breaksDown: "always",
  toggled: toggledFlag,
  centred: true,
  columnDefaults: {
    choices: [choiceOf(flagChoice, "Yes", false)],
    emptyLabel: "No",
  },
  Cell: ({ value }) => <FlagCell checked={chosen(value).length > 0} />,
};

export const cellKinds: Readonly<Record<Kind, CellKind>> = {
  text,
  date,
  month,
  number,
  duration,
  choice,
  link,
  note,
  flag,
};
