#!/usr/bin/env bash
# SPDX-License-Identifier: Apache-2.0

# Runs the full check, or the changed tests and linters before a push, side by side, then lists
# each job's result and time. Usage: check.sh [--before-push] [--offline] [--skip <job name>]...

set -euo pipefail
cd "$(dirname "$0")/.."
# shellcheck source=scripts/lib.sh
source scripts/lib.sh

# Each job is its name and its command. ESLint runs without its cache in both checks: its
# type-aware rules can fail in a file that has not changed when another file's types change, which
# the cache cannot see.
linters=(
  "ESLint|pnpm lint --no-cache"
  "Formatting|pnpm format:check"
  "Types|pnpm typecheck"
  "Markdown|pnpm lint:md"
  "Shell scripts|pnpm lint:shell"
)
full_check=(
  "${linters[@]}"
  "Licences|pnpm lint:licences"
  "Script tests|pnpm test:scripts"
  "Package tests|pnpm test:packages"
  "Security report|pnpm security"
  "Renovate settings|pnpm lint:renovate"
)
before_push=(
  "Changed tests|pnpm test:changed"
  "${linters[@]}"
)
jobs=("${full_check[@]}")
# The jobs that need the internet, and what each runs instead offline, or nothing to leave it out.
online_jobs=(
  "Security report|pnpm security --offline"
  "Renovate settings|"
)

logs=""
# The process of each job still running, emptied once it ends.
pids=()
# Whether each job's wait for another copy of the repository has been shown, as it waits.
waits_shown=()
results=()
seconds=()

main() {
  local index started skip offline=""
  local -a starts=() skips=()
  while [ "$#" -gt 0 ]; do
    case "$1" in
      --before-push)
        jobs=("${before_push[@]}")
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
  if [ -n "$offline" ]; then
    work_offline
  elif needs_connection; then
    require_connection
  fi
  mkdir -p .tmp && chmod 700 .tmp
  logs="$(mktemp -d "$PWD/.tmp/check.XXXXXX")"
  trap 'stop_jobs; rm -rf "$logs"' EXIT
  trap 'exit 130' INT
  trap 'exit 143' TERM
  # Each job runs in its own process group, so stopping the check stops everything a job started.
  set -m

  started="$(date +%s)"
  for index in "${!jobs[@]}"; do
    run_job "$index" &
    pids[index]=$!
    starts[index]="$(date +%s)"
  done
  info "Started ${#jobs[@]} jobs side by side; each one's output follows when it ends"

  local remaining="${#jobs[@]}" status
  while [ "$remaining" -gt 0 ]; do
    for index in "${!jobs[@]}"; do
      [ -n "${pids[index]}" ] || continue
      if [ -s "$logs/$index.status" ]; then
        status="$(cat "$logs/$index.status")"
      elif kill -0 "${pids[index]}" 2>/dev/null; then
        show_wait "$index"
        continue
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
      if [ "$status" = 0 ]; then results[index]="Pass"; else results[index]="Fail"; fi
      remaining=$((remaining - 1))
      printf '\n==> %s: %s in %ss (%s)\n' "$(job_name "$index")" "${results[index]}" "${seconds[index]}" \
        "$(job_command "$index")"
      cat "$logs/$index.log" 2>/dev/null || true
    done
    [ "$remaining" -eq 0 ] || sleep 1
  done

  print_results "$(($(date +%s) - started))"
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
  local job kept=() matched=""
  for job in "${jobs[@]}"; do
    if [ "${job%%|*}" = "$1" ]; then matched=1; else kept+=("$job"); fi
  done
  [ -n "$matched" ] || fail "No job left to skip is named $1; those left are: $(job_names)"
  [ "${#kept[@]}" -gt 0 ] || fail "Every job is skipped, so there is nothing to check"
  jobs=("${kept[@]}")
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
  [ -z "$left_out" ] || info "Working offline, so these are left out: $left_out"
  for job in "${jobs[@]}"; do
    [ "${job%%|*}" != "Security report" ] || info "The security report names each scan it skips offline"
  done
  info "The Check workflow runs everything on the pull request"
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
