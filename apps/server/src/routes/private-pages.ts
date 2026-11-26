// SPDX-License-Identifier: Apache-2.0

// A person's own pages under Mine: listing and reading them. The data access layer checks that only
// the page's maker reaches it.

import { listedPrivatePageSchema, privatePageSchema } from "@fathom/shared";
import type { FastifyPluginCallbackZod } from "fastify-type-provider-zod";
import { z } from "zod";
import type { PrivatePageAccess } from "../data/private-page-access.ts";

const pageParams = z.object({ pageId: z.uuid() });

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

    app.get(
      page,
      { schema: { params: pageParams, response: { 200: privatePageSchema } } },
      async (request) => pages.read(request.actor, request.params.pageId),
    );

    done();
  };
}
