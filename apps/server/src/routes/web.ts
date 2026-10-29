// SPDX-License-Identifier: Apache-2.0

// Serves the built front end. Vite names its scripts and styles after their contents, so browsers
// may keep them for a year; the page itself is checked with the server on every visit, so a new
// release is picked up straight away. Hidden files are never served, and unknown files fall through
// to the plain not found response.

import fastifyStatic from "@fastify/static";
import type { FastifyPluginAsync } from "fastify";
import { relative, sep } from "node:path";

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
