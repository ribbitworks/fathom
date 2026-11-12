// SPDX-License-Identifier: Apache-2.0

// Lists of choices that people define, such as locations or skills, for columns elsewhere to draw
// on. Each list has a name, an optional description, and a visibility: the sensitivity tier of the
// values chosen from it. Its choices are in the order set for them, and lists and choices can each
// be retired. Lists, choices, and the order of each list's choices have drafts, shown in place of
// the live values, with the draft beside. In a built-in list with meanings, each choice is tied to
// one of the meanings Fathom fixes for it, which Fathom acts on while showing the choice's name.

import { z } from "zod";
import { tierSchema } from "./access.ts";
import { draftActionSchema, draftShape, heldBySchema } from "./drafts.ts";

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
// hires, the hiring states and the feature statuses, lists with meanings, and proposals' statuses.
export const builtInListSchema = z.enum([
  "positions",
  "hiring-states",
  "proposal-statuses",
  "feature-statuses",
]);

export type BuiltInList = z.infer<typeof builtInListSchema>;

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
};

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

// A list as its draft, if any, makes it, with the draft beside, or, for a draft that removes it, as
// it is.
export const listSchema = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string(),
  visibility: tierSchema,
  // A retired list is no longer offered for new values.
  retired: z.boolean(),
  // Which built-in list it is, which cannot be removed or retired; null or absent for any other.
  builtIn: builtInListSchema.nullable().optional(),
  // Set when a column on Features draws on the list, which then stays General as columns there do.
  onFeatures: z.literal(true).optional(),
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

// Why a list a column on Features draws on keeps General, as columns there do.
export const featuresListGeneral =
  "A column on Features draws on this list, so it stays General";

// Every list, by name.
export const listsSchema = z.object({ lists: z.array(listSchema) });

const description = z.string().trim().max(listLengths.description).default("");

export const listRequestSchema = z.object({
  name: z.string().trim().min(1).max(listLengths.name),
  description,
  visibility: tierSchema.default("general"),
});

export type ListRequest = z.infer<typeof listRequestSchema>;

// A choice's meaning is required in a list with meanings, refused in any other, and kept as it is
// when a change leaves it out.
export const choiceRequestSchema = z.object({
  label: z.string().trim().min(1).max(listLengths.choice),
  description,
  meaning: meaningSchema.nullable().optional(),
});

export type ChoiceRequest = z.infer<typeof choiceRequestSchema>;

// Adds one choice, or several pasted at once, to the end of a list, all saved together.
export const choicesRequestSchema = z.object({
  choices: z.array(choiceRequestSchema).min(1).max(1000),
});

export const retiredRequestSchema = z.object({ retired: z.boolean() });

export type RetiredRequest = z.infer<typeof retiredRequestSchema>;

// Moves a choice to just after another in the same list, or to the top when there is none.
export const choiceMoveSchema = z.object({ after: z.uuid().nullable() });
