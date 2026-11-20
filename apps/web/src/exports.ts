// SPDX-License-Identifier: Apache-2.0

// Exporting a table as a CSV or TSV file: the columns and rows the view shows, in its order, each
// value in a form other programs read, with the unit of a column's amounts in its heading. An
// export holding Personal or Confidential data asks first, naming the classes and their columns,
// and is recorded in the access history before the file is saved.
//
// A file is always flat rows, whatever the view is grouped by, since spreadsheets filter and sort
// only rows without headings. A table offers its export to the Export icon in its page's heading,
// through useTableExport in table-export.tsx.

import {
  capitalized,
  type ClassifiedColumns,
  classifiedData as classifiedOf,
  type ClassifiedField,
  type ClassifiedTier,
  type Choice,
  type Tier,
  type ExportedTable,
  type ExportRequest,
  type ExportRecorded,
  exportRecordedSchema,
  heldClassNames,
  heldData,
  type Link,
  linkInWords,
  notePlainText,
  type Show,
  typedNumber,
} from "@fathom/shared";
import { sendJsonFor } from "./api.ts";
import { cellKinds, labels, startingText } from "./cell-kinds.tsx";
import type { GridRecord } from "./record-table.ts";
import type { SavedViews } from "./table-controls.tsx";
import {
  besideLive,
  changeWord,
  type DraftLike,
  viewedDraft,
  waitingWords,
} from "./status-mark.tsx";
import {
  asText,
  type CellValue,
  type Kind,
  type TableColumn,
  valueOrStandIn,
} from "./table-view.ts";

export type ExportFormat = "csv" | "tsv";

// What the Export menu calls a format, such as CSV file.
export const formatLabel = (format: ExportFormat): string =>
  `${format.toUpperCase()} file`;

// The formats offered, in order.
export const exportFormats: readonly ExportFormat[] = ["csv", "tsv"];

// A column as exported: as the view shows it, in the unit and to the places it names, with the
// class of its values, General unless it says otherwise. A table's own columns are these.
export type ExportColumn<Row> = Pick<
  TableColumn<Row>,
  | "key"
  | "label"
  | "kind"
  | "value"
  | "standIn"
  | "unit"
  | "places"
  | "dataClass"
  | "multiple"
> & { choices: readonly Choice[] };

// Which form of a record a row of the file is: its draft, its live form under its draft, or the
// record, when it has no draft.
export type ExportVersion = "draft" | "live" | "record";

export interface ExportRow<Rec> {
  record: Rec;
  version: ExportVersion;
  // For a live row where the view shows only what is live: the draft waiting to change it, if any.
  waiting?: DraftLike | undefined;
}

// Several values in one cell, such as a person's teams.
const joiner = "; ";

function exportedLink(value: CellValue): string {
  const link = value as Link | null;
  return link === null ? "" : linkInWords(link);
}

// Each kind's value as a file holds it: days and months as typed, numbers without their unit,
// choices by name, notes as plain text, and checkboxes as Yes or No.
const exportedByKind: Readonly<
  Record<Kind, (column: ExportColumn<never>, value: CellValue) => string>
> = {
  text: (_column, value) => asText(value),
  date: (_column, value) => asText(value),
  month: (_column, value) => asText(value),
  // As typed everywhere in Fathom, such as 1234.5, rounded up to the places the view shows.
  number: (column, value) => startingText(column, asText(value)),
  choice: (column, value) => labels(column, value).join(joiner),
  link: (_column, value) => exportedLink(value),
  note: (_column, value) => notePlainText(asText(value)),
  flag: (column, value) => cellKinds.flag.inWords(column, value),
};

// A column's heading, naming the unit its amounts are in, such as Effort (PD).
export const exportHeading = ({
  label,
  unit,
}: Pick<ExportColumn<never>, "label" | "unit">): string =>
  unit === undefined ? label : `${label} (${unit.code})`;

export function exportValue<Row>(column: ExportColumn<Row>, row: Row): string {
  const exported = exportedByKind[column.kind] as (
    column: ExportColumn<Row>,
    value: CellValue,
  ) => string;
  return exported(column, valueOrStandIn(column, row));
}

// Formula characters a spreadsheet would run a cell starting with, so a value such as =SUM(A1)
// someone typed is kept as text rather than run when the file is opened.
const formulaStart = /^[=+\-@\t\r]/u;

// A value made safe to open in a spreadsheet; a number, such as -3, is left as it is.
const withoutFormula = (value: string): string =>
  !formulaStart.test(value) || typedNumber(value) !== undefined
    ? value
    : `'${value}`;

// RFC 4180: a value holding the separator, a quote or a line break is quoted, its quotes doubled.
// TSV files are quoted the same way, which spreadsheets read, so tabs and line breaks in a note
// stay as they are.
const separators: Readonly<Record<ExportFormat, string>> = {
  csv: ",",
  tsv: "\t",
};

function quoted(value: string, separator: string): string {
  return value.includes(separator) ||
    value.includes('"') ||
    value.includes("\n") ||
    value.includes("\r")
    ? `"${value.replaceAll('"', '""')}"`
    : value;
}

const lineEnd = "\r\n";

// A byte order mark, so spreadsheets read the file as UTF-8 and names in any script come through.
const byteOrderMark = "\uFEFF";

export function exportText<Row>(
  format: ExportFormat,
  columns: readonly ExportColumn<Row>[],
  records: readonly Row[],
): string {
  // The format is one of the typed formats, each a key of the table.
  // eslint-disable-next-line security/detect-object-injection
  const separator = separators[format];
  const line = (values: readonly string[]) =>
    values.map((value) => quoted(value, separator)).join(separator);
  const heading = line(
    columns.map((column) => withoutFormula(exportHeading(column))),
  );
  const rows = records.map((record) =>
    line(columns.map((column) => withoutFormula(exportValue(column, record)))),
  );
  return `${byteOrderMark}${[heading, ...rows].join(lineEnd)}${lineEnd}`;
}

// Characters no file name may hold on the systems Fathom's readers use, spaces, and the underscores
// and hyphens the name itself joins with, so each part's words are joined by hyphens.
const unsafeInName = /[\\/:*?"<>|\p{Cc}\s_-]+/gu;

// A part of a file's name in lower case, its words joined by hyphens, as a day's are.
const namePart = (part: string): string =>
  part
    .toLocaleLowerCase()
    .replaceAll(unsafeInName, " ")
    .trim()
    .replaceAll(" ", "-");

// What a file's name says of the drafts it holds, by what the view shows.
const heldDrafts: Readonly<Record<Show, string>> = {
  both: "drafts and live",
  drafts: "drafts",
  live: "",
};

// A file's name, in lower case, its parts joined by underscores and each part's words by hyphens:
// Fathom, so it is found among others, the page, the saved view if one is applied, who exported it,
// the drafts it holds, if any, and the day it shows, such as
// fathom_people_engineers_engineering-director_drafts-and-live_2027-03-31.csv.
export function exportFileName({
  page,
  view,
  person,
  show,
  day,
  format,
}: {
  page: string;
  view?: string | undefined;
  person: string;
  show: Show;
  day: string;
  format: ExportFormat;
}): string {
  // The view's choice is one of the typed choices, each a key of the table.
  // eslint-disable-next-line security/detect-object-injection
  const drafts = heldDrafts[show];
  const name = ["Fathom", page, view ?? "", person, drafts, day]
    .map(namePart)
    .filter((part) => part !== "")
    .join("_");
  return `${name}.${format}`;
}

const mediaTypes: Readonly<Record<ExportFormat, string>> = {
  csv: "text/csv",
  tsv: "text/tab-separated-values",
};

// The format is one of the typed formats, each a key of the table.
// eslint-disable-next-line security/detect-object-injection
const mediaTypeOf = (format: ExportFormat): string => mediaTypes[format];

export interface ExportFile {
  name: string;
  format: ExportFormat;
  text: string;
}

// How long the browser keeps a downloaded file's text, in milliseconds.
const keptForSaving = 60_000;

// Writes a file where it was chosen to be saved. A file refused after its place was chosen is not
// written there, and nothing already there is removed, since it may be a file chosen to be replaced.
type SavePlace = () => Promise<void>;

// The Save dialog Chrome, Edge and other browsers built on Chromium offer web pages, which Safari
// and Firefox don't, typed here as TypeScript's own types leave it out.
type SaveFilePicker = (options: {
  suggestedName: string;
  types: { description: string; accept: Record<string, string[]> }[];
}) => Promise<FileSystemFileHandle>;

const savePicker = (): SaveFilePicker | undefined =>
  (window as { showSaveFilePicker?: SaveFilePicker }).showSaveFilePicker;

// The browser's own download, which saves where its settings say, asking first if they say so.
function downloaded({ name, format, text }: ExportFile): SavePlace {
  return async () => {
    const url = URL.createObjectURL(
      new Blob([text], { type: `${mediaTypeOf(format)};charset=utf-8` }),
    );
    const link = document.createElement("a");
    link.href = url;
    link.download = name;
    link.click();
    // Let go of the file's text once the browser has had time to start saving it; letting go at
    // once can stop Safari and Firefox saving it.
    window.setTimeout(() => {
      URL.revokeObjectURL(url);
    }, keptForSaving);
    return Promise.resolve();
  };
}

const isCancelled = (error: unknown) =>
  error instanceof DOMException && error.name === "AbortError";

// Asks where to save a file, in the browser's Save dialog where it offers one, or else leaves it
// to the browser's download; nothing when the person cancels the dialog.
export async function placeToSave(
  file: ExportFile,
): Promise<SavePlace | undefined> {
  const picker = savePicker();
  if (picker === undefined) return downloaded(file);
  let handle: FileSystemFileHandle;
  try {
    handle = await picker({
      suggestedName: file.name,
      types: [
        {
          description: formatLabel(file.format),
          accept: { [mediaTypeOf(file.format)]: [`.${file.format}`] },
        },
      ],
    });
  } catch (error) {
    if (isCancelled(error)) return undefined;
    throw error;
  }
  return async () => {
    const writable = await handle.createWritable();
    await writable.write(file.text);
    await writable.close();
  };
}

// What a failure to save a file says.
export const unsavedExport =
  "Fathom could not save the file. Try again in a moment.";

// Saves a file, once the person chooses where.
export async function saveFile(file: ExportFile): Promise<void> {
  await (
    await placeToSave(file)
  )?.();
}

// A classified detail an export's rows hold apart from its columns, such as the hiring plan, which
// planned hires' rows are, with its name and class.
export interface HeldDetail {
  field: ClassifiedField;
  name: string;
  dataClass: Tier;
}

// The Personal and Confidential data an export holds: the details its rows hold, then its columns,
// by heading.
export const classifiedColumns = (
  columns: readonly Pick<ExportColumn<never>, "label" | "unit" | "dataClass">[],
  held: readonly HeldDetail[] = [],
): ClassifiedColumns =>
  classifiedOf([
    ...held,
    ...columns.map((column) => ({
      name: exportHeading(column),
      dataClass: column.dataClass ?? "general",
    })),
  ]);

// What a row's draft does, such as Added or Changed, saying so when it is the exporter's own change,
// not yet published, or when it was rejected; empty for a record with no draft.
export function draftInFile(draft: DraftLike | undefined): string {
  if (draft === undefined) return "";
  const change = changeWord(draft) ?? "changed";
  const word = capitalized(change);
  if (draft.state === "rejected") return `${word}, rejected`;
  return draft.unpublished === true ? `${word}, not published` : word;
}

// The columns a file holding drafts starts with: whether each row differs from live, the same under
// every Draft choice, and what the draft does, so a spreadsheet's filters leave out either.
function draftColumns<Rec extends GridRecord>(): ExportColumn<
  ExportRow<Rec>
>[] {
  const words = (
    key: string,
    label: string,
    value: (row: ExportRow<Rec>) => string,
  ): ExportColumn<ExportRow<Rec>> => ({
    key,
    label,
    kind: "text",
    choices: [],
    multiple: false,
    value,
  });
  return [
    words("exportDraft", "Draft", ({ version }) =>
      version === "draft" ? "Yes" : "",
    ),
    words("exportChange", "Change", ({ record, version, waiting }) => {
      if (version === "draft") return draftInFile(record.draft);
      return waiting === undefined ? "" : waitingWords(waiting);
    }),
  ];
}

// A table's column, each row's value in words as the file holds it, a Live row's through the live
// column, so a choice a draft renames keeps its live name there.
function onRows<Rec extends GridRecord>(
  column: ExportColumn<Rec>,
  live: ExportColumn<Rec>,
): ExportColumn<ExportRow<Rec>> {
  const { key, label, unit, places, dataClass } = column;
  return {
    key,
    label,
    kind: "text",
    unit,
    places,
    dataClass,
    multiple: false,
    choices: [],
    value: ({ record, version }) =>
      exportValue(version === "live" ? live : column, record),
  };
}

// The rows and columns a view shows, as a file holds them, so the file matches the screen: with the
// drafts beside their live values, each drafted record's draft row, then its Live row; with the
// drafts applied, the records as drafted; live only, the records as they are, none marked as a draft, with what
// the draft waiting to change it does, as its green dot's tip says; each after the Draft and Change
// columns.
export function shownForExport<
  Rec extends GridRecord,
  Col extends ExportColumn<Rec>,
>(
  show: Show,
  shown: readonly Rec[],
  live: readonly Rec[],
  drafted: readonly Rec[],
  columns: readonly Col[],
  liveColumn: (column: Col) => Col,
): { rows: ExportRow<Rec>[]; columns: ExportColumn<ExportRow<Rec>>[] } {
  const ofRecords = columns.map((column) => onRows(column, liveColumn(column)));
  const columnsWithDrafts = [...draftColumns<Rec>(), ...ofRecords];
  if (show === "live") {
    const waitingOf = new Map(
      drafted.flatMap((record) =>
        record.draft !== undefined && viewedDraft(record.draft, show).live
          ? [[record.id, record.draft] as const]
          : [],
      ),
    );
    return {
      rows: shown.map((record) => ({
        record,
        version: "live",
        waiting: waitingOf.get(record.id),
      })),
      columns: columnsWithDrafts,
    };
  }
  const byId = new Map(live.map((record) => [record.id, record]));
  const rows = shown.flatMap((record): ExportRow<Rec>[] => {
    if (record.draft === undefined) return [{ record, version: "record" }];
    // As on screen, only a changed record has a Live row under its draft.
    const asLive =
      besideLive(show) && record.draft.action === "changed"
        ? byId.get(record.id)
        : undefined;
    return [
      { record, version: "draft" },
      ...(asLive === undefined
        ? []
        : [{ record: asLive, version: "live" as const }]),
    ];
  });
  return { rows, columns: columnsWithDrafts };
}

// What is asked before an export holding Personal or Confidential data, or nothing for one that
// holds none: a title, such as Export Confidential and Personal data?, and each class held, the most
// sensitive first, with its columns.
export interface ExportQuestionWords {
  title: string;
  held: readonly { dataClass: ClassifiedTier; columns: readonly string[] }[];
}

export function exportQuestion(
  columns: ClassifiedColumns,
): ExportQuestionWords | undefined {
  const held = heldData(columns);
  if (held.length === 0) return undefined;
  return { title: `Export ${heldClassNames(columns)} data?`, held };
}

// The name of the saved view applied, if any, which an exported file's name gives.
export const appliedViewName = (
  saved: Pick<SavedViews, "views" | "applied"> | undefined,
): string | undefined =>
  saved?.views.find(({ id }) => id === saved.applied)?.name;

// Tells the server of an export, which records it when it holds Personal or Confidential data.
export async function recordExport(
  record: ExportRequest,
): Promise<ExportRecorded> {
  return sendJsonFor("POST", "/api/exports", record, exportRecordedSchema);
}

// What the server is told of an export: the table, each column's key and each classified detail the
// rows hold, which it finds the classes and names by.
export const exportRecordOf = (
  table: ExportedTable,
  columns: readonly Pick<ExportColumn<never>, "key">[],
  held: readonly Pick<HeldDetail, "field">[] = [],
): ExportRequest => ({
  table,
  columns: columns.map((column) => column.key),
  details: held.map(({ field }) => field),
});

// What a failed export says in its question when the server gives no reason, since a failure may
// come from recording it, from the browser's Save dialog, or from writing the file.
export const failedExport =
  "Fathom could not export the file. Try again in a moment.";

// Why an export holding Personal or Confidential data from a table the server can't record one of
// fails.
export const unrecordedExport = "This table's export can't be recorded";

// Asks where to save an export holding Personal or Confidential data, then records it, then saves
// it there, so an export is recorded only once a place is chosen, and a refusal writes nothing.
export async function recordedAndSaved(
  table: ExportedTable | undefined,
  columns: readonly Pick<ExportColumn<never>, "key">[],
  held: readonly Pick<HeldDetail, "field">[],
  file: ExportFile,
): Promise<void> {
  if (table === undefined) throw new Error(unrecordedExport);
  const place = await placeToSave(file);
  if (place === undefined) return;
  await recordExport(exportRecordOf(table, columns, held));
  await place();
}
