# Cycles Worked Out from Patterns

- **ADR:** 0010
- **Status:** Accepted
- **Date:** 2026-11-03
- **Revised:** 2026-11-04, to make cycles up to each stream's Cycles until date rather than two years ahead, and to keep releases on the cycles they include when one cycle's length changes

## Context

Each release stream has its own cycles, made ahead to a date of the stream's own, two years from the day the stream is added by default, from a configurable length and naming pattern, which can change from a chosen date while the cycles before keep their names and dates, as the [Decisions Log](../product/decisions.md#planning) sets out. Releases include consecutive cycles of their stream, features will target a cycle, and each cycle's share of the months it spans counts allocations, capacity, and demand. The [Domain Model](../design/domain-model.md#release-entities) gives each stream cycle patterns, each in force from its start until the next, agreed by the owner on 2026-11-03.

## Options

| Option | Cycle identity | Keeping cycles ahead | When a pattern changes |
| --- | --- | --- | --- |
| Stored cycle rows, made from the patterns | A row and its key | A job, or each approval, must add cycles as time passes | Later rows are made again, and what refers to them must move |
| Cycles worked out from the patterns | The stream and the day the cycle starts | Nothing to keep: any horizon is worked out when read | Later cycles follow at once; what refers to them is checked |

## Decision

- **Cycles are not stored:** The server works a stream's cycles out from its patterns whenever it needs them, those that start on or before the stream's Cycles until date. Only the patterns and that date are stored.
- **A cycle is known by its stream and start day:** Releases name their first and last cycles by the days they start, and features will name the cycle they target the same way.
- **Counting from the pattern's start:** Each of a pattern's cycles starts a whole number of lengths after the pattern starts, so cycles in months keep the same day of the month. A day the month does not have, such as the 31st, becomes the month's last day, without moving the cycles after it.
- **Rules the server keeps:** So that a cycle's start day stays a cycle's start day, the server refuses a change that would break any of these, both when it is drafted and when it is approved:
  - A stream's earliest pattern may start on any day; every other pattern starts on the start day of one of the cycles the others make, so no cycle is cut short.
  - A change to a stream's patterns is refused if any release would no longer start and end on cycle start days of its stream.
  - No cycle is in two releases of a stream, so no two releases' ranges of start days overlap.
  - A stream's Cycles until date is refused if any release would include a cycle that starts after it.
  - A change is refused if a release's first cycle would start after the release's Ships on date, which never moves because its cycles moved.
- **Changing one cycle's length:** The change writes the patterns that give the new cycles, and moves each release on cycles that move to the same cycles at their new start days, as drafts saved in one change set and approved, rejected and discarded only together, as the Decisions Log's Cycle length changes sets out, so the rules above still hold.
- **Checked by the server:** The rules are checked under the lock every change to drafts takes, so two changes cannot break them together. A database exclusion constraint on overlapping releases would need the `btree_gist` extension, and is left out.

## Consequences

- **No job to run:** Cycles reach the stream's Cycles until date whenever they are read, and moving the date later needs no rows to be added.
- **References without foreign keys:** A release, and later a feature, refers to a cycle by a day the database cannot check, so the server's rules above are what keep those references whole. Features targeting cycles must add their own check to the rules on pattern changes and on the Cycles until date.
- **Past cycles can change:** Nothing yet stops a pattern whose cycles have begun from being changed, if no release depends on it; whether to refuse it waits until the owner has seen cycles in use, as the owner decided on 2026-11-03.
- **Cheap to work out:** A stream's cycles, even of a week each over years, are a few thousand at most, worked out in memory.
