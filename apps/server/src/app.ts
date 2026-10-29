// SPDX-License-Identifier: Apache-2.0

// Builds Fathom's HTTPS application: security headers, rate limiting, a time limit for each request,
// validation with the shared Zod schemas, error responses that reveal no internal details, logs
// without personal data, the API routes, which reach data only through the data access layer, and
// the built front end. It never serves plain HTTP.

import helmet from "@fastify/helmet";
import rateLimit from "@fastify/rate-limit";
import Fastify, { type FastifyError, type FastifyReply } from "fastify";
import {
  serializerCompiler,
  validatorCompiler,
  type ZodTypeProvider,
} from "fastify-type-provider-zod";
import type { TlsConfig } from "./config.ts";
import type { DataAccess } from "./data/index.ts";
import { loggerOptions, type LogStream } from "./logging.ts";
import { greetingRoutes } from "./routes/greeting.ts";
import { webRoutes } from "./routes/web.ts";

const badRequest = 400;
const notFound = 404;
const internalServerError = 500;
const defaultRequestsPerMinute = 300;
// Fathom has no proxy in front of it, so the server itself must end requests that never finish.
const requestTimeoutMilliseconds = 30_000;
// Requests that Fastify cannot route, such as malformed URLs, are answered before any hook runs, so
// they get these headers instead of helmet's, and are not rate limited; answering them takes less
// work than counting them. Their responses carry no content to allow, so the policy allows nothing.
const unroutableRequestHeaders = {
  "content-security-policy": "default-src 'none'; frame-ancestors 'none'",
  "strict-transport-security": "max-age=31536000; includeSubDomains",
  "x-content-type-options": "nosniff",
};

export interface AppOptions {
  data: DataAccess;
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

  // Styles and fonts come only from Fathom itself, which has no internet access.
  await app.register(helmet, {
    contentSecurityPolicy: {
      directives: { "style-src": ["'self'"], "font-src": ["'self'"] },
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

  // Errors the client caused keep their message; any other error is logged, and the client is told
  // only that the request failed, so internal details never reach the browser.
  app.setErrorHandler((error: FastifyError, request, reply) => {
    const statusCode = error.statusCode ?? internalServerError;
    if (statusCode >= internalServerError) {
      request.log.error({ err: error }, "Request failed");
      return reply
        .status(internalServerError)
        .send({ error: "Internal Server Error" });
    }
    return reply.status(statusCode).send({ error: error.message });
  });
  app.setNotFoundHandler((_request, reply) =>
    reply.status(notFound).send({ error: "Not Found" }),
  );

  await app.register(greetingRoutes(options.data));
  if (options.webRoot !== undefined) {
    await app.register(webRoutes(options.webRoot));
  }
  return app;
}

export type App = Awaited<ReturnType<typeof buildApp>>;
