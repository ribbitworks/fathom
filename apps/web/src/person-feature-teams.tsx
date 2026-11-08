// SPDX-License-Identifier: Apache-2.0

// The feature teams a person is on, in their details, read only: each team, with who leads it, or
// marked when they do, opening it on the org chart's feature teams beside their details. Shown only
// to readers who see the org chart, where feature teams are kept.

import { Anchor, Text } from "@mantine/core";
import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { featureTeamsQuery } from "./feature-teams.ts";
import { orgChartQuery } from "./org-chart.ts";
import classes from "./person-panel.module.css";

export function PersonFeatureTeams({
  personId,
  employeeId,
  seesChart,
}: {
  personId: string;
  // The person's Employee ID, which keeps their details open beside the team.
  employeeId: string;
  seesChart: boolean;
}) {
  const query = useQuery({ ...featureTeamsQuery, enabled: seesChart });
  const chart = useQuery({ ...orgChartQuery, enabled: seesChart });
  const nameOf = (id: string) =>
    chart.data?.people.find((person) => person.id === id)?.preferredName ??
    "someone you can't see";
  if (!seesChart) return null;
  const teams = (query.data?.teams ?? []).filter(({ members }) =>
    members.includes(personId),
  );
  return (
    <section aria-labelledby="person-feature-teams">
      <h3 className={classes.heading} id="person-feature-teams">
        Feature teams
      </h3>
      {teams.length === 0 ? (
        <Text c="dimmed" size="sm">
          None
        </Text>
      ) : (
        <ul className={classes.reports}>
          {teams.map((team) => (
            <li key={team.id}>
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
              <Text span c="dimmed" size="sm" ml={8}>
                {team.leadId === personId
                  ? "Lead"
                  : team.leadId === null
                    ? "No feature lead"
                    : `Led by ${nameOf(team.leadId)}`}
              </Text>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
