// SPDX-License-Identifier: Apache-2.0

// Sign-in, sign-out, changing one's own password, and the signed-in user, with their roles and what
// those roles let them do. Only the Better Auth requests Fathom uses are passed on, so its other
// features, such as users changing their own name, stay closed, including any a later version adds.
// Each is passed with the client's address the server already knows, in place of any a client
// sends, so sign-in limits cannot be dodged by forging an address, and sign-in is passed only an
// email address and password, so a client cannot ask for a longer session.

import {
  passwordChangeSchema,
  sessionResponseSchema,
  signInRequestSchema,
} from "@fathom/shared";
import { fromNodeHeaders } from "better-auth/node";
import type { FastifyReply, FastifyRequest } from "fastify";
import type { FastifyPluginCallbackZod } from "fastify-type-provider-zod";
import { z } from "zod";
import { type Actor, actorWith, type SignedInUser } from "../access.ts";
import { type Auth, clientAddressHeader } from "../data/auth.ts";
import type { DataAccess } from "../data/index.ts";

const ok = 200;
const unauthorized = 401;
const refusedSignIn = {
  code: "INVALID_EMAIL_OR_PASSWORD",
  message: "Invalid email or password",
};

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
  if (user === null) return null;
  // A deactivated account grants nothing, even while a session of its own lasts.
  const access = await data.readActorAccess(user.id);
  return access === null
    ? null
    : actorWith(user, access.roles, access.permissions);
}

// Replaces what Better Auth answers, for a status, when its answer would say too much.
type Answers = Partial<Record<number, object>>;

async function passToBetterAuth(
  auth: Auth,
  publicUrl: string,
  request: FastifyRequest,
  reply: FastifyReply,
  body?: object,
  answers: Answers = {},
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
  const answer = answers[response.status];
  return reply
    .status(response.status)
    .send(
      answer === undefined ? await response.text() : JSON.stringify(answer),
    );
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
      answers?: Answers,
    ) => passToBetterAuth(auth, publicUrl, request, reply, body, answers);

    // Every refused sign-in gets the same answer, so it never reveals that a password was right
    // for an account that has been deactivated.
    app.post(
      "/api/auth/sign-in/email",
      { schema: { body: signInRequestSchema } },
      (request, reply) =>
        pass(request, reply, request.body, { [unauthorized]: refusedSignIn }),
    );
    // Changing one's own password signs out every other session, so a stolen one ends. The answer
    // leaves out the new session's token, which the browser receives as a cookie.
    app.post(
      "/api/auth/change-password",
      { schema: { body: passwordChangeSchema } },
      (request, reply) =>
        pass(
          request,
          reply,
          { ...request.body, revokeOtherSessions: true },
          { [ok]: {} },
        ),
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
        return { ...actor, settings: await data.readSettings() };
      },
    );
    done();
  };
}
