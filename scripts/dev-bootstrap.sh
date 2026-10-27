#!/usr/bin/env bash
# Prepares a macOS or Linux development machine for Fathom. Safe to run repeatedly.
set -euo pipefail
cd "$(dirname "$0")/.."
# shellcheck source=scripts/lib.sh
source scripts/lib.sh

case "$(uname -s)" in
  Darwin | Linux) ;;
  MINGW* | MSYS* | CYGWIN*) fail "On Windows, run scripts/dev-bootstrap.ps1 in PowerShell instead" ;;
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

if ! grep -qs 'fnm env' "$HOME/.zshrc" "$HOME/.bashrc"; then
  info "Add this line to your shell profile so Node.js switches automatically in this folder:"
  # shellcheck disable=SC2016 # The line is printed for the developer to copy, so it must not expand here.
  printf '    eval "$(fnm env --use-on-cd)"\n'
fi

info "Done"
