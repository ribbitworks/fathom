// SPDX-License-Identifier: Apache-2.0

// Recognizes database errors the data access layer turns into answers for users, such as a value
// that must be unique. Drizzle wraps the driver's errors, so the code may be on a cause.

export const uniqueViolation = "23505";

export function hasDatabaseCode(error: unknown, code: string): boolean {
  for (let cause = error; cause instanceof Error; cause = cause.cause) {
    if ((cause as { code?: unknown }).code === code) return true;
  }
  return false;
}
