// SPDX-License-Identifier: Apache-2.0

// The check for passwords too common or easy to guess, loaded only when a form for a new password
// first opens, since its dictionaries are too large for the bundle every page loads. Until it has
// loaded, or if it cannot load, the form leaves the check to the server, which always makes it.

import type { GuessableCheck } from "@fathom/shared";
import { useEffect, useState } from "react";

let loading: Promise<GuessableCheck> | undefined;

// Loaded once and kept, unless loading fails, when the next form to open tries again.
export function loadGuessableCheck(
  load: () => Promise<{ isGuessable: GuessableCheck }> = () =>
    import("@fathom/shared/guessable-passwords"),
): Promise<GuessableCheck> {
  loading ??= load().then(
    ({ isGuessable }) => isGuessable,
    (error: unknown) => {
      loading = undefined;
      throw error;
    },
  );
  return loading;
}

// The check once it has loaded, or undefined until then, or if it cannot load.
export function useGuessableCheck(
  load: () => Promise<GuessableCheck> = loadGuessableCheck,
): GuessableCheck | undefined {
  const [check, setCheck] = useState<GuessableCheck>();
  useEffect(() => {
    load().then(
      (loaded) => {
        setCheck(() => loaded);
      },
      () => undefined,
    );
  }, [load]);
  return check;
}
