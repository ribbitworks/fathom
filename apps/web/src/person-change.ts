// SPDX-License-Identifier: Apache-2.0

// Saving a change to one person or planned hire, as People's cells and the Person details panel both
// do: shown at once, then saved as a draft.

import type { Person } from "@fathom/shared";
import { hireChange, updateHire } from "./hires.ts";
import { isHire, personOnly, type RowChange } from "./people-rows.ts";
import { type PeopleData, updatePerson } from "./people.ts";
import type { Change } from "./saving.ts";

// Values asked for, by column, without those removed.
export const kept = <Value>(
  asked: Readonly<Record<string, Value | null>>,
): Record<string, Value> =>
  Object.fromEntries(
    Object.entries(asked).flatMap(([key, value]) =>
      value === null ? [] : [[key, value]],
    ),
  );

// A row with a change applied, as the table shows it before it is saved. A planned hire's ID
// cleared shows empty until the server gives it a temporary one.
function changed(person: Person, change: RowChange): Person {
  const {
    values,
    links,
    notes,
    preferredName,
    employeeId,
    positionId,
    stateId,
    ...dates
  } = change;
  return {
    ...person,
    ...dates,
    preferredName: preferredName ?? person.preferredName,
    employeeId: employeeId ?? person.employeeId,
    positionId: positionId ?? person.positionId,
    stateId: stateId ?? person.stateId,
    values: { ...person.values, ...values },
    links: kept({ ...person.links, ...links }),
    ...(person.notes === undefined && notes === undefined
      ? {}
      : { notes: kept({ ...person.notes, ...notes }) }),
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
