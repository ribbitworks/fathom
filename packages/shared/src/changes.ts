// SPDX-License-Identifier: Apache-2.0

// Who made a change to a record, and when, as read from the change history. Each user sees only
// changes to data their roles let them see.

import { z } from "zod";

export const tierSchema = z.enum(["general", "restricted", "confidential"]);

export type Tier = z.infer<typeof tierSchema>;

export const changeStampSchema = z.object({
  // Null for Fathom itself, such as for data made by setup or seed scripts.
  by: z.object({ id: z.string(), name: z.string() }).nullable(),
  at: z.iso.datetime({ offset: true }),
});

export type ChangeStamp = z.infer<typeof changeStampSchema>;
