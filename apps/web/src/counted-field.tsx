// SPDX-License-Identifier: Apache-2.0

// A counted text box held by a react-hook-form form, which focuses it when the form refuses it.

import {
  type Control,
  Controller,
  type FieldPath,
  type FieldValues,
} from "react-hook-form";
import { CountedInput } from "./counted-input.tsx";

export function CountedField<Values extends FieldValues>({
  control,
  name,
  label,
  maximum,
  error,
  description,
  autoComplete,
  autoFocus = false,
  disabled = false,
}: {
  control: Control<Values>;
  name: FieldPath<Values>;
  label: string;
  maximum: number;
  error: string | undefined;
  description?: string;
  autoComplete?: string;
  autoFocus?: boolean;
  disabled?: boolean;
}) {
  return (
    <Controller
      control={control}
      name={name}
      render={({ field }) => (
        <CountedInput
          label={label}
          maximum={maximum}
          error={error}
          {...(description === undefined ? {} : { description })}
          {...(autoComplete === undefined ? {} : { autoComplete })}
          {...(autoFocus ? { "data-autofocus": true } : {})}
          disabled={disabled}
          name={field.name}
          // The forms give every counted field a starting text.
          value={String(field.value)}
          inputRef={field.ref}
          onBlur={field.onBlur}
          onValue={field.onChange}
        />
      )}
    />
  );
}
