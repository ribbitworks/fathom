// SPDX-License-Identifier: Apache-2.0

// The org chart's people, through the server's API, and the tree they make: each person under their
// manager, reports by name, and those with no manager at the top. Collapsing a manager hides
// everyone below them. The people shown are laid out top to bottom, with reports who manage nobody
// stacked in a column under their manager, so a large organization grows down rather than across.

import { type OrgChartPerson, orgChartSchema } from "@fathom/shared";
import { queryOptions } from "@tanstack/react-query";
import { getJson } from "./api.ts";

export const orgChartQuery = queryOptions({
  queryKey: ["org-chart"],
  queryFn: () => getJson("/api/org-chart", orgChartSchema),
});

// Fitting a small chart to the screen never enlarges its cards past their own size.
export const fitOptions = { maxZoom: 1 };

export const cardWidth = 240;
export const cardHeight = 104;

const byName = new Intl.Collator(undefined, { sensitivity: "base" });

export interface OrgTree {
  people: ReadonlyMap<string, OrgChartPerson>;
  roots: readonly string[];
  // Each manager's direct reports, by name.
  reports: ReadonlyMap<string, readonly string[]>;
}

export function treeOf(people: readonly OrgChartPerson[]): OrgTree {
  const sorted = [...people].sort(
    (a, b) =>
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
  const people = new Map<string, OrgChartPerson>();
  const reports = new Map<string, readonly string[]>();
  const visit = (id: string) => {
    // Only people in the tree are visited: the roots given, and the reports the tree lists.
    people.set(id, tree.people.get(id) as OrgChartPerson);
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
  if (reports.length === 0) {
    return {
      width: cardWidth,
      height: cardHeight,
      cards: [{ id, x: 0, y: 0 }],
      lines: [],
    };
  }
  const stacked = reports.filter((report) => !tree.reports.has(report));
  const managers = reports.filter((report) => tree.reports.has(report));
  // Reports who manage nobody are stacked in a column under the manager's left edge, and the
  // managers among them are side by side to its right, below a gap for the lines to cross.
  const top = cardHeight + (managers.length === 0 ? stackGap : down);
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
    height: Math.max(
      top + stacked.length * (cardHeight + stackGap) - stackGap,
      row.height,
    ),
    cards: [
      // With nobody stacked, the manager is centred over the row of managers.
      { id, x: stacked.length === 0 ? (row.width - cardWidth) / 2 : 0, y: 0 },
      ...stacked.map((report, index) => ({
        id: report,
        x: stackIndent,
        y: top + index * (cardHeight + stackGap),
      })),
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

// How many levels the chart has, counting the people at the top as the first.
export function levelsOf(tree: OrgTree): number {
  const below = (id: string): number =>
    1 + Math.max(0, ...(tree.reports.get(id) ?? []).map(below));
  return Math.max(0, ...tree.roots.map(below));
}

// The chart's address: the person found, and the manager whose team alone is shown, each by
// Employee ID.
export interface ChartSearch {
  person?: string | undefined;
  team?: string | undefined;
}
