// SPDX-License-Identifier: Apache-2.0

// Account administration: listing accounts, creating them, and changing their names, email
// addresses, roles, passwords, and whether they can sign in. The data access layer checks the actor
// may manage accounts.

import {
  accountActiveSchema,
  accountChangeSchema,
  accountListSchema,
  accountSchema,
  newAccountSchema,
  passwordResetSchema,
} from "@fathom/shared";
import type { FastifyPluginCallbackZod } from "fastify-type-provider-zod";
import { z } from "zod";
import type { AccountAdministration } from "../data/accounts.ts";

const created = 201;
const noContent = 204;

const accountResponse = z.object({ account: accountSchema });
const params = z.object({ id: z.string().min(1) });

export function accountRoutes(
  accounts: AccountAdministration,
): FastifyPluginCallbackZod {
  return (app, _options, done) => {
    app.get(
      "/api/accounts",
      { schema: { response: { 200: accountListSchema } } },
      async (request) => ({
        accounts: await accounts.listAccounts(request.actor),
      }),
    );

    app.post(
      "/api/accounts",
      {
        schema: {
          body: newAccountSchema,
          response: { [created]: accountResponse },
        },
      },
      async (request, reply) =>
        reply.status(created).send({
          account: await accounts.createAccount(request.actor, request.body),
        }),
    );

    app.patch(
      "/api/accounts/:id",
      {
        schema: {
          params,
          body: accountChangeSchema,
          response: { 200: accountResponse },
        },
      },
      async (request) => ({
        account: await accounts.updateAccount(
          request.actor,
          request.params.id,
          request.body,
        ),
      }),
    );

    app.put(
      "/api/accounts/:id/password",
      { schema: { params, body: passwordResetSchema } },
      async (request, reply) => {
        await accounts.resetPassword(
          request.actor,
          request.params.id,
          request.body.password,
        );
        return reply.status(noContent).send();
      },
    );

    app.put(
      "/api/accounts/:id/active",
      {
        schema: {
          params,
          body: accountActiveSchema,
          response: { 200: accountResponse },
        },
      },
      async (request) => ({
        account: await accounts.setActive(
          request.actor,
          request.params.id,
          request.body.active,
        ),
      }),
    );
    done();
  };
}
