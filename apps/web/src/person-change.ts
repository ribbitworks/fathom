// SPDX-License-Identifier: Apache-2.0

// Saving a change to one person or planned hire, as People's cells and the Person details panel both
// do: shown at once, then saved as a draft.

import type { Person } from "@fathom/shared";
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
    preferredName,
    employeeId,
    positionId,
    stateId,
    ...dates
  } = change;
  return {
    ...person,
    ...dates,
    ...withCellChange(person, { values, links, notes, numbers }),
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
