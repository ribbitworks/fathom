#!/usr/bin/env bash
# SPDX-License-Identifier: Apache-2.0

# Prepares a macOS or Linux development machine for Fathom. Safe to run repeatedly.
# With --configure-shell, also adds fnm to your shell profile so Node.js switches automatically.

set -euo pipefail
cd "$(dirname "$0")/.."
# shellcheck source=scripts/lib.sh
source scripts/lib.sh

configure_shell=false
for argument in "$@"; do
  case "$argument" in
    --configure-shell) configure_shell=true ;;
    *) fail "Unknown option: $argument (the only option is --configure-shell)" ;;
  esac
done

case "$(uname -s)" in
  Darwin | Linux) ;;
  MINGW* | MSYS* | CYGWIN*) fail "On Windows, run this inside WSL2, as docs/design/development-setup.md sets out" ;;
  *) fail "Unsupported operating system: $(uname -s)" ;;
esac
require_git_repository

if ! command -v fnm >/dev/null 2>&1; then
  command -v brew >/dev/null 2>&1 || fail "Install fnm (https://github.com/Schniz/fnm), then run this again"
  info "Installing fnm"
  brew install fnm
fi
eval "$(fnm env --shell bash)"

node_version="$(cat .node-version)"
info "Using Node.js $node_version"
fnm use --install-if-missing "$node_version" >/dev/null

pnpm_version="$(node -p "require('./package.json').packageManager.replace(/^pnpm@/, '').split('+')[0]")"
if [ "$(pnpm --version 2>/dev/null || true)" != "$pnpm_version" ]; then
  info "Installing pnpm $pnpm_version"
  npm install --global --ignore-scripts "pnpm@$pnpm_version" >/dev/null
fi

require_container_runtime

info "Installing dependencies"
pnpm install

# shellcheck disable=SC2016 # The line is written for the shell to evaluate later, so it must not expand here.
fnm_line='eval "$(fnm env --use-on-cd)"'
# Picks the profile file the developer's shell actually reads at start-up. Bash on macOS starts as a
# login shell and reads only the first of these that exists, so an existing one is never bypassed.
case "$(basename "${SHELL:-}")" in
  zsh)
    profile="${ZDOTDIR:-$HOME}/.zshrc"
    known_profiles="$profile $HOME/.zshrc"
    ;;
  bash)
    profile="$HOME/.bashrc"
    if [ "$(uname -s)" = Darwin ]; then
      profile="$HOME/.bash_profile"
      for candidate in "$HOME/.bash_profile" "$HOME/.bash_login" "$HOME/.profile"; do
        if [ -f "$candidate" ]; then
          profile="$candidate"
          break
        fi
      done
    fi
    known_profiles="$profile $HOME/.bash_profile $HOME/.bash_login $HOME/.profile $HOME/.bashrc"
    ;;
  *)
    profile="$HOME/.bashrc"
    known_profiles="$profile"
    ;;
esac
# shellcheck disable=SC2086 # The list of profile paths is split into separate files on purpose.
if ! grep -qs 'fnm env' $known_profiles; then
  if [ "$configure_shell" = true ]; then
    info "Adding fnm to $profile"
    printf '\n# fnm: switch Node.js versions automatically per project\n%s\n' "$fnm_line" >>"$profile"
  else
    info "To switch Node.js automatically in this folder, add this line to $profile,"
    info "or run this script again with --configure-shell:"
    printf '    %s\n' "$fnm_line"
  fi
fi

info "Done"
