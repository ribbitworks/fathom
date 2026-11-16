// SPDX-License-Identifier: Apache-2.0

// What the plan's records share in the API, whatever their kind: their identifier, key number, their
// draft and who holds it, a name, and optional text.

import { z } from "zod";
import { heldBySchema, recordDraftSchema } from "./drafts.ts";
import { keyNumberSchema } from "./record-keys.ts";

export const recordNameLength = 100;

export const recordShape = {
  id: z.string(),
  keyNumber: keyNumberSchema,
  draft: recordDraftSchema.optional(),
  heldBy: heldBySchema,
};

export const recordName = z.string().trim().min(1).max(recordNameLength);

// Optional text, kept as typed without spaces around it, or null when empty.
export const optionalText = (longest: number) =>
  z
    .string()
    .trim()
    .max(longest)
    .nullable()
    .default(null)
    .transform((value) => (value === "" ? null : value));

// The records picked, each once, in a stable order, so the same set is the same value.
const pickedIds = z
  .array(z.uuid())
  .transform((ids) => [...new Set(ids)].sort());

export const picked = pickedIds.default([]);

// Records picked, or none named, for a request that leaves them as they are when not named.
export const pickedIfNamed = pickedIds.optional();
