// SPDX-License-Identifier: Apache-2.0

// The Overview: the greeting, then the jobs the role acted as may do, by area.

import type { ClassAccess } from "@fathom/shared";
import {
  Anchor,
  Paper,
  Stack,
  Text,
  Title,
  UnstyledButton,
} from "@mantine/core";
import { Link } from "@tanstack/react-router";
import { slug } from "github-slugger";
import { useId, useMemo, useState } from "react";
import classes from "./home.module.css";
import { helpDestination } from "./help-pages.ts";
import { Icon } from "./icons.tsx";
import { helpPageOf } from "./overview-jobs.ts";
import { overviewPlace, type PagePart } from "./overview-places.ts";
import { PageHeader } from "./page-header.tsx";
import {
  jobsFor,
  type ShownArea,
  type ShownJob,
  type ShownTask,
} from "./role-jobs.ts";
import { signedIn } from "./signed-in-route.tsx";

const afternoonFrom = 12;
const eveningFrom = 18;

// Good morning before noon, Good afternoon before six, and Good evening after, by the computer's
// clock.
export function greetingFor(hour: number, name: string): string {
  const part =
    hour < afternoonFrom
      ? "morning"
      : hour < eveningFrom
        ? "afternoon"
        : "evening";
  return `Good ${part}, ${name}`;
}

// The link to where a job or task is done, described by the job's or task's name, so each of the
// many links to one page says what it's for.
function PlaceLink({
  where,
  describedBy,
}: {
  where: PagePart;
  describedBy: string;
}) {
  return (
    <Anchor
      renderRoot={(props) => <Link {...props} {...where.link} />}
      fz="sm"
      className={classes.place}
      aria-describedby={describedBy}
      aria-label={
        where.part === undefined
          ? undefined
          : `${where.item.label}, ${where.part}`
      }
    >
      {where.item.label}
      {where.part !== undefined && (
        <Text span c="dimmed" inherit>
          {" "}
          › {where.part}
        </Text>
      )}
    </Anchor>
  );
}

function HelpLink({ task }: { task: ShownTask<PagePart> }) {
  return (
    <Anchor
      renderRoot={(props) => (
        <Link
          {...props}
          {...helpDestination({
            page: helpPageOf(task.help),
            heading: slug(task.title),
          })}
        />
      )}
      fz="sm"
      c="dimmed"
      className={classes.help}
      aria-label={`Help: ${task.title}`}
    >
      Help
    </Anchor>
  );
}

function TaskItem({ task }: { task: ShownTask<PagePart> }) {
  const titleId = useId();
  return (
    <li className={classes.task}>
      <Text span fz="sm" className={classes.name} id={titleId}>
        {task.title}
      </Text>
      <PlaceLink where={task.where} describedBy={titleId} />
      <HelpLink task={task} />
    </li>
  );
}

function JobItem({ job }: { job: ShownJob<PagePart> }) {
  const [open, setOpen] = useState(false);
  const tasksId = useId();
  const titleId = useId();
  return (
    <li className={classes.job}>
      <div className={classes.row}>
        <UnstyledButton
          className={classes.toggle}
          fz="sm"
          aria-expanded={open}
          aria-controls={tasksId}
          onClick={() => {
            setOpen(!open);
          }}
        >
          <span className={classes.chevron} data-open={open || undefined}>
            <Icon name="chevron" />
          </span>
          <span id={titleId}>{job.title}</span>
        </UnstyledButton>
        <PlaceLink where={job.where} describedBy={titleId} />
        <HelpLink task={job} />
      </div>
      <ul
        id={tasksId}
        className={classes.tasks}
        aria-label={job.title}
        hidden={!open}
      >
        {job.tasks.map((task) => (
          <TaskItem key={task.title} task={task} />
        ))}
      </ul>
    </li>
  );
}

function Area({ area }: { area: ShownArea<PagePart> }) {
  const headingId = useId();
  return (
    <div className={classes.area}>
      <Title order={2} id={headingId} className={classes.heading}>
        {area.area}
      </Title>
      <ul className={classes.jobs} aria-labelledby={headingId}>
        {area.jobs.map((job) => (
          <JobItem key={job.title} job={job} />
        ))}
      </ul>
    </div>
  );
}

// Every job the role's permissions allow, by area, whatever role it is.
function Jobs({
  access,
  acting,
}: {
  access: ClassAccess;
  acting: string | null;
}) {
  const areas = useMemo(
    () => jobsFor(access, acting, overviewPlace(access)),
    [access, acting],
  );
  return (
    <Paper withBorder component="section" aria-label="Jobs">
      {areas.length === 0 ? (
        <Text c="dimmed" className={classes.empty}>
          No jobs
        </Text>
      ) : (
        areas.map((area) => <Area key={area.area} area={area} />)
      )}
    </Paper>
  );
}

export function Home() {
  const { user, role, access } = signedIn.useRouteContext();
  // The hour the page opened, so the greeting holds while it's read.
  const [hour] = useState(() => new Date().getHours());
  return (
    <Stack gap="md">
      <PageHeader title="Overview" />
      <Paper withBorder className={classes.greeting}>
        <Text fz="lg">{greetingFor(hour, user.name)}</Text>
        {role !== null && (
          <Text fz="sm" c="dimmed">
            Acting as {role.name}
          </Text>
        )}
      </Paper>
      <Jobs access={access} acting={role?.key ?? null} />
    </Stack>
  );
}
