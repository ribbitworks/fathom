// SPDX-License-Identifier: Apache-2.0

// What Enter in a New form's field does once its value is saved: adds the record, as Add does. Only
// a New form gives it, so Enter in a record's details saves the value alone.

import { createContext } from "react";

export const NewFormEnter = createContext<(() => void) | undefined>(undefined);
