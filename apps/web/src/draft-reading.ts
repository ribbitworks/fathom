// SPDX-License-Identifier: Apache-2.0

// What the Drafts page reads for a role, and what decides each draft it shows: whether the role
// may decide it now, what holds it back, and the drafts deciding it takes along.

import {
  approvableKinds,
  type DraftKind,
  draftKeysOf,
  draftKinds,
  draftingPermissions,
  holdsAny,
  type Permission,
  type RecordKeyOf,
} from "@fathom/shared";
import { useQuery } from "@tanstack/react-query";
import { useMemo } from "react";
import { decisionFor, needsOtherApproval } from "./draft-decisions.ts";
import {
  type DraftedData,
  draftedOf,
  type DraftReads,
  type Entry,
  entriesOf,
} from "./draft-entries.ts";
import { placeKey } from "./draft-places.ts";
import {
  decidable,
  draftNames,
  type DraftSelection,
  mayDecide,
  unseenPeople,
  waitsForRejected,
  without,
} from "./drafts.ts";
import { featureTeamsQuery } from "./feature-teams.ts";
import { listsQuery, unchangeableLists, unseenInDrafts } from "./lists.ts";
import { orgChartQuery } from "./org-chart.ts";
import { peopleQuery } from "./people.ts";
import { planningSettingsQuery } from "./planning-settings.ts";
import { planChoicesQuery, projectPlanQuery } from "./projects.ts";
import { releaseStreamsQuery } from "./releases.ts";

// What drafts a role sees, by the data it sees, and which kinds it approves.
export interface DraftsSeen {
  approves: readonly DraftKind[];
  // Whether the reader makes drafts, so has changes of their own to publish.
  makesDrafts: boolean;
  // Whether the reader sees people, so their drafts; those who see only lists see only theirs.
  seesPeople: boolean;
  // Whether the reader sees lists, through people or planning configuration.
  seesLists: boolean;
  // Whether the reader sees the plan's records, such as release streams.
  seesPlan: boolean;
  seesTeams: boolean;
  // Whether the reader sees the plan itself, so its customers, proposals, projects, and milestones.
  seesProjects: boolean;
  // Whether the reader sees configuration, so the planning settings.
  seesSettings: boolean;
  // The role's permissions, which decide the lists whose drafts it may decide, by their classes.
  permissions: readonly Permission[];
}

export const draftsSeen = (permissions: readonly Permission[]): DraftsSeen => ({
  approves: approvableKinds(permissions),
  makesDrafts: holdsAny(permissions, draftingPermissions),
  seesPeople: permissions.includes("people:view"),
  seesLists:
    permissions.includes("people:view") ||
    permissions.includes("configuration:view"),
  seesPlan:
    permissions.includes("features:view") ||
    permissions.includes("configuration:view"),
  seesTeams:
    permissions.includes("feature-teams:view") &&
    permissions.includes("people:view"),
  seesProjects: permissions.includes("plan:view"),
  seesSettings: permissions.includes("configuration:view"),
  permissions,
});

export type DraftEntries =
  | { state: "loading" }
  | { state: "failed"; retry: () => void }
  | {
      state: "loaded";
      // Every draft seen, newest first.
      all: Entry[];
      // Whether a draft waits for a rejected draft it depends on to be resubmitted.
      waits: (one: Entry) => boolean;
      // Whether the reader's role decides a draft of its kind.
      choosable: (one: Entry) => boolean;
      // Whether the reader may decide a draft now, as toDecide keeps it.
      decidesNow: (one: Entry) => boolean;
      // Why another approver must decide a draft holding what the reader's role can't see: of a list
      // of a class it can't see, or of a person, with details it can't see.
      unseen: (one: Entry) => string | undefined;
      // Whether approving a draft takes along drafts another approver must approve.
      needsOtherApproval: (one: Entry) => boolean;
      // The other drafts deciding a published draft takes with it, whatever the reader's role
      // decides: those approved with it while it waits, or those waiting on it once rejected.
      related: (one: Entry) => NamedDraft[];
      drafted: DraftedData;
    };

// The drafts the reader sees, read with what names them; the reads a role doesn't make are left
// out.
export function useDraftEntries({
  approves,
  seesPeople,
  seesLists,
  seesPlan,
  seesTeams,
  seesProjects,
  seesSettings,
  permissions,
}: Omit<DraftsSeen, "makesDrafts">): DraftEntries {
  const people = useQuery({ ...peopleQuery, enabled: seesPeople });
  const lists = useQuery({ ...listsQuery, enabled: seesLists });
  const releases = useQuery({ ...releaseStreamsQuery, enabled: seesPlan });
  const featureTeams = useQuery({ ...featureTeamsQuery, enabled: seesTeams });
  const chart = useQuery({ ...orgChartQuery, enabled: seesTeams });
  const plan = useQuery({ ...projectPlanQuery, enabled: seesProjects });
  const choices = useQuery({ ...planChoicesQuery, enabled: seesProjects });
  const settings = useQuery({
    ...planningSettingsQuery,
    enabled: seesSettings,
  });
  // The role's kinds and permissions, kept while they read the same, as a page passes new arrays each
  // time it renders.
  const approvesKey = approves.join(" ");
  const permissionsKey = permissions.join(" ");
  const kinds = useMemo(() => wordsOf<DraftKind>(approvesKey), [approvesKey]);
  const held = useMemo(
    () => wordsOf<Permission>(permissionsKey),
    [permissionsKey],
  );
  // Worked out once for what was read, since a page renders far more often than its reads change.
  const loaded = useMemo(
    () =>
      loadedEntries({
        people: seesPeople ? people.data : undefined,
        lists: seesLists ? lists.data : undefined,
        streams: seesPlan ? releases.data?.streams : undefined,
        plan: seesProjects ? plan.data : undefined,
        choices: seesProjects ? choices.data : undefined,
        settings: seesSettings ? settings.data : undefined,
        teams: seesTeams ? featureTeams.data?.teams : undefined,
        chartPeople: seesTeams ? chart.data?.people : undefined,
        approves: kinds,
        permissions: held,
      }),
    [
      seesPeople,
      people.data,
      seesLists,
      lists.data,
      seesPlan,
      releases.data,
      seesProjects,
      plan.data,
      choices.data,
      seesSettings,
      settings.data,
      seesTeams,
      featureTeams.data,
      chart.data,
      kinds,
      held,
    ],
  );
  // Only the reads the role makes count: one it doesn't make may still hold an error from before its
  // role changed.
  const reads = [
    ...(seesPeople ? [people] : []),
    ...(seesLists ? [lists] : []),
    ...(seesPlan ? [releases] : []),
    ...(seesTeams ? [featureTeams, chart] : []),
    ...(seesProjects ? [plan, choices] : []),
    ...(seesSettings ? [settings] : []),
  ];
  if (reads.some(({ isPending }) => isPending)) return { state: "loading" };
  if (reads.some(({ isError }) => isError)) {
    return {
      state: "failed",
      retry: () => {
        for (const read of reads) void read.refetch();
      },
    };
  }
  return loaded;
}

const wordsOf = <Word extends string>(joined: string): Word[] =>
  joined === "" ? [] : (joined.split(" ") as Word[]);

// The drafts read, with what decides each, each draft's taking along of others worked out once.
function loadedEntries(
  read: DraftReads,
): Extract<DraftEntries, { state: "loaded" }> {
  const all = entriesOf(read);
  const drafted = draftedOf(read);
  const { approves, permissions } = read;
  const listsData = drafted.lists;
  const peopleData = read.people?.people ?? [];
  const unchangeable = unchangeableLists(listsData, permissions);
  const takesAlongOthers = new Map<string, boolean>();
  const unseen = ({ selects }: Entry) =>
    unseenInDrafts(selects, listsData, unchangeable) ??
    unseenPeople(selects, peopleData);
  const reading = {
    waits: ({ state, selects }: Entry) =>
      state === "waiting" &&
      waitsForRejected(selects, drafted.lists, drafted.columns),
    choosable: ({ selects }: Entry) => mayDecide(approves, selects),
    unseen,
    needsOtherApproval: ({ key, selects }: Entry) => {
      const known = takesAlongOthers.get(key);
      if (known !== undefined) return known;
      const needs = needsOtherApproval(
        selects,
        approves,
        drafted.lists,
        drafted.columns,
      );
      takesAlongOthers.set(key, needs);
      return needs;
    },
  };
  return {
    state: "loaded",
    all,
    ...reading,
    decidesNow: (one) => toDecide([one], reading).length > 0,
    related: ({ unpublished, state, selects }) => {
      if (unpublished) return [];
      const decision = decisionFor(
        state === "rejected" ? "reject" : "approve",
        selects,
        draftKinds,
        drafted.lists,
        drafted.columns,
      );
      return decision.included === undefined
        ? []
        : namedDrafts(without(decision.selection, selects), all, (rest) =>
            draftNames(
              rest,
              drafted.lists,
              drafted.columns.fields,
              drafted.columns.people,
              drafted.columns.records,
              drafted.columns.featureTeams,
            ),
          );
    },
    drafted,
  };
}

// A draft named in another's details, with its record's key where it has one.
export interface NamedDraft {
  name: string;
  key: RecordKeyOf | undefined;
}

// The drafts in a selection, named as a decision names them, each after its record's key, taken
// from its row; any the reader has no row for have no key.
export function namedDrafts(
  selection: DraftSelection,
  entries: readonly Entry[],
  namesOf: (drafts: DraftSelection) => string[],
): NamedDraft[] {
  const wanted = new Set(draftKeysOf(selection));
  const found = entries.filter((one) =>
    draftKeysOf(one.selects).some((key) => wanted.has(key)),
  );
  const rest = found.reduce(
    (left, one) => without(left, one.selects),
    selection,
  );
  return [
    ...found.flatMap(({ selects, place }) =>
      namesOf(without(selects, without(selects, selection))).map((name) => ({
        name,
        key: placeKey(place),
      })),
    ),
    ...namesOf(rest).map((name) => ({ name, key: undefined })),
  ];
}

// The drafts the reader may choose to decide now: of a kind their role decides, of lists whose
// class it sees, not waiting on a rejected draft, and decidable as any record's draft is.
export const toDecide = (
  entries: readonly Entry[],
  loaded: Pick<
    Extract<DraftEntries, { state: "loaded" }>,
    "waits" | "choosable" | "unseen"
  >,
): Entry[] =>
  entries.filter(
    (one) =>
      loaded.choosable(one) &&
      loaded.unseen(one) === undefined &&
      !loaded.waits(one) &&
      decidable({
        draft: { state: one.state, unpublished: one.unpublished },
        heldBy: one.heldBy,
      }),
  );
