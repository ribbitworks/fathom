// SPDX-License-Identifier: Apache-2.0

// A person's own pages under Mine: listing and reading them, making, renaming, moving and removing
// one, and adding, changing and removing its columns and rows, each saved at once. The data access
// layer checks that only the page's maker reaches it.

import {
  listedPrivatePageSchema,
  privateColumnRequestSchema,
  privatePagePositionSchema,
  privatePageRenameSchema,
  privatePageRequestSchema,
  privatePageSchema,
  privateRowRequestSchema,
  savedPrivatePageSchema,
  savedSchema,
} from "@fathom/shared";
import type { FastifyPluginCallbackZod } from "fastify-type-provider-zod";
import { z } from "zod";
import type { PrivatePageAccess } from "../data/private-page-access.ts";

const created = 201;

const pageParams = z.object({ pageId: z.uuid() });
const columnParams = pageParams.extend({ columnId: z.uuid() });
const rowParams = pageParams.extend({ rowId: z.uuid() });

const page = "/api/private-pages/:pageId";

export function privatePageRoutes(
  pages: PrivatePageAccess,
): FastifyPluginCallbackZod {
  return (app, _options, done) => {
    app.get(
      "/api/private-pages",
      { schema: { response: { 200: z.array(listedPrivatePageSchema) } } },
      async (request) => pages.list(request.actor),
    );

    app.post(
      "/api/private-pages",
      {
        schema: {
          body: privatePageRequestSchema,
          response: { [created]: savedPrivatePageSchema },
        },
      },
      async (request, reply) => {
        const { result, changeSetId } = await pages.make(
          request.actor,
          request.body,
        );
        return reply.status(created).send({ page: result, changeSetId });
      },
    );

    app.get(
      page,
      { schema: { params: pageParams, response: { 200: privatePageSchema } } },
      async (request) => pages.read(request.actor, request.params.pageId),
    );

    app.patch(
      page,
      {
        schema: {
          params: pageParams,
          body: privatePageRenameSchema,
          response: { 200: savedPrivatePageSchema },
        },
      },
      async (request) => {
        const { result, changeSetId } = await pages.rename(
          request.actor,
          request.params.pageId,
          request.body.name,
        );
        return { page: result, changeSetId };
      },
    );

    app.put(
      `${page}/position`,
      {
        schema: {
          params: pageParams,
          body: privatePagePositionSchema,
          response: { 200: savedSchema },
        },
      },
      async (request) => ({
        changeSetId: await pages.move(
          request.actor,
          request.params.pageId,
          request.body.position,
        ),
      }),
    );

    app.delete(
      page,
      { schema: { params: pageParams, response: { 200: savedSchema } } },
      async (request) => ({
        changeSetId: await pages.remove(request.actor, request.params.pageId),
      }),
    );

    app.post(
      `${page}/columns`,
      {
        schema: {
          params: pageParams,
          body: privateColumnRequestSchema,
          response: { [created]: savedPrivatePageSchema },
        },
      },
      async (request, reply) => {
        const { result, changeSetId } = await pages.addColumn(
          request.actor,
          request.params.pageId,
          request.body,
        );
        return reply.status(created).send({ page: result, changeSetId });
      },
    );

    app.put(
      `${page}/columns/:columnId`,
      {
        schema: {
          params: columnParams,
          body: privateColumnRequestSchema,
          response: { 200: savedPrivatePageSchema },
        },
      },
      async (request) => {
        const { result, changeSetId } = await pages.changeColumn(
          request.actor,
          request.params.pageId,
          request.params.columnId,
          request.body,
        );
        return { page: result, changeSetId };
      },
    );

    app.delete(
      `${page}/columns/:columnId`,
      {
        schema: {
          params: columnParams,
          response: { 200: savedPrivatePageSchema },
        },
      },
      async (request) => {
        const { result, changeSetId } = await pages.removeColumn(
          request.actor,
          request.params.pageId,
          request.params.columnId,
        );
        return { page: result, changeSetId };
      },
    );

    app.post(
      `${page}/rows`,
      {
        schema: {
          params: pageParams,
          body: privateRowRequestSchema,
          response: { [created]: savedPrivatePageSchema },
        },
      },
      async (request, reply) => {
        const { result, changeSetId } = await pages.addRow(
          request.actor,
          request.params.pageId,
          request.body,
        );
        return reply.status(created).send({ page: result, changeSetId });
      },
    );

    app.patch(
      `${page}/rows/:rowId`,
      {
        schema: {
          params: rowParams,
          body: privateRowRequestSchema,
          response: { 200: savedPrivatePageSchema },
        },
      },
      async (request) => {
        const { result, changeSetId } = await pages.changeRow(
          request.actor,
          request.params.pageId,
          request.params.rowId,
          request.body,
        );
        return { page: result, changeSetId };
      },
    );

    app.delete(
      `${page}/rows/:rowId`,
      {
        schema: {
          params: rowParams,
          response: { 200: savedPrivatePageSchema },
        },
      },
      async (request) => {
        const { result, changeSetId } = await pages.removeRow(
          request.actor,
          request.params.pageId,
          request.params.rowId,
        );
        return { page: result, changeSetId };
      },
    );

    done();
  };
}
