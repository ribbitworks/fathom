// SPDX-License-Identifier: Apache-2.0

// Puts one record of an ordered set, such as a choice in a list or a column on a table, in a new
// place, renumbering the set. Part of the data access layer.

export type Place = { after: string | null } | "end";

// Where a record sat, as the record before it, or null for the top, and where it sits now.
export interface Moved {
  before: string | null;
  after: string | null;
}

// Moves the record, which the caller has found in the set, to just after another, to the top when
// that is null, or to the end, saving each position that changes, and returns where it was and is
// now. Returns null when the record to follow is not in the set.
export async function place(
  rows: readonly { id: string; position: number }[],
  id: string,
  where: Place,
  setPosition: (id: string, position: number) => Promise<void>,
): Promise<Moved | null> {
  const before = previousOf(rows, id);
  const moved = rows.filter((row) => row.id === id);
  const others = rows.filter((row) => row.id !== id);
  let insertAt = others.length;
  if (where !== "end") {
    insertAt =
      where.after === null
        ? 0
        : others.findIndex((row) => row.id === where.after) + 1;
    if (insertAt === 0 && where.after !== null) return null;
  }
  const ordered = [
    ...others.slice(0, insertAt),
    ...moved,
    ...others.slice(insertAt),
  ];
  const after = ordered.slice(0, insertAt).at(-1)?.id ?? null;
  if (after !== before) {
    for (const [index, row] of ordered.entries()) {
      if (row.position !== index + 1) await setPosition(row.id, index + 1);
    }
  }
  return { before, after };
}

// The record just before another in an ordered set, or null for the top.
export function previousOf(
  rows: readonly { id: string }[],
  id: string,
): string | null {
  const at = rows.findIndex((row) => row.id === id);
  return rows.slice(0, Math.max(at, 0)).at(-1)?.id ?? null;
}
