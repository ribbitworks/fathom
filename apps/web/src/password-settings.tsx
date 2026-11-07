// SPDX-License-Identifier: Apache-2.0

// The password settings on the Settings page: the rules every password a person chooses must meet,
// and the recipe for the passwords Fathom makes for new accounts and resets. A recipe whose
// passwords would break the rules, or that uses no characters at all, cannot be saved, and says
// why. Saved at once, for everyone, and recorded in the access history; a tighter rule applies
// from each person's next change of password.

import {
  type CharacterKind,
  characterKinds,
  type CharacterType,
  characterTypes,
  kindsIn,
  generatedPasswordLength,
  lookAlikeCharacters,
  passwordLength,
  type PasswordSettings,
  passwordSettingsSchema,
  recipeProblems,
} from "@fathom/shared";
import {
  Alert,
  Button,
  Checkbox,
  Group,
  NumberInput,
  Paper,
  Stack,
  Text,
  Title,
} from "@mantine/core";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "@tanstack/react-router";
import { useState } from "react";
import { describeProblem, sendJsonFor } from "./api.ts";
import { notifySuccess } from "./notices.tsx";
import { sessionQuery } from "./session.ts";

const savePasswordSettings = (settings: PasswordSettings) =>
  sendJsonFor(
    "PUT",
    "/api/settings/passwords",
    settings,
    passwordSettingsSchema,
  );

const capitalized = (words: string) =>
  `${words.charAt(0).toUpperCase()}${words.slice(1)}`;

const spaced = (characters: string) => Array.from(characters).join(" ");

// A recipe's symbols are named, since Fathom uses only some.
const recipeLabel = (kind: CharacterKind) =>
  kind.type === "symbols"
    ? `${capitalized(kind.all)}: ${spaced(kind.characters)}`
    : capitalized(kind.all);

const typesIn = (flags: Record<CharacterType, boolean>) =>
  kindsIn(flags).map(({ type }) => type);

// A length as typed, which may be empty or not yet a whole number.
type Typed = number | string;

interface Draft {
  minimumLength: Typed;
  required: CharacterType[];
  length: Typed;
  used: CharacterType[];
  avoidLookAlikes: boolean;
}

const draftOf = ({ rules, recipe }: PasswordSettings): Draft => ({
  minimumLength: rules.minimumLength,
  required: typesIn(rules),
  length: recipe.length,
  used: typesIn(recipe),
  avoidLookAlikes: recipe.avoidLookAlikes,
});

const flags = (chosen: readonly CharacterType[]) =>
  Object.fromEntries(
    characterTypes.map((type) => [type, chosen.includes(type)]),
  ) as Record<CharacterType, boolean>;

// The settings the draft makes, which are not valid while a length is not a whole number in range.
const settingsOf = (draft: Draft) => ({
  rules: { minimumLength: draft.minimumLength, ...flags(draft.required) },
  recipe: {
    length: draft.length,
    ...flags(draft.used),
    avoidLookAlikes: draft.avoidLookAlikes,
  },
});

interface Range {
  minimum: number;
  maximum: number;
}

const inRange = (value: Typed, { minimum, maximum }: Range) =>
  typeof value === "number" &&
  Number.isInteger(value) &&
  value >= minimum &&
  value <= maximum;

const rangeProblem = ({ minimum, maximum }: Range) =>
  `Enter a number from ${String(minimum)} to ${String(maximum)}.`;

export function PasswordSettingsPanel({
  passwords,
}: {
  passwords: PasswordSettings;
}) {
  const queryClient = useQueryClient();
  const router = useRouter();
  const [draft, setDraft] = useState(() => draftOf(passwords));
  const change = (changes: Partial<Draft>) => {
    setDraft((current) => ({ ...current, ...changes }));
  };
  const settings = passwordSettingsSchema.safeParse(settingsOf(draft));
  const problems = settings.success ? recipeProblems(settings.data) : [];
  const unchanged =
    settings.success &&
    JSON.stringify(settings.data) === JSON.stringify(passwords);
  const saving = useMutation({
    mutationFn: async (saved: Draft) =>
      savePasswordSettings(passwordSettingsSchema.parse(settingsOf(saved))),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: sessionQuery.queryKey });
      await router.invalidate();
      notifySuccess("Saved the password settings.");
    },
  });
  return (
    <Paper withBorder p="md" component="section" aria-label="Passwords">
      <form
        noValidate
        onSubmit={(event) => {
          event.preventDefault();
          saving.mutate(draft);
        }}
      >
        <Stack>
          <Title order={2} size="h4">
            Password requirements
          </Title>
          <NumberInput
            label="Minimum length"
            min={passwordLength.minimum}
            max={passwordLength.maximum}
            allowDecimal={false}
            allowNegative={false}
            value={draft.minimumLength}
            onChange={(minimumLength) => {
              change({ minimumLength });
            }}
            error={
              !inRange(draft.minimumLength, passwordLength) &&
              rangeProblem(passwordLength)
            }
          />
          <Checkbox.Group
            label="Must have"
            value={draft.required}
            onChange={(required) => {
              change({ required });
            }}
          >
            <Stack gap="xs" mt="xs">
              {characterKinds.map((kind) => (
                <Checkbox
                  key={kind.type}
                  value={kind.type}
                  label={capitalized(kind.one)}
                />
              ))}
            </Stack>
          </Checkbox.Group>
          <Text size="sm" c="dimmed">
            Changes apply the next time each person changes their password.
          </Text>
          <Title order={2} size="h4" mt="sm">
            Generated passwords
          </Title>
          <NumberInput
            label="Length"
            min={generatedPasswordLength.minimum}
            max={generatedPasswordLength.maximum}
            allowDecimal={false}
            allowNegative={false}
            value={draft.length}
            onChange={(length) => {
              change({ length });
            }}
            error={
              !inRange(draft.length, generatedPasswordLength) &&
              rangeProblem(generatedPasswordLength)
            }
          />
          <Checkbox.Group
            label="Use"
            value={draft.used}
            onChange={(used) => {
              change({ used });
            }}
          >
            <Stack gap="xs" mt="xs">
              {characterKinds.map((kind) => (
                <Checkbox
                  key={kind.type}
                  value={kind.type}
                  label={recipeLabel(kind)}
                />
              ))}
            </Stack>
          </Checkbox.Group>
          <Checkbox
            label={`Leave out characters that look alike: ${spaced(lookAlikeCharacters)}`}
            checked={draft.avoidLookAlikes}
            onChange={(event) => {
              change({ avoidLookAlikes: event.currentTarget.checked });
            }}
          />
          {problems.length > 0 && (
            <Alert color="red" role="alert">
              <Stack gap={4}>
                {problems.map((problem) => (
                  <Text key={problem} size="sm">
                    {problem}
                  </Text>
                ))}
              </Stack>
            </Alert>
          )}
          {saving.error && (
            <Alert color="red" role="alert">
              {describeProblem(
                saving.error,
                "Fathom could not save the password settings. Try again in a moment.",
              )}
            </Alert>
          )}
          <Group justify="flex-end">
            <Button
              type="submit"
              loading={saving.isPending}
              disabled={!settings.success || unchanged || problems.length > 0}
            >
              Save
            </Button>
          </Group>
        </Stack>
      </form>
    </Paper>
  );
}
