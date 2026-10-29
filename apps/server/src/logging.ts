// SPDX-License-Identifier: Apache-2.0

// Logger settings that keep personal data out of the logs: requests are logged by method, path, and
// client address only, errors from the database without their messages, and known sensitive fields
// are redacted.

import type { FastifyRequest } from "fastify";

// Where logs are written: anything that accepts each log line.
export interface LogStream {
  write(line: string): void;
}

// Error causes followed when looking for database details, enough for any wrapped error.
const maximumCauses = 10;

function causeChain(error: Error): Error[] {
  const chain: Error[] = [];
  let current: unknown = error;
  while (current instanceof Error && chain.length < maximumCauses) {
    chain.push(current);
    current = current.cause;
  }
  return chain;
}

// Stack frames only; the first line of a stack repeats the message.
function stackFrames(error: Error): string {
  return String(error.stack)
    .split("\n")
    .filter((line) => line.trimStart().startsWith("at "))
    .join("\n");
}

// Database errors can carry the query, its parameters, and the values that caused them, any of
// which can be personal data, so they are logged by type and code only. PostgreSQL's code says what
// went wrong, such as 23505 for a duplicate value.
export function serializeError(error: Error) {
  const chain = causeChain(error);
  const fromDatabase = chain.some(
    (link) => "query" in link || "severity" in link,
  );
  if (!fromDatabase) {
    return {
      type: error.name,
      message: error.message,
      stack: stackFrames(error),
    };
  }
  const code = chain
    .map((link) => (link as { code?: unknown }).code)
    .find((value) => typeof value === "string");
  return {
    type: error.name,
    message: "A database error, logged without its details",
    code,
    stack: stackFrames(error),
  };
}

// Query strings can hold personal data, so they are not logged. The client's address is personal
// data too, but is kept to investigate security problems, such as where an attack came from.
function serializeRequest(request: FastifyRequest) {
  return {
    method: request.method,
    path: request.url.split("?")[0],
    clientAddress: request.ip,
  };
}

// Pino logs an error's own message when a log call gives none, bypassing the error serializer, so
// every call that logs only an object is given a fixed message.
function withMessage(
  this: unknown,
  args: unknown[],
  method: (...args: unknown[]) => void,
): void {
  if (args.length === 1 && typeof args[0] === "object") {
    method.apply(this, [args[0], "Logged without a message"]);
    return;
  }
  method.apply(this, args);
}

export function loggerOptions(stream: LogStream) {
  return {
    level: "info",
    stream,
    // Only the process id; the machine's name can include its owner's name.
    base: { pid: process.pid },
    serializers: { req: serializeRequest, err: serializeError },
    hooks: { logMethod: withMessage },
    redact: {
      paths: ["password", "*.password", "*.authorization", "*.cookie"],
      censor: "[redacted]",
    },
  };
}
