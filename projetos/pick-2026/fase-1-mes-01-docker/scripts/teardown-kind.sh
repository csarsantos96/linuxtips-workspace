#!/usr/bin/env bash
# teardown-kind.sh — destrói o cluster kind do PICKStack.
#
# Uso:
#   ./scripts/teardown-kind.sh [cluster-name]
#
# Default: pickstack

set -euo pipefail

CLUSTER_NAME="${1:-pickstack}"

if [[ -t 1 ]]; then
  BOLD="$(printf '\033[1m')"; GREEN="$(printf '\033[32m')"
  YELLOW="$(printf '\033[33m')"; BLUE="$(printf '\033[34m')"
  RED="$(printf '\033[31m')"; RESET="$(printf '\033[0m')"
else
  BOLD=""; GREEN=""; YELLOW=""; BLUE=""; RED=""; RESET=""
fi

log()  { echo "${BLUE}==>${RESET} ${BOLD}$*${RESET}"; }
ok()   { echo "${GREEN}✓${RESET} $*"; }
warn() { echo "${YELLOW}!${RESET} $*" >&2; }
err()  { echo "${RED}✗${RESET} $*" >&2; }

if ! command -v kind >/dev/null 2>&1; then
  err "kind não encontrado no PATH — nada a fazer."
  exit 1
fi

if ! kind get clusters 2>/dev/null | grep -qx "${CLUSTER_NAME}"; then
  warn "Cluster kind '${CLUSTER_NAME}' não existe — nada a fazer."
  exit 0
fi

log "Deletando cluster kind '${CLUSTER_NAME}'"
kind delete cluster --name "${CLUSTER_NAME}"
ok "Cluster '${CLUSTER_NAME}' removido"
