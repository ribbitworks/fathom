// SPDX-License-Identifier: Apache-2.0

// Moving data to another class: a built-in detail, such as start dates, a list, or a column with a
// class of its own. The data access layer checks the actor may.

import {
  classifiedFieldSchema,
  classMoveSchema,
  dataClassesSchema,
  savedSchema,
} from "@fathom/shared";
import type { FastifyPluginCallbackZod } from "fastify-type-provider-zod";
import { z } from "zod";
import type { DataAccess } from "../data/index.ts";

const saved = { 200: savedSchema };

export function dataClassRoutes(data: DataAccess): FastifyPluginCallbackZod {
  return (app, _options, done) => {
    app.put(
      "/api/data-classes/:field",
      {
        schema: {
          params: z.object({ field: classifiedFieldSchema }),
          body: classMoveSchema,
          response: { 200: dataClassesSchema },
        },
      },
      async (request) =>
        data.moveFieldClass(
          request.actor,
          request.params.field,
          request.body.dataClass,
        ),
    );
    app.put(
      "/api/lists/:listId/class",
      {
        schema: {
          params: z.object({ listId: z.uuid() }),
          body: classMoveSchema,
          response: saved,
        },
      },
      async (request) => ({
        changeSetId: await data.moveListClass(
          request.actor,
          request.params.listId,
          request.body.dataClass,
        ),
      }),
    );
    app.put(
      "/api/columns/:fieldId/class",
      {
        schema: {
          params: z.object({ fieldId: z.uuid() }),
          body: classMoveSchema,
          response: saved,
        },
      },
      async (request) => ({
        changeSetId: await data.moveColumnClass(
          request.actor,
          request.params.fieldId,
          request.body.dataClass,
        ),
      }),
    );
    done();
  };
}
