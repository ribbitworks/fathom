// SPDX-License-Identifier: Apache-2.0

// A dialog's list of what it acts on, naming the first few and counting the rest.

import { List, Text } from "@mantine/core";
import type { ReactNode } from "react";
import { count } from "./numbers.ts";

// The most a dialog names before counting the rest.
const namedAtMost = 5;

export interface Named {
  key: string;
  name: ReactNode;
}

export function CountedList({
  items,
  mt = 0,
}: {
  items: readonly Named[];
  mt?: number;
}) {
  const rest = items.length - namedAtMost;
  return (
    <div>
      <List size="sm" mt={mt}>
        {items.slice(0, namedAtMost).map(({ key, name }) => (
          <List.Item key={key}>{name}</List.Item>
        ))}
      </List>
      {rest > 0 && (
        <Text fz="sm" c="dimmed" mt={4}>
          {rest === 1 ? "and 1 other" : `and ${count(rest)} others`}
        </Text>
      )}
    </div>
  );
}
