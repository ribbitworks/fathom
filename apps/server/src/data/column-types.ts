// SPDX-License-Identifier: Apache-2.0

// What each type of column on People keeps and holds, so a new type is added in one place: a choice
// column draws on a list, takes its tier from the list, and holds choices from it, one or several; a
// web link column has a visibility of its own as its tier and holds one link. Values are as the
// change history records them: choices as a list of identifiers, a link as its address and text,
// and no value as nothing or an empty list. Part of the data access layer.

import { type FieldType, isLink, type Links, type Tier } from "@fathom/shared";
import { storedTier } from "../access.ts";

// The settings a column keeps that depend on its type.
export interface TypeSettings {
  type: FieldType;
  listId: string | null;
  visibility: Tier | null;
  multiple: boolean;
}

// A person's values as a draft shows them live: choices by column, and links by column.
export interface LiveValues {
  values: Record<string, string[]>;
  links: Links;
}

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
  // Adds a person's live value, or that they have none, to what their draft shows.
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

const link: ColumnType = {
  type: "link",
  settings: (field) => ({
    type: "link",
    listId: null,
    visibility: storedTier(field.visibility),
    multiple: false,
  }),
  tier: ({ visibility }) => storedTier(visibility),
  count: (value) => (isLink(value) ? 1 : 0),
  fits: (_settings, value) =>
    isLink(value) ||
    value === undefined ||
    value === null ||
    (Array.isArray(value) && value.length === 0),
  showLive: (live, columnId, value) => {
    if (isLink(value)) {
      // The column is the person's own, named by their draft.
      // eslint-disable-next-line security/detect-object-injection
      live.links[columnId] = { address: value.address, text: value.text };
    }
  },
};

export const columnTypes: Readonly<Record<FieldType, ColumnType>> = {
  choice,
  link,
};

// A column's type. Columns recorded before web link columns hold no type, and choose from a list.
export const typeOf = (field: { type?: unknown }): ColumnType =>
  field.type === "link" ? link : choice;
