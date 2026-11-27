// SPDX-License-Identifier: Apache-2.0

// The keys every editor of a value shares, in a table's cell and in a details panel alike.

import type { KeyboardEvent } from "react";

// Whether a key starts a new line in a value of several lines, as Shift+Enter does, rather than
// saving it, as Enter does everywhere else.
export const startsLine = (
  event: Pick<KeyboardEvent, "key" | "shiftKey">,
  field: { multiline?: boolean | undefined },
) => event.key === "Enter" && event.shiftKey && field.multiline === true;
