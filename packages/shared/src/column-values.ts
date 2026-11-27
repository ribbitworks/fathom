// SPDX-License-Identifier: Apache-2.0

// The values a record holds in the columns added to its table: choices, and a map by column for
// each type of column holding one value, as requests send them and readers receive them.

import { z } from "zod";
import { type Link, linkValueSchema } from "./links.ts";
import { numberValueSchema } from "./numbers.ts";
import { textValueSchema } from "./text-values.ts";

// The most choices one column can hold for one person.
const choicesLimit = 100;

// The chosen choices of each column, by column, in the list's order. A column with nothing chosen
// is left out.
export const valuesSchema = z.record(z.string(), z.array(z.string()));

// Each web link column's link, by column. A column with no link is left out.
export const linksSchema = z.record(
  z.string(),
  z.object({ address: z.string(), text: z.string() }),
);

export type Links = Record<string, Link>;

// Links asked for, by column; null removes a column's link.
export const requestedLinksSchema = z.record(
  z.uuid(),
  linkValueSchema.nullable(),
);

// Each note column's note, as Markdown, by column. A column with no note is left out. The server
// always names them, if only as none.
export const notesSchema = z.record(z.string(), z.string());

export type Notes = Record<string, string>;

// Notes asked for, by column, as Markdown, which the server checks; null or an empty note removes a
// column's note.
export const requestedNotesSchema = z.record(z.uuid(), z.string().nullable());

// Each number column's number, by column. A column with no number is left out.
export const numbersSchema = z.record(z.string(), z.number());

export type Numbers = Record<string, number>;

// Numbers asked for, by column; null removes a column's number.
export const requestedNumbersSchema = z.record(
  z.uuid(),
  numberValueSchema.nullable(),
);

// Each checkbox column whose box is ticked, by column. A column with its box unticked is left out.
export const flagsSchema = z.record(z.string(), z.literal(true));

export type Flags = Record<string, true>;

// Boxes asked for, by column; null unticks a column's box.
export const requestedFlagsSchema = z.record(
  z.uuid(),
  z.literal(true).nullable(),
);

// Each text column's text, by column. A column with no text is left out.
export const textsSchema = z.record(z.string(), z.string());

export type Texts = Record<string, string>;

// Texts asked for, by column, which each column checks; null or empty text removes a column's text.
export const requestedTextsSchema = z.record(z.uuid(), textValueSchema);

// Choices asked for, by column: each a choice's identifier, at most once.
export const requestedValuesSchema = z.record(
  z.uuid(),
  z
    .array(z.uuid())
    .max(choicesLimit)
    .refine((ids) => new Set(ids).size === ids.length, "Each choice once"),
);

// The maps of values a record keeps by column, one for each type of added column holding one value,
// beside its choices in values.
export const columnValueMaps = [
  "links",
  "notes",
  "numbers",
  "flags",
  "texts",
] as const;

export type ColumnValueMap = (typeof columnValueMaps)[number];

// The maps some records leave out when empty. Readers always receive links, so they are never
// left out.
export type OptionalColumnValueMap = Exclude<ColumnValueMap, "links">;

export const optionalColumnValueMaps = columnValueMaps.filter(
  (map): map is OptionalColumnValueMap => map !== "links",
);

interface ColumnValueOf {
  links: Link;
  notes: string;
  numbers: number;
  flags: true;
  texts: string;
}

// One column's value in a map.
export type ColumnValue<Kind extends ColumnValueMap> = ColumnValueOf[Kind];

export type ColumnValues = {
  [Kind in ColumnValueMap]: Record<string, ColumnValue<Kind>>;
};

// Null removes a column's value.
export type RequestedColumnValues = {
  [Kind in ColumnValueMap]: Record<string, ColumnValue<Kind> | null>;
};

export type SomeColumnValues = {
  readonly [Kind in ColumnValueMap]?:
    Readonly<Record<string, ColumnValue<Kind>>> | undefined;
};

export type SomeRequestedColumnValues = {
  readonly [Kind in ColumnValueMap]?:
    Readonly<Record<string, ColumnValue<Kind> | null>> | undefined;
};

const columnValueSchemas = {
  links: linksSchema,
  notes: notesSchema,
  numbers: numbersSchema,
  flags: flagsSchema,
  texts: textsSchema,
} satisfies { [Kind in ColumnValueMap]: z.ZodType<ColumnValues[Kind]> };

const requestedColumnValueSchemas = {
  links: requestedLinksSchema,
  notes: requestedNotesSchema,
  numbers: requestedNumbersSchema,
  flags: requestedFlagsSchema,
  texts: requestedTextsSchema,
} satisfies {
  [Kind in ColumnValueMap]: z.ZodType<RequestedColumnValues[Kind]>;
};

// An object with an entry for each map. Object.fromEntries can't keep each map's own type, which
// Out names.
export const eachColumnValueMap = <Out extends Record<ColumnValueMap, unknown>>(
  each: <Kind extends ColumnValueMap>(map: Kind) => Out[Kind],
): Out =>
  Object.fromEntries(columnValueMaps.map((map) => [map, each(map)])) as Out;

const valuesGiven = <Kinds extends ColumnValueMap>(
  maps: readonly Kinds[],
  each: (map: Kinds) => object | undefined,
) =>
  Object.fromEntries(
    maps.flatMap((map) => {
      const values = each(map);
      return values === undefined ? [] : [[map, values]];
    }),
  );

// The maps given that hold values, and none of the others.
export const columnValueMapsOf = <Kinds extends ColumnValueMap>(
  maps: readonly Kinds[],
  each: <Kind extends Kinds>(
    map: Kind,
  ) => Readonly<Record<string, ColumnValue<Kind>>> | undefined,
) =>
  valuesGiven(maps, each) as {
    [Kind in Kinds]?: Record<string, ColumnValue<Kind>>;
  };

// The maps given that hold values asked for, and none of the others.
export const requestedColumnValueMapsOf = <Kinds extends ColumnValueMap>(
  maps: readonly Kinds[],
  each: <Kind extends Kinds>(
    map: Kind,
  ) => Readonly<Record<string, ColumnValue<Kind> | null>> | undefined,
) =>
  valuesGiven(maps, each) as {
    [Kind in Kinds]?: Record<string, ColumnValue<Kind> | null>;
  };

export const columnValuesIn = (record: ColumnValues): ColumnValues =>
  eachColumnValueMap<ColumnValues>(
    (map) =>
      // The map is one of the record's own.
      // eslint-disable-next-line security/detect-object-injection
      record[map],
  );

export const noColumnValues = (): ColumnValues =>
  eachColumnValueMap<ColumnValues>(() => ({}));

const defaultedToNone = <Schemas extends Record<ColumnValueMap, z.ZodRecord>>(
  schemas: Schemas,
) =>
  eachColumnValueMap<{ [Kind in ColumnValueMap]: z.ZodDefault<Schemas[Kind]> }>(
    <Kind extends ColumnValueMap>(map: Kind) =>
      // The map is one of the schemas' own, and every one is a record, for which none is a value.
      // eslint-disable-next-line security/detect-object-injection
      schemas[map].default(
        {} as z.core.util.NoUndefined<z.output<Schemas[Kind]>>,
      ),
  );

// A record's maps as a reader receives them where every map is always given.
export const givenColumnValues = defaultedToNone(columnValueSchemas);

// A record's maps as a reader receives them where only links are always given.
export const shownColumnValues = {
  ...z.object(columnValueSchemas).partial().shape,
  links: linksSchema.default({}),
};

// A new record's values in the columns added to its table, each column named by its identifier.
export const requestedColumnValues = {
  values: requestedValuesSchema.default({}),
  ...z.object(requestedColumnValueSchemas).partial().shape,
  links: z.record(z.uuid(), linkValueSchema).default({}),
};

// A new or changed record's values where each map not sent is asked for as none.
export const plannedColumnValues = {
  values: requestedValuesSchema.default({}),
  ...defaultedToNone(requestedColumnValueSchemas),
};

// A change to a record's values in the columns added to its table: each column named is replaced.
export const changedColumnValues = {
  values: requestedValuesSchema.optional(),
  ...z.object(requestedColumnValueSchemas).partial().shape,
};

// The columns values are asked for in, of every type.
export const askedColumnIds = (asked: {
  readonly [Kind in ColumnValueMap | "values"]?:
    Readonly<Record<string, unknown>> | undefined;
}): string[] =>
  ["values" as const, ...columnValueMaps].flatMap((map) =>
    // The map is one of the record's own, named just above.
    // eslint-disable-next-line security/detect-object-injection
    Object.keys(asked[map] ?? {}),
  );
