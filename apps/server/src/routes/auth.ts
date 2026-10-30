// SPDX-License-Identifier: Apache-2.0

// Sign-in, sign-out, and the signed-in user, with their roles and what those roles let them do. Only the Better Auth requests Fathom uses are passed on,
// so its other features, such as users changing their own name, stay closed, including any a later
// version adds. Each is passed with the client's address the server already knows, in place of any a
// client sends, so sign-in limits cannot be dodged by forging an address, and sign-in is passed only
// an email address and password, so a client cannot ask for a longer session.

import { sessionResponseSchema, signInRequestSchema } from "@fathom/shared";
import { fromNodeHeaders } from "better-auth/node";
import type { FastifyReply, FastifyRequest } from "fastify";
import type { FastifyPluginCallbackZod } from "fastify-type-provider-zod";
import { z } from "zod";
import { type Actor, actorFor, type SignedInUser } from "../access.ts";
import { type Auth, clientAddressHeader } from "../data/auth.ts";
import type { DataAccess } from "../data/index.ts";

const unauthorized = 401;

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

// Returns the signed-in user, or null without a valid session. A session in use is extended, with a
// new cookie for the browser.
export async function readSession(
  auth: Auth,
  request: FastifyRequest,
  reply: FastifyReply,
): Promise<SignedInUser | null> {
  const { headers, response: session } = await auth.api.getSession({
    headers: headersFor(request),
    returnHeaders: true,
  });
  sendCookies(headers, reply);
  if (session === null) return null;
  const { id, name, email } = session.user;
  return { id, name, email };
}

// Returns who is making the request, with what their roles let them do, or null when no one is
// signed in.
export async function readActor(
  auth: Auth,
  data: DataAccess,
  request: FastifyRequest,
  reply: FastifyReply,
): Promise<Actor | null> {
  const user = await readSession(auth, request, reply);
  return user === null
    ? null
    : actorFor(user, await data.readActorRoles(user.id));
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
  data: DataAccess,
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
      { schema: { body: signInRequestSchema } },
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
        const actor = await readActor(auth, data, request, reply);
        if (actor === null) {
          return reply.status(unauthorized).send({ error: "Unauthorized" });
        }
        return actor;
      },
    );
    done();
  };
}
