#!/usr/bin/env bash
# SPDX-License-Identifier: Apache-2.0

# Runs the full check, or the changed tests and linters before a push, side by side, then lists
# each job's result and time. Usage: check.sh [--before-push] [--offline] [--skip <job name>]...

set -euo pipefail
cd "$(dirname "$0")/.."
# shellcheck source=scripts/lib.sh
source scripts/lib.sh

# Each job is its name and its command. ESLint runs without its cache in both checks: its type-aware
# rules can fail in a file that has not changed when another file's types change, which the cache
# cannot see.
linters=(
  "ESLint|pnpm lint --no-cache"
  "Formatting|pnpm format:check"
  "Types|pnpm typecheck"
  "Markdown|pnpm lint:md"
  "Shell scripts|pnpm lint:shell"
  "Duplicates|pnpm lint:duplicates"
)
full_check=(
  "Package tests|pnpm test:packages"
  "Security report|pnpm security"
  "Script tests|pnpm test:scripts"
  "${linters[@]}"
  "Licences|pnpm lint:licences"
  "Renovate settings|pnpm lint:renovate"
)
before_push_jobs=(
  "Changed tests|pnpm test:changed --without-types"
  "${linters[@]}"
)
jobs=("${full_check[@]}")
# The jobs that need the internet, and what each runs instead offline, or nothing to leave it out.
online_jobs=(
  "Security report|pnpm security --offline"
  "Renovate settings|"
)

# A job running longer than this has hung, as the scripts its jobs run also judge.
job_limit_seconds="$(node --input-type=module --eval \
  'import { jobLimitSeconds } from "./scripts/run-command.mjs"; console.log(jobLimitSeconds());')" ||
  fail "could not read the job time limit from scripts/run-command.mjs"
[[ "$job_limit_seconds" =~ ^[1-9][0-9]*$ ]] ||
  fail "the job time limit must be a whole number of seconds, not '$job_limit_seconds'"
stop_grace_seconds=5
logs=""
# Set when a change before a push is documentation alone, whose quick check takes no turn.
without_turn=""
# The process of each job still running, emptied once it ends.
pids=()
# Whether each job's wait for another copy of the repository has been shown, as it waits.
waits_shown=()
results=()
seconds=()

main() {
  local index started skip offline="" before_push=""
  local -a starts=() skips=() arguments=("$@")
  while [ "$#" -gt 0 ]; do
    case "$1" in
      --before-push)
        jobs=("${before_push_jobs[@]}")
        before_push=1
        shift
        ;;
      --offline)
        offline=1
        shift
        ;;
      --skip)
        [ "$#" -ge 2 ] || fail "--skip needs a job's name, such as --skip \"Package tests\""
        skips+=("$2")
        shift 2
        ;;
      *) fail "Usage: check.sh [--before-push] [--offline] [--skip <job name>]..." ;;
    esac
  done
  for skip in ${skips[@]+"${skips[@]}"}; do skip_job "$skip"; done
  [ -z "$before_push" ] || scope_to_change
  if [ -n "$offline" ] && [ -n "$without_turn" ]; then
    # Documentation alone needs nothing 'pnpm offline:prepare' fetches.
    refuse_offline_in_ci
  elif [ -n "$offline" ]; then
    work_offline
  elif needs_connection; then
    require_connection
  fi
  # The arguments and the connection are checked before waiting for a turn, so a mistake fails at once.
  if ! in_turn && [ -z "$without_turn" ]; then
    exec node scripts/check-turn.mjs bash scripts/check.sh ${arguments[@]+"${arguments[@]}"}
  fi
  mkdir -p .tmp && chmod 700 .tmp
  logs="$(mktemp -d "$PWD/.tmp/check.XXXXXX")"
  trap 'show_start_problems; stop_jobs; rm -rf "$logs"' EXIT
  trap 'exit 130' INT
  trap 'exit 143' TERM

  started="$(date +%s)"
  local remaining="${#jobs[@]}" status stopped
  info "Running ${#jobs[@]} jobs side by side; each one's output follows when it ends"
  for index in "${!jobs[@]}"; do
    start_job "$index"
    starts[index]="$(date +%s)"
  done

  while [ "$remaining" -gt 0 ]; do
    for index in "${!jobs[@]}"; do
      [ -n "${pids[index]:-}" ] || continue
      stopped=""
      if [ -s "$logs/$index.status" ]; then
        status="$(cat "$logs/$index.status")"
      elif kill -0 "${pids[index]}" 2>/dev/null; then
        if [ $(($(date +%s) - starts[index])) -lt "$job_limit_seconds" ]; then
          show_wait "$index"
          continue
        fi
        # A job past the limit has hung, so it is stopped, and the check ends once the rest have.
        stopped=1
        status=1
        stop_group "${pids[index]}"
      elif [ -s "$logs/$index.status" ]; then
        status="$(cat "$logs/$index.status")"
      else
        # The job's runner was stopped before it could record how the job ended, so whatever it
        # started is stopped too.
        status=1
        kill -TERM -- "-${pids[index]}" 2>/dev/null || true
        wait "${pids[index]}" 2>/dev/null || true
      fi
      pids[index]=""
      seconds[index]=$(($(date +%s) - starts[index]))
      if [ -n "$stopped" ]; then
        results[index]="Stopped"
      elif [ "$status" = 0 ]; then
        results[index]="Pass"
      else
        results[index]="Fail"
      fi
      remaining=$((remaining - 1))
      printf '\n==> %s: %s in %ss (%s)\n' "$(job_name "$index")" "${results[index]}" "${seconds[index]}" \
        "$(job_command "$index")"
      [ -z "$stopped" ] ||
        printf '==> %s ran past the %ss limit, so it was stopped; its output up to then follows\n' \
          "$(job_name "$index")" "$job_limit_seconds"
      cat "$logs/$index.log" 2>/dev/null || true
    done
    [ "$remaining" -eq 0 ] || sleep 1
  done

  print_results "$(($(date +%s) - started))"
}

# Starts a job in its own process group, so stopping the check stops everything the job started.
# Job control is on only while it starts: left on, every command the check runs gets a group of its
# own. The job and the check both set its group, and on macOS the job sometimes loses that race and
# says its setpgid was not permitted, before its own redirections apply. So what bash says while a
# job starts goes to a log of its own, which show_start_problems passes on without that race, and
# the job's standard error is handed back on descriptor 3.
start_job() {
  set -m
  { run_job "$1" 2>&3 3>&- & } 3>&2 2>>"$logs/starting.log"
  pids[$1]=$!
  set +m
}

show_start_problems() {
  [ -s "$logs/starting.log" ] || return 0
  grep -v 'setpgid (.*): Operation not permitted$' "$logs/starting.log" >&2 || true
}

# Stops a job's process group, and kills it if it hasn't ended a few seconds later, since a hung job
# may not heed the request to stop.
stop_group() {
  local pid="$1" waited=0
  kill -TERM -- "-$pid" 2>/dev/null || true
  while kill -0 -- "-$pid" 2>/dev/null && [ "$waited" -lt "$stop_grace_seconds" ]; do
    sleep 1
    waited=$((waited + 1))
  done
  kill -KILL -- "-$pid" 2>/dev/null || true
  wait "$pid" 2>/dev/null || true
}

# Shows at once that a running job waits for another copy of the repository, such as for its turn to
# run package tests, rather than only with the job's output once it ends.
show_wait() {
  local index="$1" waiting
  [ -z "${waits_shown[index]:-}" ] || return 0
  waiting="$(grep -m 1 '^Waiting to ' "$logs/$index.log" 2>/dev/null)" || return 0
  waits_shown[index]=1
  printf '==> %s: %s\n' "$(job_name "$index")" "$waiting"
}

skip_job() {
  remove_job "$1" || fail "No job left to skip is named $1; those left are: $(job_names)"
  [ "${#jobs[@]}" -gt 0 ] || fail "Every job is skipped, so there is nothing to check"
}

# Removes the job with this name, failing when none is left by that name.
remove_job() {
  local job kept=() matched=1
  for job in "${jobs[@]}"; do
    if [ "${job%%|*}" = "$1" ]; then matched=0; else kept+=("$job"); fi
  done
  jobs=(${kept[@]+"${kept[@]}"})
  return "$matched"
}

# Before a push, keeps only the jobs the change needs: documentation alone needs only the Markdown
# linter, since Prettier leaves Markdown alone and reads no other file under docs/, and is quick
# enough to run without waiting for a turn. ShellCheck runs only when a shell script changed. When
# the changes can't be listed, every job runs.
scope_to_change() {
  local scope job
  if ! scope="$(node --input-type=module --eval \
    'import { changedPaths } from "./scripts/changed-paths.mjs";
     import { isDocumentationOnly } from "./scripts/documentation-only.mjs";
     const paths = changedPaths();
     console.log(isDocumentationOnly(paths) ? "documentation" : paths.some((path) => path.endsWith(".sh")) ? "shell" : "code");' 2>&1)"; then
    ! in_turn || info "The changes couldn't be listed, so every job runs: $scope"
    return 0
  fi
  case "$scope" in
    documentation)
      without_turn=1
      for job in "${jobs[@]}"; do
        [ "${job%%|*}" = "Markdown" ] || remove_job "${job%%|*}"
      done
      [ "${#jobs[@]}" -gt 0 ] || fail "Every job this change needs is skipped, so there is nothing to check"
      info "Only documentation changed, so only Markdown runs"
      ;;
    code)
      remove_job "Shell scripts" || return 0
      [ "${#jobs[@]}" -gt 0 ] || fail "Every job this change needs is skipped, so there is nothing to check"
      ! in_turn || info "No shell script changed, so Shell scripts doesn't run"
      ;;
  esac
}

# Whether any job left needs the internet.
needs_connection() {
  local job online
  for job in "${jobs[@]}"; do
    for online in "${online_jobs[@]}"; do
      [ "${job%%|*}" != "${online%%|*}" ] || return 0
    done
  done
  return 1
}

# Runs each job that needs the internet as it runs offline, leaving out those that can't, and builds
# images with the security fixes 'pnpm offline:prepare' fetched, as the tests' database needs.
work_offline() {
  local job online name kept=() left_out=""
  refuse_offline_in_ci
  [ -s "$fathom_prepared_day" ] ||
    fail "Not ready to work offline. Run 'pnpm offline:prepare' while connected, then try again"
  export FATHOM_OFFLINE=1
  use_prepared_fixes
  for job in "${jobs[@]}"; do
    name="${job%%|*}"
    for online in "${online_jobs[@]}"; do
      [ "$name" = "${online%%|*}" ] || continue
      job="${online}"
      break
    done
    if [ -n "${job#*|}" ]; then
      kept+=("$job")
    else
      left_out="${left_out:+$left_out, }$name"
    fi
  done
  [ "${#kept[@]}" -gt 0 ] || fail "Every job left needs the internet, so there is nothing to check offline"
  jobs=("${kept[@]}")
  # Said once, in the check's turn, rather than again before waiting for it.
  in_turn || return 0
  [ -z "$left_out" ] || info "Working offline, so these are left out: $left_out"
  for job in "${jobs[@]}"; do
    [ "${job%%|*}" != "Security report" ] || info "The security report names each scan it skips offline"
  done
  info "The Check workflow runs everything on the pull request"
}

# Whether this run already holds a check's turn, as one started by check-turn.mjs does.
in_turn() {
  [ "${FATHOM_CHECK_SLOT:-}" = "1" ]
}

job_names() {
  local job names=""
  for job in "${jobs[@]}"; do names="${names:+$names, }${job%%|*}"; done
  printf '%s\n' "$names"
}

job_name() { printf '%s\n' "${jobs[$1]%%|*}"; }
job_command() { printf '%s\n' "${jobs[$1]#*|}"; }

run_job() {
  local index="$1" status=0
  bash -c "$(job_command "$index")" >"$logs/$index.log" 2>&1 </dev/null || status=$?
  printf '%s\n' "$status" >"$logs/$index.status"
}

print_results() {
  local index failed=""
  printf '\n| Job | Result | Seconds |\n| --- | --- | --- |\n'
  for index in "${!jobs[@]}"; do
    printf '| %s | %s | %s |\n' "$(job_name "$index")" "${results[index]}" "${seconds[index]}"
    [ "${results[index]}" = "Pass" ] || failed="${failed:+$failed, }$(job_name "$index")"
  done
  printf '\nTotal: %ss\n' "$1"
  [ -z "$failed" ] || fail "These checks failed: $failed; see their output above"
}

stop_jobs() {
  local pid
  for pid in ${pids[@]+"${pids[@]}"}; do
    [ -n "$pid" ] || continue
    kill -TERM -- "-$pid" 2>/dev/null || true
  done
}

main "$@"
