// SPDX-License-Identifier: Apache-2.0

// Roles: those who may edit them list them, create them, change them, and see what a change would do
// to the accounts holding a role before saving it; those who manage accounts list them too. The data
// access layer checks the actor may.

import {
  roleChangeSchema,
  roleEffectsRequestSchema,
  roleEffectsSchema,
  roleListSchema,
  roleRequestSchema,
  roleResponseSchema,
} from "@fathom/shared";
import type { FastifyPluginCallbackZod } from "fastify-type-provider-zod";
import { z } from "zod";
import type { RoleAdministration } from "../data/role-administration.ts";

const created = 201;
const params = z.object({ id: z.uuid() });

export function roleRoutes(
  roles: RoleAdministration,
): FastifyPluginCallbackZod {
  return (app, _options, done) => {
    app.get(
      "/api/roles",
      { schema: { response: { 200: roleListSchema } } },
      async (request) => ({ roles: await roles.listRoles(request.actor) }),
    );

    app.post(
      "/api/roles",
      {
        schema: {
          body: roleRequestSchema,
          response: { [created]: roleResponseSchema },
        },
      },
      async (request, reply) =>
        reply.status(created).send({
          role: await roles.createRole(request.actor, request.body),
        }),
    );

    app.put(
      "/api/roles/:id",
      {
        schema: {
          params,
          body: roleChangeSchema,
          response: { 200: roleResponseSchema },
        },
      },
      async (request) => ({
        role: await roles.updateRole(
          request.actor,
          request.params.id,
          request.body,
        ),
      }),
    );

    // A preview, which changes nothing, so a role's effects can be read before it is saved.
    app.post(
      "/api/roles/:id/effects",
      {
        schema: {
          params,
          body: roleEffectsRequestSchema,
          response: { 200: roleEffectsSchema },
        },
      },
      async (request) =>
        roles.previewRole(
          request.actor,
          request.params.id,
          request.body.permissions,
        ),
    );
    done();
  };
}
