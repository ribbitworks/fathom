// SPDX-License-Identifier: Apache-2.0

// The Data classes page, for a role with Classify data: the class of everything the organization
// keeps in one, in three sections: each built-in detail with the pages, views and columns needing
// it, People's added columns, and the lists. Each changes class at once, never as a draft, and every
// page then follows its new class. A column drawing on a list takes the list's class, so changes
// with the list. Columns and lists show only to a role that reads them.

import {
  type ClassAccess,
  classifiedFieldNames,
  classifiedFieldSchema,
  classNames,
  type Field,
  type List,
  shownIn,
  type Tier,
  whyNoMove,
} from "@fathom/shared";
import {
  Button,
  Paper,
  Stack,
  Table,
  Text,
  Title,
  VisuallyHidden,
} from "@mantine/core";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "@tanstack/react-router";
import {
  moveColumnClass,
  moveFieldClass,
  moveListClass,
} from "./data-classes.ts";
import { listRefusal, listsQuery } from "./lists.ts";
import { LoadProblem } from "./load-problem.tsx";
import {
  MoveClassModal,
  type MoveSubject,
  useClassMove,
} from "./move-class-dialog.tsx";
import { PageHeader } from "./page-header.tsx";
import classes from "./pages.module.css";
import { peopleColumnsQuery, peopleQuery } from "./people.ts";
import { sessionQuery } from "./session.ts";
import { ClassMark } from "./status-mark.tsx";

// A row of a section: what holds the data, its class, what it is about, and how to change its
// class, or nothing for data whose class is changed elsewhere.
interface ClassRow {
  key: string;
  name: string;
  dataClass: Tier;
  about: string;
  change?: Omit<MoveSubject, "name" | "from"> | undefined;
  // Who has unpublished changes to it, so its class waits until they publish or discard them.
  heldBy?: string | undefined;
}

// A class as this page names it: in words for General, and by its mark for the rest, as on the
// columns and lists that hold it.
function ClassName({ dataClass }: { dataClass: Tier }) {
  return dataClass === "general" ? (
    classNames.general
  ) : (
    <ClassMark dataClass={dataClass} />
  );
}

function ClassSection({
  title,
  about,
  rows,
  access,
  onChange,
}: {
  title: string;
  // The heading of the column saying what each row is about.
  about: string;
  rows: readonly ClassRow[];
  access: ClassAccess;
  onChange: (subject: MoveSubject) => void;
}) {
  const id = `data-classes-${title.toLowerCase().replaceAll(" ", "-")}`;
  return (
    <Stack gap="xs" component="section" aria-labelledby={id}>
      <Title order={2} size="h4" id={id}>
        {title}
      </Title>
      <Paper withBorder className={classes.tableScrollPanel}>
        <div className={classes.tableScroll}>
          <Table aria-labelledby={id}>
            <Table.Thead>
              <Table.Tr>
                <Table.Th className={classes.unwrapped}>Name</Table.Th>
                <Table.Th className={classes.unwrapped}>Class</Table.Th>
                <Table.Th>{about}</Table.Th>
                <Table.Th>
                  <VisuallyHidden>Actions</VisuallyHidden>
                </Table.Th>
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {rows.map(
                ({ key, name, dataClass, about: said, change, heldBy }) => {
                  // A role changes the class only of data it sees, and nobody else is changing.
                  const whyNoChange =
                    whyNoMove(access.permissions, dataClass, dataClass) ??
                    (heldBy === undefined
                      ? undefined
                      : `Being changed by ${heldBy}`);
                  return (
                    <Table.Tr key={key}>
                      <Table.Td className={classes.unwrapped}>{name}</Table.Td>
                      <Table.Td className={classes.unwrapped}>
                        <ClassName dataClass={dataClass} />
                      </Table.Td>
                      <Table.Td c="dimmed">{said}</Table.Td>
                      <Table.Td ta="right" className={classes.unwrapped}>
                        {change && (
                          <Stack gap={2} align="flex-end">
                            <Button
                              variant="default"
                              size="xs"
                              aria-label={`Change the class of ${name}`}
                              disabled={whyNoChange !== undefined}
                              onClick={() => {
                                onChange({ ...change, name, from: dataClass });
                              }}
                            >
                              Change class…
                            </Button>
                            {whyNoChange !== undefined && (
                              <Text fz="xs" c="dimmed">
                                {whyNoChange}
                              </Text>
                            )}
                          </Stack>
                        )}
                      </Table.Td>
                    </Table.Tr>
                  );
                },
              )}
            </Table.Tbody>
          </Table>
        </div>
      </Paper>
    </Stack>
  );
}

// Lists and columns as they are approved, leaving out those only drafted to be added, whose class
// is given in their dialog, and those drafted to be removed.
const approved = <Item extends Pick<List | Field, "draft">>(
  items: readonly Item[],
) =>
  items.filter(
    ({ draft }) => draft?.action !== "created" && draft?.action !== "deleted",
  );

// What a column's row says: where it is shown, and the list whose class it takes, if it draws on
// one.
const columnAbout = (field: Field, lists: readonly List[]) =>
  field.visibility === null
    ? `People, with the class of ${lists.find(({ id }) => id === field.listId)?.name ?? "its list"}`
    : "People";

export function DataClassesPage({ access }: { access: ClassAccess }) {
  const queryClient = useQueryClient();
  const router = useRouter();
  const classMove = useClassMove();
  const seesColumns = access.permissions.includes("people:view");
  const seesLists = access.permissions.includes("configuration:view");
  const columnsRead = useQuery({ ...peopleColumnsQuery, enabled: seesColumns });
  const lists = useQuery({ ...listsQuery, enabled: seesLists });
  const allLists = lists.data ?? [];
  const fields = approved(columnsRead.data?.fields ?? []);
  // A changed class shows at once, then People, the Lists page and this page reload, since every
  // column drawing on a list takes its class.
  const changed = (
    update: () => void,
    ...queryKeys: (readonly unknown[])[]
  ) => {
    update();
    for (const queryKey of queryKeys) {
      void queryClient.invalidateQueries({ queryKey });
    }
  };

  const details: ClassRow[] = classifiedFieldSchema.options.map((field) => ({
    key: field,
    // The field is always one of the fixed fields.
    // eslint-disable-next-line security/detect-object-injection
    name: classifiedFieldNames[field],
    // eslint-disable-next-line security/detect-object-injection
    dataClass: access.dataClasses[field],
    about: shownIn(field).join(", "),
    change: {
      move: (to) => moveFieldClass(field, to),
      moved: () => {
        void queryClient
          .invalidateQueries({ queryKey: sessionQuery.queryKey })
          .then(() => router.invalidate());
      },
    },
  }));
  const columns: ClassRow[] = fields.map((field) => ({
    key: field.id,
    name: field.name,
    dataClass:
      field.visibility ??
      allLists.find(({ id }) => id === field.listId)?.visibility ??
      "general",
    about: columnAbout(field, allLists),
    heldBy: field.heldBy,
    ...(field.visibility === null
      ? {}
      : {
          change: {
            move: (to: Tier) => moveColumnClass(field.id, to),
            moved: (visibility: Tier) => {
              changed(() => {
                queryClient.setQueryData(
                  peopleColumnsQuery.queryKey,
                  (read) =>
                    read && {
                      ...read,
                      fields: read.fields.map((other) =>
                        other.id === field.id
                          ? { ...other, visibility }
                          : other,
                      ),
                    },
                );
              }, peopleQuery.queryKey);
            },
          },
        }),
  }));
  const listRows: ClassRow[] = approved(allLists).map((list) => ({
    key: list.id,
    name: list.name,
    dataClass: list.visibility,
    heldBy: list.heldBy,
    about: fields
      .filter(({ listId }) => listId === list.id)
      .map(({ name }) => name)
      .join(", "),
    change: {
      move: (to) => moveListClass(list.id, to),
      moved: (visibility) => {
        changed(
          () => {
            queryClient.setQueryData(listsQuery.queryKey, (read) =>
              read?.map((other) =>
                other.id === list.id ? { ...other, visibility } : other,
              ),
            );
          },
          listsQuery.queryKey,
          peopleQuery.queryKey,
        );
      },
      refusal: listRefusal(list),
    },
  }));

  return (
    <Stack gap="md">
      <PageHeader title="Data classes" />
      <Stack gap="lg">
        <ClassSection
          title="Built-in details"
          about="Needed by"
          rows={details}
          access={access}
          onChange={classMove.open}
        />
        {seesColumns &&
          (columnsRead.isError ? (
            <LoadProblem
              what="the columns"
              onRetry={() => void columnsRead.refetch()}
            />
          ) : (
            <ClassSection
              title="Columns"
              about="Shown on"
              rows={columns}
              access={access}
              onChange={classMove.open}
            />
          ))}
        {seesLists &&
          (lists.isError ? (
            <LoadProblem
              what="the lists"
              onRetry={() => void lists.refetch()}
            />
          ) : (
            <ClassSection
              title="Lists"
              about="People's columns using it"
              rows={listRows}
              access={access}
              onChange={classMove.open}
            />
          ))}
        <MoveClassModal
          moving={classMove.dialog}
          opened={classMove.opened}
          permissions={access.permissions}
          onClose={classMove.close}
        />
      </Stack>
    </Stack>
  );
}
