// SPDX-License-Identifier: Apache-2.0

// A table's export, offered to the Export icon in its page's heading.

import type { ReactNode } from "react";
import { useDialogState } from "./dialog-actions.tsx";
import { ExportQuestion } from "./export-question.tsx";
import {
  appliedViewName,
  classifiedColumns,
  type ExportColumn,
  exportFileName,
  exportQuestion,
  type ExportQuestionWords,
  exportText,
  recordedAndSaved,
  saveFile,
  shownForExport,
  unsavedExport,
} from "./exports.ts";
import { notifyFailure } from "./notices.tsx";
import { useExportingPerson, useOfferedExport } from "./page-export.tsx";
import type { GridRecord, RecordTable } from "./record-table.ts";
import type { SavedViews } from "./table-controls.tsx";
import type { Show } from "@fathom/shared";
import { today } from "./today.ts";

export function useTableExport<
  Rec extends GridRecord,
  Col extends ExportColumn<Rec>,
>({
  table,
  show,
  shown,
  everyone,
  columns,
  liveColumn,
  saved,
}: {
  table: Pick<RecordTable<Rec, never, never>, "label" | "exported"> & {
    liveRecords: (records: readonly Rec[]) => Rec[];
  };
  show: Show;
  // The records the view shows, in its order, and every record, as drafted.
  shown: readonly Rec[];
  everyone: readonly Rec[];
  columns: readonly Col[];
  liveColumn: (column: Col) => Col;
  saved: SavedViews | undefined;
}): ReactNode {
  const dialog = useDialogState<{
    question: ExportQuestionWords;
    run: () => Promise<void>;
  }>();
  const person = useExportingPerson();
  const { exported } = table;
  useOfferedExport(
    exported &&
      ((format) => {
        const classed = (column: Col): Col => {
          const dataClass = exported.classOf?.(column.key);
          return dataClass === undefined ? column : { ...column, dataClass };
        };
        const file = shownForExport(
          show,
          shown,
          table.liveRecords(everyone),
          everyone,
          columns.map(classed),
          (column) => classed(liveColumn(column)),
          exported.asOn,
        );
        const saving = {
          name: exportFileName({
            page: table.label,
            view: appliedViewName(saved),
            person,
            show,
            day: exported.asOn ?? today(),
            format,
          }),
          format,
          text: exportText(format, file.columns, file.rows),
        };
        const held = exported.held?.(shown, show) ?? [];
        const question = exportQuestion(classifiedColumns(file.columns, held));
        if (question === undefined) {
          saveFile(saving).catch(() => {
            notifyFailure(unsavedExport);
          });
        } else {
          dialog.open({
            question,
            run: async () =>
              recordedAndSaved(exported.recordedAs, columns, held, saving),
          });
        }
      }),
  );
  return (
    <ExportQuestion
      question={dialog.dialog?.question}
      opened={dialog.opened}
      onExport={async () => dialog.dialog?.run()}
      onClose={dialog.close}
      onClosed={dialog.forget}
    />
  );
}
