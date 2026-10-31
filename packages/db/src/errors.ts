// SPDX-License-Identifier: Apache-2.0

// Helpers for reporting errors as plain messages in logs and command output.

// Describes anything thrown, which in JavaScript need not be an Error.
export function describeError(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

// Codes of database errors that callers turn into answers for users.
export const databaseCodes = {
  uniqueViolation: "23505",
  // A record cannot be deleted while another refers to it.
  restrictViolation: "23001",
  foreignKeyViolation: "23503",
  checkViolation: "23514",
  // Two changes saved at the same moment waited on each other, and one was stopped.
  deadlockDetected: "40P01",
  serializationFailure: "40001",
} as const;

// Whether an error, or one it wraps, has the given database code. Drizzle wraps the driver's errors,
// so the code may be on a cause.
export function hasDatabaseCode(error: unknown, code: string): boolean {
  for (let cause = error; cause instanceof Error; cause = cause.cause) {
    if ((cause as { code?: unknown }).code === code) return true;
  }
  return false;
}
