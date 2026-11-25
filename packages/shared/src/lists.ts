// SPDX-License-Identifier: Apache-2.0

// Lists of choices that columns draw on, with their choices, drafts and requests.

import { z } from "zod";
import { tierSchema } from "./access.ts";
import { draftActionSchema, draftShape, heldBySchema } from "./drafts.ts";
import { numberProblem, outOfRange } from "./numbers.ts";
import { keyNumberSchema } from "./record-keys.ts";

export const listLengths = {
  name: 40,
  choice: 60,
  description: 500,
} as const;

// A choice's or list's draft: whether it adds, changes, or removes the record, the fields it
// changes, and their live values, which a draft that adds the record has none of.
const configDraft = <Live extends z.ZodRawShape>(live: Live) =>
  z.object({
    action: draftActionSchema,
    changed: z.array(z.string()),
    live: z.object(live).partial(),
    ...draftShape,
  });

// Every meaning Fathom fixes for the choices of a list with meanings, with its name.
export const meaningSchema = z.enum([
  "proposed",
  "open",
  "hired",
  "left",
  "possible",
  "planned",
  "in-progress",
  "done",
  "cancelled",
]);

export type Meaning = z.infer<typeof meaningSchema>;

// A rule naming whether it holds for every meaning, which the compiler checks, so a new meaning is
// decided rather than counted by accident; and whether it holds for a status with none.
export function byMeaning(
  rule: Record<Meaning, boolean>,
  none: boolean,
): (meaning: Meaning | null | undefined) => boolean {
  const holds = new Map<string, boolean>(Object.entries(rule));
  return (meaning) =>
    meaning === null || meaning === undefined
      ? none
      : holds.get(meaning) === true;
}

export const meaningNames: Readonly<Record<Meaning, string>> = {
  proposed: "Proposed",
  open: "Open",
  hired: "Hired",
  left: "Left",
  possible: "Possible",
  planned: "Planned",
  "in-progress": "In progress",
  done: "Done",
  cancelled: "Cancelled",
};

export function meaningName(meaning: Meaning): string {
  // The meaning is always one of the fixed meanings named above.
  // eslint-disable-next-line security/detect-object-injection
  return meaningNames[meaning];
}

export const choiceDraftSchema = configDraft({
  label: z.string(),
  description: z.string(),
  retired: z.boolean(),
  meaning: meaningSchema.nullable(),
  weight: z.number().nullable(),
});

export type ChoiceDraft = z.infer<typeof choiceDraftSchema>;

// A choice as its draft, if any, makes it, with the draft beside, or, for a draft that removes it,
// as it is.
export const choiceSchema = z.object({
  id: z.string(),
  label: z.string(),
  // Empty when the choice has no description.
  description: z.string(),
  // A retired choice stays on records that have it, but is no longer offered.
  retired: z.boolean(),
  // The meaning it is tied to, in a list with meanings; absent in any other list.
  meaning: meaningSchema.optional(),
  // Its weight, in feature sizes; absent in any other list.
  weight: z.number().optional(),
  draft: choiceDraftSchema.optional(),
  heldBy: heldBySchema,
});

export type Choice = z.infer<typeof choiceSchema>;

export const listDraftSchema = configDraft({
  name: z.string(),
  description: z.string(),
  visibility: tierSchema,
  retired: z.boolean(),
});

export type ListDraft = z.infer<typeof listDraftSchema>;

// A draft of the order of a list's choices, holding the whole order, with the live order beside.
export const orderDraftSchema = z.object({
  live: z.array(z.string()),
  // The choices only drafted to be added that the draft places, whose drafts approving it approves,
  // and which are rejected only together with it.
  uses: z.array(z.string()).optional(),
  ...draftShape,
});

export type OrderDraft = z.infer<typeof orderDraftSchema>;

// The lists Fathom builds in, each drawn on by a built-in column: Positions, for people and planned
// hires, the hiring states and the feature statuses, lists with meanings, proposals' statuses, and
// features' priorities, sizes and risks.
export const builtInListSchema = z.enum([
  "positions",
  "hiring-states",
  "proposal-statuses",
  "feature-statuses",
  "feature-priorities",
  "feature-sizes",
  "feature-risks",
]);

export type BuiltInList = z.infer<typeof builtInListSchema>;

// The built-in lists features' optional choices draw on: their priorities, sizes and risks.
export const featureBuiltInLists = [
  "feature-priorities",
  "feature-sizes",
  "feature-risks",
] as const satisfies readonly BuiltInList[];

// The meanings each built-in list's choices are tied to, in the order its choices start in; a list
// with none is not a list with meanings.
export const listMeanings: Readonly<Record<BuiltInList, readonly Meaning[]>> = {
  positions: [],
  "hiring-states": ["proposed", "open", "hired", "left"],
  "proposal-statuses": [],
  "feature-statuses": [
    "possible",
    "planned",
    "in-progress",
    "done",
    "cancelled",
  ],
  "feature-priorities": [],
  "feature-sizes": [],
  "feature-risks": [],
};

export const weighs = (builtIn: BuiltInList | null | undefined) =>
  builtIn === "feature-sizes";

// A weight as the database keeps it: more than 0, below 10,000, to two places.
export const weightLimits = { most: 9999.99, places: 2 } as const;

const weightRange = outOfRange("Weight", {
  least: 10 ** -weightLimits.places,
  most: weightLimits.most,
});

export const weightSchema = z
  .number()
  .gte(10 ** -weightLimits.places, weightRange)
  .lte(weightLimits.most, weightRange)
  .refine(
    (weight) =>
      Number.isInteger(Number((weight * 10 ** weightLimits.places).toFixed(6))),
    `Weight: use at most ${String(weightLimits.places)} digits after the point`,
  );

export function weightProblem(text: string): string | undefined {
  if (text.trim() === "") return "Weight needed";
  const form = numberProblem(text);
  if (form !== undefined) return `Weight: ${form}`;
  return weightSchema.safeParse(Number(text.trim())).error?.issues[0]?.message;
}

// Whether two names are the same, ignoring letter case and spaces at either end.
export function sameName(first: string, second: string): boolean {
  return first.trim().toLowerCase() === second.trim().toLowerCase();
}

// What a name, such as one pasted, picks out among choices: the one choice with that name, none, or
// several, which leaves it unclear which is meant, so none of them is taken.
export type ChoiceNamed<Named> =
  { match: "one"; choice: Named } | { match: "none" } | { match: "several" };

export function choiceNamed<Named extends { label: string }>(
  choices: readonly Named[],
  name: string,
): ChoiceNamed<Named> {
  const [first, ...others] = choices.filter((choice) =>
    sameName(choice.label, name),
  );
  if (first === undefined) return { match: "none" };
  return others.length === 0
    ? { match: "one", choice: first }
    : { match: "several" };
}

// The meanings a list's choices are tied to, by its built-in key: none for any other list.
export const meaningsOf = (
  builtIn: BuiltInList | null | undefined,
): readonly Meaning[] =>
  builtIn === null || builtIn === undefined
    ? []
    : // The key is always one of the built-in lists named above.
      // eslint-disable-next-line security/detect-object-injection
      listMeanings[builtIn];

// What a list must always offer a choice for: a built-in list with meanings, each of them; any
// other built-in list, such as Positions, any choice, since every record drawing on it needs one;
// and a list someone defined, nothing.
export type Kept = Meaning | "any";

export const keptOf = (
  builtIn: BuiltInList | null | undefined,
): readonly Kept[] => {
  if (builtIn === null || builtIn === undefined) return [];
  const meanings = meaningsOf(builtIn);
  return meanings.length > 0 ? meanings : ["any"];
};

// A column that offers a list's choices, named by the page it's on.
export const listUseSchema = z.object({ page: z.string(), column: z.string() });

export type ListUse = z.infer<typeof listUseSchema>;

// A list as its draft, if any, makes it, with the draft beside, or, for a draft that removes it, as
// it is.
export const listSchema = z.object({
  id: z.string(),
  keyNumber: keyNumberSchema,
  name: z.string(),
  description: z.string(),
  visibility: tierSchema,
  // A retired list is no longer offered for new values.
  retired: z.boolean(),
  // Which built-in list it is, which cannot be removed or retired; null or absent for any other.
  builtIn: builtInListSchema.nullable().optional(),
  // Set when a column on Features draws on the list, which then stays General as columns there do.
  onFeatures: z.literal(true).optional(),
  // The columns that offer its choices, by page then column.
  usedBy: z.array(listUseSchema).optional(),
  // In order, as a draft of the order makes it, offered and retired alike, with choices drafted to
  // be added after the rest, in the order they were drafted.
  choices: z.array(choiceSchema),
  draft: listDraftSchema.optional(),
  heldBy: heldBySchema,
  orderDraft: orderDraftSchema.optional(),
  // Who holds the order of the list's choices, as heldBy does the list.
  orderHeldBy: heldBySchema,
});

export type List = z.infer<typeof listSchema>;

// Why a list a column on Features or Activities draws on keeps General, as columns there do.
export const featuresListGeneral =
  "A column on Features or Activities uses this list, so it stays General";

// Every list, by name.
export const listsSchema = z.object({ lists: z.array(listSchema) });

const description = z.string().trim().max(listLengths.description).default("");

export const listRequestSchema = z.object({
  name: z.string().trim().min(1).max(listLengths.name),
  description,
  visibility: tierSchema.default("general"),
});

export type ListRequest = z.infer<typeof listRequestSchema>;

// A choice's meaning is required in a list with meanings, and its weight in feature sizes; each is
// refused in any other list, and kept as it is when a change leaves it out.
export const choiceRequestSchema = z.object({
  label: z.string().trim().min(1).max(listLengths.choice),
  description,
  meaning: meaningSchema.nullable().optional(),
  weight: weightSchema.nullable().optional(),
});

export type ChoiceRequest = z.infer<typeof choiceRequestSchema>;

// Why a list can't take a name: another list has it.
export const duplicateList = "There is already a list with that name";

// The most choices added at once, such as by pasting.
export const mostChoicesAtOnce = 1000;

// Adds one choice, or several pasted at once, to the end of a list, all saved together.
export const choicesRequestSchema = z.object({
  choices: z.array(choiceRequestSchema).min(1).max(mostChoicesAtOnce),
});

export const retiredRequestSchema = z.object({ retired: z.boolean() });

export type RetiredRequest = z.infer<typeof retiredRequestSchema>;

// Moves a choice to just after another in the same list, or to the top when there is none.
export const choiceMoveSchema = z.object({ after: z.uuid().nullable() });
