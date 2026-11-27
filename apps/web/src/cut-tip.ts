// SPDX-License-Identifier: Apache-2.0

// A tip giving the whole of words cut short.

import { type FocusEvent, type KeyboardEvent, useState } from "react";

export function useCutTip() {
  const [words, setWords] = useState<HTMLElement | null>(null);
  const [shown, setShown] = useState(false);
  const show = (on: boolean) => {
    setShown(on && words !== null && words.scrollWidth > words.clientWidth);
  };
  return {
    // Given as the ref of the element whose words may be cut short.
    words: setWords,
    shown,
    target: {
      onMouseEnter: () => {
        show(true);
      },
      onMouseLeave: () => {
        show(false);
      },
      // Focus a menu hands back as it closes after a click is not shown, as the browser's own
      // focus ring isn't.
      onFocus: (event: FocusEvent<HTMLElement>) => {
        show(event.currentTarget.matches(":focus-visible"));
      },
      onBlur: () => {
        show(false);
      },
      // So a tip shown on focus can be put away without moving focus.
      onKeyDown: (event: KeyboardEvent<HTMLElement>) => {
        if (event.key === "Escape") show(false);
      },
    },
  };
}
