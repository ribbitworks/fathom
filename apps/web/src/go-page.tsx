// SPDX-License-Identifier: Apache-2.0

// What a link to a record shows when it opens no record: nothing found, in the same words whether
// no record has the key or the reader may not see it, or, to those whose History shows it, that the
// record was removed.

import { Anchor, Stack, Title } from "@mantine/core";
import { Link } from "@tanstack/react-router";

export function RecordNotShown({
  shownKey,
  removed,
}: {
  shownKey: string;
  removed: boolean;
}) {
  return (
    <Stack align="center" gap="xs" mt="xl" role="status">
      <Title order={1} fz={22}>
        {removed ? `${shownKey} was removed` : `Nothing found for ${shownKey}`}
      </Title>
      {removed && (
        <Anchor component={Link} to="/changes">
          Show the change history
        </Anchor>
      )}
    </Stack>
  );
}
