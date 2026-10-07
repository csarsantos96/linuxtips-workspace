#!/usr/bin/env bash
# =============================================================================
# health-check.sh - valida a saude do Giropops Status
# =============================================================================
# Uso:
#   ./scripts/health-check.sh                  # checa http://localhost:5000
#   ./scripts/health-check.sh https://vm:5000  # checa outro host
#
# Exit codes:
#   0  - aplicacao saudavel
#   1  - aplicacao respondeu mas esta unhealthy (Redis caiu, etc.)
#   2  - aplicacao nao respondeu
# =============================================================================

set -euo pipefail

BASE_URL="${1:-http://localhost:5000}"
TIMEOUT="${TIMEOUT:-5}"

echo "=== Giropops Status - Health Check ==="
echo "Alvo:      ${BASE_URL}"
echo "Hostname:  $(hostname)"
echo "Data:      $(date -Is)"
echo

http_code=$(curl -s -o /tmp/health.json -w "%{http_code}" \
    --max-time "${TIMEOUT}" "${BASE_URL}/health" || echo "000")

case "${http_code}" in
    200)
        echo "[OK]  HTTP 200 - aplicacao saudavel"
        cat /tmp/health.json
        echo
        exit 0
        ;;
    503)
        echo "[ERR] HTTP 503 - aplicacao unhealthy"
        cat /tmp/health.json
        echo
        exit 1
        ;;
    000)
        echo "[ERR] sem resposta de ${BASE_URL} (timeout ${TIMEOUT}s)"
        exit 2
        ;;
    *)
        echo "[ERR] HTTP ${http_code} inesperado"
        cat /tmp/health.json 2>/dev/null || true
        echo
        exit 1
        ;;
esac
