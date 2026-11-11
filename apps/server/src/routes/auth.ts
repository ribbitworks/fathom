// SPDX-License-Identifier: Apache-2.0

// Sign-in, sign-out, changing one's own password, the signed-in user, with the role their session
// acts as and what it lets them do, and switching that role. Only the Better Auth requests Fathom
// uses are passed on, so its other features, such as users changing their own name, stay closed,
// including any a later version adds.
// Each is passed with the client's address the server already knows, in place of any a client
// sends, so sign-in limits cannot be dodged by forging an address, and sign-in is passed only an
// email address and password, so a client cannot ask for a longer session.

import {
  passwordChangeSchema,
  roleSwitchSchema,
  sessionResponseSchema,
  signInRequestSchema,
} from "@fathom/shared";
import { parseCookies } from "better-auth/cookies";
import { fromNodeHeaders } from "better-auth/node";
import type { FastifyReply, FastifyRequest } from "fastify";
import type { FastifyPluginCallbackZod } from "fastify-type-provider-zod";
import { z } from "zod";
import { type Actor, actorWith, type SignedInUser } from "../access.ts";
import { type Auth, clientAddressHeader } from "../data/auth.ts";
import type { DataAccess } from "../data/index.ts";
import type { ActorAccess } from "../data/roles.ts";

const ok = 200;
// Better Auth's answer to a password change, naming the session it started in place of the others.
const changedPasswordAnswer = z.object({ token: z.string() });
const noContent = 204;
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

// Returns the signed-in user and their session's ID, or null without a valid session. A session in
// use is extended, with a new cookie for the browser.
export async function readSession(
  auth: Auth,
  request: FastifyRequest,
  reply: FastifyReply,
): Promise<{ user: SignedInUser; sessionId: string } | null> {
  const { headers, response: session } = await auth.api.getSession({
    headers: headersFor(request),
    returnHeaders: true,
  });
  sendCookies(headers, reply);
  if (session === null) return null;
  const { id, name, email } = session.user;
  return { user: { id, name, email }, sessionId: session.session.id };
}

// The browser remembers the role last chosen on it, so the next sign-in starts as that role. It is
// kept as long as browsers allow, named and set like the session's cookie, which Fathom always marks
// Secure, out of reach of scripts. The role it names grants nothing by itself: the server starts a
// session as it only if the account holds it.
const rememberedRoleCookie = "role";
const rememberedRoleSeconds = 400 * 24 * 60 * 60;

async function rememberedRoleName(auth: Auth): Promise<string> {
  return (await auth.$context).createAuthCookie(rememberedRoleCookie).name;
}

async function readRememberedRole(
  auth: Auth,
  request: FastifyRequest,
): Promise<string | undefined> {
  // Only read for a signed-in request, which always carries the session's cookie.
  const remembered = parseCookies(String(request.headers.cookie)).get(
    await rememberedRoleName(auth),
  );
  return z.uuid().safeParse(remembered).success ? remembered : undefined;
}

async function rememberRole(
  auth: Auth,
  reply: FastifyReply,
  roleId: string,
): Promise<void> {
  void reply.header(
    "set-cookie",
    `${await rememberedRoleName(auth)}=${roleId}; Max-Age=${String(rememberedRoleSeconds)}; Path=/; HttpOnly; Secure; SameSite=Lax`,
  );
}

export interface SignedInActor
  extends Actor, Omit<ActorAccess, "permissions" | "dataClasses"> {
  sessionId: string;
}

// Returns who is making the request, with the role their session acts as, the others they hold,
// what the active one lets them do, and whether they must change their password first, or null when
// no one is signed in.
export async function readActor(
  auth: Auth,
  data: DataAccess,
  request: FastifyRequest,
  reply: FastifyReply,
): Promise<SignedInActor | null> {
  const session = await readSession(auth, request, reply);
  if (session === null) return null;
  // A deactivated account grants nothing, even while a session of its own lasts.
  const access = await data.readActorAccess(
    session.user.id,
    session.sessionId,
    await readRememberedRole(auth, request),
  );
  if (access === null) return null;
  const { permissions, dataClasses, ...held } = access;
  return {
    ...held,
    ...actorWith(session.user, permissions, held.role?.id ?? null, dataClasses),
    sessionId: session.sessionId,
  };
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
  // Runs with Better Auth's own answer to a request it carried out, before the client is answered.
  carriedOut?: (answer: unknown) => Promise<void>,
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
  const text = await response.text();
  if (response.status === ok) await carriedOut?.(JSON.parse(text));
  const answer = answers[response.status];
  return reply
    .status(response.status)
    .send(answer === undefined ? text : JSON.stringify(answer));
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
      carriedOut?: (answer: unknown) => Promise<void>,
    ) =>
      passToBetterAuth(
        auth,
        publicUrl,
        request,
        reply,
        body,
        answers,
        carriedOut,
      );

    // Every refused sign-in gets the same answer, so it never reveals that a password was right
    // for an account that has been deactivated.
    app.post(
      "/api/auth/sign-in/email",
      { schema: { body: signInRequestSchema } },
      (request, reply) =>
        pass(request, reply, request.body, { [unauthorized]: refusedSignIn }),
    );
    // Changing one's own password signs out every other session, so a stolen one ends. The answer
    // leaves out the new session's token, which the browser receives as a cookie. A signed-in
    // user's new password must meet the rules in the password settings, which Better Auth does not
    // know, and must not be too common or easy to guess.
    app.post(
      "/api/auth/change-password",
      { schema: { body: passwordChangeSchema } },
      async (request, reply) => {
        // Only a signed-in user learns the rules; anyone else gets Better Auth's refusal.
        const actor = await readActor(auth, data, request, reply);
        if (actor !== null) {
          await data.checkChosenPassword(request.body.newPassword, actor.user);
        }
        // The new session goes on as the role the old one acted as.
        const roleId = actor === null ? null : actor.roleId;
        return pass(
          request,
          reply,
          { ...request.body, revokeOtherSessions: true },
          { [ok]: {} },
          async (answer) => {
            const { token } = changedPasswordAnswer.parse(answer);
            await data.keepSessionRole(token, roleId);
          },
        );
      },
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
    // Switches the session to another of the account's roles at once, and remembers it on this
    // browser for the next sign-in. The browser then reads the session again.
    app.put(
      "/api/session/role",
      { schema: { body: roleSwitchSchema } },
      async (request, reply) => {
        const { roleId } = request.body;
        await data.switchRole(request.actor, request.sessionId, roleId);
        await rememberRole(auth, reply, roleId);
        return reply.status(noContent).send();
      },
    );
    done();
  };
}
