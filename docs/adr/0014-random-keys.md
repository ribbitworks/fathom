# Random Keys for Private Records

- **ADR:** 0014
- **Status:** Accepted
- **Date:** 2026-11-26

## Context

Every other record has a [record key](../design/domain-model.md#change-and-history-entities), a number within its kind that counts up from 1, such as #FEATURE-123. Its gaps already tell a reader that records exist which they don't see, which the [Security Plan](../security/security-plan.md#information-disclosure) accepts.

A private page, and each of its rows, is read only by its maker. A counted key would tell anyone who makes a page, or reads a row's link, how many pages and rows everyone else has made, and a link to one would be easy to guess.

## Options

- **Counted record keys:** the same numbers as every other kind, which count everyone's pages.
- **A counter for each maker:** numbers that count only the maker's own pages, but two makers' pages would share keys, so a link wouldn't name one page.
- **The record's UUID:** unique and unguessable, but 36 characters, too long to read out or type.
- **A short random code:** a few characters chosen at random, checked for clashes, and kept.

## Decision

A short random code, made by the database.

- **Alphabet:** the 30 characters that can't be taken for one another, `23456789ABCDEFGHJKMNPQRSTVWXYZ`, with no 0, 1, I, L, O or U.
- **Length:** four characters, about 810,000 codes for each kind, widening to five once a tenth of a kind's four-character codes are used, so a guess rarely finds one.
- **Kinds:** `PAGE` and `ROW`, one kind for every page's rows, such as #PAGE-K7QM and #ROW-4X9T.
- **Made once:** the `random_key` function makes a record's code, tries again on a code already given, and answers a second call for the same record with the code it already has.
- **Kept apart:** codes live in a `random_keys` table beside `record_keys`, which stay numeric, and outlive their records, so a code is never given again.
- **Written only by the database:** the function runs as its owner, and the application's role may call it but can't write, change or remove a code.

## Consequences

- **Nothing counted:** a key tells nothing about how many pages or rows exist.
- **Two kinds of key:** links by key take both forms, a number for most records, as `/go/feature/123`, and a code for private ones, whole, as `/go/ROW-4X9T`. Searching a table by key will take both once a private page's table is built.
- **Not found the same way:** a key that names nobody's record, one whose record was removed, and one that names a record the reader may not read, get the same answer, "Nothing found", from one database query whatever the key names.
- **A guess may find one:** a guessed code may name someone else's page or row, but every read refuses it as if nobody made it.
