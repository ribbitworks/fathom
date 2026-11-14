// SPDX-License-Identifier: Apache-2.0

// Changing the class of data, for a role with Classify data: a built-in detail, a list, or a column
// with a class of its own. Each class the data can't go to is turned off, with why. The change takes
// effect at once, so the dialog saves it itself, and cannot be closed while it saves. A new list or
// column is given its class with the same choice.

import {
  classNames,
  type Permission,
  type Tier,
  tierSchema,
  whyNoMove,
} from "@fathom/shared";
import { Modal, Radio, Stack } from "@mantine/core";
import { useMutation } from "@tanstack/react-query";
import { useState } from "react";
import { DialogActions, useDialogState } from "./dialog-actions.tsx";

// What is being moved: its name, as the dialog's title gives it, its class now, the request that
// moves it, and what the page shows once it has moved.
export interface MoveSubject {
  name: string;
  from: Tier;
  move: (to: Tier) => Promise<unknown>;
  moved: (to: Tier) => void;
  // Why the data can't go to a class, for a reason of its own beyond the role's, if any.
  refusal?: ((to: Tier) => string | undefined) | undefined;
}

// The classes data may be moved to from its class now, each turned off with why where it can't be.
export function ClassChoice({
  from,
  value,
  permissions,
  refusal,
  onChange,
}: {
  from: Tier;
  value: Tier;
  permissions: readonly Permission[];
  refusal?: MoveSubject["refusal"];
  onChange: (dataClass: Tier) => void;
}) {
  return (
    <Radio.Group
      label="Class"
      value={value}
      onChange={(chosen) => {
        onChange(tierSchema.parse(chosen));
      }}
    >
      <Stack gap="sm" mt="xs">
        {tierSchema.options.map((dataClass) => {
          const refused =
            dataClass === from
              ? undefined
              : (whyNoMove(permissions, from, dataClass) ??
                refusal?.(dataClass));
          return (
            <Radio
              key={dataClass}
              value={dataClass}
              // The class is always one of the fixed classes.
              // eslint-disable-next-line security/detect-object-injection
              label={classNames[dataClass]}
              description={refused}
              disabled={refused !== undefined}
            />
          );
        })}
      </Stack>
    </Radio.Group>
  );
}

function MoveClassDialog({
  moving: { from, move, moved, refusal },
  permissions,
  onDone,
  onCancel,
  onBusy,
}: {
  moving: MoveSubject;
  permissions: readonly Permission[];
  onDone: () => void;
  onCancel: () => void;
  onBusy: (busy: boolean) => void;
}) {
  const [to, setTo] = useState(from);
  const changing = useMutation({
    mutationFn: move,
    onMutate: () => {
      onBusy(true);
    },
    onSettled: () => {
      onBusy(false);
    },
    onSuccess: (_saved, chosen) => {
      onDone();
      moved(chosen);
    },
  });
  return (
    <form
      noValidate
      onSubmit={(event) => {
        event.preventDefault();
        if (to === from) onCancel();
        else changing.mutate(to);
      }}
    >
      <Stack gap="md">
        <ClassChoice
          from={from}
          value={to}
          permissions={permissions}
          refusal={refusal}
          onChange={setTo}
        />
        <DialogActions
          error={changing.error}
          pending={changing.isPending}
          label="Change"
          onCancel={onCancel}
        />
      </Stack>
    </form>
  );
}

// The dialog in its modal, open while something is being moved.
export function MoveClassModal({
  moving,
  opened,
  permissions,
  onClose,
}: {
  moving: MoveSubject | undefined;
  opened: boolean;
  permissions: readonly Permission[];
  onClose: () => void;
}) {
  const [busy, setBusy] = useState(false);
  return (
    <Modal
      opened={opened}
      onClose={onClose}
      closeOnEscape={!busy}
      closeOnClickOutside={!busy}
      withCloseButton={!busy}
      title={moving && `Change the class of ${moving.name}`}
    >
      {moving && (
        <MoveClassDialog
          moving={moving}
          permissions={permissions}
          onDone={onClose}
          onCancel={onClose}
          onBusy={setBusy}
        />
      )}
    </Modal>
  );
}

export const useClassMove = () => useDialogState<MoveSubject>();
