// SPDX-License-Identifier: Apache-2.0

// Helpers for reporting errors as plain messages in logs and command output.

// Describes anything thrown, which in JavaScript need not be an Error.
export function describeError(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
