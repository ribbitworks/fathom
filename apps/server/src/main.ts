// SPDX-License-Identifier: Apache-2.0

// The server's entry point. Starts the server with settings from the environment, and closes it
// cleanly when the process is asked to end.

import { closeOnSignals, serveCommand } from "./server.ts";

const server = await serveCommand();
if (server === undefined) process.exitCode = 1;
else closeOnSignals(server);
