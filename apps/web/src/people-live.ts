// SPDX-License-Identifier: Apache-2.0

// The People table's people as live or as the Draft menu shows them.

import type { Person, Show } from "@fathom/shared";
import { liveRecordsOf, recordsAsShown } from "./live-records.ts";
import { today } from "./today.ts";
import { type ChangesFrom } from "./person-change.ts";
import { detailKeys } from "./people-rows.ts";
import { notShown } from "./draft-details.tsx";

// Who each person reports to, live or as drafted, whoever the people shown name as a manager.
export function managersNamed(people: readonly Person[]): Map<string, string> {
  const named = new Map<string, string>();
  for (const person of people) {
    if (person.manager)
      named.set(person.manager.id, person.manager.preferredName);
    const live = person.draft?.live.managerId;
    if (typeof live === "string" && !named.has(live)) named.set(live, notShown);
  }
  return named;
}

// Everyone as they are live, without drafts: those only drafted to be added are left out, and each
// detail and column a draft changes has its live value back, with each person's manager, and their
// team, named as the manager's live team name has it.
const liveMade = new WeakMap<readonly Person[], Person[]>();

// Changes made from a day, judged by today's people as they are live, before today's are read too.
export const changesFromDay = (
  day: string | undefined,
  today: readonly Person[] | undefined,
): ChangesFrom | undefined =>
  day === undefined
    ? undefined
    : {
        day,
        today: new Map(livePeople(today ?? []).map((one) => [one.id, one])),
      };

export function livePeople(people: readonly Person[]): Person[] {
  const made = liveMade.get(people);
  if (made !== undefined) return made;
  const live = makeLivePeople(people);
  liveMade.set(people, live);
  return live;
}

// Everyone as the Draft menu's choice shows them: as drafted, with the drafts applied, where a
// rejected draft is taken back and someone drafted to be removed is gone, or as they are live.
export const peopleAsShown = (
  people: readonly Person[],
  show: Show,
): Person[] => recordsAsShown(show, people, livePeople);

function makeLivePeople(people: readonly Person[]): Person[] {
  const drafted = new Map(people.map((person) => [person.id, person.draft]));
  const named = managersNamed(people);
  const nameOf = new Map(
    people.map(({ id, preferredName }) => [id, preferredName]),
  );
  const endOf = new Map(people.map(({ id, endDate }) => [id, endDate]));
  const now = today();
  const live = liveRecordsOf(people, detailKeys).map((person): Person => {
    const draft = drafted.get(person.id);
    if (draft?.action !== "changed" || !draft.changed.includes("managerId")) {
      return person;
    }
    const id = draft.live.managerId;
    // Whether the manager has left is sent of the drafted manager, so the live one's is worked out
    // here, from their end date, which only those who see Personal details are sent.
    const end = typeof id === "string" ? endOf.get(id) : undefined;
    const livePerson: Person = {
      ...person,
      manager:
        typeof id === "string"
          ? // Every live manager is named, if only as not shown.
            { id, preferredName: nameOf.get(id) ?? (named.get(id) as string) }
          : null,
    };
    if (typeof end === "string" && end < now) livePerson.managerLeft = true;
    else delete livePerson.managerLeft;
    return livePerson;
  });
  const byId = new Map(live.map((person) => [person.id, person]));
  return live.map((person) => {
    const manager =
      person.manager === undefined || person.manager === null
        ? undefined
        : byId.get(person.manager.id);
    if (manager === undefined) return person;
    // Only readers who see Personal details see when a line starts, and whether its manager left.
    const withTeam = { ...person, team: manager.teamName ?? null };
    if (person.managerFrom === undefined) return withTeam;
    delete withTeam.managerLeft;
    return typeof manager.endDate === "string" && manager.endDate < now
      ? { ...withTeam, managerLeft: true }
      : withTeam;
  });
}
