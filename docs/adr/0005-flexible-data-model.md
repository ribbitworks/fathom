# Flexible Data Model

- **ADR:** 0005
- **Status:** Accepted
- **Date:** 2026-10-30
- **Revised:** 2026-10-31, to link to [ADR 0006](0006-table-views-in-the-browser.md) for how tables are filtered and sorted; 2026-11-06, to add Note fields; 2026-11-08, to add Number fields; 2026-11-19, to say data classes, as Fathom does, rather than tiers

## Context

The [Domain Model](../design/domain-model.md#configuration-entities) records that Fathom has a fixed core of built-in tables, which users extend with their own fields and tables, and that every change records who made it. This ADR decides how that is stored and enforced.

Two earlier decisions constrain it. Every read goes through one data access layer that applies class checks, as [ADR 0001](0001-tech-stack.md) requires. The application's database role can only read and write data, and only reviewed migrations change the schema, as [ADR 0002](0002-libraries.md) requires, so a custom field can never become a new database column or index.

## Options

- **A JSON column on each table:** Each record holds its custom values in one PostgreSQL `jsonb` column. Simple to read and write, but PostgreSQL's foreign keys work only on columns, so links inside JSON cannot be enforced, and enforcing uniqueness needs an index for each field, which is a schema change.
- **A values table:** One table holds every custom value, one row per record and field, with one typed column for each field type, such as text, number, and date, plus foreign key columns for the record a value belongs to and the record it links to. Fixed indexes and foreign keys, created by migrations, enforce links and uniqueness for every field.
- **Database tables created by users:** Each custom table and field becomes a real table or column. Ruled out by ADR 0002, since the application cannot change the schema.

## Decision

Custom fields and tables use a values table.

- **Field definitions:** Custom fields and tables are recorded as definitions in the database, as described in the [Domain Model](../design/domain-model.md#configuration-entities).
- **Values:** Each custom value is a row naming its field and holding its value in the column for the field's type.
- **Owner:** Each table that can have custom fields, such as people or features, has its own owner column with a foreign key, and custom records share one. A check makes sure exactly one owner column is set, and a record's values are deleted with it, so no value is left behind or attached to a missing record.
- **Links:** Each table that can be linked to, such as people, teams, or custom records, has its own link column with a foreign key, so a link cannot point to a missing record. A linked record cannot be deleted while links to it remain; people are already made inactive rather than deleted.
- **Uniqueness:** A value row for a field marked unique carries a flag. Each typed value column has a fixed partial unique index on the field and that column, limited to flagged rows, so the database refuses duplicates, including when two people save at the same time. Text is compared ignoring letter case.
- **Checked by the data access layer:** That a required value is present, since a missing value has no row for the database to check; that a value is in the column for its field's type; and that a link to a custom record points to the custom table its field names, since custom records share one column.
- **Access:** The data access layer leaves out every value from a field the user's classes do not cover, and so no one can filter or sort by such a field, since the order of results could reveal its values. Tables are filtered and sorted in the browser, over what each user receives, as [ADR 0006](0006-table-views-in-the-browser.md) decides.
- **Who changed what:** Read from the change history, custom values included, which records each change with the class of the field it changed, so a user sees only changes to data their classes cover. Changes made by setup or seed scripts are recorded as made by Fathom itself, not by a user.

| Setting the user sees | How it is enforced |
| --- | --- |
| Field type: Text, Number, Date, Yes/No, Choice from a list, Web link, Note, Person, or Link to another table | A typed value column; Person and Link fields use the foreign key for that table, a Web link two text columns, its address and the text shown for it, and a Note one text column holding the note's Markdown |
| Must be filled in | The data access layer |
| No two records can have the same value | The partial unique indexes |
| Identifier | Not shown; every record gets one automatically, as its primary key |

## What Is Built

Columns on People, planned hires and features can be of four types, "Choice from a list", "Web link", "Note", and "Number", as the [Domain Model](../design/domain-model.md#configuration-entities) records:

- **Storage:** field definitions, and a values table with an owner column each for people, planned hires and features, a link column for choices, a typed address column and text column for web links, a text column for a note's Markdown, which is never empty, and a numeric column for numbers.
- **Checks:** exactly one owner column is set, and each value row holds exactly one of a choice, a link, a note, or a number. Each chosen choice has a row of its own, and an index allows one link, one note, and one number for each record and column. A list or choice cannot be deleted while a column or value uses it.
- **Classes:** a web link, note, or number column has a class of its own, since it draws on no list.
- **Column order:** the order of a table's columns, built-in and added alike, is kept as one list of column keys for each table.

The other field types, uniqueness, and custom tables come later, in the Your Own Fields and Tables stage of the [Roadmap issue](https://github.com/ribbitworks/fathom/issues/398).

## Consequences

- **No schema changes at runtime:** Custom fields and tables need only rows, so the application's database role stays read and write only.
- **The database enforces links, owners, and uniqueness:** Required values, value types, and which custom table a link points to rely on the data access layer, with tests.
- **New built-in tables need a migration:** Adding a built-in table that can have custom fields adds an owner column to the values table, and one that custom fields can link to adds a link column. Custom tables share one column of each.
- **Reading a record takes a join:** Showing custom values means joining the values table, and filtering on several custom fields means one join each, which is acceptable at Fathom's scale.
- **Changing a field definition affects existing values:** Renaming a field is safe, but changing its type, making it required or unique, or deleting it must check or convert existing values first.
- **Snapshots keep values as they were:** A snapshot stores each custom value with the field's name and type at the time, so a later change to the field does not change the snapshot.
