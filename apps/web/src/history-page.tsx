// SPDX-License-Identifier: Apache-2.0

// The History page, for users who may view the access history: the most recent changes to accounts,
// newest first, with who made each one and to whom.

import { Alert, Loader, Stack, Table, Text, Title } from "@mantine/core";
import { useQuery } from "@tanstack/react-query";
import {
  describeAction,
  describeDetails,
  historyQuery,
  nameOf,
} from "./history.ts";

const dateTime = new Intl.DateTimeFormat(undefined, {
  dateStyle: "medium",
  timeStyle: "short",
});

export function HistoryPage() {
  const history = useQuery(historyQuery);
  return (
    <Stack>
      <Title order={2}>Access history</Title>
      <Text size="sm" c="dimmed">
        The most recent changes to accounts. Entries can never be changed or
        removed.
      </Text>
      {history.isPending && <Loader role="status" aria-label="Loading" />}
      {history.isError && (
        <Alert color="red" role="alert">
          Fathom could not load the access history. Try again in a moment.
        </Alert>
      )}
      {history.isSuccess && (
        <Table striped>
          <Table.Thead>
            <Table.Tr>
              <Table.Th>When</Table.Th>
              <Table.Th>Who</Table.Th>
              <Table.Th>What</Table.Th>
              <Table.Th>Whose account</Table.Th>
              <Table.Th>Details</Table.Th>
            </Table.Tr>
          </Table.Thead>
          <Table.Tbody>
            {history.data.map((entry) => (
              <Table.Tr key={entry.id}>
                <Table.Td>
                  {dateTime.format(new Date(entry.occurredAt))}
                </Table.Td>
                <Table.Td>
                  {entry.actor === null
                    ? "Fathom's operators"
                    : nameOf(entry.actor)}
                </Table.Td>
                <Table.Td>{describeAction(entry.action)}</Table.Td>
                <Table.Td>{nameOf(entry.subject)}</Table.Td>
                <Table.Td>{describeDetails(entry)}</Table.Td>
              </Table.Tr>
            ))}
          </Table.Tbody>
        </Table>
      )}
    </Stack>
  );
}
