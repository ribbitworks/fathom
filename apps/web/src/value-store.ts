// SPDX-License-Identifier: Apache-2.0

// A value kept apart from a component's state, so changing it redraws only what listens for it, not
// everything that holds the store.

export interface ValueStore<
  Value,
  Kept extends Value | undefined = Value | undefined,
> {
  get: () => Kept;
  set: (value: Value) => void;
  subscribe: (listener: () => void) => () => void;
}

// A store that tells its listeners only when the value set differs from the one kept, by `same`,
// holding `initial` from the start where one is given.
export function valueStore<Value>(
  same: (kept: Value, next: Value) => boolean,
  initial: Value,
): ValueStore<Value, Value>;
export function valueStore<Value>(
  same: (kept: Value, next: Value) => boolean,
): ValueStore<Value>;
export function valueStore<Value>(
  same: (kept: Value, next: Value) => boolean,
  initial?: Value,
): ValueStore<Value> {
  let current = initial;
  const listeners = new Set<() => void>();
  return {
    get: () => current,
    set: (value) => {
      if (current !== undefined && same(current, value)) return;
      current = value;
      for (const listener of listeners) listener();
    },
    subscribe: (listener) => {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
  };
}
