// SPDX-License-Identifier: Apache-2.0

// Records in force from a date until the next one for the same subject starts, such as a person's
// reporting lines. Part of the data access layer. Feature team memberships follow the same pattern.

export interface Dated {
  fromDate: string;
}

// Each subject's records, earliest first.
export function bySubject<Row extends Dated>(
  rows: readonly Row[],
  subjectOf: (row: Row) => string,
): Map<string, Row[]> {
  const grouped = new Map<string, Row[]>();
  for (const row of rows) {
    const subject = subjectOf(row);
    grouped.set(subject, [...(grouped.get(subject) ?? []), row]);
  }
  for (const records of grouped.values()) {
    records.sort((a, b) => a.fromDate.localeCompare(b.fromDate));
  }
  return grouped;
}

// The record in force on a day, from records earliest first: the last to have started by then.
export function inForceOn<Row extends Dated>(
  records: readonly Row[],
  day: string,
): Row | undefined {
  return records.findLast((record) => record.fromDate <= day);
}

// Whether a record, one of records earliest first, is in force on a day or starts after it.
export const inForceOrLater = <Row extends Dated>(
  record: Row,
  records: readonly Row[],
  day: string,
): boolean => record.fromDate > day || record === inForceOn(records, day);

// The record that is current on a day: the one in force, or, before any has started, the first,
// such as a new employee's first line, which starts on their start date.
export function currentRecordOn<Row extends Dated>(
  records: readonly Row[],
  day: string,
): Row | undefined {
  return inForceOn(records, day) ?? records[0];
}
