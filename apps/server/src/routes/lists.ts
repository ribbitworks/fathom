// SPDX-License-Identifier: Apache-2.0

// Lists of choices: reading every list; drafting lists created, edited, retired, restored, and
// deleted, and choices added, one or several at once, edited, moved, retired, restored, and removed;
// and discarding the drafts of lists, choices, and their order, or sending rejected ones for
// approval again. Every change answers with the change set it was saved in, which undoing it names.
// The data access layer checks the actor's permissions.

import {
  choiceMoveSchema,
  choiceRequestSchema,
  choiceSchema,
  choicesRequestSchema,
  changeSetIdSchema,
  listRequestSchema,
  listSchema,
  listsSchema,
  retiredRequestSchema,
  savedSchema,
} from "@fathom/shared";
import type { FastifyPluginCallbackZod } from "fastify-type-provider-zod";
import { z } from "zod";
import type {
  ListAccess,
  ListDraftTarget,
} from "../data/configuration-access.ts";

const created = 201;

const listResponse = z.object({
  list: listSchema,
  changeSetId: changeSetIdSchema,
});
const listParams = z.object({ listId: z.uuid() });
const choiceParams = z.object({ listId: z.uuid(), choiceId: z.uuid() });
const saved = { 200: savedSchema };

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
      async (request, reply) => {
        const { result, changeSetId } = await lists.create(
          request.actor,
          request.body,
        );
        return reply.status(created).send({ list: result, changeSetId });
      },
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
      async (request) => {
        const { result, changeSetId } = await lists.update(
          request.actor,
          request.params.listId,
          request.body,
        );
        return { list: result, changeSetId };
      },
    );

    app.put(
      "/api/lists/:listId/retired",
      {
        schema: {
          params: listParams,
          body: retiredRequestSchema,
          response: saved,
        },
      },
      async (request) => ({
        changeSetId: await lists.setRetired(
          request.actor,
          request.params.listId,
          request.body,
        ),
      }),
    );

    app.delete(
      "/api/lists/:listId",
      { schema: { params: listParams, response: saved } },
      async (request) => ({
        changeSetId: await lists.delete(request.actor, request.params.listId),
      }),
    );

    app.post(
      "/api/lists/:listId/choices",
      {
        schema: {
          params: listParams,
          body: choicesRequestSchema,
          response: {
            [created]: z.object({
              choices: z.array(choiceSchema),
              changeSetId: changeSetIdSchema,
            }),
          },
        },
      },
      async (request, reply) => {
        const { result, changeSetId } = await lists.addChoices(
          request.actor,
          request.params.listId,
          request.body.choices,
        );
        return reply.status(created).send({ choices: result, changeSetId });
      },
    );

    app.put(
      "/api/lists/:listId/choices/:choiceId",
      {
        schema: {
          params: choiceParams,
          body: choiceRequestSchema,
          response: {
            200: z.object({
              choice: choiceSchema,
              changeSetId: changeSetIdSchema,
            }),
          },
        },
      },
      async (request) => {
        const { result, changeSetId } = await lists.updateChoice(
          request.actor,
          request.params.listId,
          request.params.choiceId,
          request.body,
        );
        return { choice: result, changeSetId };
      },
    );

    app.put(
      "/api/lists/:listId/choices/:choiceId/position",
      {
        schema: {
          params: choiceParams,
          body: choiceMoveSchema,
          response: saved,
        },
      },
      async (request) => ({
        changeSetId: await lists.moveChoice(
          request.actor,
          request.params.listId,
          request.params.choiceId,
          request.body.after,
        ),
      }),
    );

    app.put(
      "/api/lists/:listId/choices/:choiceId/retired",
      {
        schema: {
          params: choiceParams,
          body: retiredRequestSchema,
          response: saved,
        },
      },
      async (request) => ({
        changeSetId: await lists.setChoiceRetired(
          request.actor,
          request.params.listId,
          request.params.choiceId,
          request.body,
        ),
      }),
    );

    app.delete(
      "/api/lists/:listId/choices/:choiceId",
      { schema: { params: choiceParams, response: saved } },
      async (request) => ({
        changeSetId: await lists.deleteChoice(
          request.actor,
          request.params.listId,
          request.params.choiceId,
        ),
      }),
    );
    // Discarding a draft, and sending a rejected one for approval again unchanged.
    const draftRoutes = <Params extends z.ZodType>(
      path: string,
      params: Params,
      target: (params: z.infer<Params>) => ListDraftTarget,
    ) => {
      app.delete(
        `${path}/draft`,
        { schema: { params, response: saved } },
        async (request) => ({
          changeSetId: await lists.discardDraft(
            request.actor,
            target(request.params as z.infer<Params>),
          ),
        }),
      );
      app.delete(
        `${path}/draft/rejection`,
        { schema: { params, response: saved } },
        async (request) => ({
          changeSetId: await lists.resubmitDraft(
            request.actor,
            target(request.params as z.infer<Params>),
          ),
        }),
      );
    };
    draftRoutes("/api/lists/:listId", listParams, ({ listId }) => ({
      kind: "list",
      listId,
    }));
    draftRoutes(
      "/api/lists/:listId/choices/:choiceId",
      choiceParams,
      ({ listId, choiceId }) => ({ kind: "choice", listId, choiceId }),
    );
    draftRoutes("/api/lists/:listId/order", listParams, ({ listId }) => ({
      kind: "order",
      listId,
    }));
    done();
  };
}
