// SPDX-License-Identifier: Apache-2.0

// The Features Board's rules: which of a stream's cycles are its columns, which column a feature
// is in, the order of its cards, what a card shows, and whether a committed feature is staffed, as
// the Decisions Log sets out for the Roadmap.

import {
  type CardPart,
  type Cycle,
  type Feature,
  type Meaning,
  type PlanMode,
  type ReleaseStream,
} from "@fathom/shared";
import { cycleChoiceId } from "./projects.ts";
import type { ViewPart } from "./table-controls.tsx";
import type { View } from "./table-view.ts";
import { includesCycle, keptReleases } from "./releases.ts";

const boardLabel = "Board";

export const planModes: readonly { value: PlanMode; label: string }[] = [
  { value: "table", label: "Table" },
  { value: "board", label: boardLabel },
];

export const cardPartLabels: Readonly<Record<CardPart, string>> = {
  key: "Key",
  status: "Status",
  priority: "Priority",
  size: "Size",
  risk: "Risk",
  neededBy: "Needed by",
  staffed: "Staffed months",
};

// The parts a card shows: every one offered, but those the view hides.
export const shownParts = (
  offered: readonly CardPart[],
  hidden: readonly CardPart[] | undefined,
): ReadonlySet<CardPart> =>
  new Set(offered.filter((part) => hidden?.includes(part) !== true));

// The words of the Board's menus, on their buttons and where Save view names their choices.
export const boardMenuWords = { stream: "Stream", card: "Card" } as const;

// How Save view names the Board's choices a view keeps: its stream and the parts its cards show,
// each once chosen.
export function boardParts(
  view: Pick<View, "choices">,
  streams: readonly Pick<ReleaseStream, "id" | "name">[],
  offered: readonly CardPart[],
): ViewPart[] {
  const { stream, hide } = view.choices ?? {};
  const hidden = [hide ?? []].flat();
  const shown = offered
    .filter((part) => !hidden.includes(part))
    // The part is always one of the fixed parts.
    // eslint-disable-next-line security/detect-object-injection
    .map((part) => cardPartLabels[part]);
  const parts = [
    ...streams
      .filter(({ id }) => id === stream)
      .map(({ name }) => `${boardMenuWords.stream} ${name}`),
    ...(hide === undefined
      ? []
      : [`${boardMenuWords.card} ${shown.join(", ")}`]),
  ];
  return parts.length === 0
    ? []
    : [{ name: boardLabel, value: parts.join(", ") }];
}

// The column of features that target no cycle yet.
export const laterKey = "later";

// A column: one of the stream's cycles, with the release it is in, if any, and, beside live, the
// release it is in as live where a draft moves that one away, or Later.
export interface BoardColumn {
  key: string;
  cycle?: Cycle | undefined;
  release?: ReleaseStream["releases"][number] | undefined;
  liveRelease?: ReleaseStream["releases"][number] | undefined;
  current: boolean;
}

const releaseIn = (stream: ReleaseStream, startsOn: string) =>
  keptReleases(stream).find((release) => includesCycle(release, startsOn));

// Where a stream's cycles are shown from: the cycle starting on the day asked for, or else the
// current one, or else the first to come, or else the last; moved back where needed so as many as
// fit are shown.
export function firstShown(
  cycles: readonly Cycle[],
  fits: number,
  today: string,
  from?: string,
): number {
  const asked = cycles.findIndex(({ startsOn }) => startsOn === from);
  const coming = cycles.findIndex(({ endsOn }) => endsOn >= today);
  let start = asked;
  if (start === -1) start = coming === -1 ? cycles.length - 1 : coming;
  return Math.max(0, Math.min(start, cycles.length - fits));
}

export const isCurrent = (cycle: Cycle, today: string): boolean =>
  cycle.startsOn <= today && today <= cycle.endsOn;

// The board's columns: as many of the stream's cycles as fit, from the first shown, each with its
// release, and the release it is in as live, given the stream as it is live, where that differs,
// then Later.
export function boardColumns(
  stream: ReleaseStream,
  start: number,
  fits: number,
  today: string,
  live?: ReleaseStream,
): BoardColumn[] {
  return [
    ...stream.cycles.slice(start, start + fits).map((cycle) => {
      const release = releaseIn(stream, cycle.startsOn);
      const liveRelease = live && releaseIn(live, cycle.startsOn);
      return {
        key: cycleChoiceId(stream.id, cycle.startsOn),
        cycle,
        release,
        liveRelease: liveRelease?.id === release?.id ? undefined : liveRelease,
        current: isCurrent(cycle, today),
      };
    }),
    { key: laterKey, current: false },
  ];
}

// A live stream's current cycle, holding today, with the release it is in, if any; none for a stream
// retired, not started yet, or past its last cycle. It takes the stream as liveStreams gives it.
export function streamNow(
  stream: ReleaseStream,
  today: string,
):
  | { cycle: Cycle; release?: ReleaseStream["releases"][number] | undefined }
  | undefined {
  if (stream.retired) return undefined;
  const cycle = stream.cycles.find((one) => isCurrent(one, today));
  return cycle && { cycle, release: releaseIn(stream, cycle.startsOn) };
}

// The column a feature is in: its target cycle's, or Later when it targets none.
export const columnOf = (
  feature: Pick<Feature, "targetStreamId" | "targetCycle">,
): string =>
  feature.targetStreamId === null || feature.targetCycle === null
    ? laterKey
    : cycleChoiceId(feature.targetStreamId, feature.targetCycle);

// Whether a feature's draft moves it to another cycle.
export const movesCycle = (feature: Pick<Feature, "draft">): boolean =>
  feature.draft?.action === "changed" &&
  feature.draft.changed.some(
    (field) => field === "targetCycle" || field === "targetStreamId",
  );

// How likely each meaning of a status is, the most likely first.
const likelihood: Readonly<Record<Meaning, number>> = {
  done: 0,
  "in-progress": 1,
  planned: 2,
  possible: 3,
  cancelled: 4,
  proposed: 5,
  open: 5,
  hired: 5,
  left: 5,
};

interface RankedChoice {
  id: string;
  meaning?: Meaning | null | undefined;
}

const unranked = Number.MAX_SAFE_INTEGER;

const rankIn = (choices: readonly RankedChoice[], id: string | null) => {
  const at = choices.findIndex((choice) => choice.id === id);
  return at === -1 ? unranked : at;
};

// Where a status ranks, most likely first: by its meaning, then, among the choices of one meaning,
// the later in the list first, since a list of statuses runs from the least likely.
function statusRank(statuses: readonly RankedChoice[], id: string): number {
  const status = statuses.find((choice) => choice.id === id);
  const meaning = status?.meaning;
  if (status === undefined || meaning == null) return unranked;
  const at = statuses.indexOf(status);
  // The meaning is always one of the fixed meanings.
  // eslint-disable-next-line security/detect-object-injection
  return likelihood[meaning] * statuses.length + (statuses.length - at);
}

// The order of a column's cards: by priority, then the month needed by, then status, most likely
// first, then the most customers, and last by name; an empty value comes after every other.
export function cardOrder(
  priorities: readonly RankedChoice[],
  statuses: readonly RankedChoice[],
) {
  return (a: Feature, b: Feature): number =>
    rankIn(priorities, a.priorityId) - rankIn(priorities, b.priorityId) ||
    Number(a.neededBy === null) - Number(b.neededBy === null) ||
    (a.neededBy ?? "").localeCompare(b.neededBy ?? "") ||
    statusRank(statuses, a.statusId) - statusRank(statuses, b.statusId) ||
    b.customerIds.length - a.customerIds.length ||
    a.name.localeCompare(b.name);
}

// A risk's place among its list's choices, those retired left out unless it holds one, and how
// many there are, for its mark; nothing for a feature with no risk.
export function riskStep(
  risks: readonly { id: string; name: string; retired: boolean }[],
  riskId: string | null,
): { name: string; step: number; steps: number } | undefined {
  const offered = risks.filter(({ retired, id }) => !retired || id === riskId);
  const risk = offered.find(({ id }) => id === riskId);
  return (
    risk && {
      name: risk.name,
      step: offered.indexOf(risk),
      steps: offered.length,
    }
  );
}
