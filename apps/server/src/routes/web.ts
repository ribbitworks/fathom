// SPDX-License-Identifier: Apache-2.0

// Serves the built front end. Vite names its scripts and styles after their contents, so browsers
// may keep them for a year; the page itself is checked with the server on every visit, so a new
// release is picked up straight away. Hidden files are never served. The front end has its own
// pages, such as /sign-in, so a browser asking for any other page gets the front end's page, which
// shows the right one; unknown files and API paths get the plain not found response.

import fastifyStatic from "@fastify/static";
import type { FastifyPluginAsync, FastifyReply, FastifyRequest } from "fastify";
import { readFileSync } from "node:fs";
import { join, relative, sep } from "node:path";

const oneYearInSeconds = 365 * 24 * 60 * 60;
// Vite's folder for the files it names after their contents, inside the web root.
const builtAssets = `assets${sep}`;

export function webRoutes(root: string): FastifyPluginAsync {
  return async (app) => {
    await app.register(fastifyStatic, {
      root,
      dotfiles: "ignore",
      cacheControl: false,
      setHeaders: (response, path) => {
        void response.header(
          "cache-control",
          relative(root, path).startsWith(builtAssets)
            ? `public, max-age=${String(oneYearInSeconds)}, immutable`
            : "no-cache",
        );
      },
    });
  };
}

// Returns a handler that answers a browser's request for one of the front end's pages with the
// front end's page, or undefined for any other request, such as for a file or the API.
export function pageFallback(root: string) {
  // The path comes from the operator's configuration, not from users of the application.
  // eslint-disable-next-line security/detect-non-literal-fs-filename
  const page = readFileSync(join(root, "index.html"));
  return (request: FastifyRequest, reply: FastifyReply) => {
    const { pathname: path } = new URL(request.url, "https://fathom.invalid");
    const isPage =
      (request.method === "GET" || request.method === "HEAD") &&
      !path.startsWith("/api/") &&
      !path.startsWith("/assets/") &&
      (request.headers.accept ?? "").includes("text/html");
    if (!isPage) return undefined;
    return reply
      .header("cache-control", "no-cache")
      .type("text/html; charset=utf-8")
      .send(page);
  };
}
