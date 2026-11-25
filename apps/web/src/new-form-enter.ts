// SPDX-License-Identifier: Apache-2.0

// What Enter in a form's field does once its value is saved: the form's own action, such as Add or
// Fill. Only such a form gives it, so Enter in a record's details saves the value alone.

import { createContext, useEffect, useEffectEvent, useState } from "react";

export const NewFormEnter = createContext<(() => void) | undefined>(undefined);

// An action asked for as a field's value is saved, run once the form is drawn again, so it acts on
// the values as saved rather than as they were when it was asked for.
export function useAfterUpdate<Given>(
  act: (given: Given) => void,
): (given: Given) => void {
  const [asked, setAsked] = useState<{ given: Given }>();
  const run = useEffectEvent(act);
  useEffect(() => {
    if (asked !== undefined) run(asked.given);
  }, [asked]);
  return (given) => {
    setAsked({ given });
  };
}
