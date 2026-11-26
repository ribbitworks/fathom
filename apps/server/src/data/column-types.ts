// SPDX-License-Identifier: Apache-2.0

// What each type of added column keeps and holds, so a new type is added in one place: a choice
// column draws on a list, takes its tier from the list, and holds choices from it, one or several; a
// web link column has a visibility of its own as its tier and holds one link, and a note or
// number column likewise holds one note or number. Values are as the change history records
// them: choices as a list of identifiers, a link as its address and text, a note as its Markdown,
// a number as a number, and no value as nothing or an empty list. Part of the data access layer.

import {
  type FieldType,
  fieldTypeSchema,
  isLink,
  isNumberValue,
  type Links,
  type Notes,
  type Numbers,
  type Tier,
} from "@fathom/shared";
import { storedTier } from "../access.ts";

// The settings a column keeps that depend on its type.
export interface TypeSettings {
  type: FieldType;
  listId: string | null;
  visibility: Tier | null;
  multiple: boolean;
  // Settings of types not offered yet, which every type offered leaves unset.
  multiline: false;
  linkedTable: null;
}

const laterSettingsUnset = { multiline: false, linkedTable: null } as const;

// A record's values as a draft shows them live: choices, links, notes, and numbers, by column.
export interface LiveValues {
  values: Record<string, string[]>;
  links: Links;
  notes: Notes;
  numbers: Numbers;
}

export const noLiveValues = (): LiveValues => ({
  values: {},
  links: {},
  notes: {},
  numbers: {},
});

export interface ColumnType {
  type: FieldType;
  // The settings a column of this type keeps, from those recorded or asked for.
  settings: (field: Record<string, unknown>) => TypeSettings;
  // The tier of the column's values, given the tier of each list as it should be read.
  tier: (settings: TypeSettings, listTier: (listId: string) => Tier) => Tier;
  // How many values a recorded value holds, none for one this type does not hold.
  count: (value: unknown) => number;
  // Whether a recorded value fits the column, other than whether one is required, given the list
  // each choice belongs to.
  fits: (
    settings: Pick<TypeSettings, "listId" | "multiple">,
    value: unknown,
    listOf: ReadonlyMap<string, string>,
  ) => boolean;
  // Adds a record's live value, or that it has none, to what its draft shows.
  showLive: (live: LiveValues, columnId: string, value: unknown) => void;
}

const choices = (value: unknown): string[] =>
  Array.isArray(value) ? value.map(String) : [];

const choice: ColumnType = {
  type: "choice",
  settings: (field) => ({
    type: "choice",
    listId: String(field.listId),
    visibility: null,
    multiple: field.multiple === true,
    ...laterSettingsUnset,
  }),
  tier: ({ listId }, listTier) => listTier(String(listId)),
  count: (value) => choices(value).length,
  fits: ({ listId, multiple }, value, listOf) => {
    const chosen = choices(value);
    return (
      (multiple || chosen.length <= 1) &&
      chosen.every((choiceId) => listOf.get(choiceId) === listId)
    );
  },
  showLive: (live, columnId, value) => {
    // The column is the person's own, named by their draft.
    // eslint-disable-next-line security/detect-object-injection
    live.values[columnId] = choices(value);
  },
};

// The settings and tier of a column with a visibility of its own, rather than a list's.
const withOwnVisibility = (
  type: Exclude<FieldType, "choice">,
): Pick<ColumnType, "settings" | "tier"> => ({
  settings: (field) => ({
    type,
    listId: null,
    visibility: storedTier(field.visibility),
    multiple: false,
    ...laterSettingsUnset,
  }),
  tier: ({ visibility }) => storedTier(visibility),
});

// No value, as a column of one value records it once its value is removed.
const isNone = (value: unknown) =>
  value === undefined ||
  value === null ||
  (Array.isArray(value) && value.length === 0);

const link: ColumnType = {
  type: "link",
  ...withOwnVisibility("link"),
  count: (value) => (isLink(value) ? 1 : 0),
  fits: (_settings, value) => isLink(value) || isNone(value),
  showLive: (live, columnId, value) => {
    if (isLink(value)) {
      // The column is the person's own, named by their draft.
      // eslint-disable-next-line security/detect-object-injection
      live.links[columnId] = { address: value.address, text: value.text };
    }
  },
};

export const isNote = (value: unknown): value is string =>
  typeof value === "string" && value !== "";

const note: ColumnType = {
  type: "note",
  ...withOwnVisibility("note"),
  count: (value) => (isNote(value) ? 1 : 0),
  fits: (_settings, value) => isNote(value) || isNone(value),
  showLive: (live, columnId, value) => {
    if (isNote(value)) {
      // The column is the person's own, named by their draft.
      // eslint-disable-next-line security/detect-object-injection
      live.notes[columnId] = value;
    }
  },
};

export const isNumber = (value: unknown): value is number =>
  typeof value === "number";

const number: ColumnType = {
  type: "number",
  ...withOwnVisibility("number"),
  count: (value) => (isNumber(value) ? 1 : 0),
  fits: (_settings, value) => isNumberValue(value) || isNone(value),
  showLive: (live, columnId, value) => {
    if (isNumber(value)) {
      // The column is the person's own, named by their draft.
      // eslint-disable-next-line security/detect-object-injection
      live.numbers[columnId] = value;
    }
  },
};

export const columnTypes: Readonly<Record<FieldType, ColumnType>> = {
  choice,
  link,
  note,
  number,
};

// Fields' live values, by the type of column each holds, which the value as recorded says.
export function liveValuesOf(
  recorded: ReadonlyMap<string, unknown>,
): LiveValues {
  const live = noLiveValues();
  for (const [columnId, value] of recorded) {
    Object.values(columnTypes)
      .find(({ count }) => count(value) > 0)
      ?.showLive(live, columnId, value);
  }
  return live;
}

// A column's type. Columns recorded before web link columns hold no type, and choose from a list. A
// type Fathom does not know is refused rather than read as another.
export function typeOf(field: { type?: unknown }): ColumnType {
  const type = fieldTypeSchema.safeParse(field.type ?? "choice");
  if (!type.success)
    throw new Error("A column has a type Fathom does not know");
  return columnTypes[type.data];
}
