// SPDX-License-Identifier: Apache-2.0

// Naming, renaming, or removing the name of a manager's team from their card on the org chart, for
// those who can change people. A team's name is a person's detail, so the change is a draft, as on
// People, and the chart shows it as a draft until it is approved.

import { personLengths } from "@fathom/shared";
import {
  Button,
  Group,
  Input,
  Popover,
  Stack,
  Text,
  TextInput,
  UnstyledButton,
} from "@mantine/core";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { describeProblem } from "./api.ts";
import { notifyFailure, notifySuccess } from "./notices.tsx";
import classes from "./org-chart.module.css";
import { updatePerson } from "./people.ts";
import { unpublishedQuery } from "./unpublished.tsx";

export function TeamNameEditor({
  managerId,
  managerName,
  name,
  size = "xs",
}: {
  managerId: string;
  managerName: string;
  name: string | null;
  size?: "xs" | "sm";
}) {
  const queryClient = useQueryClient();
  const [opened, setOpened] = useState(false);
  const [typed, setTyped] = useState(name ?? "");
  const team = name ?? `the team of ${managerName}`;
  const change = useMutation({
    mutationFn: (teamName: string) => updatePerson(managerId, { teamName }),
    onSuccess: (_, teamName) => {
      setOpened(false);
      notifySuccess(
        `Draft saved. The team's name ${teamName === "" ? "comes off" : `becomes ${teamName}`} once approved.`,
      );
    },
    onError: (error) => {
      notifyFailure(
        describeProblem(error, `Fathom could not change the name of ${team}.`),
      );
    },
    onSettled: () =>
      queryClient.invalidateQueries({ queryKey: unpublishedQuery.queryKey }),
  });
  const save = () => {
    const wanted = typed.trim();
    if (wanted === (name ?? "")) setOpened(false);
    else change.mutate(wanted);
  };
  return (
    <Popover
      opened={opened}
      onChange={setOpened}
      position="bottom-start"
      trapFocus
      withArrow
      shadow="md"
    >
      <Popover.Target>
        <UnstyledButton
          className={[classes.teamName, "nodrag", "nopan"].join(" ")}
          aria-label={
            name === null
              ? `Add a name for the team of ${managerName}`
              : `Rename ${name}`
          }
          onClick={() => {
            setTyped(name ?? "");
            setOpened((open) => !open);
          }}
        >
          <Text size={size} c={name === null ? "blue" : "dimmed"} truncate>
            {name ?? "Add a name"}
          </Text>
        </UnstyledButton>
      </Popover.Target>
      <Popover.Dropdown>
        <form
          onSubmit={(event) => {
            event.preventDefault();
            save();
          }}
        >
          <Stack gap="xs" w={240}>
            <TextInput
              placeholder="Team name"
              aria-label="Team name"
              value={typed}
              rightSection={
                typed === "" ? null : (
                  <Input.ClearButton
                    aria-label="Clear the name"
                    onClick={() => {
                      setTyped("");
                    }}
                  />
                )
              }
              maxLength={personLengths.teamName}
              data-autofocus
              onChange={(event) => {
                setTyped(event.currentTarget.value);
              }}
            />
            <Group justify="flex-end" gap="xs">
              <Button
                variant="default"
                size="xs"
                onClick={() => {
                  setOpened(false);
                }}
              >
                Cancel
              </Button>
              <Button type="submit" size="xs" loading={change.isPending}>
                Save
              </Button>
            </Group>
          </Stack>
        </form>
      </Popover.Dropdown>
    </Popover>
  );
}
