// SPDX-License-Identifier: Apache-2.0

// The org chart's people, through the server's API, and the tree they make: each person under their
// manager, reports by name, and those with no manager at the top. Collapsing a manager hides
// everyone below them. The people shown are laid out top to bottom, with reports who manage nobody
// stacked in a column under their manager, so a large organization grows down rather than across.
// Planned hires are drawn as placeholders under their managers, after the people there, and a
// planned manager heads its planned team.
// Each team is drawn in its colour, which reaches down to the teams below that have none. The
// Draft menu chooses whether drafts of managers and team names are drawn beside the live chart, the
// chart is drawn as drafts make it, or drafts are left out.

import {
  type OrgChart,
  type OrgChartDraft,
  type OrgChartPerson,
  orgChartSchema,
  type PaletteColour,
  type Show,
} from "@fathom/shared";
import { queryOptions } from "@tanstack/react-query";
import { getJson, sendJson } from "./api.ts";

export const orgChartQuery = queryOptions({
  queryKey: ["org-chart"],
  queryFn: () => getJson("/api/org-chart", orgChartSchema),
});

// Fitting a small chart to the screen never enlarges its cards past their own size.
export const fitOptions = { maxZoom: 1 };

export const findFieldId = "org-chart-find";

export const cardWidth = 240;
export const cardHeight = 104;
// A card whose team's name is drafted shows the live name, if any, under the drafted one.
const renamedHeight = cardHeight + 18;

// A person as the chart draws them, for the Draft menu's choice: with drafts beside live, a person
// drafted to another manager is drawn there, marked, with a copy of them, marked Live, under the
// manager they report to now, and a drafted team name is drawn with the live one under it.
export interface ChartPerson extends OrgChartPerson {
  // On the copy under the live manager: the person it is a copy of. A copy has no Employee ID, so
  // it opens nothing, and leads no team.
  liveCopyOf?: string;
  // The draft moving the person to the manager they are drawn under.
  moved?: OrgChartDraft;
  // The team's live name, with the draft naming it otherwise.
  renamed?: { live: string | null; draft: OrgChartDraft };
  // The team's approved name, which only a team with one can be coloured by, as the chart shows the
  // drafted one.
  approvedTeamName?: string | null;
}

// The people as the Draft menu's choice draws them: the approved chart, with each person's draft,
// which it draws nowhere else, aside; the chart as drafts make it, as the server applies them; or
// the approved chart with drafts of managers and team names beside, rejected ones included,
// marked.
export function chartPeople(chart: OrgChart, show: Show): ChartPerson[] {
  if (show === "live") return [...chart.people];
  if (show === "drafts") {
    const live = new Map(chart.people.map((person) => [person.id, person]));
    return chart.drafted.map((person) => ({
      ...person,
      approvedTeamName: live.get(person.id)?.teamName ?? null,
    }));
  }
  return chart.people.flatMap((person): ChartPerson[] => {
    const { draft } = person;
    const shown: ChartPerson = { ...person, approvedTeamName: person.teamName };
    if (draft === undefined) return [shown];
    if (draft.teamName !== undefined) {
      shown.teamName = draft.teamName;
      shown.renamed = { live: person.teamName, draft };
    }
    if (draft.managerId === undefined) return [shown];
    shown.managerId = draft.managerId;
    shown.moved = draft;
    return [
      shown,
      {
        ...person,
        id: `${person.id} live`,
        employeeId: null,
        teamName: null,
        teamColour: null,
        liveCopyOf: person.id,
      },
    ];
  });
}

// A draft on the chart changes someone, so it is marked as a change.
export const changeOf = (draft: OrgChartDraft) => ({
  action: "changed" as const,
  ...draft,
});

export const heightOf = (person: ChartPerson | undefined): number =>
  person?.renamed === undefined || person.renamed.live === null
    ? cardHeight
    : renamedHeight;

// A team can be coloured only once it has an approved name, whatever its draft names it.
export const hasApprovedName = (person: ChartPerson): boolean =>
  typeof person.approvedTeamName === "string";

const byName = new Intl.Collator(undefined, { sensitivity: "base" });

export interface OrgTree {
  people: ReadonlyMap<string, ChartPerson>;
  roots: readonly string[];
  // Each manager's direct reports, by name.
  reports: ReadonlyMap<string, readonly string[]>;
}

// People come before planned hires among a manager's reports.
const plannedLast = (person: ChartPerson) =>
  person.planned === undefined ? 0 : 1;

export function treeOf(people: readonly ChartPerson[]): OrgTree {
  const sorted = [...people].sort(
    (a, b) =>
      plannedLast(a) - plannedLast(b) ||
      byName.compare(a.preferredName, b.preferredName) ||
      a.id.localeCompare(b.id),
  );
  const byId = new Map(sorted.map((person) => [person.id, person]));
  const reports = new Map<string, string[]>();
  const roots: string[] = [];
  for (const person of sorted) {
    const { managerId } = person;
    if (managerId === null || !byId.has(managerId)) roots.push(person.id);
    else reports.set(managerId, [...(reports.get(managerId) ?? []), person.id]);
  }
  // Only those reached from the top are kept, which leaves out a loop of managers, which the rules
  // never let in, so everything else may take the chart to be a tree.
  return subtree({ people: byId, roots, reports }, roots);
}

// The part of a tree from the people given down.
function subtree(tree: OrgTree, roots: readonly string[]): OrgTree {
  const people = new Map<string, ChartPerson>();
  const reports = new Map<string, readonly string[]>();
  const visit = (id: string) => {
    // Only people in the tree are visited: the roots given, and the reports the tree lists.
    people.set(id, tree.people.get(id) as ChartPerson);
    const below = tree.reports.get(id);
    if (below === undefined) return;
    reports.set(id, below);
    below.forEach(visit);
  };
  roots.forEach(visit);
  return { people, roots, reports };
}

// The people above someone, their manager first.
export function managersAbove(tree: OrgTree, id: string): string[] {
  const above: string[] = [];
  let managerId = tree.people.get(id)?.managerId ?? null;
  while (managerId !== null && tree.people.has(managerId)) {
    above.push(managerId);
    managerId = tree.people.get(managerId)?.managerId ?? null;
  }
  return above;
}

// The managers whose reports are hidden when the chart opens, so it starts with the levels given,
// counting the people at the top as the first.
export function collapsedBelow(tree: OrgTree, levels: number): Set<string> {
  const collapsed = new Set<string>();
  const visit = (id: string, level: number) => {
    const reports = tree.reports.get(id) ?? [];
    if (reports.length === 0) return;
    if (level >= levels) collapsed.add(id);
    for (const report of reports) visit(report, level + 1);
  };
  for (const root of tree.roots) visit(root, 1);
  return collapsed;
}

export interface Placed {
  id: string;
  // The top left corner of the person's card.
  x: number;
  y: number;
}

// The space between cards side by side, between a manager and the row below, and between cards in
// a stack, which starts this far in from its manager's left edge.
const across = 24;
const down = 56;
const stackGap = 12;
export const stackIndent = 24;

export interface Line {
  from: string;
  to: string;
  // Whether the line runs down the manager's left to a report in a stack, not to a row below.
  stacked: boolean;
}

interface Block {
  width: number;
  height: number;
  // Each card's top left corner, and the lines, within the block.
  cards: Placed[];
  lines: Line[];
}

const moved = (cards: Placed[], dx: number, dy: number): Placed[] =>
  cards.map(({ id, x, y }) => ({ id, x: x + dx, y: y + dy }));

// Blocks side by side, their tops level, from the left edge given.
function sideBySide(blocks: Block[], top: number) {
  const cards: Placed[] = [];
  const lines: Line[] = [];
  let x = 0;
  for (const block of blocks) {
    cards.push(...moved(block.cards, x, top));
    lines.push(...block.lines);
    x += block.width + across;
  }
  return {
    width: x - across,
    height: top + Math.max(...blocks.map((block) => block.height)),
    cards,
    lines,
  };
}

function blockOf(
  tree: OrgTree,
  collapsed: ReadonlySet<string>,
  id: string,
): Block {
  const reports = collapsed.has(id) ? [] : (tree.reports.get(id) ?? []);
  const height = (one: string) => heightOf(tree.people.get(one));
  if (reports.length === 0) {
    return {
      width: cardWidth,
      height: height(id),
      cards: [{ id, x: 0, y: 0 }],
      lines: [],
    };
  }
  const stacked = reports.filter((report) => !tree.reports.has(report));
  const managers = reports.filter((report) => tree.reports.has(report));
  // Reports who manage nobody are stacked in a column under the manager's left edge, and the
  // managers among them are side by side to its right, below a gap for the lines to cross.
  const top = height(id) + (managers.length === 0 ? stackGap : down);
  // Each stacked card under the one above it, and where the stack ends.
  const stack: Placed[] = [];
  let stackEnd = top;
  for (const report of stacked) {
    stack.push({ id: report, x: stackIndent, y: stackEnd });
    stackEnd += height(report) + stackGap;
  }
  const column = stacked.length === 0 ? 0 : stackIndent + cardWidth + across;
  const row =
    managers.length === 0
      ? { width: 0, height: 0, cards: [], lines: [] }
      : sideBySide(
          managers.map((manager) => blockOf(tree, collapsed, manager)),
          top,
        );
  return {
    // The gap after the column is only for a row beside it.
    width: column + row.width - (managers.length === 0 ? across : 0),
    height: Math.max(stackEnd - stackGap, row.height),
    cards: [
      // With nobody stacked, the manager is centred over the row of managers.
      { id, x: stacked.length === 0 ? (row.width - cardWidth) / 2 : 0, y: 0 },
      ...stack,
      ...moved(row.cards, column, 0),
    ],
    lines: [
      ...reports.map((report) => ({
        from: id,
        to: report,
        stacked: stacked.includes(report),
      })),
      ...row.lines,
    ],
  };
}

// Where each person shown goes, and the lines from managers to the reports shown, leaving out
// everyone below a collapsed manager.
export function placed(
  tree: OrgTree,
  collapsed: ReadonlySet<string>,
): { cards: Placed[]; lines: Line[] } {
  const { cards, lines } = sideBySide(
    tree.roots.map((root) => blockOf(tree, collapsed, root)),
    0,
  );
  return { cards, lines };
}

// The chart of one manager's team: the manager, at the top, and everyone below them.
export const teamOf = (tree: OrgTree, managerId: string): OrgTree =>
  subtree(tree, [managerId]);

// The colour each manager's reports are drawn in, by manager: their team's own, or, for a team with
// none, the colour their own manager's reports are drawn in, so a colour reaches down until a team
// below has its own. Managers whose reports have no colour are left out.
export function reportColours(tree: OrgTree): Map<string, PaletteColour> {
  const colours = new Map<string, PaletteColour>();
  const visit = (id: string, above: PaletteColour | null) => {
    const colour = tree.people.get(id)?.teamColour ?? above;
    if (colour !== null) colours.set(id, colour);
    for (const report of tree.reports.get(id) ?? []) visit(report, colour);
  };
  for (const root of tree.roots) visit(root, null);
  return colours;
}

// What the finder says when nobody on the chart has the name typed. While one team is shown alone,
// it names those outside the team who have it, so nobody takes them for missing.
export function nothingFound(
  outside: readonly OrgChartPerson[],
  typed: string,
): string {
  const wanted = typed.trim().toLowerCase();
  const names = outside
    .map((person) => person.preferredName)
    .filter((name) => name.toLowerCase().includes(wanted))
    .sort(byName.compare);
  if (names.length === 0) return "Nobody has that name";
  if (names.length > 3) {
    return `${String(names.length)} people with that name are not in this team`;
  }
  const listed = new Intl.ListFormat("en", { type: "conjunction" }).format(
    names,
  );
  return `${listed} ${names.length === 1 ? "is" : "are"} not in this team`;
}

// Sets the colour of a manager's named team, or removes it, at once.
export async function setTeamColour(
  managerId: string,
  colour: PaletteColour | null,
): Promise<void> {
  await sendJson(
    "PUT",
    `/api/org-chart/teams/${encodeURIComponent(managerId)}/colour`,
    { colour },
  );
}

// How many levels the chart has, counting the people at the top as the first.
export function levelsOf(tree: OrgTree): number {
  const below = (id: string): number =>
    1 + Math.max(0, ...(tree.reports.get(id) ?? []).map(below));
  return Math.max(0, ...tree.roots.map(below));
}

// What the reader may change of teams on the chart: their names, as drafts, and their colours.
export interface TeamEdits {
  names: boolean;
  colours: boolean;
}

export const noTeamEdits: TeamEdits = { names: false, colours: false };

// The chart's address: the person found, and the manager whose team alone is shown, each by
// Employee ID, and what the Draft menu shows, drafts beside live unless chosen otherwise.
export interface ChartSearch {
  person?: string | undefined;
  team?: string | undefined;
  show?: Show | undefined;
  // The person whose details are shown beside the chart, by Employee ID.
  open?: string | undefined;
}
