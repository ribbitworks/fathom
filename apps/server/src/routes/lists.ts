// SPDX-License-Identifier: Apache-2.0

// Lists of choices: reading every list; creating, editing, retiring, restoring, and deleting lists;
// and adding choices, one or several at once, editing, moving, retiring, restoring, and removing
// them. The data access layer checks the actor's permissions.

import {
  choiceMoveSchema,
  choiceRequestSchema,
  choiceSchema,
  choicesRequestSchema,
  listRequestSchema,
  listSchema,
  listsSchema,
  retiredRequestSchema,
} from "@fathom/shared";
import type { FastifyPluginCallbackZod } from "fastify-type-provider-zod";
import { z } from "zod";
import type { ListAccess } from "../data/index.ts";

const created = 201;
const noContent = 204;

const listResponse = z.object({ list: listSchema });
const listParams = z.object({ listId: z.uuid() });
const choiceParams = z.object({ listId: z.uuid(), choiceId: z.uuid() });

export function listRoutes(lists: ListAccess): FastifyPluginCallbackZod {
  return (app, _options, done) => {
    app.get(
      "/api/lists",
      { schema: { response: { 200: listsSchema } } },
      async (request) => ({ lists: await lists.read(request.actor) }),
    );

    app.post(
      "/api/lists",
      {
        schema: {
          body: listRequestSchema,
          response: { [created]: listResponse },
        },
      },
      async (request, reply) =>
        reply
          .status(created)
          .send({ list: await lists.create(request.actor, request.body) }),
    );

    app.put(
      "/api/lists/:listId",
      {
        schema: {
          params: listParams,
          body: listRequestSchema,
          response: { 200: listResponse },
        },
      },
      async (request) => ({
        list: await lists.update(
          request.actor,
          request.params.listId,
          request.body,
        ),
      }),
    );

    app.put(
      "/api/lists/:listId/retired",
      { schema: { params: listParams, body: retiredRequestSchema } },
      async (request, reply) => {
        await lists.setRetired(
          request.actor,
          request.params.listId,
          request.body,
        );
        return reply.status(noContent).send();
      },
    );

    app.delete(
      "/api/lists/:listId",
      { schema: { params: listParams } },
      async (request, reply) => {
        await lists.delete(request.actor, request.params.listId);
        return reply.status(noContent).send();
      },
    );

    app.post(
      "/api/lists/:listId/choices",
      {
        schema: {
          params: listParams,
          body: choicesRequestSchema,
          response: { [created]: z.object({ choices: z.array(choiceSchema) }) },
        },
      },
      async (request, reply) =>
        reply.status(created).send({
          choices: await lists.addChoices(
            request.actor,
            request.params.listId,
            request.body.choices,
          ),
        }),
    );

    app.put(
      "/api/lists/:listId/choices/:choiceId",
      {
        schema: {
          params: choiceParams,
          body: choiceRequestSchema,
          response: { 200: z.object({ choice: choiceSchema }) },
        },
      },
      async (request) => ({
        choice: await lists.updateChoice(
          request.actor,
          request.params.listId,
          request.params.choiceId,
          request.body,
        ),
      }),
    );

    app.put(
      "/api/lists/:listId/choices/:choiceId/position",
      { schema: { params: choiceParams, body: choiceMoveSchema } },
      async (request, reply) => {
        await lists.moveChoice(
          request.actor,
          request.params.listId,
          request.params.choiceId,
          request.body.after,
        );
        return reply.status(noContent).send();
      },
    );

    app.put(
      "/api/lists/:listId/choices/:choiceId/retired",
      { schema: { params: choiceParams, body: retiredRequestSchema } },
      async (request, reply) => {
        await lists.setChoiceRetired(
          request.actor,
          request.params.listId,
          request.params.choiceId,
          request.body,
        );
        return reply.status(noContent).send();
      },
    );

    app.delete(
      "/api/lists/:listId/choices/:choiceId",
      { schema: { params: choiceParams } },
      async (request, reply) => {
        await lists.deleteChoice(
          request.actor,
          request.params.listId,
          request.params.choiceId,
        );
        return reply.status(noContent).send();
      },
    );
    done();
  };
}
