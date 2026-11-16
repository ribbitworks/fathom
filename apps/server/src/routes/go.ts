// SPDX-License-Identifier: Apache-2.0

// Links to records by their keys: what /go/feature/123, or /go/FEATURE-123 typed by hand, opens for
// the signed-in reader. A link that names no key finds nothing, as one the reader may not see does.
// The data access layer checks the actor's permissions.

import {
  type ParsedRecordKey,
  parseRecordKey,
  parseRecordLink,
  type RecordLookup,
  recordLookupSchema,
} from "@fathom/shared";
import type { FastifyPluginCallbackZod } from "fastify-type-provider-zod";
import { z } from "zod";
import type { Actor } from "../access.ts";
import type { DataAccess } from "../data/index.ts";

// Longer than any key, so nothing longer is read.
const longestPart = 40;

const part = z.string().max(longestPart);
const linkParams = z.object({ kind: part, keyNumber: part });
const keyParams = z.object({ key: part });
const response = { 200: recordLookupSchema };

export function goRoutes(data: DataAccess): FastifyPluginCallbackZod {
  const find = async (
    actor: Actor,
    parsed: ParsedRecordKey | undefined,
  ): Promise<RecordLookup> =>
    parsed === undefined
      ? { result: "nothing" }
      : data.findRecord(actor, parsed.kind, parsed.keyNumber);
  return (app, _options, done) => {
    app.get(
      "/api/go/:kind/:keyNumber",
      { schema: { params: linkParams, response } },
      async (request) =>
        find(
          request.actor,
          parseRecordLink(request.params.kind, request.params.keyNumber),
        ),
    );
    app.get(
      "/api/go/:key",
      { schema: { params: keyParams, response } },
      async (request) =>
        find(request.actor, parseRecordKey(request.params.key)),
    );
    done();
  };
}
