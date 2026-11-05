// SPDX-License-Identifier: Apache-2.0

// Release streams, their cycle patterns, and their releases: reading every stream, with its cycles;
// drafting streams added, renamed, retired, restored, and given the day their cycles are made
// until, and patterns and releases added, changed, and removed; and discarding the drafts of the
// plan's records, of any kind, or sending rejected ones for approval again. Every change answers
// with the change set it was saved in. The data access layer checks the actor's permissions.

import {
  changeSetIdSchema,
  cyclePatternRequestSchema,
  cyclesUntilRequestSchema,
  recordTypeSchema,
  releaseRequestSchema,
  releaseStreamRequestSchema,
  releaseStreamSchema,
  type ReleaseStream,
  releaseStreamsSchema,
  retiredRequestSchema,
  savedSchema,
} from "@fathom/shared";
import type { FastifyPluginCallbackZod } from "fastify-type-provider-zod";
import { z } from "zod";
import type { Actor } from "../access.ts";
import type {
  ChangeSetId,
  RecordAccess,
  ReleaseAccess,
  Saved,
} from "../data/index.ts";

const created = 201;

const streamResponse = z.object({
  stream: releaseStreamSchema,
  changeSetId: changeSetIdSchema,
});
const streamParams = z.object({ streamId: z.uuid() });
const memberParams = z.object({ streamId: z.uuid(), id: z.uuid() });
const recordParams = z.object({ type: recordTypeSchema, id: z.uuid() });
const saved = { 200: savedSchema };

export function releaseRoutes(
  releases: ReleaseAccess,
  records: RecordAccess,
): FastifyPluginCallbackZod {
  return (app, _options, done) => {
    app.get(
      "/api/release-streams",
      { schema: { response: { 200: releaseStreamsSchema } } },
      async (request) => releases.read(request.actor),
    );

    app.post(
      "/api/release-streams",
      {
        schema: {
          body: releaseStreamRequestSchema,
          response: { [created]: streamResponse },
        },
      },
      async (request, reply) => {
        const { result, changeSetId } = await releases.createStream(
          request.actor,
          request.body,
        );
        return reply.status(created).send({ stream: result, changeSetId });
      },
    );

    app.put(
      "/api/release-streams/:streamId",
      {
        schema: {
          params: streamParams,
          body: releaseStreamRequestSchema,
          response: { 200: streamResponse },
        },
      },
      async (request) => {
        const { result, changeSetId } = await releases.updateStream(
          request.actor,
          request.params.streamId,
          request.body,
        );
        return { stream: result, changeSetId };
      },
    );

    app.put(
      "/api/release-streams/:streamId/retired",
      {
        schema: {
          params: streamParams,
          body: retiredRequestSchema,
          response: { 200: streamResponse },
        },
      },
      async (request) => {
        const { result, changeSetId } = await releases.updateStream(
          request.actor,
          request.params.streamId,
          request.body,
        );
        return { stream: result, changeSetId };
      },
    );

    app.put(
      "/api/release-streams/:streamId/cycles-until",
      {
        schema: {
          params: streamParams,
          body: cyclesUntilRequestSchema,
          response: { 200: streamResponse },
        },
      },
      async (request) => {
        const { result, changeSetId } = await releases.updateStream(
          request.actor,
          request.params.streamId,
          request.body,
        );
        return { stream: result, changeSetId };
      },
    );

    // Adding, changing, and removing a stream's patterns and releases.
    const memberRoutes = (
      path: string,
      body: z.ZodType,
      add: (
        actor: Actor,
        streamId: string,
        body: unknown,
      ) => Promise<Saved<ReleaseStream>>,
      update: (
        actor: Actor,
        streamId: string,
        id: string,
        body: unknown,
      ) => Promise<Saved<ReleaseStream>>,
      remove: (
        actor: Actor,
        streamId: string,
        id: string,
      ) => Promise<ChangeSetId>,
    ) => {
      app.post(
        `/api/release-streams/:streamId/${path}`,
        {
          schema: {
            params: streamParams,
            body,
            response: { [created]: streamResponse },
          },
        },
        async (request, reply) => {
          const { result, changeSetId } = await add(
            request.actor,
            request.params.streamId,
            request.body,
          );
          return reply.status(created).send({ stream: result, changeSetId });
        },
      );
      app.put(
        `/api/release-streams/:streamId/${path}/:id`,
        {
          schema: {
            params: memberParams,
            body,
            response: { 200: streamResponse },
          },
        },
        async (request) => {
          const { result, changeSetId } = await update(
            request.actor,
            request.params.streamId,
            request.params.id,
            request.body,
          );
          return { stream: result, changeSetId };
        },
      );
      app.delete(
        `/api/release-streams/:streamId/${path}/:id`,
        { schema: { params: memberParams, response: saved } },
        async (request) => ({
          changeSetId: await remove(
            request.actor,
            request.params.streamId,
            request.params.id,
          ),
        }),
      );
    };
    memberRoutes(
      "patterns",
      cyclePatternRequestSchema,
      async (actor, streamId, body) =>
        releases.addPattern(actor, streamId, body as never),
      async (actor, streamId, id, body) =>
        releases.updatePattern(actor, streamId, id, body as never),
      async (actor, streamId, id) =>
        releases.deletePattern(actor, streamId, id),
    );
    memberRoutes(
      "releases",
      releaseRequestSchema,
      async (actor, streamId, body) =>
        releases.addRelease(actor, streamId, body as never),
      async (actor, streamId, id, body) =>
        releases.updateRelease(actor, streamId, id, body as never),
      async (actor, streamId, id) =>
        releases.deleteRelease(actor, streamId, id),
    );

    // Discarding a record's draft, and sending a rejected one for approval again unchanged.
    app.delete(
      "/api/records/:type/:id/draft",
      { schema: { params: recordParams, response: saved } },
      async (request) => ({
        changeSetId: await records.discardDraft(
          request.actor,
          request.params.type,
          request.params.id,
        ),
      }),
    );
    app.delete(
      "/api/records/:type/:id/draft/rejection",
      { schema: { params: recordParams, response: saved } },
      async (request) => ({
        changeSetId: await records.resubmitDraft(
          request.actor,
          request.params.type,
          request.params.id,
        ),
      }),
    );
    done();
  };
}
