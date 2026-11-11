// SPDX-License-Identifier: Apache-2.0

// The line shown where a page or view would be, for a role that does not see every class of data it
// needs, saying which class, such as "Other dates need Personal access.", so nothing goes missing
// without a reason.

import { Text } from "@mantine/core";

export function WhyMissing({ why }: { why: string }) {
  return (
    <Text size="sm" c="dimmed">
      {why}
    </Text>
  );
}
