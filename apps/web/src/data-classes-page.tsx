// SPDX-License-Identifier: Apache-2.0

// The Data classes page: the class of each built-in detail, People's added columns, and the lists,
// and changing them.

import {
  type ClassAccess,
  classifiedFieldNames,
  classifiedFieldSchema,
  columnClass,
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
import type { ReactNode } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "@tanstack/react-router";
import {
  moveColumnClass,
  moveFieldClass,
  moveListClass,
} from "./data-classes.ts";
import { EmptyTableRow } from "./empty-table.tsx";
import { listRefusal, listsQuery } from "./lists.ts";
import { LoadProblem } from "./load-problem.tsx";
import {
  MoveClassModal,
  type MoveSubject,
  useClassMove,
} from "./move-class-dialog.tsx";
import { PageHeader } from "./page-header.tsx";
import pageClasses from "./data-classes-page.module.css";
import classes from "./pages.module.css";
import { peopleColumnsQuery, peopleQuery } from "./people.ts";
import { sessionQuery } from "./session.ts";
import { ClassName } from "./status-mark.tsx";

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

const classHeadings: readonly {
  key: string;
  name: ReactNode;
  className?: string | undefined;
}[] = [
  { key: "name", name: "Name", className: pageClasses.nameColumn },
  { key: "class", name: "Class", className: pageClasses.classColumn },
  { key: "about", name: "About" },
  {
    key: "actions",
    name: <VisuallyHidden>Actions</VisuallyHidden>,
    className: pageClasses.actionsColumn,
  },
];

function ClassSection({
  title,
  rows,
  noun,
  access,
  onChange,
}: {
  title: string;
  rows: readonly ClassRow[];
  // None while the rows are still being read, so the table never says it has none too soon.
  noun?: string | undefined;
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
        <div className={[classes.tableScroll, classes.scrollBars].join(" ")}>
          <Table aria-labelledby={id} className={pageClasses.classTable}>
            <Table.Thead>
              <Table.Tr>
                {classHeadings.map(({ key, name, className }) => (
                  <Table.Th key={key} className={className}>
                    {name}
                  </Table.Th>
                ))}
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {rows.length === 0 && noun !== undefined && (
                <EmptyTableRow
                  span={classHeadings.length}
                  table={{ noun }}
                  leavesOut={false}
                />
              )}
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
                      <Table.Td>{name}</Table.Td>
                      <Table.Td className={classes.unwrapped}>
                        <ClassName dataClass={dataClass} />
                      </Table.Td>
                      <Table.Td c="dimmed">{said}</Table.Td>
                      <Table.Td ta="right">
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

// A column's class, with what its row says about it, or nothing for a column whose list isn't sent,
// whose class isn't known.
const classedColumn = (
  field: Field,
  lists: readonly List[],
): Pick<ClassRow, "dataClass" | "about"> | undefined => {
  const list = lists.find(({ id }) => id === field.listId);
  const dataClass = columnClass(field, list);
  if (dataClass === undefined) return undefined;
  return {
    dataClass,
    about:
      list === undefined
        ? "People shows it."
        : `People shows it. It takes its list's class, ${list.name}.`,
  };
};

const listAbout = (columns: readonly string[]) =>
  columns.length === 0
    ? "No People column uses it."
    : `These People columns use it: ${columns.join(", ")}.`;

export function DataClassesPage({ access }: { access: ClassAccess }) {
  const queryClient = useQueryClient();
  const router = useRouter();
  const classMove = useClassMove();
  const seesColumns = access.permissions.includes("people:view");
  const seesLists = access.permissions.includes("configuration:view");
  const columnsRead = useQuery({ ...peopleColumnsQuery, enabled: seesColumns });
  // A choice column takes its list's class, so the columns wait for the lists, which every role
  // seeing people reads.
  const lists = useQuery({
    ...listsQuery,
    enabled: seesColumns || seesLists,
  });
  const allLists = lists.data ?? [];
  const fields = lists.isSuccess
    ? approved(columnsRead.data?.fields ?? [])
    : [];
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
    about: `These need it: ${shownIn(field).join(", ")}.`,
    change: {
      move: async (to) => {
        await moveFieldClass(field, to);
        return null;
      },
      moved: () => {
        void queryClient
          .invalidateQueries({ queryKey: sessionQuery.queryKey })
          .then(() => router.invalidate());
      },
    },
  }));
  const columns: ClassRow[] = fields
    .flatMap((field) => {
      const classed = classedColumn(field, allLists);
      return classed === undefined ? [] : [{ field, ...classed }];
    })
    .map(({ field, dataClass, about }) => ({
      key: field.id,
      name: field.name,
      dataClass,
      about,
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
    // Said only once the columns are read, and never to a role that doesn't see them.
    about: columnsRead.isSuccess
      ? listAbout(
          fields
            .filter(({ listId }) => listId === list.id)
            .map(({ name }) => name),
        )
      : "",
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
          rows={details}
          access={access}
          onChange={classMove.open}
        />
        {seesColumns &&
          (columnsRead.isError || lists.isError ? (
            <LoadProblem
              what="the columns"
              onRetry={() => {
                void columnsRead.refetch();
                void lists.refetch();
              }}
            />
          ) : (
            <ClassSection
              title="Columns"
              rows={columns}
              noun={
                lists.isSuccess && columnsRead.isSuccess
                  ? "People columns"
                  : undefined
              }
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
