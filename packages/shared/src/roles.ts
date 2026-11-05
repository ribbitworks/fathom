// SPDX-License-Identifier: Apache-2.0

// Roles as those who may edit them see and change them: each a named set of permissions, kept in the
// database, with how many active accounts hold it, and what a change to one would do to each account
// it changes.

import { z } from "zod";
import { permissionSchema } from "./access.ts";
import { accountName } from "./accounts.ts";
import { isPlainText } from "./text.ts";

export const roleLengths = { description: 500 } as const;

// Permissions as a role stores them: each once, in the shared list's order.
const grantedSchema = z
  .array(permissionSchema)
  .transform((granted) =>
    permissionSchema.options.filter((permission) =>
      granted.includes(permission),
    ),
  );

export const roleRequestSchema = z.object({
  name: accountName,
  // One paragraph, with each run of spaces or line breaks kept as one space.
  description: z
    .string()
    .overwrite((text) => text.replace(/\s+/gu, " ").trim())
    .max(
      roleLengths.description,
      `Use at most ${String(roleLengths.description)} characters`,
    )
    .refine(isPlainText, "Use plain text, without control characters"),
  permissions: grantedSchema,
});

export type RoleRequest = z.infer<typeof roleRequestSchema>;

// A change to a role, naming when the role was last changed as the dialog read it, so a change saved
// meanwhile by someone else is not silently undone.
export const roleChangeSchema = roleRequestSchema.extend({
  updatedAt: z.iso.datetime({ offset: true }),
});

export type RoleChange = z.infer<typeof roleChangeSchema>;

export const roleSummarySchema = z.object({
  id: z.uuid(),
  // The starting role it is, if any, which roles made later do not have.
  key: z.string().nullable(),
  name: z.string(),
  description: z.string(),
  permissions: z.array(permissionSchema),
  // Active accounts holding the role.
  accounts: z.number().int(),
  updatedAt: z.iso.datetime({ offset: true }),
});

export type RoleSummary = z.infer<typeof roleSummarySchema>;

export const roleListSchema = z.object({ roles: z.array(roleSummarySchema) });

export const roleResponseSchema = z.object({ role: roleSummarySchema });

// What an account could do before a change to a role, and after it, for each active account whose
// permissions it changes.
export const roleEffectsSchema = z.object({
  effects: z.array(
    z.object({
      account: z.object({
        id: z.string(),
        name: z.string(),
        email: z.string(),
      }),
      before: z.array(permissionSchema),
      after: z.array(permissionSchema),
    }),
  ),
});

export type RoleEffects = z.infer<typeof roleEffectsSchema>;

export const roleEffectsRequestSchema = z.object({
  permissions: grantedSchema,
});
