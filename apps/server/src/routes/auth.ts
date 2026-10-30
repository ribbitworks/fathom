// SPDX-License-Identifier: Apache-2.0

// Sign-in, sign-out, and the signed-in user. Only the Better Auth requests Fathom uses are passed on,
// so its other features, such as users changing their own name, stay closed, including any a later
// version adds. Each is passed with the client's address the server already knows, in place of any a
// client sends, so sign-in limits cannot be dodged by forging an address, and sign-in is passed only
// an email address and password, so a client cannot ask for a longer session.

import { sessionResponseSchema } from "@fathom/shared";
import { fromNodeHeaders } from "better-auth/node";
import type { FastifyReply, FastifyRequest } from "fastify";
import type { FastifyPluginCallbackZod } from "fastify-type-provider-zod";
import { z } from "zod";
import { type Auth, clientAddressHeader } from "../data/auth.ts";

const unauthorized = 401;

const signInSchema = z.object({ email: z.string(), password: z.string() });

// The request's headers as Better Auth reads them, with the client's address the server knows.
function headersFor(request: FastifyRequest): Headers {
  const headers = fromNodeHeaders(request.headers);
  headers.set(clientAddressHeader, request.ip);
  return headers;
}

// Each cookie is sent as its own header, since cookie dates contain commas.
function sendCookies(headers: Headers, reply: FastifyReply): void {
  const cookies = headers.getSetCookie();
  if (cookies.length > 0) void reply.header("set-cookie", cookies);
}

async function passToBetterAuth(
  auth: Auth,
  publicUrl: string,
  request: FastifyRequest,
  reply: FastifyReply,
  body?: object,
) {
  const response = await auth.handler(
    new Request(new URL(request.url, publicUrl), {
      method: request.method,
      headers: headersFor(request),
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    }),
  );
  for (const [name, value] of response.headers) {
    if (name !== "set-cookie") void reply.header(name, value);
  }
  sendCookies(response.headers, reply);
  return reply.status(response.status).send(await response.text());
}

export function authRoutes(
  auth: Auth,
  publicUrl: string,
): FastifyPluginCallbackZod {
  return (app, _options, done) => {
    const pass = (
      request: FastifyRequest,
      reply: FastifyReply,
      body?: object,
    ) => passToBetterAuth(auth, publicUrl, request, reply, body);

    app.post(
      "/api/auth/sign-in/email",
      { schema: { body: signInSchema } },
      (request, reply) => pass(request, reply, request.body),
    );
    app.post("/api/auth/sign-out", (request, reply) =>
      pass(request, reply, {}),
    );
    app.get("/api/auth/get-session", (request, reply) => pass(request, reply));

    app.get(
      "/api/session",
      {
        schema: {
          response: {
            200: sessionResponseSchema,
            [unauthorized]: z.object({ error: z.string() }),
          },
        },
      },
      async (request, reply) => {
        // A session in use is extended, with a new cookie for the browser.
        const { headers, response: session } = await auth.api.getSession({
          headers: headersFor(request),
          returnHeaders: true,
        });
        sendCookies(headers, reply);
        if (session === null) {
          return reply.status(unauthorized).send({ error: "Unauthorized" });
        }
        const { id, name, email } = session.user;
        return { user: { id, name, email } };
      },
    );
    done();
  };
}
