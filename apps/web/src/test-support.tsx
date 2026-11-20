// SPDX-License-Identifier: Apache-2.0

// Helpers for the front-end tests: a simulated server and the changes sent to it, a fictional
// signed-in user, fictional records, gadgets for the shared table's own tests, and Fathom's front
// end started on a page of the test's choosing.

import type {
  Choice,
  DraftKind,
  Feature,
  FeatureDraft,
  Cycle,
  CyclePattern,
  Field,
  List,
  RecordDraft,
  Release,
  ReleaseStream,
  TeamMonths,
} from "@fathom/shared";
import {
  defaultClasses,
  defaultPasswordSettings,
  monthsBetween,
} from "@fathom/shared";
import { MantineProvider, mergeThemeOverrides } from "@mantine/core";
import type { DraftLike } from "./draft-marks.ts";
import { QueryClient } from "@tanstack/react-query";
import { createMemoryHistory } from "@tanstack/react-router";
import {
  type RenderResult,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import { userEvent } from "@testing-library/user-event";
import { expect, vi } from "vitest";
import { App } from "./app.tsx";
import { noDrafts } from "./drafts.ts";
import { cellColumn, inOrder } from "./grid-columns.tsx";
import { recordCellSelector } from "./grid-row.tsx";
import { lastViewsPath } from "./last-views.ts";
import { liveRecordsOf } from "./live-records.ts";
import type { TableChoices } from "./projects.ts";
import { RecordGrid } from "./record-grid.tsx";
import type {
  CellRecord,
  Column,
  RecordActions,
  RecordTable,
} from "./record-table.ts";
import { type View, emptyView } from "./table-view.ts";
import { theme } from "./theme.ts";

type Answer = Response | Promise<Response>;

// Simulates the server: each request is answered by the first matching answer, and recorded.
export function serverAnswers(answers: Record<string, () => Answer>) {
  const byRequest = new Map(Object.entries(answers));
  const fetch = vi.fn((url: string, init?: RequestInit) => {
    const key = `${init?.method ?? "GET"} ${url}`;
    const answer = byRequest.get(key);
    if (answer === undefined) throw new Error(`No answer for ${key}`);
    return Promise.resolve(answer());
  });
  vi.stubGlobal("fetch", fetch);
  return fetch;
}

// The bodies of the requests sent with a method to an address, in order.
export function bodyOf(
  fetch: ReturnType<typeof serverAnswers>,
  method: string,
  url: string,
): unknown[] {
  return fetch.mock.calls
    .filter(([called, init]) => called === url && init?.method === method)
    .map(([, init]) => JSON.parse(init?.body as string) as unknown);
}

// The view a page with saved views keeps, which it sends on its own a second after its view
// settles, so it can land in any test that runs past that.
const lastViewSaves = `${lastViewsPath}/`;

// The changes a page sent, as each one's address and body, in order: those with the method given,
// or every one but a read, leaving out the view the page keeps.
export function changesSent(
  fetch: ReturnType<typeof serverAnswers>,
  method?: string,
): [string, unknown][] {
  return fetch.mock.calls.flatMap(([url, init]): [string, unknown][] => {
    const sentWith = init?.method;
    if (
      sentWith === undefined ||
      sentWith === "GET" ||
      (method !== undefined && sentWith !== method) ||
      (sentWith === "PUT" && url.startsWith(lastViewSaves))
    )
      return [];
    const body = init?.body;
    return [
      [
        url,
        body === undefined || body === null
          ? undefined
          : (JSON.parse(body as string) as unknown),
      ],
    ];
  });
}

// A draft waiting for approval, and one rejected with a reason, for tests of draft marks.
export const waitingDraft: DraftLike = { action: "changed", state: "waiting" };
export const rejectedDraft: DraftLike = {
  action: "changed",
  state: "rejected",
  reason: "Fictional reason.",
};

export const fictionalUser = {
  user: {
    id: "10000000-0000-4000-8000-000000000001",
    keyNumber: 1,
    name: "Fictional Person",
    email: "person@example.test",
  },
  role: {
    id: "00000000-0000-4000-8000-0000000000a1",
    key: "team-member",
    name: "Team Member",
    description: "Sees the plan, including everyone's work assignments.",
  },
  roles: [{ id: "00000000-0000-4000-8000-0000000000a1", name: "Team Member" }],
  defaultRoleId: "00000000-0000-4000-8000-0000000000a1",
  permissions: ["plan:view", "features:view"],
  mustChangePassword: false,
  settings: {
    timeZone: "America/Vancouver",
    passwords: defaultPasswordSettings,
    dataClasses: defaultClasses,
  },
};
export const signedIn = () => Response.json(fictionalUser);
export const signedOut = () =>
  Response.json({ error: "Unauthorized" }, { status: 401 });
export const greeting = () => Response.json({ greeting: "Hello, Fathom" });

// A list's choice, named by its ID.
export const fictionalChoice = (id: string): Choice => ({
  id,
  label: `Fictional ${id}`,
  description: "",
  retired: false,
});

export function renderApp(path: string) {
  // Failed requests are not retried, so each test sees the server's first answer.
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  const history = createMemoryHistory({ initialEntries: [path] });
  render(<App queryClient={queryClient} history={history} theme={testTheme} />);
  return history;
}

// Makes every matchMedia query match, which the components' narrow-screen checks read; the
// simulated browser's own styles still see a window 1024 pixels wide.
export function onNarrowScreen() {
  vi.stubGlobal(
    "matchMedia",
    (query: string) =>
      ({
        matches: true,
        media: query,
        addEventListener: () => undefined,
        removeEventListener: () => undefined,
      }) as unknown as MediaQueryList,
  );
}

// Mantine's hiddenFrom rule hides this button at the simulated browser's fixed 1024 pixels, and a
// hidden element has no accessible name, so it is found by its label; no test can tell whether a
// narrow screen shows it.
export const sectionsButton = () => screen.findByLabelText("Show sections");

// The choices in an open menu under a group's label, such as Group by's.
export const choicesUnder = async (group: string) =>
  within(await screen.findByRole("group", { name: group }));

export const choiceUnder = async (group: string, choice: string) =>
  (await choicesUnder(group)).getByRole("menuitem", { name: choice });

// A record's cell in a column of the shared table, in the record's first row.
export const recordCell = (id: string, columnKey: string) =>
  document.querySelector<HTMLElement>(recordCellSelector(id, columnKey)) ??
  undefined;

// The simulated browser has no layout, so everything seems off screen, and a tooltip or menu would
// hide itself once placed, sometimes before the test looked.
export const testTheme = mergeThemeOverrides(theme, {
  components: {
    Tooltip: { defaultProps: { hideDetached: false } },
    Popover: { defaultProps: { hideDetached: false } },
  },
});

// A row of a details panel, by its label, within the panel given or the whole page.
export const detailRow = (
  label: string,
  container: HTMLElement = document.body,
): HTMLElement =>
  within(container).getByText(label, { selector: "dt" })
    .parentElement as HTMLElement;

// What a row of a details panel reads, by its label: its value, and any marks and live value under
// it.
export const detailValue = (
  label: string,
  container: HTMLElement = document.body,
): string =>
  (detailRow(label, container).querySelector("dd") as HTMLElement).textContent;

export const wholeText =
  (expected: string | RegExp) =>
  (_content: string, element: Element | null): boolean => {
    const matches = (found: Element) =>
      typeof expected === "string"
        ? found.textContent === expected
        : expected.test(found.textContent);
    return (
      element !== null &&
      matches(element) &&
      ![...element.children].some((child) => matches(child))
    );
  };

// A fictional release stream, cycle pattern, release, and draft of one of them, with ids as the
// server gives them, for each test to override what it needs.
export const streamId = "10000000-0000-4000-8000-000000000001";

export const recordDraft = (
  fields: Partial<RecordDraft> = {},
): RecordDraft => ({
  action: "changed",
  changed: [],
  live: {},
  uses: [],
  state: "waiting",
  madeBy: "Fictional Editor",
  madeAt: "2026-10-30T15:00:00.000Z",
  ...fields,
});

export const noFeatureColumns = { fields: [], order: [], lists: [] };

// A draft of a feature, whose added columns' live values are held by type.
export const featureDraft = ({
  live = {},
  ...fields
}: Omit<Partial<RecordDraft>, "live"> & {
  live?: Record<string, unknown>;
} = {}): FeatureDraft => ({
  ...recordDraft(fields),
  live: { values: {}, links: {}, notes: {}, numbers: {}, ...live },
});

export const fictionalPattern = (
  fields: Partial<CyclePattern> = {},
): CyclePattern => ({
  id: "20000000-0000-4000-8000-000000000001",
  startsOn: "2027-01-01",
  length: 3,
  unit: "months",
  naming: "{YY}.{N}",
  ...fields,
});

export const fictionalRelease = (fields: Partial<Release> = {}): Release => ({
  id: "30000000-0000-4000-8000-000000000001",
  keyNumber: 1,
  name: "Fictional One",
  firstCycle: "2027-01-01",
  lastCycle: "2027-01-01",
  shipsOn: null,
  colour: null,
  note: null,
  ...fields,
});

// Cycles of three months from 2027-01-01, named 27.1 to 27.4 and so on.
export const quarters = (count: number): Cycle[] =>
  Array.from({ length: count }, (_, at) => {
    const year = 2027 + Math.floor(at / 4);
    const quarter = at % 4;
    const month = (offset: number) =>
      `${String(year)}-${String(quarter * 3 + offset + 1).padStart(2, "0")}`;
    // Day 0 of the month after the quarter is the quarter's last day.
    const endsOn = new Date(Date.UTC(year, quarter * 3 + 3, 0))
      .toISOString()
      .slice(0, 10);
    return {
      startsOn: `${month(0)}-01`,
      endsOn,
      name: `${String(year).slice(2)}.${String(quarter + 1)}`,
      months: [0, 1, 2].map((offset) => ({ month: month(offset), share: 1 })),
    };
  });

export const fictionalStream = (
  fields: Partial<ReleaseStream> = {},
): ReleaseStream => ({
  id: streamId,
  keyNumber: 1,
  name: "Fictional Majors",
  retired: false,
  cyclesUntil: "2027-12-31",
  endsOn: null,
  patterns: [fictionalPattern()],
  cycles: quarters(4),
  releases: [],
  ...fields,
});

export const fictionalFeature = (fields: Partial<Feature> = {}): Feature => ({
  id: "60000000-0000-4000-8000-000000000001",
  keyNumber: 1,
  name: "Fictional Feature",
  statusId: "50000000-0000-4000-8000-000000000001",
  priorityId: null,
  sizeId: null,
  riskId: null,
  neededBy: null,
  customerIds: [],
  targetStreamId: null,
  targetCycle: null,
  estimateHours: null,
  featureTeamId: null,
  description: null,
  note: null,
  values: {},
  links: {},
  staffed: false,
  staffedLive: false,
  ...fields,
});

export const choices = (more: Partial<TableChoices> = {}): TableChoices => ({
  people: [],
  customers: [],
  proposals: [],
  projects: [],
  features: [],
  statuses: [],
  featureStatuses: [
    { ...cycleChoice("possible-first", "Long shot"), meaning: "possible" },
    { ...cycleChoice("planned", "Planned"), meaning: "planned" },
  ],
  featureTeams: [],
  priorities: [],
  sizes: [],
  risks: [],
  cycles: [],
  releaseOfCycle: new Map(),
  featureColumns: noFeatureColumns,
  ...more,
});

export const feature = (more: Partial<Feature> = {}): Feature =>
  fictionalFeature({
    id: "f1",
    statusId: "planned",
    featureTeamId: "t1",
    ...more,
  });

export const cycleChoice = (id: string, label: string) => ({
  id,
  label,
  description: "",
  retired: false,
});

// The server's answer giving the plan's features.
export const planAnswers = (features: readonly Feature[]) => ({
  "GET /api/projects": () =>
    Response.json({
      customers: [],
      projects: [],
      proposals: [],
      features,
      featureColumns: noFeatureColumns,
      canEdit: false,
      canEditFeatures: false,
    }),
});

// The tab and the record a link on the Releases page opened, from the page's address.
export function openedIn(history: { location: { search: string } }) {
  const search = new URLSearchParams(history.location.search);
  return { tab: search.get("tab"), open: search.get("open") };
}

// Where a link to Features went: its page, the filters in its address, and the Board's place, if
// any.
export function featuresAddress(history: {
  location: { pathname: string; search: string };
}) {
  const search = new URLSearchParams(history.location.search);
  return {
    page: history.location.pathname,
    filters: JSON.parse(search.get("filters") ?? "null") as unknown,
    board: Object.fromEntries(
      ["mode", "stream", "from"].flatMap((key) => {
        const value = search.get(key);
        return value === null ? [] : [[key, value]];
      }),
    ),
  };
}

// Catches each file the browser is handed to save, by name, with its text, in place of the
// browser's download. The page needs no Save dialog of the browser's own, as jsdom offers none.
export function savedFiles(): { name: string; text: () => Promise<string> }[] {
  const blobs = new Map<string, Blob>();
  const files: { name: string; text: () => Promise<string> }[] = [];
  vi.stubGlobal(
    "URL",
    class extends URL {
      static override createObjectURL = (blob: Blob) => {
        const url = `blob:fictional-${String(blobs.size)}`;
        blobs.set(url, blob);
        return url;
      };
      static override revokeObjectURL = () => undefined;
    },
  );
  vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(function (
    this: HTMLAnchorElement,
  ) {
    const blob = blobs.get(this.href);
    if (blob !== undefined) {
      files.push({ name: this.download, text: async () => blob.text() });
    }
  });
  return files;
}

// The day the month grids' tests are run on, and the months the grids read around it.
export const gridNow = "2027-03-10";
export const monthsUrl =
  "GET /api/feature-teams/months?from=2026-01&to=2028-03";

export const mobile = {
  id: "t-mobile",
  name: "Mobile apps",
  colour: "teal" as const,
};
const payments = {
  id: "t-payments",
  name: "Payments core",
  colour: "grape" as const,
};
export const platform = {
  id: "t-platform",
  name: "Platform reliability",
  colour: null,
};

// Three fictional people and their feature teams, month by month.
export const fictionalTeamMonths: TeamMonths = {
  months: monthsBetween("2026-03", "2028-02"),
  teams: [payments, platform, mobile],
  drafts: [],
  people: [
    {
      id: "p-casey",
      preferredName: "Casey Fictional",
      manager: { id: "p-blair", name: "Blair Fictional" },
      managers: {},
      teams: { "2027-03": [platform.id] },
    },
    {
      id: "p-avery",
      preferredName: "Avery Fictional",
      manager: { id: "p-blair", name: "Blair Fictional" },
      managers: {},
      teams: { "2027-03": [payments.id, mobile.id] },
      outside: ["2026-03"],
    },
    {
      id: "p-blair",
      preferredName: "Blair Fictional",
      manager: null,
      managers: {},
      teams: {},
    },
  ],
};

// The ⋯ at the end of a record's row, apart from the one over its Name cell, which has its name.
const atRowsEnd = (buttons: HTMLElement[], name: string) => {
  const found = buttons.find((button) => button.closest("td[id]") === null);
  if (found === undefined) throw new Error(`No ⋯ at the end of ${name}'s row`);
  return found;
};

export const rowActions = (name: string) =>
  atRowsEnd(
    screen.getAllByRole("button", { name: `Actions for ${name}` }),
    name,
  );

export const findRowActions = async (name: string) =>
  atRowsEnd(
    await screen.findAllByRole("button", { name: `Actions for ${name}` }),
    name,
  );

// Opens a drop-down list, named by its label, within what holds it, and gives its options' words.
export async function optionsIn(holder: HTMLElement, label: string) {
  await userEvent.click(within(holder).getByLabelText(label));
  return (await screen.findAllByRole("option")).map(
    ({ textContent }) => textContent,
  );
}

// Chooses an option, by its words, in a drop-down list named by its label, within what holds it;
// choosing the one already chosen empties a list that may be empty.
export async function chooseIn(
  holder: HTMLElement,
  label: string,
  option: string,
) {
  await userEvent.click(within(holder).getByLabelText(label));
  await userEvent.click(await screen.findByRole("option", { name: option }));
}

const undoRequests = (fetch: ReturnType<typeof serverAnswers>) =>
  fetch.mock.calls.filter(
    ([url, init]) => url.startsWith("/api/undo/") && init?.method === "POST",
  ).length;

// Undoes the latest change with Cmd+Z. A change becomes undoable only once it has finished saving,
// which nothing on screen shows, so the keys are pressed until the page asks the server to undo.
export async function undoWithKeys(fetch: ReturnType<typeof serverAnswers>) {
  const before = undoRequests(fetch);
  await waitFor(async () => {
    await userEvent.keyboard("{Meta>}z{/Meta}");
    expect(undoRequests(fetch)).toBeGreaterThan(before);
  });
}

// The tooltip shown while the pointer is over an element, read once it opens and closed again.
export async function tipOn(element: HTMLElement): Promise<string | null> {
  await userEvent.hover(element);
  const tip = (await screen.findByRole("tooltip")).textContent;
  await userEvent.unhover(element);
  await waitFor(() => {
    expect(screen.queryByRole("tooltip")).toBeNull();
  });
  return tip;
}

// A made-up kind of record, gadgets, for the shared table's own tests.
export interface Gadget extends CellRecord {
  name: string;
  code: string;
}

// A type, not an interface, as the server's changes are, so it holds any detail by its key.
export type GadgetChange = {
  name?: string;
  code?: string;
  values?: Record<string, string[]> | undefined;
};

export const colour: Field = {
  id: "f1",
  keyNumber: 1,
  name: "Colour",
  type: "choice" as const,
  listId: "l1",
  visibility: null,
  multiple: false,
  required: false,
  onPlannedHires: true,
};
export const colours: List = {
  id: "l1",
  keyNumber: 1,
  name: "Colours",
  description: "",
  visibility: "general",
  retired: false,
  choices: [{ id: "c1", label: "Teal", description: "", retired: false }],
};

export const gadgetColumns = (
  fields: readonly Field[],
  lists: readonly List[],
  order: readonly string[],
): Column<Gadget, GadgetChange>[] =>
  inOrder(
    [
      cellColumn<Gadget, GadgetChange>("name", "text", {
        label: "Name",
        required: true,
        choices: [],
        multiple: false,
        maxLength: 10,
      }),
      cellColumn<Gadget, GadgetChange>("code", "text", {
        label: "Code",
        required: false,
        choices: [],
        multiple: false,
      }),
      ...fields.map((field) =>
        cellColumn<Gadget, GadgetChange>(field.id, field.type, {
          label: field.name,
          required: field.required,
          field,
          choices: lists.find(({ id }) => id === field.listId)?.choices ?? [],
          multiple: field.multiple,
        }),
      ),
    ],
    order,
  );

export const liveGadgets = (gadgets: readonly Gadget[]) =>
  liveRecordsOf(gadgets, ["name", "code"]);

export const waiting = {
  state: "waiting" as const,
  madeBy: "Fictional Maker",
  changed: [] as string[],
  live: { values: {}, links: {} },
};

export const gadget = (id: string, more: Partial<Gadget> = {}): Gadget => ({
  id,
  name: `Gadget ${id}`,
  code: id.toUpperCase(),
  values: {},
  links: {},
  ...more,
});

export const noop = () => undefined;

export function gadgetTable(
  recordProblem: RecordTable<
    Gadget,
    GadgetChange,
    GadgetChange
  >["recordProblem"] = noop,
): RecordTable<Gadget, GadgetChange, GadgetChange> {
  return {
    label: "Gadgets",
    one: "gadget",
    noun: "gadgets",
    newRowLabel: () => "New gadget",
    removeLabel: () => "Remove gadget",
    nameOf: (one) => one.name,
    nameColumn: "name",
    columnsFor: gadgetColumns,
    liveRecords: liveGadgets,
    draftFields: () => [],
    recordProblem,
    request: (changes) => Object.assign({}, ...changes) as GadgetChange,
    drafts: (ids) => ({ ...noDrafts(), lists: ids }),
  };
}

export const actions = (
  more: Partial<RecordActions<Gadget, GadgetChange, GadgetChange>> = {},
): RecordActions<Gadget, GadgetChange, GadgetChange> => ({
  add: noop,
  update: noop,
  remove: noop,
  discard: noop,
  resubmit: noop,
  decide: noop,
  editColumn: noop,
  discardColumn: noop,
  resubmitColumn: noop,
  ...more,
});

export function renderGadgets({
  gadgets,
  table = gadgetTable(),
  given = actions(),
  view = emptyView,
  onView = noop,
  approves = [],
  canEditColumns = false,
  fields = [colour],
  order = [],
}: {
  gadgets: Gadget[];
  fields?: Field[];
  table?: RecordTable<Gadget, GadgetChange, GadgetChange>;
  given?: RecordActions<Gadget, GadgetChange, GadgetChange>;
  view?: View;
  onView?: (view: View) => void;
  approves?: readonly DraftKind[];
  canEditColumns?: boolean;
  order?: string[];
}): RenderResult {
  return render(
    <MantineProvider theme={testTheme}>
      <RecordGrid
        records={gadgets}
        table={table}
        fields={fields}
        order={order}
        lists={[colours]}
        canEdit
        approves={approves}
        canEditColumns={canEditColumns}
        view={view}
        onView={onView}
        actions={given}
      />
    </MantineProvider>,
  );
}

export const nameThen = (next: Column<Gadget, GadgetChange>) => ({
  ...gadgetTable(),
  columnsFor: () => [...gadgetColumns([], [], []).slice(0, 1), next],
});
export const nextColumn = (kind: "date" | "flag" | "text") =>
  cellColumn<Gadget, GadgetChange>("next", kind, {
    label: "Next",
    required: false,
    choices: [],
    multiple: false,
  });

// A waiting draft with no maker, the base of the drafts in the tests of deciding drafts.
export const draftToDecide = {
  state: "waiting" as const,
  madeBy: null,
  madeAt: null,
};

export const addedChoice = (id: string): Choice => ({
  id,
  label: id.toUpperCase(),
  description: "",
  retired: false,
  draft: { ...draftToDecide, action: "created", changed: [], live: {} },
});

export const liveChoice = (id: string): Choice => ({
  id,
  label: id.toUpperCase(),
  description: "",
  retired: false,
});

// A list drafted to be added, whose order places one choice drafted to be added before a live one,
// and leaves another at the end, where it would go anyway.
export const teamsList: List = {
  id: "l1",
  keyNumber: 1,
  name: "Teams",
  description: "",
  visibility: "general",
  retired: false,
  choices: [addedChoice("b"), liveChoice("a"), addedChoice("c")],
  draft: { ...draftToDecide, action: "created", changed: [], live: {} },
  orderDraft: { ...draftToDecide, live: ["a"], uses: ["b"] },
};

// A live list whose order puts a choice drafted to be added first.
export const sitesList: List = {
  id: "l2",
  keyNumber: 1,
  name: "Sites",
  description: "",
  visibility: "general",
  retired: false,
  choices: [addedChoice("f"), liveChoice("d"), addedChoice("e")],
  orderDraft: { ...draftToDecide, live: ["d"], uses: ["f"] },
};

export const bothLists = [teamsList, sitesList];
