# Cycles Worked Out from Patterns

- **ADR:** 0010
- **Status:** Accepted
- **Date:** 2026-11-03
- **Revised:**
  - 2026-11-04, to make cycles up to each stream's Cycles until date rather than two years ahead, and to keep releases on the cycles they include when one cycle's length changes
  - 2026-11-08, to keep features on the cycles they target in the same way
  - 2026-11-14, to let a stream end on a day of its own, cutting its last cycle short
  - 2026-11-15, to lay cycles out two years ahead of today, leaving the Ends day as a stream's only date, and to note that release streams, the streams below, are now called schedules, though the code keeps `ReleaseStream`

## Context

Each release stream has its own cycles, laid out two years ahead of today, from a configurable length and naming pattern. That length and naming pattern can change from a chosen date while the cycles before keep their names and dates, as the [Domain Model](../design/domain-model.md#release-entities) sets out.

Releases include consecutive cycles of their stream, features target a cycle, and each cycle's share of the months it spans counts allocations, capacity, and demand. The [Domain Model](../design/domain-model.md#release-entities) gives each stream cycle patterns, each in force from its start until the next.

## Options

| Option | Cycle identity | Keeping cycles ahead | When a pattern changes |
| --- | --- | --- | --- |
| Stored cycle rows, made from the patterns | A row and its key | A job, or each approval, must add cycles as time passes | Later rows are made again, and what refers to them must move |
| Cycles worked out from the patterns | The stream and the day the cycle starts | Nothing to keep: any horizon is worked out when read | Later cycles follow at once; what refers to them is checked |

## Decision

- **Cycles are not stored:** The server works a stream's cycles out from its patterns whenever it needs them. Only the patterns and the Ends day are stored. The cycles it works out are:
  - **When they are shown:** those that start up to two years from today.
  - **When a change is checked:** as far as any release or feature on them reaches.
  - **For a stream that ends:** on or before its Ends day, the cycle holding that day cut short to end on it.
- **A cycle is known by its stream and start day:** Releases name their first and last cycles by the days they start, and features name the cycle they target the same way.
- **Counting from the pattern's start:** Each of a pattern's cycles starts a whole number of lengths after the pattern starts, so cycles in months keep the same day of the month. A day the month does not have, such as the 31st, becomes the month's last day, without moving the cycles after it.
- **Rules the server keeps:** So that a cycle's start day stays a cycle's start day, the server refuses a change that would break any of these, both when it is drafted and when it is approved:
  - A stream's earliest pattern may start on any day; every other pattern starts on the start day of one of the cycles the others make, so no cycle is cut short.
  - A change to a stream's patterns is refused if any release would no longer start and end on cycle start days of its stream, or any feature would no longer target a cycle start day of its stream.
  - No cycle is in two releases of a stream, so no two releases' ranges of start days overlap.
  - A stream's Ends day is refused if any release would include a cycle that starts after it, or any feature would target one, and so is one before the stream's first cycle starts.
  - A change is refused if a release's first cycle would start after the release's Ships on date, which never moves because its cycles moved.
- **Changing one cycle's length:** The change writes the patterns that give the new cycles, and moves each release on cycles that move, and each feature that targets one, to the same cycles at their new start days, as drafts saved in one change set and approved, rejected and discarded only together, so the rules above still hold.
- **Checked by the server:** The rules are checked under the lock every change to drafts takes, so two changes cannot break them together. A database exclusion constraint on overlapping releases would need the `btree_gist` extension, and is left out.

## Consequences

- **No job to run:** Cycles reach two years from today whenever they are read, so they move ahead with time with no rows to add.
- **References without foreign keys:** A release or a feature refers to a cycle by a day the database cannot check, so the server's rules above are what keep those references whole.
- **Past cycles can change:** Nothing yet stops a pattern whose cycles have begun from being changed, if no release depends on it; whether to refuse it is left open until cycles have been seen in use.
- **Cheap to work out:** A stream's cycles, even of a week each over years, are a few thousand at most, worked out in memory.
