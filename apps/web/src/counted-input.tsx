// SPDX-License-Identifier: Apache-2.0

// A field's count of characters against its limit, and a text box that shows it.

import type { TextInputProps } from "@mantine/core";
import { ClearableInput } from "./clearable-input.tsx";
import classes from "./pages.module.css";

// How close to a field's limit its count of characters appears.
const nearLimit = 5;

const countShown = (length: number, maximum: number) =>
  length >= maximum - nearLimit;

// The count of characters, shown only near the limit, and in red over it.
export function Count({
  length,
  maximum,
}: {
  length: number;
  maximum: number;
}) {
  if (!countShown(length, maximum)) return null;
  return (
    <span className={length > maximum ? classes.countOver : classes.count}>
      {length}/{maximum}
    </span>
  );
}

// A text box with its count of characters, as they will be saved, without spaces at either end, and
// the × that empties it.
export function CountedInput({
  value,
  maximum,
  label,
  onValue,
  ...props
}: Omit<
  TextInputProps,
  "value" | "label" | "onChange" | "rightSection" | "rightSectionWidth"
> & {
  value: string;
  maximum: number;
  label: string;
  // The text as typed, or emptied by the ×.
  onValue: (value: string) => void;
}) {
  const length = value.trim().length;
  return (
    <ClearableInput
      {...props}
      label={label}
      value={value}
      clearLabel={`Clear ${label}`}
      onChange={(event) => {
        onValue(event.currentTarget.value);
      }}
      onClear={() => {
        onValue("");
      }}
      beside={
        countShown(length, maximum) ? (
          <Count length={length} maximum={maximum} />
        ) : undefined
      }
    />
  );
}
