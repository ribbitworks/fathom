// SPDX-License-Identifier: Apache-2.0

// A field's count of characters against its limit, and a text box that shows it.

import { TextInput, type TextInputProps } from "@mantine/core";
import classes from "./pages.module.css";

// How close to a field's limit its count of characters appears.
const nearLimit = 5;

// The count of characters, shown only near the limit, and in red over it.
export function Count({
  length,
  maximum,
}: {
  length: number;
  maximum: number;
}) {
  if (length < maximum - nearLimit) return null;
  return (
    <span className={length > maximum ? classes.countOver : classes.count}>
      {length}/{maximum}
    </span>
  );
}

// A text box with its count of characters, as they will be saved, without spaces at either end.
export function CountedInput({
  value,
  maximum,
  ...props
}: Omit<TextInputProps, "value" | "rightSection" | "rightSectionWidth"> & {
  value: string;
  maximum: number;
}) {
  return (
    <TextInput
      {...props}
      value={value}
      rightSection={<Count length={value.trim().length} maximum={maximum} />}
      rightSectionWidth={56}
    />
  );
}
