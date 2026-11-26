// SPDX-License-Identifier: Apache-2.0

// What the server is told of an export, and the classified data an export holds, in words.

import { z } from "zod";
import { type Permission, type Tier, tierSchema } from "./access.ts";
import type { ColumnTable } from "./people.ts";
import { classifiedFieldSchema, classNames } from "./data-classes.ts";
import { allOf } from "./words.ts";

const columnTables = [
  "people",
  "features",
  "activities",
] as const satisfies readonly ColumnTable[];

const fixedTables = ["accounts"] as const;

export type FixedClassTable = (typeof fixedTables)[number];

// The tables whose columns carry classes the server can check: those that can have columns added,
// and those whose columns' classes are fixed.
export const exportedTableSchema = z.enum([...columnTables, ...fixedTables]);

export type ExportedTable = z.infer<typeof exportedTableSchema>;

export const isFixedClassTable = (
  table: ExportedTable,
): table is FixedClassTable =>
  (fixedTables as readonly string[]).includes(table);

// A column by its heading and its class.
export interface ClassedColumn {
  name: string;
  dataClass: Tier;
}

// Accounts' columns by key. An account's name and email address say who holds it, so they are
// Personal.
export const accountColumnClasses = {
  name: { name: "Name", dataClass: "personal" },
  email: { name: "Email address", dataClass: "personal" },
  roles: { name: "Roles", dataClass: "general" },
  status: { name: "Status", dataClass: "general" },
  created: { name: "Created", dataClass: "general" },
} as const satisfies Readonly<Record<string, ClassedColumn>>;

// The tables whose columns' classes are fixed rather than set on Data classes: what an export of
// each is recorded as, the permission that shows the table, and its columns by key.
export const fixedClassTables: Readonly<
  Record<
    FixedClassTable,
    {
      name: string;
      viewNeeds: Permission;
      columns: ReadonlyMap<string, ClassedColumn>;
    }
  >
> = {
  accounts: {
    name: "Accounts",
    viewNeeds: "administration:view",
    columns: new Map(Object.entries(accountColumnClasses)),
  },
};

// The most columns an export names, well past any table's, so one entry stays small.
const mostColumns = 200;
const keyLength = 100;

// The columns exported, by key, which the server finds each one's class and name by itself, so an
// entry in the access history says only what the server holds.
export const exportRequestSchema = z.object({
  table: exportedTableSchema,
  // The classified details the rows hold apart from their columns, such as the hiring plan, which
  // planned hires' rows are.
  details: z
    .array(classifiedFieldSchema)
    .max(classifiedFieldSchema.options.length)
    .refine((details) => new Set(details).size === details.length, {
      error: "Each detail is exported once",
    })
    .default([]),
  columns: z
    .array(z.string().min(1).max(keyLength))
    .min(1)
    .max(mostColumns)
    .refine((keys) => new Set(keys).size === keys.length, {
      error: "Each column is exported once",
    }),
});

export type ExportRequest = z.infer<typeof exportRequestSchema>;

export const exportRecordedSchema = z.object({ recorded: z.boolean() });

export type ExportRecorded = z.infer<typeof exportRecordedSchema>;

export type ClassifiedTier = Exclude<Tier, "general">;

// The columns of each classified tier an export holds, by heading.
export type ClassifiedColumns = Readonly<
  Partial<Record<ClassifiedTier, readonly string[]>>
>;

// The classified tiers, the most sensitive first, in the order the tiers are defined, reversed.
const mostSensitiveFirst = tierSchema.options
  .filter((tier): tier is ClassifiedTier => tier !== "general")
  .reverse();

// The columns an export holds of a classified tier.
const columnsIn = (
  columns: ClassifiedColumns,
  tier: ClassifiedTier,
): readonly string[] =>
  // The tier is one of the typed tiers, each a key of the columns.
  // eslint-disable-next-line security/detect-object-injection
  columns[tier] ?? [];

// A class's name, such as Personal.
// eslint-disable-next-line security/detect-object-injection
const nameOf = (tier: ClassifiedTier): string => classNames[tier];

// The classified tiers an export holds, the most sensitive first.
export const heldTiers = (columns: ClassifiedColumns): ClassifiedTier[] =>
  mostSensitiveFirst.filter((tier) => columnsIn(columns, tier).length > 0);

// The classified data an export holds, the most sensitive class first, each with its columns.
export const heldData = (
  columns: ClassifiedColumns,
): { dataClass: ClassifiedTier; columns: readonly string[] }[] =>
  heldTiers(columns).map((dataClass) => ({
    dataClass,
    columns: columnsIn(columns, dataClass),
  }));

// The classes an export holds, such as Confidential and Personal.
export const heldClassNames = (columns: ClassifiedColumns): string =>
  allOf(heldTiers(columns).map(nameOf));

// The classified data an export holds, the most sensitive first, with its columns, such as
// Confidential data (Salary) and Personal data (Home address).
export const classifiedDataWords = (columns: ClassifiedColumns): string =>
  allOf(
    heldTiers(columns).map(
      (tier) => `${nameOf(tier)} data (${columnsIn(columns, tier).join(", ")})`,
    ),
  );

// The Personal and Confidential data among some columns or details, by name, in their order.
export function classifiedData(
  columns: readonly { name: string; dataClass: Tier }[],
): ClassifiedColumns {
  const named = (tier: ClassifiedTier) =>
    columns
      .filter((column) => column.dataClass === tier)
      .map((column) => column.name);
  return { personal: named("personal"), confidential: named("confidential") };
}
