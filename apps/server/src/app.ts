// SPDX-License-Identifier: Apache-2.0

// Builds Fathom's HTTPS application: its security hooks, sign-in, the API routes and the built
// front end.

import helmet from "@fastify/helmet";
import rateLimit from "@fastify/rate-limit";
import Fastify, { type FastifyError, type FastifyReply } from "fastify";
import {
  serializerCompiler,
  validatorCompiler,
  type ZodTypeProvider,
} from "fastify-type-provider-zod";
import type { Database } from "@fathom/db";
import type { AuthConfig, TlsConfig } from "./config.ts";
import { createAuth } from "./data/auth.ts";
import { savedAtSameMoment } from "./data/changes.ts";
import type { DataAccess } from "./data/index.ts";
import { loggerOptions, type LogStream } from "./logging.ts";
import type { Actor } from "./access.ts";
import { createAccountAdministration } from "./data/accounts.ts";
import { createRoleAdministration } from "./data/role-administration.ts";
import { accountRoutes } from "./routes/accounts.ts";
import { roleRoutes } from "./routes/roles.ts";
import { authRoutes, readActor } from "./routes/auth.ts";
import { dataClassRoutes } from "./routes/data-classes.ts";
import { draftRoutes } from "./routes/drafts.ts";
import { greetingRoutes } from "./routes/greeting.ts";
import { settingsRoutes } from "./routes/settings.ts";
import { allocationRoutes } from "./routes/allocations.ts";
import { planningSettingsRoutes } from "./routes/planning-settings.ts";
import { exportRoutes } from "./routes/exports.ts";
import { goRoutes } from "./routes/go.ts";
import { historyRoutes } from "./routes/history.ts";
import { listRoutes } from "./routes/lists.ts";
import { peopleRoutes } from "./routes/people.ts";
import { hireRoutes } from "./routes/hires.ts";
import { projectRoutes } from "./routes/projects.ts";
import { tableColumnRoutes } from "./routes/table-columns.ts";
import { activityRoutes } from "./routes/activities.ts";
import { featureTeamRoutes } from "./routes/feature-teams.ts";
import { releaseRoutes } from "./routes/releases.ts";
import { undoRoutes } from "./routes/undo.ts";
import { viewRoutes } from "./routes/views.ts";
import { unpublishedRoutes } from "./routes/unpublished.ts";
import { pageFallback, webRoutes } from "./routes/web.ts";

const badRequest = 400;
const unauthorized = 401;
const forbidden = 403;
const notFound = 404;
const conflict = 409;
const internalServerError = 500;
const defaultRequestsPerMinute = 300;
// Fathom's proxy passes connections through without reading requests, so the server itself must end
// requests that never finish.
const requestTimeoutMilliseconds = 30_000;
// Requests that Fastify cannot route, such as malformed URLs, are answered before any hook runs, so
// they get these headers instead of helmet's, and are not rate limited; answering them takes less
// work than counting them. Their responses carry no content to allow, so the policy allows nothing.
const unroutableRequestHeaders = {
  "content-security-policy": "default-src 'none'; frame-ancestors 'none'",
  "strict-transport-security": "max-age=31536000; includeSubDomains",
  "x-content-type-options": "nosniff",
};

// Requests with these methods only read, so they need no check of where they come from.
const readOnlyMethods = new Set(["GET", "HEAD", "OPTIONS"]);

export interface AppOptions {
  data: DataAccess;
  // The database sign-in keeps its accounts and sessions in, and its settings, including the origin
  // users reach Fathom at, the only one allowed to send requests that change data.
  database: Database;
  auth: AuthConfig;
  tls: TlsConfig;
  // Tests pass their own stream to read the logs.
  logStream: LogStream;
  // The folder holding the built front end; without it, only the API is served.
  webRoot?: string | undefined;
  requestsPerMinute?: number;
}

function createFastify(options: AppOptions) {
  try {
    return Fastify({
      https: { cert: options.tls.cert, key: options.tls.key },
      requestTimeout: requestTimeoutMilliseconds,
      logger: loggerOptions(options.logStream),
      // A plain answer, like other bad requests, without echoing the URL.
      frameworkErrors: (_error, _request, reply: FastifyReply) => {
        void reply
          .headers(unroutableRequestHeaders)
          .status(badRequest)
          .send({ error: "Bad Request" });
      },
    }).withTypeProvider<ZodTypeProvider>();
  } catch (error) {
    throw new Error(
      "The HTTPS certificate or private key is not valid; check FATHOM_TLS_CERT_FILE and FATHOM_TLS_KEY_FILE",
      { cause: error },
    );
  }
}

export async function buildApp(options: AppOptions) {
  const app = createFastify(options);
  app.setValidatorCompiler(validatorCompiler);
  app.setSerializerCompiler(serializerCompiler);

  // Scripts, styles, and fonts come only from Fathom itself, which has no internet access. Inline
  // styles are allowed too, since many UI components set them; inline scripts never are.
  await app.register(helmet, {
    contentSecurityPolicy: {
      directives: {
        "style-src": ["'self'", "'unsafe-inline'"],
        "font-src": ["'self'"],
      },
    },
  });
  // Every routable request is counted before anything else is done with it, including unknown paths
  // and requests whose body cannot be read.
  await app.register(rateLimit, {
    global: false,
    max: options.requestsPerMinute ?? defaultRequestsPerMinute,
    timeWindow: "1 minute",
  });
  app.addHook("onRequest", app.rateLimit());
  // Browsers name the page a request comes from, so a request that changes data from any other
  // site's page is refused, which stops cross-site request forgery.
  app.addHook("onRequest", (request, reply, done) => {
    if (
      readOnlyMethods.has(request.method) ||
      request.headers.origin === options.auth.publicUrl
    ) {
      done();
      return;
    }
    void reply.status(forbidden).send({ error: "Forbidden" });
  });

  // Errors the client caused keep their message; any other error is logged, and the client is told
  // only that the request failed, so internal details never reach the browser.
  app.setErrorHandler((error: FastifyError, request, reply) => {
    if (savedAtSameMoment(error)) {
      return reply.status(conflict).send({
        error: "Someone else saved a change at the same moment. Try again.",
      });
    }
    const statusCode = error.statusCode ?? internalServerError;
    if (statusCode >= internalServerError) {
      request.log.error({ err: error }, "Request failed");
      return reply
        .status(internalServerError)
        .send({ error: "Internal Server Error" });
    }
    const { field } = error as { field?: string };
    return reply.status(statusCode).send({
      error: error.message,
      ...(field === undefined ? {} : { field }),
    });
  });
  const page =
    options.webRoot === undefined ? undefined : pageFallback(options.webRoot);
  app.setNotFoundHandler(
    (request, reply) =>
      page?.(request, reply) ??
      reply.status(notFound).send({ error: "Not Found" }),
  );

  app.decorateRequest("actor", null as unknown as Actor);
  app.decorateRequest("sessionId", "");

  // Better Auth reports only warnings and errors, each logged with its own level alongside.
  const auth = createAuth(options.database, options.auth, (level, message) => {
    app.log.warn({ authLevel: level }, message);
  });
  // Every API request needs a signed-in user, apart from signing in and asking who is signed in.
  // Checked before the request is read, so a signed-out client learns nothing from validation. A
  // user still signing in with a password Fathom generated may do nothing else until they change
  // it, which, like reading the session and signing out, is one of the open requests.
  app.addHook("onRequest", async (request, reply) => {
    const route = request.routeOptions.url ?? "";
    const open =
      !route.startsWith("/api/") ||
      route.startsWith("/api/auth/") ||
      route === "/api/session";
    if (open) return undefined;
    const actor = await readActor(auth, options.data, request, reply);
    if (actor === null) {
      return reply.status(unauthorized).send({ error: "Unauthorized" });
    }
    if (actor.mustChangePassword) {
      return reply
        .status(forbidden)
        .send({ error: "The password must be changed before continuing." });
    }
    request.actor = actor;
    request.sessionId = actor.sessionId;
    return undefined;
  });
  await app.register(authRoutes(auth, options.data, options.auth.publicUrl));
  await app.register(
    accountRoutes(createAccountAdministration(options.database, auth)),
  );
  await app.register(roleRoutes(createRoleAdministration(options.database)));
  await app.register(historyRoutes(options.data));
  await app.register(goRoutes(options.data));
  await app.register(exportRoutes(options.data));
  await app.register(listRoutes(options.data.lists));
  await app.register(draftRoutes(options.data.drafts));
  await app.register(peopleRoutes(options.data.people));
  await app.register(viewRoutes(options.data.views));
  await app.register(hireRoutes(options.data.hires));
  await app.register(featureTeamRoutes(options.data.featureTeams));
  await app.register(
    releaseRoutes(options.data.releases, options.data.records),
  );
  await app.register(projectRoutes(options.data.projects));
  await app.register(
    tableColumnRoutes("features", options.data.featureColumns),
  );
  await app.register(activityRoutes(options.data.activities));
  await app.register(
    tableColumnRoutes("activities", options.data.activityColumns),
  );
  await app.register(undoRoutes(options.data));
  await app.register(unpublishedRoutes(options.data.unpublished));
  await app.register(greetingRoutes(options.data));
  await app.register(settingsRoutes(options.data));
  await app.register(dataClassRoutes(options.data));
  await app.register(planningSettingsRoutes(options.data));
  await app.register(allocationRoutes(options.data));
  if (options.webRoot !== undefined) {
    await app.register(webRoutes(options.webRoot));
  }
  return app;
}

export type App = Awaited<ReturnType<typeof buildApp>>;

declare module "fastify" {
  interface FastifyRequest {
    // Who is making the request, and the session they make it in. Set for every route that requires
    // sign-in, before its handler.
    actor: Actor;
    sessionId: string;
  }
}
