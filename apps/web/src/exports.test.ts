// SPDX-License-Identifier: Apache-2.0

// Tests for exporting a table as a file: each kind of value as a file holds it, CSV and TSV quoting,
// headings naming their unit, values a spreadsheet would run kept as text, the file's name, the
// question asked before exporting Personal or Confidential data, what the server is told, and that
// the file is saved only once the export is recorded.

import type { Choice, Link } from "@fathom/shared";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  appliedViewName,
  classifiedColumns,
  type ExportColumn,
  exportFileName,
  exportHeading,
  exportQuestion,
  exportRecordOf,
  exportText,
  exportValue,
  draftInFile,
  recordedAndSaved,
  saveFile,
  shownForExport,
  unrecordedExport,
} from "./exports.ts";
import type { GridDraft } from "./record-table.ts";
import { bodyOf, savedFiles, serverAnswers } from "./test-support.tsx";

interface Row {
  id: string;
  cell: unknown;
}

const row = (cell: unknown): Row => ({ id: "row-1", cell });

const choice = (id: string, label: string): Choice => ({
  id,
  label,
  description: "",
  retired: false,
});

const column = (
  fields: Partial<ExportColumn<Row>> & Pick<ExportColumn<Row>, "kind">,
): ExportColumn<Row> => ({
  key: "cell",
  label: "Cell",
  choices: [],
  multiple: false,
  value: (record) => record.cell as string,
  dataClass: "general",
  ...fields,
});

const personDays = {
  key: "person-days",
  label: "Person-days",
  code: "PD",
  name: "person-days",
  one: "person-day",
};

const byteOrderMark = "\uFEFF";

describe("exportValue", () => {
  it.each([
    ["text", "Fictional Harbour", "Fictional Harbour"],
    ["date", "2027-03-31", "2027-03-31"],
    ["month", "2027-03", "2027-03"],
  ] as const)("keeps a %s as it is kept", (kind, cell, expected) => {
    expect(exportValue(column({ kind }), row(cell))).toBe(expected);
  });

  it("gives a number without its unit, rounded up to the places shown", () => {
    const effort = column({ kind: "number", unit: personDays, places: 1 });
    expect(exportValue(effort, row("2.53"))).toBe("2.6");
  });

  it("gives a number as kept when the view rounds it to no places of its own", () => {
    expect(exportValue(column({ kind: "number" }), row("-1234.5"))).toBe(
      "-1234.5",
    );
  });

  it("leaves an empty number empty", () => {
    const effort = column({ kind: "number", places: 2 });
    expect(exportValue(effort, row(""))).toBe("");
  });

  it("names several choices, joined by a semicolon, leaving out any no longer known", () => {
    const teams = column({
      kind: "choice",
      multiple: true,
      choices: [
        choice("a", "Fictional Cranes"),
        choice("b", "Fictional Docks"),
      ],
    });
    expect(exportValue(teams, row(["b", "a", "gone"]))).toBe(
      "Fictional Docks; Fictional Cranes",
    );
  });

  it("gives a note's words without their formatting", () => {
    expect(
      exportValue(column({ kind: "note" }), row("**Bold** and _plain_")),
    ).toBe("Bold and plain");
  });

  it.each([
    [{ text: "", address: "https://example.com/a" }, "https://example.com/a"],
    [
      { text: "Fictional wiki", address: "https://example.com/a" },
      "Fictional wiki (https://example.com/a)",
    ],
    [null, ""],
  ] as const)("gives a link with its address", (link, expected) => {
    expect(
      exportValue(column({ kind: "link" }), row(link as Link | null)),
    ).toBe(expected);
  });

  it.each([
    [["yes"], "Yes"],
    [[], "No"],
  ] as const)("gives a checkbox as Yes or No", (cell, expected) => {
    expect(exportValue(column({ kind: "flag" }), row(cell))).toBe(expected);
  });

  it("gives what stands in for an empty value, as the table shows it", () => {
    const named = column({ kind: "text", standIn: () => "SDET, REQ-4100" });
    expect(exportValue(named, row(""))).toBe("SDET, REQ-4100");
  });
});

describe("exportHeading", () => {
  it("names the unit an amount is in", () => {
    expect(exportHeading({ label: "Effort", unit: personDays })).toBe(
      "Effort (PD)",
    );
  });

  it("is the label alone for a column without a unit", () => {
    expect(exportHeading({ label: "Name", unit: undefined })).toBe("Name");
  });
});

describe("exportText", () => {
  const name = column({ key: "name", label: "Name", kind: "text" });

  it("writes a UTF-8 CSV file, headings first, each line ending in CRLF", () => {
    const text = exportText("csv", [name], [row("西尾 亮"), row("Ana")]);
    expect(text).toBe(`${byteOrderMark}Name\r\n西尾 亮\r\nAna\r\n`);
  });

  it("quotes a CSV value holding a comma, a quote or a line break, doubling its quotes", () => {
    const text = exportText(
      "csv",
      [name, name],
      [row('Harbour, "North"\nwing')],
    );
    expect(text).toBe(
      `${byteOrderMark}Name,Name\r\n"Harbour, ""North""\nwing","Harbour, ""North""\nwing"\r\n`,
    );
  });

  it("separates TSV values by tabs, quoting one holding a tab, and leaving commas alone", () => {
    const text = exportText("tsv", [name, name], [row("a,b\tc")]);
    expect(text).toBe(`${byteOrderMark}Name\tName\r\n"a,b\tc"\t"a,b\tc"\r\n`);
  });

  it.each([
    ["=SUM(A1)", "'=SUM(A1)"],
    ["+44 20 7946 0000", "'+44 20 7946 0000"],
    ["-dash", "'-dash"],
    ["@cmd", "'@cmd"],
    ["\tindented", "'\tindented"],
  ])("keeps %j, which a spreadsheet would run, as text", (value, kept) => {
    expect(exportText("tsv", [name], [row(value)])).toBe(
      `${byteOrderMark}Name\r\n${value.includes("\t") ? `"${kept}"` : kept}\r\n`,
    );
  });

  it("keeps a value starting with a carriage return as text, quoted", () => {
    expect(exportText("csv", [name], [row("\r=1")])).toBe(
      `${byteOrderMark}Name\r\n"'\r=1"\r\n`,
    );
  });

  it("keeps a heading a spreadsheet would run as text", () => {
    const formula = column({ key: "f", label: "=Total", kind: "text" });
    expect(exportText("csv", [formula], [])).toBe(
      `${byteOrderMark}'=Total\r\n`,
    );
  });

  it("leaves a negative number as a number, in any column", () => {
    expect(exportText("csv", [name], [row("-3")])).toBe(
      `${byteOrderMark}Name\r\n-3\r\n`,
    );
  });

  it("quotes a TSV value holding a line break", () => {
    expect(exportText("tsv", [name], [row("First\nSecond")])).toBe(
      `${byteOrderMark}Name\r\n"First\nSecond"\r\n`,
    );
  });

  it("writes headings alone for a table with no rows", () => {
    expect(exportText("tsv", [name], [])).toBe(`${byteOrderMark}Name\r\n`);
  });
});

describe("exportFileName", () => {
  const named = {
    page: "People",
    person: "Engineering Director",
    show: "live",
    day: "2027-03-31",
    format: "csv",
  } as const;

  it("names Fathom, the page, the saved view, who exported it and the day, its parts joined by underscores and their words by hyphens", () => {
    expect(exportFileName({ ...named, view: "Engineers" })).toBe(
      "fathom_people_engineers_engineering-director_2027-03-31.csv",
    );
  });

  it("leaves out the view when no saved view is applied", () => {
    expect(exportFileName({ ...named, format: "tsv" })).toBe(
      "fathom_people_engineering-director_2027-03-31.tsv",
    );
  });

  it.each([
    ["drafts", "drafts"],
    ["both", "drafts-and-live"],
  ] as const)("says what a file showing %s holds", (show, said) => {
    expect(exportFileName({ ...named, show })).toBe(
      `fathom_people_engineering-director_${said}_2027-03-31.csv`,
    );
  });

  it("keeps a name in a script without letter case, joining its words", () => {
    expect(exportFileName({ ...named, person: "西尾 亮" })).toBe(
      "fathom_people_西尾-亮_2027-03-31.csv",
    );
  });

  it("joins words in place of characters no file name may hold", () => {
    expect(exportFileName({ ...named, view: 'Sites: A/B "C" __ D' })).toBe(
      "fathom_people_sites-a-b-c-d_engineering-director_2027-03-31.csv",
    );
  });
});

describe("the question asked before exporting", () => {
  const salary = column({
    key: "salary",
    label: "Salary",
    kind: "number",
    dataClass: "confidential",
  });
  const home = column({
    key: "home",
    label: "Home address",
    kind: "text",
    dataClass: "personal",
  });
  const name = column({ key: "name", label: "Name", kind: "text" });

  it("names the classes, the most sensitive first, and their columns", () => {
    expect(exportQuestion(classifiedColumns([name, home, salary]))).toEqual({
      title: "Export Confidential and Personal data?",
      held: [
        { dataClass: "confidential", columns: ["Salary"] },
        { dataClass: "personal", columns: ["Home address"] },
      ],
    });
  });

  it("names a column by its heading in the file", () => {
    const effort = column({
      label: "Effort",
      kind: "number",
      unit: personDays,
      dataClass: "personal",
    });
    expect(exportQuestion(classifiedColumns([effort]))?.held).toEqual([
      { dataClass: "personal", columns: ["Effort (PD)"] },
    ]);
  });

  it("asks nothing for an export holding only General data", () => {
    expect(exportQuestion(classifiedColumns([name]))).toBeUndefined();
  });
});

describe("recording an export", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  const columns = [
    column({ key: "startDate", label: "Start", kind: "date" }),
    column({
      key: "estimate",
      label: "Effort",
      kind: "number",
      unit: personDays,
    }),
  ];
  const hiringPlan = {
    field: "hiringPlan",
    name: "Hiring plan",
    dataClass: "confidential",
  } as const;
  const file = {
    name: "fathom_people_engineering-director_2027-03-31.csv",
    format: "csv",
    text: "Name",
  } as const;
  const recorded = () => Response.json({ recorded: true });

  // The browser's Save dialog, choosing a place whose writes are kept, or cancelled, or failing.
  function savePicker(
    answer: "chosen" | "cancelled" | "failed" = "chosen",
    onAsk: (options: unknown) => void = () => undefined,
  ) {
    const written: string[] = [];
    const removed = vi.fn(async () => Promise.resolve());
    const picker = vi.fn(async (options: unknown) => {
      onAsk(options);
      if (answer === "cancelled") {
        throw new DOMException("Cancelled", "AbortError");
      }
      if (answer === "failed") throw new Error("No place");
      return Promise.resolve({
        createWritable: async () =>
          Promise.resolve({
            write: async (text: string) => {
              written.push(text);
              return Promise.resolve();
            },
            close: async () => Promise.resolve(),
          }),
        remove: removed,
      });
    });
    vi.stubGlobal("showSaveFilePicker", picker);
    return { picker, written, removed };
  }

  it("tells the server the table, each column's key and each detail the rows hold", () => {
    expect(exportRecordOf("people", columns, [hiringPlan])).toEqual({
      table: "people",
      columns: ["startDate", "estimate"],
      details: ["hiringPlan"],
    });
  });

  it("names the details the rows hold before the columns", () => {
    const start = column({
      label: "Start",
      kind: "date",
      dataClass: "personal",
    });
    expect(classifiedColumns([start], [hiringPlan])).toEqual({
      personal: ["Start"],
      confidential: ["Hiring plan"],
    });
  });

  it("downloads the file once the server has recorded the export, where the browser has no Save dialog", async () => {
    // Given a server that records the export
    const fetched = serverAnswers({ "POST /api/exports": recorded });
    const files = savedFiles();

    // When it is recorded and saved
    await recordedAndSaved("people", columns, [hiringPlan], file);

    // Then the server was told of it, and the browser was handed the file
    expect(bodyOf(fetched, "POST", "/api/exports")).toEqual([
      exportRecordOf("people", columns, [hiringPlan]),
    ]);
    expect(files.map(({ name }) => name)).toEqual([file.name]);
  });

  it("asks where to save first, then records, then writes there, in the browser's Save dialog", async () => {
    const order: string[] = [];
    serverAnswers({
      "POST /api/exports": () => {
        order.push("recorded");
        return recorded();
      },
    });
    const { written } = savePicker("chosen", (options) => {
      order.push("asked");
      expect(options).toEqual({
        suggestedName: file.name,
        types: [{ description: "CSV file", accept: { "text/csv": [".csv"] } }],
      });
    });

    await recordedAndSaved("people", columns, [], file);

    expect(order).toEqual(["asked", "recorded"]);
    expect(written).toEqual(["Name"]);
  });

  it("records and saves nothing when the Save dialog is cancelled", async () => {
    const fetched = serverAnswers({ "POST /api/exports": recorded });
    savePicker("cancelled");
    await recordedAndSaved("people", columns, [], file);
    expect(fetched).not.toHaveBeenCalled();
  });

  it("writes nothing, and removes nothing already there, when the server refuses the export", async () => {
    serverAnswers({
      "POST /api/exports": () =>
        Response.json({ error: "Forbidden" }, { status: 403 }),
    });
    const { written, removed } = savePicker();
    await expect(
      recordedAndSaved("people", columns, [], file),
    ).rejects.toThrow();
    expect(written).toEqual([]);
    expect(removed).not.toHaveBeenCalled();
  });

  it("downloads nothing when the server refuses the export", async () => {
    serverAnswers({
      "POST /api/exports": () =>
        Response.json({ error: "Forbidden" }, { status: 403 }),
    });
    const files = savedFiles();
    await expect(
      recordedAndSaved("people", columns, [], file),
    ).rejects.toThrow();
    expect(files).toEqual([]);
  });

  it("lets go of a downloaded file's text only once the browser has had time to save it", async () => {
    // Given a browser with no Save dialog, and a controlled clock
    vi.useFakeTimers();
    const revoked = vi.fn();
    vi.stubGlobal(
      "URL",
      class extends URL {
        static override createObjectURL = () => "blob:fictional";
        static override revokeObjectURL = revoked;
      },
    );
    vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(
      () => undefined,
    );

    // When the file is saved
    await saveFile(file);

    // Then its text is kept a while, then let go of
    expect(revoked).not.toHaveBeenCalled();
    vi.runAllTimers();
    expect(revoked).toHaveBeenCalledWith("blob:fictional");
    vi.useRealTimers();
  });

  it("saves nothing for a table the server can't record an export of", async () => {
    const files = savedFiles();
    await expect(
      recordedAndSaved(undefined, columns, [], file),
    ).rejects.toThrow(unrecordedExport);
    expect(files).toEqual([]);
  });

  it("saves a file there is nothing to record in the Save dialog's place", async () => {
    const { written } = savePicker();
    await saveFile({ ...file, format: "tsv" });
    expect(written).toEqual(["Name"]);
  });

  it("saves nothing when the Save dialog is cancelled for a file with nothing to record", async () => {
    const { written } = savePicker("cancelled");
    await saveFile(file);
    expect(written).toEqual([]);
  });

  it("fails when the Save dialog fails for another reason", async () => {
    savePicker("failed");
    await expect(saveFile(file)).rejects.toThrow("No place");
  });
});

describe("the rows a view shows, as a file holds them", () => {
  interface Drafted {
    id: string;
    name: string;
    draft?: GridDraft;
  }
  const draft = (more: Partial<GridDraft> = {}): GridDraft => ({
    action: "changed",
    state: "waiting",
    changed: ["name"],
    madeBy: null,
    ...more,
  });
  const nameColumn = (label: string): ExportColumn<Drafted> => ({
    key: "name",
    label,
    kind: "text",
    choices: [],
    multiple: false,
    value: (record) => record.name,
  });
  const drafted: Drafted[] = [
    { id: "a", name: "Fictional Unchanged" },
    { id: "b", name: "Fictional Renamed", draft: draft() },
    { id: "c", name: "Fictional New", draft: draft({ action: "created" }) },
    {
      id: "d",
      name: "Fictional Kept",
      draft: draft({ state: "rejected" }),
    },
    {
      id: "e",
      name: "Fictional Mine",
      draft: draft({ unpublished: true }),
    },
  ];
  const live: Drafted[] = [
    { id: "a", name: "Fictional Unchanged" },
    { id: "b", name: "Fictional Before" },
    { id: "d", name: "Fictional Kept" },
    { id: "e", name: "Fictional Mine before" },
  ];
  const named = nameColumn("Name");
  const liveNamed = {
    ...named,
    value: (record: Drafted) => `${record.name} (live)`,
  };
  const asFile = (
    show: "both" | "drafts" | "live",
    shown: readonly Drafted[],
  ) => {
    const exported = shownForExport(
      show,
      shown,
      live,
      drafted,
      [named],
      () => liveNamed,
    );
    return exported.rows.map((one) =>
      exported.columns.map((column) => exportValue(column, one)),
    );
  };

  it("holds each draft row then its Live row beside live, saying what each draft does", () => {
    expect(asFile("both", drafted)).toEqual([
      ["", "", "Fictional Unchanged"],
      ["Yes", "Changed", "Fictional Renamed"],
      ["", "", "Fictional Before (live)"],
      ["Yes", "Added", "Fictional New"],
      ["Yes", "Changed, rejected", "Fictional Kept"],
      ["", "", "Fictional Kept (live)"],
      ["Yes", "Changed, not published", "Fictional Mine"],
      ["", "", "Fictional Mine before (live)"],
    ]);
  });

  it("holds the draft rows alone with the drafts applied", () => {
    expect(asFile("drafts", drafted.slice(0, 3))).toEqual([
      ["", "", "Fictional Unchanged"],
      ["Yes", "Changed", "Fictional Renamed"],
      ["Yes", "Added", "Fictional New"],
    ]);
  });

  it("holds the live rows alone, live only, with what a waiting draft would change, as the green dot says", () => {
    expect(asFile("live", live)).toEqual([
      ["", "", "Fictional Unchanged (live)"],
      ["", "A change is waiting for approval.", "Fictional Before (live)"],
      ["", "", "Fictional Kept (live)"],
      ["", "A change isn't published yet.", "Fictional Mine before (live)"],
    ]);
  });

  it("reads what stands in for an empty value through the row's own form", () => {
    const standIn = {
      ...named,
      value: () => "",
      standIn: (record: Drafted) => `${record.name} stand-in`,
    };
    const liveStandIn = {
      ...standIn,
      standIn: (record: Drafted) => `${record.name} live stand-in`,
    };
    const exported = shownForExport(
      "both",
      [drafted[1] as Drafted],
      live,
      drafted,
      [standIn],
      () => liveStandIn,
    );
    expect(
      exported.rows.map((one) =>
        exportValue(exported.columns[2] as never, one),
      ),
    ).toEqual(["Fictional Renamed stand-in", "Fictional Before live stand-in"]);
  });

  it("names a choice on a Live row as it is live, though a draft renames it", () => {
    const site = (label: string): ExportColumn<Drafted> => ({
      ...named,
      kind: "choice",
      choices: [choice("c1", label)],
      value: () => ["c1"],
    });
    const exported = shownForExport(
      "both",
      [drafted[1] as Drafted],
      live,
      drafted,
      [site("Fictional Quay")],
      () => site("Fictional Harbour"),
    );
    expect(
      exported.rows.map((one) =>
        exportValue(exported.columns[2] as never, one),
      ),
    ).toEqual(["Fictional Quay", "Fictional Harbour"]);
  });

  it("gives a removed record's draft row alone, as on screen", () => {
    const removed: Drafted = {
      id: "b",
      name: "Fictional Leaving",
      draft: draft({ action: "deleted" }),
    };
    expect(asFile("both", [removed])).toEqual([
      ["Yes", "Removed", "Fictional Leaving"],
    ]);
  });
});

describe("appliedViewName", () => {
  const views = [{ id: "v1", name: "Fictional Engineers" }] as never;

  it("names the saved view applied", () => {
    expect(appliedViewName({ views, applied: "v1" })).toBe(
      "Fictional Engineers",
    );
  });

  it("names nothing with no saved view applied, or none offered", () => {
    expect(appliedViewName({ views, applied: undefined })).toBeUndefined();
    expect(appliedViewName(undefined)).toBeUndefined();
  });
});

describe("draftInFile", () => {
  it.each([
    [undefined, ""],
    [{ action: "deleted", state: "waiting" }, "Removed"],
    [{ action: "changed", state: "waiting", moved: true }, "Moved"],
  ] as const)("says what a draft does", (draft, words) => {
    expect(draftInFile(draft)).toBe(words);
  });
});
