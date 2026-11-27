// SPDX-License-Identifier: Apache-2.0

// New page under Mine: the dialog that makes a private page from its name and columns.

import {
  type FieldType,
  type ListedPrivatePage,
  fieldTypeSchema,
  personLengths,
  privatePageLengths,
  rowNamingTypes,
  sameName,
} from "@fathom/shared";
import {
  ActionIcon,
  Button,
  Group,
  Modal,
  Select,
  Stack,
  Table,
  Text,
  TextInput,
} from "@mantine/core";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { type KeyboardEvent, useEffect, useId, useState } from "react";
import { ApiError, describeProblem } from "./api.ts";
import { typesOffered } from "./column-dialog.tsx";
import { Count } from "./counted-input.tsx";
import {
  escapeLeaves,
  newRecordQuestion,
  useDiscardQuestion,
} from "./discard-question.tsx";
import { focusSoon } from "./focus.ts";
import { Icon } from "./icons.tsx";
import { nameTaken } from "./list-dialog.tsx";
import { listsQuery, liveLists, nameProblem } from "./lists.ts";
import { makePrivatePage, privatePagesQuery } from "./private-pages.ts";
import { wholeList } from "./theme.ts";

const conflict = 409;

// A column as typed in the Columns step, by a key of its own so its row keeps its place.
interface TypedColumn {
  key: string;
  name: string;
  type: FieldType;
  listId: string | null;
}

const steps = [
  { value: "name", label: "Name" },
  { value: "columns", label: "Columns" },
] as const;

type Step = (typeof steps)[number]["value"];

const firstColumnName = "Name";

const namingTypes = typesOffered.filter(({ value }) =>
  rowNamingTypes.includes(value),
);

const isTyped = (column: TypedColumn) => column.name.trim() !== "";

// What is wrong with a column typed in, beside those before it, if anything: its name, or its list.
export function columnProblems(
  columns: readonly TypedColumn[],
): { name?: string; list?: string }[] {
  return columns.map((column, index) => {
    const taken = columns
      .slice(0, index)
      .some((other) => isTyped(other) && sameName(other.name, column.name));
    const name = nameProblem(
      column.name,
      personLengths.column,
      taken,
      nameTaken("column"),
    );
    const list =
      column.type === "choice" && column.listId === null
        ? "List needed"
        : undefined;
    return {
      ...(name === undefined ? {} : { name }),
      ...(list === undefined ? {} : { list }),
    };
  });
}

// The columns asked for, leaving out the empty row at the end, each new column General.
export const columnRequests = (columns: readonly TypedColumn[]) =>
  columns
    .filter((column, index) => index === 0 || isTyped(column))
    .map(({ name, type, listId }) =>
      type === "choice"
        ? { name, type, listId: listId ?? undefined }
        : { name, type, visibility: "general" as const },
    );

export function NewPageDialog({
  opened,
  pages,
  onClose,
}: {
  opened: boolean;
  // The maker's pages, whose names a new page can't take.
  pages: readonly ListedPrivatePage[];
  onClose: () => void;
}) {
  const question = useDiscardQuestion();
  const [typed, setTyped] = useState(false);
  const [busy, setBusy] = useState(false);
  const [step, setStep] = useState<Step>("name");
  // Made afresh each time it opens, so nothing typed before is kept.
  const [opening, setOpening] = useState(0);
  const close = () => {
    setOpening((count) => count + 1);
    setStep("name");
    onClose();
  };
  const leave = () => {
    question.ask(typed ? newRecordQuestion("page") : undefined, close);
  };
  return (
    <>
      <Modal
        opened={opened}
        size={step === "name" ? "sm" : "lg"}
        title="New page"
        closeOnEscape={false}
        onKeyDown={escapeLeaves(leave, busy)}
        closeOnClickOutside={!busy}
        withCloseButton={!busy}
        onClose={leave}
      >
        <NewPageSteps
          key={opening}
          onTyped={setTyped}
          onBusy={setBusy}
          step={step}
          onStep={setStep}
          pages={pages}
          onCancel={leave}
          onMade={close}
        />
      </Modal>
      {question.dialog}
    </>
  );
}

function NewPageSteps({
  pages,
  onTyped,
  onBusy,
  step,
  onStep: setStep,
  onCancel,
  onMade,
}: {
  pages: readonly ListedPrivatePage[];
  onTyped: (typed: boolean) => void;
  onBusy: (busy: boolean) => void;
  // The step shown, kept by the dialog, which is narrow for the name and wide for the columns.
  step: Step;
  onStep: (step: Step) => void;
  onCancel: () => void;
  onMade: () => void;
}) {
  const ids = useId();
  const [name, setName] = useState("");
  const [nextKey, setNextKey] = useState(1);
  const [columns, setColumns] = useState<TypedColumn[]>([
    {
      key: "0",
      name: firstColumnName,
      type: "text",
      listId: null,
    },
  ]);
  const [tried, setTried] = useState({ name: false, columns: false });
  const [sentName, setSentName] = useState("");
  const lists = useQuery(listsQuery);
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const making = useMutation({
    mutationFn: makePrivatePage,
    onMutate: () => {
      onBusy(true);
    },
    onSettled: () => {
      onBusy(false);
    },
    onSuccess: async ({ page }) => {
      await queryClient.invalidateQueries({
        queryKey: privatePagesQuery.queryKey,
      });
      onMade();
      await navigate({ to: "/mine/$pageId", params: { pageId: page.id } });
    },
    onError: (error) => {
      if (refusedAsTaken(error)) {
        setStep("name");
        focusSoon(`${ids}-name`);
      }
    },
  });
  const refusedAsTaken = (error: Error | null) =>
    error instanceof ApiError && error.status === conflict;
  const taken =
    pages.some((page) => sameName(page.name, name)) ||
    (refusedAsTaken(making.error) && sameName(sentName, name));
  const nameRefusal = nameProblem(
    name,
    privatePageLengths.name,
    taken,
    nameTaken("page"),
  );
  // The empty row at the end, where a new column is typed; typing in it adds another under it.
  const shown: TypedColumn[] = [
    ...columns,
    { key: String(nextKey), name: "", type: "text", listId: null },
  ];
  const problems = columnProblems(shown.slice(0, -1));
  // The List column shows only while a column draws on a list.
  const asksList = shown.some(({ type }) => type === "choice");
  const offeredLists = liveLists(lists.data ?? [])
    .filter((list) => !list.retired)
    .map(({ id, name: listName }) => ({ value: id, label: listName }));

  const typedAny =
    name !== "" ||
    columns.some(
      (column, index) => index > 0 || column.name !== firstColumnName,
    );
  useEffect(() => {
    onTyped(typedAny);
  }, [typedAny, onTyped]);
  const changeColumn = (index: number, change: Partial<TypedColumn>) => {
    const next = shown.map((one, at) =>
      at === index ? { ...one, ...change } : one,
    );
    const kept = index === columns.length ? next : next.slice(0, -1);
    if (index === columns.length) setNextKey((key) => key + 1);
    setColumns(kept);
  };
  const removeColumn = (index: number) => {
    const kept = columns.filter((_, at) => at !== index);
    setColumns(kept);
    // The next column, or the empty row, takes its place, and focus.
    focusSoon(nameFieldOf(index));
  };
  const nameFieldOf = (index: number) => `${ids}-column-${String(index)}`;
  // Enter in a column's name goes on to the next row's, as in a table.
  const nextRowOnEnter = (index: number) => (event: KeyboardEvent) => {
    if (event.key !== "Enter" || index >= columns.length) return;
    event.preventDefault();
    focusSoon(nameFieldOf(index + 1));
  };

  const goToColumns = () => {
    setTried((was) => ({ ...was, name: true }));
    if (nameRefusal !== undefined) {
      focusSoon(`${ids}-name`);
      return;
    }
    setStep("columns");
    focusSoon(nameFieldOf(columns.length));
  };
  const makePage = () => {
    setTried({ name: true, columns: true });
    const [wrong] = problems.flatMap((problem, index) => [
      ...(problem.name === undefined ? [] : [nameFieldOf(index)]),
      ...(problem.list === undefined ? [] : [`${nameFieldOf(index)}-list`]),
    ]);
    if (wrong !== undefined) {
      focusSoon(wrong);
      return;
    }
    setSentName(name);
    making.mutate({ name, columns: columnRequests(columns) });
  };

  return (
    <form
      noValidate
      onSubmit={(event) => {
        event.preventDefault();
        if (step === "name") goToColumns();
        else makePage();
      }}
    >
      <Stack gap="md">
        <Text fz="sm" c="dimmed">
          {steps.map(({ value, label }, index) => (
            <Text
              key={value}
              span
              inherit
              {...(value === step
                ? {
                    fw: 600,
                    c: "var(--mantine-color-text)",
                    "aria-current": "step",
                  }
                : {})}
            >
              {index > 0 && " · "}
              {`${String(index + 1)} ${label}`}
            </Text>
          ))}
        </Text>
        {step === "name" ? (
          <TextInput
            id={`${ids}-name`}
            label="Name"
            data-autofocus
            value={name}
            error={tried.name || name !== "" ? nameRefusal : undefined}
            rightSection={
              <Count
                length={name.trim().length}
                maximum={privatePageLengths.name}
              />
            }
            rightSectionWidth={56}
            onChange={(event) => {
              setName(event.currentTarget.value);
            }}
          />
        ) : (
          <Table
            layout="fixed"
            withRowBorders={false}
            verticalSpacing={4}
            // Its cells' room at each side is taken back, so the fields line up with the dialog's.
            mx="calc(var(--table-horizontal-spacing) * -1)"
          >
            <Table.Thead>
              <Table.Tr>
                <Table.Th>Name</Table.Th>
                <Table.Th>Type</Table.Th>
                {asksList && <Table.Th>List</Table.Th>}
                <Table.Th w={40} aria-label="Remove" />
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {shown.map((column, index) => {
                const problem = tried.columns ? problems.at(index) : undefined;
                const last = index === columns.length;
                return (
                  <Table.Tr key={column.key}>
                    <Table.Td>
                      <TextInput
                        id={nameFieldOf(index)}
                        aria-label={last ? "New column name" : "Column name"}
                        value={column.name}
                        error={problem?.name}
                        onChange={(event) => {
                          changeColumn(index, {
                            name: event.currentTarget.value,
                          });
                        }}
                        onKeyDown={nextRowOnEnter(index)}
                      />
                    </Table.Td>
                    <Table.Td>
                      <Select
                        {...wholeList}
                        aria-label="Type"
                        data={index === 0 ? namingTypes : typesOffered}
                        value={column.type}
                        allowDeselect={false}
                        onChange={(value) => {
                          changeColumn(index, {
                            type: fieldTypeSchema.parse(value),
                          });
                        }}
                      />
                    </Table.Td>
                    {asksList && (
                      <Table.Td>
                        {column.type === "choice" && (
                          <Select
                            {...wholeList}
                            id={`${nameFieldOf(index)}-list`}
                            aria-label="List"
                            data={offeredLists}
                            value={column.listId}
                            error={problem?.list}
                            onChange={(value) => {
                              changeColumn(index, { listId: value });
                            }}
                          />
                        )}
                      </Table.Td>
                    )}
                    <Table.Td>
                      {index > 0 && !last && (
                        <ActionIcon
                          variant="subtle"
                          color="gray"
                          aria-label={`Remove ${column.name}`}
                          onClick={() => {
                            removeColumn(index);
                          }}
                        >
                          <Icon name="close" />
                        </ActionIcon>
                      )}
                    </Table.Td>
                  </Table.Tr>
                );
              })}
            </Table.Tbody>
          </Table>
        )}
        {making.error && !refusedAsTaken(making.error) && (
          <Text fz="sm" c="red" role="alert">
            {describeProblem(
              making.error,
              "Fathom could not make the page. Try again in a moment.",
            )}
          </Text>
        )}
        <Group gap="xs" mt="xs">
          {step === "columns" && (
            <Button
              variant="default"
              disabled={making.isPending}
              onClick={() => {
                setStep("name");
                focusSoon(`${ids}-name`);
              }}
            >
              Back
            </Button>
          )}
          <Group gap="xs" ml="auto">
            <Button
              variant="default"
              disabled={making.isPending}
              onClick={onCancel}
            >
              Cancel
            </Button>
            <Button type="submit" loading={making.isPending}>
              {step === "name" ? "Next" : "Add page"}
            </Button>
          </Group>
        </Group>
      </Stack>
    </form>
  );
}
