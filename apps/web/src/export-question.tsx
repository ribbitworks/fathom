// SPDX-License-Identifier: Apache-2.0

// The question asked before an export holding Personal or Confidential data, naming each class
// held in its own colour, with its columns, so nobody shares them by mistake. Exporting records it
// in the access history, then saves the file; a refusal is shown in the dialog and saves nothing.
// It can't be closed while the export is being recorded.

import { type ClassifiedTier, classNames } from "@fathom/shared";
import { Stack, Text } from "@mantine/core";
import { Fragment, useState } from "react";
import { BusyModal, DialogActions } from "./dialog-actions.tsx";
import { type ExportQuestionWords, failedExport } from "./exports.ts";
import questionClasses from "./export-question.module.css";

// The class is always one of the fixed classes, each a style of the module.
// eslint-disable-next-line security/detect-object-injection
const classColour = (dataClass: ClassifiedTier) => questionClasses[dataClass];

// The class is always one of the fixed classes, each a key of the names.
// eslint-disable-next-line security/detect-object-injection
const nameOfClass = (dataClass: ClassifiedTier) => classNames[dataClass];

// The classes held, each followed by its columns, such as This file holds Confidential data (Salary)
// and Personal data (Home address).
function HeldData({ held }: { held: ExportQuestionWords["held"] }) {
  return (
    <Text>
      This file holds{" "}
      {held.map(({ dataClass, columns }, place) => (
        <Fragment key={dataClass}>
          {place > 0 && " and "}
          <span className={classColour(dataClass)}>
            {nameOfClass(dataClass)}
          </span>{" "}
          data (
          <Text component="span" inherit fw={600}>
            {columns.join(", ")}
          </Text>
          )
        </Fragment>
      ))}
      .
    </Text>
  );
}

export function ExportQuestion({
  question,
  opened,
  onExport,
  onClose,
  onClosed,
}: {
  question: ExportQuestionWords | undefined;
  opened: boolean;
  onExport: () => Promise<void>;
  onClose: () => void;
  // Once it has closed, so the file's text it holds is let go of.
  onClosed: () => void;
}) {
  const [error, setError] = useState<Error | null>(null);
  // A refusal shown last time is gone when it next opens.
  const close = () => {
    setError(null);
    onClose();
  };
  return (
    <BusyModal
      opened={opened && question !== undefined}
      onClose={close}
      onExitTransitionEnd={onClosed}
      title={question?.title}
    >
      {(onBusy, busy) => {
        // Kept in the modal rather than in a query client's mutation, since tables are drawn
        // without one.
        const exportNow = async () => {
          onBusy(true);
          setError(null);
          try {
            await onExport();
            close();
          } catch (failed) {
            // Recording and saving fail only with errors.
            setError(failed as Error);
          } finally {
            onBusy(false);
          }
        };
        return (
          <form
            noValidate
            onSubmit={(event) => {
              event.preventDefault();
              void exportNow();
            }}
          >
            <Stack>
              <HeldData held={question?.held ?? []} />
              <DialogActions
                error={error}
                pending={busy}
                label="Export"
                onCancel={close}
                failure={failedExport}
              />
            </Stack>
          </form>
        );
      }}
    </BusyModal>
  );
}
