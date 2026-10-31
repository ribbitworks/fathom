// SPDX-License-Identifier: Apache-2.0

// People and the columns on the People table: reading everyone the user may see; adding people, one
// or several at once, changing and deleting them; adding, changing, and deleting columns; and moving
// any column, built-in or added.
// The data access layer checks the actor's permissions.

import {
  changeSetIdSchema,
  columnKeySchema,
  fieldMoveSchema,
  fieldRequestSchema,
  fieldSchema,
  peopleRequestSchema,
  peopleSchema,
  personChangeSchema,
  savedSchema,
} from "@fathom/shared";
import type { FastifyPluginCallbackZod } from "fastify-type-provider-zod";
import { z } from "zod";
import type { PeopleAccess } from "../data/index.ts";

const created = 201;

const personParams = z.object({ personId: z.uuid() });
const fieldParams = z.object({ fieldId: z.uuid() });
const fieldResponse = z.object({
  field: fieldSchema,
  changeSetId: changeSetIdSchema,
});
const saved = { 200: savedSchema };

export function peopleRoutes(people: PeopleAccess): FastifyPluginCallbackZod {
  return (app, _options, done) => {
    app.get(
      "/api/people",
      { schema: { response: { 200: peopleSchema } } },
      async (request) => people.read(request.actor),
    );

    app.post(
      "/api/people",
      {
        schema: {
          body: peopleRequestSchema,
          response: {
            [created]: z.object({
              ids: z.array(z.string()),
              changeSetId: changeSetIdSchema,
            }),
          },
        },
      },
      async (request, reply) => {
        const { result, changeSetId } = await people.create(
          request.actor,
          request.body.people,
        );
        return reply.status(created).send({ ids: result, changeSetId });
      },
    );

    app.patch(
      "/api/people/:personId",
      {
        schema: {
          params: personParams,
          body: personChangeSchema,
          response: saved,
        },
      },
      async (request) => ({
        changeSetId: await people.update(
          request.actor,
          request.params.personId,
          request.body,
        ),
      }),
    );

    app.delete(
      "/api/people/:personId",
      { schema: { params: personParams, response: saved } },
      async (request) => ({
        changeSetId: await people.delete(
          request.actor,
          request.params.personId,
        ),
      }),
    );

    app.post(
      "/api/people/columns",
      {
        schema: {
          body: fieldRequestSchema,
          response: { [created]: fieldResponse },
        },
      },
      async (request, reply) => {
        const { result, changeSetId } = await people.createField(
          request.actor,
          request.body,
        );
        return reply.status(created).send({ field: result, changeSetId });
      },
    );

    app.put(
      "/api/people/columns/:fieldId",
      {
        schema: {
          params: fieldParams,
          body: fieldRequestSchema,
          response: { 200: fieldResponse },
        },
      },
      async (request) => {
        const { result, changeSetId } = await people.updateField(
          request.actor,
          request.params.fieldId,
          request.body,
        );
        return { field: result, changeSetId };
      },
    );

    // Built-in columns move too, so a column is named by its key.
    app.put(
      "/api/people/columns/:key/position",
      {
        schema: {
          params: z.object({ key: columnKeySchema }),
          body: fieldMoveSchema,
          response: saved,
        },
      },
      async (request) => ({
        changeSetId: await people.moveColumn(
          request.actor,
          request.params.key,
          request.body.after,
        ),
      }),
    );

    app.delete(
      "/api/people/columns/:fieldId",
      { schema: { params: fieldParams, response: saved } },
      async (request) => ({
        changeSetId: await people.deleteField(
          request.actor,
          request.params.fieldId,
        ),
      }),
    );

    done();
  };
}
