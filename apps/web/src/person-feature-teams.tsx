// SPDX-License-Identifier: Apache-2.0

// The feature teams a person is on, in their details, read only: those they lead, then those they
// are a member of, each with who leads it, each opening on the org chart's feature teams beside their
// details. Shown only to readers who see feature teams.

import type { FeatureTeam } from "@fathom/shared";
import { Anchor, Text } from "@mantine/core";
import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import type { ReactNode } from "react";
import { featureTeamsQuery, someoneUnseen } from "./feature-teams.ts";
import { orgChartQuery } from "./org-chart.ts";
import classes from "./record-details.module.css";
import { RecordSection } from "./record-details.tsx";

export function PersonFeatureTeams({
  personId,
  employeeId,
  seesFeatureTeams,
}: {
  personId: string;
  // The person's Employee ID, which keeps their details open beside the team.
  employeeId: string;
  seesFeatureTeams: boolean;
}) {
  const query = useQuery({ ...featureTeamsQuery, enabled: seesFeatureTeams });
  const chart = useQuery({ ...orgChartQuery, enabled: seesFeatureTeams });
  const nameOf = (id: string) =>
    chart.data?.people.find((person) => person.id === id)?.preferredName ??
    someoneUnseen.toLowerCase();
  if (!seesFeatureTeams) return null;
  const teams = (query.data?.teams ?? []).filter(({ members }) =>
    members.includes(personId),
  );
  const led = teams.filter(({ leadId }) => leadId === personId);
  const others = teams.filter(({ leadId }) => leadId !== personId);
  const teamLink = (team: FeatureTeam) => (
    <Anchor
      renderRoot={(props) => (
        <Link
          {...props}
          to="/org-chart"
          search={{
            view: "feature-teams",
            featureTeam: team.id,
            open: employeeId,
          }}
        />
      )}
    >
      {team.name}
    </Anchor>
  );
  const row = (label: string, content: ReactNode) => (
    <div className={classes.row}>
      <dt className={classes.label}>{label}</dt>
      <dd className={classes.value}>{content}</dd>
    </div>
  );
  return (
    <RecordSection id="person-feature-teams" title="Feature teams">
      {led.length > 0 &&
        row(
          "Leads",
          <ul className={classes.reports}>
            {led.map((team) => (
              <li key={team.id}>{teamLink(team)}</li>
            ))}
          </ul>,
        )}
      {(others.length > 0 || led.length === 0) &&
        row(
          "Member of",
          others.length === 0 ? (
            <Text c="dimmed">None</Text>
          ) : (
            <ul className={classes.reports}>
              {others.map((team) => (
                <li key={team.id}>
                  {teamLink(team)}
                  <Text span c="dimmed" size="sm" ml={8}>
                    {team.leadId === null
                      ? "No feature lead"
                      : `Led by ${nameOf(team.leadId)}`}
                  </Text>
                </li>
              ))}
            </ul>
          ),
        )}
    </RecordSection>
  );
}
