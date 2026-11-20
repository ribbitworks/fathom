// SPDX-License-Identifier: Apache-2.0

// The tables of people and planned hires.

import {
  boolean,
  check,
  date,
  index,
  integer,
  text,
  uniqueIndex,
  uuid,
  type AnyPgColumn,
} from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { fathomSchema } from "./schema-core.ts";
import { listItems } from "./schema-lists.ts";

// People: employees, current and former, with the details every person has. A person is current
// from their start date until their end date passes; one with no start date counts as current.
// Employee IDs are unique, ignoring letter case, among themselves and, checked by the server, with
// planned hires' requisitions. A person's position is a choice in the built-in Positions list,
// which the server checks. People who leave are kept, not deleted; deleting is only for a person
// entered by mistake whom nothing uses. A person's state is a choice in the built-in hiring states
// list meaning Hired or Left, as their end date decides, which the server checks; none, or one of
// the other meaning, stands for the first choice offered with the meaning the end date decides.
// Other details are columns drawing on lists. Only people flagged as managers can be named as a
// manager, which the server checks rather than the database, since past reporting lines may name
// people no longer flagged.
export const people = fathomSchema.table(
  "people",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    preferredName: text("preferred_name").notNull(),
    employeeId: text("employee_id").notNull(),
    positionId: uuid("position_id")
      .notNull()
      .references(() => listItems.id, { onDelete: "restrict" }),
    startDate: date("start_date"),
    endDate: date("end_date"),
    isManager: boolean("is_manager").notNull().default(false),
    stateId: uuid("state_id").references(() => listItems.id, {
      onDelete: "restrict",
    }),
  },
  (table) => [
    uniqueIndex("people_employee_id_index").on(sql`lower(${table.employeeId})`),
    index("people_position_index").on(table.positionId),
    index("people_state_index").on(table.stateId),
    check(
      "people_dates_in_order",
      sql`${table.endDate} IS NULL OR ${table.startDate} IS NULL OR ${table.endDate} >= ${table.startDate}`,
    ),
  ],
);

// The numbers of planned hires' temporary IDs, such as 7 in TBD-7, never reused.
export const plannedHireTemporaryNumbers = fathomSchema.sequence(
  "planned_hire_temporary_numbers",
);

// Planned hires: roles to be filled, kept apart from people, so their Confidential details never sit
// among people's, but shown beside them on People. A hire is known by its requisition or, until it
// has one, by a temporary number; requisitions are unique, ignoring letter case, among themselves
// and, checked by the server, with Employee IDs, and never look like a temporary ID. Its state is a
// choice in the built-in hiring states list and its position one in Positions, which the server
// checks. A filled hire names the person who filled it. A person may fill several over time, and is
// removed only with the hires they filled, which the server does in one draft. A hire's manager is a
// person or, marked as a manager, another planned hire, never both; the server refuses loops.
export const plannedHires = fathomSchema.table(
  "planned_hires",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    name: text("name"),
    requisition: text("requisition"),
    temporaryNumber: integer("temporary_number"),
    positionId: uuid("position_id")
      .notNull()
      .references(() => listItems.id, { onDelete: "restrict" }),
    targetDate: date("target_date"),
    stateId: uuid("state_id")
      .notNull()
      .references(() => listItems.id, { onDelete: "restrict" }),
    managerId: uuid("manager_id").references(() => people.id, {
      onDelete: "restrict",
    }),
    managerHireId: uuid("manager_hire_id").references(
      (): AnyPgColumn => plannedHires.id,
      { onDelete: "restrict" },
    ),
    isManager: boolean("is_manager").notNull().default(false),
    filledBy: uuid("filled_by").references(() => people.id, {
      onDelete: "restrict",
    }),
  },
  (table) => [
    uniqueIndex("planned_hires_requisition_index").on(
      sql`lower(${table.requisition})`,
    ),
    uniqueIndex("planned_hires_temporary_number_index").on(
      table.temporaryNumber,
    ),
    index("planned_hires_filled_by_index").on(table.filledBy),
    index("planned_hires_manager_index").on(table.managerId),
    index("planned_hires_manager_hire_index").on(table.managerHireId),
    index("planned_hires_position_index").on(table.positionId),
    index("planned_hires_state_index").on(table.stateId),
    check(
      "planned_hires_one_id",
      sql`num_nonnulls(${table.requisition}, ${table.temporaryNumber}) = 1`,
    ),
    check(
      "planned_hires_one_manager",
      sql`num_nonnulls(${table.managerId}, ${table.managerHireId}) <= 1`,
    ),
    check(
      "planned_hires_not_own_manager",
      sql`${table.managerHireId} IS NULL OR ${table.managerHireId} <> ${table.id}`,
    ),
    check(
      "planned_hires_requisition_not_temporary",
      sql`${table.requisition} IS NULL OR lower(${table.requisition}) NOT LIKE 'tbd-%'`,
    ),
  ],
);
