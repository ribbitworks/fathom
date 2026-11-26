// SPDX-License-Identifier: Apache-2.0

// Saving a change to one person or planned hire, as People's cells and the Person details panel both
// do: shown at once, then saved as a draft, and dating a change of manager made from an earlier day.

import { lineChangesFrom, type Person } from "@fathom/shared";
import { withCellChange } from "./added-columns.ts";
import { hireChange, updateHire } from "./hires.ts";
import { isHire, personOnly, type RowChange } from "./people-rows.ts";
import { type PeopleData, updatePerson } from "./people.ts";
import type { Change } from "./saving.ts";

// A row with a change applied, as the table shows it before it is saved. A planned hire's ID
// cleared shows empty until the server gives it a temporary one.
function changed(person: Person, change: RowChange): Person {
  const {
    values,
    links,
    notes,
    numbers,
    flags,
    preferredName,
    employeeId,
    positionId,
    stateId,
    ...dates
  } = change;
  return {
    ...person,
    ...dates,
    ...withCellChange(person, { values, links, notes, numbers, flags }),
    preferredName: preferredName ?? person.preferredName,
    employeeId: employeeId ?? person.employeeId,
    positionId: positionId ?? person.positionId,
    stateId: stateId ?? person.stateId,
  };
}

// The change that saves a person's new values, named in its failure as given.
export const personUpdate = (
  person: Person,
  change: RowChange,
  name: string,
): Change<PeopleData> => ({
  next: (data) => ({
    ...data,
    people: data.people.map((other) =>
      other.id === person.id ? changed(other, change) : other,
    ),
  }),
  save: () =>
    isHire(person)
      ? updateHire(person.id, hireChange(change))
      : updatePerson(person.id, personOnly(change)),
  failure: `Fathom could not save the change to ${name}.`,
});

// A change of manager from an earlier day: from that day, or, back to the live manager, from the
// live line's own date, so the drafted change is withdrawn rather than the line moved.
export function datedChange(
  change: RowChange,
  live: Person,
  day: string,
): RowChange {
  const managerFrom =
    change.managerId === (live.manager?.id ?? null) ? live.managerFrom : day;
  return typeof managerFrom === "string" ? { ...change, managerFrom } : change;
}

// Changes made while another day is shown: the day, and each person as live today, since the
// server judges a change from the day against the line in force today, not the one shown.
export interface ChangesFrom {
  day: string;
  today: ReadonlyMap<string, Person>;
}

// Whether a person's manager can change from the day shown, as their line today allows.
export function managerChangesFrom(id: string, from: ChangesFrom): boolean {
  const live = from.today.get(id);
  return live !== undefined && lineChangesFrom(live, from.day);
}

// A change made while another day is shown, dated against the person's line today. Only a person
// whose manager can change from the day is changed then, so they are live today.
export const changedFrom = (
  change: RowChange,
  id: string,
  from: ChangesFrom,
): RowChange => datedChange(change, from.today.get(id) as Person, from.day);
