// SPDX-License-Identifier: Apache-2.0

// Accounts: Administrators list them, create them, and change their names, email addresses, roles,
// passwords, and whether they can sign in, and every user changes their own name. Fathom generates
// the password for a new account and for a reset, and answers with it this once. The data access
// layer checks the actor may do each.

import {
  accountActiveSchema,
  accountChangeSchema,
  accountListSchema,
  accountSchema,
  createdAccountSchema,
  generatedPasswordSchema,
  newAccountSchema,
  ownNameSchema,
} from "@fathom/shared";
import type { FastifyPluginCallbackZod } from "fastify-type-provider-zod";
import { z } from "zod";
import type { AccountAdministration } from "../data/accounts.ts";

const created = 201;
const noContent = 204;

const accountResponse = z.object({ account: accountSchema });
const params = z.object({ id: z.uuid() });

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
          response: { [created]: createdAccountSchema },
        },
      },
      async (request, reply) =>
        reply
          .status(created)
          .send(await accounts.createAccount(request.actor, request.body)),
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

    app.post(
      "/api/accounts/:id/password",
      { schema: { params, response: { 200: generatedPasswordSchema } } },
      async (request) => ({
        password: await accounts.resetPassword(
          request.actor,
          request.params.id,
        ),
      }),
    );

    app.put(
      "/api/account/name",
      { schema: { body: ownNameSchema } },
      async (request, reply) => {
        await accounts.renameSelf(request.actor, request.body.name);
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
