// Describes anything thrown, which in JavaScript need not be an Error.
export function describeError(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
