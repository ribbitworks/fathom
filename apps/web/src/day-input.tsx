// SPDX-License-Identifier: Apache-2.0

// The one box Fathom has for typing a day, such as 2026-10-31: it takes only digits and dashes,
// laid out as a day as they fill it, so 20261031 becomes 2026-10-31, and the box says what to type
// once a whole day is typed that is not one. It gives the day once it is whole, and undefined until
// then, and says whether anything is typed, so a box that may be left empty can tell empty from
// unfinished. Assistive technology hears whether a day is needed.

import { isDay, typedDay } from "@fathom/shared";
import { TextInput } from "@mantine/core";
import { useState } from "react";

export const dayProblem = "Use a date such as 2026-10-31";

export function DayInput({
  label,
  value,
  description,
  required = true,
  autoFocus = false,
  size,
  placeholder,
  problem,
  shown = false,
  onChange,
}: {
  label: string;
  value: string | undefined;
  description?: string | undefined;
  // Whether a submitted form needs a day here.
  required?: boolean;
  autoFocus?: boolean;
  size?: string;
  placeholder?: string;
  // What is wrong with the day beside others, if anything.
  problem?: string | undefined;
  // Whether to say a missing or partial day is not one, as once a form is submitted.
  shown?: boolean;
  onChange: (day: string | undefined, typed: boolean) => void;
}) {
  const [text, setText] = useState(value ?? "");
  const whole = isDay(text);
  const unfinished = text !== "" && !whole;
  const wrong = unfinished && (shown || text.length >= "2026-10-31".length);
  return (
    <TextInput
      label={label}
      {...(size === undefined ? {} : { size })}
      {...(placeholder === undefined ? {} : { placeholder })}
      {...(description === undefined ? {} : { description })}
      aria-required={required}
      autoComplete="off"
      inputMode="numeric"
      {...(autoFocus ? { "data-autofocus": true } : {})}
      value={text}
      error={wrong || (shown && required && text === "") ? dayProblem : problem}
      onChange={(event) => {
        const next = typedDay(event.currentTarget.value.replace(/[^\d-]/g, ""));
        setText(next);
        onChange(isDay(next) ? next : undefined, next !== "");
      }}
    />
  );
}
