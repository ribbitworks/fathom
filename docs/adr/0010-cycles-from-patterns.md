# Cycles Worked Out from Patterns

- **ADR:** 0010
- **Status:** Accepted
- **Date:** 2026-11-03

## Context

Each release stream has its own cycles, made at least two years ahead from a configurable length and naming pattern, which can change from a chosen date while the cycles before keep their names and dates, as the [Decisions Log](../product/decisions.md#planning) sets out. Releases include consecutive cycles of their stream, features will target a cycle, and each cycle's share of the months it spans counts allocations, capacity, and demand. The [Domain Model](../design/domain-model.md#release-entities) gives each stream cycle patterns, each in force from its start until the next, agreed by the owner on 2026-11-03.

## Options

| Option | Cycle identity | Keeping cycles ahead | When a pattern changes |
| --- | --- | --- | --- |
| Stored cycle rows, made from the patterns | A row and its key | A job, or each approval, must add cycles as time passes | Later rows are made again, and what refers to them must move |
| Cycles worked out from the patterns | The stream and the day the cycle starts | Nothing to keep: any horizon is worked out when read | Later cycles follow at once; what refers to them is checked |

## Decision

- **Cycles are not stored:** The server works a stream's cycles out from its patterns whenever it needs them, as far ahead as asked, and at least two years ahead. Only the patterns are stored.
- **A cycle is known by its stream and start day:** Releases name their first and last cycles by the days they start, and features will name the cycle they target the same way.
- **Counting from the pattern's start:** Each of a pattern's cycles starts a whole number of lengths after the pattern starts, so cycles in months keep the same day of the month. A day the month does not have, such as the 31st, becomes the month's last day, without moving the cycles after it.
- **Rules the server keeps:** So that a cycle's start day stays a cycle's start day, the server refuses a change that would break any of these, both when it is drafted and when it is approved:
  - A stream's earliest pattern may start on any day; every other pattern starts on the start day of one of the cycles the others make, so no cycle is cut short.
  - A change to a stream's patterns is refused if any release would no longer start and end on cycle start days of its stream.
  - No cycle is in two releases of a stream, so no two releases' ranges of start days overlap.
- **Checked by the server:** The rules are checked under the lock every change to drafts takes, so two changes cannot break them together. A database exclusion constraint on overlapping releases would need the `btree_gist` extension, and is left out.

## Consequences

- **No job to run:** Cycles reach two years ahead whenever they are read, with no rows to top up.
- **References without foreign keys:** A release, and later a feature, refers to a cycle by a day the database cannot check, so the server's rules above are what keep those references whole. Features targeting cycles must add their own check to the rule on pattern changes.
- **Past cycles can change:** Nothing yet stops a pattern whose cycles have begun from being changed, if no release depends on it; whether to refuse it waits until the owner has seen cycles in use, as the owner decided on 2026-11-03.
- **Cheap to work out:** A stream's cycles, even of a week each over years, are a few thousand at most, worked out in memory.
